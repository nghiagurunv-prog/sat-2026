'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sun, 
  Moon, 
  Edit3, 
  Eraser, 
  RotateCcw, 
  Flag, 
  Check, 
  X, 
  Divide, 
  Minus, 
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export interface QuestionCardProps {
  id?: string | number;
  questionId?: string;
  title?: string;
  passage?: string;
  full_passage?: string;
  question?: string;
  practice_question?: string;
  choices?: string[];
  selectedChoice?: string | number | null;
  onSelectChoice?: (choice: string, index: number) => void;
  isGridIn?: boolean;
  gridInAnswer?: string;
  onGridInChange?: (ans: string) => void;
  difficulty?: string;
  domain?: string;
  skillId?: string;
  explanation?: string;
  showExplanation?: boolean;
  disabled?: boolean;
  className?: string;
}

export function QuestionCard({
  id,
  questionId,
  title,
  passage,
  full_passage,
  question,
  practice_question,
  choices = [],
  selectedChoice,
  onSelectChoice,
  isGridIn = false,
  gridInAnswer = '',
  onGridInChange,
  difficulty,
  domain,
  skillId,
  explanation,
  showExplanation = false,
  disabled = false,
  className = '',
}: QuestionCardProps) {
  // ---------------------------------------------------------------------------
  // #C092: CHẾ ĐỘ ĐỌC DỊU MẮT (WARM SEPIA) CHO KHUNG VĂN BẢN
  // ---------------------------------------------------------------------------
  const [isSepia, setIsSepia] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sat_reading_sepia_mode');
      if (saved === 'true') setIsSepia(true);
    } catch {
      // Bỏ qua lỗi SSR / localStorage
    }
  }, []);

  const toggleSepia = () => {
    const next = !isSepia;
    setIsSepia(next);
    try {
      localStorage.setItem('sat_reading_sepia_mode', next ? 'true' : 'false');
    } catch {
      // Bỏ qua
    }
  };

  // ---------------------------------------------------------------------------
  // #C095: GIẤY NHÁP NHANH (SCRATCHPAD) & CANVAS VẼ TAY TOÁN HỌC
  // ---------------------------------------------------------------------------
  const [showScratchpad, setShowScratchpad] = useState<boolean>(false);
  const [scratchpadMode, setScratchpadMode] = useState<'calc' | 'draw'>('calc');
  const [scratchNotes, setScratchNotes] = useState<string>('');
  
  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [penColor, setPenColor] = useState<string>('#2563eb');
  const [penWidth, setPenWidth] = useState<number>(2);

  // Khởi tạo Canvas khi mở tab vẽ
  useEffect(() => {
    if (showScratchpad && scratchpadMode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [showScratchpad, scratchpadMode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // ---------------------------------------------------------------------------
  // #C096: NÚT CHÈN NHANH ĐÁP ÁN TỰ LUẬN TOÁN (GRID-IN / SPR) CHO MOBILE & IPAD
  // ---------------------------------------------------------------------------
  const handleInsertChar = (char: string) => {
    if (disabled || !onGridInChange) return;
    let next = gridInAnswer || '';

    // Chuẩn hóa quy tắc SPR College Board
    if (char === '-') {
      // Dấu âm chỉ được phép ở đầu
      if (next.startsWith('-')) {
        next = next.slice(1);
      } else {
        next = '-' + next;
      }
    } else if (char === '/') {
      // Chỉ cho phép 1 dấu gạch chéo và không đi cùng dấu '.'
      if (!next.includes('/') && !next.includes('.')) {
        next = next + '/';
      }
    } else if (char === '.') {
      // Chỉ cho phép 1 dấu chấm và không đi cùng dấu '/'
      if (!next.includes('.') && !next.includes('/')) {
        next = next + '.';
      }
    } else {
      next = next + char;
    }

    // Giới hạn độ dài chuẩn SAT (tối đa 5 ký tự dương, 6 ký tự âm)
    const maxLen = next.startsWith('-') ? 6 : 5;
    if (next.length <= maxLen) {
      onGridInChange(next);
    }
  };

  const handleBackspace = () => {
    if (disabled || !onGridInChange || !gridInAnswer) return;
    onGridInChange(gridInAnswer.slice(0, -1));
  };

  const handleClearGridIn = () => {
    if (disabled || !onGridInChange) return;
    onGridInChange('');
  };

  // ---------------------------------------------------------------------------
  // #C091, #C097, #C100: BÁO LỖI ĐỀ / GÓP Ý NHANH 1 CHẠM
  // ---------------------------------------------------------------------------
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>('typo');
  const [reportDetail, setReportDetail] = useState<string>('');
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);

  const handleSubmitReport = () => {
    try {
      const qKey = String(questionId || id || title || 'unknown_question');
      const existingReports = JSON.parse(localStorage.getItem('sat_reported_questions_v1') || '[]');
      const newReport = {
        questionId: qKey,
        title: title || 'Không có tiêu đề',
        reason: reportReason,
        detail: reportDetail.trim(),
        timestamp: new Date().toISOString(),
      };
      existingReports.push(newReport);
      localStorage.setItem('sat_reported_questions_v1', JSON.stringify(existingReports));
    } catch {
      // Bỏ qua lỗi storage
    }

    setReportSuccess(true);
    setTimeout(() => {
      setReportSuccess(false);
      setShowReportModal(false);
      setReportDetail('');
    }, 2000);
  };

  const passageContent = full_passage || passage;
  const questionText = practice_question || question;

  return (
    <div className={`relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors ${className}`}>
      {/* Header thanh công cụ câu hỏi */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {difficulty && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              difficulty.toLowerCase().includes('hard')
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                : difficulty.toLowerCase().includes('medium')
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
            }`}>
              {difficulty}
            </span>
          )}
          {domain && (
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {domain}
            </span>
          )}
          {title && (
            <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[200px] sm:max-w-xs">
              {title}
            </span>
          )}
        </div>

        {/* Nút hành động nhanh: Sepia & Báo lỗi */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* #C092: Chế độ Đọc dịu mắt Warm Sepia */}
          <button
            type="button"
            onClick={toggleSepia}
            aria-label="Chuyển chế độ đọc dịu mắt Sepia"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              isSepia
                ? 'bg-[#f0dfbe] text-[#5c4322] border border-[#d8c39e] shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700'
            }`}
            title="Bật/tắt chế độ màu vàng ấm Sepia chống mỏi mắt"
          >
            {isSepia ? <Sun className="w-3.5 h-3.5 text-amber-700" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isSepia ? 'Dịu mắt (Bật)' : 'Dịu mắt'}</span>
          </button>

          {/* #C091, #C097, #C100: Báo lỗi đề 1 chạm */}
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            aria-label="Báo lỗi câu hỏi"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
            title="Báo lỗi đề bài, đáp án hoặc công thức"
          >
            <Flag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Báo lỗi</span>
          </button>
        </div>
      </div>

      {/* Thân thẻ câu hỏi */}
      <div className={`p-4 sm:p-6 transition-colors ${
        isSepia 
          ? 'bg-[#fbf0d9] text-[#433422]' 
          : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
      }`}>
        {/* Đoạn văn (Passage) nếu có */}
        {passageContent && (
          <div className={`mb-6 p-4 rounded-xl border leading-relaxed text-sm sm:text-base ${
            isSepia
              ? 'bg-[#f5e7c8] border-[#e2d0af] text-[#3e2e1a]'
              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}>
            <div className="font-serif whitespace-pre-line selection:bg-amber-200 dark:selection:bg-amber-900/60">
              {passageContent}
            </div>
          </div>
        )}

        {/* Nội dung câu hỏi */}
        {questionText && (
          <div className="text-base sm:text-lg font-medium leading-snug mb-6">
            {questionText}
          </div>
        )}

        {/* ========================================================================= */}
        {/* #C096: ĐÁP ÁN TỰ LUẬN TOÁN (GRID-IN / SPR) VỚI BÀN PHÍM ẢO SIÊU TIỆN CHO IPAD */}
        {/* ========================================================================= */}
        {isGridIn ? (
          <div className="space-y-3 my-4">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Nhập đáp án tự luận (Student-Produced Response):
            </label>
            
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={gridInAnswer}
                onChange={(e) => onGridInChange && onGridInChange(e.target.value)}
                disabled={disabled}
                placeholder="Ví dụ: 7/8 hoặc 0.875"
                maxLength={6}
                className="w-48 sm:w-60 px-4 py-2.5 text-lg font-mono font-bold tracking-wider rounded-xl border-2 border-indigo-500/40 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                (Tối đa 5-6 ký tự số, dấu /, - hoặc .)
              </span>
            </div>

            {/* Bàn phím ảo bấm nhanh cho học sinh dùng điện thoại / tablet */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs font-medium text-slate-500 mr-1">Chèn nhanh:</span>
              <button
                type="button"
                onClick={() => handleInsertChar('/')}
                disabled={disabled}
                className="px-3 py-1.5 text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 active:scale-95 transition-transform"
                title="Dấu phân số /"
              >
                /
              </button>
              <button
                type="button"
                onClick={() => handleInsertChar('-')}
                disabled={disabled}
                className="px-3 py-1.5 text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 active:scale-95 transition-transform"
                title="Dấu âm -"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => handleInsertChar('.')}
                disabled={disabled}
                className="px-3 py-1.5 text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 active:scale-95 transition-transform"
                title="Dấu chấm thập phân ."
              >
                .
              </button>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleInsertChar(digit)}
                  disabled={disabled}
                  className="px-2.5 py-1.5 text-sm font-semibold bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 active:scale-95 transition-transform"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleBackspace}
                disabled={disabled || !gridInAnswer}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 rounded-lg border border-rose-200 dark:border-rose-800 active:scale-95 transition-transform"
                title="Xóa 1 ký tự"
              >
                ⌫
              </button>
              <button
                type="button"
                onClick={handleClearGridIn}
                disabled={disabled || !gridInAnswer}
                className="px-2.5 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 rounded-lg active:scale-95 transition-transform"
                title="Xóa trắng"
              >
                Xóa
              </button>
            </div>
          </div>
        ) : (
          /* Danh sách đáp án trắc nghiệm A, B, C, D */
          <div className="space-y-3 mb-6">
            {choices.map((choice, index) => {
              const letter = String.fromCharCode(65 + index);
              const isSelected = selectedChoice === choice || selectedChoice === index || selectedChoice === letter;
              return (
                <button
                  key={index}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectChoice && onSelectChoice(choice, index)}
                  className={`w-full flex items-start gap-3 p-3.5 sm:p-4 rounded-xl text-left border-2 transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 dark:border-indigo-400 font-semibold shadow-sm'
                      : isSepia
                      ? 'border-[#dec8a4] hover:bg-[#f3e3c0] text-[#3e2e1a]'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}>
                    {letter}
                  </span>
                  <div className="flex-1 text-sm sm:text-base leading-relaxed pt-0.5">
                    {choice}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Lời giải chi tiết nếu bật */}
        {showExplanation && explanation && (
          <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-sm leading-relaxed text-blue-900 dark:text-blue-200">
            <div className="font-semibold mb-1 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Lời giải chi tiết & Chiến thuật SAT:
            </div>
            <div className="whitespace-pre-line">{explanation}</div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* #C095: NÚT VÀ KHUNG GIẤY NHÁP NHANH (SCRATCHPAD & CANVAS DRAWING) */}
      {/* ========================================================================= */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowScratchpad(!showScratchpad)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 py-1 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{showScratchpad ? 'Thu gọn giấy nháp' : '✏️ Giấy nháp nhanh (Scratchpad)'}</span>
            {showScratchpad ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showScratchpad && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setScratchpadMode('calc')}
                className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                  scratchpadMode === 'calc'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Ghi chú / Nhẩm
              </button>
              <button
                type="button"
                onClick={() => setScratchpadMode('draw')}
                className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                  scratchpadMode === 'draw'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Vẽ tay (Canvas)
              </button>
            </div>
          )}
        </div>

        {/* Khung nội dung nháp */}
        {showScratchpad && (
          <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
            {scratchpadMode === 'calc' ? (
              <div className="space-y-1.5">
                <textarea
                  value={scratchNotes}
                  onChange={(e) => setScratchNotes(e.target.value)}
                  placeholder="Ghi chú nháp công thức, phép tính nhẩm tạm thời..."
                  rows={3}
                  className="w-full p-2.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>*Nháp chỉ lưu tạm thời trong phiên làm câu hỏi này</span>
                  <button
                    type="button"
                    onClick={() => setScratchNotes('')}
                    className="hover:text-rose-500 transition-colors"
                  >
                    Xóa nháp
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Màu bút:</span>
                    {['#2563eb', '#dc2626', '#16a34a', '#0f172a'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPenColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-4 h-4 rounded-full border ${penColor === c ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                      />
                    ))}
                    <span className="text-slate-500 ml-2">Nét:</span>
                    {[2, 4].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setPenWidth(w)}
                        className={`px-1.5 py-0.5 rounded text-[10px] ${penWidth === w ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-slate-600'}`}
                      >
                        {w}px
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 font-medium"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Làm sạch</span>
                  </button>
                </div>
                <div className="relative border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white touch-none">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={160}
                    className="w-full h-40 cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL BÁO LỖI ĐỀ / GÓP Ý NHANH (#C091, #C097, #C100) */}
      {/* ========================================================================= */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                  <Flag className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                  Báo lỗi câu hỏi SAT
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Đã ghi nhận phản hồi!
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Cảm ơn bạn! Đội ngũ học thuật SAT.Guru sẽ kiểm tra và cập nhật ngân hàng câu hỏi sớm nhất.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Vui lòng chọn loại lỗi gặp phải:
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { id: 'typo', label: 'Lỗi chính tả / dịch' },
                      { id: 'wrong_ans', label: 'Sai đáp án / giải thích' },
                      { id: 'katex_error', label: 'Lỗi công thức KaTeX / hình' },
                      { id: 'other', label: 'Lỗi giao diện / khác' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setReportReason(item.id)}
                        className={`p-2.5 rounded-xl border text-left font-medium transition-all ${
                          reportReason === item.id
                            ? 'border-rose-500 bg-rose-50/60 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mô tả chi tiết (tùy chọn):
                  </label>
                  <textarea
                    value={reportDetail}
                    onChange={(e) => setReportDetail(e.target.value)}
                    placeholder="Mô tả cụ thể để ban học thuật xử lý nhanh hơn..."
                    rows={3}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitReport}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
                  >
                    Gửi phản hồi
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
