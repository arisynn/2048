
import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- STYLING & COLORS (Pastel / Macaron yang Nyaman) ---
const COLORS = {
  bg: '#FFF8F3', 
  board: '#EBDCD0',
  line: '#FF8B54', 
  loopLine: '#10B981', // Garis hijau saat membentuk Supernova Loop
  textBase: '#7A6B63',
  tiles: {
    2: 'bg-[#FFE4D6] text-[#7A6B63]',
    4: 'bg-[#FFD4B8] text-[#7A6B63]',
    8: 'bg-[#FFAD87] text-white',
    16: 'bg-[#FF8B54] text-white',
    32: 'bg-[#FF6955] text-white shadow-sm',
    64: 'bg-[#FF4838] text-white shadow-md',
    128: 'bg-[#FFD45E] text-white shadow-md',
    256: 'bg-[#FFCA3A] text-white shadow-lg',
    512: 'bg-[#FFBF1A] text-white shadow-lg',
    1024: 'bg-[#FFB000] text-white shadow-xl',
    2048: 'bg-[#FF9D00] text-white shadow-2xl',
    4096: 'bg-[#F43F5E] text-white shadow-[0_0_30px_rgba(244,63,94,0.8)]',
    8192: 'bg-[#8B5CF6] text-white shadow-[0_0_40px_rgba(139,92,246,0.9)]',
    super: 'bg-[#3D3A33] text-[#FFE4D6] shadow-[0_0_50px_rgba(61,58,51,1)]',
  }
};

