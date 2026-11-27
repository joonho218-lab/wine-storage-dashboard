import { useMemo, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const COUNTRIES = ['프랑스', '미국', '이탈리아', '스페인', '호주', '칠레', '포르투갈', '독일', '기타'];

// 엑셀이나 표에서 복사한 줄을 한 번에 등록해요.
// 한 줄에 하나: 와인명 · 빈티지 · 수량 [· 원산지 · 영문명]  (탭 또는 " / " 로 구분)
export function parseBulk(text) {
  const out = [];
  const errors = [];
  const merged = new Map();
  String(text || '').split(/\r?\n/).forEach((line, i) => {
    const raw = line.trim();
    if (!raw) return;
    const cells = (raw.includes('\t') ? raw.split('\t') : raw.split(/\s+\/\s+/)).map((c) => c.trim());
    const [name, vintageRaw, qtyRaw, countryRaw, english] = cells;
    if (!name || /^(와인명|품명)$/.test(name)) return; // 머리글 줄 건너뜀
    const qty = Number(String(qtyRaw || '').replace(/[^0-9]/g, ''));
    if (!Number.isInteger(qty) || qty < 1) { errors.push(`${i + 1}번째 줄: 수량을 읽지 못했어요 (${raw})`); return; }
    const vintage = String(vintageRaw || '').trim() || 'NV';
    const country = COUNTRIES.includes(countryRaw) ? countryRaw : (countryRaw ? '기타' : '프랑스');
    const key = `${name}__${vintage}`;
    if (merged.has(key)) { const r = merged.get(key); r.qty += qty; r.mergedLines += 1; return; }
    const row = { name, vintage, qty, country, englishName: (english || '').trim(), mergedLines: 1 };
    merged.set(key, row);
    out.push(row);
  });
  return { rows: out, errors };
}

// images: { '와인명__빈티지': 사진 dataURL } — 사진으로 읽은 와인은 사진도 함께 저장해요
export default function BulkAdd({ racks, defaultRack, onClose, onSubmit, initialText = '', notice = '', images = {} }) {
  const [text, setText] = useState(initialText);
  const [rack, setRack] = useState(defaultRack);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { rows, errors } = useMemo(() => parseBulk(text), [text]);
  const bottles = rows.reduce((s, r) => s + r.qty, 0);

  const submit = async () => {
    if (!rows.length || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit({ rows: rows.map((r) => ({ ...r, image: images[`${r.name}__${r.vintage}`] || null })), rack, note: note.trim() });
    } catch (err) {
      setError(err.message || '등록하지 못했어요. 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-slate-900 border border-slate-700 w-full sm:max-w-2xl max-h-[92vh] rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">여러 와인 한 번에 등록</h3>
            <p className="text-xs text-slate-400 mt-0.5">엑셀에서 <b className="text-slate-200">와인명 · 빈티지 · 수량</b> 칸을 복사해 붙여넣어요. 원산지 · 영문명 칸은 있으면 함께 읽어요.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-1 rounded-lg text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {notice && <p className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs text-sky-100 leading-relaxed">{notice}</p>}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={'에세조\t2017\t2\n샤또 라뚜르\t1997\t6\n(탭 대신 " / " 로 나눠도 돼요: 도미누스 / 1992 / 1 / 미국 / Dominus)'}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-[13px] text-white font-mono placeholder-slate-600 focus:outline-none focus:border-rose-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-300 mb-1">보관 위치 (전체)</span>
              <select value={rack} onChange={(e) => setRack(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white">
                {racks.filter((r) => r !== '직접입력').map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-300 mb-1">비고 (전체, 선택)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 회장님댁 셀러 이관" className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white" />
            </label>
          </div>
          {errors.length > 0 && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 space-y-0.5">
              {errors.map((e) => <div key={e} className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{e}</div>)}
            </div>
          )}
          {rows.length > 0 && (
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead className="bg-slate-850 text-slate-400">
                  <tr><th className="text-left px-2.5 py-1.5 font-medium">와인명</th><th className="px-2 font-medium">빈티지</th><th className="px-2 font-medium">수량</th><th className="px-2 font-medium hidden sm:table-cell">원산지</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.name}__${r.vintage}`} className="border-t border-slate-800">
                      <td className="px-2.5 py-1.5 text-slate-100">
                        <div className="flex items-center gap-2">
                          {images[`${r.name}__${r.vintage}`] && <img src={images[`${r.name}__${r.vintage}`]} alt="" className="w-7 h-10 object-cover rounded border border-slate-700 shrink-0" />}
                          <div className="min-w-0">
                        {r.name}
                        {r.englishName && <div className="text-[11px] italic font-serif text-slate-500">{r.englishName}</div>}
                        {r.mergedLines > 1 && <div className="text-[11px] text-amber-300">같은 줄 {r.mergedLines}개를 합쳤어요</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 text-center text-gold tabular">{r.vintage}</td>
                      <td className="px-2 text-center tabular">{r.qty}</td>
                      <td className="px-2 text-center text-slate-400 hidden sm:table-cell">{r.country}</td>
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
          <button type="button" disabled={!rows.length || busy} onClick={submit} className="flex-[2] py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold">
            {busy ? '등록하는 중…' : rows.length ? `${rows.length}종 · ${bottles}병 등록` : '붙여넣은 줄이 없어요'}
          </button>
        </div>
      </div>
    </div>
  );
}
