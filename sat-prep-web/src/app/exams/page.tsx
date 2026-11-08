'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  Search,
  Filter,
  Flame,
  Award,
  ShieldCheck,
  Compass,
  FileCheck,
  Laptop,
  Calculator,
  ChevronRight,
  Zap,
} from 'lucide-react';

export type ExamCategory = 'all' | 'mock' | 'diagnostic' | 'qas';

export interface ExamCatalogItem {
  id: string;
  code: string;
  category: 'mock' | 'diagnostic' | 'qas';
  categoryLabel: string;
  title: string;
  subtitle?: string;
  description: string;
  durationMinutes: number;
  modulesCount: number;
  totalQuestions: number;
  difficulty: 'Chuẩn hóa' | 'Khá khó' | 'Nâng cao' | 'Cực khó' | 'Chẩn đoán';
  tags: string[];
  isHot?: boolean;
  isNew?: boolean;
}

const EXAM_CATALOG: ExamCatalogItem[] = [
  // 1. Chẩn đoán nhanh
  {
    id: 'sat-diagnostic-quick',
    code: 'DIAG-QUICK',
    category: 'diagnostic',
    categoryLabel: 'Chẩn Đoán Nhanh',
    title: 'SAT Quick Diagnostic Test (15 Phút)',
    subtitle: 'Đánh giá năng lực sơ bộ & định vị điểm khởi đầu',
    description:
      'Bài thi sàng lọc 15 phút tập trung vào các bẫy điểm Đại số, Hình học và Đọc hiểu then chốt. Xác định ngay lỗ hổng kiến thức để lập lộ trình bứt phá.',
    durationMinutes: 15,
    modulesCount: 1,
    totalQuestions: 14,
    difficulty: 'Chẩn đoán',
    tags: ['15 Phút', 'Sàng lọc năng lực', 'Bẫy kinh điển', 'Miễn phí'],
    isHot: true,
  },

  // 2. 6 Đề Thi Thử Chuẩn Bluebook
  {
    id: 'sat-mock-01',
    code: 'MOCK-01',
    category: 'mock',
    categoryLabel: 'Bluebook Mock',
    title: 'SAT Practice Test #01 (Adaptive Chuẩn)',
    subtitle: 'Bản chuẩn hóa theo ma trận College Board',
    description:
      'Đề thi thử toàn diện mô phỏng sát nhất kỳ thi Digital SAT thực tế. Phân tầng Module 2 thích ứng tự động, tích hợp Desmos và bảng công thức.',
    durationMinutes: 134,
    modulesCount: 4,
    totalQuestions: 98,
    difficulty: 'Chuẩn hóa',
    tags: ['Toán & Đọc-Viết', 'Adaptive Module 2', 'Target 1300+', 'Cơ bản'],
  },
  {
    id: 'sat-mock-02',
    code: 'MOCK-02',
    category: 'mock',
    categoryLabel: 'Bluebook Mock',
    title: 'SAT Practice Test #02 (Adaptive Bứt Phá)',
    subtitle: 'Tăng tốc độ đọc lướt & phản xạ Đại số',
    description:
      'Tập trung rèn tốc độ xử lý văn bản khoa học xã hội dài và xử lý bẫy thời gian phần Đại số tuyến tính, phương trình bậc hai tham số.',
    durationMinutes: 134,
    modulesCount: 4,
    totalQuestions: 98,
    difficulty: 'Chuẩn hóa',
    tags: ['Đọc lướt khoa học', 'Bẫy thời gian', 'Target 1350+'],
  },
  {
    id: 'sat-mock-03',
    code: 'MOCK-03',
    category: 'mock',
    categoryLabel: 'Bluebook Mock',
    title: 'SAT Practice Test #03 (Suy Luận Chuyên Sâu)',
    subtitle: 'Nâng cao kỹ năng suy luận văn học & hình học giải tích',
    description:
      'Tăng cường các câu hỏi suy luận sâu Ngữ văn, quy tắc dấu câu phức hợp và bài toán tham số hình học không gian Oxy.',
    durationMinutes: 134,
    modulesCount: 4,
    totalQuestions: 98,
    difficulty: 'Khá khó',
    tags: ['Suy luận sâu', 'Toán phân hóa', 'Target 1400+'],
  },
  {
    id: 'sat-mock-04',
    code: 'MOCK-04',
    category: 'mock',
    categoryLabel: 'Bluebook Mock',
    title: 'SAT Practice Test #04 (Phân Hóa Module 2)',
    subtitle: 'Rèn tâm lý và bứt phá ngưỡng 1450',
    description:
      'Bài thi thử bứt phá điểm số với Module 2 phân hóa mạnh, rèn bản lĩnh phòng thi trước kỳ thi thật với các câu hỏi bẫy tỷ lệ sai cao.',
    durationMinutes: 134,
    modulesCount: 4,
    totalQuestions: 98,
    difficulty: 'Khá khó',
    tags: ['Phân hóa mạnh', 'Mô phỏng áp lực', 'Target 1450+'],
  },
  {
    id: 'sat-mock-05',
    code: 'MOCK-05',
    category: 'mock',
    categoryLabel: 'Bluebook Mock',
    title: 'SAT Practice Test #05 (Chuyên Sâu Cực Trị & 800 Math)',
    subtitle: 'Tuyển chọn từ ngân hàng thử thách 800 điểm',
    description:
      'Bộ câu hỏi tuyển chọn từ ngân hàng thử thách, kiểm tra độ bền tư duy và độ chính xác tuyệt đối ở các câu hỏi phân hóa đỉnh cao.',
    durationMinutes: 134,
    modulesCount: 4,
    totalQuestions: 98,
    difficulty: 'Nâng cao',
    tags: ['Chuyên sâu 800 Math', 'Cực trị', 'Target 1500+'],
    isHot: true,
  },
  {
    id: 'sat-mock-06',
    code: 'MOCK-06',
    category: 'mock',
    categoryLabel: 'Bluebook Mock',
    title: 'SAT Practice Test #06 (Super Hard 1550+ Challenge)',
    subtitle: 'Thử thách cực hạn săn học bổng Top Đại học Mỹ & VN',
    description:
      'Đề thi thử thách cực hạn dành cho học viên săn học bổng Top 20 Đại học Mỹ và tuyển thẳng Top trường Việt Nam (FTU, NEU, HUST, VinUni).',
    durationMinutes: 134,
    modulesCount: 4,
    totalQuestions: 98,
    difficulty: 'Cực khó',
    tags: ['Thử thách cực hạn', 'Chinh phục 1550+', 'Học bổng Top'],
  },

  // 3. 6 Đề Thi Thật QAS Official
  {
    id: 'sat-qas-2024-03',
    code: 'QAS-2024-03',
    category: 'qas',
    categoryLabel: 'Thi Thật QAS',
    title: 'Digital SAT Official — Tháng 03/2024',
    subtitle: 'Đợt 1 Quốc tế chính thức',
    description:
      'Đề thi thật đợt Digital SAT quốc tế đầu tiên năm 2024 do College Board tổ chức. Phù hợp làm đề mốc để chuẩn đoán ban đầu.',
    durationMinutes: 134,
    modulesCount: 4,
    totalQuestions: 98,
    difficulty: 'Chuẩn hóa',
    tags: ['Đề thi thật', 'March 2024', 'College Board QAS'],
  },
  {
    id: 'sat-qas-2024-05',
    code: 'QAS-2024-05',
    category: 'qas',
    categoryLabel: 'Thi Thật QAS',
    title: 'Digital SAT Official — Tháng 05/2024',
    subtitle: 'Đợt 2 Toàn cầu chính thức',
    description:
      'Bài thi chính thức tháng 5 với độ phân hóa cao ở Module 2 Math phần Hình học giải tích không gian và Hệ phương trình tham số.',
    durationMinutes: 134,
    modulesCount: 4,
    totalQuestions: 98,
    difficulty: 'Chuẩn hóa',
    tags: ['Đề thi thật', 'May 2024', 'Phân hóa Math'],
  },
  {
    id: 'sat-qas-2024-06',
    code: 'QAS-2024-06',
    category: 'qas',
    categoryLabel: 'Thi Thật QAS',
    title: 'Digital SAT Official — Tháng 06/2024',
    subtitle: 'Đợt 3 Mùa hè chính thức',
    description:
      'Đề thi kiểm tra độ chính xác phần Đọc hiểu Văn học cổ điển và từ vựng trong văn cảnh phức hợp kết hợp bảng số liệu sinh học.',
    durationMinutes: 134,
    modulesCount: 4,
    totalQuestions: 98,
    difficulty: 'Khá khó',
    tags: ['Đề thi thật', 'June 2024', 'Từ vựng ngữ cảnh'],
  },
  {
    id: 'sat-qas-2024-08',
    code: 'QAS-2024-08',
    category: 'qas',
    categoryLabel: 'Thi Thật QAS',
    title: 'Digital SAT Official — Tháng 08/2024',
    subtitle: 'Đợt 4 Tựu trường chính thức',
    description:
      'Đề thi tháng 8 được đánh giá chuẩn mực nhất về thang điểm đường cong (curve), sát kỳ thi thực tế và các dạng bẫy logic suy luận.',
    durationMinutes: 134,
    modulesCount: 4,
    totalQuestions: 98,
    difficulty: 'Chuẩn hóa',
    tags: ['Đề thi thật', 'August 2024', 'Standard Curve'],
    isHot: true,
  },
  {
    id: 'sat-qas-2024-10',
    code: 'QAS-2024-10',
    category: 'qas',
    categoryLabel: 'Thi Thật QAS',
    title: 'Digital SAT Official — Tháng 10/2024',
    subtitle: 'Đợt 5 Early Action chính thức',
    description:
      'Kỳ thi then chốt của học sinh nộp hồ sơ sớm đợt Early Action với mật độ câu hỏi tổng hợp luận điểm và cực trị đại số cao.',
    durationMinutes: 134,
    modulesCount: 4,
    totalQuestions: 98,
    difficulty: 'Nâng cao',
    tags: ['Đề thi thật', 'October 2024', 'Early Action'],
  },
  {
    id: 'sat-qas-2024-11',
    code: 'QAS-2024-11',
    category: 'qas',
    categoryLabel: 'Thi Thật QAS',
    title: 'Digital SAT Official — Tháng 11/2024',
    subtitle: 'Đợt 6 Regular Decision chính thức',
    description:
      'Đề thi tổng hợp đầy đủ ma trận bẫy điểm mới nhất quý 4/2024, sẵn sàng cho chiến dịch xét tuyển đại học 2025 - 2026.',
    durationMinutes: 134,
    modulesCount: 4,
    totalQuestions: 98,
    difficulty: 'Nâng cao',
    tags: ['Đề thi thật', 'November 2024', 'Regular Decision'],
    isNew: true,
  },
];

