'use client';

import React, { useState } from 'react';
import {
  FileText,
  X,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  Search,
  BookOpen,
  ChevronRight,
  Layers,
} from 'lucide-react';

export interface MathVocabItem {
  en: string;
  vi: string;
  example: string;
  category: 'geometry' | 'algebra' | 'stats';
}

export const COMMON_MATH_VOCAB: MathVocabItem[] = [
  { en: 'isosceles triangle', vi: 'tam giác cân (2 cạnh bằng nhau, 2 góc đáy bằng nhau)', example: 'An isosceles triangle has two sides of length 7.', category: 'geometry' },
  { en: 'equilateral triangle', vi: 'tam giác đều (3 cạnh bằng nhau, 3 góc bằng 60°)', example: 'Each angle in an equilateral triangle is 60°.', category: 'geometry' },
  { en: 'perpendicular', vi: 'vuông góc (tích hai hệ số góc m1 * m2 = -1)', example: 'Line k is perpendicular to line l.', category: 'algebra' },
  { en: 'slope', vi: 'hệ số góc (độ dốc m = Δy / Δx)', example: 'Find the slope of the line passing through (2, 3).', category: 'algebra' },
  { en: 'y-intercept', vi: 'tung độ gốc (giao điểm với trục tung Oy tại x = 0)', example: 'The y-intercept of the function is (0, 5).', category: 'algebra' },
  { en: 'x-intercept / zero / root', vi: 'hoành độ gốc / nghiệm phương trình (y = 0)', example: 'The graph has x-intercepts at x = -3 and x = 2.', category: 'algebra' },
  { en: 'hypotenuse', vi: 'cạnh huyền (cạnh đối diện góc vuông trong tam giác vuông)', example: 'The hypotenuse of the right triangle has length 10.', category: 'geometry' },
  { en: 'circumference', vi: 'chu vi đường tròn (C = 2πr = πd)', example: 'The circumference of the circle is 16π.', category: 'geometry' },
  { en: 'radius / diameter', vi: 'bán kính (r) / đường kính (d = 2r)', example: 'A circle with radius 4 has diameter 8.', category: 'geometry' },
  { en: 'arc length', vi: 'độ dài cung tròn (s = r·θ với θ tính bằng radian)', example: 'The length of arc AB is 4π/3.', category: 'geometry' },
  { en: 'sector area', vi: 'diện tích hình quạt tròn (A = 1/2 · r² · θ)', example: 'Calculate the area of the shaded sector.', category: 'geometry' },
  { en: 'tangent (line)', vi: 'tiếp tuyến (đường thẳng vuông góc bán kính tại tiếp điểm)', example: 'Line t is tangent to circle C at point P.', category: 'geometry' },
  { en: 'congruent', vi: 'bằng nhau / tương đẳng (cùng hình dạng và kích thước)', example: 'Triangle ABC is congruent to triangle DEF.', category: 'geometry' },
  { en: 'similar', vi: 'đồng dạng (cùng tỉ lệ các cạnh, góc tương ứng bằng nhau)', example: 'Two similar triangles have side ratio 3:4.', category: 'geometry' },
  { en: 'acute / obtuse angle', vi: 'góc nhọn (<90°) / góc tù (>90° và <180°)', example: 'Angle A is an acute angle.', category: 'geometry' },
  { en: 'mean / median / mode', vi: 'số trung bình / trung vị / mốt (giá trị xuất hiện nhiều nhất)', example: 'The median of the dataset is 15.', category: 'stats' },
  { en: 'standard deviation', vi: 'độ lệch chuẩn (thước đo độ phân tán của dữ liệu)', example: 'A smaller standard deviation means data is clustered near the mean.', category: 'stats' },
];

export interface FormulaSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPinned?: boolean;
  className?: string;
}

