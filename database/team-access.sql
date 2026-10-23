-- Apply after the login UI is ready to deploy. Existing inventory and logs stay intact.
begin;
create schema if not exists wine_private;
revoke all on schema wine_private from public;
grant usage on schema wine_private to authenticated;

create table if not exists public.team_members (
  user_id uuid primary key references auth.users(id),
  display_name text not null unique,
  role text not null check (role in ('admin','member')),
  active boolean not null default true,
  needs_password_change boolean not null default true,
  session_valid_after timestamptz not null default 'epoch'
);
alter table public.team_members enable row level security;
revoke all on public.team_members from anon, authenticated;
grant select on public.team_members to authenticated;
create or replace function wine_private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.team_members where user_id = auth.uid() and active and not needs_password_change
      and to_timestamp(coalesce((auth.jwt()->>'iat')::bigint,0)) > session_valid_after
  );
$$;
create or replace function wine_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.team_members where user_id = auth.uid() and active and role = 'admin' and not needs_password_change
      and to_timestamp(coalesce((auth.jwt()->>'iat')::bigint,0)) > session_valid_after
  );
$$;
revoke all on function wine_private.is_member(), wine_private.is_admin() from public, anon;
grant execute on function wine_private.is_member(), wine_private.is_admin() to authenticated;
drop policy if exists team_member_read on public.team_members;
create policy team_member_read on public.team_members for select to authenticated
using (user_id = (select auth.uid()) or (select wine_private.is_admin()));

alter table public.wine_logs add column if not exists actor_user_id uuid;
alter table public.wine_logs add column if not exists actor_name text;
alter table public.wine_logs add column if not exists before_data jsonb;
alter table public.wine_logs add column if not exists after_data jsonb;
alter table public.wine_logs add column if not exists undo_of text;
create unique index if not exists wine_logs_one_undo on public.wine_logs(undo_of) where undo_of is not null;
create index if not exists wine_logs_created_at_idx on public.wine_logs(created_at desc,log_id);

alter table public.wines enable row level security;
alter table public.wine_logs enable row level security;
drop policy if exists "Allow all operations on wines" on public.wines;
drop policy if exists "Allow all operations on wine_logs" on public.wine_logs;
revoke all on public.wines,public.wine_logs from anon,authenticated;
grant select,insert,update,delete on public.wines to authenticated;
grant select on public.wine_logs to authenticated;
create policy team_wines_select on public.wines for select to authenticated using ((select wine_private.is_member()));
create policy team_wines_insert on public.wines for insert to authenticated with check ((select wine_private.is_member()));
create policy team_wines_update on public.wines for update to authenticated using ((select wine_private.is_member())) with check ((select wine_private.is_member()));
create policy admin_wines_delete on public.wines for delete to authenticated using ((select wine_private.is_admin()));
create policy team_logs_select on public.wine_logs for select to authenticated using ((select wine_private.is_member()));

create or replace function wine_private.audit_wine() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor public.team_members;
  previous jsonb;
  next_data jsonb;
  row_data jsonb;
  old_qty integer;
  next_qty integer;
  kind text;
  description text;
  changed text[] := array[]::text[];
  field text;
begin
  select * into actor from public.team_members where user_id=auth.uid() and active and not needs_password_change
    and to_timestamp(coalesce((auth.jwt()->>'iat')::bigint,0)) > session_valid_after;
  if actor.user_id is null then raise exception '팀 계정으로 로그인해 주세요.' using errcode='42501'; end if;
  if tg_op = 'DELETE' and actor.role <> 'admin' then raise exception '삭제는 관리자만 할 수 있어요.' using errcode='42501'; end if;
  if tg_op <> 'INSERT' then previous := to_jsonb(old) - 'created_at'; end if;
  if tg_op <> 'DELETE' then next_data := to_jsonb(new) - 'created_at'; end if;
  if tg_op = 'UPDATE' and previous = next_data then return new; end if;
  row_data := coalesce(next_data,previous);
  old_qty := coalesce((previous->>'current_qty')::integer,0);
  next_qty := coalesce((next_data->>'current_qty')::integer,0);
  if tg_op='INSERT' then kind := '신규등록 (+)'; description := '와인 신규 등록';
  elsif tg_op='DELETE' then kind := '와인삭제'; description := '와인 항목 삭제';
  else
    foreach field in array array['name','vintage','rack','current_qty','in_qty','out_qty','status','note','english_name','country','custom_image'] loop
      if previous->field is distinct from next_data->field then
        changed := array_append(changed,case field
          when 'rack' then '위치: '||coalesce(previous->>field,'')||' → '||coalesce(next_data->>field,'')
          when 'current_qty' then '재고: '||old_qty||' → '||next_qty||'병'
          when 'note' then '비고: '||coalesce(previous->>field,'')||' → '||coalesce(next_data->>field,'')
          when 'vintage' then '빈티지: '||coalesce(previous->>field,'')||' → '||coalesce(next_data->>field,'')
          when 'custom_image' then '사진 변경'
          when 'english_name' then '영문명 변경'
          else field||' 변경' end);
      end if;
    end loop;
    description := array_to_string(changed,' · ');
    kind := case when next_qty>old_qty then '입고 (+)' when next_qty<old_qty then '출고 (-)'
      when previous->'rack' is distinct from next_data->'rack' then '위치이동'
      when previous->'vintage' is distinct from next_data->'vintage' then '빈티지수정'
      when previous->'note' is distinct from next_data->'note' then '비고수정' else '정보수정' end;
  end if;
  if nullif(current_setting('wine.reason',true),'') is not null then
    description := left(current_setting('wine.reason',true),1000)||' · '||description;
  end if;
  if nullif(current_setting('wine.undo_of',true),'') is not null then kind := '되돌리기'; end if;
  insert into public.wine_logs(log_id,time,wine_id,name,vintage,rack,country,change_type,delta,prev_qty,new_qty,reason,created_at,actor_user_id,actor_name,before_data,after_data,undo_of)
  values(gen_random_uuid()::text,to_char(clock_timestamp() at time zone 'Asia/Seoul','YYYY-MM-DD HH24:MI:SS'),(row_data->>'id')::bigint,
    row_data->>'name',row_data->>'vintage',row_data->>'rack',row_data->>'country',kind,next_qty-old_qty,old_qty,next_qty,description,clock_timestamp(),
    actor.user_id,actor.display_name,previous,next_data,nullif(current_setting('wine.undo_of',true),''));
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function wine_private.audit_wine() from public,anon,authenticated;
drop trigger if exists wine_audit on public.wines;
create trigger wine_audit after insert or update or delete on public.wines for each row execute function wine_private.audit_wine();

