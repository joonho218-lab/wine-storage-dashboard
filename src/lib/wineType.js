// 와인 종류(레드 · 화이트 · 스파클링 …)를 이름으로 추정해요.
// 데이터에 종류 칸이 없어서 영문명 · 한글명 · 비고에 들어간 단어로 나눠요.
// 새 와인이 잘못 분류되면 아래 규칙에 단어를 하나 추가하면 돼요.

export const WINE_TYPES = ['레드', '화이트', '스파클링', '로제', '디저트·주정강화', '기타 (증류주·세트)'];

const RULES = [
  // 순서가 중요해요: 위에서 먼저 맞는 규칙을 따라요.
  ['레드', /Cheval Blanc|슈발 블랑/i], // 이름에 Blanc이 있지만 레드
  ['기타 (증류주·세트)', /Eau-de-Vie|Fine Bourgogne|Cognac|Armagnac|Grappa|브랜디|코냑|그라파|Wooden Box|나무 박스/i],
  ['디저트·주정강화', /\bPort\b|포트|Yquem|디켐|Sauternes|소테른|Tokaji|토카이|Ice ?wine|아이스 ?와인|Vin Santo|Madeira|마데이라|Sherry|셰리/i],
  ['스파클링', /Champagne|샴페인|\bBrut\b|브뤼|Cava|Prosecco|Franciacorta|Cr[ée]mant|Spumante|Sekt|Blanc de Blancs|Dom P[ée]rignon|돔페리뇽|Krug|크룩|Cristal|크리스탈|Bollinger|볼랭저|Selosse|셀로스|Perrier-Jou|페리에 주에|Henriot|Jacquesson|Laurent-Perrier|로랑페리에|Salon|Armand de Brignac|브리냑/i],
  ['로제', /Ros[ée]\b|로제/i],
  ['화이트', /Blanc\b|블랑|Bianco|비앙코|Chardonnay|샤도네|샤르도네|Sauvignon Blanc|소비뇽 블랑|Riesling|리슬링|Aligot|알리고|Montrachet|몽라쉐|몽라셰|Meursault|메르소|Charlemagne|샤를마뉴|Chablis|샤블리|Roussanne|루싼|Viognier|Condrieu|Gew[üu]rz|Pinot Gri|Grigio|Albari|Gorgona|고르고나|Rully|륄리|Clous Aim|끌루 에메|Pouilly|Sancerre|Gaia & Rey|가이아|Marguerite|마르게릿/i],
];

// 이름만으로는 확실하지 않은 와인 (요약 시트에 메모로 보여줘요)
const UNSURE = [
  [/Sine Qua Non|씨네퀴넌/i, '화이트·로제도 만드는 와이너리'],
  [/Masures|마쥐르/i, '같은 이름의 레드도 있어요'],
  [/Saint-Jacques|쌩 자크/i, '같은 이름의 레드도 있어요'],
  [/Marguerite|마르게릿/i, '쥐라 와인 · 이름만으로 확실치 않아요'],
  [/Jade Palace|제이드 팰리스/i, '처음 보는 라벨이라 추정'],
];

const text = (r) => `${r.englishName || ''} ${r.name || ''} ${r.note || ''}`;

export function wineType(r) {
  const t = text(r);
  for (const [type, re] of RULES) if (re.test(t)) return type;
  return '레드';
}

export function wineTypeNote(r) {
  const t = text(r);
  const hit = UNSURE.find(([re]) => re.test(t));
  return hit ? hit[1] : '';
}
