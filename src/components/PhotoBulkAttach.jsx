import { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { photoNumbers } from '../lib/samdoMap';

// 사진 한꺼번에 붙이기: 비고에 "사진 9465"처럼 번호가 적힌 와인에,
// 고른 사진 파일 중 파일 이름에 같은 번호가 있는 사진을 붙여요 (예: 9465.jpg, IMG_9465.JPG).

// 파일 이름에서 4자리 번호 후보를 뽑아요 (뒤쪽 번호 우선)
export function fileNumbers(name) {
  const base = String(name || '').replace(/\.[^.]+$/, '');
  const runs = base.match(/\d+/g) || [];
  const out = [];
  runs.reverse().forEach((r) => {
    if (r.length === 4) out.push(r);
    else if (r.length > 4) out.push(r.slice(-4));
  });
  return out;
}

export default function PhotoBulkAttach({ stock, placeLabel, compress, onSave, onClose }) {
  const [files, setFiles] = useState([]);
  const [replace, setReplace] = useState(false);
  const [pick, setPick] = useState({}); // rowId → 고른 사진 번호
  const [skip, setSkip] = useState({}); // rowId → true면 이번엔 안 붙임
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');

  // 번호 → 파일 (같은 번호가 여러 개면 처음 것)
  const byNumber = useMemo(() => {
    const m = new Map();
    files.forEach((f) => {
      const n = fileNumbers(f.name)[0];
      if (n && !m.has(n)) m.set(n, f);
    });
    return m;
  }, [files]);

  const urls = useMemo(() => {
    const m = new Map();
    byNumber.forEach((f, n) => m.set(n, URL.createObjectURL(f)));
    return m;
  }, [byNumber]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  // 사진 번호가 적힌 와인 · 그중 고른 파일과 번호가 맞는 것
  const rows = useMemo(() => stock
    .map((r) => ({ row: r, nums: photoNumbers(r.note) }))
    .filter((x) => x.nums.length > 0), [stock]);
  const matched = rows
    .map((x) => ({ ...x, avail: x.nums.filter((n) => byNumber.has(n)) }))
    .filter((x) => x.avail.length > 0 && (replace || !x.row.customImage));
  const alreadyHave = rows.filter((x) => x.row.customImage).length;
  const usedNumbers = new Set(rows.flatMap((x) => x.nums));
  const unusedFiles = [...byNumber.keys()].filter((n) => !usedNumbers.has(n)).length + files.filter((f) => !fileNumbers(f.name).length).length;

  // 기본은 비고에 마지막으로 적힌 번호 (보통 앞면). '다른 사진'으로 바꿀 수 있어요.
  const chosen = (x) => (pick[x.row.id] && x.avail.includes(pick[x.row.id]) ? pick[x.row.id] : x.avail[x.avail.length - 1]);
  const cycle = (x) => {
    const cur = chosen(x);
    const i = x.avail.indexOf(cur);
    setPick((p) => ({ ...p, [x.row.id]: x.avail[(i + 1) % x.avail.length] }));
  };
  const todo = matched.filter((x) => !skip[x.row.id]);

  const save = async () => {
    if (!todo.length || busy) return;
    setBusy(true);
    setError('');
    setDone(0);
    try {
      for (const x of todo) {
        const image = await compress(byNumber.get(chosen(x)));
        await onSave(x.row, image);
        setDone((d) => d + 1);
      }
      onClose(todo.length);
    } catch (err) {
      setError(err.message || '사진을 저장하지 못했어요.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-slate-900 border border-slate-700 w-full sm:max-w-2xl max-h-[92vh] rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">사진 한꺼번에 붙이기</h3>
            <p className="text-xs text-slate-400 mt-0.5">{placeLabel} 와인 중 비고에 사진 번호가 있는 와인({rows.length}종)에, 파일 이름 번호가 같은 사진을 붙여요. 사진은 여러 장을 한 번에 고르세요.</p>
          </div>
          <button type="button" onClick={() => onClose(0)} aria-label="닫기" className="p-1 rounded-lg text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <label className="block rounded-xl border border-dashed border-slate-600 hover:border-rose-400/60 px-3.5 py-3 cursor-pointer">
            <span className="block text-[13px] font-semibold text-slate-100">사진 고르기 (여러 장)</span>
            <span className="block text-[11.5px] text-slate-400">파일 이름에 번호가 있어야 해요. 예: 9465.jpg, IMG_9465.JPG</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { setFiles([...(e.target.files || [])]); setPick({}); setSkip({}); }} />
          </label>

          {files.length > 0 && (
            <div className="text-xs text-slate-300 space-y-0.5">
              <div>고른 사진 <b className="tabular">{files.length}장</b> · 와인과 맞은 와인 <b className="text-emerald-300 tabular">{matched.length}종</b></div>
              {unusedFiles > 0 && <div className="text-slate-500">번호가 맞는 와인이 없는 사진 {unusedFiles}장은 건너뛰어요.</div>}
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="w-4 h-4 accent-rose-500" />
            이미 사진이 있는 와인({alreadyHave}종)도 바꾸기
          </label>

          {matched.length > 0 && (
            <div className="rounded-xl border border-slate-800 divide-y divide-slate-800">
              {matched.map((x) => {
                const n = chosen(x);
                const off = !!skip[x.row.id];
                return (
                  <div key={x.row.id} className={`flex items-center gap-3 px-3 py-2 ${off ? 'opacity-40' : ''}`}>
                    <input type="checkbox" checked={!off} onChange={() => setSkip((s) => ({ ...s, [x.row.id]: !off }))} aria-label="이 와인에 붙이기" className="w-4 h-4 accent-rose-500 shrink-0" />
                    <img src={urls.get(n)} alt="" className="w-11 h-14 object-cover rounded border border-slate-700 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-slate-100 truncate">{x.row.name} <span className="text-gold tabular">{x.row.vintage}</span></div>
                      <div className="text-[11px] text-slate-500 tabular">사진 {n}{x.avail.length > 1 ? ` (${x.avail.indexOf(n) + 1}/${x.avail.length})` : ''}{x.row.customImage ? ' · 지금 사진을 바꿔요' : ''}</div>
                    </div>
                    {x.avail.length > 1 && (
                      <button type="button" onClick={() => cycle(x)} className="shrink-0 text-[11.5px] px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white">다른 사진</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {files.length > 0 && matched.length === 0 && (
            <p className="flex gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              파일 이름의 번호와 맞는 와인이 없어요. 파일 이름에 사진 번호(예: 9465)가 있는지 확인해 주세요.
            </p>
          )}
          {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-slate-800 flex gap-2">
          <button type="button" onClick={() => onClose(0)} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm">취소</button>
          <button type="button" disabled={!todo.length || busy} onClick={save} className="flex-[2] py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold">
            {busy ? `붙이는 중… ${done}/${todo.length}` : todo.length ? `${todo.length}종에 사진 붙이기` : '붙일 사진이 없어요'}
          </button>
        </div>
      </div>
    </div>
  );
}
