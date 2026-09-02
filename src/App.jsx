import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Wine, Search, Layers, AlertTriangle, Upload, Download,
  MapPin, ExternalLink, LayoutGrid, Table, Plus, Minus, 
  Grid3X3, History, RotateCcw, X, Camera, CheckCircle2, ChevronDown, ChevronUp, Box
} from 'lucide-react';

// 국가별 국기 및 테마 매핑
const COUNTRY_INFO = {
  '프랑스': { flag: '🇫🇷', color: 'from-blue-950/40 to-slate-900 border-blue-500/30' },
  '미국': { flag: '🇺🇸', color: 'from-red-950/40 to-slate-900 border-red-500/30' },
  '이탈리아': { flag: '🇮🇹', color: 'from-emerald-950/40 to-slate-900 border-emerald-500/30' },
  '스페인': { flag: '🇪🇸', color: 'from-amber-950/40 to-slate-900 border-amber-500/30' },
  '호주': { flag: '🇦🇺', color: 'from-cyan-950/40 to-slate-900 border-cyan-500/30' },
  '칠레': { flag: '🇨🇱', color: 'from-rose-950/40 to-slate-900 border-rose-500/30' },
  '포르투갈': { flag: '🇵🇹', color: 'from-orange-950/40 to-slate-900 border-orange-500/30' },
};

