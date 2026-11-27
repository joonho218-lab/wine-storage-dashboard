import { useMemo, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

// 영문명 한꺼번에 고치기.
// 한 줄에 하나: 와인명(지금 화면의 한글명 그대로) · 영문명  (탭 또는 " / " 로 구분)
// 지금 보고 있는 장소의 와인 중 와인명이 똑같은 항목(모든 빈티지)에 영문명을 넣어요.
export function parseEnglishLines(text, stock) {
  const byName = new Map();
  stock.forEach((r) => {
    const k = String(r.name || '').trim();
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(r);
  });
  const items = [];
  const notFound = [];
  const seen = new Set();
  String(text || '').split(/\r?\n/).forEach((line) => {
    const raw = line.trim();
    if (!raw) return;
    const cells = (raw.includes('\t') ? raw.split('\t') : raw.split(/\s+\/\s+/)).map((c) => c.trim());
    const [name, english] = cells;
    if (!name || /^(와인명|품명)$/.test(name)) return; // 머리글 줄 건너뜀
    if (!english) return;
    if (seen.has(name)) return;
    seen.add(name);
    const rows = byName.get(name);
    if (!rows) { notFound.push(name); return; }
    const before = Array.from(new Set(rows.map((r) => r.englishName || ''))).join(' / ');
    items.push({ name, english, ids: rows.map((r) => r.id), before, same: rows.every((r) => (r.englishName || '') === english) });
  });
  return { items, notFound };
}

export default function EnglishBulkEdit({ stock, placeLabel, onClose, onSubmit }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { items, notFound } = useMemo(() => parseEnglishLines(text, stock), [text, stock]);
  const changes = items.filter((i) => !i.same);
  const rowCount = changes.reduce((s, i) => s + i.ids.length, 0);

  const submit = async () => {
    if (!changes.length || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(changes);
    } catch (err) {
      setError(err.message || '저장하지 못했어요. 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-slate-900 border border-slate-700 w-full sm:max-w-2xl max-h-[92vh] rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">영문명 한꺼번에 고치기</h3>
            <p className="text-xs text-slate-400 mt-0.5">{placeLabel} 와인만 바꿔요. 한 줄에 <b className="text-slate-200">와인명 · 영문명</b>을 붙여넣으면, 와인명이 똑같은 항목(모든 빈티지)에 영문명을 넣어요.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-1 rounded-lg text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={'샤또 몽로즈\tChâteau Montrose\n퀸테사\tQuintessa\n(탭 대신 " / " 로 나눠도 돼요)'}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-[13px] text-white font-mono placeholder-slate-600 focus:outline-none focus:border-rose-500"
          />
          {notFound.length > 0 && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              <div className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />이 장소에 없는 와인명 {notFound.length}개는 건너뛰어요: {notFound.slice(0, 8).join(', ')}{notFound.length > 8 ? ' …' : ''}</div>
            </div>
          )}
          {items.length > 0 && (
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead className="bg-slate-850 text-slate-400">
                  <tr><th className="text-left px-2.5 py-1.5 font-medium">와인명</th><th className="text-left px-2 font-medium">지금 → 바꿀 영문명</th><th className="px-2 font-medium">항목</th></tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.name} className={`border-t border-slate-800 ${i.same ? 'opacity-40' : ''}`}>
                      <td className="px-2.5 py-1.5 text-slate-100">{i.name}</td>
                      <td className="px-2 py-1.5">
                        {i.before && !i.same && <div className="text-[11px] text-slate-500 line-through">{i.before}</div>}
                        <div className="italic font-serif text-slate-200">{i.english}</div>
                        {i.same && <div className="text-[11px] text-slate-500">이미 같아요</div>}
                      </td>
                      <td className="px-2 text-center tabular text-slate-400">{i.ids.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-slate-800 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm">취소</button>
          <button type="button" disabled={!changes.length || busy} onClick={submit} className="flex-[2] py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold">
            {busy ? '저장하는 중…' : changes.length ? `${changes.length}종 · ${rowCount}개 항목 영문명 저장` : '바꿀 줄이 없어요'}
          </button>
        </div>
      </div>
    </div>
  );
}
