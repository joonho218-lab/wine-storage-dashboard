import { X } from 'lucide-react';
import { CENTER_GROUP, rackLabel } from '../lib/wine';

const chipBase =
  'h-8 pl-3 pr-2 rounded-full border text-[12.5px] inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition';
const selectChip =
  'h-8 pl-3 pr-7 rounded-full border text-[12.5px] whitespace-nowrap shrink-0 appearance-none bg-no-repeat bg-[length:10px] bg-[right_10px_center] focus:outline-none focus:border-wine cursor-pointer';
const caret =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%239b9095' stroke-width='1.5'/%3E%3C/svg%3E\")";

const STATUS_LABEL = { 전체: '상태 전체', 재고있음: '재고 있는 것만', 품절: '품절만', 오류: '점검 필요만' };
const SORT_LABEL = { rack: '정렬: 랙순', name: '정렬: 이름순', qty: '정렬: 재고 많은순', vintage: '정렬: 오래된 빈티지순' };

export default function FilterBar({
  countries,
  vintages,
  selectedCountry,
  onCountry,
  vintageFrom,
  vintageTo,
  onVintageFrom,
  onVintageTo,
  statusFilter,
  onStatus,
  sortBy,
  onSort,
  selectedRack,
  onRack,
  resultText,
  showSort = true,
}) {
  const on = (active) => (active ? 'border-wine/60 bg-wine/15 text-rose-100' : 'border-slate-700 bg-slate-900 text-slate-300');
  const vintageActive = vintageFrom !== '' || vintageTo !== '';

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap">
        {selectedRack !== '전체' && (
          <button type="button" onClick={() => onRack('전체')} className={`${chipBase} ${on(true)}`}>
            {selectedRack === CENTER_GROUP ? '중앙 통로' : rackLabel(selectedRack)}
            <X className="w-3.5 h-3.5" aria-label="랙 필터 해제" />
          </button>
        )}

        <select
          aria-label="국가"
          value={selectedCountry}
          onChange={(e) => onCountry(e.target.value)}
          className={`${selectChip} ${on(selectedCountry !== '전체')}`}
          style={{ backgroundImage: caret }}
        >
          {countries.map((c) => (
            <option key={c} value={c}>
              {c === '전체' ? '국가 전체' : c}
            </option>
          ))}
        </select>

        <div className={`h-8 pl-3 pr-1 rounded-full border text-[12.5px] inline-flex items-center gap-0.5 shrink-0 ${on(vintageActive)}`}>
          <span className="mr-0.5">빈티지</span>
          <select
            aria-label="빈티지 시작"
            value={vintageFrom}
            onChange={(e) => onVintageFrom(e.target.value)}
            className="bg-transparent tabular focus:outline-none cursor-pointer"
          >
            <option value="">처음</option>
            {vintages.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <span className="text-slate-500">–</span>
          <select
            aria-label="빈티지 끝"
            value={vintageTo}
            onChange={(e) => onVintageTo(e.target.value)}
            className="bg-transparent tabular focus:outline-none cursor-pointer"
          >
            <option value="">최근</option>
            {[...vintages].reverse().map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {vintageActive && (
            <button
              type="button"
              onClick={() => {
                onVintageFrom('');
                onVintageTo('');
              }}
              aria-label="빈티지 필터 해제"
              className="w-6 h-6 grid place-items-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          aria-label="재고 상태"
          value={statusFilter}
          onChange={(e) => onStatus(e.target.value)}
          className={`${selectChip} ${on(statusFilter !== '전체')}`}
          style={{ backgroundImage: caret }}
        >
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        {showSort && (
          <select
            aria-label="정렬"
            value={sortBy}
            onChange={(e) => onSort(e.target.value)}
            className={`${selectChip} ${on(false)}`}
            style={{ backgroundImage: caret }}
          >
            {Object.entries(SORT_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="text-xs text-slate-400 tabular" aria-live="polite">
        {resultText}
      </div>
    </div>
  );
}
