import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('iat',2000000000) $$;
grant usage on schema public,auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
create table public.wines(id bigint primary key,country text,name text,vintage text,rack text,in_qty integer default 0,out_qty integer default 0,current_qty integer default 0,status text default '정상',note text,custom_image text,created_at timestamptz default now(),english_name text);
create table public.wine_logs(log_id text primary key,time text,wine_id bigint,name text,vintage text,rack text,country text,change_type text,delta integer,prev_qty integer,new_qty integer,reason text,created_at timestamptz default now());
insert into wines(id,name,vintage,current_qty,in_qty,rack) values (1,'테스트 와인','2018',12,12,'1번랙');
insert into wine_logs(log_id,name) values ('legacy','기존 기록');
insert into auth.users values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222'),('33333333-3333-3333-3333-333333333333');
`);
await db.exec(await readFile(new URL('./database/team-access.sql',import.meta.url),'utf8'));
await db.exec(`insert into public.team_members(user_id,display_name,role,needs_password_change) values
('11111111-1111-1111-1111-111111111111','테스트관리자','admin',false),
('22222222-2222-2222-2222-222222222222','테스트팀원','member',false),
('33333333-3333-3333-3333-333333333333','초기설정팀원','member',true);`);
const checks=[];
async function asUser(id,role='authenticated') { await db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role ${role};`); }
async function denied(sql,pattern) { await assert.rejects(()=>db.query(sql),pattern); }
await asUser('','anon');
await denied('select * from wines',/permission denied/); checks.push('anonymous inventory access denied');
await denied("select change_wine_quantity(1,1,'forbidden')",/permission denied/);
await asUser('44444444-4444-4444-4444-444444444444');
assert.equal((await db.query('select * from wines')).rows.length,0); checks.push('non-team authenticated account denied');
await asUser('33333333-3333-3333-3333-333333333333');
assert.equal((await db.query('select * from wines')).rows.length,0); checks.push('temporary-password account blocked until password setup');
await asUser('22222222-2222-2222-2222-222222222222');
await db.query("select change_wine_quantity(1,-2,'판매 2병')");
let logs=(await db.query("select * from wine_logs where actor_user_id is not null order by created_at desc")).rows;
assert.equal(logs.length,1); assert.equal(logs[0].actor_name,'테스트팀원'); assert.equal(logs[0].prev_qty,12);assert.equal(logs[0].new_qty,10);assert.match(logs[0].reason,/판매 2병/);
checks.push('atomic quantity update logs real actor, server time, before/after and reason');
await denied("insert into wine_logs(log_id,actor_name) values ('forged','테스트관리자')",/permission denied/);
await denied("delete from wine_logs",/permission denied/);
await denied("update wine_logs set actor_name='테스트관리자'",/permission denied/);
await denied("update team_members set role='admin'",/permission denied/);checks.push('audit forgery/deletion and role escalation denied');
await denied("select change_wine_quantity(1,-20,'too much')",/현재 재고/);
assert.equal((await db.query('select current_qty from wines where id=1')).rows[0].current_qty,10);checks.push('overselling rolls back without audit side effects');
const original=logs[0].log_id;
await db.query('select undo_wine_change($1)',[original]);
logs=(await db.query('select * from wine_logs order by created_at desc')).rows;
assert.equal(logs.length,3); assert.equal(logs[0].undo_of,original);
assert.equal((await db.query('select current_qty from wines where id=1')).rows[0].current_qty,12);
await denied(`select undo_wine_change('${original}')`,/이미 되돌린/);checks.push('undo preserves original log and records a new attributed change');
await db.query("select change_wine_quantity(1,-1,'another sale')");
const stale=(await db.query("select log_id from wine_logs where change_type='출고 (-)' order by created_at desc limit 1")).rows[0].log_id;
await db.query("update wines set note='새 메모' where id=1");
await denied(`select undo_wine_change('${stale}')`,/이후 다른 수정/);checks.push('stale undo cannot overwrite subsequent changes');
await denied("select undo_wine_change('legacy')",/자동으로 되돌릴 수/);checks.push('legacy audit records stay intact with no invented actor');
assert.equal((await db.query('delete from wines where id=1 returning id')).rows.length,0);checks.push('team member cannot delete inventory');
await db.exec("reset role; update team_members set session_valid_after='2100-01-01' where display_name='테스트팀원';");
await asUser('22222222-2222-2222-2222-222222222222');
assert.equal((await db.query('select * from wines')).rows.length,0);
await denied("select change_wine_quantity(1,1,'old session')",/팀 계정/);checks.push('password reset invalidates earlier session access');
await asUser('11111111-1111-1111-1111-111111111111');
assert.equal((await db.query('select * from team_members')).rows.length,3);
await db.query('delete from wines where id=1');
const deletion=(await db.query("select * from wine_logs where change_type='와인삭제'")).rows[0];
assert.equal(deletion.actor_name,'테스트관리자');assert.ok(deletion.before_data);assert.equal(deletion.after_data,null);checks.push('admin deletion is audited with original snapshot');
await db.exec('reset role');
assert.equal((await db.query('select count(*)::int as n from wine_logs where log_id=\'legacy\'')).rows[0].n,1);
console.log(JSON.stringify({passed:checks.length,checks},null,2));
await db.close();