export function FormulaSheetModal({
  isOpen,
  onClose,
  initialPinned = false,
  className = '',
}: FormulaSheetModalProps) {
  const [isPinned, setIsPinned] = useState<boolean>(initialPinned);
  const [activeTab, setActiveTab] = useState<'formulas' | 'vocab'>('formulas');
  const [vocabSearch, setVocabSearch] = useState<string>('');

  if (!isOpen) return null;

  const filteredVocab = COMMON_MATH_VOCAB.filter(
    (item) =>
      item.en.toLowerCase().includes(vocabSearch.toLowerCase()) ||
      item.vi.toLowerCase().includes(vocabSearch.toLowerCase())
  );

  return (
    <>
      {/* Backdrop chỉ hiển thị khi KHÔNG ghim góc */}
      {!isPinned && (
        <div
          role="presentation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
        />
      )}

      {/* Main Container */}
      <div
        role="dialog"
        aria-label="College Board Digital SAT Math Reference Sheet"
        className={`fixed z-50 flex flex-col bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl transition-all duration-200 ${
          isPinned
            ? 'w-[420px] max-w-[95vw] h-[520px] bottom-6 left-6 rounded-xl border-2 border-indigo-500 shadow-indigo-500/20'
            : 'w-[880px] max-w-[92vw] h-[82vh] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl'
        } ${className}`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 select-none rounded-t-[inherit]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                  {isPinned ? 'Bảng Công Thức (Ghim Góc)' : 'Bảng Công Thức & Thuật Ngữ SAT'}
                </span>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  College Board Official
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {/* #C015: Nút chuyển đổi Chế độ Thu nhỏ Ghim góc (Compact Pin) */}
            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              title={isPinned ? 'Mở to chính giữa' : 'Chế độ Thu nhỏ Ghim góc (Vừa làm bài vừa xem)'}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                isPinned
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {isPinned ? (
                <>
                  <PinOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Bỏ ghim</span>
                </>
              ) : (
                <>
                  <Pin className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ghim góc</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Đóng (Alt+R)"
              className="p-1 text-slate-500 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3 py-1.5 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('formulas')}
            className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'formulas'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Công thức College Board</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vocab')}
            className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'vocab'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Thuật ngữ Toán Anh-Việt</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1 rounded-full font-bold">
              Hot
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar text-slate-800 dark:text-slate-100">
          {activeTab === 'formulas' ? (
            <div className="space-y-4 text-xs sm:text-sm">
              {/* Reference Header Notice */}
              <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-200 text-xs">
                📌 <strong>Quy tắc thi Digital SAT:</strong> Các công thức dưới đây được cấp sẵn trong mọi đề thi College Board chính thức.
              </div>

              {/* Nhóm 1: Hình phẳng 2D */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  1. Diện tích & Chu vi hình phẳng
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-indigo-600 dark:text-indigo-400">Hình tròn (Circle)</div>
                    <div className="mt-1 font-mono text-sm">A = π r²</div>
                    <div className="font-mono text-sm">C = 2 π r</div>
                    <div className="text-[11px] text-slate-500 mt-1">r: bán kính, C: chu vi</div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-indigo-600 dark:text-indigo-400">Hình chữ nhật (Rectangle)</div>
                    <div className="mt-1 font-mono text-sm">A = ℓ w</div>
                    <div className="text-[11px] text-slate-500 mt-1">ℓ: chiều dài, w: chiều rộng</div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-indigo-600 dark:text-indigo-400">Hình tam giác (Triangle)</div>
                    <div className="mt-1 font-mono text-sm">A = ½ b h</div>
                    <div className="text-[11px] text-slate-500 mt-1">b: cạnh đáy, h: chiều cao</div>
                  </div>
                </div>
              </div>

              {/* Nhóm 2: Định lý Pytago & Tam giác đặc biệt */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  2. Định lý Pytago & Tam giác đặc biệt (Special Right Triangles)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-indigo-600 dark:text-indigo-400">Định lý Pytago</div>
                    <div className="mt-1 font-mono text-sm font-bold">c² = a² + b²</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Áp dụng cho tam giác vuông với c là cạnh huyền.
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-indigo-600 dark:text-indigo-400">Tam giác 30° - 60° - 90° & 45° - 45° - 90°</div>
                    <div className="mt-1 font-mono text-xs">
                      • 30°-60°-90°: Tỉ lệ cạnh là <strong>x : x√3 : 2x</strong>
                    </div>
                    <div className="font-mono text-xs mt-0.5">
                      • 45°-45°-90°: Tỉ lệ cạnh là <strong>s : s : s√2</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nhóm 3: Thể tích hình không gian 3D */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  3. Thể tích hình không gian (Volume)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-indigo-600 dark:text-indigo-400">Hình hộp chữ nhật</div>
                    <div className="mt-1 font-mono text-sm">V = ℓ w h</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-indigo-600 dark:text-indigo-400">Hình trụ tròn (Cylinder)</div>
                    <div className="mt-1 font-mono text-sm">V = π r² h</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-indigo-600 dark:text-indigo-400">Hình cầu (Sphere)</div>
                    <div className="mt-1 font-mono text-sm">V = ⁴⁄₃ π r³</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-indigo-600 dark:text-indigo-400">Hình nón (Cone)</div>
                    <div className="mt-1 font-mono text-sm">V = ⅓ π r² h</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-indigo-600 dark:text-indigo-400">Hình chóp (Pyramid)</div>
                    <div className="mt-1 font-mono text-sm">V = ⅓ ℓ w h</div>
                  </div>
                </div>
              </div>

              {/* Nhóm 4: Quy tắc góc & radian */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/50 text-xs">
                <div className="font-bold text-amber-800 dark:text-amber-300 uppercase">Quy ước Góc & Radian College Board:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 text-slate-700 dark:text-slate-300">
                  <div>• Tổng số đo các góc trong 1 tam giác luôn bằng <strong>180°</strong>.</div>
                  <div>• Số đo góc cả đường tròn là <strong>360°</strong> tương đương <strong>2π radians</strong>.</div>
                </div>
              </div>
            </div>
          ) : (
            /* #C015: Bảng tóm tắt Thuật ngữ Toán Anh-Việt hay gặp */
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={vocabSearch}
                  onChange={(e) => setVocabSearch(e.target.value)}
                  placeholder="Tra cứu từ tiếng Anh hoặc tiếng Việt (vd: isosceles, vuông góc)..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400">
                Tìm thấy {filteredVocab.length} thuật ngữ trọng tâm SAT:
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredVocab.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-xs sm:text-sm text-indigo-700 dark:text-indigo-400 font-mono">
                        {item.en}
                      </span>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        {item.category}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      👉 {item.vi}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded">
                      &quot;{item.example}&quot;
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 rounded-b-[inherit]">
          <span>Phím tắt: Alt+R để bật/tắt</span>
          <span>College Board SAT Official Reference</span>
        </div>
      </div>
    </>
  );
}

export default FormulaSheetModal;
