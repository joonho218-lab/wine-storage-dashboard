import { useMemo, useState } from 'react';
import {
  SAMDO_UNSORTED, samdoSection, parseShelfPlaces, parseCellarPlaces,
  photoStatus, photoNumbers, needsLocationCheck, sumPlaced,
} from '../lib/samdoMap';

// 삼도빌딩 랙 맵: USA1·USA2는 선반(1층=맨 위), 중앙셀러는 렉·열, 정리 전 와인은 따로 모아요.
// 칩의 점 색 = 사진 유무 (초록: 대시보드에 사진 있음 · 노랑: 현장 사진 번호만 있음 · 회색: 없음)

const DOT = {
  registered: 'bg-emerald-400',
  taken: 'bg-amber-300',
  none: 'bg-slate-600',
};
const DOT_LABEL = { registered: '사진 있음', taken: '현장 사진만', none: '사진 없음' };
const SHELF_LEVELS = [1, 2, 3, 4];
const CELLAR_RACKS = ['C', 'B', 'U', 'I'];

function PhotoDot({ status }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${DOT[status]}`} aria-label={DOT_LABEL[status]} />;
}

// qty: 이 칸의 병 수 (모르면 null) · split: 여러 칸에 나뉘어 있는지
function WineChip({ row, extra, qty = null, split = false, dim, onOpen }) {
  const st = photoStatus(row);
  const nums = photoNumbers(row.note);
  const here = qty != null ? qty : row.currentQty;
  const title = [
    `${row.name} ${row.vintage} · ${qty != null && split ? `이 칸 ${qty}병 / 전체 ${row.currentQty}병` : `${row.currentQty}병`}`,
    extra,
    st === 'registered' ? '대시보드 사진 있음' : st === 'taken' ? `현장 사진 ${nums.join('·')} (대시보드엔 아직 없음)` : '사진 없음',
  ].filter(Boolean).join('\n');
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      title={title}
      className={`max-w-full min-w-0 text-left rounded-lg border border-slate-750 bg-slate-950/70 hover:border-rose-400/60 px-2 py-1 transition ${dim ? 'opacity-25' : ''}`}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <PhotoDot status={st} />
        <span className="truncate text-[11.5px] text-slate-100">{row.name}</span>
        <span className="shrink-0 text-[10.5px] text-gold tabular">{row.vintage}</span>
        <span className="shrink-0 text-[10.5px] text-slate-300 tabular">{qty == null && split ? `총 ${here}병` : `${here}병`}</span>
      </span>
      {extra && <span className="block pl-3.5 text-[10px] text-slate-500 truncate">{extra}</span>}
    </button>
  );
}

function SectionHead({ title, rows, rack, selectedRack, onSelect }) {
  const bottles = rows.reduce((s, r) => s + (r.currentQty || 0), 0);
  const counts = { registered: 0, taken: 0, none: 0 };
  rows.forEach((r) => { counts[photoStatus(r)] += 1; });
  const selected = selectedRack === rack;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2 min-w-0">
      <button
        type="button"
        onClick={() => onSelect(selected ? '전체' : rack)}
        className={`text-[13px] font-semibold hover:underline ${selected ? 'text-gold' : 'text-slate-100'}`}
        title="누르면 아래 목록이 이 구역으로 걸러져요"
      >
        {title}
      </button>
      <span className="text-[11px] text-slate-400 tabular">{rows.length}종 · {bottles}병</span>
      <span className="ml-auto flex items-center gap-2 text-[10.5px] text-slate-400 tabular">
        {['registered', 'taken', 'none'].map((k) => (
          <span key={k} className="flex items-center gap-1"><PhotoDot status={k} />{counts[k]}</span>
        ))}
      </span>
    </div>
  );
}

export default function SamdoMap({ stock, selectedRack, onSelect, onOpenRow }) {
  const [onlyNoPhoto, setOnlyNoPhoto] = useState(false);
  // 휴대폰에서는 접어 두고, 구역 버튼을 눌러 펼쳐요
  const [openSet, setOpenSet] = useState(() => new Set(
    typeof window !== 'undefined' && window.innerWidth < 1024 ? [] : ['USA1', 'USA2', '중앙셀러'],
  ));
  const toggleOpen = (k) => setOpenSet((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  const bySection = useMemo(() => {
    const m = new Map();
    stock.forEach((r) => {
      const s = samdoSection(r.rack);
      if (!m.has(s)) m.set(s, []);
      m.get(s).push(r);
    });
    return m;
  }, [stock]);

  const dim = (row) => onlyNoPhoto && photoStatus(row) === 'registered';
  const rackOf = (s) => (s === SAMDO_UNSORTED ? '삼도빌딩' : `삼도빌딩 ${s}`);

  // USA1·USA2 선반: 층별로 와인을 모아요 (한 와인이 여러 층에 걸치면 층마다 보여요)
  const shelf = (section) => {
    const rows = bySection.get(section) || [];
    const levels = new Map(SHELF_LEVELS.map((l) => [l, []]));
    const unknown = [];
    rows.forEach((r) => {
      const places = parseShelfPlaces(r.note, section);
      if (!places.length) { unknown.push({ row: r, extra: '' }); return; }
      places.forEach((p) => {
        if (!levels.has(p.level)) levels.set(p.level, []);
        levels.get(p.level).push({ row: r, extra: p.text, qty: p.qty, split: places.length > 1 });
      });
    });
    return (
      <div key={section} className="rounded-xl border border-slate-750 bg-slate-950/40 p-2.5 min-w-0">
        <SectionHead title={section} rows={rows} rack={rackOf(section)} selectedRack={selectedRack} onSelect={onSelect} />
        <div className="space-y-1.5">
          {[...levels.keys()].sort((a, b) => a - b).map((l) => (
            <div key={l} className="grid grid-cols-[34px_minmax(0,1fr)] gap-1.5 items-start">
              <div className="text-[10.5px] text-slate-400 pt-1.5 tabular leading-tight">{l}층<span className="block text-slate-500">{levels.get(l).length ? `${sumPlaced(levels.get(l))}병` : ''}</span></div>
              <div className="flex flex-wrap gap-1 min-h-[30px] min-w-0 rounded-lg border border-dashed border-slate-800 p-1">
                {levels.get(l).length === 0
                  ? <span className="text-[10.5px] text-slate-600 px-1 py-1">비어 있음</span>
                  : levels.get(l).map(({ row, extra, qty, split }) => (
                    <WineChip key={`${row.id}-${l}`} row={row} extra={extra} qty={qty} split={split} dim={dim(row)} onOpen={onOpenRow} />
                  ))}
              </div>
            </div>
          ))}
          {unknown.length > 0 && (
            <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-1.5 items-start">
              <div className="text-[10.5px] text-slate-500 pt-1.5">층?</div>
              <div className="flex flex-wrap gap-1 min-w-0">
                {unknown.map(({ row }) => <WineChip key={row.id} row={row} dim={dim(row)} onOpen={onOpenRow} />)}
              </div>
            </div>
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500">1층이 맨 위예요.</p>
      </div>
    );
  };

  // 중앙셀러: 렉(C·B·U·I)마다 열별로, 앞 바닥은 따로
  const cellar = () => {
    const section = '중앙셀러';
    const rows = bySection.get(section) || [];
    const racks = new Map(CELLAR_RACKS.map((k) => [k, new Map()]));
    const floor = [];
    const unknown = [];
    rows.forEach((r) => {
      const places = parseCellarPlaces(r.note, section);
      if (!places.length) { unknown.push(r); return; }
      places.forEach((p) => {
        if (p.floor) { floor.push(r); return; }
        if (!racks.has(p.rack)) racks.set(p.rack, new Map());
        const cols = racks.get(p.rack);
        if (!cols.has(p.col)) cols.set(p.col, []);
        cols.get(p.col).push({ row: r, qty: p.qty, split: places.length > 1 });
      });
    });
    return (
      <div className="rounded-xl border border-slate-750 bg-slate-950/40 p-2.5 min-w-0">
        <SectionHead title="중앙셀러" rows={rows} rack={rackOf(section)} selectedRack={selectedRack} onSelect={onSelect} />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {[...racks.keys()].map((k) => {
            const cols = racks.get(k);
            const colNums = [...cols.keys()].sort((a, b) => a - b);
            const bottles = sumPlaced(colNums.flatMap((c) => cols.get(c)));
            return (
              <div key={k} className="rounded-lg border border-slate-800 p-2 min-w-0">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-[12px] font-semibold text-slate-200">{k}렉</span>
                  <span className="text-[10.5px] text-slate-500 tabular">{bottles}병</span>
                </div>
                {colNums.length === 0 && <p className="text-[10.5px] text-slate-600">비어 있음</p>}
                <div className="space-y-1">
                  {colNums.map((c) => (
                    <div key={c} className="grid grid-cols-[30px_minmax(0,1fr)] gap-1 items-start">
                      <div className="text-[10.5px] text-slate-400 pt-1.5 tabular">{c}열</div>
                      <div className="flex flex-wrap gap-1 min-w-0">
                        {cols.get(c).map(({ row: r, qty, split }) => <WineChip key={`${r.id}-${k}${c}`} row={r} qty={qty} split={split} dim={dim(r)} onOpen={onOpenRow} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {(floor.length > 0 || unknown.length > 0) && (
          <div className="mt-2 rounded-lg border border-slate-800 p-2 min-w-0">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-[12px] font-semibold text-slate-200">앞 바닥</span>
              <span className="text-[10.5px] text-slate-500 tabular">{floor.reduce((s, r) => s + (r.currentQty || 0), 0)}병</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {floor.map((r) => <WineChip key={r.id} row={r} dim={dim(r)} onOpen={onOpenRow} />)}
              {unknown.map((r) => <WineChip key={r.id} row={r} extra="위치 메모 없음" dim={dim(r)} onOpen={onOpenRow} />)}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 아직 정리하지 않은 구역 (보관위치가 '삼도빌딩'만인 와인) 과 그 밖의 새 구역
  const unsorted = bySection.get(SAMDO_UNSORTED) || [];
  const unsortedCheck = unsorted.filter(needsLocationCheck);
  const otherSections = [...bySection.keys()].filter((s) => !['USA1', 'USA2', '중앙셀러', SAMDO_UNSORTED].includes(s));

  return (
    <section id="rack-map" className="bg-slate-900 border border-slate-750 rounded-2xl p-3 lg:p-4 scroll-mt-20 min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2.5">
        <h2 className="text-[13px] lg:text-sm font-semibold text-slate-100">삼도빌딩 랙 맵</h2>
        <span className="flex items-center gap-2.5 text-[11px] text-slate-400">
          {['registered', 'taken', 'none'].map((k) => (
            <span key={k} className="flex items-center gap-1"><PhotoDot status={k} />{DOT_LABEL[k]}</span>
          ))}
        </span>
        <label className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
          <input type="checkbox" checked={onlyNoPhoto} onChange={(e) => setOnlyNoPhoto(e.target.checked)} className="w-3.5 h-3.5 accent-rose-500" />
          사진 없는 와인만 진하게
        </label>
        {selectedRack !== '전체' && (
          <button type="button" onClick={() => onSelect('전체')} className="text-[11px] text-slate-300 hover:text-white underline underline-offset-2">전체 보기</button>
        )}
      </div>

      {/* 구역 요약 · 누르면 펼치기/접기 */}
      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
        {['USA1', 'USA2', '중앙셀러'].map((k) => {
          const rows = bySection.get(k) || [];
          const open = openSet.has(k);
          const counts = { registered: 0, taken: 0, none: 0 };
          rows.forEach((r) => { counts[photoStatus(r)] += 1; });
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggleOpen(k)}
              aria-expanded={open}
              className={`rounded-xl border px-2.5 py-2 text-left transition ${open ? 'border-wine/60 bg-wine/10' : 'border-slate-750 bg-slate-950/50 hover:border-slate-600'}`}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="text-[12.5px] font-semibold text-slate-100">{k}</span>
                <span className="text-[10.5px] text-slate-400">{open ? '접기' : '펼치기'}</span>
              </span>
              <span className="block text-[11px] text-slate-400 tabular">{rows.length}종 · {rows.reduce((t, r) => t + (r.currentQty || 0), 0)}병</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-slate-400 tabular">
                {['registered', 'taken', 'none'].map((c) => <span key={c} className="flex items-center gap-0.5"><PhotoDot status={c} />{counts[c]}</span>)}
              </span>
            </button>
          );
        })}
      </div>

      {(openSet.has('USA1') || openSet.has('USA2')) && (
        <div className={`grid gap-2.5 min-w-0 ${openSet.has('USA1') && openSet.has('USA2') ? 'lg:grid-cols-2' : ''}`}>
          {openSet.has('USA1') && shelf('USA1')}
          {openSet.has('USA2') && shelf('USA2')}
        </div>
      )}
      {openSet.has('중앙셀러') && <div className="mt-2.5">{cellar()}</div>}

      {otherSections.map((s) => {
        const rows = bySection.get(s);
        return (
          <div key={s} className="mt-2.5 rounded-xl border border-slate-750 bg-slate-950/40 p-2.5">
            <SectionHead title={s} rows={rows} rack={rackOf(s)} selectedRack={selectedRack} onSelect={onSelect} />
            <div className="flex flex-wrap gap-1">
              {rows.map((r) => <WineChip key={r.id} row={r} dim={dim(r)} onOpen={onOpenRow} />)}
            </div>
          </div>
        );
      })}

      {unsorted.length > 0 && (
        <div className="mt-2.5 rounded-xl border border-dashed border-slate-700 p-2.5">
          <SectionHead title="아직 정리 전 (ITALY·FRANCE·CHAMPAGNE·SPAIN 등)" rows={unsorted} rack="삼도빌딩" selectedRack={selectedRack} onSelect={onSelect} />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            구역별 정리표가 오면 위처럼 칸에 들어가요.
            {unsortedCheck.length > 0 && (
              <> 이 중 <b className="text-amber-200 tabular">{unsortedCheck.length}종 · {unsortedCheck.reduce((s, r) => s + (r.currentQty || 0), 0)}병</b>은 USA·중앙셀러 정리표에 없던 와인이라 위치 확인이 필요해요.</>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
