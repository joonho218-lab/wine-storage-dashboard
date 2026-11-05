// 보기 좋은 재고 엑셀 만들기 (ExcelJS 사용).
// 주의: '와인재고현황' 시트 이름과 머리글(원산지 · 와인명(한글) · 빈티지 · 보관위치 · 총 입고량 · 총 출고량 ·
// 현재고 · 상태 · 비고 · 이미지링크 · 영문명)과 순서는 '새 엑셀 올리기'가 그대로 읽을 수 있게 유지해야 해요.
import { rackOrder, rackLabel, WALL_RACKS, CENTER_RACKS } from './wine';

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

  const rows = sortStock(stock);
  const totalBottles = rows.reduce((s, r) => s + (Number(r.currentQty) || 0), 0);
  const when = stamp(now);

  // ───────── 1. 와인재고현황 ─────────
  const ws = wb.addWorksheet('와인재고현황', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    headerFooter: { oddFooter: '&C&8&P / &N 쪽' },
  });
  const headers = ['원산지', '와인명(한글)', '빈티지', '보관위치', '총 입고량', '총 출고량', '현재고', '상태', '비고', '이미지링크', '영문명'];
  const widths = [9, 40, 8, 15, 9, 9, 9, 9, 24, 11, 46];
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
  });

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
