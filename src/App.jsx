import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { 
  Wine, Search, Layers, AlertTriangle, Download,
  ExternalLink, LayoutGrid, Table, Plus, Minus, 
  Grid3X3, History, RotateCcw, X, Camera,
  ChevronDown, ChevronUp, PlusCircle, Image as ImageIcon, Trash2
} from 'lucide-react';

const COUNTRY_INFO = {
  '프랑스': { flag: '🇫🇷', color: 'from-blue-950/40 to-slate-900 border-blue-500/30' },
  '미국': { flag: '🇺🇸', color: 'from-red-950/40 to-slate-900 border-red-500/30' },
  '이탈리아': { flag: '🇮🇹', color: 'from-emerald-950/40 to-slate-900 border-emerald-500/30' },
  '스페인': { flag: '🇪🇸', color: 'from-amber-950/40 to-slate-900 border-amber-500/30' },
  '호주': { flag: '🇦🇺', color: 'from-cyan-950/40 to-slate-900 border-cyan-500/30' },
  '칠레': { flag: '🇨🇱', color: 'from-rose-950/40 to-slate-900 border-rose-500/30' },
  '포르투갈': { flag: '🇵🇹', color: 'from-orange-950/40 to-slate-900 border-orange-500/30' },
};

const COMMON_RACKS = [
  ...Array.from({ length: 27 }, (_, i) => `${i + 1}번랙`),
  '중앙랙(1번줄)', '중앙랙(2번줄)', '중앙랙(3번줄)', '중앙랙(4번줄)', '중앙랙(5번줄)', '중앙랙(6번줄)',
  '1번랙(천장)', '4,7번랙(천장)', '샴페인박스(1)', '샴페인박스(2)', '나라셀러박스', '삼도빌딩박스', '직접입력'
];

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
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
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function mapFromDb(row) {
  return {
    id: Number(row.id),
    country: row.country,
    name: row.name,
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
  const [onlyOutOfStock, setOnlyOutOfStock] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showRackMap, setShowRackMap] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingImageWine, setEditingImageWine] = useState(null);
  const [inputImageUrl, setInputImageUrl] = useState('');

  const [newWineForm, setNewWineForm] = useState({
    country: '프랑스',
    name: '',
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
          const initialData = rows.filter(r => r && r[1]).map((r, i) => ({
            id: i + 1,
            country: String(r[0] || '기타').trim(),
            name: String(r[1] || '').trim(),
            vintage: String(r[2] || 'NV').trim(),
            rack: String(r[3] || '미지정').trim(),
            in_qty: Number(r[4]) || 0,
            out_qty: Number(r[5]) || 0,
            current_qty: Number(r[6]) || 0,
            status: String(r[7] || '정상').trim(),
            note: String(r[8] || '').trim(),
            custom_image: null
          }));

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

  const handleAddNewWine = async (e) => {
    e.preventDefault();
    if (!newWineForm.name.trim()) return;

    const targetRack = newWineForm.rack === '직접입력' 
      ? (newWineForm.customRack.trim() || '미지정') 
      : newWineForm.rack;
    const newWineId = Date.now();
    const initialQty = Math.max(1, Number(newWineForm.qty) || 1);

    const newWineDb = {
      id: newWineId,
      country: newWineForm.country,
      name: newWineForm.name.trim(),
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

    setNewWineForm({ country: '프랑스', name: '', vintage: 'NV', rack: '1번랙', customRack: '', qty: 1, note: '' });
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
    await supabase.from('wines').update({
      current_qty: log.prevQty,
      status: log.prevQty <= 0 ? '재고없음' : '정상'
    }).eq('id', log.wineId);

    await supabase.from('wine_logs').delete().eq('log_id', log.logId);
    setHistoryLogs(prev => prev.filter(l => l.logId !== log.logId));
  };

  const handleDownloadExcel = () => {
    if (stockData.length === 0) return;
    const stockSheetData = [
      ['와 인 재 고 현 황'],
      ['원산지', '와인명', '빈티지', '보관위치', '총 입고량', '총 출고량', '현재고', '상태', '비고', '이미지링크']
    ];
    stockData.forEach(item => {
      stockSheetData.push([
        item.country, item.name, item.vintage, item.rack,
        item.inQty, item.outQty, item.currentQty, item.status, item.note,
        item.customImage && item.customImage.startsWith('http') ? item.customImage : ''
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Wine className="w-10 h-10 text-rose-500 animate-bounce" />
        <p className="text-sm font-medium">클라우드 데이터베이스와 실시간 연결 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-28">
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-30 px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 bg-rose-600/20 text-rose-500 rounded-xl border border-rose-500/30 shrink-0">
              <Wine className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-xl font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
                서울석유 2층 와인창고
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="실시간 클라우드 연결됨" />
              </h1>
              <p className="text-[10px] sm:text-xs text-emerald-400 truncate">
                클라우드 실시간 동기화 활성화됨
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-2.5 sm:px-3.5 py-2 bg-rose-600 active:bg-rose-700 hover:bg-rose-500 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-md shadow-rose-950/50 touch-manipulation"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
              <span>와인추가</span>
            </button>

            <button
              onClick={() => setShowLogModal(true)}
              className="relative flex items-center gap-1 px-2.5 sm:px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-medium border border-slate-700 transition touch-manipulation"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>이력</span>
              {historyLogs.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-500 text-slate-950 rounded-full">
                  {historyLogs.length}
                </span>
              )}
            </button>

            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-2 bg-emerald-600 active:bg-emerald-700 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-emerald-950/40 touch-manipulation"
            >
              <Download className="w-3.5 h-3.5" />
              <span>엑셀다운</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
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
              <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" /> <span className="truncate">와인 라벨</span>
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
                <span className="text-xs sm:text-sm font-bold text-white block">2층 창고 랙(Rack) 구조 맵</span>
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
                  <button onClick={() => setSelectedRack('전체')} className="text-xs text-rose-400 font-semibold hover:underline">
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
            </div>
          )}
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-slate-900/80 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-3">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="와인명, 빈티지, 비고 검색..."
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

        {/* 갤러리 카드 뷰 */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
            {filteredData.map((item) => {
              const countryStyle = COUNTRY_INFO[item.country] || { flag: '🍷', color: 'from-slate-900 to-slate-950 border-slate-800' };
              const vivinoUrl = `https://www.vivino.com/search/wines?q=${encodeURIComponent(item.name + ' ' + (item.vintage !== 'NV' ? item.vintage : ''))}`;

              return (
                <div key={item.id} className={`bg-gradient-to-b ${countryStyle.color} border rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative shadow-lg hover:border-rose-500/50 transition`}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-700 text-slate-200 flex items-center gap-1.5 shadow-sm">
                        <span>{countryStyle.flag}</span>
                        <span>{item.country}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-md text-xs font-black font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">{item.vintage}</span>
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-950/60 text-rose-300 border border-rose-800/60">📍 {item.rack}</span>
                      </div>
                    </div>

                    {item.customImage ? (
                      <div onClick={() => setEditingImageWine(item)} className="relative aspect-[16/10] rounded-xl overflow-hidden my-2.5 bg-slate-950/80 border border-slate-700 flex items-center justify-center cursor-pointer group">
                        <img src={item.customImage} alt={item.name} className="max-h-full object-contain drop-shadow-md group-hover:scale-105 transition" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs text-white gap-1 font-semibold">
                          <Camera className="w-4 h-4" /> 사진 변경
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setEditingImageWine(item)} className="w-full aspect-[16/8] rounded-xl my-2.5 border border-dashed border-slate-700/80 bg-slate-950/30 hover:bg-slate-850 hover:border-rose-500/50 transition flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-rose-300">
                        <ImageIcon className="w-5 h-5 opacity-70" />
                        <span className="text-xs font-medium">+ 사진 / 라벨 등록 (자동검색)</span>
                      </button>
                    )}

                    <h3 className="font-bold text-white text-base sm:text-lg leading-snug tracking-tight my-1.5 min-h-[2.75rem] flex items-center">{item.name}</h3>
                    {item.note && (<span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 mb-2">🏷️ {item.note}</span>)}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800">
                      <button onClick={() => handleQtyChange(item.id, -1, '출고')} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-slate-200 transition touch-manipulation"><Minus className="w-4 h-4" /></button>
                      <div className="w-12 text-center">
                        <span className={`text-base font-black font-mono block ${item.currentQty <= 0 ? 'text-red-400' : 'text-emerald-400'}`}>{item.currentQty}</span>
                        <span className="text-[9px] text-slate-500 block -mt-1 font-sans">현재고</span>
                      </div>
                      <button onClick={() => handleQtyChange(item.id, 1, '입고')} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-slate-200 transition touch-manipulation"><Plus className="w-4 h-4" /></button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setEditingImageWine(item)} className="p-2 bg-slate-800 active:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 touch-manipulation"><Camera className="w-4 h-4" /></button>
                      <a href={vivinoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-3 py-2 bg-slate-800 active:bg-rose-950/60 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition touch-manipulation">
                        <ExternalLink className="w-3.5 h-3.5" /> <span>Vivino</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

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
              <a
                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(editingImageWine.name + ' ' + (editingImageWine.vintage !== 'NV' ? editingImageWine.vintage : '') + ' wine bottle label')}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Search className="w-3.5 h-3.5" /> <span>구글에서 사진 찾기</span>
              </a>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">방법 2. 이미지 주소(URL) 붙여넣기</span>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://... 이미지 주소 붙여넣기"
                  value={inputImageUrl}
                  onChange={(e) => setInputImageUrl(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">와인명 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 샤또 마고, 오퍼스 원 등"
                  value={newWineForm.name}
                  onChange={(e) => setNewWineForm({ ...newWineForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">국가</label>
                  <select value={newWineForm.country} onChange={(e) => setNewWineForm({ ...newWineForm, country: e.target.value })} className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500">
                    <option value="프랑스">🇫🇷 프랑스</option><option value="미국">🇺🇸 미국</option><option value="이탈리아">🇮🇹 이탈리아</option>
                    <option value="스페인">🇪🇸 스페인</option><option value="호주">🇦🇺 호주</option><option value="칠레">🇨🇱 칠레</option><option value="기타">🍷 기타</option>
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
                <button type="submit" className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-950/50">등록 완료</button>
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
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.changeType.includes('등록') ? 'bg-emerald-500/20 text-emerald-300' : log.changeType.includes('입고') ? 'bg-blue-500/20 text-blue-300' : 'bg-rose-500/20 text-rose-300'}`}>{log.changeType}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{log.time}</span>
                      <span className="text-[11px] text-slate-500">📍 {log.rack}</span>
                    </div>
                    <p className="font-semibold text-white text-xs sm:text-sm truncate">{log.name} ({log.vintage})</p>
                    <p className="text-xs text-slate-400 mt-0.5">재고 변동: <span className="font-mono text-slate-300">{log.prevQty}병</span> ➔ <strong className="font-mono text-emerald-400">{log.newQty}병</strong></p>
                  </div>
                  <button onClick={() => handleUndo(log)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-semibold shrink-0 border border-amber-500/30 transition touch-manipulation">
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