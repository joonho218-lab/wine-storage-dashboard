import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

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
    if (body.action === 'reset-password') {
      if (member.role !== 'admin' || member.needs_password_change) return json({ error: '관리자만 할 수 있어요.' }, 403);
      if (body.user_id === user.id) return json({ error: '내 비밀번호는 비밀번호 변경 메뉴를 사용해 주세요.' }, 400);
      const { data: target } = await admin.from('team_members').select('user_id,active').eq('user_id', body.user_id).single();
      if (!target?.active) return json({ error: '팀원을 찾을 수 없어요.' }, 404);
      const password = crypto.randomUUID().replaceAll('-', '').slice(0, 18) + 'Aa!';
      const { error: lockError } = await admin.from('team_members').update({ needs_password_change: true, session_valid_after: new Date().toISOString() }).eq('user_id', target.user_id);
      if (lockError) return json({ error: '계정을 재설정하지 못했어요.' }, 500);
      const { error } = await admin.auth.admin.updateUserById(target.user_id, { password });
      if (error) return json({ error: '비밀번호를 재설정하지 못했어요. 다시 시도해 주세요.' }, 500);
      return json({ ok: true, password });
    }
    return json({ error: '지원하지 않는 요청이에요.' }, 400);
  } catch { return json({ error: '요청을 처리하지 못했어요.' }, 400); }
});
