// 랙 / 와인 그룹 관련 공용 함수

export const WALL_RACKS = Array.from({ length: 27 }, (_, i) => `${i + 1}번랙`);
export const CENTER_RACKS = Array.from({ length: 6 }, (_, i) => `중앙랙(${i + 1}번줄)`);
export const CENTER_GROUP = '중앙통로';

export const COUNTRY_FLAG = {
  '프랑스': 'fr',
  '미국': 'us',
  '이탈리아': 'it',
  '스페인': 'es',
  '호주': 'au',
  '칠레': 'cl',
  '포르투갈': 'pt',
};

// 출고·입고 사용처 빠른 선택
export const OUT_PURPOSES = ['접대', '선물', '행사', '시음', '기타'];
export const IN_PURPOSES = ['구매', '선물 받음', '반납', '재고 조정'];

export function rackOrder(rack) {
  if (!rack) return 9999;
  const wall = rack.match(/^(\d+)번랙$/);
  if (wall) return Number(wall[1]);
  const center = rack.match(/^중앙랙\((\d)번줄\)$/);
  if (center) return 100 + Number(center[1]);
  if (rack === '중앙랙') return 107;
  return 200;
}

export function rackLabel(rack) {
  if (!rack) return '미지정';
  const center = rack.match(/^중앙랙\((\d)번줄\)$/);
  if (center) return `중앙 ${center[1]}번줄`;
  return rack;
}

export function rackMatches(rack, selected) {
  if (selected === '전체') return true;
  if (selected === CENTER_GROUP) return CENTER_RACKS.includes(rack);
  return rack === selected;
}

export function vintageNumber(v) {
  const n = parseInt(String(v || ''), 10);
  return Number.isFinite(n) ? n : null;
}

// 빈티지 내림차순 (NV는 맨 앞)
export function compareVintageDesc(a, b) {
  const na = vintageNumber(a);
  const nb = vintageNumber(b);
  if (na === null && nb === null) return 0;
  if (na === null) return -1;
  if (nb === null) return 1;
  return nb - na;
}

export function groupKeyOf(item) {
  return String(item.englishName || item.name || '').trim().toLowerCase();
}

// 같은 와인(영문명 기준)을 한 그룹으로 묶음
export function buildGroups(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = groupKeyOf(row);
    if (!map.has(key)) {
      map.set(key, { key, rows: [] });
    }
    map.get(key).rows.push(row);
  });

  return Array.from(map.values()).map((g) => {
    const rowsSorted = [...g.rows].sort(
      (a, b) => compareVintageDesc(a.vintage, b.vintage) || rackOrder(a.rack) - rackOrder(b.rack)
    );
    const rackQty = new Map();
    rowsSorted.forEach((r) => rackQty.set(r.rack, (rackQty.get(r.rack) || 0) + (r.currentQty || 0)));
    const racks = Array.from(rackQty.entries())
      .map(([rack, qty]) => ({ rack, qty }))
      .sort((a, b) => b.qty - a.qty || rackOrder(a.rack) - rackOrder(b.rack));

    // 가장 짧은 한글명을 대표 이름으로 (예: "씨네퀴넌" vs "씨네퀴넌 750ml")
    const names = Array.from(new Set(rowsSorted.map((r) => r.name))).sort((a, b) => a.length - b.length);
    const vintages = rowsSorted.map((r) => vintageNumber(r.vintage)).filter((v) => v !== null);

    return {
      key: g.key,
      name: names[0] || '',
      englishName: rowsSorted.find((r) => r.englishName)?.englishName || '',
      country: rowsSorted[0]?.country || '',
      rows: rowsSorted,
      totalQty: rowsSorted.reduce((s, r) => s + (r.currentQty || 0), 0),
      racks,
      primaryRack: racks[0]?.rack || '',
      hasError: rowsSorted.some((r) => r.currentQty < 0),
      allOut: rowsSorted.every((r) => r.currentQty <= 0),
      image: rowsSorted.find((r) => r.customImage)?.customImage || null,
      oldestVintage: vintages.length ? Math.min(...vintages) : 9999,
    };
  });
}

export function sortGroups(groups, sortBy) {
  const list = [...groups];
  const byName = (a, b) => a.name.localeCompare(b.name, 'ko');
  if (sortBy === 'name') return list.sort(byName);
  if (sortBy === 'qty') return list.sort((a, b) => b.totalQty - a.totalQty || byName(a, b));
  if (sortBy === 'vintage') return list.sort((a, b) => a.oldestVintage - b.oldestVintage || byName(a, b));
  return list.sort((a, b) => rackOrder(a.primaryRack) - rackOrder(b.primaryRack) || a.primaryRack.localeCompare(b.primaryRack, 'ko') || byName(a, b));
}

// 히트맵 색 (적음 → 많음)
const HEAT_STOPS = [
  [44, 36, 42],
  [78, 32, 46],
  [150, 42, 66],
  [236, 96, 122],
];

export function heatColor(count, min, max) {
  if (!count || count <= 0) return null;
  const t = max > min ? Math.max(0.04, (count - min) / (max - min)) : 0.5;
  const s = Math.min(1, t) * (HEAT_STOPS.length - 1);
  const i = Math.min(Math.floor(s), HEAT_STOPS.length - 2);
  const f = s - i;
  const rgb = HEAT_STOPS[i].map((v, k) => Math.round(v + (HEAT_STOPS[i + 1][k] - v) * f));
  return `rgb(${rgb.join(',')})`;
}

export function nowString() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}

export function vivinoSearchUrl(item) {
  const name = item.englishName || item.name;
  const vintage = item.vintage && item.vintage !== 'NV' ? item.vintage : '';
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} ${vintage} vivino`.trim())}`;
}
