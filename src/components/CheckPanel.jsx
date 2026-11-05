import { useEffect, useState } from 'react';
import { X, Check, RotateCcw, Trash2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { rackLabel } from '../lib/wine';

const KIND = {
  duplicate: { label: '중복 등록', tone: 'bg-amber-400/15 text-amber-200' },
  negative: { label: '음수 재고', tone: 'bg-red-400/15 text-red-200' },
};

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 점검 필요 목록: 확인 완료로 표시하면 숫자에서 빠지고, 누가 언제 확인했는지 남아요.
export default function CheckPanel({ issues, acks, acksAvailable, isAdmin, onAck, onUnack, onOpenRow, onDeleteRow, onShowInList, onClose }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const open = issues.filter((i) => !acks.has(i.signature));
  const done = issues.filter((i) => acks.has(i.signature));

  const run = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message || '처리하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy('');
    }
  };

  const IssueCard = ({ issue, acked }) => {
    const ack = acks.get(issue.signature);
    const emptyCopies = issue.kind === 'duplicate' ? issue.rows.filter((r) => (r.currentQty || 0) === 0) : [];
    const canCleanup = isAdmin && emptyCopies.length > 0 && emptyCopies.length < issue.rows.length;
    const row = issue.rows[0];
    return (
      <li className={`rounded-2xl border p-3.5 ${acked ? 'border-slate-800 bg-slate-950/40' : 'border-slate-700 bg-slate-950/70'}`}>
        <div className="flex items-start gap-2">
          <span className={`text-[11px] px-1.5 rounded-md shrink-0 mt-0.5 ${KIND[issue.kind].tone}`}>{KIND[issue.kind].label}</span>
          <div className="min-w-0 flex-1">
            <div className={`text-[14.5px] font-semibold leading-snug ${acked ? 'text-slate-400' : 'text-slate-100'}`}>{row.name}</div>
            <div className="text-xs text-slate-400 mt-0.5 tabular">
              <span className="text-gold">{row.vintage}</span> · {rackLabel(row.rack)}
            </div>
          </div>
        </div>

        <div className="mt-2 text-[12.5px] text-slate-300 leading-relaxed">
          {issue.kind === 'duplicate' ? (
            <>
              같은 와인·빈티지·위치가 <b>{issue.rows.length}번</b> 등록돼 있어요:{' '}
              <span className="tabular">{issue.rows.map((r) => `${r.currentQty}병`).join(', ')}</span>
              {emptyCopies.length > 0 && emptyCopies.length < issue.rows.length && <span className="text-slate-400"> · 0병인 쪽은 실수로 한 번 더 등록된 것일 수 있어요.</span>}
            </>
          ) : (
            <>현재고가 <b className="text-red-300 tabular">{row.currentQty}병</b>으로 기록돼 있어요. 실제 병 수를 세어 입고로 맞춰 주세요.</>
          )}
        </div>

        {acked && ack && (
          <div className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-emerald-300">
            <Check className="w-3.5 h-3.5" /> {ack.acked_name} 확인 · {fmtTime(ack.acked_at)}
          </div>
        )}

        {confirmDel && confirmDel.issue === issue.signature ? (
          <div className="mt-2.5 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-[12.5px] text-red-100">
            0병인 중복 항목 {emptyCopies.length}개를 지울까요? 재고 수량은 그대로이고, 지운 기록은 이력에 남아요.
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setConfirmDel(null)} className="h-8 px-3 rounded-lg border border-slate-600 text-slate-200">취소</button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => run(issue.signature, async () => {
                  for (const r of emptyCopies) await onDeleteRow(r);
                  setConfirmDel(null);
                })}
                className="h-8 px-3 rounded-lg bg-red-500 hover:bg-red-400 text-white font-semibold disabled:opacity-40"
              >
                {busy === issue.signature ? '지우는 중…' : '지우기'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <button type="button" onClick={() => onOpenRow(row)} className="h-8 px-2.5 rounded-lg border border-slate-700 text-[12.5px] text-slate-200 hover:border-slate-500">
              와인 열기
            </button>
            {canCleanup && !acked && (
              <button
                type="button"
                onClick={() => setConfirmDel({ issue: issue.signature })}
                className="h-8 px-2.5 rounded-lg border border-red-400/30 text-[12.5px] text-red-300 hover:bg-red-400/10 inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> 0병 중복 지우기
              </button>
            )}
            {acksAvailable && !acked && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => run(issue.signature, () => onAck(issue))}
                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[12.5px] font-semibold inline-flex items-center gap-1 disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" /> {busy === issue.signature ? '저장 중…' : '확인 완료'}
              </button>
            )}
            {acksAvailable && acked && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => run(issue.signature, () => onUnack(issue.signature))}
                className="h-8 px-2.5 rounded-lg border border-slate-700 text-[12.5px] text-slate-300 hover:border-slate-500 inline-flex items-center gap-1 disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 다시 점검 필요로
              </button>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="check-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 text-slate-100 border border-slate-700 w-full sm:max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-800">
          <div>
            <h2 id="check-title" className="text-lg font-bold">점검 필요 <span className="tabular text-red-300">{open.length}</span>건</h2>
            <p className="text-xs text-slate-400 mt-0.5">확인한 항목은 확인 완료를 누르면 숫자에서 빠져요. 내용이 바뀌면 다시 표시돼요.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-9 h-9 rounded-lg border border-slate-700 grid place-items-center text-slate-400 hover:text-white shrink-0">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {!acksAvailable && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-100">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-300" />
              <span>확인 완료 기능을 쓰려면 서버 설정이 한 번 필요해요. 관리자에게 알려 주세요.</span>
            </div>
          )}
          {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-sm text-red-200">{error}</p>}

          {open.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-8 text-center">
              <Check className="w-6 h-6 mx-auto text-emerald-400" />
              <p className="mt-2 text-sm text-slate-200 font-semibold">지금 점검할 항목이 없어요</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {open.map((issue) => <IssueCard key={issue.signature} issue={issue} acked={false} />)}
            </ul>
          )}

          {open.length > 0 && (
            <button type="button" onClick={onShowInList} className="text-xs text-slate-300 underline underline-offset-2 hover:text-white">
              재고 목록에서 이 항목들만 보기
            </button>
          )}

          {done.length > 0 && (
            <div className="pt-1">
              <button type="button" onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
                확인한 항목 {done.length}건 {showDone ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showDone && (
                <ul className="space-y-2 mt-2">
                  {done.map((issue) => <IssueCard key={issue.signature} issue={issue} acked />)}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
