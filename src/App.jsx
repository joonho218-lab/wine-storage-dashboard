import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { 
  Wine, Search, Layers, AlertTriangle, Upload, Download,
  ExternalLink, LayoutGrid, Table, Plus, Minus, 
  Grid3X3, History, RotateCcw, X, Camera, RefreshCw,
  ChevronDown, ChevronUp, PlusCircle, Image as ImageIcon, Trash2,
  ZoomIn, Edit3, MapPin, AlertCircle, Check
} from 'lucide-react';

const COUNTRY_INFO = {
  '프랑스': { flag: '🇫🇷', label: 'France' },
  '미국': { flag: '🇺🇸', label: 'USA' },
  '이탈리아': { flag: '🇮🇹', label: 'Italy' },
  '스페인': { flag: '🇪🇸', label: 'Spain' },
  '호주': { flag: '🇦🇺', label: 'Australia' },
  '칠레': { flag: '🇨🇱', label: 'Chile' },
  '포르투갈': { flag: '🇵🇹', label: 'Portugal' },
};

const COMMON_RACKS = [
  ...Array.from({ length: 27 }, (_, i) => `${i + 1}번랙`),
  '중앙랙(1번줄)', '중앙랙(2번줄)', '중앙랙(3번줄)', '중앙랙(4번줄)', '중앙랙(5번줄)', '중앙랙(6번줄)',
  '1번랙(천장)', '4,7번랙(천장)', '샴페인박스(1)', '샴페인박스(2)', '나라셀러박스', '삼도빌딩박스', '직접입력'
];