export default function App() {
  const [stockData, setStockData] = useState(() => {
    const saved = localStorage.getItem('seouloil_wine_stock');
    return saved ? JSON.parse(saved) : [];
  });
  const [historyLogs, setHistoryLogs] = useState(() => {
    const saved = localStorage.getItem('seouloil_wine_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [rawWorkbook, setRawWorkbook] = useState(null);
  const [fileName, setFileName] = useState(() => localStorage.getItem('seouloil_wine_file') || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRack, setSelectedRack] = useState('전체');
  const [selectedCountry, setSelectedCountry] = useState('전체');
  const [onlyOutOfStock, setOnlyOutOfStock] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showRackMap, setShowRackMap] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  // 로컬 저장 동기화
  useEffect(() => {
    if (stockData.length > 0) {
      localStorage.setItem('seouloil_wine_stock', JSON.stringify(stockData));
    }
  }, [stockData]);

  useEffect(() => {
    localStorage.setItem('seouloil_wine_logs', JSON.stringify(historyLogs));
  }, [historyLogs]);

  // 수량 증감 및 변경 이력 기록 (+ / -)
  const handleQtyChange = (id, delta, reason = '수동 조정') => {
    const target = stockData.find(item => item.id === id);
    if (!target) return;

    const prevQty = target.currentQty;
    const newQty = Math.max(0, prevQty + delta);
    if (prevQty === newQty) return;

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    const newLog = {
      logId: Date.now() + Math.random(),
      time: timeStr,
      wineId: target.id,
      name: target.name,
      vintage: target.vintage,
      rack: target.rack,
      country: target.country,
      changeType: delta > 0 ? '입고 (+)' : '출고 (-)',
      delta,
      prevQty,
      newQty,
      reason
    };

    setHistoryLogs(prev => [newLog, ...prev]);
    setStockData(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          currentQty: newQty,
          outQty: delta < 0 ? item.outQty + Math.abs(delta) : item.outQty,
          inQty: delta > 0 ? item.inQty + delta : item.inQty,
          status: newQty <= 0 ? '재고없음' : '정상'
        };
      }
      return item;
    }));
  };

  // 실행 취소 (Undo) 기능
  const handleUndo = (log) => {
    setStockData(prev => prev.map(item => {
      if (item.id === log.wineId) {
        return {
          ...item,
          currentQty: log.prevQty,
          outQty: log.delta < 0 ? Math.max(0, item.outQty - Math.abs(log.delta)) : item.outQty,
          inQty: log.delta > 0 ? Math.max(0, item.inQty - log.delta) : item.inQty,
          status: log.prevQty <= 0 ? '재고없음' : '정상'
        };
      }
      return item;
    }));

    // 취소된 로그 삭제
    setHistoryLogs(prev => prev.filter(l => l.logId !== log.logId));
  };

  // 개별 와인 실물 사진 업로드 핸들러
  const handleImageUpload = (id, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      setStockData(prev => prev.map(item => item.id === id ? { ...item, customImage: base64 } : item));
    };
    reader.readAsDataURL(file);
  };

  // 엑셀 파싱
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    localStorage.setItem('seouloil_wine_file', file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      setRawWorkbook(wb);

      const sheetName = wb.SheetNames.includes('와인재고현황') ? '와인재고현황' : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

      let headerIdx = rawData.findIndex(row => row && row.includes('와인명'));
      if (headerIdx === -1) headerIdx = 1;

      const rows = rawData.slice(headerIdx + 1);

      const parsed = rows
        .filter(r => r && r[1])
        .map((r, i) => ({
          id: i + 1,
          country: String(r[0] || '기타').trim(),
          name: String(r[1] || '').trim(),
          vintage: String(r[2] || 'NV').trim(),
          rack: String(r[3] || '미지정').trim(),
          inQty: Number(r[4]) || 0,
          outQty: Number(r[5]) || 0,
          currentQty: Number(r[6]) || 0,
          status: String(r[7] || '정상').trim(),
          note: String(r[8] || '').trim(),
          customImage: null,
        }));

      setStockData(parsed);
      setHistoryLogs([]); // 새 파일 로드 시 로그 초기화
    };
    reader.readAsBinaryString(file);
  };

  // 수정본 엑셀 다운로드 (재고현황 + 입출고대장 로그 자동 반영)
  const handleDownloadExcel = () => {
    if (stockData.length === 0) return;

    // 1. 와인재고현황 시트 생성
    const stockSheetData = [
      ['와 인 재 고 현 황'],
      ['원산지', '와인명', '빈티지', '보관위치', '총 입고량', '총 출고량', '현재고', '상태', '비고']
    ];

    stockData.forEach(item => {
      stockSheetData.push([
        item.country, item.name, item.vintage, item.rack,
        item.inQty, item.outQty, item.currentQty, item.status, item.note
      ]);
    });

    // 2. 변경 로그를 입출고대장에 결합
    const ledgerSheetData = [
      ['입출고대장 (웹 대시보드 반영본)'],
      ['날짜/일시', '구분', '원산지', '와인명', '빈티지', '보관위치', '수량', '사용처/사유', '비고']
    ];

    historyLogs.forEach(l => {
      ledgerSheetData.push([
        l.time,
        l.changeType.includes('입고') ? '입고' : '출고',
        l.country,
        l.name,
        l.vintage,
        l.rack,
        Math.abs(l.delta),
        l.reason,
        `재고변동: ${l.prevQty}병 ➔ ${l.newQty}병`
      ]);
    });

    const newWb = XLSX.utils.book_new();
    const wsStock = XLSX.utils.aoa_to_sheet(stockSheetData);
    const wsLedger = XLSX.utils.aoa_to_sheet(ledgerSheetData);

    XLSX.utils.book_append_sheet(newWb, wsStock, '와인재고현황');
    XLSX.utils.book_append_sheet(newWb, wsLedger, '입출고변경이력');

    const todayStr = new Date().toISOString().slice(0,10);
    XLSX.writeFile(newWb, `서울석유_와인창고_수정본_${todayStr}.xlsx`);
  };

  const rackCountMap = useMemo(() => {
    const map = {};
    stockData.forEach(item => { map[item.rack] = (map[item.rack] || 0) + item.currentQty; });
    return map;
  }, [stockData]);

  const rackList = useMemo(() => {
    const unique = Array.from(new Set(stockData.map(item => item.rack))).filter(Boolean);
    return ['전체', ...unique.sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, '')) || 999;
      const numB = parseInt(b.replace(/[^0-9]/g, '')) || 999;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    })];
  }, [stockData]);

  const countryList = useMemo(() => {
    const unique = Array.from(new Set(stockData.map(item => item.country))).filter(Boolean);
    return ['전체', ...unique];
  }, [stockData]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-28">
      {/* 상단 헤더 */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-rose-600/20 text-rose-500 rounded-xl border border-rose-500/30 shrink-0">
              <Wine className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold tracking-tight text-white truncate">
                서울석유 2층 와인창고
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {fileName ? fileName : '정리본 엑셀 파일을 업로드해 주세요.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 변경 이력 버튼 */}
            <button
              onClick={() => setShowLogModal(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-medium border border-slate-700 transition touch-manipulation"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>이력</span>
              {historyLogs.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-amber-500 text-slate-950 rounded-full">
                  {historyLogs.length}
                </span>
              )}
            </button>

            {/* 엑셀 다운로드 버튼 */}
            {stockData.length > 0 && (
              <button
                onClick={handleDownloadExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 active:bg-emerald-700 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-emerald-950/40 touch-manipulation"
                title="수정된 재고 및 변경이력 엑셀 저장"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">수정본 저장</span>
                <span className="sm:hidden">저장</span>
              </button>
            )}

            {/* 업로드 버튼 */}
            <label className="flex items-center gap-1 px-3 py-2 bg-rose-600 active:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-semibold cursor-pointer transition shadow-md shadow-rose-950/40 touch-manipulation">
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{stockData.length > 0 ? '갱신' : '업로드'}</span>
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {stockData.length === 0 ? (
          <div className="border-2 border-dashed border-slate-800 rounded-2xl p-8 sm:p-16 text-center bg-slate-900/40 my-6 sm:my-10">
            <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-rose-400 mb-4 shadow-inner">
              <Box className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white">와인창고 엑셀 파일을 등록해 주세요</h3>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 mb-5">`서울석유 2층 와인창고 정리본.xlsx` 파일을 선택하면 즉시 가동됩니다.</p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 active:bg-rose-700 text-white rounded-xl text-sm font-medium cursor-pointer transition touch-manipulation">
              <Upload className="w-4 h-4" /> 파일 선택하기
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <>
            {/* 상단 통계 카드 */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="bg-slate-900/90 border border-slate-800 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl">
                <span className="text-[10px] sm:text-xs text-slate-400 font-medium flex items-center gap-1">
                  <Wine className="w-3.5 h-3.5 text-rose-400 shrink-0" /> <span className="truncate">총 보관수량</span>
                </span>
                <p className="text-lg sm:text-2xl font-bold text-white mt-0.5 sm:mt-1 font-mono">
                  {stats.totalBottles.toLocaleString()}<span className="text-[11px] sm:text-sm font-normal text-slate-400 ml-0.5">병</span>
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl">
                <span className="text-[10px] sm:text-xs text-slate-400 font-medium flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" /> <span className="truncate">와인 종류</span>
                </span>
                <p className="text-lg sm:text-2xl font-bold text-white mt-0.5 sm:mt-1 font-mono">
                  {stats.totalTypes}<span className="text-[11px] sm:text-sm font-normal text-slate-400 ml-0.5">종</span>
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl">
                <span className="text-[10px] sm:text-xs text-slate-400 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" /> <span className="truncate">소진 품목</span>
                </span>
                <p className="text-lg sm:text-2xl font-bold text-amber-400 mt-0.5 sm:mt-1 font-mono">
                  {stats.outOfStockCount}<span className="text-[11px] sm:text-sm font-normal text-slate-400 ml-0.5">개</span>
                </p>
              </div>
            </div>

            {/* 랙 바둑판 미니맵 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-xl">
              <div className="flex justify-between items-center">
                <button 
                  onClick={() => setShowRackMap(!showRackMap)}
                  className="flex items-center gap-2 text-left w-full group touch-manipulation"
                >
                  <Grid3X3 className="w-4 h-4 text-rose-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-white block">
                      2층 창고 랙(Rack) 구조 맵
                    </span>
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
                <div className="space-y-3 pt-3 mt-3 border-t border-slate-800">
                  {selectedRack !== '전체' && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setSelectedRack('전체')}
                        className="text-xs text-rose-400 font-semibold hover:underline"
                      >
                        ✕ 필터 초기화 (전체 랙 보기)
                      </button>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-2">외곽 벽면 랙 (1번 ~ 27번)</span>
                    <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-14 gap-1.5">
                      {Array.from({ length: 27 }, (_, i) => `${i + 1}번랙`).map(r => {
                        const count = rackCountMap[r] || 0;
                        const isSelected = selectedRack === r;
                        return (
                          <button
                            key={r}
                            onClick={() => setSelectedRack(isSelected ? '전체' : r)}
                            className={`py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center transition border touch-manipulation ${
                              isSelected
                                ? 'bg-rose-600 border-rose-400 text-white shadow-lg'
                                : count > 0 
                                  ? 'bg-slate-800/90 border-slate-700/80 text-slate-200 active:bg-slate-700' 
                                  : 'bg-slate-900/30 border-slate-800/40 text-slate-600 opacity-50'
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
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-2">중앙랙 & 천장 및 박스 보관</span>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2">
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
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition border flex items-center justify-between sm:justify-start gap-1.5 touch-manipulation ${
                              isSelected
                                ? 'bg-rose-600 border-rose-400 text-white shadow-md'
                                : count > 0 
                                  ? 'bg-slate-800/90 border-slate-700 text-slate-300 active:bg-slate-700' 
                                  : 'bg-slate-900/40 border-slate-800 text-slate-600'
                            }`}
                          >
                            <span className="truncate">{r}</span>
                            <span className="font-mono text-[11px] text-rose-400 font-bold shrink-0">({count}병)</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 필터 컨트롤 바 */}
            <div className="bg-slate-900/80 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-3">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="와인명, 빈티지, 비고(매그넘 등) 검색..."
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
                    {countryList.map(c => (
                      <option key={c} value={c}>{c === '전체' ? '🌍 전체 국가' : `🌍 ${c}`}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => setOnlyOutOfStock(!onlyOutOfStock)}
                    className={`px-2.5 py-2 text-xs font-medium rounded-xl border transition shrink-0 touch-manipulation ${
                      onlyOutOfStock 
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                        : 'bg-slate-950 text-slate-400 border-slate-800 active:bg-slate-900'
                    }`}
                  >
                    품절만
                  </button>
                </div>

                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition touch-manipulation ${
                      viewMode === 'grid' ? 'bg-slate-800 text-rose-400 shadow-sm' : 'text-slate-400'
                    }`}
                    title="부티크 라벨 카드 뷰"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-lg transition touch-manipulation ${
                      viewMode === 'table' ? 'bg-slate-800 text-rose-400 shadow-sm' : 'text-slate-400'
                    }`}
                    title="테이블 표 뷰"
                  >
                    <Table className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 결과 건수 안내 */}
            <div className="flex justify-between items-center text-[11px] sm:text-xs text-slate-400 px-1">
              <span>조회 결과: <strong className="text-white">{filteredData.length}</strong>개 와인</span>
              <span>보관 재고: <strong className="text-rose-400 font-bold">{filteredData.reduce((a, c) => a + c.currentQty, 0)}</strong>병</span>
            </div>

            {/* 1. 부티크 라벨 카드 뷰 (가짜 사진 완전 퇴출 + 실물 사진 첨부 지원) */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                {filteredData.length === 0 ? (
                  <div className="col-span-full py-16 text-center text-slate-500 text-sm">
                    일치하는 와인이 없습니다.
                  </div>
                ) : (
                  filteredData.map((item) => {
                    const vivinoUrl = `https://www.vivino.com/search/wines?q=${encodeURIComponent(item.name + ' ' + (item.vintage !== 'NV' ? item.vintage : ''))}`;
                    const countryStyle = COUNTRY_INFO[item.country] || { flag: '🍷', color: 'from-slate-900 to-slate-950 border-slate-800' };

                    return (
                      <div 
                        key={item.id} 
                        className={`bg-gradient-to-b ${countryStyle.color} border rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative shadow-lg hover:border-rose-500/50 transition`}
                      >
                        {/* 상단 라벨 헤더: 국기, 빈티지 골드 뱃지, 랙 위치 */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-700 text-slate-200 flex items-center gap-1.5 shadow-sm">
                              <span>{countryStyle.flag}</span>
                              <span>{item.country}</span>
                            </span>

                            <div className="flex items-center gap-1.5">
                              <span className="px-2.5 py-1 rounded-md text-xs font-black font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                {item.vintage}
                              </span>
                              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-950/60 text-rose-300 border border-rose-800/60">
                                📍 {item.rack}
                              </span>
                            </div>
                          </div>

                          {/* 와인 이름 (실제 텍스트 강조) */}
                          <h3 className="font-bold text-white text-base sm:text-lg leading-snug tracking-tight my-2 min-h-[3rem] flex items-center">
                            {item.name}
                          </h3>

                          {/* 비고 및 메모 */}
                          {item.note && (
                            <div className="mb-2">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                🏷️ {item.note}
                              </span>
                            </div>
                          )}

                          {/* 실물 사진 첨부 미리보기 (있을 경우만 표시) */}
                          {item.customImage && (
                            <div className="relative aspect-video rounded-xl overflow-hidden my-2 border border-slate-700">
                              <img src={item.customImage} alt={item.name} className="w-full h-full object-cover" />
                              <button
                                onClick={() => handleImageUpload(item.id, null)}
                                className="absolute top-1 right-1 p-1 bg-slate-900/80 rounded-full text-slate-300 hover:text-white"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 하단 컨트롤러: 모바일 친화적 대형 수량 조정 및 비비노/사진등록 */}
                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-2">
                          <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800">
                            <button
                              onClick={() => handleQtyChange(item.id, -1, '출고')}
                              className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-slate-200 transition touch-manipulation"
                              title="1병 출고"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <div className="w-12 text-center">
                              <span className={`text-base font-black font-mono block ${
                                item.currentQty <= 0 ? 'text-red-400' : 'text-emerald-400'
                              }`}>
                                {item.currentQty}
                              </span>
                              <span className="text-[9px] text-slate-500 block -mt-1 font-sans">현재고</span>
                            </div>
                            <button
                              onClick={() => handleQtyChange(item.id, 1, '입고')}
                              className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-slate-200 transition touch-manipulation"
                              title="1병 입고"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* 실물 사진 등록 버튼 */}
                            <label className="p-2 bg-slate-800 active:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 cursor-pointer touch-manipulation" title="실물 사진 첨부">
                              <Camera className="w-4 h-4" />
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => handleImageUpload(item.id, e.target.files[0])} 
                                className="hidden" 
                              />
                            </label>

                            {/* 비비노 공식 라벨/평점 확인 버튼 */}
                            <a
                              href={vivinoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-3 py-2 bg-slate-800 active:bg-rose-950/60 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition touch-manipulation"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
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

            {/* 2. 테이블 표 뷰 */}
            {viewMode === 'table' && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl sm:rounded-2xl overflow-hidden shadow-xl">
                <div className="sm:hidden px-3 py-2 bg-slate-950/60 border-b border-slate-800 text-[11px] text-slate-400">
                  👉 좌우로 밀어 전체 컬럼을 확인하세요
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse whitespace-nowrap">
                    <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                      <tr>
                        <th className="px-3 sm:px-4 py-3 font-semibold">원산지</th>
                        <th className="px-3 sm:px-5 py-3 font-semibold">와인명</th>
                        <th className="px-2 sm:px-3 py-3 font-semibold text-center">빈티지</th>
                        <th className="px-3 sm:px-4 py-3 font-semibold">보관위치</th>
                        <th className="px-3 sm:px-4 py-3 font-semibold text-center">현재고 (조정)</th>
                        <th className="px-3 sm:px-4 py-3 font-semibold">비고</th>
                        <th className="px-2 sm:px-3 py-3 font-semibold text-center">비비노</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredData.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-3 sm:px-4 py-3 text-slate-400">{item.country}</td>
                          <td className="px-3 sm:px-5 py-3 font-medium text-white max-w-xs truncate">{item.name}</td>
                          <td className="px-2 sm:px-3 py-3 text-slate-300 text-center font-mono">{item.vintage}</td>
                          <td className="px-3 sm:px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700">
                              {item.rack}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleQtyChange(item.id, -1, '출고')}
                                className="w-7 h-7 rounded bg-slate-800 active:bg-slate-700 text-slate-200 flex items-center justify-center touch-manipulation"
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
                                className="w-7 h-7 rounded bg-slate-800 active:bg-slate-700 text-slate-200 flex items-center justify-center touch-manipulation"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-amber-300/80 max-w-[120px] truncate">{item.note || '-'}</td>
                          <td className="px-2 sm:px-3 py-3 text-center">
                            <a
                              href={`https://www.vivino.com/search/wines?q=${encodeURIComponent(item.name + ' ' + (item.vintage !== 'NV' ? item.vintage : ''))}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center p-1.5 bg-slate-800 active:bg-slate-700 text-slate-300 rounded-lg touch-manipulation"
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

      {/* 변경 이력 (Audit Log & Undo) 팝업 모달 */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">수량 변경 이력 ({historyLogs.length}건)</h3>
              </div>
              <button onClick={() => setShowLogModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
              {historyLogs.length === 0 ? (
                <p className="text-center py-12 text-slate-500 text-sm">
                  아직 수량을 변경한 이력이 없습니다.
                </p>
              ) : (
                historyLogs.map(log => (
                  <div key={log.logId} className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.changeType.includes('입고') ? 'bg-blue-500/20 text-blue-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {log.changeType}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{log.time}</span>
                        <span className="text-[11px] text-slate-500">📍 {log.rack}</span>
                      </div>
                      <p className="font-semibold text-white text-xs sm:text-sm truncate">{log.name} ({log.vintage})</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        재고 변동: <span className="font-mono text-slate-300">{log.prevQty}병</span> ➔ <strong className="font-mono text-emerald-400">{log.newQty}병</strong>
                      </p>
                    </div>

                    <button
                      onClick={() => handleUndo(log)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-amber-300 rounded-lg text-xs font-semibold shrink-0 border border-amber-500/30 transition touch-manipulation"
                      title="이 변경을 원래대로 되돌립니다"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>실행 취소</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <span>* 수정한 모든 내역은 [수정본 저장] 시 엑셀에 함께 기록됩니다.</span>
              <button
                onClick={() => setShowLogModal(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}