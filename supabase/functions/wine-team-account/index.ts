import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// src/lib/team.js 의 loginEmail 과 같은 규칙이어야 로그인 화면에서 이름으로 들어올 수 있어요.
function loginEmail(name: string) {
  const normalized = String(name).trim().normalize('NFC');
  if (!normalized || normalized.length > 10) return null;
  const encoded = Array.from(new TextEncoder().encode(normalized), byte => byte.toString(16).padStart(2, '0')).join('');
  return `u-${encoded}@wine-team.invalid`;
}
const tempPassword = () => crypto.randomUUID().replaceAll('-', '').slice(0, 18) + 'Aa!';
const BANNED = '876000h'; // 약 100년: 삭제한 계정은 로그인 자체를 막아요.

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: '로그인해 주세요.' }, 401);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: '다시 로그인해 주세요.' }, 401);
  const { data: member } = await admin.from('team_members').select('*').eq('user_id', user.id).single();
  if (!member?.active) return json({ error: '팀 계정만 사용할 수 있어요.' }, 403);
  const claims = JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')));
  if (!claims.iat || claims.iat * 1000 <= new Date(member.session_valid_after).getTime()) return json({ error: '계정이 재설정됐어요. 로그아웃 후 새 비밀번호로 로그인해 주세요.' }, 401);
  const isAdmin = member.role === 'admin' && !member.needs_password_change;

  // 관리자 작업 대상 팀원 확인 (본인은 대상이 될 수 없어요)
  async function target(userId: unknown) {
    if (typeof userId !== 'string' || !userId) return { error: json({ error: '팀원을 골라 주세요.' }, 400) };
    if (userId === user!.id) return { error: json({ error: '내 계정은 여기서 바꿀 수 없어요.' }, 400) };
    const { data } = await admin.from('team_members').select('*').eq('user_id', userId).single();
    if (!data) return { error: json({ error: '팀원을 찾을 수 없어요. 새로고침해 주세요.' }, 404) };
    return { person: data };
  }

  try {
    const body = await req.json();
    if (body.action === 'change-password') {
      if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) return json({ error: '비밀번호를 8~128자로 설정해 주세요.' }, 400);
      const { error } = await admin.auth.admin.updateUserById(user.id, { password: body.password });
      if (error) return json({ error: '비밀번호를 변경하지 못했어요. 다른 비밀번호를 시도해 주세요.' }, 400);
      const { error: profileError } = await admin.from('team_members').update({ needs_password_change: false }).eq('user_id', user.id);
      if (profileError) return json({ error: '비밀번호는 변경됐지만 계정 활성화에 실패했어요. 다시 로그인해 주세요.' }, 500);
      return json({ ok: true });
    }

    // 여기부터는 관리자 전용
    if (!isAdmin) return json({ error: '관리자만 할 수 있어요.' }, 403);

    if (body.action === 'reset-password') {
      const { person, error } = await target(body.user_id);
      if (error) return error;
      if (!person.active) return json({ error: '삭제된 계정이에요. 먼저 다시 사용으로 바꿔 주세요.' }, 400);
      const password = tempPassword();
      const { error: lockError } = await admin.from('team_members').update({ needs_password_change: true, session_valid_after: new Date().toISOString() }).eq('user_id', person.user_id);
      if (lockError) return json({ error: '계정을 재설정하지 못했어요.' }, 500);
      const { error: pwError } = await admin.auth.admin.updateUserById(person.user_id, { password });
      if (pwError) return json({ error: '비밀번호를 재설정하지 못했어요. 다시 시도해 주세요.' }, 500);
      return json({ ok: true, name: person.display_name, password });
    }

    if (body.action === 'create-member') {
      const name = typeof body.name === 'string' ? body.name.trim().normalize('NFC') : '';
      const role = body.role === 'admin' ? 'admin' : 'member';
      const email = loginEmail(name);
      if (!email) return json({ error: '이름을 1~10자로 입력해 주세요.' }, 400);
      const { data: same } = await admin.from('team_members').select('active').eq('display_name', name).maybeSingle();
      if (same) return json({ error: same.active ? '이미 등록된 이름이에요. 같은 이름이 있으면 뒤에 구분을 붙여 주세요 (예: 김민수B).' : '삭제된 계정에 같은 이름이 있어요. 아래 "삭제된 계정"에서 다시 사용으로 바꿔 주세요.' }, 409);
      const password = tempPassword();
      // 예전에 만들다 실패해 팀원 정보 없이 남은 로그인 계정이 있으면 그 계정을 이어서 씁니다.
      const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) return json({ error: '계정 목록을 확인하지 못했어요. 다시 시도해 주세요.' }, 500);
      const orphan = list.users.find(u => u.email === email);
      let userId: string;
      let created = false;
      if (orphan) {
        const { data: linked } = await admin.from('team_members').select('user_id').eq('user_id', orphan.id).maybeSingle();
        if (linked) return json({ error: '이미 등록된 계정이에요. 새로고침해 주세요.' }, 409);
        const { error } = await admin.auth.admin.updateUserById(orphan.id, { password, ban_duration: 'none' });
        if (error) return json({ error: '계정을 만들지 못했어요. 다시 시도해 주세요.' }, 500);
        userId = orphan.id;
      } else {
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error || !data.user) return json({ error: '계정을 만들지 못했어요. 다시 시도해 주세요.' }, 500);
        userId = data.user.id;
        created = true;
      }
      const { error: insertError } = await admin.from('team_members').insert({ user_id: userId, display_name: name, role, needs_password_change: true, session_valid_after: new Date().toISOString() });
      if (insertError) {
        if (created) await admin.auth.admin.deleteUser(userId);
        return json({ error: '팀원 정보를 저장하지 못했어요. 다시 시도해 주세요.' }, 500);
      }
      return json({ ok: true, name, password });
    }

    if (body.action === 'deactivate-member') {
      const { person, error } = await target(body.user_id);
      if (error) return error;
      if (!person.active) return json({ ok: true });
      // 데이터 접근을 먼저 막고(즉시 적용), 로그인 자체도 막아요. 이력에 남은 이름은 그대로 둡니다.
      const { error: offError } = await admin.from('team_members').update({ active: false, session_valid_after: new Date().toISOString() }).eq('user_id', person.user_id);
      if (offError) return json({ error: '계정을 삭제하지 못했어요. 다시 시도해 주세요.' }, 500);
      const { error: banError } = await admin.auth.admin.updateUserById(person.user_id, { ban_duration: BANNED });
      if (banError) return json({ ok: true, warning: '데이터 접근은 막았지만 로그인 차단은 완료하지 못했어요. 한 번 더 삭제를 눌러 주세요.' });
      return json({ ok: true });
    }

    if (body.action === 'reactivate-member') {
      const { person, error } = await target(body.user_id);
      if (error) return error;
      if (person.active) return json({ error: '이미 사용 중인 계정이에요.' }, 400);
      const password = tempPassword();
      const { error: authUpdate } = await admin.auth.admin.updateUserById(person.user_id, { password, ban_duration: 'none' });
      if (authUpdate) return json({ error: '계정을 다시 열지 못했어요. 다시 시도해 주세요.' }, 500);
      const { error: onError } = await admin.from('team_members').update({ active: true, needs_password_change: true, session_valid_after: new Date().toISOString() }).eq('user_id', person.user_id);
      if (onError) return json({ error: '계정을 다시 열지 못했어요. 다시 시도해 주세요.' }, 500);
      return json({ ok: true, name: person.display_name, password });
    }

    if (body.action === 'set-role') {
      const { person, error } = await target(body.user_id);
      if (error) return error;
      if (body.role !== 'admin' && body.role !== 'member') return json({ error: '권한을 골라 주세요.' }, 400);
      const { error: roleError } = await admin.from('team_members').update({ role: body.role }).eq('user_id', person.user_id);
      if (roleError) return json({ error: '권한을 바꾸지 못했어요. 다시 시도해 주세요.' }, 500);
      return json({ ok: true });
    }

    return json({ error: '지원하지 않는 요청이에요. 서버 함수가 최신 버전인지 확인해 주세요.' }, 400);
  } catch { return json({ error: '요청을 처리하지 못했어요.' }, 400); }
});
