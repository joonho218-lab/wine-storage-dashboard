import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import {
  Wine, Search, Upload, Download,
  ExternalLink, Plus,
  Grid3X3, History, RotateCcw, X, Camera, RefreshCw,
  PlusCircle, Trash2,
  Edit3, MapPin, AlertCircle, AlertTriangle
} from 'lucide-react';
import RackMap from './components/RackMap';
import RecordPanel from './components/RecordPanel';
import FilterBar from './components/FilterBar';
import { GroupCards, GroupTable } from './components/WineList';
import SyncReview from './components/SyncReview';
import { MoreIcon, InOutIcon, ListIcon } from './components/icons';
import {
  WALL_RACKS, CENTER_RACKS, rackMatches, rackLabel, vintageNumber,
  buildGroups, sortGroups, groupKeyOf,
} from './lib/wine';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

const COMMON_RACKS = [
  ...Array.from({ length: 27 }, (_, i) => `${i + 1}번랙`),
  '중앙랙(1번줄)', '중앙랙(2번줄)', '중앙랙(3번줄)', '중앙랙(4번줄)', '중앙랙(5번줄)', '중앙랙(6번줄)',
  '1번랙(천장)', '4,7번랙(천장)', '샴페인박스(1)', '샴페인박스(2)', '나라셀러박스', '삼도빌딩박스', '직접입력'
];

const MASTER_WINE_DICTIONARY = {
  '필립 파칼레 샹볼 뮈지니 1등급 "레 상티에"': 'Philippe Pacalet Chambolle-Musigny 1er Cru Les Sentiers',
  '샤또 레 까름 오 브리옹': 'Château Les Carmes Haut-Brion',
  '(OT) 앙리 부아요 슈발리에 몽라세 그랑 크뤼 블랑': 'Domaine Henri Boillot Chevalier-Montrachet Grand Cru Blanc',
  '(OT) 앙리 부아요 슈발리에 몽라셰 그랑 크뤼 블랑': 'Domaine Henri Boillot Chevalier-Montrachet Grand Cru Blanc',
  '마세토 (토스카나)': 'Tenuta dell\'Ornellaia Masseto',
  '(OT) 도멘 꼬쉬 뒤리 퓔리니 몽라세 레 앙세니에르': "Domaine Coche-Dury Puligny-Montrachet 'Les Enseignères'",
  '(OT) 도멘 꼬쉬 뒤리 퓔리니 몽라셰 레 앙세니에르': "Domaine Coche-Dury Puligny-Montrachet 'Les Enseignères'",
  '그르기치 힐스 욘트빌 올드 바인 까베르네 소비뇽': 'Grgich Hills Estate Yountville Old Vine Cabernet Sauvignon',
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
  '토브렉, 런릭': 'Torbreck RunRig Shiraz',
  '토브렉, 레어드 1500ml': 'Torbreck The Laird 1.5L',
  '우드커터스 쉬라즈': "Torbreck Woodcutter's Shiraz",
  '힐 오브 그레이스 쉬라즈': 'Henschke Hill of Grace Shiraz',
  '펠릭스 카예호, 셀렉시온 데 비녜도스 데 라 파밀리아': 'Bodegas Félix Callejo Selección de Viñedos de la Familia',
  '발부에나': 'Vega Sicilia Valbuena 5°',
  '우니코': 'Vega Sicilia Único',
  '토마스 에스테반': 'Tomás Esteban Ribera del Duero',
  '삔띠아': 'Pintia (Vega Sicilia) Toro',
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
  '비네도 차드윅': 'Viñedo Chadwick Cabernet Sauvignon',
  'Almaviva 알마비바': 'Viña Almaviva',
  '세냐': 'Seña (Chadwick & Mondavi)',
  '테일러스 빈티지 포트': "Taylor Fladgate Vintage Port",
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
    if (!file) return reject(new Error('파일이 선택되지 않았습니다.'));

    let objectUrl;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch (e) {
      return reject(new Error('파일을 읽을 수 없습니다.'));
    }

    const img = new Image();
    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 450;
        const MAX_HEIGHT = 450;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.68);
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지 디코딩에 실패했습니다.'));
    };

    img.src = objectUrl;
  });
}

function mapFromDb(row, existingWine = null) {
  const kName = row.name || '';
  const dictName = getWineEnglishName(kName);
  
  const isLegacy = row.english_name && (row.english_name.endsWith('Wine') || /[가-힣]/.test(row.english_name));
  const enName = (!row.english_name || isLegacy) ? (dictName || '') : row.english_name.trim();

  const image = row.custom_image || (existingWine ? existingWine.customImage : null);

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
    customImage: image,
  };
}

