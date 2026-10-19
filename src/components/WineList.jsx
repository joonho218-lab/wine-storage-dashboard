import { rackLabel, COUNTRY_FLAG } from '../lib/wine';
import { SortIcon } from './icons';

function Flag({ country }) {
  const code = COUNTRY_FLAG[country];
  if (!code) return null;
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt=""
      className="w-4 h-3 object-cover rounded-[2px] inline-block shrink-0"
      loading="lazy"
    />
  );
}

function VintageChip({ row, onClick, active }) {
  const out = row.currentQty <= 0;
  const err = row.currentQty < 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-6 px-1.5 rounded-md border text-[11px] tabular inline-flex items-center gap-1 whitespace-nowrap transition ${
        active ? 'border-gold bg-gold/10' : 'border-slate-750 bg-slate-850 hover:border-slate-600'
      } ${out && !err ? 'opacity-50' : ''}`}
      title={`${row.vintage} · ${rackLabel(row.rack)} · ${row.currentQty}병`}
    >
      <b className="text-gold font-semibold">{row.vintage}</b>
      <span className={err ? 'text-red-400 font-semibold' : out ? 'text-red-300' : 'text-slate-100'}>{row.currentQty}</span>
    </button>
  );
}

function RackText({ group }) {
  const extra = group.racks.length - 1;
  return (
    <span className="text-wine-light">
      ● {rackLabel(group.primaryRack)}
      {extra > 0 && <span className="text-slate-500"> 외 {extra}곳</span>}
    </span>
  );
}

// 모바일: 와인 하나당 카드 한 장, 빈티지는 칩으로
export function GroupCards({ groups, onOpen, selectedKey, selectedRowId }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {groups.map((g) => (
        <div
          key={g.key}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(g, g.rows[0].id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onOpen(g, g.rows[0].id);
          }}
          className={`min-w-0 text-left bg-slate-900 border rounded-2xl px-3 py-2.5 cursor-pointer transition ${
            selectedKey === g.key ? 'border-wine/70' : g.hasError ? 'border-red-400/40' : 'border-slate-750 hover:border-slate-600'
          }`}
        >
          <div className="flex items-start gap-2">
            {g.image && (
              <img src={g.image} alt="" className="w-9 h-12 object-contain rounded-md bg-slate-950 border border-slate-750 shrink-0" loading="lazy" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-semibold text-slate-100 leading-snug tracking-tight">{g.name}</div>
              {g.englishName && <div className="text-[12.5px] italic font-serif text-slate-400 truncate">{g.englishName}</div>}
            </div>
            <div className="text-right leading-none shrink-0 pl-1">
              <div className={`text-lg font-bold tabular ${g.hasError ? 'text-red-400' : g.totalQty <= 0 ? 'text-red-300' : 'text-slate-100'}`}>{g.totalQty}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">병</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-400 min-w-0">
            <Flag country={g.country} />
            <span className="shrink-0">{g.country}</span>
            <span className="text-slate-600">·</span>
            <span className="truncate"><RackText group={g} /></span>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {g.rows.map((r) => (
              <VintageChip
                key={r.id}
                row={r}
                active={selectedKey === g.key && selectedRowId === r.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(g, r.id);
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SortHeader({ label, value, sortBy, onSort, className = '' }) {
  const active = sortBy === value;
  return (
    <th className={`px-3 py-2.5 font-medium whitespace-nowrap ${className}`}>
      <button
        type="button"
        onClick={() => onSort(value)}
        className={`inline-flex items-center gap-1 hover:text-slate-100 ${active ? 'text-slate-100' : ''}`}
      >
        {label}
        <SortIcon className={`w-3 h-3 ${active ? 'text-gold' : 'opacity-40'}`} />
      </button>
    </th>
  );
}

// PC: 와인 하나당 한 행, 열 머리를 눌러 정렬
export function GroupTable({ groups, onOpen, selectedKey, selectedRowId, sortBy, onSort }) {
  return (
    <div className="bg-slate-900 border border-slate-750 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead className="text-[11.5px] text-slate-400 border-b border-slate-750">
            <tr>
              <SortHeader label="와인" value="name" sortBy={sortBy} onSort={onSort} />
              <th className="px-3 py-2.5 font-medium">국가</th>
              <SortHeader label="위치" value="rack" sortBy={sortBy} onSort={onSort} />
              <SortHeader label="빈티지별 재고" value="vintage" sortBy={sortBy} onSort={onSort} />
              <SortHeader label="합계" value="qty" sortBy={sortBy} onSort={onSort} className="text-right" />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const selected = selectedKey === g.key;
              return (
                <tr
                  key={g.key}
                  onClick={() => onOpen(g, g.rows[0].id)}
                  className={`border-b border-slate-850 cursor-pointer transition ${
                    selected ? 'bg-wine/10 shadow-[inset_3px_0_0_#c0364f]' : 'hover:bg-slate-850/70'
                  }`}
                >
                  <td className="px-3 py-2 align-middle max-w-[320px]">
                    <div className="flex items-center gap-2.5">
                      {g.image && (
                        <img src={g.image} alt="" className="w-7 h-9 object-contain rounded bg-slate-950 border border-slate-750 shrink-0" loading="lazy" />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-100 truncate">{g.name}</div>
                        <div className="text-[12px] italic font-serif text-slate-400 truncate">{g.englishName || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Flag country={g.country} />
                      {g.country}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-[12.5px]">
                    <RackText group={g} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1 max-w-[340px]">
                      {g.rows.map((r) => (
                        <VintageChip
                          key={r.id}
                          row={r}
                          active={selected && selectedRowId === r.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(g, r.id);
                          }}
                        />
                      ))}
                    </div>
                  </td>
                  <td className={`px-3 py-2 text-right text-base font-bold tabular ${g.hasError ? 'text-red-400' : g.totalQty <= 0 ? 'text-red-300' : 'text-slate-100'}`}>
                    {g.totalQty}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