-- Invoker rights preserve membership RLS. Row locks serialize concurrent stock changes.
create or replace function public.change_wine_quantity(p_wine_id bigint,p_delta integer,p_reason text default '수동 조정')
returns public.wines language plpgsql security invoker set search_path = '' as $$
declare current_row public.wines; result public.wines; new_qty integer;
begin
  if not wine_private.is_member() then raise exception '팀 계정으로 로그인해 주세요.' using errcode='42501'; end if;
  if p_delta is null or p_delta=0 then raise exception '변경 수량을 입력해 주세요.'; end if;
  select * into current_row from public.wines where id=p_wine_id for update;
  if not found then raise exception '와인을 찾을 수 없어요. 새로고침해 주세요.'; end if;
  new_qty := coalesce(current_row.current_qty,0)+p_delta;
  if p_delta<0 and new_qty<0 then raise exception '현재 재고보다 많이 출고할 수 없어요. 최신 재고를 확인해 주세요.'; end if;
  perform set_config('wine.reason',coalesce(p_reason,'수동 조정'),true);
  update public.wines set current_qty=new_qty,
    in_qty=coalesce(in_qty,0)+greatest(p_delta,0),out_qty=coalesce(out_qty,0)+greatest(-p_delta,0),
    status=case when new_qty<=0 then '재고없음' else '정상' end where id=p_wine_id returning * into result;
  return result;
end;
$$;
create or replace function public.undo_wine_change(p_log_id text) returns void
language plpgsql security invoker set search_path = '' as $$
declare entry public.wine_logs; current_row public.wines; restore public.wines;
begin
  if not wine_private.is_member() then raise exception '팀 계정으로 로그인해 주세요.' using errcode='42501'; end if;
  select * into entry from public.wine_logs where log_id=p_log_id;
  if not found or entry.before_data is null or entry.after_data is null then raise exception '이 기록은 자동으로 되돌릴 수 없어요. 직접 수정해 주세요.'; end if;
  if exists(select 1 from public.wine_logs where undo_of=p_log_id) then raise exception '이미 되돌린 기록이에요.'; end if;
  select * into current_row from public.wines where id=entry.wine_id for update;
  if not found or (to_jsonb(current_row)-'created_at') is distinct from entry.after_data then
    raise exception '이후 다른 수정이 있어 되돌릴 수 없어요. 최신 재고를 확인하고 직접 수정해 주세요.';
  end if;
  restore := jsonb_populate_record(null::public.wines,entry.before_data);
  perform set_config('wine.undo_of',p_log_id,true);
  perform set_config('wine.reason','기록 되돌리기: '||p_log_id,true);
  update public.wines set country=restore.country,name=restore.name,vintage=restore.vintage,rack=restore.rack,
    in_qty=restore.in_qty,out_qty=restore.out_qty,current_qty=restore.current_qty,status=restore.status,note=restore.note,
    custom_image=restore.custom_image,english_name=restore.english_name where id=entry.wine_id;
end;
$$;
revoke all on function public.change_wine_quantity(bigint,integer,text),public.undo_wine_change(text) from public,anon;
grant execute on function public.change_wine_quantity(bigint,integer,text),public.undo_wine_change(text) to authenticated;
commit;