export default function App({ member }) {
  const isAdmin = member.role === 'admin';
  const [loadError, setLoadError] = useState('');
  const [logFilter, setLogFilter] = useState('');
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [undoing, setUndoing] = useState(null);
  const [stockData, setStockData] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRack, setSelectedRack] = useState('전체');
  const [selectedCountry, setSelectedCountry] = useState('전체');
  const [vintageFrom, setVintageFrom] = useState('');
  const [vintageTo, setVintageTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [sortBy, setSortBy] = useState('rack');
  const [selection, setSelection] = useState(null); // { key, rowId }
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTerm, setPickerTerm] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toast, setToast] = useState('');
  const isWide = useMediaQuery('(min-width: 1280px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const fileInputRef = useRef(null);
  const toastTimer = useRef(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [zoomedWine, setZoomedWine] = useState(null);
  const [editingImageWine, setEditingImageWine] = useState(null);
  const [inputImageUrl, setInputImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  const [editingRackWine, setEditingRackWine] = useState(null);
  const [newSelectedRack, setNewSelectedRack] = useState('1번랙');
  const [customNewRack, setCustomNewRack] = useState('');

  const [editingEnglishWine, setEditingEnglishWine] = useState(null);
  const [inputEnglishName, setInputEnglishName] = useState('');

  const [editingNoteWine, setEditingNoteWine] = useState(null);
  const [inputNote, setInputNote] = useState('');

  const [editingVintageWine, setEditingVintageWine] = useState(null);
  const [inputVintage, setInputVintage] = useState('');

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
      const { data: dbLogs, error: logsError } = await supabase.from('wine_logs').select('*').order('created_at', { ascending: false }).order('log_id').limit(100);

      if (logsError) setLoadError('변경 이력을 불러오지 못했어요. 새로고침해 주세요.');
      if (error) setLoadError('재고를 불러오지 못했어요. 연결을 확인하고 새로고침해 주세요.');
      if (dbLogs) {
        setHasMoreLogs(dbLogs.length === 100);
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
          reason: l.reason,
          actorName: l.actor_name || '로그인 도입 전',
          canUndo: !!l.before_data && !!l.after_data,
          undoOf: l.undo_of
        })));
      }

      if (dbWines && dbWines.length > 0) {
        setStockData(dbWines.map(r => mapFromDb(r)));
      } else {
        setStockData([]);
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
          setStockData(prev => prev.map(item => {
            if (item.id === Number(payload.new.id)) {
              return mapFromDb(payload.new, item);
            }
            return item;
          }));
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
          reason: l.reason,
          actorName: l.actor_name || '로그인 도입 전',
          canUndo: !!l.before_data && !!l.after_data,
          undoOf: l.undo_of
        }, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadOlderLogs = async () => {
    if (loadingLogs) return;
    setLoadingLogs(true);
    try {
      const limit = historyLogs.length + 100;
      const all = [];
      for (let from = 0; from < limit; from += 500) {
        const { data, error } = await supabase.from('wine_logs').select('*').order('created_at', { ascending: false }).order('log_id').range(from, Math.min(from + 499, limit - 1));
        if (error) throw error;
        all.push(...data);
        if (data.length < Math.min(500, limit - from)) break;
      }
      setHasMoreLogs(all.length === limit);
      setHistoryLogs(all.map(l => ({ logId:l.log_id,time:l.time,wineId:Number(l.wine_id),name:l.name,vintage:l.vintage,rack:l.rack,country:l.country,changeType:l.change_type,delta:l.delta,prevQty:l.prev_qty,newQty:l.new_qty,reason:l.reason,actorName:l.actor_name || '로그인 도입 전',canUndo:!!l.before_data && !!l.after_data,undoOf:l.undo_of })));
    } catch { alert('이전 기록을 불러오지 못했어요. 다시 시도해 주세요.'); }
    finally { setLoadingLogs(false); }
  };

  // 입고(+)/출고(-) 기록. 성공하면 true를 돌려줍니다.
  const handleQtyChange = async (id, delta, reason = '수동 조정') => {
    if (!Number.isInteger(delta) || !delta) return false;
    const { data, error } = await supabase.rpc('change_wine_quantity', { p_wine_id: id, p_delta: delta, p_reason: reason });
    if (error) {
      alert(error.message || '저장하지 못했어요. 다시 시도해 주세요.');
      return false;
    }
    setStockData(prev => prev.map(w => w.id === id ? mapFromDb(data) : w));
    return true;
  };

  const handleRecord = async (row, type, qty, purpose, detail) => {
    const label = type === 'out' ? '출고' : '입고';
    const reason = [label, purpose, detail].filter(Boolean).join(' · ');
    const ok = await handleQtyChange(row.id, type === 'out' ? -qty : qty, reason);
    if (ok) showToast(`${row.name} ${row.vintage} · ${label} ${qty}병 기록됨`);
    return ok;
  };

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  };

  const handleSaveRackChange = async () => {
    if (!editingRackWine) return;
    const finalRack = newSelectedRack === '직접입력' ? (customNewRack.trim() || '미지정') : newSelectedRack;
    const prevRack = editingRackWine.rack;
    if (prevRack === finalRack) {
      setEditingRackWine(null);
      return;
    }

    const { error: rackError } = await supabase.from('wines').update({ rack: finalRack }).eq('id', editingRackWine.id);
    if (rackError) { alert(rackError.message); return; }

    setEditingRackWine(null);
    setCustomNewRack('');
  };

  const handleSaveEnglishName = async () => {
    if (!editingEnglishWine) return;
    const targetId = editingEnglishWine.id;
    // 같은 와인의 다른 빈티지에도 함께 적용 (빈티지별로 묶어 보여주기 때문)
    const targetIds = editingEnglishWine.groupIds && editingEnglishWine.groupIds.length
      ? editingEnglishWine.groupIds
      : [targetId];
    const trimmed = inputEnglishName.trim();

    const { error } = await supabase.from('wines').update({ english_name: trimmed }).in('id', targetIds);
    if (error) { alert(error.message); return; }

    setStockData(prev => prev.map(w => targetIds.includes(w.id) ? { ...w, englishName: trimmed } : w));
    if (zoomedWine && targetIds.includes(zoomedWine.id)) {
      setZoomedWine(prev => ({ ...prev, englishName: trimmed }));
    }

    setEditingEnglishWine(null);
    setInputEnglishName('');

  };

  const handleSaveNote = async () => {
    if (!editingNoteWine) return;
    const targetId = editingNoteWine.id;
    const trimmed = inputNote.trim();
    const prevNote = editingNoteWine.note || '';
    if (prevNote === trimmed) {
      setEditingNoteWine(null);
      return;
    }

    const { error } = await supabase.from('wines').update({ note: trimmed }).eq('id', targetId);
    if (error) { alert(error.message); return; }

    setStockData(prev => prev.map(w => w.id === targetId ? { ...w, note: trimmed } : w));
    if (zoomedWine && zoomedWine.id === targetId) {
      setZoomedWine(prev => ({ ...prev, note: trimmed }));
    }

    setEditingNoteWine(null);
    setInputNote('');

  };

  const handleSaveVintage = async () => {
    if (!editingVintageWine) return;
    const targetId = editingVintageWine.id;
    const trimmed = inputVintage.trim() || 'NV';
    const prevVintage = editingVintageWine.vintage || 'NV';
    if (prevVintage === trimmed) {
      setEditingVintageWine(null);
      return;
    }

    const { error } = await supabase.from('wines').update({ vintage: trimmed }).eq('id', targetId);
    if (error) { alert(error.message); return; }

    setStockData(prev => prev.map(w => w.id === targetId ? { ...w, vintage: trimmed } : w));
    if (zoomedWine && zoomedWine.id === targetId) {
      setZoomedWine(prev => ({ ...prev, vintage: trimmed }));
    }

    setEditingVintageWine(null);
    setInputVintage('');

  };

  const handleAddNewWine = async (e) => {
    e.preventDefault();
    if (!newWineForm.name.trim()) return;

    const targetRack = newWineForm.rack === '직접입력' 
      ? (newWineForm.customRack.trim() || '미지정') 
      : newWineForm.rack;
    
    // Separate simultaneous additions without depending on another client's snapshot.
    const newWineId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
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

    const { error: addError } = await supabase.from('wines').insert([newWineDb]);
    if (addError) { alert('등록하지 못했어요: ' + addError.message); return; }

    setNewWineForm({ country: '프랑스', name: '', englishName: '', vintage: 'NV', rack: '1번랙', customRack: '', qty: 1, note: '' });
    setShowAddModal(false);
  };

  const handleSaveImage = async (imgData) => {
    if (!editingImageWine) return;
    const targetId = editingImageWine.id;

    setStockData(prev => prev.map(item => item.id === targetId ? { ...item, customImage: imgData } : item));
    setZoomedWine(prev => (prev && prev.id === targetId ? { ...prev, customImage: imgData } : prev));
    
    setEditingImageWine(null);
    setInputImageUrl('');

    try {
      const { error } = await supabase
        .from('wines')
        .update({ custom_image: imgData })
        .eq('id', targetId);

      if (error) {
        console.error('사진 클라우드 저장 실패:', error);
        alert(`사진 저장에 실패했습니다: ${error.message}`);
      }
    } catch (err) {
      console.error('사진 저장 예외 발생:', err);
      alert('네트워크 연결 문제로 사진 저장에 실패했습니다.');
    }
  };

  const handleImageFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const compressedDataUrl = await compressImageFile(file);
      await handleSaveImage(compressedDataUrl);
    } catch (err) {
      console.error('이미지 처리 오류:', err);
      alert('사진을 처리하지 못했습니다: ' + (err.message || '지원되지 않는 이미지 형식이거나 용량이 너무 큽니다.'));
    } finally {
      setIsUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleUndo = async (log) => {
    if (undoing || !window.confirm('이 변경을 되돌릴까요? 원래 기록은 보존되고 내 이름으로 되돌리기 기록이 추가됩니다.')) return;
    setUndoing(log.logId);
    try {
      const { error } = await supabase.rpc('undo_wine_change', { p_log_id: log.logId });
      if (error) alert(error.message);
      else showToast('변경을 되돌리고 이력을 추가했어요.');
    } finally { setUndoing(null); }
  };

  // 초기화는 화면 안의 확인 창(showResetConfirm)에서 한 번 더 확인한 뒤 실행됩니다.
  const handleResetToDefault = async () => {
    if (!isAdmin) { alert('전체 초기화는 관리자만 할 수 있어요.'); return; }
    setShowResetConfirm(false);
    setLoading(true);
    try {
      const res = await fetch('/wine_data.xlsx');
      if (!res.ok) {
        alert('서버에 기본 파일이 없습니다. [새 파일] 버튼을 눌러 소장하고 계신 엑셀 파일을 업로드해 주세요!');
        setLoading(false);
        return;
      }
      const ab = await res.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const sheetName = wb.SheetNames.includes('와인재고현황') ? '와인재고현황' : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

      let headerIdx = rawData.findIndex(r => Array.isArray(r) && r.some(cell => String(cell || '').includes('와인')));
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

      const { error: deleteError } = await supabase.from('wines').delete().neq('id', 0);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from('wines').insert(defaultList);
      if (insertError) throw insertError;
      setStockData(defaultList.map(r => mapFromDb(r)));
      // Audit history is retained across inventory resets.
      alert('기본 데이터 복구가 완료되었습니다.');
    } catch (err) {
      console.error('초기화 실패:', err);
      alert('초기화 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // [핵심 해결] ArrayBuffer 기반 초고속 안전 엑셀 파싱 및 컬럼 자동 매핑
  const handleFileUpload = async (e) => {
    if (!isAdmin) { alert('엑셀 일괄 변경은 관리자만 할 수 있어요.'); return; }
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames.includes('와인재고현황') ? '와인재고현황' : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rawData || rawData.length === 0) {
          alert('엑셀 파일에 데이터가 없습니다.');
          setLoading(false);
          return;
        }

        // 헤더 행 자동 감지 (어떤 형태든 '와인' 글자가 들어간 행을 헤더로 식별)
        let headerIdx = rawData.findIndex(r => 
          Array.isArray(r) && r.some(cell => {
            const str = String(cell || '').trim();
            return str.includes('와인명') || str.includes('와인이름') || str.includes('상품명');
          })
        );
        if (headerIdx === -1) headerIdx = 0;

        const headerRow = rawData[headerIdx] || [];
        const findCol = (keywords, defaultIdx) => {
          const idx = headerRow.findIndex(cell => {
            const str = String(cell || '').trim();
            return keywords.some(k => str.includes(k));
          });
          return idx !== -1 ? idx : defaultIdx;
        };

        const colCountry = findCol(['원산지', '국가', '생산국'], 0);
        const colName = findCol(['와인명', '와인이름', '상품명', '한글명'], 1);
        const colVintage = findCol(['빈티지', 'vintage', '연도'], 2);
        const colRack = findCol(['보관위치', '위치', '랙', 'rack'], 3);
        const colInQty = findCol(['총 입고량', '입고량', '입고'], 4);
        const colOutQty = findCol(['총 출고량', '출고량', '출고'], 5);
        const colCurrentQty = findCol(['현재고', '재고', '수량'], 6);
        const colNote = findCol(['비고', '메모'], 8);
        const colImage = findCol(['이미지', '사진', 'image'], 9);
        const colEnglish = findCol(['영문명', '영문', 'english'], 10);

        const rows = rawData.slice(headerIdx + 1);
        const excelRows = rows
          .filter(r => r && r[colName] && String(r[colName]).trim() !== '' && !String(r[colName]).includes('와인명'))
          .map((r) => ({
            country: String(r[colCountry] || '기타').trim(),
            name: String(r[colName] || '').trim(),
            vintage: String(r[colVintage] || 'NV').trim(),
            rack: String(r[colRack] || '미지정').trim(),
            inQty: Number(r[colInQty]) || Number(r[colCurrentQty]) || 0,
            outQty: Number(r[colOutQty]) || 0,
            currentQty: Number(r[colCurrentQty]) || 0,
            note: String(r[colNote] || '').trim(),
            customImage: r[colImage] ? String(r[colImage]).trim() : null,
            englishName: r[colEnglish] ? String(r[colEnglish]).trim() : null
          }));

        if (excelRows.length === 0) {
          alert('유효한 와인 행을 찾지 못했습니다. 엑셀 파일 형식을 확인해 주세요.');
          setLoading(false);
          return;
        }

        // 화면 목록(stockData)이 비어 있거나 오래됐을 수 있으므로, 서버의 현재 데이터와 직접 맞춰 봅니다.
        // (목록이 비어 있을 때 올리면 모든 와인이 새로 추가돼 중복이 생기던 문제 방지)
        const { data: freshDb, error: freshErr } = await supabase.from('wines').select('*');
        const baseRows = !freshErr && Array.isArray(freshDb) ? freshDb.map(r => mapFromDb(r)) : stockData;

        const matchedWebIds = new Set();
        const excelWithMatch = [];

        // 같은 항목이 서버에 여러 개(중복)일 때는 사진·메모가 있거나 엑셀 수량과 같은 쪽을 남깁니다.
        const pickBest = (cands, excelItem) => cands.sort((a, b) => {
          const score = (w) => (w.customImage ? 4 : 0) + (w.note ? 2 : 0) + (w.currentQty === excelItem.currentQty ? 1 : 0);
          return score(b) - score(a) || a.id - b.id;
        })[0];

        excelRows.forEach((excelItem) => {
          const exactMatch = pickBest(baseRows.filter(
            w => !matchedWebIds.has(w.id) &&
                 w.name === excelItem.name &&
                 w.vintage === excelItem.vintage &&
                 w.rack === excelItem.rack
          ), excelItem);
          if (exactMatch) {
            matchedWebIds.add(exactMatch.id);
            excelWithMatch.push({ excelItem, match: exactMatch });
          } else {
            excelWithMatch.push({ excelItem, match: null });
          }
        });

        excelWithMatch.forEach((item) => {
          if (!item.match) {
            const looseMatch = pickBest(baseRows.filter(
              w => !matchedWebIds.has(w.id) &&
                   w.name === item.excelItem.name &&
                   w.vintage === item.excelItem.vintage
            ), item.excelItem);
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

        // 엑셀과 짝이 맞지 않은 서버 항목: 엑셀에 같은 와인·빈티지가 있으면 '중복', 없으면 '엑셀에 없음'
        const excelKeys = new Set(excelRows.map(x => `${x.name}__${x.vintage}`));
        const unmatched = baseRows.filter(w => !matchedWebIds.has(w.id));
        const dupRows = unmatched.filter(w => excelKeys.has(`${w.name}__${w.vintage}`));
        const missingRows = unmatched.filter(w => !excelKeys.has(`${w.name}__${w.vintage}`));
        const newCount = excelWithMatch.filter(x => !x.match).length;

        if (diffs.length > 0 || unmatched.length > 0) {
          setDiffModalData({
            excelWithMatch, diffs, dupRows, missingRows, newCount,
            excelCount: excelRows.length,
            excelBottles: excelRows.reduce((sum, x) => sum + (x.currentQty || 0), 0),
            serverCount: baseRows.length,
            serverBottles: baseRows.reduce((sum, x) => sum + (x.currentQty || 0), 0),
          });
          setLoading(false);
        } else {
          executeSmartMerge(excelWithMatch, `총 ${excelRows.length}개 와인이 안전하게 업로드 반영되었습니다!`);
        }
      } catch (err) {
        console.error('엑셀 분석 실패:', err);
        alert('엑셀 파일을 읽는 중 오류가 발생했습니다: ' + (err.message || ''));
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // [핵심 해결] ID 오버플로우 방지 순차 정수 ID + 배치 Upsert
  // deleteIds: 엑셀 기준으로 맞출 때 지울 서버 항목, keepRows: 지우지 않고 남겨 둘 항목
  const executeSmartMerge = async (excelWithMatchList, successMessage = "엑셀 데이터가 안전하게 병합 반영되었습니다.", { deleteIds = [], keepRows = [] } = {}) => {
    setLoading(true);
    try {
      const { data: currentDbWines } = await supabase.from('wines').select('id, name, vintage, rack, custom_image, note, english_name');
      
      const photoStore = new Map();
      const noteStore = new Map();
      const englishStore = new Map();

      (currentDbWines || []).concat(stockData).forEach(w => {
        if (w.custom_image || w.customImage) {
          const img = w.custom_image || w.customImage;
          photoStore.set(`${w.name}__${w.vintage}__${w.rack}`, img);
          photoStore.set(`${w.name}__${w.vintage}`, img);
          photoStore.set(w.name, img);
        }
        if (w.note) noteStore.set(`${w.name}__${w.vintage}__${w.rack}`, w.note);
        if (w.english_name || w.englishName) englishStore.set(w.name, w.english_name || w.englishName);
      });

      // 10만 이하의 안전한 기존 최대 정수 ID 탐색
      let maxId = 0;
      stockData.forEach(w => {
        if (typeof w.id === 'number' && w.id < 1000000 && w.id > maxId) maxId = w.id;
      });
      (currentDbWines || []).forEach(w => {
        const num = Number(w.id);
        if (!isNaN(num) && num < 1000000 && num > maxId) maxId = num;
      });

      const usedIds = new Set();
      const safeMergedList = excelWithMatchList.map(({ excelItem, match }) => {
        let rowId;
        if (match && match.id && Number(match.id) < 1000000 && !usedIds.has(Number(match.id))) {
          rowId = Number(match.id);
        } else {
          maxId += 1;
          rowId = maxId;
        }
        usedIds.add(rowId);

        const preservedPhoto = excelItem.customImage ||
                               (match && match.customImage) ||
                               photoStore.get(`${excelItem.name}__${excelItem.vintage}__${excelItem.rack}`) ||
                               photoStore.get(`${excelItem.name}__${excelItem.vintage}`) ||
                               photoStore.get(excelItem.name) ||
                               null;

        const preservedEnglish = excelItem.englishName ||
                                (match && match.englishName) ||
                                englishStore.get(excelItem.name) ||
                                getWineEnglishName(excelItem.name);

        const preservedNote = excelItem.note !== '' ? excelItem.note :
                              (match && match.note ? match.note :
                              noteStore.get(`${excelItem.name}__${excelItem.vintage}__${excelItem.rack}`) || '');

        return {
          id: rowId,
          country: excelItem.country,
          name: excelItem.name,
          english_name: preservedEnglish,
          vintage: excelItem.vintage,
          rack: excelItem.rack,
          in_qty: match ? match.inQty : (excelItem.inQty || excelItem.currentQty),
          out_qty: match ? match.outQty : (excelItem.outQty || 0),
          current_qty: excelItem.currentQty,
          status: excelItem.currentQty <= 0 ? '재고없음' : '정상',
          note: preservedNote,
          custom_image: preservedPhoto,
        };
      });

      // 100개씩 안전 배치 upsert
      const BATCH_SIZE = 100;
      for (let i = 0; i < safeMergedList.length; i += BATCH_SIZE) {
        const batch = safeMergedList.slice(i, i + BATCH_SIZE);
        const { error: batchErr } = await supabase.from('wines').upsert(batch, { onConflict: 'id' });
        if (batchErr) throw batchErr;
      }

      // 엑셀 기준으로 맞추기: 중복 등 선택한 항목 삭제 (100개씩)
      for (let i = 0; i < deleteIds.length; i += BATCH_SIZE) {
        const batch = deleteIds.slice(i, i + BATCH_SIZE);
        const { error: delErr } = await supabase.from('wines').delete().in('id', batch);
        if (delErr) throw delErr;
      }

      setStockData([...safeMergedList.map(r => mapFromDb(r)), ...keepRows]);
      setDiffModalData(null);
      alert(successMessage);
    } catch (err) {
      console.error('스마트 병합 실패:', err);
      alert('병합 처리 중 오류가 발생했습니다: ' + (err.message || ''));
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
      ['변경 이력 (현재 불러온 기록)'],
      ['날짜/일시', '수정자', '구분', '원산지', '와인명', '빈티지', '보관위치', '수량', '변경 전 재고', '변경 후 재고', '사유']
    ];
    historyLogs.forEach(l => {
      ledgerSheetData.push([l.time, l.actorName, l.changeType, l.country, l.name, l.vintage, l.rack, Math.abs(l.delta), l.prevQty, l.newQty, l.reason]);
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
    return unique
      .filter(r => !WALL_RACKS.includes(r) && !CENTER_RACKS.includes(r))
      .sort((a, b) => (rackCountMap[b] || 0) - (rackCountMap[a] || 0));
  }, [stockData, rackCountMap]);

  const countryList = useMemo(() => {
    const unique = Array.from(new Set(stockData.map(item => item.country))).filter(Boolean);
    return ['전체', ...unique];
  }, [stockData]);

  const vintageOptions = useMemo(() => {
    const nums = stockData.map(item => vintageNumber(item.vintage)).filter(v => v !== null);
    return Array.from(new Set(nums)).sort((a, b) => a - b);
  }, [stockData]);

  // 같은 와인·빈티지·위치가 두 번 이상 등록된 행 (엑셀 업로드가 겹쳐 생긴 중복)
  const { dupIds, dupSets, dupExtraBottles } = useMemo(() => {
    const byKey = new Map();
    stockData.forEach(r => {
      const k = `${r.name}__${r.vintage}__${r.rack}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(r);
    });
    const ids = new Set();
    let sets = 0;
    let extra = 0;
    byKey.forEach(list => {
      if (list.length < 2) return;
      sets += 1;
      list.forEach(r => ids.add(r.id));
      const qtys = list.map(r => r.currentQty || 0).sort((a, b) => b - a);
      extra += qtys.slice(1).reduce((s2, q) => s2 + q, 0);
    });
    return { dupIds: ids, dupSets: sets, dupExtraBottles: extra };
  }, [stockData]);

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const from = vintageFrom === '' ? null : Number(vintageFrom);
    const to = vintageTo === '' ? null : Number(vintageTo);
    return stockData.filter(item => {
      const matchSearch = !term ||
        item.name.toLowerCase().includes(term) ||
        (item.englishName && item.englishName.toLowerCase().includes(term)) ||
        String(item.vintage).toLowerCase().includes(term) ||
        (item.note && item.note.toLowerCase().includes(term)) ||
        (item.rack && item.rack.toLowerCase().includes(term));
      const matchRack = rackMatches(item.rack, selectedRack);
      const matchCountry = selectedCountry === '전체' || item.country === selectedCountry;
      let matchVintage = true;
      if (from !== null || to !== null) {
        const v = vintageNumber(item.vintage);
        matchVintage = v !== null && (from === null || v >= from) && (to === null || v <= to);
      }
      const matchStatus =
        statusFilter === '전체' ? true :
        statusFilter === '재고있음' ? item.currentQty > 0 :
        statusFilter === '품절' ? item.currentQty === 0 :
        (item.currentQty < 0 || dupIds.has(item.id));
      return matchSearch && matchRack && matchCountry && matchVintage && matchStatus;
    });
  }, [stockData, searchTerm, selectedRack, selectedCountry, vintageFrom, vintageTo, statusFilter, dupIds]);

  const allGroups = useMemo(() => buildGroups(stockData), [stockData]);
  const groups = useMemo(() => sortGroups(buildGroups(filteredData), sortBy), [filteredData, sortBy]);
  const filteredBottles = useMemo(() => filteredData.reduce((s, r) => s + (r.currentQty || 0), 0), [filteredData]);
  const errorRows = useMemo(() => stockData.filter(i => i.currentQty < 0), [stockData]);

  const stats = useMemo(() => ({
    totalBottles: stockData.reduce((acc, cur) => acc + cur.currentQty, 0),
    wineCount: allGroups.length,
    rowCount: stockData.length,
    outOfStockCount: stockData.filter(i => i.currentQty === 0).length,
    errorCount: errorRows.length,
    checkCount: errorRows.length + dupSets,
  }), [stockData, allGroups, errorRows, dupSets]);

  const pickerGroups = useMemo(() => {
    const term = pickerTerm.trim().toLowerCase();
    const list = term
      ? allGroups.filter(g => g.name.toLowerCase().includes(term) || g.englishName.toLowerCase().includes(term) || g.rows.some(r => r.name.toLowerCase().includes(term)))
      : allGroups;
    return sortGroups(list, 'name').slice(0, 60);
  }, [allGroups, pickerTerm]);

  const selectedGroup = selection ? allGroups.find(g => g.key === selection.key) || null : null;

  // 영문명을 바꾸면 그룹 키가 바뀌므로 선택을 따라가게 함
  useEffect(() => {
    if (!selection || selectedGroup) return;
    const row = stockData.find(r => r.id === selection.rowId);
    if (row) setSelection({ key: groupKeyOf(row), rowId: row.id });
    else setSelection(null);
  }, [selection, selectedGroup, stockData]);

  // PC: "/" 키로 검색창 이동
  const searchRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.target.closest('input, textarea, select')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openWine = (group, rowId) => setSelection({ key: group.key, rowId });
  const openRow = (row) => setSelection({ key: groupKeyOf(row), rowId: row.id });
  const closeWine = () => setSelection(null);
  const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const anyFilter = searchTerm.trim() !== '' || selectedRack !== '전체' || selectedCountry !== '전체' || vintageFrom !== '' || vintageTo !== '' || statusFilter !== '전체';
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedRack('전체');
    setSelectedCountry('전체');
    setVintageFrom('');
    setVintageTo('');
    setStatusFilter('전체');
  };
  const toggleStatus = (value) => {
    setStatusFilter(prev => (prev === value ? '전체' : value));
    scrollToId('wine-list');
  };

  const openEditRack = (row) => { setEditingRackWine(row); setNewSelectedRack(row.rack); };
  const openEditVintage = (row) => { setEditingVintageWine(row); setInputVintage(row.vintage || ''); };
  const openEditNote = (row) => { setEditingNoteWine(row); setInputNote(row.note || ''); };
  const openEditEnglish = (row) => {
    const group = allGroups.find(g => g.key === groupKeyOf(row));
    setEditingEnglishWine({ ...row, groupIds: group ? group.rows.map(r => r.id) : [row.id] });
    setInputEnglishName(row.englishName || '');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Wine className="w-10 h-10 text-wine animate-pulse" />
        <p className="text-sm font-medium">와인 재고를 불러오는 중…</p>
      </div>
    );
  }

  const panel = selectedGroup ? (
    <RecordPanel
      key={selectedGroup.key}
      group={selectedGroup}
      selectedRowId={selection.rowId}
      onSelectRow={(rowId) => setSelection(s => ({ ...s, rowId }))}
      historyLogs={historyLogs}
      onRecord={handleRecord}
      onClose={closeWine}
      onEditRack={openEditRack}
      onEditVintage={openEditVintage}
      onEditNote={openEditNote}
      onEditEnglish={openEditEnglish}
      onEditImage={(row) => setEditingImageWine(row)}
      onZoom={(row) => setZoomedWine(row)}
    />
  ) : null;

  const navItem = 'w-full h-10 rounded-xl flex items-center gap-2.5 px-3 text-[13.5px] text-slate-300 hover:bg-slate-850 hover:text-slate-100 transition';
  const badge = 'ml-auto text-[11px] rounded-full px-2 leading-[18px] tabular';

  const kpis = [
    {
      label: '총 보관',
      value: stats.totalBottles.toLocaleString(),
      unit: '병',
      sub: dupSets > 0 ? `중복 제외 시 약 ${(stats.totalBottles - dupExtraBottles).toLocaleString()}병` : `${stats.rowCount}개 항목`,
    },
    { label: '와인', value: stats.wineCount, unit: '종', sub: '빈티지 묶음 기준' },
    { label: '품절', value: stats.outOfStockCount, unit: '건', tone: 'warn', filter: '품절' },
    { label: '점검 필요', value: stats.checkCount, unit: '건', tone: stats.checkCount > 0 ? 'error' : 'none', filter: '오류' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans lg:grid lg:grid-cols-[216px_minmax(0,1fr)] xl:grid-cols-[216px_minmax(0,1fr)_400px]">
      {loadError && <div role="alert" className="fixed z-50 top-12 left-4 right-4 bg-red-950 text-red-200 p-4 rounded-xl">{loadError}</div>}
      <input ref={fileInputRef} type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />

      {/* ───────── PC 사이드바 ───────── */}
      <aside className="hidden lg:flex flex-col sticky top-0 h-screen border-r border-slate-750 bg-[#120f13] px-3 py-5">
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <div className="w-9 h-9 rounded-xl bg-wine/15 border border-wine/35 grid place-items-center text-wine-light">
            <Wine className="w-[18px] h-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold leading-tight">2층 와인창고</div>
            <div className="text-[11.5px] text-slate-400">서울석유</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5" aria-label="메뉴">
          <button type="button" className={`${navItem} bg-slate-850 text-slate-100 font-semibold`} onClick={() => { setStatusFilter('전체'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <ListIcon className="w-[17px] h-[17px]" /> 재고 목록
            <span className={`${badge} bg-slate-800 text-slate-400`}>{stats.wineCount}</span>
          </button>
          <button type="button" className={navItem} onClick={() => scrollToId('rack-map')}>
            <Grid3X3 className="w-[17px] h-[17px]" /> 랙 맵
          </button>
          <button type="button" className={navItem} onClick={() => setShowLogModal(true)}>
            <History className="w-[17px] h-[17px]" /> 입출고 이력
            {historyLogs.length > 0 && <span className={`${badge} bg-amber-500 text-gold-dark font-bold`}>{historyLogs.length}</span>}
          </button>
          <button type="button" className={navItem} onClick={() => toggleStatus('오류')}>
            <AlertTriangle className="w-[17px] h-[17px]" /> 점검 필요
            {stats.checkCount > 0 && <span className={`${badge} bg-red-400 text-red-950 font-bold`}>{stats.checkCount}</span>}
          </button>
        </nav>

        <div className="text-[11px] text-slate-500 px-3 pt-6 pb-1.5">데이터 관리</div>
        <nav className="flex flex-col gap-0.5" aria-label="데이터 관리">
          <button type="button" className={navItem} onClick={() => setShowAddModal(true)}>
            <Plus className="w-[17px] h-[17px]" /> 와인 추가
          </button>
          <button type="button" className={navItem} onClick={handleDownloadExcel}>
            <Download className="w-[17px] h-[17px]" /> 엑셀 다운로드
          </button>
          <button type="button" className={navItem} onClick={() => isAdmin ? fileInputRef.current?.click() : alert('엑셀 일괄 변경은 관리자만 할 수 있어요.')}>
            <Upload className="w-[17px] h-[17px]" /> 새 엑셀 올리기
          </button>
        </nav>
        <button
          type="button"
          onClick={() => { if (isAdmin) setShowResetConfirm(true); else alert('전체 초기화는 관리자만 할 수 있어요.'); }}
          className="mt-2 h-10 rounded-xl border border-dashed border-red-400/35 flex items-center gap-2.5 px-3 text-[13px] text-red-300 hover:bg-red-400/10 transition"
        >
          <RotateCcw className="w-4 h-4" /> 초기화
          <span className="ml-auto text-[10.5px] text-slate-500">확인 후 실행</span>
        </button>

        <div className="mt-auto pt-3 border-t border-slate-750 flex items-center gap-2 text-[11.5px] text-slate-400 px-2">
          <span className="w-[7px] h-[7px] rounded-full bg-emerald-400" /> 실시간 동기화 중
        </div>
      </aside>

      {/* ───────── 가운데 본문 ───────── */}
      <div className="min-w-0">
        {/* 모바일 헤더 */}
        <header className="lg:hidden sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-850 px-4 pb-2.5 pt-[max(10px,env(safe-area-inset-top))] flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-wine/15 border border-wine/35 grid place-items-center text-wine-light shrink-0">
            <Wine className="w-[18px] h-[18px]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-bold leading-tight tracking-tight truncate">2층 와인창고</h1>
            <p className="text-[11.5px] text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> 실시간 동기화 중
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMoreMenu(true)}
            aria-label="더보기 메뉴"
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-750 grid place-items-center text-slate-300"
          >
            <MoreIcon />
          </button>
        </header>

        <main className="px-4 lg:px-6 pt-3 lg:pt-5 pb-28 lg:pb-10 space-y-3 lg:space-y-4 max-w-[1120px] mx-auto">
          {/* PC 상단: 검색 + 와인 추가 */}
          <div className="hidden lg:flex gap-2.5">
            <label className="flex-1 h-11 rounded-xl bg-slate-900 border border-slate-750 flex items-center gap-2.5 px-3.5 focus-within:border-wine">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                ref={searchRef}
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="와인명(한글/영문) · 빈티지 · 메모 · 위치 검색"
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <kbd className="text-[11px] text-slate-400 border border-slate-700 rounded px-1.5 leading-[18px] font-sans">/</kbd>
            </label>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> 와인 추가
            </button>
          </div>

          {/* 데이터가 비었을 때 안내 */}
          {stockData.length === 0 && (
            <div className="bg-slate-900 border border-wine/40 rounded-2xl p-6 text-center space-y-3">
              <AlertCircle className="w-9 h-9 text-wine-light mx-auto" />
              <h2 className="text-lg font-bold text-white">등록된 와인 데이터가 없어요</h2>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                가지고 계신 최신 재고 엑셀 파일을 올리면 전체 품목이 바로 복구돼요.
              </p>
              <button
                type="button"
                onClick={() => isAdmin ? fileInputRef.current?.click() : alert('엑셀 일괄 변경은 관리자만 할 수 있어요.')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-wine hover:bg-rose-600 text-white rounded-xl text-sm font-bold"
              >
                <Upload className="w-4 h-4" /> 엑셀 파일 올리기
              </button>
            </div>
          )}

          {/* 요약 숫자 */}
          <div className="grid grid-cols-4 gap-2 lg:gap-2.5">
            {kpis.map((k) => {
              const clickable = !!k.filter;
              const active = clickable && statusFilter === k.filter;
              const toneCls =
                k.tone === 'error' ? 'border-red-400/45 bg-red-400/10' :
                active ? 'border-gold/70 bg-gold/10' : 'border-slate-750 bg-slate-900';
              const valueCls = k.tone === 'error' ? 'text-red-400' : k.tone === 'warn' ? 'text-amber-400' : 'text-slate-100';
              const Tag = clickable ? 'button' : 'div';
              return (
                <Tag
                  key={k.label}
                  type={clickable ? 'button' : undefined}
                  onClick={clickable ? () => toggleStatus(k.filter) : undefined}
                  aria-pressed={clickable ? active : undefined}
                  className={`text-left rounded-2xl border px-2.5 py-2 lg:px-4 lg:py-3 ${toneCls} ${clickable ? 'hover:border-slate-500 transition' : ''}`}
                >
                  <div className={`text-[19px] lg:text-2xl font-bold tracking-tight tabular leading-tight ${valueCls}`}>
                    {k.value}<span className="text-[11px] lg:text-xs font-normal text-slate-400 ml-0.5">{k.unit}</span>
                  </div>
                  <div className="text-[11px] lg:text-xs text-slate-400 mt-0.5 truncate">{k.label}</div>
                  {k.sub && <div className="hidden lg:block text-[11px] text-slate-500 truncate">{k.sub}</div>}
                </Tag>
              );
            })}
          </div>

          {/* 중복 등록 경고 */}
          {dupSets > 0 && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-[12.5px] lg:text-[13px]">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 text-slate-200 leading-relaxed">
                <b className="text-amber-200">같은 와인·빈티지·위치가 두 번 등록된 항목이 {dupSets}건</b> 있어요.
                총 보관 숫자가 실제보다 약 {dupExtraBottles.toLocaleString()}병 많게 보일 수 있어요.
              </div>
              <button type="button" onClick={() => toggleStatus('오류')} className="shrink-0 text-amber-200 font-semibold hover:underline">
                목록 ›
              </button>
            </div>
          )}

          {/* 재고 오류 경고 */}
          {errorRows.length > 0 && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-[12.5px] lg:text-[13px]">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-red-200 font-semibold">{errorRows[0].name}</span>
                <span className="text-slate-300"> ({errorRows[0].vintage} · {rackLabel(errorRows[0].rack)}) 현재고 </span>
                <b className="text-red-300 tabular">{errorRows[0].currentQty}병</b>
                {errorRows.length > 1 && <span className="text-slate-400"> 외 {errorRows.length - 1}건</span>}
              </div>
              <button
                type="button"
                onClick={() => { if (errorRows.length > 1) toggleStatus('오류'); openRow(errorRows[0]); }}
                className="shrink-0 text-red-200 font-semibold hover:underline"
              >
                확인 ›
              </button>
            </div>
          )}

          <RackMap
            rackCountMap={rackCountMap}
            specialRacks={specialRacks}
            selectedRack={selectedRack}
            onSelect={(r) => setSelectedRack(r)}
          />

          {/* 모바일 검색 */}
          <label className="lg:hidden h-11 rounded-xl bg-slate-900 border border-slate-750 flex items-center gap-2.5 px-3.5 focus-within:border-wine">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="와인명 · 빈티지 · 메모 검색"
              className="flex-1 bg-transparent text-[15px] text-slate-100 placeholder-slate-500 focus:outline-none"
            />
          </label>

          <div id="wine-list" className="scroll-mt-20 space-y-2.5">
            <FilterBar
              countries={countryList}
              vintages={vintageOptions}
              selectedCountry={selectedCountry}
              onCountry={setSelectedCountry}
              vintageFrom={vintageFrom}
              vintageTo={vintageTo}
              onVintageFrom={setVintageFrom}
              onVintageTo={setVintageTo}
              statusFilter={statusFilter}
              onStatus={setStatusFilter}
              sortBy={sortBy}
              onSort={setSortBy}
              selectedRack={selectedRack}
              onRack={setSelectedRack}
              showSort={!isDesktop}
              resultText={
                <span className="flex items-center gap-2">
                  <span>
                    <b className="text-slate-100 font-semibold">{groups.length}종 · {filteredBottles.toLocaleString()}병</b>
                    {anyFilter ? ' 표시 중' : ' 전체'}
                    <span className="text-slate-500"> · 같은 와인은 빈티지별로 묶음</span>
                  </span>
                  {anyFilter && (
                    <button type="button" onClick={clearFilters} className="ml-auto text-slate-300 underline underline-offset-2 hover:text-white">
                      필터 모두 해제
                    </button>
                  )}
                </span>
              }
            />

            {groups.length === 0 ? (
              <div className="rounded-2xl border border-slate-750 bg-slate-900 px-4 py-10 text-center text-sm text-slate-400">
                조건에 맞는 와인이 없어요.
                {anyFilter && (
                  <button type="button" onClick={clearFilters} className="block mx-auto mt-2 text-slate-200 underline underline-offset-2">
                    필터 모두 해제
                  </button>
                )}
              </div>
            ) : isDesktop ? (
              <GroupTable
                groups={groups}
                onOpen={openWine}
                selectedKey={selection?.key}
                selectedRowId={selection?.rowId}
                sortBy={sortBy}
                onSort={setSortBy}
              />
            ) : (
              <GroupCards groups={groups} onOpen={openWine} selectedKey={selection?.key} selectedRowId={selection?.rowId} />
            )}
          </div>
        </main>
      </div>

      {/* ───────── PC 오른쪽: 선택한 와인 패널 ───────── */}
      <aside className="hidden xl:block sticky top-0 h-screen border-l border-slate-750 bg-[#141115]">
        {isWide && (panel || (
          <div className="h-full flex flex-col px-5 py-5">
            <div className="rounded-2xl border border-dashed border-slate-700 px-5 py-8 text-center">
              <InOutIcon className="w-7 h-7 mx-auto text-slate-500" />
              <p className="mt-3 text-sm text-slate-200 font-semibold">와인을 고르면 여기서 입출고를 기록해요</p>
              <p className="mt-1 text-xs text-slate-400">목록에서 와인이나 빈티지 칩을 눌러 보세요.</p>
            </div>
            <div className="mt-6 text-xs text-slate-400 mb-2">최근 입출고</div>
            <ul className="space-y-1 overflow-y-auto">
              {historyLogs.slice(0, 8).map((l) => {
                const row = stockData.find(r => r.id === l.wineId);
                return (
                  <li key={l.logId}>
                    <button
                      type="button"
                      disabled={!row}
                      onClick={() => row && openRow(row)}
                      className="w-full text-left rounded-xl px-2.5 py-2 hover:bg-slate-850 disabled:hover:bg-transparent"
                    >
                      <div className="flex items-center gap-2 text-[12.5px]">
                        <span className="text-slate-100 truncate">{l.name}</span>
                        <span className="text-gold tabular shrink-0">{l.vintage}</span>
                        <span className="ml-auto text-[11px] text-slate-500 tabular shrink-0">{String(l.time || '').slice(5, 16)}</span>
                      </div>
                      <div className="text-[11.5px] text-slate-400 truncate">{l.actorName} · {l.reason}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </aside>

      {/* ───────── 모바일·태블릿: 아래에서 올라오는 기록 시트 ───────── */}
      {!isWide && selectedGroup && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="입출고 기록">
          <div className="absolute inset-0 bg-black/60" onClick={closeWine} />
          <div className="absolute inset-x-0 bottom-0 top-[7vh] lg:top-0 lg:left-auto lg:w-[420px] bg-[#171318] rounded-t-3xl lg:rounded-none border-t lg:border-t-0 lg:border-l border-slate-700 flex flex-col pb-safe">
            <div className="lg:hidden w-10 h-1.5 rounded-full bg-slate-700 mx-auto mt-2.5 shrink-0" />
            {panel}
          </div>
        </div>
      )}

      {/* ───────── 모바일 하단 탭 ───────── */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-[#120f13]/95 backdrop-blur border-t border-slate-750 pb-safe" aria-label="하단 메뉴">
        <div className="grid grid-cols-5 h-[62px] items-center">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex flex-col items-center gap-1 text-[10.5px] text-slate-100">
            <ListIcon className="w-[22px] h-[22px]" /> 재고
          </button>
          <button type="button" onClick={() => scrollToId('rack-map')} className="flex flex-col items-center gap-1 text-[10.5px] text-slate-500">
            <Grid3X3 className="w-[22px] h-[22px]" /> 랙 맵
          </button>
          <button type="button" onClick={() => { setPickerTerm(''); setShowPicker(true); }} className="flex flex-col items-center -mt-6" aria-label="입출고 기록하기">
            <span className="w-[54px] h-[54px] rounded-[18px] bg-wine grid place-items-center text-white shadow-lg shadow-wine/40">
              <InOutIcon className="w-6 h-6" />
            </span>
            <span className="text-[10.5px] text-rose-200 mt-1">입출고</span>
          </button>
          <button type="button" onClick={() => setShowLogModal(true)} className="flex flex-col items-center gap-1 text-[10.5px] text-slate-500">
            <span className="relative">
              <History className="w-[22px] h-[22px]" />
              {historyLogs.length > 0 && (
                <span className="absolute -top-1.5 -right-3 bg-amber-500 text-gold-dark text-[9px] font-bold rounded-full px-1 leading-[14px] tabular">{historyLogs.length}</span>
              )}
            </span>
            이력
          </button>
          <button type="button" onClick={() => setShowMoreMenu(true)} className="flex flex-col items-center gap-1 text-[10.5px] text-slate-500">
            <MoreIcon className="w-[22px] h-[22px]" /> 더보기
          </button>
        </div>
      </nav>

      {/* ───────── 더보기 메뉴 (모바일) ───────── */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="더보기 메뉴">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowMoreMenu(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-[#171318] rounded-t-3xl border-t border-slate-700 px-4 pt-2.5 pb-safe">
            <div className="w-10 h-1.5 rounded-full bg-slate-700 mx-auto mb-3" />
            <div className="space-y-1 pb-4">
              {[
                { icon: Plus, label: '와인 추가', onClick: () => setShowAddModal(true) },
                { icon: Download, label: '엑셀 다운로드', onClick: handleDownloadExcel },
                { icon: Upload, label: '새 엑셀 올리기', onClick: () => isAdmin ? fileInputRef.current?.click() : alert('엑셀 일괄 변경은 관리자만 할 수 있어요.') },
                { icon: History, label: '입출고 이력', onClick: () => setShowLogModal(true) },
              ].map(({ icon: Icon, label, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setShowMoreMenu(false); onClick(); }}
                  className="w-full h-12 rounded-xl flex items-center gap-3 px-3 text-[15px] text-slate-100 hover:bg-slate-850"
                >
                  <Icon className="w-5 h-5 text-slate-400" /> {label}
                </button>
              ))}
              <div className="h-px bg-slate-750 my-2" />
              <button
                type="button"
                onClick={() => { setShowMoreMenu(false); if (isAdmin) setShowResetConfirm(true); else alert('전체 초기화는 관리자만 할 수 있어요.'); }}
                className="w-full rounded-xl flex items-start gap-3 px-3 py-2.5 text-left hover:bg-red-400/10"
              >
                <RotateCcw className="w-5 h-5 text-red-400 mt-0.5" />
                <span>
                  <span className="block text-[15px] text-red-300">초기화</span>
                  <span className="block text-xs text-slate-500">기본 엑셀로 전체 재고를 덮어써요. 한 번 더 확인해요.</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────── 입출고할 와인 고르기 (모바일 가운데 버튼) ───────── */}
      {showPicker && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="입출고할 와인 고르기">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowPicker(false)} />
          <div className="absolute inset-x-0 bottom-0 top-[7vh] bg-[#171318] rounded-t-3xl border-t border-slate-700 flex flex-col pb-safe">
            <div className="w-10 h-1.5 rounded-full bg-slate-700 mx-auto mt-2.5 shrink-0" />
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold">어떤 와인을 기록할까요?</h2>
                <button type="button" onClick={() => setShowPicker(false)} aria-label="닫기" className="w-8 h-8 rounded-lg border border-slate-700 grid place-items-center text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <label className="h-11 rounded-xl bg-slate-900 border border-slate-750 flex items-center gap-2.5 px-3.5 focus-within:border-wine">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  type="search"
                  autoFocus
                  value={pickerTerm}
                  onChange={(e) => setPickerTerm(e.target.value)}
                  placeholder="와인 이름으로 찾기"
                  className="flex-1 bg-transparent text-[15px] text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </label>
            </div>
            <ul className="flex-1 overflow-y-auto px-2 pb-4">
              {pickerGroups.map((g) => (
                <li key={g.key}>
                  <button
                    type="button"
                    onClick={() => { setShowPicker(false); openWine(g, g.rows[0].id); }}
                    className="w-full text-left rounded-xl px-2.5 py-2.5 hover:bg-slate-850 flex items-center gap-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] text-slate-100 truncate">{g.name}</span>
                      <span className="block text-[12px] text-slate-400 truncate">
                        {rackLabel(g.primaryRack)} · 빈티지 {g.rows.length}개
                      </span>
                    </span>
                    <span className="text-base font-bold tabular">{g.totalQty}<span className="text-[11px] font-normal text-slate-400">병</span></span>
                  </button>
                </li>
              ))}
              {pickerGroups.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-400">찾는 와인이 없어요.</li>}
            </ul>
          </div>
        </div>
      )}

      {/* ───────── 초기화 확인 ───────── */}
      {showResetConfirm && (
        <ResetConfirm onCancel={() => setShowResetConfirm(false)} onConfirm={handleResetToDefault} />
      )}

      {/* ───────── 알림 ───────── */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 lg:bottom-6 z-[60] max-w-[90vw] px-4 py-2.5 rounded-xl bg-slate-100 text-slate-950 text-[13px] font-medium shadow-xl" role="status">
          {toast}
        </div>
      )}

      {/* 빈티지 수정 모달 */}
      {editingVintageWine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-amber-400" /> 빈티지 수정
                </h3>
                <p className="text-xs text-rose-400 mt-0.5 truncate max-w-[240px]">
                  {editingVintageWine.name}
                </p>
              </div>
              <button onClick={() => setEditingVintageWine(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">빈티지 (연도 또는 NV)</label>
              <input
                type="text"
                placeholder="예: 2018 또는 NV"
                value={inputVintage}
                onChange={(e) => setInputVintage(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-rose-500"
                autoFocus
              />
              <p className="text-[11px] text-slate-500">
                * 숫자가 없는 샴페인은 NV로 입력해 주세요.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => setEditingVintageWine(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveVintage}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* 엑셀 반영 전 검토 */}
      {diffModalData && (
        <SyncReview
          data={diffModalData}
          onCancel={() => setDiffModalData(null)}
          onApply={({ deleteDup, deleteMissing, backup }) => {
            if (backup) handleDownloadExcel();
            const del = new Set([
              ...(deleteDup ? diffModalData.dupRows.map(r => r.id) : []),
              ...(deleteMissing ? diffModalData.missingRows.map(r => r.id) : []),
            ]);
            const keepRows = [...diffModalData.dupRows, ...diffModalData.missingRows].filter(r => !del.has(r.id));
            executeSmartMerge(
              diffModalData.excelWithMatch,
              del.size > 0
                ? `엑셀 기준으로 맞췄어요. ${diffModalData.excelWithMatch.length}개 항목 반영, ${del.size}개 항목 삭제.`
                : '엑셀 내용이 반영됐어요.',
              { deleteIds: [...del], keepRows }
            );
          }}
        />
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
              {editingEnglishWine.groupIds && editingEnglishWine.groupIds.length > 1 && (
                <p className="text-[11px] text-slate-500">같은 와인의 빈티지 {editingEnglishWine.groupIds.length}개에 함께 적용돼요.</p>
              )}
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
                <div 
                  onClick={() => {
                    const target = zoomedWine;
                    setZoomedWine(null);
                    setEditingVintageWine(target);
                    setInputVintage(target.vintage || '');
                  }}
                  className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-amber-500/50 transition"
                  title="터치하여 빈티지 수정"
                >
                  <span className="text-[10px] text-slate-400 flex items-center justify-between">
                    빈티지 / 생산국 <Edit3 className="w-2.5 h-2.5 text-amber-400" />
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-bold text-amber-300 font-mono text-sm">{zoomedWine.vintage}</span>
                    <span className="text-slate-300">({zoomedWine.country})</span>
                  </div>
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
              <button 
                disabled={isUploadingImage}
                onClick={() => setEditingImageWine(null)} 
                className="text-slate-400 hover:text-white disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isUploadingImage ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-rose-400">
                <RefreshCw className="w-8 h-8 animate-spin text-rose-500" />
                <p className="text-xs font-semibold text-slate-200">사진 최적화 압축 및 저장 중...</p>
                <p className="text-[11px] text-slate-500">잠시만 기다려 주세요</p>
              </div>
            ) : (
              <>
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
                  <label className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700 transition">
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    <span>카메라로 촬영 / 앨범에서 선택</span>
                    <input type="file" accept="image/*" onChange={handleImageFileUpload} className="hidden" />
                  </label>
                </div>

                {editingImageWine.customImage && (
                  <button type="button" onClick={() => handleSaveImage(null)} className="w-full py-2 text-red-400 hover:bg-red-950/30 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition">
                    <Trash2 className="w-3.5 h-3.5" /> <span>등록된 사진 삭제</span>
                  </button>
                )}
              </>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">영문 와인명 (선택, 비워두면 자동 매칭)</label>
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
            <div className="px-4 pt-3 space-y-2">
              <p className="text-xs text-slate-400">수정 이력은 삭제되지 않습니다. 로그인 도입 전 기록은 수정자를 확인할 수 없어요.</p>
              <input aria-label="수정자 또는 와인 검색" placeholder="수정자 이름 / 와인명 검색" value={logFilter} onChange={e => setLogFilter(e.target.value)} className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm text-white" />
            </div>
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
              {historyLogs.filter(log => !logFilter || log.actorName.includes(logFilter) || log.name?.includes(logFilter)).map(log => (
                <div key={log.logId} className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.changeType === '위치이동' ? 'bg-purple-500/20 text-purple-300' :
                        log.changeType === '비고수정' ? 'bg-amber-500/20 text-amber-300' :
                        log.changeType === '빈티지수정' ? 'bg-amber-500/20 text-amber-300' :
                        log.changeType.includes('등록') ? 'bg-emerald-500/20 text-emerald-300' :
                        log.changeType.includes('입고') ? 'bg-blue-500/20 text-blue-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {log.changeType}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{log.time} · {log.actorName}</span>
                    </div>
                    <p className="font-semibold text-white text-xs sm:text-sm truncate">{log.name} ({log.vintage})</p>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{log.reason}</p>
                  </div>
                  {log.canUndo && !historyLogs.some(item => item.undoOf === log.logId) && <button disabled={!!undoing} onClick={() => handleUndo(log)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-amber-300 rounded-lg text-xs font-semibold shrink-0 border border-amber-500/30">
                    <RotateCcw className="w-3.5 h-3.5" /> <span>되돌리기</span>
                  </button>}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-between gap-3">
              {hasMoreLogs && <button disabled={loadingLogs} onClick={loadOlderLogs} className="text-sm text-rose-300">{loadingLogs ? '불러오는 중…' : '이전 기록 더 보기'}</button>}
              <button onClick={() => setShowLogModal(false)} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-medium">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// 초기화 전 한 번 더 확인 (실수로 누르는 것 방지: '초기화'를 직접 입력해야 실행)
function ResetConfirm({ onCancel, onConfirm }) {
  const [text, setText] = useState('');
  const ready = text.trim() === '초기화';
  return (
    <div className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="reset-title">
      <div className="bg-slate-900 border border-red-400/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-400/15 grid place-items-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 id="reset-title" className="font-bold text-white text-base">전체 재고를 초기화할까요?</h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              서버에 있는 기본 엑셀(wine_data.xlsx) 내용으로 <b className="text-red-300">모든 와인의 수량·위치·메모를 덮어쓰고, 등록한 사진도 지워져요.</b> 되돌릴 수 없으니, 먼저 엑셀 다운로드로 지금 상태를 저장해 두세요.
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="reset-confirm-input" className="block text-xs text-slate-400">계속하려면 <b className="text-slate-200">초기화</b>라고 입력하세요</label>
          <input
            id="reset-confirm-input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-red-400"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-slate-800 text-slate-200 rounded-xl text-sm">
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!ready}
            className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 text-white rounded-xl text-sm font-bold disabled:opacity-40 disabled:hover:bg-red-500"
          >
            초기화 실행
          </button>
        </div>
      </div>
    </div>
  );
}