// 제공해주신 엑셀 전 품목 1:1 정밀 영문 데이터베이스 사전
const MASTER_WINE_DICTIONARY = {
  // 미국
  '로버트 몬다비,까베르네 소비뇽 리저브': 'Robert Mondavi Winery Cabernet Sauvignon Reserve',
  '로버트 몬다비 까베르네 소비뇽': 'Robert Mondavi Winery Cabernet Sauvignon',
  '로버트 몬다비 리저브': 'Robert Mondavi Winery Cabernet Sauvignon Reserve',
  '로버트 몬다비,까베르네 소비뇽 리저브(50주년 에디션)': 'Robert Mondavi Cabernet Sauvignon Reserve 50th Anniversary',
  '로버트 몬다비,까베르네 소비뇽 버티칼 세트': 'Robert Mondavi Cabernet Sauvignon Reserve Vertical Collection',
  '더 마스코트': 'The Mascot (Harlan Family)',
  '씨네퀴넌': 'Sine Qua Non',
  '씨네퀴넌 750ml': 'Sine Qua Non',
  '제이드 팰리스 골프클럽': 'Jade Palace Golf Club Private Reserve',
  '피터 마이클, 레 파보': 'Peter Michael Winery Les Pavots',
  'Grgich Hills Yountville Old Vine C/S': 'Grgich Hills Estate Yountville Old Vine Cabernet Sauvignon',
  '오퍼스원': 'Opus One',
  '오퍼스 원': 'Opus One',
  '도미누스': 'Dominus Estate (Christian Moueix)',
  '문차이 코 레오니스': 'Moontsai Cor Leonis Cabernet Sauvignon',
  '오소메': "O'Shaughnessy Estate Winery Cabernet Sauvignon",
  '케이머스': 'Caymus Vineyards Cabernet Sauvignon',
  '케이머스 S.셀렉션': 'Caymus Vineyards Special Selection Cabernet Sauvignon',
  '케이머스 S.셀렉션 (매그넘)': 'Caymus Vineyards Special Selection Cabernet Sauvignon 1.5L',
  '더저지': 'Kongsgaard The Judge Chardonnay',
  '꽁스가르드 샤도네이': 'Kongsgaard Chardonnay Napa Valley',
  'My hands': 'Two Hands My Hands Shiraz',
  '볼드멀버리': 'Bald Mountain Cabernet Sauvignon',
  '할란에스테이트': 'Harlan Estate',
  '조셉 펠프스 빈야드': 'Joseph Phelps Vineyards Insignia / Cabernet Sauvignon',
  '나파벨리 까베르네 쇼비뇽 리져브': 'Napa Valley Cabernet Sauvignon Reserve',
  '아나코타 몬타나 까베르네 쇼비뇽': 'Anakota Helena Montana Vineyard Cabernet Sauvignon',
  '하이츠 마르따스 빈야드 카버네 소비뇽': "Heitz Cellar Martha's Vineyard Cabernet Sauvignon",
  '레비아탄(매그넘)': 'Leviathan Red Blend 1.5L',
  '스크리밍 이글': 'Screaming Eagle Cabernet Sauvignon',
  '스크리밍 이글 소비뇽 블랑': 'Screaming Eagle Sauvignon Blanc',
  '캡샌디 엔드레 750ml': 'Kapcsándy Family Winery Estate Cuvée Endre',

  // 호주
  '토브렉, 런릭': 'Torbreck RunRig Shiraz',
  '토브렉, 레어드 1500ml': 'Torbreck The Laird 1.5L',
  '우드커터스 쉬라즈': "Torbreck Woodcutter's Shiraz",
  '힐 오브 그레이스 쉬라즈': 'Henschke Hill of Grace Shiraz',

  // 스페인
  '펠릭스 카예호, 셀렉시온 데 비녜도스 데 라 파밀리아': 'Bodegas Félix Callejo Selección de Viñedos de la Familia',
  '발부에나': 'Vega Sicilia Valbuena 5°',
  '우니코': 'Vega Sicilia Único',
  '토마스 에스테반': 'Tomás Esteban Ribera del Duero',
  '삔띠아': 'Pintia (Vega Sicilia) Toro',

  // 이탈리아
  '가야, 다르마지': 'Gaja Darmagi Cabernet Sauvignon',
  '사시까이아': 'Tenuta San Guido Sassicaia',
  '사시까이아 6L': 'Tenuta San Guido Sassicaia Imperial 6L',
  '주세페 퀸타렐리, 아마로네 델라 발폴리첼라 클라시코': 'Giuseppe Quintarelli Amarone della Valpolicella Classico',
  '루체 브루넬로 디 몬탈치노 1500ml': 'Tenuta Luce Brunello di Montalcino 1.5L',
  '루체 브루넬로 디 몬탈치노 3000ml': 'Tenuta Luce Brunello di Montalcino 3.0L',
  '루체': 'Tenuta Luce Luce Toscana',
  'Luce 1800ml': 'Tenuta Luce Luce Toscana 1.8L',
  '프레스코발디,카스텔지오콘도 리제르바 1500ml': 'Frescobaldi CastelGiocondo Brunello di Montalcino Riserva 1.5L',
  '프레스코발디,카스텔지오콘도 리제르바 3000ml': 'Frescobaldi CastelGiocondo Brunello di Montalcino Riserva 3.0L',
  'Masseto (T)': 'Tenuta dell\'Ornellaia Masseto',
  '마세토': 'Tenuta dell\'Ornellaia Masseto',
  '마세토 750ml': 'Tenuta dell\'Ornellaia Masseto',
  '마세토 21': 'Tenuta dell\'Ornellaia Masseto',
  '마세티노': 'Tenuta dell\'Ornellaia Massetino',
  '가야, 브루넬로 디 몬탈치노 수가릴레': 'Pieve Santa Restituta (Gaja) Brunello di Montalcino Sugarille',
  '가야, 스페르스': 'Gaja Sperss Langhe / Barolo',
  '가야 나무 박스': 'Gaja Wooden Box Collection',
  '고르고나 Gorgona': 'Frescobaldi Gorgona Bianco',
  '가야, 소리 산 로렌조': 'Gaja Sorì San Lorenzo',
  '가야, 소리 틸딘': 'Gaja Sorì Tildìn',
  '가야, 코스타 루씨': 'Gaja Costa Russi',
  '로카 디 프라시넬로, 바포네로': 'Rocca di Frassinello Baffonero',
  '솔라이아': 'Antinori Solaia',
  'Biserno': 'Tenuta di Biserno Biserno',
  'Nittardrd': 'Fattoria Nittardi Casanuova di Nittardi',
  '몬테 안티코': 'Monte Antico Rosso Toscana',
  '팔라찌 테누타 디 트리노로 로쏘 토스카나': 'Tenuta di Trinoro Palazzi Rosso Toscana',
  'Brunello Di Montalcino (매그넘)': 'Brunello di Montalcino Riserva 1.5L',
  '가이아 앤 레이 750ml': 'Gaja Gaia & Rey Chardonnay',
  '지아코모 콘테르노 몬포르티노 14 1500ml': 'Giacomo Conterno Barolo Riserva Monfortino 1.5L',
  '이 소디 산 니콜로750ml': 'Castellare di Castellina I Sodi di San Niccolò',
  'VINO BIANCO': 'Vino Bianco d\'Italia',
  'VINO ROSSO': 'Vino Rosso d\'Italia',

  // 칠레
  '비네도 차드윅': 'Viñedo Chadwick Cabernet Sauvignon',
  'Almaviva 알마비바': 'Viña Almaviva',
  '세냐': 'Seña (Chadwick & Mondavi)',

  // 포르투갈
  '테일러스 빈티지 포트': "Taylor Fladgate Vintage Port",

  // 프랑스
  '도멘 퐁소, 끌로 드 라 로슈 그랑 크뤼 뀌베 비에이유 비뉴': 'Domaine Ponsot Clos de la Roche Grand Cru Cuvée Vieilles Vignes',
  '샤또 무똥 로칠드': 'Château Mouton Rothschild',
  '알베르 비쇼, 샹볼 뮈지니': 'Albert Bichot Chambolle-Musigny',
  '조셉 페블레, 샹볼 뮈지니': 'Domaine Faiveley Chambolle-Musigny',
  '페리에 주에 1500ml': 'Perrier-Jouët Belle Epoque Brut Champagne 1.5L',
  '페리에 주에 벨에포크 750ml': 'Perrier-Jouët Belle Epoque Brut Champagne',
  '페블레, 꼬르똥 샤를마뉴 그랑 크뤼': 'Domaine Faiveley Corton-Charlemagne Grand Cru',
  '페블레, 샹베르땡 끌로 드 베즈 우브레 로딘 그랑크뤼': 'Domaine Faiveley Chambertin-Clos de Bèze Ouvrage Rodin Grand Cru',
  '페블레, 샹베르땡 끌로 드 베즈 그랑 크뤼': 'Domaine Faiveley Chambertin-Clos de Bèze Grand Cru',
  '페블레,바타르 몽라쉐 그랑 크뤼': 'Domaine Faiveley Bâtard-Montrachet Grand Cru',
  '페블레,비엥브뉘 바타르 몽라쉐 그랑 크뤼': 'Domaine Faiveley Bienvenues-Bâtard-Montrachet Grand Cru',
  '페블레, 꼬르똥 끌로 데 꼬르똥 그랑 크뤼': 'Domaine Faiveley Corton Clos des Cortons Faiveley Grand Cru',
  '페블레, 꼬르똥 끌로 데 꼬르똥 그랑 크뤼 1500ml': 'Domaine Faiveley Corton Clos des Cortons Grand Cru 1.5L',
  '페블레, 뮈즈니 그랑 크뤼': 'Domaine Faiveley Musigny Grand Cru',
  '페블레, 에세죠 그랑 크뤼': 'Domaine Faiveley Échezeaux Grand Cru',
  '(OT)Domaine Coche-Dury Puligny Montrachet Les Enseigneres': "Domaine Coche-Dury Puligny-Montrachet 'Les Enseignères'",
  '(OT)Henri Boillot Chevalier Montrachet Grand Cru Blanc': 'Domaine Henri Boillot Chevalier-Montrachet Grand Cru Blanc',
  'Ch. Les Carmes Haut Brion': 'Château Les Carmes Haut-Brion',
  'Phillip Pacalet Chambolle Musigny 1er Cru "Les Sentiers"': "Philippe Pacalet Chambolle-Musigny 1er Cru 'Les Sentiers'",
  '샤또 린치 바쥐': 'Château Lynch-Bages',
  '샤또 린쉬 바쥬': 'Château Lynch-Bages',
  '샤또 린치 바쥐': 'Château Lynch-Bages',
  '아르망드 브리냑 로제 750ml': 'Armand de Brignac Ace of Spades Brut Rosé Champagne',
  '크룩 KRUG 샴페인': 'Krug Grande Cuvée Brut Champagne',
  '헨리옷 HENRIOT 샴페인': 'Champagne Henriot Brut Millésimé',
  '꼬띠 로띠 라 뚜르크': 'E. Guigal Côte-Rôtie La Turque',
  '꼬띠 로띠 라 랑돈': 'E. Guigal Côte-Rôtie La Landonne',
  '꼬띠 로띠 라 물린': 'E. Guigal Côte-Rôtie La Mouline',
  '자쿠스 셀로스 750ml 샴페인': 'Jacques Selosse Initial Brut Champagne',
  '자쿠스 셀로스 샴페인': 'Jacques Selosse Brut Champagne',
  '자쿠스 셀로스 로제 브뤼 750ml': 'Jacques Selosse Brut Rosé Champagne',
  '파빌리온 루즈 샤또 마고': 'Pavillon Rouge du Château Margaux',
  '볼랭저, 007 그랑아네 009 1500ml': 'Champagne Bollinger 007 James Bond Collector 1.5L',
  '볼랭저, 피엔 18 AYC 1500ml': 'Champagne Bollinger PN AYC18 Brut 1.5L',
  '샤또 꼬스 데 뚜르넬': "Château Cos d'Estournel",
  '샤또 오-브리옹': 'Château Haut-Brion',
  '샤또 오-브리옹 블랑': 'Château Haut-Brion Blanc',
  '샤또 피지악': 'Château Figeac',
  '샤또 마고': 'Château Margaux',
  '샤또 슈발 블랑': 'Château Cheval Blanc',
  '샤또 오베이': 'Château Haut-Bailly',
  '샤또 뒤크르 보까이유': 'Château Ducru-Beaucaillou',
  '샤또 뽕떼 까네': 'Château Pontet-Canet',
  '샤또 팔머': 'Château Palmer',
  '샤또 레글리즈 끌리네': "Château L'Église-Clinet",
  '샤또 레오빌 라스 까스': 'Château Léoville-Las Cases',
  '돔페리뇽': 'Dom Pérignon Vintage Brut Champagne',
  '돔페리뇽 1500ml': 'Dom Pérignon Vintage Brut Champagne 1.5L',
  '돔페리뇽 750ml': 'Dom Pérignon Vintage Brut Champagne',
  '로랑페리에': 'Laurent-Perrier Brut Champagne',
  '볼랭저, 비에이 비뉴 프랑세스': 'Champagne Bollinger Vieilles Vignes Françaises',
  '자크숑 릴레징': 'Champagne Jacquesson Brut Millésimé',
  '(OT) 올리비에 귀요 샹볼 뮈지니 1등급 레 보드': "Domaine Olivier Guyot Chambolle-Musigny 1er Cru 'Les Baudes'",
  '도멘 A.F. 그로 본 로마네 끌로 드 라 퐁텐 (매그넘)': "Domaine A.-F. Gros Vosne-Romanée 'Clos de la Fontaine' 1.5L",
  '도멘 장테 팡시오 샤름 샹베르탱 그랑 크뤼 (매그넘)': 'Domaine Geantet-Pansiot Charmes-Chambertin Grand Cru 1.5L',
  '메종 카미유 지로 샹볼 뮈지니 1등급 레 제샹주': "Maison Camille Giroud Chambolle-Musigny 1er Cru 'Les Échanges'",
  '샤또 라플레르': 'Château Lafleur Pomerol',
  '샤또 앙젤루스': 'Château Angélus',
  '프랑수아 까리용 퓔리니 몽라셰': 'François Carillon Puligny-Montrachet',
  '볼랭저 그랑아네 1500ml': 'Champagne Bollinger La Grande Année 1.5L',
  '볼랭저 라그랑아네 750ml': 'Champagne Bollinger La Grande Année',
  '볼랭저 제임스 본드 007 750ml': 'Champagne Bollinger 007 Limited Edition',
  '메종 로슈 드 벨렌 퓔리니 몽라셰 1등급 레 폴라티에르': "Maison Roche de Bellene Puligny-Montrachet 1er Cru 'Les Folatières'",
  '샤또 디켐': "Château d'Yquem",
  '샤또 라피트 로칠드': 'Château Lafite Rothschild',
  '샤또 오존': 'Château Ausone',
  '샤또 페트뤼스': 'Pétrus (Pomerol)',
  '샤또 드 보까스텔, 샤또네프 뒤 빠쁘 루싼느 비에이유 비뉴': 'Château de Beaucastel Châteauneuf-du-Pape Roussanne VV',
  '샤또 드 보까스텔, 샤또네프 뒤 빠쁘 루즈': 'Château de Beaucastel Châteauneuf-du-Pape Rouge',
  '샤또 드 보까스텔, 샤또네프 뒤 빠쁘 루즈 1500ml': 'Château de Beaucastel Châteauneuf-du-Pape Rouge 1.5L',
  '샤또 드 보까스텔, 샤또네프 뒤 빠쁘 루즈 3000ml': 'Château de Beaucastel Châteauneuf-du-Pape Rouge 3.0L',
  '샤또 드 보까스텔, 오마쥬 자크 페랑 루즈': 'Château de Beaucastel Châteauneuf-du-Pape Hommage à Jacques Perrin',
  '샤또 뷰 샤또 세르땅': 'Vieux Château Certan',
  '샤또 파비': 'Château Pavie',
  '샤또 파비용 블랑': 'Pavillon Blanc du Château Margaux',
  'DRC 라 따쉬': 'Domaine de la Romanée-Conti La Tâche Grand Cru',
  'DRC 라 따쉬 그랑크루 750ml': 'Domaine de la Romanée-Conti La Tâche Grand Cru',
  'DRC, Corton': 'Domaine de la Romanée-Conti Corton Grand Cru',
  'DRC, Fine Bourgogne': 'Domaine de la Romanée-Conti Fine Bourgogne Eau-de-Vie',
  'DRC, Romanee st Vivant': 'Domaine de la Romanée-Conti Romanée-Saint-Vivant Grand Cru',
  '로마네 생 비방 그랑 크뤼750ml': 'Domaine de la Romanée-Conti Romanée-Saint-Vivant Grand Cru',
  '도멘 르플레브 룰리 프리미에 크뤼': 'Domaine Leflaive Rully 1er Cru',
  '메르소': 'Meursault Blanc',
  '샤또 트로타누아': 'Château Trotanoy',
  '꽁뜨 리제벨레르 볼로마네': 'Domaine du Comte Liger-Belair Vosne-Romanée',
  '륄리 1등급 블랑 라끌루': 'Rully 1er Cru Blanc "Les Cloux"',
  '륄리 1등급 블랑 몽빨레': 'Rully 1er Cru Blanc "Montpalais"',
  '부즈롱 알리고떼': 'Domaine de Villaine Bouzeron Aligoté',
  '부즈롱 알리고뗴': 'Domaine de Villaine Bouzeron Aligoté',
  '슈발리에 몽라쉐 그랜드 크루': 'Chevalier-Montrachet Grand Cru',
  '슈발리에 몽라쉐 레스 푸스래스': "Chevalier-Montrachet Grand Cru 'Les Demoiselles'",
  '부샤 슈발리에 몽라쉐 1500ml': 'Bouchard Père & Fils Chevalier-Montrachet Grand Cru 1.5L',
  'Bouchard Cor-Charl Grand Cru': 'Bouchard Père & Fils Corton-Charlemagne Grand Cru',
  'Bollinger Spectre James Bond 007 3L': 'Champagne Bollinger Spectre 007 Jeroboam 3.0L',
  'Capitain Gagnerot Corton Charlemagne Grand Cru White': 'Capitain-Gagnerot Corton-Charlemagne Grand Cru Blanc',
  '도메인 듀 꾸벙 샹볼 뮈지니 40 우브레': "Domaine du Couvent Chambolle-Musigny '40 Ouvrées'",
  '꼬뜨 드 뉘 빌라쥬 오 풀크': "Côte de Nuits-Villages 'Aux Fourches'",
  '뀌베 마르게릿': 'Domaine Jean-François Ganevat Cuvée Marguerite',
  '뀌베 마르게릿 1500ml': 'Domaine Jean-François Ganevat Cuvée Marguerite 1.5L',
  '루이 라투르 코통 샤를마뉴 그랑크뤼': 'Louis Latour Corton-Charlemagne Grand Cru',
  '막사네 뀌베 살리(블랑)': 'Marsannay Blanc Cuvée Saint-Urbain',
  '바슐레 모노 퓔리니 몽라셰 레 폴라티에르': "Domaine Bachelet-Monnot Puligny-Montrachet 1er Cru 'Les Folatières'",
  '볼랭저 B16': 'Champagne Bollinger B16 Brut Millésimé',
  '상볼 뮈지니 1등급 \'레 사름\'': "Chambolle-Musigny 1er Cru 'Les Charmes'",
  '샤또 베이슈벨': 'Château Beychevelle',
  '샤토 파프 클레망': 'Château Pape Clément',
  '아 베르제르,38-40 블랑 드 블랑 그랑 크뤼': 'A. Bergère 38-40 Blanc de Blancs Grand Cru Extra Brut',
  '쟝 마크 브와이요 풀리니 몽라세 프리미에 크뤼 삼 카네': "Jean-Marc Boillot Puligny-Montrachet 1er Cru 'Champ Canet'",
  '크리스탈 브뤼트': 'Louis Roederer Cristal Brut Champagne',
  '루이자도 몽라쉐 그랑크뤼': 'Louis Jadot Montrachet Grand Cru',
  '바따르 몽라쉐 750ml': 'Bâtard-Montrachet Grand Cru',
  '샤싼느 몽라쉐 레 마쥐르 750ml': "Chassagne-Montrachet 'Les Masures'",
  '크로스 데라 트루피에르 푸리그니 몬트라체 1크루 750ml': "Puligny-Montrachet 1er Cru 'Clos de la Truffière'",
  '푸리그니 몬트라체 750ml': 'Puligny-Montrachet Blanc',
  '퓔리니 몽라쉐 라 르블랑스 750ml': "Puligny-Montrachet 'La Rue aux Vaches'",
  'Francois d`Allaines, Chassagne-Montrachet 1er Cru `Les Chaumees`': "François d'Allaines Chassagne-Montrachet 1er Cru 'Les Chaumées'",
  '메르뀌리 레 몽토 (RED)': "Mercurey 'Les Montots' Rouge",
  '샤또 라 라퀸느': 'Château La Lagune (Haut-Médoc)',
  '에세조': 'Échezeaux Grand Cru',
  '리쉬부르': 'Richebourg Grand Cru',
  '보스네 로마네': 'Vosne-Romanée',
  '부르고뉴 레 끌루 에메': "Domaine de Villaine Bourgogne Côte Chalonnaise 'Les Clous Aimé'"
};