export default function ExamsCatalogPage() {
  const [activeCategory, setActiveCategory] = useState<ExamCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredExams = useMemo(() => {
    return EXAM_CATALOG.filter((exam) => {
      // Category filter
      if (activeCategory !== 'all' && exam.category !== activeCategory) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = exam.title.toLowerCase().includes(q);
        const matchCode = exam.code.toLowerCase().includes(q);
        const matchDesc = exam.description.toLowerCase().includes(q);
        const matchTags = exam.tags.some((t) => t.toLowerCase().includes(q));
        return matchTitle || matchCode || matchDesc || matchTags;
      }
      return true;
    });
  }, [activeCategory, searchQuery]);

  const stats = useMemo(() => {
    return {
      total: EXAM_CATALOG.length,
      mock: EXAM_CATALOG.filter((e) => e.category === 'mock').length,
      diagnostic: EXAM_CATALOG.filter((e) => e.category === 'diagnostic').length,
      qas: EXAM_CATALOG.filter((e) => e.category === 'qas').length,
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-16">
      {/* Top Banner / Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-900 border-b border-slate-800/80 pt-10 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                HỆ THỐNG KHẢO THÍ CHUẨN BLUEBOOK 2026
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Trung Tâm Khảo Thí Digital SAT
              </h1>
              <p className="mt-2 text-slate-400 text-sm sm:text-base max-w-3xl leading-relaxed">
                Kho đề thi thử chuẩn hóa College Board kết hợp đề thi thật QAS Official Released.
                Luyện thi trực tiếp trên giao diện Split-Pane chân thực, tích hợp Desmos và thuật toán phân tầng Adaptive.
              </p>
            </div>

            {/* Quick Navigation links */}
            <div className="flex items-center gap-3">
              <Link
                href="/mock-exams"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <Laptop className="w-4 h-4 text-indigo-400" />
                Đấu trường Mock
              </Link>
              <Link
                href="/real-exams"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <Award className="w-4 h-4 text-amber-400" />
                Đề thi thật QAS
              </Link>
              <Link
                href="/mistakes"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-950/40 hover:bg-red-900/40 text-red-300 border border-red-800/50 transition-colors"
              >
                <Flame className="w-4 h-4 text-red-400" />
                Sổ tay lỗi sai
              </Link>
            </div>
          </div>

          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">13 Đề Thi</div>
                <div className="text-xs text-slate-400">Chuẩn hóa College Board</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">Adaptive 2.0</div>
                <div className="text-xs text-slate-400">Phân tầng Module 2 chuẩn</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">Desmos 2026</div>
                <div className="text-xs text-slate-400">Tích hợp đồ thị & công thức</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">Split-Pane</div>
                <div className="text-xs text-slate-400">Giao diện Bluebook 50/50</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        {/* Controls: Search + Categories */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/90 border border-slate-700/80 overflow-x-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeCategory === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tất cả đề ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('mock')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeCategory === 'mock'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bluebook Mock ({stats.mock})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('diagnostic')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeCategory === 'diagnostic'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Chẩn đoán nhanh ({stats.diagnostic})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('qas')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeCategory === 'qas'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Thi thật QAS ({stats.qas})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên đề, mã, tag..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>

        {/* Exams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map((exam) => {
            const isMock = exam.category === 'mock';
            const isDiag = exam.category === 'diagnostic';

            return (
              <div
                key={exam.id}
                className="group relative flex flex-col justify-between p-5 rounded-2xl bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/60 hover:border-indigo-500/50 transition-all shadow-lg hover:shadow-indigo-500/10"
              >
                {/* Header Tag & Badge */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-700/80 text-slate-200">
                        {exam.code}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                          isDiag
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : isMock
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {exam.categoryLabel}
                      </span>
                    </div>

                    {exam.isHot && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
                        <Flame className="w-3 h-3 fill-red-400" /> HOT
                      </span>
                    )}
                    {exam.isNew && (
                      <span className="text-[11px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/30">
                        MỚI
                      </span>
                    )}
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                    {exam.title}
                  </h3>
                  {exam.subtitle && (
                    <div className="text-xs text-indigo-400/90 font-medium mt-0.5 mb-2 line-clamp-1">
                      {exam.subtitle}
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mt-1">
                    {exam.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {exam.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-900/60 text-slate-400 border border-slate-800"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Specs & Actions Footer */}
                <div className="pt-4 mt-4 border-t border-slate-700/50 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800">
                      <div className="text-[10px] text-slate-500">Thời gian</div>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {exam.durationMinutes}p
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800">
                      <div className="text-[10px] text-slate-500">Modules</div>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {exam.modulesCount} mod
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800">
                      <div className="text-[10px] text-slate-500">Độ khó</div>
                      <div className="font-semibold text-indigo-300 mt-0.5">
                        {exam.difficulty}
                      </div>
                    </div>
                  </div>

                  {/* Dual Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
                    {/* Primary Direct Bluebook Exam Room */}
                    <Link
                      href={`/exams/${exam.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 text-center"
                    >
                      <Laptop className="w-3.5 h-3.5" />
                      Phòng thi Bluebook
                    </Link>

                    {/* Secondary Full Adaptive Session */}
                    <Link
                      href={`/mock-exams/session?examId=${exam.id}`}
                      className="inline-flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-colors border border-slate-600/60"
                      title="Chế độ làm bài phiên thích ứng tuần tự"
                    >
                      <span>Adaptive</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty Search Fallback */}
        {filteredExams.length === 0 && (
          <div className="text-center py-16 px-4 bg-slate-800/30 rounded-2xl border border-slate-800">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <div className="text-base font-bold text-slate-300">Không tìm thấy đề thi phù hợp</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Vui lòng thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục đề thi khác.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('all');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Xem tất cả 13 đề thi
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