const ROWS = 6;
const COLS = 5;

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function App() {
  const [board, setBoard] = useState([]);
  const [score, setScore] = useState(0);
  const [chain, setChain] = useState([]); // Array of {r, c, val}
  const [isLooping, setIsLooping] = useState(false); // Status Supernova
  const [era, setEra] = useState(1); // Level Papan
  const boardRef = useRef(null);

  // --- SISTEM EVOLUSI ERA (Auto-Scaling Drops) ---
  const getEraLevel = useCallback((currentBoard) => {
    let max = 2;
    currentBoard.forEach(row => row.forEach(t => { if (t && t.value > max) max = t.value; }));
    
    if (max >= 2048) return 4; // Era 4: Drop 16 & 32 (Super Late Game)
    if (max >= 512) return 3;  // Era 3: Drop 8 & 16
    if (max >= 128) return 2;  // Era 2: Drop 4 & 8
    return 1;                  // Era 1: Drop 2 & 4
  }, []);

  const getRandomValueForEra = useCallback((currentEra) => {
    const chance = Math.random();
    switch (currentEra) {
      case 4: return chance > 0.7 ? 32 : 16;
      case 3: return chance > 0.7 ? 16 : 8;
      case 2: return chance > 0.7 ? 8 : 4;
      case 1: 
      default: return chance > 0.7 ? 4 : 2;
    }
  }, []);

  // --- INISIALISASI ---
  const initializeBoard = useCallback(() => {
    const newBoard = Array(ROWS).fill(null).map(() => 
      Array(COLS).fill(null).map(() => ({
        value: Math.random() > 0.8 ? 4 : 2,
        id: generateId(),
        isNew: true
      }))
    );
    setBoard(newBoard);
    setScore(0);
    setChain([]);
    setIsLooping(false);
    setEra(1);
  }, []);

  useEffect(() => { initializeBoard(); }, [initializeBoard]);

  // Bersihkan efek animasi
  useEffect(() => {
    const timer = setTimeout(() => {
      setBoard(prev => prev.map(row => row.map(t => t ? { ...t, isNew: false, isMerged: false } : null)));
    }, 300);
    return () => clearTimeout(timer);
  }, [board]);

  // --- LOGIKA KONEKSI & SUPERNOVA (DRAW & LINK) ---
  const getCoords = (e) => {
    if (!boardRef.current) return { r: -1, c: -1 };
    const rect = boardRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Hitung posisi dengan akurasi persentase
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // Pastikan sentuhan ada di dalam area papan
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return { r: -1, c: -1 };

    const c = Math.floor(x / (rect.width / COLS));
    const r = Math.floor(y / (rect.height / ROWS));
    
    return { r, c };
  };

  const handlePointerDown = (e) => {
    e.preventDefault(); 
    const { r, c } = getCoords(e);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c]) {
      setChain([{ r, c, val: board[r][c].value }]);
      setIsLooping(false);
    }
  };

  const handlePointerMove = (e) => {
    if (chain.length === 0) return;
    
    const { r, c } = getCoords(e);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || !board[r][c]) return;

    const targetVal = board[r][c].value;
    const lastNode = chain[chain.length - 1];
    
    if (lastNode.r === r && lastNode.c === c) return; // Sedang diam di tempat

    // 1. Cek fitur UNDO (Mundur)
    if (chain.length > 1) {
      const prevNode = chain[chain.length - 2];
      if (prevNode.r === r && prevNode.c === c) {
        setChain(prev => prev.slice(0, -1));
        setIsLooping(false); // Batal loop kalau mundur
        return;
      }
    }

    // Jika sudah dalam mode loop, tidak boleh nambah garis lagi kecuali undo
    if (isLooping) return;

    // Cek apakah bersentuhan (Horizontal, Vertikal, Diagonal)
    const isAdjacent = Math.abs(lastNode.r - r) <= 1 && Math.abs(lastNode.c - c) <= 1;

    if (isAdjacent) {
      // 2. Cek fitur SUPERNOVA LOOP (Menyentuh node yang sudah ada di rantai)
      const existingNodeIndex = chain.findIndex(n => n.r === r && n.c === c);
      
      if (existingNodeIndex !== -1) {
        // Hanya bisa loop jika nilainya sama dengan nilai ujung rantai
        if (chain[existingNodeIndex].val === lastNode.val && chain.length >= 4) {
          setIsLooping(true);
        }
        return; // Jangan tambahkan node ganda ke rantai
      }

      // 3. Menambah Rantai Baru
      // Aturan: Sama nilainya, ATAU 2x lipat dari ujung rantai
      if (targetVal === lastNode.val || (chain.length > 1 && targetVal === lastNode.val * 2)) {
        setChain(prev => [...prev, { r, c, val: targetVal }]);
      }
    }
  };

  const handlePointerUp = () => {
    if (chain.length < 2) {
      setChain([]);
      setIsLooping(false);
      return;
    }

    let newBoard = board.map(row => [...row]);
    let totalSum = 0;
    let nodesToClear = [];

    // --- KALKULASI SKOR & NODE YANG DIHAPUS ---
    if (isLooping) {
      // MODE SUPERNOVA: Sedot SEMUA angka yang sama di papan
      const loopValue = chain[chain.length - 1].val;
      newBoard.forEach((row, rIdx) => {
        row.forEach((tile, cIdx) => {
          if (tile && tile.value === loopValue) {
            nodesToClear.push({ r: rIdx, c: cIdx });
            totalSum += tile.value;
          }
        });
      });
      // Plus bonus sum dari chain sebelumnya jika merambat naik (e.g., 2->4->4->[Loop 4])
      chain.forEach(n => {
         if(n.val !== loopValue) totalSum += n.val;
      });
    } else {
      // MODE NORMAL: Sedot yang ada di garis saja
      nodesToClear = [...chain];
      totalSum = chain.reduce((acc, node) => acc + node.val, 0);
    }

    // Cari pangkat 2 terdekat yang lebih besar/sama dengan total
    const finalValue = Math.pow(2, Math.ceil(Math.log2(totalSum))); 

    // Kosongkan node
    nodesToClear.forEach(node => {
      newBoard[node.r][node.c] = null;
    });

    // Tempatkan angka raksasa di posisi jari terakhir
    const lastNode = chain[chain.length - 1];
    newBoard[lastNode.r][lastNode.c] = {
      value: finalValue,
      id: generateId(),
      isMerged: true // Memicu animasi Pop
    };

    // Tambah Skor (Bonus gila untuk Supernova)
    const baseScore = finalValue * chain.length;
    setScore(s => s + (isLooping ? baseScore * 3 : baseScore)); 

    // --- UPDATE ERA (Level Papan) ---
    const newEra = getEraLevel(newBoard);
    if (newEra > era) setEra(newEra);

    // --- GRAVITASI & SPAWN ---
    for (let c = 0; c < COLS; c++) {
      let emptyCount = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (newBoard[r][c] === null) {
          emptyCount++;
        } else if (emptyCount > 0) {
          newBoard[r + emptyCount][c] = newBoard[r][c]; // Jatuh
          newBoard[r][c] = null;
        }
      }
      // Isi ruang kosong dari atas menggunakan angka sesuai ERA
      for (let r = 0; r < emptyCount; r++) {
        newBoard[r][c] = {
          value: getRandomValueForEra(newEra),
          id: generateId(),
          isNew: true
        };
      }
    }

    setBoard(newBoard);
    setChain([]);
    setIsLooping(false);
  };

  // --- RENDER VISUAL ---
  const renderLines = () => {
    if (chain.length < 2) return null;
    const lines = [];
    const lineColor = isLooping ? COLORS.loopLine : COLORS.line;

    for (let i = 0; i < chain.length - 1; i++) {
      const start = chain[i];
      const end = chain[i + 1];
      const x1 = `${(start.c + 0.5) * (100 / COLS)}%`;
      const y1 = `${(start.r + 0.5) * (100 / ROWS)}%`;
      const x2 = `${(end.c + 0.5) * (100 / COLS)}%`;
      const y2 = `${(end.r + 0.5) * (100 / ROWS)}%`;

      lines.push(
        <line 
          key={`line-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} 
          stroke={lineColor} strokeWidth="14" strokeLinecap="round"
          className={isLooping ? 'animate-pulse drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'opacity-80 drop-shadow-md'}
        />
      );
    }

    // Jika sedang loop, gambar garis virtual menyambung ke titik awal loop
    if (isLooping) {
      const end = chain[chain.length - 1];
      // Cari node tempat dia nyangkut
      const loopStartNode = chain.find(n => n.val === end.val); 
      if (loopStartNode) {
        const x1 = `${(end.c + 0.5) * (100 / COLS)}%`;
        const y1 = `${(end.r + 0.5) * (100 / ROWS)}%`;
        const x2 = `${(loopStartNode.c + 0.5) * (100 / COLS)}%`;
        const y2 = `${(loopStartNode.r + 0.5) * (100 / ROWS)}%`;
        lines.push(
          <line 
            key="line-loop-close" x1={x1} y1={y1} x2={x2} y2={y2} 
            stroke={lineColor} strokeWidth="14" strokeLinecap="round" strokeDasharray="10 10"
            className="animate-pulse drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]"
          />
        );
      }
    }
    return lines;
  };

  // Kalkulasi Preview Angka
  let currentChainPreview = null;
  if (chain.length >= 2) {
    if (isLooping) {
      // Hitung semua di papan
      let sum = 0;
      const loopValue = chain[chain.length - 1].val;
      board.forEach(r => r.forEach(t => { if(t && t.value === loopValue) sum += t.value; }));
      chain.forEach(n => { if(n.val !== loopValue) sum += n.val; });
      currentChainPreview = Math.pow(2, Math.ceil(Math.log2(sum)));
    } else {
      currentChainPreview = Math.pow(2, Math.ceil(Math.log2(chain.reduce((a, b) => a + b.val, 0))));
    }
  }

  // Efek glow untuk background sesuai Era
  const eraBgColors = ['#FFF8F3', '#FFF1E6', '#FFEDD5', '#FFE4E6']; 

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans select-none overflow-hidden transition-colors duration-1000" style={{ backgroundColor: eraBgColors[era-1], color: COLORS.textBase }}>
      
      <style>{`
        @keyframes dropIn { from { transform: translateY(-80%); opacity: 0.5; } to { transform: translateY(0); opacity: 1; } }
        @keyframes popMerge { 0% { transform: scale(1); } 50% { transform: scale(1.25); filter: brightness(1.3); } 100% { transform: scale(1); } }
        @keyframes supernovaGlow { 0%, 100% { filter: brightness(1); transform: scale(1); } 50% { filter: brightness(1.2); transform: scale(0.95); box-shadow: 0 0 20px #10B981; } }
        .anim-drop { animation: dropIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .anim-merge { animation: popMerge 0.3s ease-out; }
        .supernova-target { animation: supernovaGlow 1s infinite; border: 3px solid #10B981; }
      `}</style>

      {/* --- HEADER --- */}
      <div className="w-full max-w-[380px] flex justify-between items-end mb-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-[#FF8B54] drop-shadow-sm leading-none">
            2048<span className="text-[#FFAD87]">LINK</span>
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-black/5 px-2 py-1 rounded-md">
              Era {era}
            </span>
            <span className="text-[9px] text-[#FF8B54] font-bold">
              (Drop: {era === 1 ? '2,4' : era === 2 ? '4,8' : era === 3 ? '8,16' : '16,32'})
            </span>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-md px-5 py-2 rounded-2xl shadow-sm flex flex-col items-end">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#B5A599]">Skor Tertinggi</span>
          <span className="text-2xl font-black text-[#7A6B63]">{score}</span>
        </div>
      </div>

      {/* --- PANDUAN PREVIEW & NOTIFIKASI --- */}
      <div className="h-14 w-full max-w-[380px] mb-2 flex items-center justify-center relative">
        {isLooping && (
          <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
             <span className="text-2xl font-black text-[#10B981] animate-bounce drop-shadow-lg tracking-widest">SUPERNOVA!</span>
          </div>
        )}
        {!isLooping && currentChainPreview && (
          <div className="flex items-center gap-3 animate-in fade-in zoom-in duration-200">
            <span className="font-bold text-[#FF8B54] uppercase tracking-widest text-xs">Menjadi</span>
            <div className={`px-4 py-1.5 rounded-xl font-black text-2xl text-white shadow-lg ${COLORS.tiles[currentChainPreview] || COLORS.tiles.super}`}>
              {currentChainPreview}
            </div>
            <span className="font-bold text-[#FF8B54] text-xs">x{chain.length}</span>
          </div>
        )}
      </div>

      {/* --- PAPAN MAIN --- */}
      <div 
        ref={boardRef}
        className="relative p-2 rounded-[2rem] shadow-[0_12px_40px_rgba(181,165,153,0.35)] border-4 border-white/80 w-full max-w-[380px] aspect-[5/6] touch-none"
        style={{ backgroundColor: COLORS.board }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ padding: '0.5rem' }}>
          {renderLines()}
        </svg>

        <div className="grid grid-cols-5 grid-rows-6 gap-2 w-full h-full relative z-20">
          {board.map((row, rIdx) => (
            row.map((tile, cIdx) => {
              if (!tile) return <div key={`empty-${rIdx}-${cIdx}`} className="rounded-xl bg-[#D6C5B3]/20" />;

              const bgClass = COLORS.tiles[tile.value] || COLORS.tiles.super;
              const isChained = chain.some(n => n.r === rIdx && n.c === cIdx);
              
              // Cek apakah tile ini menjadi target Supernova (nilainya sama dengan nilai loop)
              const isSupernovaTarget = isLooping && tile.value === chain[chain.length-1].val;
              
              let animClass = tile.isNew ? 'anim-drop' : tile.isMerged ? 'anim-merge' : '';
              let specialClass = isSupernovaTarget ? 'supernova-target' : '';

              return (
                <div 
                  key={tile.id}
                  className={`w-full h-full rounded-2xl flex items-center justify-center font-bold text-xl md:text-2xl cursor-pointer
                    ${bgClass} ${animClass} ${specialClass}
                    ${isChained && !isLooping ? 'scale-90 ring-4 ring-white/70 shadow-inner brightness-110' : 'transition-transform hover:scale-[1.02]'}
                  `}
                  style={{ boxShadow: (isChained || isSupernovaTarget) ? 'inset 0 4px 8px rgba(0,0,0,0.1)' : '0 4px 0 rgba(0,0,0,0.1)' }}
                >
                  {tile.value}
                </div>
              );
            })
          ))}
        </div>
      </div>

      {/* --- KONTROL BAWAH --- */}
      <div className="w-full max-w-[380px] mt-6 flex justify-between items-start px-2">
        <div className="text-[11px] font-medium opacity-60 leading-relaxed max-w-[250px]">
          <strong className="text-[#10B981]">SUPERNOVA:</strong> Buat garis melingkar (ujung bertemu ekor) untuk menghisap <strong>SEMUA</strong> angka yang sama di papan!<br/>
          <strong className="text-[#FF8B54] mt-1 block">ERA SYSTEM:</strong> Buat angka besar untuk meningkatkan level drop. Angka 2 akan lenyap selamanya!
        </div>
        <button 
          onClick={initializeBoard}
          className="bg-white text-[#FF8B54] font-black py-3 px-5 rounded-2xl shadow-sm border-2 border-[#FFE4D6] hover:bg-[#FFF8F3] active:scale-95 transition-all text-xs uppercase tracking-widest"
        >
          Reset
        </button>
      </div>

    </div>
  );
}

