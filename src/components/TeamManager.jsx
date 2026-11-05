import { useCallback, useEffect, useState } from 'react';
import { X, Plus, RotateCcw, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../supabase';
import { loginEmail } from '../lib/team';

const ROLE_LABEL = { admin: '관리자', member: '팀원' };

async function callAccount(body) {
  const { data, error } = await supabase.functions.invoke('wine-team-account', { body });
  if (error || data?.error) {
    let message = data?.error;
    // 함수가 오류 코드로 답하면 본문은 error.context 안에 있어요.
    if (!message && error?.context && typeof error.context.json === 'function') {
      try { message = (await error.context.json())?.error; } catch { /* 본문 없음 */ }
    }
    throw new Error(message || '처리하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
  }
  return data;
}

// 관리자 전용: 팀원 추가 · 권한 변경 · 비밀번호 재설정 · 삭제(사용 중지) · 다시 사용
export default function TeamManager({ me, onClose }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [credential, setCredential] = useState(null); // { name, password, kind }
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [showRemoved, setShowRemoved] = useState(false);

  const load = useCallback(async () => {
    const { data, error: listError } = await supabase
      .from('team_members')
      .select('user_id,display_name,role,active,needs_password_change')
      .order('display_name');
    if (listError) setError('팀원 정보를 불러오지 못했어요. 새로고침해 주세요.');
    else setMembers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (id, body, after) => {
    if (busyId) return;
    setBusyId(id); setError(''); setNotice(''); setCopied(false);
    try {
      const data = await callAccount(body);
      await after?.(data);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const addMember = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!loginEmail(name)) { setError('이름을 1~10자로 입력해 주세요.'); return; }
    if (members.some(m => m.display_name === name)) {
      const removed = members.find(m => m.display_name === name && !m.active);
      setError(removed ? '삭제된 계정에 같은 이름이 있어요. 아래 "삭제된 계정"에서 다시 사용으로 바꿔 주세요.' : '이미 등록된 이름이에요. 같은 이름이 있으면 뒤에 구분을 붙여 주세요 (예: 김민수B).');
      if (removed) setShowRemoved(true);
      return;
    }
    run('new', { action: 'create-member', name, role: newRole }, (data) => {
      setCredential({ name: data.name, password: data.password, kind: '새 계정' });
      setNewName(''); setNewRole('member');
    });
  };

  const copyCredential = async () => {
    const text = `[2층 와인창고] 아이디: ${credential.name} / 임시 비밀번호: ${credential.password}\nhttps://wine-storage-dashboard.vercel.app 에서 로그인한 뒤 새 비밀번호를 설정해 주세요.`;
    try { await navigator.clipboard.writeText(text); setCopied(true); }
    catch { setError('복사하지 못했어요. 아이디와 비밀번호를 길게 눌러 직접 복사해 주세요.'); }
  };

  const active = members.filter(m => m.active);
  const removed = members.filter(m => !m.active);
  const adminCount = active.filter(m => m.role === 'admin').length;

  const btn = 'h-8 px-2.5 rounded-lg border text-[12.5px] inline-flex items-center gap-1 transition disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 text-slate-100 border border-slate-700 w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-800">
          <div>
            <h2 id="team-title" className="text-lg font-bold">팀원 관리</h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular">사용 중 {active.length}명 · 관리자 {adminCount}명</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-9 h-9 rounded-lg border border-slate-700 grid place-items-center text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* 새 팀원 추가 */}
          <form onSubmit={addMember} className="rounded-2xl border border-slate-750 bg-slate-950/60 p-4 space-y-3">
            <div className="text-sm font-semibold">새 팀원 추가</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex-1">
                <span className="sr-only">이름 (로그인 아이디)</span>
                <input
                  id="team-new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={10}
                  placeholder="이름 (로그인 아이디, 10자 이내)"
                  autoComplete="off"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-sm placeholder-slate-500 focus:outline-none focus:border-wine"
                />
              </label>
              <div className="flex gap-2">
                <div className="grid grid-cols-2 rounded-xl border border-slate-700 p-0.5 h-11" role="radiogroup" aria-label="권한">
                  {['member', 'admin'].map(r => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={newRole === r}
                      onClick={() => setNewRole(r)}
                      className={`px-3 rounded-[10px] text-[13px] ${newRole === r ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400'}`}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={!!busyId || !newName.trim()}
                  className="h-11 px-4 rounded-xl bg-wine hover:bg-rose-600 text-white text-sm font-bold inline-flex items-center gap-1 disabled:opacity-40 shrink-0"
                >
                  <Plus className="w-4 h-4" /> {busyId === 'new' ? '추가 중…' : '추가'}
                </button>
              </div>
            </div>
            <p className="text-[11.5px] text-slate-500 leading-relaxed">
              추가하면 임시 비밀번호가 한 번만 표시돼요. 팀원이 처음 로그인할 때 자기 비밀번호로 바꿔요.
              관리자는 팀원 관리·엑셀 일괄 변경·초기화도 할 수 있어요.
            </p>
          </form>

          {/* 방금 만든/재설정한 임시 비밀번호 */}
          {credential && (
            <div className="rounded-2xl border border-gold/60 bg-gold/10 p-4" role="status">
              <div className="text-sm font-semibold text-gold">{credential.name}님 {credential.kind} 준비 완료</div>
              <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-slate-400">아이디</dt>
                <dd className="font-semibold select-all">{credential.name}</dd>
                <dt className="text-slate-400">임시 비밀번호</dt>
                <dd className="font-mono select-all break-all">{credential.password}</dd>
              </dl>
              <div className="flex items-center gap-2 mt-3">
                <button type="button" onClick={copyCredential} className="h-9 px-3 rounded-lg bg-slate-100 text-slate-950 text-[13px] font-semibold inline-flex items-center gap-1">
                  {copied ? <><Check className="w-4 h-4" /> 복사됨</> : '안내 문구 복사'}
                </button>
                <button type="button" onClick={() => setCredential(null)} className="h-9 px-3 rounded-lg border border-slate-600 text-[13px] text-slate-300">
                  전달했어요
                </button>
              </div>
              <p className="text-[11.5px] text-slate-400 mt-2.5">이 창을 닫으면 다시 볼 수 없어요. 카톡 등으로 본인에게만 전달해 주세요.</p>
            </div>
          )}

          {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-sm text-red-200">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2.5 text-sm text-emerald-200">{notice}</p>}

          {/* 사용 중인 계정 */}
          <div>
            <div className="text-xs text-slate-400 mb-1.5">사용 중인 계정</div>
            {loading ? (
              <p className="text-sm text-slate-400 py-4">불러오는 중…</p>
            ) : (
              <ul className="divide-y divide-slate-800 border-y border-slate-800">
                {active.map(person => {
                  const isMe = person.user_id === me.user_id;
                  const busy = busyId === person.user_id;
                  const asking = confirmDelete === person.user_id;
                  return (
                    <li key={person.user_id} className="py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[15px]">{person.display_name}</span>
                        <span className={`text-[11px] px-1.5 rounded-md ${person.role === 'admin' ? 'bg-gold/15 text-gold' : 'bg-slate-800 text-slate-300'}`}>{ROLE_LABEL[person.role]}</span>
                        {isMe && <span className="text-[11px] text-slate-500">나</span>}
                        {person.needs_password_change && <span className="text-[11px] text-amber-300">첫 로그인 전</span>}
                      </div>
                      {!isMe && !asking && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <button
                            type="button"
                            disabled={!!busyId}
                            onClick={() => run(person.user_id, { action: 'set-role', user_id: person.user_id, role: person.role === 'admin' ? 'member' : 'admin' }, () => setNotice(`${person.display_name}님을 ${person.role === 'admin' ? '팀원' : '관리자'}(으)로 바꿨어요.`))}
                            className={`${btn} border-slate-700 text-slate-300 hover:border-slate-500`}
                          >
                            {person.role === 'admin' ? '팀원으로 변경' : '관리자로 변경'}
                          </button>
                          <button
                            type="button"
                            disabled={!!busyId}
                            onClick={() => run(person.user_id, { action: 'reset-password', user_id: person.user_id }, (data) => setCredential({ name: data.name || person.display_name, password: data.password, kind: '비밀번호 재설정' }))}
                            className={`${btn} border-slate-700 text-slate-300 hover:border-slate-500`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> 비밀번호 재설정
                          </button>
                          <button
                            type="button"
                            disabled={!!busyId}
                            onClick={() => { setConfirmDelete(person.user_id); setError(''); }}
                            className={`${btn} border-red-400/30 text-red-300 hover:bg-red-400/10`}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> 삭제
                          </button>
                          {busy && <span className="text-[12px] text-slate-400 self-center">처리 중…</span>}
                        </div>
                      )}
                      {asking && (
                        <div className="mt-2 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-[13px]">
                          <p className="text-red-100">{person.display_name}님을 삭제할까요? 바로 로그인할 수 없게 되고, 이미 남긴 이력의 이름은 그대로 남아요.</p>
                          <div className="flex gap-2 mt-2.5">
                            <button type="button" onClick={() => setConfirmDelete('')} className="h-8 px-3 rounded-lg border border-slate-600 text-slate-200">취소</button>
                            <button
                              type="button"
                              disabled={!!busyId}
                              onClick={() => run(person.user_id, { action: 'deactivate-member', user_id: person.user_id }, (data) => {
                                setConfirmDelete('');
                                setNotice(data?.warning || `${person.display_name}님을 삭제했어요. 필요하면 "삭제된 계정"에서 다시 사용할 수 있어요.`);
                              })}
                              className="h-8 px-3 rounded-lg bg-red-500 hover:bg-red-400 text-white font-semibold disabled:opacity-40"
                            >
                              {busy ? '삭제 중…' : '삭제'}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 삭제된 계정 */}
          {removed.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowRemoved(v => !v)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
                삭제된 계정 {removed.length}명 {showRemoved ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showRemoved && (
                <ul className="mt-1.5 divide-y divide-slate-800 border-y border-slate-800">
                  {removed.map(person => (
                    <li key={person.user_id} className="py-2.5 flex items-center gap-2">
                      <span className="text-slate-400 line-through decoration-slate-600">{person.display_name}</span>
                      <span className="text-[11px] text-slate-500">{ROLE_LABEL[person.role]}</span>
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() => run(person.user_id, { action: 'reactivate-member', user_id: person.user_id }, (data) => setCredential({ name: data.name || person.display_name, password: data.password, kind: '계정 다시 사용' }))}
                        className={`${btn} ml-auto border-slate-700 text-slate-300 hover:border-slate-500`}
                      >
                        {busyId === person.user_id ? '처리 중…' : '다시 사용'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
