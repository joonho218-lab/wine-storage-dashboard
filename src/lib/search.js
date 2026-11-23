// 비슷한 표기도 찾아 주는 검색.
// 와인 이름은 외국어를 한글로 옮겨 적어서 사람마다 표기가 달라요 (샤또/샤토, 뮈지니/뮤지니, 샹베르땅/샹베르탱 …).
// 1) 글자를 자모로 풀고 된소리·비슷한 모음을 하나로 모아 비교하고
// 2) 그래도 안 맞으면 한두 글자 다른 것까지 찾아요.  Château / Chateau 처럼 악센트도 무시해요.

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// 외래어 표기에서 서로 바꿔 쓰는 소리를 하나로
const SAME = {
  'ㄲ': 'ㅋ', 'ㄸ': 'ㅌ', 'ㅃ': 'ㅍ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅊ',
  'ㅐ': 'ㅔ', 'ㅒ': 'ㅔ', 'ㅖ': 'ㅔ', 'ㅙ': 'ㅔ', 'ㅞ': 'ㅔ', 'ㅚ': 'ㅔ',
  'ㅟ': 'ㅜ', 'ㅠ': 'ㅜ', 'ㅝ': 'ㅜ', 'ㅢ': 'ㅣ', 'ㅛ': 'ㅗ', 'ㅕ': 'ㅓ',
};

// 같은 뜻으로 쓰는 말 (검색어와 와인명 양쪽에 똑같이 적용)
const PHRASES = [
  [/1\s*등급|프르미에\s*크[뤼루]|프리미에\s*크[뤼루]|premier\s*cru|1er\s*cru/gi, '1er'],
  [/그랑\s*크[뤼루]|grand\s*cru/gi, 'gc'],
  [/도메인|도멘|domaine/gi, '도멘'],
  [/샤[또토]|chateau/gi, '샤토'],
];

function stripAccents(s) {
  // NFD는 한글도 자모로 쪼개니까, 악센트만 지운 뒤 NFC로 다시 합쳐요
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

function toJamo(s) {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code < 11172) {
      const cho = CHO[Math.floor(code / 588)];
      const jung = JUNG[Math.floor((code % 588) / 28)];
      const jong = JONG[code % 28];
      out += (SAME[cho] || cho) + (SAME[jung] || jung) + (jong ? (SAME[jong] || jong) : '');
    } else {
      out += SAME[ch] || ch;
    }
  }
  return out;
}

// 비교용 문자열: 악센트·대소문자·띄어쓰기·기호를 지우고 자모로 풀어요
export function searchKey(text) {
  let s = stripAccents(String(text || '')).toLowerCase();
  PHRASES.forEach(([re, rep]) => { s = s.replace(re, rep); });
  s = s.replace(/[^0-9a-zㄱ-ㆎ가-힣]/g, '');
  return toJamo(s);
}

// needle이 hay 안에 최대 k글자 차이로 들어 있는지 (근사 부분 문자열 검색)
function approxIncludes(hay, needle, k) {
  const m = needle.length;
  if (!m) return true;
  let prev = new Array(m + 1);
  let cur = new Array(m + 1);
  for (let i = 0; i <= m; i++) prev[i] = i;
  if (prev[m] <= k) return true;
  for (let j = 1; j <= hay.length; j++) {
    cur[0] = 0;
    const c = hay[j - 1];
    for (let i = 1; i <= m; i++) {
      const cost = needle[i - 1] === c ? 0 : 1;
      cur[i] = Math.min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + cost);
    }
    if (cur[m] <= k) return true;
    [prev, cur] = [cur, prev];
  }
  return false;
}

// 검색어 길이에 따라 몇 글자(자모) 차이까지 봐줄지
function allowance(len) {
  if (len < 5) return 0;
  if (len < 9) return 1;
  if (len < 15) return 2;
  return 3;
}

// 검색어를 미리 준비 (띄어쓴 단어마다 따로 찾아요: "샤토 마고 2015")
export function prepareQuery(term) {
  const raw = String(term || '').trim();
  if (!raw) return null;
  const words = raw.split(/\s+/).map((w) => ({ raw: w.toLowerCase(), key: searchKey(w) })).filter((w) => w.key);
  // 붙여 쓴 전체 검색어도 하나의 단어처럼 시도 (예: "샤또마고" ↔ "샤또 마고")
  const whole = searchKey(raw);
  return { words, whole };
}

// fields: 와인명·영문명·빈티지·메모·위치 등 문자열 목록, keys: searchKey로 미리 만든 값 (없으면 만들어요)
export function matchesQuery(query, fields, keys) {
  if (!query) return true;
  const ks = keys || fields.map(searchKey);
  const all = ks.join('|');
  if (query.whole && all.includes(query.whole)) return true;
  return query.words.every((w) => {
    if (fields.some((f) => String(f || '').toLowerCase().includes(w.raw))) return true;
    if (ks.some((k) => k.includes(w.key))) return true;
    const k = allowance(w.key.length);
    return k > 0 && ks.some((f) => approxIncludes(f, w.key, k));
  });
}
