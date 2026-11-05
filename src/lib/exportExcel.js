// 보기 좋은 재고 엑셀 만들기 (ExcelJS 사용).
// 주의: '와인재고현황' 시트 이름과 머리글(원산지 · 와인명(한글) · 빈티지 · 보관위치 · 총 입고량 · 총 출고량 ·
// 현재고 · 상태 · 비고 · 이미지링크 · 영문명)과 순서는 '새 엑셀 올리기'가 그대로 읽을 수 있게 유지해야 해요.
import { rackOrder, rackLabel, WALL_RACKS, CENTER_RACKS } from './wine';
import { WINE_TYPES, wineType, wineTypeNote } from './wineType';

const EXCELJS_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';

const C = {
  wine: 'FF8F2338',
  wineSoft: 'FFF7E9EC',
  band: 'FFF8F5F3',
  line: 'FFE3DBDD',
  ink: 'FF1D1A1C',
  muted: 'FF6C6468',
  red: 'FFC0364F',
  green: 'FF1E7B4F',
  gold: 'FF9A6B12',
  white: 'FFFFFFFF',
};
const FONT = '맑은 고딕';

export function loadExcelJS() {
  if (typeof window !== 'undefined' && window.ExcelJS) return Promise.resolve(window.ExcelJS);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = EXCELJS_URL;
    s.async = true;
    s.onload = () => (window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error('ExcelJS not loaded')));
    s.onerror = () => reject(new Error('ExcelJS download failed'));
    document.head.appendChild(s);
  });
}

const pad = (n) => String(n).padStart(2, '0');
export function stamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function vintageValue(v) {
  const n = Number(v);
  return /^\d{4}$/.test(String(v).trim()) && Number.isFinite(n) ? n : String(v ?? '');
}

function thin(color = C.line) {
  return { style: 'thin', color: { argb: color } };
}

function titleBlock(ws, title, subtitle, lastCol) {
  ws.mergeCells(1, 1, 1, lastCol);
  ws.mergeCells(2, 1, 2, lastCol);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: FONT, size: 16, bold: true, color: { argb: C.wine } };
  t.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 30;
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { name: FONT, size: 10, color: { argb: C.muted } };
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 6;
}

function headerRow(ws, rowNo, headers) {
  const row = ws.getRow(rowNo);
  headers.forEach((h, i) => {
    const c = row.getCell(i + 1);
    c.value = h;
    c.font = { name: FONT, size: 10, bold: true, color: { argb: C.white } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.wine } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = { top: thin(C.wine), bottom: thin(C.wine), left: thin(C.wine), right: thin(C.wine) };
  });
  row.height = 24;
}

// ── 분류용 칸 (종합 요약 시트가 이 칸으로 계산해요) ──
export function zoneOf(rack) {
  if (WALL_RACKS.includes(rack)) return '외곽 벽면 랙';
  if (CENTER_RACKS.includes(rack)) return '중앙 통로 랙';
  return '특수 보관 (천장·박스)';
}
export const ZONES = ['외곽 벽면 랙', '중앙 통로 랙', '특수 보관 (천장·박스)'];

export function decadeOf(vintage) {
  const s = String(vintage ?? '').trim();
  if (!/^\d{4}$/.test(s)) return 'NV (논빈티지)';
  const y = Number(s);
  if (y < 1980) return '1960·70년대';
  return `${Math.floor(y / 10) * 10}년대`;
}

export function sizeOf(r) {
  const t = `${r.name || ''} ${r.englishName || ''} ${r.note || ''}`;
  if (/6L|임페리얼|Imperial/i.test(t)) return '6L';
  if (/3\.0L|3000ml|3L|더블매그넘|Jeroboam/i.test(t)) return '3L';
  if (/1\.8L|1800ml/i.test(t)) return '1.8L';
  if (/1\.5L|1500ml|매그넘|Magnum/i.test(t)) return '1.5L';
  return '750ml';
}
export const SIZES = ['750ml', '1.5L', '1.8L', '3L', '6L'];

function sortStock(stock) {
  return [...stock].sort((a, b) =>
    rackOrder(a.rack) - rackOrder(b.rack) ||
    String(a.rack).localeCompare(String(b.rack), 'ko') ||
    String(a.name).localeCompare(String(b.name), 'ko') ||
    String(b.vintage).localeCompare(String(a.vintage))
  );
}

