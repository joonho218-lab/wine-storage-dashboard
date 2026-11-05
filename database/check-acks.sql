-- '점검 필요' 항목을 팀원이 확인 완료로 표시한 기록. 재고/이력 데이터는 바꾸지 않습니다.
-- signature는 화면에서 문제 내용으로 만든 값이라, 문제가 달라지면(예: 중복이 하나 더 생김) 다시 점검 필요로 뜹니다.
begin;
create table if not exists public.wine_check_acks (
  signature text primary key check (length(signature) between 1 and 500),
  kind text not null check (kind in ('duplicate','negative')),
  label text not null default '' check (length(label) <= 300),
  acked_by uuid not null default auth.uid(),
  acked_name text not null default '',
  acked_at timestamptz not null default now()
);
alter table public.wine_check_acks enable row level security;
revoke all on public.wine_check_acks from anon, authenticated;
grant select, insert, delete on public.wine_check_acks to authenticated;

-- 확인한 사람과 시간은 서버가 로그인 계정으로 정합니다 (화면에서 보낸 값은 무시).
create or replace function wine_private.stamp_check_ack() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor public.team_members;
begin
  select * into actor from public.team_members where user_id = auth.uid() and active and not needs_password_change;
  if actor.user_id is null then raise exception '팀 계정으로 로그인해 주세요.' using errcode = '42501'; end if;
  new.acked_by := actor.user_id;
  new.acked_name := actor.display_name;
  new.acked_at := now();
  return new;
end;
$$;
revoke all on function wine_private.stamp_check_ack() from public, anon, authenticated;
drop trigger if exists wine_check_ack_stamp on public.wine_check_acks;
create trigger wine_check_ack_stamp before insert on public.wine_check_acks for each row execute function wine_private.stamp_check_ack();

drop policy if exists team_check_acks_select on public.wine_check_acks;
drop policy if exists team_check_acks_insert on public.wine_check_acks;
drop policy if exists team_check_acks_delete on public.wine_check_acks;
create policy team_check_acks_select on public.wine_check_acks for select to authenticated using ((select wine_private.is_member()));
create policy team_check_acks_insert on public.wine_check_acks for insert to authenticated with check ((select wine_private.is_member()));
create policy team_check_acks_delete on public.wine_check_acks for delete to authenticated using ((select wine_private.is_member()));
commit;
