import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loginEmail } from '../src/lib/team.js';

// Supply credentials via the process environment, never command-line arguments.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const output = process.env.WINE_TEAM_CREDENTIALS_OUTPUT;
const membersPath = process.env.WINE_TEAM_MEMBERS_PATH;
if (!url || !key || !output || !membersPath) throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WINE_TEAM_MEMBERS_PATH and WINE_TEAM_CREDENTIALS_OUTPUT in the process environment.');
const team = JSON.parse(await readFile(membersPath, 'utf8'));
if (!Array.isArray(team) || !team.length || team.some(person => !loginEmail(person.name) || !['admin','member'].includes(person.role)) || new Set(team.map(person => loginEmail(person.name))).size !== team.length || !team.some(person => person.role === 'admin')) throw new Error('Invalid private team configuration.');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: existingMembers, error: memberError } = await client.from('team_members').select('display_name');
if (memberError) throw new Error('Apply database/team-access.sql before provisioning accounts.');
const { data: { users }, error: usersError } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) throw usersError;
const path = resolve(output);
// Refuse to overwrite an earlier credentials handoff.
await writeFile(path, '# 와인창고 팀 계정\n\n임시 비밀번호를 해당 팀원에게 개별 전달하세요. 첫 로그인 후 새 비밀번호를 설정해야 합니다.\n\n', { flag: 'wx', mode: 0o600 });
let created = 0;
for (const person of team) {
  if (existingMembers.some(m => m.display_name === person.name)) continue;
  const email = loginEmail(person.name);
  if (users.some(u => u.email === email)) throw new Error(`Existing auth account for ${person.name} has no membership. Reconcile it manually before retrying; existing passwords were not changed.`);
  const password = randomBytes(15).toString('base64url') + 'Aa!';
  const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  // Persist the handoff before another remote step can fail.
  await writeFile(path, `## ${person.name} (${person.role === 'admin' ? '관리자' : '팀원'})\n\n아이디: ${person.name}\n\n임시 비밀번호: ${password}\n\n`, { flag: 'a', mode: 0o600 });
  const { error: insertError } = await client.from('team_members').insert({ user_id: data.user.id, display_name: person.name, role: person.role, needs_password_change: true });
  if (insertError) throw new Error(`Auth account created for ${person.name}, but membership failed. The handoff file contains its temporary password. Reconcile membership manually.`);
  created++;
}
console.log(`Prepared ${created} new team accounts. Credentials were written to the private output file, not the console.`);
