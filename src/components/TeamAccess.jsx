import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { loginEmail } from '../lib/team';
import App from '../App';

const inputStyle = 'w-full mt-2 rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white focus:outline-none focus:border-rose-400';
const buttonStyle = 'rounded-xl px-4 py-3 bg-rose-700 hover:bg-rose-600 text-white font-semibold disabled:opacity-50';

export default function TeamAccess() {
  const [session, setSession] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [managing, setManaging] = useState(false);
  const [members, setMembers] = useState([]);
  const [resetResult, setResetResult] = useState(null);

  useEffect(() => {
    let live = true;
    let revision = 0;
    async function load(current) {
      const request = ++revision;
      setSession(current);
      setMember(null);
      setLoading(true);
      if (current) {
        const { data, error: loadError } = await supabase.from('team_members').select('*').eq('user_id', current.user.id).maybeSingle();
        if (!live || request !== revision) return;
        if (loadError || !data?.active) setError('등록된 팀 계정이 아니거나 계정 정보를 불러오지 못했어요. 관리자에게 문의해 주세요.');
        else { setMember(data); setError(''); }
      }
      if (live && request === revision) setLoading(false);
    }
    supabase.auth.getSession().then(({ data }) => { if (live) load(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_event, current) => {
      // Leave the auth callback before starting another Supabase request.
      setTimeout(() => { if (live) load(current); }, 0);
    });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);

  async function signIn(event) {
    event.preventDefault();
    if (busy) return;
    const email = loginEmail(name);
    if (!email) { setError('이름 또는 비밀번호를 확인해 주세요.'); return; }
    setBusy(true); setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      setPassword('');
      if (authError) setError('로그인하지 못했어요. 이름과 비밀번호, 인터넷 연결을 확인해 주세요.');
    } catch { setError('연결하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8 || password !== confirm) { setError('비밀번호를 8자 이상 입력하고 두 칸을 같게 맞춰 주세요.'); return; }
    setBusy(true); setError('');
    try {
      const { data, error: changeError } = await supabase.functions.invoke('wine-team-account', { body: { action: 'change-password', password } });
      if (changeError || data?.error) throw new Error(data?.error || '비밀번호를 변경하지 못했어요. 다시 시도해 주세요.');
      setMember(previous => ({ ...previous, needs_password_change: false }));
      setPassword(''); setConfirm(''); setChanging(false);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function openManagement() {
    setManaging(true); setResetResult(null); setError('');
    const { data, error: listError } = await supabase.from('team_members').select('user_id,display_name,role,active').order('display_name');
    if (listError) setError('팀원 정보를 불러오지 못했어요.');
    else setMembers(data || []);
  }

  async function resetPassword(person) {
    if (busy || !window.confirm(`${person.display_name}님의 비밀번호를 임시 비밀번호로 재설정할까요?`)) return;
    setBusy(true); setError(''); setResetResult(null);
    try {
      const { data, error: resetError } = await supabase.functions.invoke('wine-team-account', { body: { action: 'reset-password', user_id: person.user_id } });
      if (resetError || data?.error) throw new Error(data?.error || '비밀번호를 재설정하지 못했어요.');
      setResetResult({ name: person.display_name, password: data.password });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) { setError('로그아웃하지 못했어요. 연결을 확인해 주세요.'); return; }
    setMember(null); setSession(null); setPassword(''); setConfirm(''); setChanging(false); setManaging(false); setResetResult(null); setError('');
  }

  if (loading) return <div className="min-h-screen bg-slate-950 text-slate-300 grid place-items-center">계정 확인 중…</div>;
  if (!session || !member || member.needs_password_change || changing) {
    const needsPassword = !!member && (member.needs_password_change || changing);
    return <main className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center p-5">
      <section className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
        <p className="text-rose-300 text-sm mb-2">서울석유 · 2층 와인창고</p>
        <h1 className="text-2xl font-bold">{needsPassword ? '내 비밀번호 설정' : '팀 로그인'}</h1>
        <p className="text-sm text-slate-400 mt-3 leading-relaxed">{needsPassword ? `${member.display_name}님, 사용할 비밀번호를 설정해 주세요.` : '이름으로 로그인하면 재고 변경에 수정한 사람과 시간이 자동으로 기록됩니다.'}</p>
        {(!session || needsPassword) && <form onSubmit={needsPassword ? changePassword : signIn} className="mt-6 space-y-4">
          {!needsPassword && <label className="block text-sm">이름<input className={inputStyle} autoComplete="username" value={name} onChange={e => setName(e.target.value)} required placeholder="본인 이름" /></label>}
          <label className="block text-sm">{needsPassword ? '새 비밀번호 (8자 이상, 숫자만 가능)' : '비밀번호'}<input type="password" className={inputStyle} autoComplete={needsPassword ? 'new-password' : 'current-password'} minLength={needsPassword ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} required /></label>
          {needsPassword && <label className="block text-sm">새 비밀번호 확인<input type="password" className={inputStyle} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></label>}
          <button className={`${buttonStyle} w-full`} disabled={busy}>{busy ? '처리 중…' : needsPassword ? '저장하고 시작하기' : '로그인'}</button>
        </form>}
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        <p className="mt-5 text-xs text-slate-500">{needsPassword ? '숫자 8자리도 사용할 수 있어요. 수정자 기록을 위해 비밀번호는 본인만 사용해 주세요.' : '처음 로그인할 때는 전달받은 임시 비밀번호를 사용해 주세요. 비밀번호를 잊으면 관리자에게 문의해 주세요.'}</p>
        {session && <button onClick={signOut} className="mt-4 text-sm underline text-slate-400">{changing && !member?.needs_password_change ? '로그아웃' : '다른 계정으로 로그인'}</button>}
        {changing && !member?.needs_password_change && <button onClick={() => { setChanging(false); setPassword(''); setConfirm(''); setError(''); }} className="ml-4 text-sm underline">취소</button>}
      </section>
    </main>;
  }

  return <>
    <div className="sticky top-0 z-40 bg-slate-900 border-b border-slate-700 text-slate-200 flex flex-wrap gap-3 items-center px-4 py-2 text-xs">
      <strong>{member.display_name} · {member.role === 'admin' ? '관리자' : '팀원'}</strong>
      <span className="text-slate-400 mr-auto">변경 내용은 이름과 함께 기록됩니다</span>
      {member.role === 'admin' && <button onClick={openManagement}>팀원 관리</button>}
      <button onClick={() => { setPassword(''); setConfirm(''); setError(''); setChanging(true); }}>비밀번호 변경</button>
      <button onClick={signOut}>로그아웃</button>
    </div>
    {error && <p role="alert" className="bg-red-950 p-3 text-red-200 text-sm">{error}</p>}
    <App key={member.user_id} member={member} />
    {managing && <div className="fixed inset-0 z-[70] bg-black/80 grid place-items-center p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="team-title" className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-700 w-full max-w-lg max-h-[85vh] overflow-auto">
        <div className="flex justify-between gap-4 mb-5"><h2 id="team-title" className="text-xl font-bold">팀원 관리</h2><button onClick={() => { setManaging(false); setResetResult(null); }}>닫기</button></div>
        <p className="text-sm text-slate-400 mb-4">임시 비밀번호는 해당 팀원에게 개별 전달해 주세요. 기존 비밀번호는 확인할 수 없습니다.</p>
        {members.map(person => <div key={person.user_id} className="flex justify-between items-center gap-3 border-t border-slate-800 py-3"><span>{person.display_name} · {person.role === 'admin' ? '관리자' : '팀원'}</span>{person.user_id !== member.user_id && <button disabled={busy} className="text-sm text-rose-300 disabled:opacity-40" onClick={() => resetPassword(person)}>비밀번호 재설정</button>}</div>)}
        {resetResult && <div className="mt-4 p-4 rounded-xl bg-slate-950"><p>{resetResult.name}님 임시 비밀번호</p><p className="font-mono text-lg select-all break-all mt-2">{resetResult.password}</p><p className="text-xs text-slate-400 mt-2">이 창을 닫으면 표시가 사라집니다. 첫 로그인 후 새 비밀번호를 설정해야 합니다.</p></div>}
      </section>
    </div>}
  </>;
}
