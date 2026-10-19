import { useState } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';
import { rackLabel } from '../lib/wine';

// 엑셀을 올렸을 때, 서버에 반영하기 전에 무엇이 바뀌는지 보여주고 확인받는 창
export default function SyncReview({ data, onCancel, onApply }) {
  const { diffs, dupRows, missingRows, newCount, excelCount, excelBottles, serverCount, serverBottles } = data;
  const [deleteDup, setDeleteDup] = useState(dupRows.length > 0);
  const [deleteMissing, setDeleteMissing] = useState(false);
  const [backup, setBackup] = useState(true);
  const [open, setOpen] = useState(dupRows.length > 0 ? 'dup' : diffs.length > 0 ? 'diff' : 'missing');

  const deleting = (deleteDup ? dupRows.length : 0) + (deleteMissing ? missingRows.length : 0);
  const keptExtraBottles =
    (deleteDup ? 0 : dupRows.reduce((s, r) => s + (r.currentQty || 0), 0)) +
    (deleteMissing ? 0 : missingRows.reduce((s, r) => s + (r.currentQty || 0), 0));
  const afterCount = excelCount + (deleteDup ? 0 : dupRows.length) + (deleteMissing ? 0 : missingRows.length);
  const afterBottles = excelBottles + keptExtraBottles;

  const Section = ({ id, title, count, tone, children, control }) => (
    <div className="rounded-xl border border-slate-750 bg-slate-950/60">
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        {control}
        <button type="button" onClick={() => setOpen(open === id ? '' : id)} className="flex-1 text-left flex items-center gap-2 min-w-0">
          <span className={`text-sm font-semibold ${tone}`}>{title}</span>
          <span className="text-xs text-slate-400 tabular">{count}건</span>
          <span className="ml-auto text-[11px] text-slate-500 shrink-0">{open === id ? '접기' : '목록 보기'}</span>
        </button>
      </div>
      {open === id && count > 0 && <div className="border-t border-slate-800 max-h-56 overflow-y-auto px-3.5 py-2 space-y-1">{children}</div>}
    </div>
  );

  const RowLine = ({ r }) => (
    <div className="flex items-center gap-2 text-xs text-slate-300 py-0.5">
      <span className="truncate">{r.name}</span>
      <span className="text-gold tabular shrink-0">{r.vintage}</span>
      <span className="text-slate-500 shrink-0">{rackLabel(r.rack)}</span>
      <span className="ml-auto tabular shrink-0">{r.currentQty}병</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="sync-title">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-start justify-between gap-3">
          <div>
            <h3 id="sync-title" className="text-base font-bold text-white">엑셀 반영 전 확인</h3>
            <p className="text-xs text-slate-400 mt-0.5">아래 내용을 확인한 뒤 적용을 눌러야 서버에 반영돼요.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="닫기" className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {/* 전후 비교 */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-slate-750 bg-slate-950/60 py-2.5">
              <div className="text-[11px] text-slate-400">지금 서버</div>
              <div className="text-base font-bold tabular">{serverBottles.toLocaleString()}병</div>
              <div className="text-[11px] text-slate-500 tabular">{serverCount}개 항목</div>
            </div>
            <div className="rounded-xl border border-slate-750 bg-slate-950/60 py-2.5">
              <div className="text-[11px] text-slate-400">엑셀</div>
              <div className="text-base font-bold tabular">{excelBottles.toLocaleString()}병</div>
              <div className="text-[11px] text-slate-500 tabular">{excelCount}개 항목</div>
            </div>
            <div className="rounded-xl border border-gold/60 bg-gold/10 py-2.5">
              <div className="text-[11px] text-gold">적용 후</div>
              <div className="text-base font-bold tabular">{afterBottles.toLocaleString()}병</div>
              <div className="text-[11px] text-slate-400 tabular">{afterCount}개 항목</div>
            </div>
          </div>

          {dupRows.length > 0 && (
            <Section
              id="dup"
              title="중복 항목 삭제"
              count={dupRows.length}
              tone="text-amber-200"
              control={
                <input
                  type="checkbox"
                  checked={deleteDup}
                  onChange={(e) => setDeleteDup(e.target.checked)}
                  aria-label="중복 항목 삭제"
                  className="w-4 h-4 accent-rose-500"
                />
              }
            >
              <p className="text-[11px] text-slate-500 pb-1">엑셀에는 한 번만 있는데 서버에 한 번 더 등록된 항목이에요. 사진·메모가 있는 쪽은 남겨요.</p>
              {dupRows.map((r) => <RowLine key={r.id} r={r} />)}
            </Section>
          )}

          {diffs.length > 0 && (
            <Section id="diff" title="수량·위치 변경" count={diffs.length} tone="text-slate-100">
              {diffs.map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-xs text-slate-300 py-0.5">
                  <span className="truncate">{d.name}</span>
                  <span className="text-gold tabular shrink-0">{d.vintage}</span>
                  <span className="ml-auto shrink-0 tabular">
                    {d.qtyChanged && <>{d.webQty} → <b className="text-emerald-300">{d.excelQty}병</b></>}
                    {d.qtyChanged && d.rackChanged && ' · '}
                    {d.rackChanged && <>{rackLabel(d.webRack)} → <b className="text-emerald-300">{rackLabel(d.excelRack)}</b></>}
                  </span>
                </div>
              ))}
            </Section>
          )}

          {missingRows.length > 0 && (
            <Section
              id="missing"
              title="엑셀에 없는 항목도 삭제"
              count={missingRows.length}
              tone="text-red-200"
              control={
                <input
                  type="checkbox"
                  checked={deleteMissing}
                  onChange={(e) => setDeleteMissing(e.target.checked)}
                  aria-label="엑셀에 없는 항목도 삭제"
                  className="w-4 h-4 accent-rose-500"
                />
              }
            >
              <p className="text-[11px] text-slate-500 pb-1">사이트에서 직접 추가했거나 이름·빈티지가 엑셀과 다른 항목이에요. 기본은 남겨 둬요.</p>
              {missingRows.map((r) => <RowLine key={r.id} r={r} />)}
            </Section>
          )}

          {newCount > 0 && (
            <p className="text-xs text-slate-300 px-1">엑셀에만 있는 새 항목 <b className="tabular">{newCount}건</b>은 추가돼요.</p>
          )}

          <label className="flex items-center gap-2.5 px-1 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={backup} onChange={(e) => setBackup(e.target.checked)} className="w-4 h-4 accent-rose-500" />
            적용 전에 지금 상태를 엑셀로 내려받기 (되돌릴 때 필요)
          </label>

          {deleting > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-xs text-red-100">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{deleting}개 항목이 서버에서 지워져요. 입출고 이력은 그대로 남아요.</span>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-slate-800 text-slate-200 rounded-xl text-sm">
            취소
          </button>
          <button
            type="button"
            onClick={() => onApply({ deleteDup, deleteMissing, backup })}
            className="flex-[1.4] py-2.5 bg-wine hover:bg-rose-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {deleting > 0 ? `적용하고 ${deleting}개 삭제` : '엑셀 내용 적용'}
          </button>
        </div>
      </div>
    </div>
  );
}
