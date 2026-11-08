'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  Calculator,
  X,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';

export type DesmosSizeMode = 'normal' | 'large' | 'split';

export interface DesmosSnippet {
  id: string;
  name: string;
  code: string;
  desc: string;
  category: 'regression' | 'algebra' | 'geometry' | 'system';
}

export const DESMOS_QUICK_SNIPPETS: DesmosSnippet[] = [
  {
    id: 'linear-reg',
    name: 'Hồi quy bậc 1: y_1 ~ m x_1 + b',
    code: 'y_1 ~ m x_1 + b',
    desc: 'Lập bảng x1, y1 rồi tìm hệ số góc m và tung độ gốc b ngay tức thì.',
    category: 'regression',
  },
  {
    id: 'vertex-parabola',
    name: 'Đỉnh Parabol: y = a(x-h)^2 + k',
    code: 'y = a(x-h)^2 + k',
    desc: 'Xác định nhanh tọa độ đỉnh (h, k) và bề lõm a của đồ thị parabol.',
    category: 'algebra',
  },
  {
    id: 'circle-eq',
    name: 'Phương trình đường tròn: (x-h)^2 + (y-k)^2 = r^2',
    code: '(x-h)^2 + (y-k)^2 = r^2',
    desc: 'Đồ thị đường tròn tâm (h, k) và bán kính r chuẩn dạng SAT.',
    category: 'geometry',
  },
  {
    id: 'system-eq',
    name: 'Hệ PT: Giải giao điểm',
    code: 'y = 2x + 1\ny = -x + 4',
    desc: 'Gõ 2 phương trình trên 2 dòng, nhấp chuột vào giao điểm màu xám để đọc nghiệm (x, y).',
    category: 'system',
  },
  {
    id: 'quad-reg',
    name: 'Hồi quy Parabol: y_1 ~ a x_1^2 + b x_1 + c',
    code: 'y_1 ~ a x_1^2 + b x_1 + c',
    desc: 'Hồi quy bậc 2 đi qua 3 điểm cho trước trong đề bài.',
    category: 'regression',
  },
  {
    id: 'exp-reg',
    name: 'Hàm mũ: y_1 ~ a b^{x_1}',
    code: 'y_1 ~ a b^{x_1}',
    desc: 'Tìm tốc độ tăng trưởng / phân rã hàm số mũ.',
    category: 'algebra',
  },
];

export interface DesmosCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  sizeMode?: DesmosSizeMode;
  onToggleSize?: () => void;
  onCopySnippet?: (code: string) => void;
  className?: string;
}

export function DesmosCalculator({
  isOpen,
  onClose,
  sizeMode: controlledSizeMode,
  onToggleSize,
  onCopySnippet,
  className = '',
}: DesmosCalculatorProps) {
  const [internalSizeMode, setInternalSizeMode] = useState<DesmosSizeMode>('normal');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSnippets, setShowSnippets] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // #039: Keep Desmos mounted once opened so graphs/sliders/regression tables persist
  const hasOpenedRef = useRef<boolean>(false);
  if (isOpen) {
    hasOpenedRef.current = true;
  }

  const activeSizeMode = controlledSizeMode || internalSizeMode;

  const handleCopy = useCallback(
    async (snippet: DesmosSnippet) => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(snippet.code);
        }
        setCopiedId(snippet.id);
        setToastMessage(`Đã chép: ${snippet.name.split(':')[0]}`);
        if (onCopySnippet) {
          onCopySnippet(snippet.code);
        }
        setTimeout(() => {
          setCopiedId(null);
          setToastMessage(null);
        }, 2200);
      } catch (err) {
        console.error('Lỗi sao chép công thức:', err);
      }
    },
    [onCopySnippet]
  );

  const handleCycleSize = useCallback(() => {
    if (onToggleSize) {
      onToggleSize();
      return;
    }
    setInternalSizeMode((prev) => {
      if (prev === 'normal') return 'large';
      if (prev === 'large') return 'split';
      return 'normal';
    });
  }, [onToggleSize]);

  const handleReloadIframe = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = 'https://www.desmos.com/calculator?embed';
    }
  }, []);

  if (!isOpen && !hasOpenedRef.current) return null;

  // Size styling
  const sizeStyles = {
    normal: 'w-[480px] h-[580px] bottom-6 right-6',
    large: 'w-[720px] h-[680px] bottom-4 right-4',
    split: 'w-full md:w-[50vw] h-[calc(100vh-64px)] top-16 right-0 rounded-none border-l',
  }[activeSizeMode];

  return (
    <div
      role="dialog"
      aria-label="Desmos Graphing Calculator"
      aria-hidden={!isOpen}
      className={`fixed z-50 ${isOpen ? 'flex' : 'hidden pointer-events-none'} flex-col bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl rounded-xl overflow-hidden transition-all duration-200 ${sizeStyles} ${className}`}
    >
      {/* Toast thông báo chép công thức */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-bounce">
          <Check className="w-3.5 h-3.5" />
          <span>{toastMessage} — Đã chép công thức!</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 select-none">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                Desmos Graphing Calculator
              </span>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                Chuẩn College Board
              </span>
            </div>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleReloadIframe}
            title="Làm mới máy tính Desmos"
            className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleCycleSize}
            title={activeSizeMode === 'large' ? 'Thu nhỏ' : 'Phóng to'}
            className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {activeSizeMode === 'large' ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Đóng máy tính (Alt+C)"
            className="p-1 text-slate-500 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* #C014: Thanh Mẫu lệnh nhanh Desmos (1-Click Copy) */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-xs">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>⚡ Mẫu lệnh nhanh Desmos (1-Click Copy)</span>
          </div>
          <button
            type="button"
            onClick={() => setShowSnippets(!showSnippets)}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-0.5"
          >
            {showSnippets ? (
              <>
                <span>Ẩn mẫu</span>
                <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                <span>Xem mẫu</span>
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        </div>

        {showSnippets && (
          <div className="p-2 space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {DESMOS_QUICK_SNIPPETS.map((item) => {
                const isCopied = copiedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleCopy(item)}
                    title={`${item.desc} (Bấm để copy mã: ${item.code})`}
                    className={`text-left p-1.5 rounded border transition-all flex items-start justify-between gap-1 group ${
                      isCopied
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-200'
                        : 'bg-white dark:bg-slate-800/80 hover:bg-emerald-50/50 dark:hover:bg-slate-700/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="truncate flex-1">
                      <div className="font-semibold text-[11px] truncate">{item.name}</div>
                      <div className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                        {item.code.replace('\n', ' | ')}
                      </div>
                    </div>
                    <span className="shrink-0 p-1 text-slate-400 group-hover:text-emerald-600">
                      {isCopied ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 italic px-1">
              💡 Mẹo: Bấm vào mẫu lệnh để tự động sao chép, sau đó dán (Ctrl+V) vào dòng lệnh Desmos.
            </div>
          </div>
        )}
      </div>

      {/* Frame nhúng Desmos Calculator */}
      <div className="flex-1 w-full h-full relative bg-slate-100 dark:bg-slate-950">
        <iframe
          ref={iframeRef}
          src="https://www.desmos.com/calculator?embed"
          title="Desmos Graphing Calculator"
          className="w-full h-full border-none"
          loading="lazy"
          allow="clipboard-write; clipboard-read"
        />
      </div>

      {/* Footer bar */}
      <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>Phím tắt: Alt+C để bật/tắt</span>
        <a
          href="https://www.desmos.com/calculator"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-emerald-600 flex items-center gap-1"
        >
          <span>Mở tab mới</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export default DesmosCalculator;