function getWineEnglishName(koreanName) {
  if (!koreanName) return '';
  const trimmed = koreanName.trim();
  
  if (MASTER_WINE_DICTIONARY[trimmed]) {
    return MASTER_WINE_DICTIONARY[trimmed];
  }
  for (const [k, v] of Object.entries(MASTER_WINE_DICTIONARY)) {
    if (trimmed.includes(k)) return v;
  }
  
  const matchEn = trimmed.match(/\(([^)]*[a-zA-Z]{3,}[^)]*)\)/);
  if (matchEn) return matchEn[1].trim();

  return '';
}

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function mapFromDb(row) {
  const kName = row.name || '';
  const enName = row.english_name ? row.english_name.trim() : getWineEnglishName(kName);
  return {
    id: Number(row.id),
    country: row.country,
    name: kName,
    englishName: enName,
    vintage: row.vintage,
    rack: row.rack,
    inQty: row.in_qty,
    outQty: row.out_qty,
    currentQty: row.current_qty,
    status: row.status,
    note: row.note,
    customImage: row.custom_image,
  };
}

export default function App() {
  const [stockData, setStockData] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRack, setSelectedRack] = useState('전체');
  const [selectedCountry, setSelectedCountry] = useState('전체');
  const [selectedVintage, setSelectedVintage] = useState('전체');
  const [onlyOutOfStock, setOnlyOutOfStock] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showRackMap, setShowRackMap] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [zoomedWine, setZoomedWine] = useState(null);
  const [editingImageWine, setEditingImageWine] = useState(null);
  const [inputImageUrl, setInputImageUrl] = useState('');
  
  const [editingRackWine, setEditingRackWine] = useState(null);
  const [newSelectedRack, setNewSelectedRack] = useState('1번랙');
  const [customNewRack, setCustomNewRack] = useState('');

  const [editingEnglishWine, setEditingEnglishWine] = useState(null);
  const [inputEnglishName, setInputEnglishName] = useState('');

  const [editingNoteWine, setEditingNoteWine] = useState(null);
  const [inputNote, setInputNote] = useState('');

  const [diffModalData, setDiffModalData] = useState(null);

  const [newWineForm, setNewWineForm] = useState({
    country: '프랑스',
    name: '',
    englishName: '',
    vintage: 'NV',
    rack: '1번랙',
    customRack: '',
    qty: 1,
    note: '',
  });

  useEffect(() => {
    async function initData() {
      setLoading(true);
      const { data: dbWines, error } = await supabase.from('wines').select('*').order('id', { ascending: false });
      const { data: dbLogs } = await supabase.from('wine_logs').select('*').order('created_at', { ascending: false }).limit(50);

      if (dbLogs) {
        setHistoryLogs(dbLogs.map(l => ({
          logId: l.log_id,
          time: l.time,
          wineId: Number(l.wine_id),
          name: l.name,
          vintage: l.vintage,
          rack: l.rack,
          country: l.country,
          changeType: l.change_type,
          delta: l.delta,
          prevQty: l.prev_qty,
          newQty: l.new_qty,
          reason: l.reason
        })));
      }

      if (!error && (!dbWines || dbWines.length === 0)) {
        try {
          const res = await fetch('/wine_data.xlsx');
          const ab = await res.arrayBuffer();
          const wb = XLSX.read(ab, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames.includes('와인재고현황') ? '와인재고현황' : wb.SheetNames[0]];
          const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
          let headerIdx = rawData.findIndex(r => r && r.includes('와인명'));
          if (headerIdx === -1) headerIdx = 1;

          const rows = rawData.slice(headerIdx + 1);
          const initialData = rows.filter(r => r && r[1]).map((r, i) => {
            const kName = String(r[1] || '').trim();
            return {
              id: i + 1,
              country: String(r[0] || '기타').trim(),
              name: kName,
              english_name: getWineEnglishName(kName),
              vintage: String(r[2] || 'NV').trim(),
              rack: String(r[3] || '미지정').trim(),
              in_qty: Number(r[4]) || 0,
              out_qty: Number(r[5]) || 0,
              current_qty: Number(r[6]) || 0,
              status: String(r[7] || '정상').trim(),
              note: String(r[8] || '').trim(),
              custom_image: null
            };
          });

          await supabase.from('wines').insert(initialData);
          setStockData(initialData.map(mapFromDb));
        } catch (e) {
          console.error('기본 데이터 초기화 실패:', e);
        }
      } else if (dbWines) {
        setStockData(dbWines.map(mapFromDb));
      }
      setLoading(false);
    }

    initData();

    const channel = supabase
      .channel('realtime-wine-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wines' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setStockData(prev => [mapFromDb(payload.new), ...prev.filter(item => item.id !== Number(payload.new.id))]);
        } else if (payload.eventType === 'UPDATE') {
          setStockData(prev => prev.map(item => item.id === Number(payload.new.id) ? mapFromDb(payload.new) : item));
        } else if (payload.eventType === 'DELETE') {
          setStockData(prev => prev.filter(item => item.id !== Number(payload.old.id)));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wine_logs' }, (payload) => {
        const l = payload.new;
        setHistoryLogs(prev => [{
          logId: l.log_id,
          time: l.time,
          wineId: Number(l.wine_id),
          name: l.name,
          vintage: l.vintage,
          rack: l.rack,
          country: l.country,
          changeType: l.change_type,
          delta: l.delta,
          prevQty: l.prev_qty,
          newQty: l.new_qty,
          reason: l.reason
        }, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleQtyChange = async (id, delta, reason = '수동 조정') => {
    const target = stockData.find(item => item.id === id);
    if (!target) return;

    const prevQty = target.currentQty;
    const newQty = Math.max(0, prevQty + delta);
    if (prevQty === newQty) return;

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    await supabase.from('wines').update({
      current_qty: newQty,
      out_qty: delta < 0 ? target.outQty + Math.abs(delta) : target.outQty,
      in_qty: delta > 0 ? target.inQty + delta : target.inQty,
      status: newQty <= 0 ? '재고없음' : '정상'
    }).eq('id', id);

    await supabase.from('wine_logs').insert([{
      log_id: String(Date.now() + Math.random()),
      time: timeStr,
      wine_id: target.id,
      name: target.name,
      vintage: target.vintage,
      rack: target.rack,
      country: target.country,
      change_type: delta > 0 ? '입고 (+)' : '출고 (-)',
      delta,
      prev_qty: prevQty,
      new_qty: newQty,
      reason
    }]);
  };

  const handleSaveRackChange = async () => {
    if (!editingRackWine) return;
    const finalRack = newSelectedRack === '직접입력' ? (customNewRack.trim() || '미지정') : newSelectedRack;
    const prevRack = editingRackWine.rack;
    if (prevRack === finalRack) {
      setEditingRackWine(null);
      return;
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    await supabase.from('wines').update({ rack: finalRack }).eq('id', editingRackWine.id);
    await supabase.from('wine_logs').insert([{
      log_id: String(Date.now() + Math.random()),
      time: timeStr,
      wine_id: editingRackWine.id,
      name: editingRackWine.name,
      vintage: editingRackWine.vintage,
      rack: finalRack,
      country: editingRackWine.country,
      change_type: '위치이동',
      delta: 0,
      prev_qty: editingRackWine.currentQty,
      new_qty: editingRackWine.currentQty,
      reason: `위치 이동: ${prevRack} ➔ ${finalRack}`
    }]);

    setEditingRackWine(null);
    setCustomNewRack('');
  };

  const handleSaveEnglishName = async () => {
    if (!editingEnglishWine) return;
    const trimmed = inputEnglishName.trim();
    await supabase.from('wines').update({ english_name: trimmed }).eq('id', editingEnglishWine.id);
    
    setStockData(prev => prev.map(w => w.id === editingEnglishWine.id ? { ...w, englishName: trimmed } : w));
    setEditingEnglishWine(null);
    setInputEnglishName('');
  };

  const handleSaveNote = async () => {
    if (!editingNoteWine) return;
    const trimmed = inputNote.trim();
    const prevNote = editingNoteWine.note || '';
    if (prevNote === trimmed) {
      setEditingNoteWine(null);
      return;
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    await supabase.from('wines').update({ note: trimmed }).eq('id', editingNoteWine.id);
    await supabase.from('wine_logs').insert([{
      log_id: String(Date.now() + Math.random()),
      time: timeStr,
      wine_id: editingNoteWine.id,
      name: editingNoteWine.name,
      vintage: editingNoteWine.vintage,
      rack: editingNoteWine.rack,
      country: editingNoteWine.country,
      change_type: '비고수정',
      delta: 0,
      prev_qty: editingNoteWine.currentQty,
      new_qty: editingNoteWine.currentQty,
      reason: `비고 수정: "${prevNote}" ➔ "${trimmed}"`
    }]);

    setStockData(prev => prev.map(w => w.id === editingNoteWine.id ? { ...w, note: trimmed } : w));
    setEditingNoteWine(null);
    setInputNote('');
  };

  const handleAddNewWine = async (e) => {
    e.preventDefault();
    if (!newWineForm.name.trim()) return;

    const targetRack = newWineForm.rack === '직접입력' 
      ? (newWineForm.customRack.trim() || '미지정') 
      : newWineForm.rack;
    const newWineId = Date.now();
    const initialQty = Math.max(1, Number(newWineForm.qty) || 1);
    const kName = newWineForm.name.trim();
    const enName = newWineForm.englishName.trim() || getWineEnglishName(kName);

    const newWineDb = {
      id: newWineId,
      country: newWineForm.country,
      name: kName,
      english_name: enName,
      vintage: newWineForm.vintage.trim() || 'NV',
      rack: targetRack,
      in_qty: initialQty,
      out_qty: 0,
      current_qty: initialQty,
      status: '정상',
      note: newWineForm.note.trim(),
      custom_image: null,
    };

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    await supabase.from('wines').insert([newWineDb]);
    await supabase.from('wine_logs').insert([{
      log_id: String(Date.now() + Math.random()),
      time: timeStr,
      wine_id: newWineId,
      name: newWineDb.name,
      vintage: newWineDb.vintage,
      rack: newWineDb.rack,
      country: newWineDb.country,
      change_type: '신규등록 (+)',
      delta: initialQty,
      prev_qty: 0,
      new_qty: initialQty,
      reason: '현장 신규 입고'
    }]);

    setNewWineForm({ country: '프랑스', name: '', englishName: '', vintage: 'NV', rack: '1번랙', customRack: '', qty: 1, note: '' });
    setShowAddModal(false);
  };

  const handleSaveImage = async (imgData) => {
    if (!editingImageWine) return;
    await supabase.from('wines').update({ custom_image: imgData }).eq('id', editingImageWine.id);
    setEditingImageWine(null);
    setInputImageUrl('');
  };

  const handleImageFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFile(file);
      await handleSaveImage(compressedDataUrl);
    } catch (err) {
      alert('이미지 압축 실패');
    }
  };

  const handleUndo = async (log) => {
    if (log.changeType === '위치이동') {
      const match = log.reason.match(/위치 이동:\s*(.+?)\s*➔\s*(.+)/);
      if (match) {
        const oldRack = match[1];
        await supabase.from('wines').update({ rack: oldRack }).eq('id', log.wineId);
      }
    } else if (log.changeType === '비고수정') {
      const match = log.reason.match(/비고 수정:\s*"(.+?)"\s*➔\s*"(.+?)"/);
      if (match) {
        const oldNote = match[1];
        await supabase.from('wines').update({ note: oldNote }).eq('id', log.wineId);
      }
    } else {
      await supabase.from('wines').update({
        current_qty: log.prevQty,
        status: log.prevQty <= 0 ? '재고없음' : '정상'
      }).eq('id', log.wineId);
    }

    await supabase.from('wine_logs').delete().eq('log_id', log.logId);
    setHistoryLogs(prev => prev.filter(l => l.logId !== log.logId));
  };

  const handleResetToDefault = async () => {
    if (!window.confirm('기본 엑셀(343종) 상태로 클라우드 데이터를 초기화하시겠습니까? (수정한 재고, 위치 및 등록된 사진이 초기화됩니다)')) return;
    setLoading(true);
    try {
      await supabase.from('wines').delete().neq('id', 0);
      await supabase.from('wine_logs').delete().neq('log_id', '');

      const res = await fetch('/wine_data.xlsx');
      const ab = await res.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const sheetName = wb.SheetNames.includes('와인재고현황') ? '와인재고현황' : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

      let headerIdx = rawData.findIndex(r => r && r.includes('와인명'));
      if (headerIdx === -1) headerIdx = 1;

      const rows = rawData.slice(headerIdx + 1);
      const defaultList = rows.filter(r => r && r[1]).map((r, i) => {
        const kName = String(r[1] || '').trim();
        return {
          id: i + 1,
          country: String(r[0] || '기타').trim(),
          name: kName,
          english_name: getWineEnglishName(kName),
          vintage: String(r[2] || 'NV').trim(),
          rack: String(r[3] || '미지정').trim(),
          in_qty: Number(r[4]) || 0,
          out_qty: Number(r[5]) || 0,
          current_qty: Number(r[6]) || 0,
          status: String(r[7] || '정상').trim(),
          note: String(r[8] || '').trim(),
          custom_image: null
        };
      });

      await supabase.from('wines').insert(defaultList);
      setStockData(defaultList.map(mapFromDb));
      setHistoryLogs([]);
      alert('기본 데이터로 초기화가 완료되었습니다.');
    } catch (err) {
      console.error('초기화 실패:', err);
      alert('초기화 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames.includes('와인재고현황') ? '와인재고현황' : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let headerIdx = rawData.findIndex(r => r && r.includes('와인명'));
        if (headerIdx === -1) headerIdx = 1;

        const rows = rawData.slice(headerIdx + 1);
        const excelRows = rows.filter(r => r && r[1]).map((r) => ({
          name: String(r[1] || '').trim(),
          vintage: String(r[2] || 'NV').trim(),
          rack: String(r[3] || '미지정').trim(),
          currentQty: Number(r[6]) || 0,
          country: String(r[0] || '기타').trim(),
          note: String(r[8] || '').trim(),
          customImage: r[9] ? String(r[9]).trim() : null,
          englishName: r[10] ? String(r[10]).trim() : null
        }));

        const matchedWebIds = new Set();
        const excelWithMatch = [];

        excelRows.forEach((excelItem) => {
          const exactMatch = stockData.find(
            w => !matchedWebIds.has(w.id) &&
                 w.name === excelItem.name &&
                 w.vintage === excelItem.vintage &&
                 w.rack === excelItem.rack
          );
          if (exactMatch) {
            matchedWebIds.add(exactMatch.id);
            excelWithMatch.push({ excelItem, match: exactMatch });
          } else {
            excelWithMatch.push({ excelItem, match: null });
          }
        });

        excelWithMatch.forEach((item) => {
          if (!item.match) {
            const looseMatch = stockData.find(
              w => !matchedWebIds.has(w.id) &&
                   w.name === item.excelItem.name &&
                   w.vintage === item.excelItem.vintage
            );
            if (looseMatch) {
              matchedWebIds.add(looseMatch.id);
              item.match = looseMatch;
            }
          }
        });

        const diffs = [];
        excelWithMatch.forEach(({ excelItem, match }) => {
          if (match) {
            const qtyChanged = match.currentQty !== excelItem.currentQty;
            const rackChanged = match.rack !== excelItem.rack;
            if (qtyChanged || rackChanged) {
              diffs.push({
                id: match.id,
                name: excelItem.name,
                vintage: excelItem.vintage,
                webQty: match.currentQty,
                excelQty: excelItem.currentQty,
                webRack: match.rack,
                excelRack: excelItem.rack,
                qtyChanged,
                rackChanged,
              });
            }
          }
        });

        if (diffs.length > 0) {
          setDiffModalData({ excelWithMatch, diffs });
        } else {
          executeSmartMerge(excelWithMatch, "모든 재고와 위치가 완벽히 일치합니다. 최신 상태로 동기화되었습니다.");
        }
      } catch (err) {
        console.error('엑셀 분석 실패:', err);
        alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const executeSmartMerge = async (excelWithMatchList, successMessage = "엑셀 데이터가 안전하게 병합 반영되었습니다.") => {
    setLoading(true);
    try {
      const photoByNameVintage = new Map();
      const englishByName = new Map();
      const noteByNameVintage = new Map();

      stockData.forEach(w => {
        if (w.customImage) photoByNameVintage.set(`${w.name}__${w.vintage}`, w.customImage);
        if (w.englishName) englishByName.set(w.name, w.englishName);
        if (w.note) noteByNameVintage.set(`${w.name}__${w.vintage}__${w.rack}`, w.note);
      });

      const usedIds = new Set();
      const mergedList = excelWithMatchList.map(({ excelItem, match }, idx) => {
        let rowId = match && !usedIds.has(match.id) ? match.id : Date.now() + idx;
        usedIds.add(rowId);

        const preservedImage = excelItem.customImage ||
                               (match && match.customImage) ||
                               photoByNameVintage.get(`${excelItem.name}__${excelItem.vintage}`) ||
                               null;

        const preservedEnglish = excelItem.englishName ||
                                (match && match.englishName) ||
                                englishByName.get(excelItem.name) ||
                                getWineEnglishName(excelItem.name);

        const preservedNote = excelItem.note !== '' ? excelItem.note :
                              (match && match.note ? match.note :
                              noteByNameVintage.get(`${excelItem.name}__${excelItem.vintage}__${excelItem.rack}`) || '');

        return {
          id: rowId,
          country: excelItem.country,
          name: excelItem.name,
          english_name: preservedEnglish,
          vintage: excelItem.vintage,
          rack: excelItem.rack,
          in_qty: match ? match.inQty : excelItem.currentQty,
          out_qty: match ? match.outQty : 0,
          current_qty: excelItem.currentQty,
          status: excelItem.currentQty <= 0 ? '재고없음' : '정상',
          note: preservedNote,
          custom_image: preservedImage,
        };
      });

      await supabase.from('wines').delete().neq('id', 0);
      const { error: insertError } = await supabase.from('wines').insert(mergedList);

      if (insertError) throw insertError;

      setStockData(mergedList.map(mapFromDb));
      setDiffModalData(null);
      alert(successMessage);
    } catch (err) {
      console.error('스마트 병합 실패:', err);
      alert('병합 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (stockData.length === 0) return;
    const stockSheetData = [
      ['와 인 재 고 현 황'],
      ['원산지', '와인명(한글)', '빈티지', '보관위치', '총 입고량', '총 출고량', '현재고', '상태', '비고', '이미지링크', '영문명']
    ];
    stockData.forEach(item => {
      stockSheetData.push([
        item.country, item.name, item.vintage, item.rack,
        item.inQty, item.outQty, item.currentQty, item.status, item.note,
        item.customImage && item.customImage.startsWith('http') ? item.customImage : '',
        item.englishName
      ]);
    });

    const ledgerSheetData = [
      ['입출고대장'],
      ['날짜/일시', '구분', '원산지', '와인명', '빈티지', '보관위치', '수량', '사유']
    ];
    historyLogs.forEach(l => {
      ledgerSheetData.push([l.time, l.changeType, l.country, l.name, l.vintage, l.rack, Math.abs(l.delta), l.reason]);
    });

    const newWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, XLSX.utils.aoa_to_sheet(stockSheetData), '와인재고현황');
    XLSX.utils.book_append_sheet(newWb, XLSX.utils.aoa_to_sheet(ledgerSheetData), '입출고변경이력');
    XLSX.writeFile(newWb, `서울석유_와인창고_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const rackCountMap = useMemo(() => {
    const map = {};
    stockData.forEach(item => { map[item.rack] = (map[item.rack] || 0) + item.currentQty; });
    return map;
  }, [stockData]);

  const specialRacks = useMemo(() => {
    const unique = Array.from(new Set(stockData.map(item => item.rack))).filter(Boolean);
    const wallRacks = Array.from({ length: 27 }, (_, i) => `${i + 1}번랙`);
    const centerRacks = ['중앙랙(1번줄)', '중앙랙(2번줄)', '중앙랙(3번줄)', '중앙랙(4번줄)', '중앙랙(5번줄)', '중앙랙(6번줄)'];
    return unique.filter(r => !wallRacks.includes(r) && !centerRacks.includes(r));
  }, [stockData]);

  const countryList = useMemo(() => {
    const unique = Array.from(new Set(stockData.map(item => item.country))).filter(Boolean);
    return ['전체', ...unique];
  }, [stockData]);

  const vintageList = useMemo(() => {
    const unique = Array.from(new Set(stockData.map(item => item.vintage))).filter(Boolean);
    return ['전체', ...unique.sort((a, b) => b.localeCompare(a))];
  }, [stockData]);

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return stockData.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(term) ||
                          (item.englishName && item.englishName.toLowerCase().includes(term)) ||
                          item.vintage.toLowerCase().includes(term) ||
                          (item.note && item.note.toLowerCase().includes(term));
      const matchRack = selectedRack === '전체' || item.rack === selectedRack;
      const matchCountry = selectedCountry === '전체' || item.country === selectedCountry;
      const matchVintage = selectedVintage === '전체' || item.vintage === selectedVintage;
      const matchStatus = onlyOutOfStock ? (item.currentQty <= 0 || item.status === '재고없음') : true;
      return matchSearch && matchRack && matchCountry && matchVintage && matchStatus;
    });
  }, [stockData, searchTerm, selectedRack, selectedCountry, selectedVintage, onlyOutOfStock]);

  const stats = useMemo(() => {
    const totalBottles = stockData.reduce((acc, cur) => acc + cur.currentQty, 0);
    const totalTypes = stockData.length;
    const outOfStockCount = stockData.filter(i => i.currentQty <= 0 || i.status === '재고없음').length;
    return { totalBottles, totalTypes, outOfStockCount };
  }, [stockData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Wine className="w-10 h-10 text-rose-500 animate-bounce" />
        <p className="text-sm font-medium">프리미엄 와인 데이터베이스 연결 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-28">
      {/* 2단 헤더 */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-30 px-3.5 sm:px-6 py-2.5 sm:py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-rose-600/20 text-rose-500 rounded-xl border border-rose-500/30 shrink-0">
                <Wine className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-xl font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
                  서울석유 2층 와인창고
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="실시간 클라우드 연결됨" />
                </h1>
                <p className="text-[10px] sm:text-xs text-emerald-400 truncate">
                  실시간 양방향 클라우드 동기화 중
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="sm:hidden flex items-center gap-1 px-3 py-1.5 bg-rose-600 active:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-950/50 shrink-0 touch-manipulation"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>와인추가</span>
            </button>
          </div>

          <div className="grid grid-cols-4 sm:flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="hidden sm:flex items-center gap-1 px-3.5 py-2 bg-rose-600 active:bg-rose-700 hover:bg-rose-500 text-white rounded-xl text-sm font-bold shadow-md shadow-rose-950/50 touch-manipulation"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>와인추가</span>
            </button>

            <button
              onClick={() => setShowLogModal(true)}
              className="relative flex items-center justify-center gap-1 py-1.5 sm:px-3 sm:py-2 bg-slate-800 active:bg-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-medium border border-slate-700 transition touch-manipulation"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>이력</span>
              {historyLogs.length > 0 && (
                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-500 text-slate-950 rounded-full">
                  {historyLogs.length}
                </span>
              )}
            </button>

            <button
              onClick={handleDownloadExcel}
              className="flex items-center justify-center gap-1 py-1.5 sm:px-3 sm:py-2 bg-emerald-600/90 active:bg-emerald-700 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-emerald-950/40 touch-manipulation"
              title="수정본 엑셀 다운로드"
            >
              <Download className="w-3.5 h-3.5" />
              <span>엑셀다운</span>
            </button>

            <button
              onClick={handleResetToDefault}
              className="flex items-center justify-center gap-1 py-1.5 sm:px-3 sm:py-2 bg-slate-800 active:bg-slate-700 hover:bg-slate-650 text-slate-200 rounded-xl text-xs sm:text-sm font-medium border border-slate-700 transition touch-manipulation"
              title="기본 엑셀 데이터로 초기화"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>초기화</span>
            </button>

            <label className="flex items-center justify-center gap-1 py-1.5 sm:px-3 sm:py-2 bg-slate-800 active:bg-slate-700 text-slate-300 rounded-xl text-xs sm:text-sm font-medium border border-slate-700 cursor-pointer transition touch-manipulation" title="새 엑셀 파일 업로드">
              <Upload className="w-3.5 h-3.5" />
              <span>새 파일</span>
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* 상단 통계 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-slate-900/80 border border-slate-800/80 p-3 sm:p-4 rounded-2xl">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Wine className="w-3.5 h-3.5 text-rose-400" /> 총 보관수량
            </span>
            <p className="text-lg sm:text-2xl font-bold text-white mt-1 font-mono">
              {stats.totalBottles.toLocaleString()}<span className="text-xs font-normal text-slate-400 ml-0.5">병</span>
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 p-3 sm:p-4 rounded-2xl">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-blue-400" /> 와인 라벨
            </span>
            <p className="text-lg sm:text-2xl font-bold text-white mt-1 font-mono">
              {stats.totalTypes}<span className="text-xs font-normal text-slate-400 ml-0.5">종</span>
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 p-3 sm:p-4 rounded-2xl">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> 소진 품목
            </span>
            <p className="text-lg sm:text-2xl font-bold text-amber-400 mt-1 font-mono">
              {stats.outOfStockCount}<span className="text-xs font-normal text-slate-400 ml-0.5">개</span>
            </p>
          </div>
        </div>

        {/* 랙 맵 */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 sm:p-5 shadow-xl">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => setShowRackMap(!showRackMap)}
              className="flex items-center gap-2 text-left w-full group touch-manipulation"
            >
              <Grid3X3 className="w-4 h-4 text-rose-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs sm:text-sm font-bold text-white block">2층 창고 랙(Rack) 전체 구조 맵</span>
                <span className="text-[10px] sm:text-xs text-slate-400">
                  {selectedRack === '전체' ? '터치하여 랙별 빠른 필터링' : `[${selectedRack}] 선택됨`}
                </span>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 rounded-lg text-slate-300 text-xs">
                <span>{showRackMap ? '접기' : '펼치기'}</span>
                {showRackMap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </button>
          </div>

          {showRackMap && (
            <div className="space-y-4 pt-3.5 mt-3 border-t border-slate-800">
              {selectedRack !== '전체' && (
                <div className="flex justify-end">
                  <button onClick={() => setSelectedRack('전체')} className="text-xs text-rose-400 font-semibold hover:underline">
                    ✕ 필터 초기화 (전체 랙 보기)
                  </button>
                </div>
              )}

              <div>
                <span className="text-[11px] text-slate-400 font-semibold block mb-2">🧱 외곽 벽면 랙 (1번 ~ 27번)</span>
                <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-14 gap-1.5">
                  {Array.from({ length: 27 }, (_, i) => `${i + 1}번랙`).map(r => {
                    const count = rackCountMap[r] || 0;
                    const isSelected = selectedRack === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setSelectedRack(isSelected ? '전체' : r)}
                        className={`py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center transition border touch-manipulation ${
                          isSelected ? 'bg-rose-600 border-rose-400 text-white shadow-lg' : count > 0 ? 'bg-slate-800/90 border-slate-700/80 text-slate-200' : 'bg-slate-900/30 border-slate-800/40 text-slate-600'
                        }`}
                      >
                        <span className="text-[11px] font-bold leading-tight">{r.replace('번랙', '')}번</span>
                        <span className="text-[10px] font-mono opacity-80">{count}병</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-blue-400 font-semibold block mb-2">🏢 중앙 통로 랙 (1번줄 ~ 6번줄)</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 sm:gap-2">
                  {['중앙랙(1번줄)', '중앙랙(2번줄)', '중앙랙(3번줄)', '중앙랙(4번줄)', '중앙랙(5번줄)', '중앙랙(6번줄)'].map(r => {
                    const count = rackCountMap[r] || 0;
                    const isSelected = selectedRack === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setSelectedRack(isSelected ? '전체' : r)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition border flex items-center justify-between gap-1.5 touch-manipulation ${
                          isSelected ? 'bg-rose-600 border-rose-400 text-white shadow-md' : count > 0 ? 'bg-slate-800/90 border-slate-700 text-slate-200' : 'bg-slate-900/40 border-slate-800 text-slate-600'
                        }`}
                      >
                        <span className="truncate">{r.replace('중앙랙', '중앙')}</span>
                        <span className={`font-mono text-[11px] font-bold shrink-0 ${isSelected ? 'text-white' : 'text-blue-400'}`}>
                          {count}병
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-amber-400 font-semibold block mb-2">📦 천장 및 박스 / 특수 보관</span>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {specialRacks.map(r => {
                    const count = rackCountMap[r] || 0;
                    const isSelected = selectedRack === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setSelectedRack(isSelected ? '전체' : r)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border flex items-center gap-1.5 touch-manipulation ${
                          isSelected ? 'bg-rose-600 border-rose-400 text-white shadow-md' : count > 0 ? 'bg-slate-800/90 border-slate-700 text-slate-200' : 'bg-slate-900/40 border-slate-800 text-slate-600'
                        }`}
                      >
                        <span>📍 {r}</span>
                        <span className={`font-mono text-[11px] font-bold ${isSelected ? 'text-white' : 'text-amber-400'}`}>
                          ({count}병)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 검색 및 필터 바 (국가, 빈티지 필터 나란히 배치) */}
        <div className="bg-slate-900/80 border border-slate-800/80 p-3 sm:p-4 rounded-2xl space-y-3">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="와인명(한글/영문), 빈티지, 비고 메모 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-rose-500 truncate"
              >
                {countryList.map(c => (<option key={c} value={c}>{c === '전체' ? '🌍 전체 국가' : `🌍 ${c}`}</option>))}
              </select>

              <select
                value={selectedVintage}
                onChange={(e) => setSelectedVintage(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-amber-300 font-mono text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-rose-500 truncate"
              >
                {vintageList.map(v => (<option key={v} value={v}>{v === '전체' ? '📅 전체 빈티지' : `📅 ${v}`}</option>))}
              </select>

              <button
                onClick={() => setOnlyOutOfStock(!onlyOutOfStock)}
                className={`px-2.5 py-2 text-xs font-medium rounded-xl border transition shrink-0 touch-manipulation ${
                  onlyOutOfStock ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                품절만
              </button>
            </div>

            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-slate-800 text-rose-400' : 'text-slate-400'}`}><LayoutGrid className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-lg transition ${viewMode === 'table' ? 'bg-slate-800 text-rose-400' : 'text-slate-400'}`}><Table className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* [개선된 호텔 셀러 스타일 미니멀 카드 뷰] */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredData.map((item) => {
              const countryStyle = COUNTRY_INFO[item.country] || { flag: '🍷', label: item.country };
              const searchTargetName = item.englishName || item.name;
              const vivinoSmartUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTargetName + ' ' + (item.vintage !== 'NV' ? item.vintage : '') + ' vivino')}`;

              return (
                <div 
                  key={item.id} 
                  className="bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-xl transition relative group"
                >
                  <div>
                    {/* 1. 상단 미니멀 메타 바 (국가, 빈티지, 랙 위치) */}
                    <div className="flex items-center justify-between text-xs pb-2.5 mb-3 border-b border-slate-800/60 text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span>{countryStyle.flag}</span>
                        <span className="font-medium text-slate-300">{countryStyle.label}</span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono font-bold text-amber-300">{item.vintage}</span>
                      </div>

                      <button
                        onClick={() => {
                          setEditingRackWine(item);
                          setNewSelectedRack(item.rack);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-rose-400 hover:text-rose-300 border border-rose-500/20 text-[11px] font-medium transition touch-manipulation"
                        title="터치하여 보관 랙 위치 이동"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>{item.rack}</span>
                        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                      </button>
                    </div>

                    {/* 2. 중앙 컨텐츠 (좌측 썸네일 + 우측 와인명 / 영문명 / 비고) */}
                    <div className="flex gap-3.5 items-start">
                      {/* 사진 썸네일 */}
                      <div className="w-20 h-24 sm:w-22 sm:h-26 shrink-0 rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden flex flex-col items-center justify-center relative">
                        {item.customImage ? (
                          <div 
                            onClick={() => setZoomedWine(item)}
                            className="w-full h-full relative cursor-pointer flex items-center justify-center group/img"
                            title="클릭하여 사진 확대"
                          >
                            <img
                              src={item.customImage}
                              alt={item.name}
                              className="w-full h-full object-contain p-1"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center text-[10px] text-white font-medium gap-0.5">
                              <ZoomIn className="w-3.5 h-3.5" /> 확대
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingImageWine(item)}
                            className="w-full h-full flex flex-col items-center justify-center text-slate-500 hover:text-rose-400 transition gap-1 touch-manipulation"
                            title="사진 등록"
                          >
                            <Camera className="w-4 h-4 opacity-60" />
                            <span className="text-[10px] font-medium">+사진</span>
                          </button>
                        )}
                      </div>

                      {/* 와인 이름 영역 */}
                      <div className="flex-1 min-w-0">
                        {/* 한글 와인명 */}
                        <h3 className="font-bold text-white text-sm sm:text-base leading-snug tracking-tight line-clamp-2">
                          {item.name}
                        </h3>

                        {/* 정통 영문 와인명 (클릭하여 수정 가능) */}
                        <div 
                          onClick={() => {
                            setEditingEnglishWine(item);
                            setInputEnglishName(item.englishName || '');
                          }}
                          className="cursor-pointer group/en flex items-center gap-1 mt-1"
                          title="클릭하여 영문명 직접 수정"
                        >
                          <p className="text-xs text-slate-400 italic font-serif leading-snug line-clamp-2 group-hover/en:text-rose-300 transition">
                            {item.englishName || '+ 영문명 입력'}
                          </p>
                          <Edit3 className="w-2.5 h-2.5 text-slate-500 opacity-0 group-hover/en:opacity-100 shrink-0" />
                        </div>

                        {/* 비고란 메모 (단정하고 은은한 라벨 스타일) */}
                        <div className="mt-2">
                          {item.note ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteWine(item);
                                setInputNote(item.note || '');
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:text-amber-300 transition truncate max-w-full touch-manipulation"
                              title="비고(메모) 수정"
                            >
                              <span>🏷️ {item.note}</span>
                              <Edit3 className="w-2.5 h-2.5 opacity-50 shrink-0" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteWine(item);
                                setInputNote('');
                              }}
                              className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 hover:text-slate-300 transition touch-manipulation"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>메모 추가</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. 하단 컨트롤 바 (Vivino 평점 링크 & 단정한 재고 증감 카운터) */}
                  <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2 mt-3.5">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={vivinoSmartUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-800 text-rose-300/90 hover:text-rose-300 rounded-xl text-xs font-semibold border border-slate-700/80 transition touch-manipulation"
                        title="비비노 평점 바로보기"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-rose-400" />
                        <span>Vivino 평점</span>
                      </a>

                      <button
                        onClick={() => setEditingImageWine(item)}
                        className="p-1.5 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-700/60 transition touch-manipulation"
                        title="사진 변경"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 재고 증감 카운터 */}
                    <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                      <button
                        onClick={() => handleQtyChange(item.id, -1, '출고')}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-slate-300 transition touch-manipulation"
                        title="1병 출고"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <div className="w-11 text-center">
                        <span className={`text-base font-black font-mono block leading-none ${
                          item.currentQty <= 0 ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                          {item.currentQty}
                        </span>
                        <span className="text-[9px] text-slate-500 block mt-0.5 font-sans">현재고</span>
                      </div>

                      <button
                        onClick={() => handleQtyChange(item.id, 1, '입고')}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-slate-300 transition touch-manipulation"
                        title="1병 입고"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 테이블 뷰 */}
        {viewMode === 'table' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="sm:hidden px-3 py-2 bg-slate-950/60 border-b border-slate-800 text-[11px] text-slate-400">
              👉 좌우로 밀어 전체 컬럼을 확인하세요
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse whitespace-nowrap">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                  <tr>
                    <th className="px-3 sm:px-4 py-3 font-semibold">사진</th>
                    <th className="px-3 sm:px-4 py-3 font-semibold">원산지</th>
                    <th className="px-3 sm:px-5 py-3 font-semibold">와인명 (한글 / 영문)</th>
                    <th className="px-2 sm:px-3 py-3 font-semibold text-center">빈티지</th>
                    <th className="px-3 sm:px-4 py-3 font-semibold">보관위치</th>
                    <th className="px-3 sm:px-4 py-3 font-semibold text-center">현재고</th>
                    <th className="px-3 sm:px-4 py-3 font-semibold">비고</th>
                    <th className="px-2 sm:px-3 py-3 font-semibold text-center">비비노</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-3 sm:px-4 py-2">
                        {item.customImage ? (
                          <img 
                            src={item.customImage} 
                            alt={item.name} 
                            onClick={() => setZoomedWine(item)}
                            className="w-9 h-9 object-contain rounded bg-slate-950 border border-slate-700 cursor-pointer" 
                          />
                        ) : (
                          <button
                            onClick={() => setEditingImageWine(item)}
                            className="w-9 h-9 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 hover:text-white"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-slate-400">{item.country}</td>
                      <td className="px-3 sm:px-5 py-3 max-w-xs">
                        <div className="font-medium text-white truncate">{item.name}</div>
                        <div 
                          onClick={() => {
                            setEditingEnglishWine(item);
                            setInputEnglishName(item.englishName || '');
                          }}
                          className="text-[11px] text-slate-400 italic truncate font-serif cursor-pointer hover:text-rose-300"
                        >
                          {item.englishName || '+ 영문명 입력'}
                        </div>
                      </td>
                      <td className="px-2 sm:px-3 py-3 text-slate-300 text-center font-mono">{item.vintage}</td>
                      <td className="px-3 sm:px-4 py-3">
                        <button
                          onClick={() => {
                            setEditingRackWine(item);
                            setNewSelectedRack(item.rack);
                          }}
                          className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-200 border border-slate-700 hover:border-rose-400 flex items-center gap-1"
                        >
                          <span>{item.rack}</span>
                          <Edit3 className="w-2.5 h-2.5 text-slate-400" />
                        </button>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleQtyChange(item.id, -1, '출고')}
                            className="w-7 h-7 rounded bg-slate-800 active:bg-slate-700 text-slate-200 flex items-center justify-center"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className={`w-8 text-center font-bold font-mono ${
                            item.currentQty <= 0 ? 'text-red-400' : 'text-emerald-400'
                          }`}>
                            {item.currentQty}
                          </span>
                          <button
                            onClick={() => handleQtyChange(item.id, 1, '입고')}
                            className="w-7 h-7 rounded bg-slate-800 active:bg-slate-700 text-slate-200 flex items-center justify-center"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 max-w-[140px]">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteWine(item);
                            setInputNote(item.note || '');
                          }}
                          className="text-left text-slate-300 hover:text-amber-300 truncate w-full flex items-center justify-between gap-1 group"
                          title="클릭하여 비고 수정"
                        >
                          <span className="truncate">{item.note || '-'}</span>
                          <Edit3 className="w-2.5 h-2.5 text-slate-500 opacity-0 group-hover:opacity-100 shrink-0" />
                        </button>
                      </td>
                      <td className="px-2 sm:px-3 py-3 text-center">
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent((item.englishName || item.name) + ' ' + (item.vintage !== 'NV' ? item.vintage : '') + ' vivino')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center p-1.5 bg-slate-800 text-slate-300 rounded-lg"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 비고(메모) 수정 모달 */}
      {editingNoteWine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-amber-400" /> 비고 (메모) 수정
                </h3>
                <p className="text-xs text-rose-400 mt-0.5 truncate max-w-[240px]">
                  {editingNoteWine.name} ({editingNoteWine.vintage})
                </p>
              </div>
              <button onClick={() => setEditingNoteWine(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">비고 내용 입력</label>
              <input
                type="text"
                placeholder="예: 매그넘 1500ml, 선물용, 보관상태 주의 등"
                value={inputNote}
                onChange={(e) => setInputNote(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                autoFocus
              />
              <p className="text-[11px] text-slate-500">
                * 공백으로 비워두고 저장하시면 비고 라벨이 삭제됩니다.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => setEditingNoteWine(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 엑셀 검증 모달 */}
      {diffModalData && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">재고 정밀 검증</span>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5 mt-0.5">
                  <AlertCircle className="w-5 h-5 text-amber-400" /> 업로드 엑셀 실제 변경점 감지 ({diffModalData.diffs.length}건)
                </h3>
              </div>
              <button onClick={() => setDiffModalData(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
              <p className="text-xs text-slate-300 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl leading-relaxed">
                ⚠️ 현장 창고에서 수정된 내역과 엑셀 간에 수량 또는 위치 차이가 있는 항목입니다. 확인 후 병합해 주세요. (기존 등록 사진과 비고는 안전하게 보존됩니다)
              </p>

              <div className="space-y-2 pt-1">
                {diffModalData.diffs.map((d, i) => (
                  <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-sm">{d.name}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px]">{d.vintage}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 text-slate-300">
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block mb-0.5">현재 웹 상태</span>
                        {d.qtyChanged && <span className="text-rose-400 font-bold block">재고: {d.webQty}병</span>}
                        {d.rackChanged && <span className="text-rose-400 font-bold block">위치: 📍 {d.webRack}</span>}
                      </div>
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block mb-0.5">엑셀 내용</span>
                        {d.qtyChanged && <span className="text-emerald-400 font-bold block">재고: {d.excelQty}병</span>}
                        {d.rackChanged && <span className="text-emerald-400 font-bold block">위치: 📍 {d.excelRack}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
              <button onClick={() => setDiffModalData(null)} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold">취소</button>
              <button onClick={() => executeSmartMerge(diffModalData.excelWithMatch, "검증된 엑셀 데이터가 안전하게 병합 반영되었습니다.")} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>엑셀 내용으로 병합 적용 (사진 보존)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 랙 이동 모달 */}
      {editingRackWine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-1.5"><MapPin className="w-4 h-4 text-rose-500" /> 보관 랙 위치 이동</h3>
                <p className="text-xs text-rose-400 mt-0.5 truncate max-w-[240px]">{editingRackWine.name}</p>
              </div>
              <button onClick={() => setEditingRackWine(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-400 block mb-1">현재 보관 위치</span>
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-sm font-bold text-white font-mono">📍 {editingRackWine.rack}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">이동할 새 랙 선택</label>
                <select value={newSelectedRack} onChange={(e) => setNewSelectedRack(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500">
                  {COMMON_RACKS.map(r => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>
              {newSelectedRack === '직접입력' && (
                <input type="text" placeholder="예: VIP룸 1번 수납장 등" value={customNewRack} onChange={(e) => setCustomNewRack(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-rose-500/60 rounded-xl text-sm text-white" />
              )}
            </div>
            <div className="pt-3 border-t border-slate-800 flex gap-2">
              <button onClick={() => setEditingRackWine(null)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs">취소</button>
              <button onClick={handleSaveRackChange} className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold">이동 완료</button>
            </div>
          </div>
        </div>
      )}

      {/* 영문명 수정 모달 */}
      {editingEnglishWine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-1.5"><Edit3 className="w-4 h-4 text-amber-400" /> 영문 와인명 수정</h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[240px]">{editingEnglishWine.name}</p>
              </div>
              <button onClick={() => setEditingEnglishWine(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">정확한 영문 와인명 입력</label>
              <input type="text" placeholder="예: Opus One" value={inputEnglishName} onChange={(e) => setInputEnglishName(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-serif focus:outline-none focus:border-rose-500" />
            </div>
            <div className="pt-3 border-t border-slate-800 flex gap-2">
              <button onClick={() => setEditingEnglishWine(null)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs">취소</button>
              <button onClick={handleSaveEnglishName} className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 사진 확대 모달 */}
      {zoomedWine && (
        <div onClick={() => setZoomedWine(null)} className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">와인 라벨 확인</span>
                <h3 className="font-bold text-white text-sm sm:text-base leading-snug truncate mt-0.5">{zoomedWine.name}</h3>
                <p className="text-xs text-slate-400 italic truncate font-serif">{zoomedWine.englishName}</p>
              </div>
              <button onClick={() => setZoomedWine(null)} className="p-1.5 bg-slate-800 rounded-xl text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 bg-slate-950/90 flex items-center justify-center max-h-[50vh] min-h-[260px]">
              <img src={zoomedWine.customImage} alt={zoomedWine.name} className="max-h-[46vh] max-w-full object-contain rounded-lg drop-shadow-2xl" />
            </div>
            <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">빈티지 / 생산국</span>
                  <span className="font-bold text-amber-300 font-mono text-sm">{zoomedWine.vintage}</span>
                  <span className="text-slate-300 ml-1.5">({zoomedWine.country})</span>
                </div>
                <div onClick={() => { const target = zoomedWine; setZoomedWine(null); setEditingRackWine(target); setNewSelectedRack(target.rack); }} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-rose-500/50 transition">
                  <span className="text-[10px] text-slate-400 block flex items-center justify-between">보관 랙 <Edit3 className="w-2.5 h-2.5 text-rose-400" /></span>
                  <span className="font-bold text-rose-400 text-sm">📍 {zoomedWine.rack}</span>
                </div>
                <div 
                  onClick={() => {
                    const target = zoomedWine;
                    setZoomedWine(null);
                    setEditingNoteWine(target);
                    setInputNote(target.note || '');
                  }}
                  className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-amber-500/50 transition col-span-2"
                >
                  <span className="text-[10px] text-slate-400 flex items-center justify-between">
                    비고 / 메모 <Edit3 className="w-2.5 h-2.5 text-amber-400" />
                  </span>
                  <span className="font-medium text-slate-200 text-xs truncate block mt-0.5">
                    {zoomedWine.note ? `🏷️ ${zoomedWine.note}` : '등록된 비고가 없습니다 (터치하여 입력)'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { const target = zoomedWine; setZoomedWine(null); setEditingImageWine(target); }} className="flex-1 py-2.5 bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700">
                  <Camera className="w-3.5 h-3.5 text-emerald-400" /><span>사진 변경</span>
                </button>
                <a href={`https://www.google.com/search?q=${encodeURIComponent((zoomedWine.englishName || zoomedWine.name) + ' ' + (zoomedWine.vintage !== 'NV' ? zoomedWine.vintage : '') + ' vivino')}`} target="_blank" rel="noreferrer" className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg">
                  <ExternalLink className="w-3.5 h-3.5" /><span>비비노 평점</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 사진 등록 모달 */}
      {editingImageWine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">와인 사진 클라우드 등록</h3>
                <p className="text-xs text-rose-400 mt-0.5 truncate max-w-xs">{editingImageWine.name} ({editingImageWine.vintage})</p>
              </div>
              <button onClick={() => setEditingImageWine(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">방법 1. 구글 이미지 자동 검색</span>
              <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent((editingImageWine.englishName || editingImageWine.name) + ' ' + (editingImageWine.vintage !== 'NV' ? editingImageWine.vintage : '') + ' wine bottle label')}`} target="_blank" rel="noreferrer" className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition">
                <Search className="w-3.5 h-3.5" /> <span>구글에서 라벨 사진 찾기</span>
              </a>
            </div>
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">방법 2. 이미지 주소(URL) 붙여넣기</span>
              <div className="flex gap-2">
                <input type="url" placeholder="https://... 이미지 주소" value={inputImageUrl} onChange={(e) => setInputImageUrl(e.target.value)} className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500" />
                <button type="button" onClick={() => inputImageUrl.trim() && handleSaveImage(inputImageUrl.trim())} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shrink-0 transition">적용</button>
              </div>
            </div>
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">방법 3. 카메라 촬영 / 앨범 사진</span>
              <label className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700 transition">
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>카메라로 촬영하여 클라우드에 올리기</span>
                <input type="file" accept="image/*" onChange={handleImageFileUpload} className="hidden" />
              </label>
            </div>
            {editingImageWine.customImage && (
              <button type="button" onClick={() => handleSaveImage(null)} className="w-full py-2 text-red-400 hover:bg-red-950/30 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition">
                <Trash2 className="w-3.5 h-3.5" /> <span>등록된 사진 삭제</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 와인 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-rose-500" />
                <h3 className="text-base sm:text-lg font-bold text-white">현장 와인 신규 등록 (클라우드 즉시 반영)</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddNewWine} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto max-h-[75vh]">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">와인명 (한글) *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 샤또 마고, 오퍼스 원 등"
                  value={newWineForm.name}
                  onChange={(e) => setNewWineForm({ ...newWineForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">영문 와인명 (선택, 비워두면 자동 완성)</label>
                <input
                  type="text"
                  placeholder="예: Opus One, Château Margaux"
                  value={newWineForm.englishName}
                  onChange={(e) => setNewWineForm({ ...newWineForm, englishName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-serif placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">원산지 (국가)</label>
                  <select value={newWineForm.country} onChange={(e) => setNewWineForm({ ...newWineForm, country: e.target.value })} className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500">
                    <option value="프랑스">🇫🇷 프랑스</option><option value="미국">🇺🇸 미국</option><option value="이탈리아">🇮🇹 이탈리아</option>
                    <option value="스페인">🇪🇸 스페인</option><option value="호주">🇦🇺 호주</option><option value="칠레">🇨🇱 칠레</option><option value="포르투갈">🇵🇹 포르투갈</option><option value="기타">🍷 기타</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">빈티지</label>
                  <input type="text" placeholder="예: 2018 또는 NV" value={newWineForm.vintage} onChange={(e) => setNewWineForm({ ...newWineForm, vintage: e.target.value })} className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">보관 랙</label>
                  <select value={newWineForm.rack} onChange={(e) => setNewWineForm({ ...newWineForm, rack: e.target.value })} className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500">
                    {COMMON_RACKS.map(r => (<option key={r} value={r}>{r}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">입고 수량</label>
                  <input type="number" min="1" value={newWineForm.qty} onChange={(e) => setNewWineForm({ ...newWineForm, qty: Number(e.target.value) })} className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono" />
                </div>
              </div>
              {newWineForm.rack === '직접입력' && (
                <input type="text" placeholder="보관 구역 직접 입력" value={newWineForm.customRack} onChange={(e) => setNewWineForm({ ...newWineForm, customRack: e.target.value })} className="w-full px-3.5 py-2.5 bg-slate-950 border border-rose-500/50 rounded-xl text-sm text-white" />
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">비고 (선택)</label>
                <input type="text" placeholder="매그넘, 선물용 등" value={newWineForm.note} onChange={(e) => setNewWineForm({ ...newWineForm, note: e.target.value })} className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white" />
              </div>
              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm">취소</button>
                <button type="submit" className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-bold shadow-lg">등록 완료</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 변경 이력 모달 */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">클라우드 변경 이력 ({historyLogs.length}건)</h3>
              </div>
              <button onClick={() => setShowLogModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
              {historyLogs.map(log => (
                <div key={log.logId} className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.changeType === '위치이동' ? 'bg-purple-500/20 text-purple-300' :
                        log.changeType === '비고수정' ? 'bg-amber-500/20 text-amber-300' :
                        log.changeType.includes('등록') ? 'bg-emerald-500/20 text-emerald-300' :
                        log.changeType.includes('입고') ? 'bg-blue-500/20 text-blue-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {log.changeType}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{log.time}</span>
                    </div>
                    <p className="font-semibold text-white text-xs sm:text-sm truncate">{log.name} ({log.vintage})</p>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{log.reason}</p>
                  </div>
                  <button onClick={() => handleUndo(log)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-amber-300 rounded-lg text-xs font-semibold shrink-0 border border-amber-500/30">
                    <RotateCcw className="w-3.5 h-3.5" /> <span>되돌리기</span>
                  </button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button onClick={() => setShowLogModal(false)} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-medium">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}