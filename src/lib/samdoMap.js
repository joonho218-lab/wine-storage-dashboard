// 삼도빌딩 랙 맵용: 보관위치(rack)와 비고(note)에서 구역·층·박스·렉·열을 읽어요.
// 비고 형식 예: "26.11.27 현장 정리 · USA1 1층 박스 28·30, 2층 박스 316 · 사진 9584"
//               "26.11.27 현장 정리 · 중앙셀러 C렉 2열, C렉 3열 · 사진 9459"

export const SAMDO_UNSORTED = '미정리';

// '삼도빌딩 USA1' → 'USA1', '삼도빌딩' → '미정리'
export function samdoSection(rack) {
  const r = String(rack || '').trim();
  if (r === '삼도빌딩') return SAMDO_UNSORTED;
  const m = r.match(/^삼도빌딩\s+(.+)$/);
  return m ? m[1].trim() : SAMDO_UNSORTED;
}

// 비고에서 "구역 이름 뒤 ~ 다음 ' · ' 앞"까지를 위치 문구로 봐요
function placeText(note, section) {
  const n = String(note || '');
  const i = n.indexOf(`${section} `);
  if (i === -1) return '';
  const rest = n.slice(i + section.length + 1);
  const end = rest.indexOf(' · ');
  return (end === -1 ? rest : rest.slice(0, end)).trim();
}

// 층(1층=맨 위)과 박스. 괄호 숫자는 그 칸의 병 수예요.
// "1층 박스 28(12)·30(12)" → { level: 1, boxes: [{no:'28',qty:12},{no:'30',qty:12}], qty: 24, text: '박스 28(12)·30(12)' }
// "4층 박스(14)·낱개(3)"   → { level: 4, boxes: [], box: true, loose: true, qty: 17 }
export function parseShelfPlaces(note, section) {
  const text = placeText(note, section);
  if (!text) return [];
  const out = [];
  text.split(/,\s*/).forEach((seg) => {
    const m = seg.match(/^(\d+)층\s*(.*)$/);
    if (!m) return;
    const rest = m[2].trim();
    const bm = rest.match(/박스\s+([\d()·]+)/);
    const boxes = bm
      ? bm[1].split('·').map((t) => t.match(/^(\d+)(?:\((\d+)\))?$/)).filter(Boolean)
        .map((x) => ({ no: x[1], qty: x[2] ? Number(x[2]) : null }))
      : [];
    const counts = (rest.match(/\((\d+)\)/g) || []).map((x) => Number(x.slice(1, -1)));
    out.push({
      level: Number(m[1]),
      boxes,
      loose: rest.includes('낱개'),
      box: !bm && rest.includes('박스'),
      qty: counts.length ? counts.reduce((a, c) => a + c, 0) : null,
      text: rest,
    });
  });
  return out;
}

// 중앙셀러 렉·열: "C렉 2열 2병" → { rack: 'C', col: 2, qty: 2 } / 앞 바닥은 { floor: true }
export function parseCellarPlaces(note, section = '중앙셀러') {
  const text = placeText(note, section);
  if (!text) return [];
  const out = [];
  text.split(/,\s*/).forEach((seg) => {
    const m = seg.match(/^([A-Z])렉\s*(\d+)열(?:\s*(\d+)병)?/);
    if (m) out.push({ rack: m[1], col: Number(m[2]), qty: m[3] ? Number(m[3]) : null });
    else if (seg.includes('바닥')) out.push({ floor: true, qty: null });
  });
  return out;
}

// 칸마다 병 수를 더해요. 칸별 수를 모르는 와인은 그 묶음에서 한 번만 세요.
export function sumPlaced(entries) {
  const seen = new Set();
  let total = 0;
  entries.forEach(({ row, qty }) => {
    if (qty != null) total += qty;
    else if (!seen.has(row.id)) { seen.add(row.id); total += row.currentQty || 0; }
  });
  return total;
}

// 사진: registered = 대시보드에 사진 등록, taken = 현장 사진 번호만 비고에 있음, none = 없음
export function photoNumbers(note) {
  const n = String(note || '');
  const i = n.indexOf('사진');
  if (i === -1) return [];
  return Array.from(new Set((n.slice(i).match(/\b9\d{3}\b/g) || [])));
}

export function photoStatus(row) {
  if (row.customImage) return 'registered';
  return photoNumbers(row.note).length ? 'taken' : 'none';
}

export function needsLocationCheck(row) {
  return /위치 확인 필요/.test(String(row.note || ''));
}
