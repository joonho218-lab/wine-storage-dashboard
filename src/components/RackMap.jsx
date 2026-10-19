import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { WALL_RACKS, CENTER_RACKS, CENTER_GROUP, heatColor, rackLabel } from '../lib/wine';

// 랙 맵: 병 수에 따라 색이 진해지는 히트맵. 칸을 누르면 목록이 그 랙으로 필터됩니다.
export default function RackMap({ rackCountMap, specialRacks, selectedRack, onSelect }) {
  const [showSpecialMobile, setShowSpecialMobile] = useState(false);

  const { min, max } = useMemo(() => {
    const counts = WALL_RACKS.map((r) => rackCountMap[r] || 0).filter((c) => c > 0);
    return { min: counts.length ? Math.min(...counts) : 0, max: counts.length ? Math.max(...counts) : 0 };
  }, [rackCountMap]);

  const centerTotal = CENTER_RACKS.reduce((s, r) => s + (rackCountMap[r] || 0), 0);
  const toggle = (r) => onSelect(selectedRack === r ? '전체' : r);

  const selectedText =
    selectedRack === '전체'
      ? '칸을 누르면 목록이 그 랙으로 필터돼요'
      : selectedRack === CENTER_GROUP
        ? '중앙 통로 전체 선택됨'
        : `${rackLabel(selectedRack)} 선택됨`;

  return (
    <section id="rack-map" className="bg-slate-900 border border-slate-750 rounded-2xl p-3 lg:p-4 scroll-mt-20">
      <div className="flex items-center gap-2 mb-2.5">
        <h2 className="text-[13px] lg:text-sm font-semibold text-slate-100 shrink-0">랙 맵</h2>
        <p className={`text-[11px] lg:text-xs truncate ${selectedRack === '전체' ? 'text-slate-400' : 'text-gold'}`}>{selectedText}</p>
        {selectedRack !== '전체' ? (
          <button
            type="button"
            onClick={() => onSelect('전체')}
            className="ml-auto shrink-0 text-[11px] lg:text-xs text-slate-300 hover:text-white underline underline-offset-2"
          >
            전체 보기
          </button>
        ) : (
          <div className="ml-auto hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0">
            적음
            <span className="block w-16 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg,#2c242a,#4e2030,#962a42,#ec607a)' }} />
            많음
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_240px] gap-3">
        {/* 외곽 벽면 랙 */}
        <div>
          <div className="text-[10.5px] lg:text-[11px] text-slate-400 mb-1.5">외곽 벽면 랙 1–27번</div>
          <div className="grid grid-cols-9 lg:grid-cols-[repeat(14,minmax(0,1fr))] gap-1">
            {WALL_RACKS.map((r, i) => {
              const count = rackCountMap[r] || 0;
              const selected = selectedRack === r;
              const bg = heatColor(count, min, max);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggle(r)}
                  aria-pressed={selected}
                  aria-label={`${i + 1}번랙 ${count}병`}
                  style={bg ? { backgroundColor: bg } : undefined}
                  className={`h-10 lg:h-11 rounded-lg flex flex-col items-center justify-center leading-tight tabular transition touch-manipulation ${
                    bg ? 'text-white' : 'border border-dashed border-slate-700 text-slate-500'
                  } ${selected ? 'ring-2 ring-gold ring-offset-2 ring-offset-slate-900' : 'hover:brightness-110'}`}
                >
                  <span className="text-[11px] font-semibold">{i + 1}</span>
                  <span className="text-[9.5px] opacity-75">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 중앙 통로 랙 */}
        <div>
          <button
            type="button"
            onClick={() => toggle(CENTER_GROUP)}
            className={`text-[10.5px] lg:text-[11px] mb-1.5 tabular hover:underline ${selectedRack === CENTER_GROUP ? 'text-gold font-semibold' : 'text-slate-400'}`}
          >
            중앙 통로 1–6번줄 · {centerTotal}병 {selectedRack === CENTER_GROUP ? '✓' : ''}
          </button>
          <div className="grid grid-cols-6 lg:grid-cols-3 gap-1">
            {CENTER_RACKS.map((r, i) => {
              const count = rackCountMap[r] || 0;
              const selected = selectedRack === r;
              const inGroup = selectedRack === CENTER_GROUP;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggle(r)}
                  aria-pressed={selected}
                  className={`h-10 lg:h-11 rounded-lg flex flex-col items-center justify-center leading-tight tabular border-[1.5px] transition touch-manipulation ${
                    selected || inGroup ? 'border-gold bg-gold/10 text-slate-100' : 'border-slate-700 bg-slate-850 text-slate-200 hover:border-slate-500'
                  }`}
                >
                  <span className="text-[11px] font-semibold">{i + 1}줄</span>
                  <span className="text-[9.5px] text-gold">{count}병</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 특수 보관: 모바일은 접어서, PC는 항상 */}
      {specialRacks.length > 0 && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setShowSpecialMobile((v) => !v)}
            className="lg:hidden flex items-center gap-1 text-[11px] text-slate-400"
          >
            특수 보관 {specialRacks.length}곳
            {showSpecialMobile ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <div className={`${showSpecialMobile ? 'flex' : 'hidden'} lg:flex flex-wrap items-center gap-1.5 mt-1.5 lg:mt-0`}>
            <span className="hidden lg:inline text-[11px] text-slate-400 mr-1">특수 보관</span>
            {specialRacks.map((r) => {
              const count = rackCountMap[r] || 0;
              const selected = selectedRack === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggle(r)}
                  aria-pressed={selected}
                  className={`h-7 px-2.5 rounded-full text-[11.5px] border inline-flex items-center gap-1.5 tabular transition touch-manipulation ${
                    selected
                      ? 'border-gold bg-gold/10 text-slate-100'
                      : count > 0
                        ? 'border-slate-700 bg-slate-850 text-slate-200 hover:border-slate-500'
                        : 'border-slate-750 text-slate-500'
                  }`}
                >
                  {r}
                  <span className="text-gold">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