export function buildWorkbook(ExcelJS, { stock, logs = [], who = '', now = new Date() }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = '서울석유 2층 와인창고';
  wb.created = now;
  wb.calcProperties.fullCalcOnLoad = true; // 요약 수식을 열 때 다시 계산

  const rows = sortStock(stock);
  const totalBottles = rows.reduce((s, r) => s + (Number(r.currentQty) || 0), 0);
  const when = stamp(now);

  // 첫 장: 종합 요약 (아래 재고현황을 다 쓴 뒤에 채워요)
  const summary = wb.addWorksheet('종합 요약', {
    views: [{ state: 'frozen', ySplit: 2, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });

  // ───────── 1. 와인재고현황 ─────────
  const ws = wb.addWorksheet('와인재고현황', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    headerFooter: { oddFooter: '&C&8&P / &N 쪽' },
  });
  // 앞 11칸은 '새 엑셀 올리기'용 그대로, 뒤 4칸(종류 · 구역 분류 · 연대 · 병 크기)은 요약 계산용이에요.
  const headers = ['원산지', '와인명(한글)', '빈티지', '보관위치', '총 입고량', '총 출고량', '현재고', '상태', '비고', '이미지링크', '영문명', '종류', '구역 분류', '연대', '병 크기'];
  const widths = [9, 40, 8, 15, 9, 9, 9, 9, 24, 11, 46, 15, 19, 13, 9];
  ws.columns = widths.map((w) => ({ width: w }));
  titleBlock(ws, '서울석유 2층 와인창고 재고현황', `기준 ${when}  ·  ${rows.length}개 항목  ·  총 ${totalBottles.toLocaleString()}병${who ? `  ·  내려받은 사람 ${who}` : ''}  ·  보관위치 순 정렬`, headers.length);
  headerRow(ws, 4, headers);
  ws.pageSetup.printTitlesRow = '4:4';

  let band = false;
  let prevRack = null;
  rows.forEach((r, i) => {
    if (r.rack !== prevRack) { band = !band; prevRack = r.rack; }
    const qty = Number(r.currentQty) || 0;
    const row = ws.getRow(5 + i);
    row.values = [
      r.country || '',
      r.name || '',
      vintageValue(r.vintage),
      r.rack || '',
      Number(r.inQty) || 0,
      Number(r.outQty) || 0,
      qty,
      qty <= 0 ? '재고없음' : '정상',
      r.note || '',
      r.customImage && String(r.customImage).startsWith('http') ? r.customImage : '',
      r.englishName || '',
      wineType(r),
      zoneOf(r.rack),
      decadeOf(r.vintage),
      sizeOf(r),
    ];
    row.height = 19;
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.font = { name: FONT, size: 10, color: { argb: qty <= 0 && col !== 7 ? C.muted : C.ink } };
      c.alignment = { vertical: 'middle', horizontal: [1, 3, 8].includes(col) ? 'center' : [5, 6, 7].includes(col) ? 'right' : 'left' };
      c.border = { bottom: thin() };
      if (band) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.band } };
    });
    row.getCell(2).font = { name: FONT, size: 10, bold: true, color: { argb: qty <= 0 ? C.muted : C.ink } };
    row.getCell(3).font = { name: FONT, size: 10, color: { argb: C.gold } };
    [5, 6, 7].forEach((col) => { row.getCell(col).numFmt = '#,##0'; });
    row.getCell(7).font = { name: FONT, size: 10, bold: true, color: { argb: qty < 0 ? C.red : qty === 0 ? C.muted : C.ink } };
    if (qty <= 0) row.getCell(8).font = { name: FONT, size: 10, color: { argb: C.red } };
    row.getCell(11).font = { name: FONT, size: 10, italic: true, color: { argb: C.muted } };
    [12, 13, 14, 15].forEach((col) => { row.getCell(col).font = { name: FONT, size: 10, color: { argb: C.muted } }; });
  });
  [12, 13, 14, 15].forEach((col) => { ws.getRow(4).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B4A52' } }; });

  const first = 5;
  const last = 4 + rows.length;
  const totalRow = ws.getRow(last + 1);
  totalRow.getCell(1).value = '합계';
  totalRow.getCell(4).value = `${rows.length}개 항목`;
  [5, 6, 7].forEach((col) => {
    const letter = String.fromCharCode(64 + col);
    const result = rows.reduce((s, r) => s + (Number(col === 5 ? r.inQty : col === 6 ? r.outQty : r.currentQty) || 0), 0);
    totalRow.getCell(col).value = rows.length ? { formula: `SUM(${letter}${first}:${letter}${last})`, result } : 0;
    totalRow.getCell(col).numFmt = '#,##0';
  });
  totalRow.height = 22;
  headers.forEach((_, idx) => {
    const col = idx + 1;
    const c = totalRow.getCell(col);
    c.font = { name: FONT, size: 10.5, bold: true, color: { argb: C.wine } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.wineSoft } };
    c.border = { top: { style: 'double', color: { argb: C.wine } }, bottom: thin(C.wine) };
    c.alignment = { vertical: 'middle', horizontal: col === 1 ? 'center' : [5, 6, 7].includes(col) ? 'right' : 'left' };
  });
  if (rows.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: last, column: headers.length } };

  buildSummary(summary, { rows, logs, when, now, first, last });

  // ───────── 2. 랙별 요약 ─────────
  const sum = wb.addWorksheet('랙별 요약', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
  sum.columns = [{ width: 13 }, { width: 18 }, { width: 11 }, { width: 11 }, { width: 11 }];
  const byRack = new Map();
  rows.forEach((r) => {
    const e = byRack.get(r.rack) || { items: 0, bottles: 0 };
    e.items += 1;
    e.bottles += Number(r.currentQty) || 0;
    byRack.set(r.rack, e);
  });
  const allRacks = Array.from(new Set([...WALL_RACKS, ...CENTER_RACKS, ...byRack.keys()]))
    .sort((a, b) => rackOrder(a) - rackOrder(b) || String(a).localeCompare(String(b), 'ko'));
  titleBlock(sum, '보관위치별 요약', `기준 ${when}  ·  총 ${totalBottles.toLocaleString()}병`, 5);
  headerRow(sum, 4, ['구역', '보관위치', '품목 수', '병 수', '비율']);
  allRacks.forEach((rack, i) => {
    const e = byRack.get(rack) || { items: 0, bottles: 0 };
    const zone = WALL_RACKS.includes(rack) ? '외곽 벽면' : CENTER_RACKS.includes(rack) ? '중앙 통로' : '특수 보관';
    const row = sum.getRow(5 + i);
    row.values = [zone, rackLabel(rack), e.items, e.bottles, totalBottles ? e.bottles / totalBottles : 0];
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.font = { name: FONT, size: 10, color: { argb: e.bottles ? C.ink : C.muted } };
      c.border = { bottom: thin() };
      c.alignment = { vertical: 'middle', horizontal: col <= 2 ? 'left' : 'right' };
    });
    row.getCell(3).numFmt = '#,##0';
    row.getCell(4).numFmt = '#,##0';
    row.getCell(4).font = { name: FONT, size: 10, bold: true, color: { argb: e.bottles ? C.ink : C.muted } };
    row.getCell(5).numFmt = '0.0%';
  });
  const sLast = 4 + allRacks.length;
  const sTotal = sum.getRow(sLast + 1);
  sTotal.values = ['합계', '', { formula: `SUM(C5:C${sLast})`, result: rows.length }, { formula: `SUM(D5:D${sLast})`, result: totalBottles }, 1];
  [1, 2, 3, 4, 5].forEach((col) => {
    const c = sTotal.getCell(col);
    c.font = { name: FONT, size: 10.5, bold: true, color: { argb: C.wine } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.wineSoft } };
    c.border = { top: { style: 'double', color: { argb: C.wine } }, bottom: thin(C.wine) };
    c.alignment = { horizontal: col <= 2 ? 'left' : 'right' };
  });
  sTotal.getCell(3).numFmt = '#,##0';
  sTotal.getCell(4).numFmt = '#,##0';
  sTotal.getCell(5).numFmt = '0.0%';
  if (allRacks.length) {
    sum.addConditionalFormatting({
      ref: `D5:D${sLast}`,
      rules: [{ type: 'dataBar', priority: 1, cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: 'FFE07A8E' }, gradient: false }],
    });
  }

  // ───────── 3. 입출고변경이력 ─────────
  const lg = wb.addWorksheet('입출고변경이력', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
  const lh = ['날짜/일시', '수정자', '구분', '원산지', '와인명', '빈티지', '보관위치', '수량', '변경 전 재고', '변경 후 재고', '사유'];
  lg.columns = [18, 11, 11, 9, 36, 8, 15, 8, 11, 11, 52].map((w) => ({ width: w }));
  titleBlock(lg, '입출고 · 변경 이력', `내려받을 때 화면에 불러온 기록 ${logs.length}건  ·  최신순`, lh.length);
  headerRow(lg, 4, lh);
  logs.forEach((l, i) => {
    const row = lg.getRow(5 + i);
    const type = String(l.changeType || '');
    row.values = [l.time || '', l.actorName || '', type.replace(/\s*\([+-]\)/, ''), l.country || '', l.name || '', vintageValue(l.vintage), l.rack || '', Math.abs(Number(l.delta) || 0), l.prevQty ?? '', l.newQty ?? '', l.reason || ''];
    row.height = 18;
    const color = type.includes('입고') || type.includes('등록') ? C.green : type.includes('출고') || type.includes('삭제') ? C.red : C.ink;
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.font = { name: FONT, size: 10, color: { argb: col === 3 ? color : C.ink }, bold: col === 3 };
      c.border = { bottom: thin() };
      c.alignment = { vertical: 'middle', horizontal: [3, 6, 8, 9, 10].includes(col) ? 'center' : 'left', wrapText: col === 11 };
      if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.band } };
    });
  });
  if (logs.length) lg.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + logs.length, column: lh.length } };

  return wb;
}

