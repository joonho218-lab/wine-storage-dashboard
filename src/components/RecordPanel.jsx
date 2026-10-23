import { useEffect, useMemo, useState } from 'react';
import { X, Minus, Plus, Edit3, ExternalLink, Camera, MapPin, ZoomIn, AlertTriangle } from 'lucide-react';
import { BottleIcon } from './icons';
import { OUT_PURPOSES, IN_PURPOSES, rackLabel, vivinoSearchUrl } from '../lib/wine';

// 와인을 고른 뒤 입고/출고를 기록하는 패널.
// 모바일에서는 아래에서 올라오는 시트, PC에서는 오른쪽 패널로 쓰입니다.
export default function RecordPanel({
  group,
  selectedRowId,
  onSelectRow,
  historyLogs,
  onRecord,
  onClose,
  onEditRack,
  onEditVintage,
  onEditNote,
  onEditEnglish,
  onEditImage,
  onZoom,
}) {
  const row = group.rows.find((r) => r.id === selectedRowId) || group.rows[0];
  const [type, setType] = useState('out');
  const [qty, setQty] = useState(1);
  const [purpose, setPurpose] = useState('');
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState('');

  useEffect(() => {
    setQty(1);
    setDoneMsg('');
  }, [row?.id, type]);

  useEffect(() => {
    setPurpose('');
  }, [type]);

  const showRackOnVintage = useMemo(() => {
    const seen = new Set();
    return group.rows.some((r) => {
      if (seen.has(r.vintage)) return true;
      seen.add(r.vintage);
      return false;
    }) || group.racks.length > 1;
  }, [group]);

  const recentLogs = useMemo(() => {
    const ids = new Set(group.rows.map((r) => r.id));
    return historyLogs.filter((l) => ids.has(l.wineId)).slice(0, 5);
  }, [group, historyLogs]);

  if (!row) return null;

  const current = row.currentQty || 0;
  const maxOut = Math.max(0, current);
  const after = type === 'out' ? current - qty : current + qty;
  const outBlocked = type === 'out' && qty > maxOut;
  const purposes = type === 'out' ? OUT_PURPOSES : IN_PURPOSES;
  const typeLabel = type === 'out' ? '출고' : '입고';

  const submit = async () => {
    if (saving || qty < 1 || outBlocked) return;
    setSaving(true);
    const ok = await onRecord(row, type, qty, purpose, detail.trim());
    setSaving(false);
    if (ok) {
      setDoneMsg(`${row.vintage} ${typeLabel} ${qty}병을 기록했어요`);
      setQty(1);
      setDetail('');
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 lg:px-5 pt-3 pb-2 text-xs text-slate-400 shrink-0">
        <span>선택한 와인 · 입출고 기록</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="w-8 h-8 rounded-lg border border-slate-700 grid place-items-center text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 lg:px-5 pb-5">
        {/* 와인 정보 */}
        <div className="flex gap-3.5">
          {row.customImage || group.image ? (
            <button
              type="button"
              onClick={() => onZoom({ ...row, customImage: row.customImage || group.image })}
              className="relative w-[68px] h-[88px] shrink-0 rounded-xl bg-slate-950 border border-slate-750 overflow-hidden group/img"
              aria-label="사진 크게 보기"
            >
              <img src={row.customImage || group.image} alt={group.name} className="w-full h-full object-contain p-1" />
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 grid place-items-center text-white">
                <ZoomIn className="w-4 h-4" />
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onEditImage(row)}
              className="w-[68px] h-[88px] shrink-0 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-750 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-300"
              aria-label="사진 등록"
            >
              <BottleIcon className="w-5 h-11" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-slate-100 leading-snug tracking-tight">{group.name}</h3>
            <button
              type="button"
              onClick={() => onEditEnglish(row)}
              className="block text-left text-[13px] italic font-serif text-slate-400 hover:text-wine-light leading-snug mt-0.5"
            >
              {group.englishName || '+ 영문명 입력'}
            </button>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-xs text-slate-400">
              <span>{row.country}</span>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => onEditRack(row)}
                className="inline-flex items-center gap-1 text-wine-light hover:underline"
              >
                <MapPin className="w-3 h-3" />
                {rackLabel(row.rack)}
              </button>
              <span className="text-slate-600">·</span>
              <button type="button" onClick={() => onEditNote(row)} className="hover:text-slate-200 underline underline-offset-2">
                {row.note ? `메모: ${row.note}` : '메모 추가'}
              </button>
            </div>
          </div>
        </div>

        {/* 빈티지 선택 */}
        <div className="flex items-center justify-between mt-5 mb-2 text-xs text-slate-400">
          <span>빈티지</span>
          <span className="tabular">총 {group.totalQty}병</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {group.rows.map((r) => {
            const active = r.id === row.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelectRow(r.id)}
                aria-pressed={active}
                className={`min-h-[44px] px-2 py-1.5 rounded-xl border text-[13.5px] tabular flex flex-col items-center justify-center leading-tight transition ${
                  active ? 'border-gold bg-gold/10 text-slate-100' : 'border-slate-750 bg-slate-900 text-slate-300 hover:border-slate-600'
                }`}
              >
                <span>
                  <b className="text-gold font-semibold">{r.vintage}</b>{' '}
                  <span className={r.currentQty < 0 ? 'text-red-400 font-semibold' : ''}>{r.currentQty}병</span>
                </span>
                {showRackOnVintage && <span className="text-[10.5px] text-slate-500">{rackLabel(r.rack)}</span>}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onEditVintage(row)}
          className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-slate-500 hover:text-slate-300"
        >
          <Edit3 className="w-3 h-3" /> {row.vintage} 빈티지 표기 수정
        </button>

        {row.currentQty < 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-xs text-red-200">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>
              현재고가 {row.currentQty}병으로 기록돼 있어요. 실제 병 수를 세어 <b>입고</b>로 맞춰 주세요.
            </span>
          </div>
        )}

        {/* 구분 */}
        <div className="mt-4 mb-2 text-xs text-slate-400">구분</div>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="입고 또는 출고">
          {[
            ['in', '입고 +'],
            ['out', '출고 −'],
          ].map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={type === v}
              onClick={() => setType(v)}
              className={`h-11 rounded-xl border text-sm transition ${
                type === v
                  ? v === 'out'
                    ? 'border-wine bg-wine/15 text-rose-100 font-semibold'
                    : 'border-emerald-500/70 bg-emerald-500/10 text-emerald-100 font-semibold'
                  : 'border-slate-750 bg-slate-900 text-slate-300 hover:border-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 수량 */}
        <div className="mt-4 mb-2 text-xs text-slate-400">수량</div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-750 bg-slate-900 p-2">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="한 병 줄이기"
            className="w-11 h-11 rounded-xl bg-slate-850 border border-slate-700 grid place-items-center text-slate-100 disabled:opacity-40"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              aria-label="수량"
              className="w-16 bg-transparent text-center text-2xl font-bold tabular text-slate-100 focus:outline-none"
            />
            <div className={`text-[11.5px] tabular -mt-0.5 ${outBlocked ? 'text-red-300' : 'text-slate-400'}`}>
              {outBlocked
                ? `현재 ${current}병이라 ${qty}병은 출고할 수 없어요`
                : <>기록 후 {row.vintage} 재고 {current}병 → <b className="text-slate-100">{after}병</b></>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            aria-label="한 병 늘리기"
            className="w-11 h-11 rounded-xl bg-slate-850 border border-slate-700 grid place-items-center text-slate-100"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* 사용처 */}
        <div className="flex items-center justify-between mt-4 mb-2 text-xs text-slate-400">
          <span>{type === 'out' ? '사용처 / 인수자' : '입고 사유'}</span>
          <span className="text-[11px] text-slate-500">이력에 함께 저장돼요</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {purposes.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPurpose(purpose === p ? '' : p)}
              aria-pressed={purpose === p}
              className={`h-8 px-3 rounded-full border text-[12.5px] transition ${
                purpose === p ? 'border-wine/60 bg-wine/15 text-rose-100' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder={type === 'out' ? '예: 태남석유 대표 선물, 김부장 인수' : '예: 나라셀러 구매분'}
          className="mt-2 w-full h-11 px-3.5 rounded-xl bg-slate-900 border border-slate-750 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-wine"
        />

        <button
          type="button"
          onClick={submit}
          disabled={saving || outBlocked}
          className={`mt-4 w-full h-12 rounded-2xl text-[15px] font-bold text-white transition disabled:opacity-50 ${
            type === 'out' ? 'bg-wine hover:bg-rose-600 shadow-lg shadow-wine/30' : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/40'
          }`}
        >
          {saving ? '기록 중…' : `${typeLabel} ${qty}병 기록하기`}
        </button>
        {doneMsg && (
          <p className="mt-2 text-center text-xs text-emerald-300" role="status">
            {doneMsg}
          </p>
        )}

        {/* 최근 기록 */}
        <div className="mt-5 pt-3 border-t border-slate-750">
          <div className="text-xs text-slate-400 mb-1.5">이 와인 최근 기록</div>
          {recentLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-1">불러온 이력에는 기록이 없어요. 전체 이력에서 이전 기록을 확인해 주세요.</p>
          ) : (
            <ul className="space-y-1">
              {recentLogs.map((l) => {
                const isIn = String(l.changeType).includes('입고') || String(l.changeType).includes('등록');
                const isOut = String(l.changeType).includes('출고');
                return (
                  <li key={l.logId} className="flex items-center gap-2 text-[12.5px] text-slate-300 py-0.5">
                    <span className="text-slate-500 tabular w-10 shrink-0">{String(l.time || '').slice(5, 10).replace('-', '.')}</span>
                    <span
                      className={`text-[10.5px] px-1.5 rounded-md shrink-0 ${
                        isIn ? 'bg-emerald-500/15 text-emerald-300' : isOut ? 'bg-wine/15 text-rose-300' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {String(l.changeType).replace(/\s*\([+-]\)/, '')}
                    </span>
                    <span className="tabular shrink-0">
                      {l.vintage}
                      {l.delta ? ` · ${Math.abs(l.delta)}병` : ''}
                    </span>
                    <span className="ml-auto text-slate-500 truncate">{l.actorName} · {l.reason}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            type="button"
            onClick={() => onEditImage(row)}
            className="h-9 rounded-full border border-slate-700 text-[12.5px] text-slate-300 hover:border-slate-500 inline-flex items-center justify-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5" /> 사진 {row.customImage ? '변경' : '추가'}
          </button>
          <a
            href={vivinoSearchUrl(row)}
            target="_blank"
            rel="noreferrer"
            className="h-9 rounded-full border border-slate-700 text-[12.5px] text-slate-300 hover:border-slate-500 inline-flex items-center justify-center gap-1.5"
          >
            Vivino 평점 <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
