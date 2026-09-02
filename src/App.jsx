import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Wine, Search, Layers, AlertTriangle, Upload, 
  MapPin, ExternalLink, LayoutGrid, Table, 
  Plus, Minus, RefreshCw, Box, Grid3X3
} from 'lucide-react';

const BOTTLE_IMAGES = {
  champagne: 'https://images.unsplash.com/photo-1594488518001-0818ca09e80e?w=500&auto=format&fit=crop&q=80',
  white: 'https://images.unsplash.com/photo-1558001373-7b93ee48ffa0?w=500&auto=format&fit=crop&q=80',
  port: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500&auto=format&fit=crop&q=80',
  red: 'https://images.unsplash.com/photo-1586370434639-0fe43b2d32e6?w=500&auto=format&fit=crop&q=80',
};

// [기능 2] 세부 카테고리별 테마 배지 태깅
function getWineMeta(name = '', note = '', country = '') {
  const lower = (name + ' ' + note).toLowerCase();
  
  if (lower.includes('샴페인') || lower.includes('블랑') || lower.includes('페리에') || lower.includes('돔 페리뇽') || lower.includes('크루그') || lower.includes('cristal')) {
    return { type: '샴페인/스파클링', image: BOTTLE_IMAGES.champagne, tagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
  }
  if (lower.includes('몽라쉐') || lower.includes('샤르도네') || lower.includes('소비뇽 블랑') || lower.includes('샤블리') || lower.includes('화이트')) {
    return { type: '화이트 와인', image: BOTTLE_IMAGES.white, tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
  }
  if (lower.includes('포트') || lower.includes('테일러') || lower.includes('귀부') || lower.includes('소테른')) {
    return { type: '포트/디저트', image: BOTTLE_IMAGES.port, tagColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40' };
  }
  if (lower.includes('바롤로') || lower.includes('브루넬로') || lower.includes('아마로네') || country === '이탈리아') {
    return { type: '이탈리안 레드', image: BOTTLE_IMAGES.red, tagColor: 'bg-red-500/20 text-red-300 border-red-500/40' };
  }
  if (country === '미국' || lower.includes('카베르네') || lower.includes('오퍼스')) {
    return { type: '나파/보르도 레드', image: BOTTLE_IMAGES.red, tagColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
  }
  return { type: '프리미엄 레드', image: BOTTLE_IMAGES.red, tagColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
}

export default function App() {
  const [stockData, setStockData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRack, setSelectedRack] = useState('전체');
  const [selectedCountry, setSelectedCountry] = useState('전체');
  const [onlyOutOfStock, setOnlyOutOfStock] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // [기능 1] 'grid' | 'table'
  const [showRackMap, setShowRackMap] = useState(true); // [기능 3] 미니맵 토글

  // [기능 4] 실사용 수량 증감 핸들러 (+ / -)
  const handleQtyChange = (id, delta) => {
    setStockData(prev => prev.map(item => {
      if (item.id === id) {
        const updatedQty = Math.max(0, item.currentQty + delta);
        return {
          ...item,
          currentQty: updatedQty,
          status: updatedQty <= 0 ? '재고없음' : '정상'
        };
      }
      return item;
    }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });

      const sheetName = wb.SheetNames.includes('와인재고현황') 
        ? '와인재고현황' 
        : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

      let headerIdx = rawData.findIndex(row => row && row.includes('와인명'));
      if (headerIdx === -1) headerIdx = 1;

      const rows = rawData.slice(headerIdx + 1);

      const parsed = rows
        .filter(r => r && r[1])
        .map((r, i) => {
          const country = String(r[0] || '기타').trim();
          const name = String(r[1] || '').trim();
          const note = String(r[8] || '').trim();
          const meta = getWineMeta(name, note, country);

          return {
            id: i + 1,
            country,
            name,
            vintage: String(r[2] || 'NV').trim(),
            rack: String(r[3] || '미지정').trim(),
            inQty: Number(r[4]) || 0,
            outQty: Number(r[5]) || 0,
            currentQty: Number(r[6]) || 0,
            status: String(r[7] || '정상').trim(),
            note,
            image: r[9] ? String(r[9]).trim() : meta.image,
            wineType: meta.type,
            tagColor: meta.tagColor,
          };
        });

      setStockData(parsed);
    };
    reader.readAsBinaryString(file);
  };

  // 랙별 총 병 수 계산 맵 (미니맵용)
  const rackCountMap = useMemo(() => {
    const map = {};
    stockData.forEach(item => {
      map[item.rack] = (map[item.rack] || 0) + item.currentQty;
    });
    return map;
  }, [stockData]);

  // 국가 목록
  const countryList = useMemo(() => {
    const unique = Array.from(new Set(stockData.map(item => item.country))).filter(Boolean);
    return ['전체', ...unique];
  }, [stockData]);

  // 필터링
  const filteredData = useMemo(() => {
    return stockData.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.vintage.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.note.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRack = selectedRack === '전체' || item.rack === selectedRack;
      const matchCountry = selectedCountry === '전체' || item.country === selectedCountry;
      const matchStatus = onlyOutOfStock ? (item.currentQty <= 0 || item.status === '재고없음') : true;

      return matchSearch && matchRack && matchCountry && matchStatus;
    });
  }, [stockData, searchTerm, selectedRack, selectedCountry, onlyOutOfStock]);

  const stats = useMemo(() => {
    const totalBottles = stockData.reduce((acc, cur) => acc + cur.currentQty, 0);
    const totalTypes = stockData.length;
    const outOfStockCount = stockData.filter(i => i.currentQty <= 0 || i.status === '재고없음').length;
    return { totalBottles, totalTypes, outOfStockCount };
  }, [stockData]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20">
      {/* 헤더 */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600/20 text-rose-500 rounded-xl border border-rose-500/30">
              <Wine className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">서울석유 2층 와인창고</h1>
              <p className="text-xs text-slate-400">
                {fileName ? `동기화 파일: ${fileName}` : '정리본 엑셀 파일을 업로드해 주세요.'}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold cursor-pointer transition shadow-lg shadow-rose-950/40">
            <Upload className="w-4 h-4" />
            <span>{stockData.length > 0 ? '엑셀 갱신' : '엑셀 업로드'}</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {stockData.length === 0 ? (
          <div className="border-2 border-dashed border-slate-800 rounded-2xl p-16 text-center bg-slate-900/40 my-10">
            <div className="mx-auto w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-rose-400 mb-4 shadow-inner">
              <Box className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-white">와인창고 엑셀 파일을 업로드해 주세요</h3>
            <p className="text-slate-400 text-sm mt-1 mb-6">`서울석유 2층 와인창고 정리본.xlsx` 파일을 선택하면 즉시 가동됩니다.</p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-medium cursor-pointer transition">
              <Upload className="w-4 h-4" /> 파일 선택하기
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <>
            {/* 상단 통계 카드 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <Wine className="w-4 h-4 text-rose-400" /> 총 보관 수량
                </span>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.totalBottles.toLocaleString()}<span className="text-sm font-normal text-slate-400 ml-1">병</span>
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-400" /> 관리 와인 라벨
                </span>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.totalTypes}<span className="text-sm font-normal text-slate-400 ml-1">종</span>
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> 품절/소진 품목
                </span>
                <p className="text-2xl font-bold text-amber-400 mt-1">
                  {stats.outOfStockCount}<span className="text-sm font-normal text-slate-400 ml-1">개</span>
                </p>
              </div>
            </div>

            {/* [기능 3] 2층 와인 창고 랙(Rack) 바둑판 미니맵 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <Grid3X3 className="w-4 h-4 text-rose-500" />
                  <h3 className="text-sm font-bold text-white">2층 창고 랙(Rack) 구조 맵</h3>
                  <span className="text-xs text-slate-400">칸을 클릭하면 해당 랙 와인만 필터링됩니다</span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedRack !== '전체' && (
                    <button
                      onClick={() => setSelectedRack('전체')}
                      className="text-xs text-rose-400 hover:underline"
                    >
                      전체 랙 보기 (필터 해제)
                    </button>
                  )}
                  <button
                    onClick={() => setShowRackMap(!showRackMap)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-md"
                  >
                    {showRackMap ? '미니맵 접기' : '미니맵 펼치기'}
                  </button>
                </div>
              </div>

              {showRackMap && (
                <div className="space-y-3 pt-2">
                  {/* 번호 랙 (1번랙 ~ 27번랙) 그리드 */}
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block mb-1.5">외곽 벽면 랙 (1번 ~ 27번)</span>
                    <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-14 gap-1.5">
                      {Array.from({ length: 27 }, (_, i) => `${i + 1}번랙`).map(r => {
                        const count = rackCountMap[r] || 0;
                        const isSelected = selectedRack === r;
                        return (
                          <button
                            key={r}
                            onClick={() => setSelectedRack(isSelected ? '전체' : r)}
                            className={`p-2 rounded-xl text-center flex flex-col items-center justify-center transition border ${
                              isSelected
                                ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-950/60'
                                : count > 0 
                                  ? 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-750 hover:border-slate-600' 
                                  : 'bg-slate-900/40 border-slate-800/50 text-slate-600 cursor-not-allowed'
                            }`}
                          >
                            <span className="text-[11px] font-bold leading-tight">{r.replace('번랙', '')}번</span>
                            <span className="text-[10px] font-mono opacity-80">{count}병</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 중앙랙 및 특수 보관 공간 */}
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block mb-1.5">중앙랙 & 천장 및 박스 보관 구역</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        '중앙랙(1번줄)', '중앙랙(2번줄)', '중앙랙(3번줄)', 
                        '중앙랙(4번줄)', '중앙랙(5번줄)', '중앙랙(6번줄)',
                        '1번랙(천장)', '4,7번랙(천장)', 
                        '샴페인박스(1)', '샴페인박스(2)', '나라셀러박스', '삼도빌딩박스'
                      ].map(r => {
                        const count = rackCountMap[r] || 0;
                        const isSelected = selectedRack === r;
                        return (
                          <button
                            key={r}
                            onClick={() => setSelectedRack(isSelected ? '전체' : r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-rose-600 border-rose-400 text-white shadow-md'
                                : count > 0 
                                  ? 'bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white' 
                                  : 'bg-slate-900/40 border-slate-800 text-slate-600'
                            }`}
                          >
                            <span>{r}</span>
                            <span className="font-mono text-[11px] text-rose-400 font-bold">({count}병)</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 필터 컨트롤 바 */}
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="와인명, 빈티지, 비고(매그넘 등) 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                />
              </div>

              <div className="flex flex-wrap gap-2 w-full md:w-auto items-center justify-between sm:justify-end">
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-rose-500"
                >
                  {countryList.map(c => (
                    <option key={c} value={c}>{c === '전체' ? '🌍 원산지 전체' : `🌍 ${c}`}</option>
                  ))}
                </select>

                <button
                  onClick={() => setOnlyOutOfStock(!onlyOutOfStock)}
                  className={`px-3 py-2 text-xs font-medium rounded-xl border transition ${
                    onlyOutOfStock 
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  품절만 보기
                </button>

                {/* [기능 1] 뷰 모드 토글 */}
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'grid' ? 'bg-slate-800 text-rose-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="갤러리 카드 뷰"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'table' ? 'bg-slate-800 text-rose-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="테이블 표 뷰"
                  >
                    <Table className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 결과 집계 카운트 */}
            <div className="flex justify-between items-center text-xs text-slate-400 px-1">
              <span>선택 랙: <strong className="text-white">{selectedRack}</strong> (검색: {filteredData.length}개 품목)</span>
              <span>총 재고: <strong className="text-rose-400 font-bold">{filteredData.reduce((a, c) => a + c.currentQty, 0)}</strong>병</span>
            </div>

            {/* [기능 1] 갤러리 카드 뷰 */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredData.length === 0 ? (
                  <div className="col-span-full py-16 text-center text-slate-500 text-sm">
                    일치하는 와인이 없습니다.
                  </div>
                ) : (
                  filteredData.map((item) => {
                    const vivinoUrl = `https://www.vivino.com/search/wines?q=${encodeURIComponent(item.name + ' ' + (item.vintage !== 'NV' ? item.vintage : ''))}`;

                    return (
                      <div 
                        key={item.id} 
                        className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-rose-500/40 hover:shadow-2xl transition group flex flex-col justify-between"
                      >
                        <div className="relative aspect-[4/3] bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center p-3 overflow-hidden">
                          <img 
                            src={item.image} 
                            alt={item.name}
                            className="max-h-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.9)] group-hover:scale-105 transition duration-300"
                            loading="lazy"
                          />
                          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-950/80 text-white border border-slate-800 shadow-md">
                            📍 {item.rack}
                          </span>
                          <span className={`absolute top-3 right-3 px-2 py-0.5 rounded-md text-[11px] font-medium border ${item.tagColor}`}>
                            {item.wineType}
                          </span>
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1 font-medium">
                              <span>{item.country}</span>
                              <span>•</span>
                              <span className="font-mono text-slate-300 font-bold">{item.vintage}</span>
                              {item.note && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-300/90 truncate max-w-[100px]">{item.note}</span>
                                </>
                              )}
                            </div>

                            <h3 className="font-bold text-white text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                              {item.name}
                            </h3>
                          </div>

                          {/* [기능 4] 모바일 실사용 수량 증감 버튼 (+ / -) */}
                          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                              <button
                                onClick={() => handleQtyChange(item.id, -1)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition"
                                title="출고 (1병 차감)"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className={`w-8 text-center text-sm font-bold font-mono ${
                                item.currentQty <= 0 ? 'text-red-400' : 'text-emerald-400'
                              }`}>
                                {item.currentQty}
                              </span>
                              <button
                                onClick={() => handleQtyChange(item.id, 1)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition"
                                title="입고 (1병 추가)"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <a
                              href={vivinoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Vivino</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* [기능 1] 테이블 표 뷰 */}
            {viewMode === 'table' && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3.5 font-semibold">원산지</th>
                        <th className="px-5 py-3.5 font-semibold">와인명</th>
                        <th className="px-3 py-3.5 font-semibold text-center">빈티지</th>
                        <th className="px-4 py-3.5 font-semibold">보관위치</th>
                        <th className="px-4 py-3.5 font-semibold text-center">현재고 (조정)</th>
                        <th className="px-4 py-3.5 font-semibold">비고</th>
                        <th className="px-3 py-3.5 font-semibold text-center">비비노</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredData.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3 text-slate-400 text-xs">{item.country}</td>
                          <td className="px-5 py-3 font-medium text-white max-w-xs md:max-w-md truncate">
                            {item.name}
                          </td>
                          <td className="px-3 py-3 text-slate-300 text-center font-mono text-xs">{item.vintage}</td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                              {item.rack}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleQtyChange(item.id, -1)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className={`w-8 text-center text-xs font-bold font-mono ${
                                item.currentQty <= 0 ? 'text-red-400' : 'text-emerald-400'
                              }`}>
                                {item.currentQty}병
                              </span>
                              <button
                                onClick={() => handleQtyChange(item.id, 1)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-amber-300/80 max-w-[150px] truncate">
                            {item.note || '-'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <a
                              href={`https://www.vivino.com/search/wines?q=${encodeURIComponent(item.name + ' ' + (item.vintage !== 'NV' ? item.vintage : ''))}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition"
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
          </>
        )}
      </main>
    </div>
  );
}