// ───────── 종합 요약 ─────────
function buildSummary(ws, { rows, logs, when, now, first, last }) {
  ws.columns = [{ width: 34 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }];
  const n = rows.length;
  const qty = (r) => Number(r.currentQty) || 0;
  const total = rows.reduce((s, r) => s + qty(r), 0);
  const rng = (col) => `'와인재고현황'!$${col}$${first}:$${col}$${last}`;
  // 수식 + 미리 계산한 값 (엑셀이 열 때 다시 계산해요). 행이 없으면 값만 넣어요.
  const f = (formula, result) => (n ? { formula, result } : result);
  const font = (size = 10, bold = false, color = C.ink) => ({ name: FONT, size, bold, color: { argb: color } });
  const fillOf = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

  ws.mergeCells(1, 1, 1, 6);
  ws.getCell(1, 1).value = '서울석유 2층 와인창고 · 종합 재고 요약';
  ws.getCell(1, 1).font = font(18, true, C.wine);
  ws.getRow(1).height = 34;
  ws.mergeCells(2, 1, 2, 6);
  ws.getCell(2, 1).value = `기준 ${when}  ·  숫자는 '와인재고현황' 시트에서 자동 계산돼요  ·  종류는 와인 이름으로 추정했어요`;
  ws.getCell(2, 1).font = font(9.5, false, C.muted);

  // KPI 타일
  const names = new Set(rows.map((r) => (r.englishName || r.name || '').trim()));
  const big = rows.filter((r) => sizeOf(r) !== '750ml').reduce((s, r) => s + qty(r), 0);
  const kpis = [
    ['총 보관', f(`SUM(${rng('G')})`, total), '병', C.wine],
    ['등록 항목', f(`COUNTA(${rng('B')})`, n), '와인×빈티지×위치', C.ink],
    ['와인 종류', names.size, '영문명 기준', C.ink],
    ['재고 있는 항목', f(`COUNTIF(${rng('G')},">0")`, rows.filter((r) => qty(r) > 0).length), '1병 이상', C.ink],
    ['품절 항목', f(`COUNTIF(${rng('G')},"<=0")`, rows.filter((r) => qty(r) <= 0).length), '재고 0병', C.red],
    ['대용량 병', f(`SUMIF(${rng('O')},"<>750ml",${rng('G')})`, big), '1.5L 이상', C.ink],
  ];
  kpis.forEach(([label, value, note, color], i) => {
    const col = i + 1;
    const a = ws.getCell(4, col); const b = ws.getCell(5, col); const c = ws.getCell(6, col);
    a.value = label; b.value = value; c.value = note;
    a.font = font(9.5, false, C.muted); b.font = font(20, true, color); c.font = font(8.5, false, C.muted);
    b.numFmt = '#,##0';
    [a, b, c].forEach((cell) => { cell.fill = fillOf(i === 0 ? C.wineSoft : C.band); cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }; });
    a.border = { top: { style: 'medium', color: { argb: i === 0 ? C.wine : C.line } } };
  });
  ws.getRow(5).height = 32;

  let r0 = 8;
  const sectionTitle = (row, title, note) => {
    ws.getCell(row, 1).value = title;
    ws.getCell(row, 1).font = font(12, true, C.wine);
    if (note) { ws.mergeCells(row, 2, row, 6); ws.getCell(row, 2).value = note; ws.getCell(row, 2).font = font(9, false, C.muted); }
    ws.getRow(row).height = 22;
  };
  const header = (row, labels) => labels.forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h; c.font = font(10, true, C.white); c.fill = fillOf(C.wine);
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // 구분별 표: 구분 | 항목 수 | 병 수 | 비중
  const breakdown = (title, note, col, labels, keyOf) => {
    sectionTitle(r0, title, note);
    header(r0 + 1, ['구분', '항목 수', '병 수', '비중']);
    const start = r0 + 2;
    labels.forEach((label, i) => {
      const row = start + i;
      const items = rows.filter((r) => keyOf(r) === label);
      const bottles = items.reduce((s, r) => s + qty(r), 0);
      const vals = [
        label,
        f(`COUNTIF(${rng(col)},A${row})`, items.length),
        f(`SUMIF(${rng(col)},A${row},${rng('G')})`, bottles),
        f(`IF($A$5=0,0,C${row}/$A$5)`, total ? bottles / total : 0),
      ];
      vals.forEach((v, j) => {
        const c = ws.getCell(row, j + 1);
        c.value = v; c.font = font(10, j === 2); c.border = { bottom: thin() };
        c.numFmt = j === 3 ? '0.0%' : '#,##0';
        if (i % 2) c.fill = fillOf(C.band);
      });
    });
    const end = start + labels.length - 1;
    const tr = end + 1;
    const totalVals = ['합계', { formula: `SUM(B${start}:B${end})`, result: n }, { formula: `SUM(C${start}:C${end})`, result: total }, { formula: `SUM(D${start}:D${end})`, result: total ? 1 : 0 }];
    totalVals.forEach((v, j) => {
      const c = ws.getCell(tr, j + 1);
      c.value = v; c.font = font(10.5, true, C.wine); c.fill = fillOf(C.wineSoft);
      c.border = { top: { style: 'double', color: { argb: C.wine } }, bottom: thin(C.wine) };
      c.numFmt = j === 3 ? '0.0%' : '#,##0';
    });
    ws.addConditionalFormatting({
      ref: `C${start}:C${end}`,
      rules: [{ type: 'dataBar', priority: 1, cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: 'FFE07A8E' }, gradient: false }],
    });
    r0 = tr + 3;
  };

  const countries = Array.from(new Set(rows.map((r) => r.country || '기타')))
    .map((c) => [c, rows.filter((r) => (r.country || '기타') === c).reduce((s, r) => s + qty(r), 0)])
    .sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const decades = Array.from(new Set(rows.map((r) => decadeOf(r.vintage)))).sort((a, b) => (a.startsWith('NV') ? 1 : b.startsWith('NV') ? -1 : a.localeCompare(b)));
  const keyOf = (r) => (r.englishName || r.name || '').trim();
  const unsure = new Set(rows.filter((r) => wineTypeNote(r)).map(keyOf)).size;

  breakdown('와인 종류별', unsure ? `와인 이름으로 분류 · 애매한 ${unsure}종은 맨 아래 메모 참고` : '와인 이름으로 분류', 'L', WINE_TYPES, wineType);
  breakdown('원산지별', '', 'A', countries, (r) => r.country || '기타');
  breakdown('보관 구역별', '', 'M', ZONES, (r) => zoneOf(r.rack));
  breakdown('빈티지 연대별', '', 'N', decades, (r) => decadeOf(r.vintage));
  breakdown('병 크기별', '', 'O', SIZES, sizeOf);

  // 재고 많은 와인 TOP 10 (빈티지 · 위치를 합친 병 수)
  const groups = new Map();
  rows.forEach((r) => {
    const key = (r.englishName || r.name || '').trim();
    const g = groups.get(key) || { name: r.name, country: r.country, type: wineType(r), bottles: 0, items: 0 };
    if (String(r.name).length < String(g.name).length) g.name = r.name;
    g.bottles += qty(r); g.items += 1;
    groups.set(key, g);
  });
  const top = [...groups.values()].sort((a, b) => b.bottles - a.bottles).slice(0, 10);
  sectionTitle(r0, '재고 많은 와인 TOP 10', '빈티지 · 위치를 합친 병 수');
  header(r0 + 1, ['와인', '원산지', '종류', '병 수', '항목 수']);
  top.forEach((g, i) => {
    const row = r0 + 2 + i;
    [`${i + 1}. ${g.name}`, g.country, g.type, g.bottles, g.items].forEach((v, j) => {
      const c = ws.getCell(row, j + 1);
      c.value = v; c.font = font(10, j === 3); c.border = { bottom: thin() }; c.numFmt = '#,##0';
      if (i % 2) c.fill = fillOf(C.band);
    });
  });
  r0 += top.length + 5;

  // 최근 30일 입출고 (화면에 불러온 이력 기준)
  const since = now.getTime() - 30 * 24 * 3600 * 1000;
  const recent = logs.filter((l) => { const t = new Date(String(l.time || '').replace(' ', 'T')).getTime(); return Number.isFinite(t) && t >= since; });
  const sumType = (word) => recent.filter((l) => String(l.changeType || '').includes(word)).reduce((s, l) => s + Math.abs(Number(l.delta) || 0), 0);
  const cntType = (word) => recent.filter((l) => String(l.changeType || '').includes(word)).length;
  sectionTitle(r0, '최근 30일 입출고', `불러온 이력 ${logs.length}건 기준`);
  [
    ['입고 병 수', sumType('입고')],
    ['출고 병 수', sumType('출고')],
    ['신규 등록 (항목)', cntType('신규')],
    ['신규 등록 (병 수)', sumType('신규')],
    ['전체 변경 기록', recent.length],
  ].forEach(([label, v], i) => {
    const row = r0 + 1 + i;
    ws.getCell(row, 1).value = label; ws.getCell(row, 2).value = v;
    ws.getCell(row, 1).font = font(10); ws.getCell(row, 2).font = font(10, true); ws.getCell(row, 2).numFmt = '#,##0';
    ws.getCell(row, 1).border = { bottom: thin() }; ws.getCell(row, 2).border = { bottom: thin() };
  });
  r0 += 9;

  // 품절 항목
  const outs = rows.filter((r) => qty(r) <= 0);
  sectionTitle(r0, `품절 항목 (${outs.length}건)`, '다시 들여올지 확인용');
  if (outs.length) {
    header(r0 + 1, ['와인', '빈티지', '보관위치', '총 출고']);
    outs.forEach((r, i) => {
      const row = r0 + 2 + i;
      [r.name, vintageValue(r.vintage), rackLabel(r.rack), Number(r.outQty) || 0].forEach((v, j) => {
        const c = ws.getCell(row, j + 1);
        c.value = v; c.font = font(10, false, j ? C.muted : C.ink); c.border = { bottom: thin() };
      });
    });
    r0 += outs.length + 5;
  } else {
    ws.getCell(r0 + 1, 1).value = '품절된 항목이 없어요';
    ws.getCell(r0 + 1, 1).font = font(10, false, C.muted);
    r0 += 4;
  }

  // 종류 확인 메모
  const notes = new Map();
  rows.forEach((r) => {
    const note = wineTypeNote(r);
    if (!note) return;
    const e = notes.get(keyOf(r)) || { name: r.name, type: wineType(r), note, bottles: 0 };
    if (String(r.name).length < String(e.name).length) e.name = r.name;
    e.bottles += qty(r);
    notes.set(keyOf(r), e);
  });
  if (notes.size) {
    sectionTitle(r0, '종류 확인 필요', "실제와 다르면 '와인재고현황' 시트 L열(종류)을 고치면 요약이 다시 계산돼요");
    header(r0 + 1, ['와인', '분류한 종류', '병 수', '메모']);
    ws.mergeCells(r0 + 1, 4, r0 + 1, 6);
    [...notes.values()].forEach((e, i) => {
      const row = r0 + 2 + i;
      [e.name, e.type, e.bottles, e.note].forEach((v, j) => {
        const c = ws.getCell(row, j + 1);
        c.value = v; c.font = font(10, false, j === 3 ? 'FFB45309' : C.ink); c.border = { bottom: thin() }; c.numFmt = '#,##0';
      });
      ws.mergeCells(row, 4, row, 6);
    });
  }
}

export async function downloadStyledExcel({ stock, logs, who }) {
  const ExcelJS = await loadExcelJS();
  const now = new Date();
  const wb = buildWorkbook(ExcelJS, { stock, logs, who, now });
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `서울석유_와인창고_재고현황_${stamp(now).slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
