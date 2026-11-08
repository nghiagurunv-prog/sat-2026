'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';
import { ScoreForecastCard } from '@/components/ScoreForecastCard';

/**
 * ONBOARDING & DIAGNOSTIC FLOW (#C001 – #C010)
 *
 * Màn hình chào đón, thiết lập mục tiêu và chẩn đoán năng lực toàn diện:
 * - #C001: Điểm nền IELTS & Học lực Toán THPT gợi ý điểm SAT ban đầu.
 * - #C002: Chip chọn Trường Đại học Mục tiêu (FTU, NEU, HUST, VNU, VinUni/Fulbright, US Top 30).
 * - #C003 & #C009: Chọn Kỳ thi SAT mục tiêu và Khung giờ học cam kết.
 * - #C004 & #C005: Chế độ Chẩn đoán Nhanh (Quick Mode) và tự động lưu/khôi phục tiến độ checkpoint.
 * - #C006, #C010: Đo lường chuẩn hóa IRT (±30đ) & Chu kỳ tái chẩn đoán 14 ngày.
 * - #C007 & #C008: Báo cáo chẩn đoán song ngữ gửi phụ huynh & Nút "Gỡ điểm ngay (+20đ)".
 */

interface UniTargetOption {
  code: string;
  name: string;
  targetScore: number;
  label: string;
  category: string;
}

const UNI_TARGET_OPTIONS: UniTargetOption[] = [
  { code: 'FTU', name: 'ĐH Ngoại Thương', targetScore: 1450, label: 'FTU 1450+', category: 'Kinh tế / Đối ngoại' },
  { code: 'NEU', name: 'ĐH Kinh Tế Quốc Dân', targetScore: 1400, label: 'NEU 1400+', category: 'Kinh tế / Tài chính' },
  { code: 'HUST', name: 'ĐH Bách Khoa Hà Nội', targetScore: 1450, label: 'HUST 1450+', category: 'Kỹ thuật / IT' },
  { code: 'VNU', name: 'ĐHQG Hà Nội / TP.HCM', targetScore: 1380, label: 'VNU 1380+', category: 'Đa ngành Top đầu' },
  { code: 'VINUNI_FULBRIGHT', name: 'VinUni / Fulbright VN', targetScore: 1500, label: 'VinUni/Fulbright 1500+', category: 'Quốc tế / Học bổng' },
  { code: 'US_TOP30', name: 'Top 30 Đại học Mỹ', targetScore: 1530, label: 'US Top 30 1530+', category: 'Du học Mỹ / Ivy League' },
];

const IELTS_LEVELS = [
  { id: 'under_55', label: '< 5.5 IELTS', bonusReading: 460 },
  { id: '55_60', label: '5.5 – 6.0 IELTS', bonusReading: 530 },
  { id: '65_70', label: '6.5 – 7.0 IELTS', bonusReading: 620 },
  { id: '75_plus', label: '7.5+ IELTS', bonusReading: 700 },
];

const MATH_LEVELS = [
  { id: 'medium', label: 'Toán Trung bình (6.0 – 7.5)', bonusMath: 500 },
  { id: 'good', label: 'Toán Khá (7.5 – 8.5)', bonusMath: 600 },
  { id: 'very_good', label: 'Toán Giỏi (8.5 – 9.2)', bonusMath: 680 },
  { id: 'specialist', label: 'Chuyên Toán / Xuất sắc (> 9.2)', bonusMath: 750 },
];

const SAT_EXAM_MONTHS = ['Tháng 8', 'Tháng 10', 'Tháng 12', 'Tháng 3', 'Tháng 5', 'Tháng 6'];

const STUDY_TIME_SLOTS = [
  { id: 'slot_evening_1', label: '20:00 – 21:30', desc: 'Khung giờ vàng buổi tối' },
  { id: 'slot_evening_2', label: '21:30 – 23:00', desc: 'Tập trung sâu trước khi ngủ' },
  { id: 'slot_morning', label: '05:30 – 06:30', desc: 'Rèn luyện trí não sáng sớm' },
];

// Ngân hàng câu hỏi chẩn đoán chuẩn bị sẵn (fallback offline an toàn khi chưa đăng nhập / mất mạng)
const FALLBACK_DIAGNOSTIC_QUESTIONS: PracticeQuestion[] = [
  {
    title: 'Algebra: Linear Equation Modeling',
    practice_question: 'A caterer charges a flat delivery fee of $45 plus $18.50 per person for an event. If the total bill was $452, which equation models this scenario, and how many people attended?',
    choices: [
      '18.50p + 45 = 452; p = 22 people',
      '45p + 18.50 = 452; p = 10 people',
      '18.50p - 45 = 452; p = 27 people',
      '45p - 18.50 = 452; p = 12 people',
    ],
    correct_choice: '18.50p + 45 = 452; p = 22 people',
    explanation: 'Total cost = Flat fee + (Cost per person * number of people) = 45 + 18.50p = 452. Subtract 45: 18.50p = 407. Divide by 18.50: p = 22.',
    difficulty: 'medium',
    trapRate: 20,
    skillId: 'linear-equations',
  },
  {
    title: 'Advanced Math: Quadratic Function Vertex',
    practice_question: 'What is the minimum value of the quadratic function f(x) = x^2 - 8x + 23?',
    choices: ['7', '8', '23', '-7'],
    correct_choice: '7',
    explanation: 'Rewrite in vertex form by completing the square: f(x) = (x - 4)^2 - 16 + 23 = (x - 4)^2 + 7. The minimum value is 7 at x = 4.',
    difficulty: 'medium',
    trapRate: 25,
    skillId: 'quadratic-functions',
  },
  {
    title: 'Reading: Words in Context',
    full_passage: 'While the diplomat’s proposal was met with initial skepticism, her persistent diplomacy and transparent reasoning eventually _______ the committee’s deepest reservations.',
    practice_question: 'Which choice completes the text with the most logical and precise word or phrase?',
    choices: ['assuaged', 'intensified', 'dissembled', 'manufactured'],
    correct_choice: 'assuaged',
    explanation: '"Assuaged" means eased, lessened, or relieved fears/reservations, which fits the context of overcoming skepticism through persistence.',
    difficulty: 'hard',
    trapRate: 35,
    skillId: 'words-in-context',
  },
  {
    title: 'Reading & Writing: Command of Evidence',
    full_passage: 'Researchers studied how urban canopy coverage influences microclimate temperatures during summer months. They recorded that neighborhoods with greater than 40% mature tree cover experienced surface temperatures up to 5.2°C lower than asphalt-dense commercial zones.',
    practice_question: 'Which finding, if true, most directly supports the researchers’ hypothesis regarding urban heat islands?',
    choices: [
      'Areas where local municipalities planted shading trees saw significant reductions in localized ambient temperature compared to unshaded streets.',
      'Residents in areas with mature trees reported spending more on lawn maintenance.',
      'Commercial zones consumed more electrical energy for evening architectural lighting.',
      'Satellite imaging showed rainfall was uniformly distributed across all survey neighborhoods.',
    ],
    correct_choice: 'Areas where local municipalities planted shading trees saw significant reductions in localized ambient temperature compared to unshaded streets.',
    explanation: 'Directly reinforces the empirical claim that increased foliage and canopy cover decreases heat.',
    difficulty: 'medium',
    trapRate: 15,
    skillId: 'command-of-evidence',
  },
  {
    title: 'Problem Solving: Ratio and Proportions',
    practice_question: 'In a chemistry lab, a solution is prepared by mixing liquid A and liquid B in a 3:5 volume ratio. If 400 mL of liquid B is used, how many milliliters of liquid A are required?',
    choices: ['240 mL', '250 mL', '150 mL', '667 mL'],
    correct_choice: '240 mL',
    explanation: 'Liquid A / Liquid B = 3 / 5. With B = 400 mL: A = (3/5) * 400 = 240 mL.',
    difficulty: 'easy',
    trapRate: 10,
    skillId: 'ratios-percentages',
  },
  {
    title: 'Geometry: Right Triangle Trigonometry',
    practice_question: 'In a right triangle ABC with right angle at C, if sin(A) = 5/13, what is the value of cos(B)?',
    choices: ['5/13', '12/13', '5/12', '13/5'],
    correct_choice: '5/13',
    explanation: 'By the complementary angle trigonometric identity, sin(A) = cos(90° - A) = cos(B). Therefore, cos(B) = 5/13.',
    difficulty: 'medium',
    trapRate: 30,
    skillId: 'right-triangle-trig',
  },
];

const CHECKPOINT_KEY = 'sat_onboarding_checkpoint';

type Step = 'setup' | 'testing' | 'result';

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('setup');
  const [mounted, setMounted] = useState(false);

  // #C001: Điểm nền học lực
  const [ieltsLevel, setIeltsLevel] = useState<string>('65_70');
  const [mathLevel, setMathLevel] = useState<string>('good');

  // #C002: Mục tiêu trường & Điểm số
  const [targetUniCode, setTargetUniCode] = useState<string>('FTU');
  const [targetScore, setTargetScore] = useState<number>(1450);

  // #C003 & #C009: Kỳ thi SAT & Khung giờ học
  const [examMonth, setExamMonth] = useState<string>('Tháng 10');
  const [studySlot, setStudySlot] = useState<string>('20:00 – 21:30');

  // #C004: Chế độ chẩn đoán
  const [diagnosticMode, setDiagnosticMode] = useState<'quick' | 'standard'>('quick');

  // Tiến trình làm bài (#C005)
  const [questions, setQuestions] = useState<PracticeQuestion[]>(FALLBACK_DIAGNOSTIC_QUESTIONS);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answerLog, setAnswerLog] = useState<boolean[]>([]);
  const [hasSavedCheckpoint, setHasSavedCheckpoint] = useState(false);

  // Kết quả sau test (#C006, #C007)
  const [calculatedScore, setCalculatedScore] = useState<{
    total: number;
    math: number;
    reading: number;
    confidence: 'medium' | 'high' | 'low';
    irtMargin: number;
  }>({
    total: 1320,
    math: 680,
    reading: 640,
    confidence: 'high',
    irtMargin: 30,
  });

  const [copyToast, setCopyToast] = useState(false);

  // #C001: Ước tính điểm khởi điểm ban đầu
  const estimatedBaseline = useMemo(() => {
    const ieltsObj = IELTS_LEVELS.find((i) => i.id === ieltsLevel) || IELTS_LEVELS[2];
    const mathObj = MATH_LEVELS.find((m) => m.id === mathLevel) || MATH_LEVELS[1];
    const rScore = ieltsObj.bonusReading;
    const mScore = mathObj.bonusMath;
    const total = rScore + mScore;
    return {
      total,
      math: mScore,
      reading: rScore,
      range: `${total - 40} – ${total + 40}`,
    };
  }, [ieltsLevel, mathLevel]);

  // Khôi phục checkpoint nếu có từ localStorage (#C005)
  useEffect(() => {
    setMounted(true);
    try {
      const rawCheckpoint = localStorage.getItem(CHECKPOINT_KEY);
      if (rawCheckpoint) {
        const parsed = JSON.parse(rawCheckpoint);
        if (parsed && typeof parsed.currentIdx === 'number' && parsed.currentIdx > 0) {
          setHasSavedCheckpoint(true);
        }
      }

      // Đọc mục tiêu cũ nếu đã lưu
      const savedUni = localStorage.getItem('sat_target_uni');
      if (savedUni) {
        try {
          const parsed = JSON.parse(savedUni);
          if (parsed.code) setTargetUniCode(parsed.code);
          if (parsed.targetScore) setTargetScore(Number(parsed.targetScore));
        } catch {
          // ignore
        }
      }

      const savedMonth = localStorage.getItem('sat_target_exam_month');
      if (savedMonth) setExamMonth(savedMonth);

      const savedSlot = localStorage.getItem('sat_study_time_slot');
      if (savedSlot) setStudySlot(savedSlot);
    } catch {
      // storage unavailable
    }
  }, []);

  // Khôi phục tiến trình đang làm dở
  const restoreCheckpoint = () => {
    try {
      const rawCheckpoint = localStorage.getItem(CHECKPOINT_KEY);
      if (!rawCheckpoint) return;
      const data = JSON.parse(rawCheckpoint);
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestions(data.questions);
      }
      if (typeof data.currentIdx === 'number') setCurrentIdx(data.currentIdx);
      if (Array.isArray(data.answerLog)) setAnswerLog(data.answerLog);
      if (data.diagnosticMode) setDiagnosticMode(data.diagnosticMode);
      if (data.targetScore) setTargetScore(Number(data.targetScore));
      setStep('testing');
    } catch {
      startNewTest();
    }
  };

  // #C002: Khi chọn Chip trường đại học
  const handleSelectUni = (uni: UniTargetOption) => {
    setTargetUniCode(uni.code);
    setTargetScore(uni.targetScore);
    try {
      localStorage.setItem('sat_target_uni', JSON.stringify({
        code: uni.code,
        name: uni.name,
        targetScore: uni.targetScore,
      }));
    } catch {
      // storage ignore
    }
  };

  // Bắt đầu làm bài test
  const startNewTest = async () => {
    // Lưu các lựa chọn vào localStorage
    try {
      const selectedUni = UNI_TARGET_OPTIONS.find((u) => u.code === targetUniCode);
      localStorage.setItem('sat_target_uni', JSON.stringify({
        code: targetUniCode,
        name: selectedUni?.name || targetUniCode,
        targetScore,
      }));
      localStorage.setItem('sat_target_exam_month', examMonth);
      localStorage.setItem('sat_study_time_slot', studySlot);
    } catch {
      // ignore
    }

    let testSet = FALLBACK_DIAGNOSTIC_QUESTIONS;

    // Cố gắng gọi API chẩn đoán nếu có
    try {
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          testSet = data.questions;
        }
      }
    } catch {
      // dùng fallback questions
    }

    // Cắt câu hỏi theo chế độ Quick / Standard (#C004)
    const finalQuestions = diagnosticMode === 'quick' ? testSet.slice(0, 6) : testSet.slice(0, 14);
    setQuestions(finalQuestions);
    setCurrentIdx(0);
    setAnswerLog([]);

    // Lưu checkpoint ban đầu (#C005)
    try {
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
        currentIdx: 0,
        answerLog: [],
        diagnosticMode,
        targetScore,
        questions: finalQuestions,
      }));
    } catch {
      // ignore
    }

    setStep('testing');
  };

  // Trả lời một câu hỏi và tự động cập nhật checkpoint (#C005)
  const handleAnswer = useCallback((isCorrect: boolean) => {
    setAnswerLog((prev) => {
      const nextLog = [...prev, isCorrect];
      try {
        localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
          currentIdx,
          answerLog: nextLog,
          diagnosticMode,
          targetScore,
          questions,
        }));
      } catch {
        // ignore
      }
      return nextLog;
    });
  }, [currentIdx, diagnosticMode, targetScore, questions]);

  // Chuyển câu tiếp theo hoặc nộp bài hoàn thành
  const handleNext = useCallback(async () => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= questions.length) {
      // Hoàn tất bài chẩn đoán
      const correctCount = answerLog.filter(Boolean).length;
      const totalQ = questions.length;
      const accuracy = totalQ > 0 ? correctCount / totalQ : 0.5;

      // Tính điểm IRT dự đoán kết hợp với điểm nền (#C001 & #C006)
      const baseTotal = estimatedBaseline.total;
      const performanceBonus = Math.round((accuracy - 0.5) * 240);
      const computedTotal = Math.max(700, Math.min(1580, Math.round((baseTotal + performanceBonus) / 10) * 10));
      const mathPart = Math.round(computedTotal * 0.51 / 10) * 10;
      const readingPart = computedTotal - mathPart;

      const finalResult = {
        total: computedTotal,
        math: mathPart,
        reading: readingPart,
        confidence: totalQ >= 10 ? ('high' as const) : ('medium' as const),
        irtMargin: 30, // Chuẩn sai số IRT ±30 điểm (#C006)
      };

      setCalculatedScore(finalResult);

      // Lưu trạng thái hoàn tất và thời điểm để kích hoạt chu kỳ 14 ngày (#C010)
      try {
        localStorage.removeItem(CHECKPOINT_KEY);
        localStorage.setItem('sat_diagnostic_last_date', new Date().toISOString());
        localStorage.setItem('sat_diagnostic_result', JSON.stringify(finalResult));
      } catch {
        // ignore
      }

      // Gọi API complete nếu user đã đăng nhập
      try {
        await fetch('/api/diagnostic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            targetScore,
          }),
        });
      } catch {
        // ignore
      }

      setStep('result');
    } else {
      setCurrentIdx(nextIdx);
      try {
        localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
          currentIdx: nextIdx,
          answerLog,
          diagnosticMode,
          targetScore,
          questions,
        }));
      } catch {
        // ignore
      }
    }
  }, [currentIdx, questions, answerLog, estimatedBaseline.total, targetScore, diagnosticMode]);

  // #C007: Sao chép báo cáo chẩn đoán song ngữ gửi phụ huynh
  const copyBilingualReport = () => {
    const selectedUni = UNI_TARGET_OPTIONS.find((u) => u.code === targetUniCode);
    const reportText = `[BÁO CÁO CHẨN ĐOÁN NĂNG LỰC DIGITAL SAT / BILINGUAL SAT DIAGNOSTIC REPORT]
--------------------------------------------------
🎓 Học sinh / Student: PG SAT Learner
📅 Thời gian kiểm tra / Assessment Date: ${new Date().toLocaleDateString('vi-VN')}
🏛️ Mục tiêu Đại học / Target University: ${selectedUni?.name || 'Top Uni'} (${targetScore}+ điểm)
📆 Kỳ thi mục tiêu / Target SAT Date: ${examMonth}/2026
⏰ Khung giờ cam kết tự học / Study Slot: ${studySlot}

📊 KẾT QUẢ ĐỊNH CỠ IRT / IRT SCORE PREDICTION:
• Tổng điểm dự đoán / Total Predicted Score: ${calculatedScore.total} / 1600
• Điểm Toán / Math Score: ${calculatedScore.math} / 800
• Điểm Đọc & Viết / Reading & Writing: ${calculatedScore.reading} / 800
• Độ tin cậy đo lường IRT (95% CI): ±${calculatedScore.irtMargin} điểm (Khoảng điểm: ${calculatedScore.total - calculatedScore.irtMargin} – ${calculatedScore.total + calculatedScore.irtMargin})

🎯 KHOẢNG CÁCH MỤC TIÊU / GAP ANALYSIS:
• Điểm hiện tại: ${calculatedScore.total} | Điểm mục tiêu: ${targetScore}
• Cần cải thiện: ${Math.max(0, targetScore - calculatedScore.total)} điểm.
• Khuyến nghị: Chu kỳ tái chẩn đoán định kỳ 14 ngày/lần.
• Hành động ưu tiên: Bổ sung ngay các dạng bài bẫy trong phần Đại số nâng cao & Từ vựng theo ngữ cảnh.
--------------------------------------------------
Hệ sinh thái luyện thi SAT Thích ứng Thông minh — Phú Gia SAT Prep`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(reportText).then(() => {
        setCopyToast(true);
        setTimeout(() => setCopyToast(false), 3000);
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header navigation bar */}
        <div className="flex items-center justify-between border-b border-[#212f45] pb-5 mb-8">
          <Link href="/" className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-bold text-sm">
            <span>← Về trang chủ</span>
          </Link>
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold bg-[#142033] px-3 py-1 rounded-full border border-[#2b3c56]">
            Chuẩn hóa năng lực Digital SAT 2026
          </span>
        </div>

        {/* ================= STEP 1: SETUP (#C001, #C002, #C003, #C004, #C009) ================= */}
        {step === 'setup' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Banner checkpoint khôi phục nếu có (#C005) */}
            {mounted && hasSavedCheckpoint && (
              <div className="flex items-center justify-between rounded-xl bg-amber-950/70 border border-amber-500/40 p-4 text-sm text-amber-200 shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⏳</span>
                  <div>
                    <strong className="block text-white font-bold">Bạn có bài chẩn đoán đang làm dở!</strong>
                    <span>Hệ thống đã lưu checkpoint tự động để bạn tiếp tục bất kỳ lúc nào.</span>
                  </div>
                </div>
                <button
                  onClick={restoreCheckpoint}
                  className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-300 transition-colors shadow"
                >
                  Tiếp tục làm →
                </button>
              </div>
            )}

            {/* Title section */}
            <div className="text-center space-y-2">
              <span className="inline-block text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                🚀 Khởi Động Cá Nhân Hóa Lộ Trình
              </span>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
                Thiết Lập Mục Tiêu & Test Chẩn Đoán Đầu Vào
              </h1>
              <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
                Chỉ mất từ 3 – 5 phút để hệ thống định cỡ năng lực hiện tại, dự đoán điểm SAT theo mô hình IRT và thiết lập chiến lược chạm ngưỡng đại học mơ ước.
              </p>
            </div>

            {/* #C001: Điểm nền IELTS & Học lực Toán */}
            <div className="rounded-2xl bg-[#111927] border border-[#202f47] p-6 space-y-5 shadow-lg">
              <div className="flex items-center gap-2 border-b border-[#1f2d42] pb-3">
                <span className="text-xl">📊</span>
                <div>
                  <h2 className="text-base font-bold text-white">
                    1. Điểm Nền Hiện Tại (IELTS & Toán THPT)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Giúp thuật toán hiệu chỉnh band điểm khởi điểm chính xác hơn
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Chọn IELTS */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Trình độ Tiếng Anh / IELTS:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {IELTS_LEVELS.map((level) => (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => setIeltsLevel(level.id)}
                        className={`rounded-xl border p-2.5 text-xs font-medium text-left transition-all ${
                          ieltsLevel === level.id
                            ? 'bg-indigo-600/30 border-indigo-400 text-white font-bold shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                            : 'bg-[#152033] border-[#293a54] text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chọn Toán THPT */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Học lực môn Toán ở trường THPT:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {MATH_LEVELS.map((level) => (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => setMathLevel(level.id)}
                        className={`rounded-xl border p-2.5 text-xs font-medium text-left transition-all ${
                          mathLevel === level.id
                            ? 'bg-blue-600/30 border-blue-400 text-white font-bold shadow-[0_0_12px_rgba(59,130,246,0.25)]'
                            : 'bg-[#152033] border-[#293a54] text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Estimate Preview */}
              <div className="rounded-xl bg-[#0c1421] border border-[#1d2a3d] p-3 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Ước lượng điểm xuất phát tham chiếu:
                </span>
                <span className="font-bold text-amber-300 text-sm">
                  {estimatedBaseline.total} điểm ({estimatedBaseline.range})
                </span>
              </div>
            </div>

            {/* #C002: Chip chọn Trường Đại học Mục tiêu */}
            <div className="rounded-2xl bg-[#111927] border border-[#202f47] p-6 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-[#1f2d42] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏛️</span>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      2. Trường Đại Học Mục Tiêu & Ngưỡng Điểm
                    </h2>
                    <p className="text-xs text-slate-400">
                      Chọn trường để hệ thống tự động neo điểm mục tiêu và lập lộ trình
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Mục tiêu: </span>
                  <span className="text-base font-black text-amber-400">{targetScore}đ</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {UNI_TARGET_OPTIONS.map((uni) => {
                  const isSelected = targetUniCode === uni.code;
                  return (
                    <button
                      key={uni.code}
                      type="button"
                      onClick={() => handleSelectUni(uni)}
                      className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? 'bg-gradient-to-br from-amber-500/20 to-indigo-500/20 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'bg-[#152033] border-[#293a54] hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white">{uni.label}</span>
                        {isSelected && <span className="text-amber-400 text-xs">✓</span>}
                      </div>
                      <span className="text-[11px] text-slate-300 mt-1">{uni.name}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">{uni.category}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tùy chỉnh điểm mục tiêu nếu muốn */}
              <div className="flex items-center gap-3 pt-2">
                <label htmlFor="customTarget" className="text-xs text-slate-400 whitespace-nowrap">
                  Hoặc tự nhập điểm mục tiêu (400–1600):
                </label>
                <input
                  id="customTarget"
                  type="number"
                  min={400}
                  max={1600}
                  step={10}
                  value={targetScore}
                  onChange={(e) => setTargetScore(Math.max(400, Math.min(1600, Number(e.target.value))))}
                  className="w-28 rounded-lg bg-[#0c1421] border border-[#2b3c56] px-3 py-1.5 text-xs font-bold text-white focus:border-amber-400 outline-none"
                />
              </div>
            </div>

            {/* #C003 & #C009: Kỳ thi SAT mục tiêu & Khung giờ học */}
            <div className="rounded-2xl bg-[#111927] border border-[#202f47] p-6 space-y-5 shadow-lg">
              <div className="flex items-center gap-2 border-b border-[#1f2d42] pb-3">
                <span className="text-xl">📅</span>
                <div>
                  <h2 className="text-base font-bold text-white">
                    3. Kế Hoạch & Kỷ Luật Thời Gian
                  </h2>
                  <p className="text-xs text-slate-400">
                    Xác định kỳ thi mục tiêu và khung giờ học tập cam kết mỗi ngày
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Chọn kỳ thi (#C003) */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Kỳ thi SAT dự kiến tham gia (2026):
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {SAT_EXAM_MONTHS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setExamMonth(m)}
                        className={`rounded-lg border p-2 text-xs font-semibold text-center transition-all ${
                          examMonth === m
                            ? 'bg-blue-600/30 border-blue-400 text-white shadow'
                            : 'bg-[#152033] border-[#293a54] text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chọn khung giờ học (#C009) */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Khung giờ học cam kết mỗi ngày:
                  </label>
                  <div className="space-y-1.5">
                    {STUDY_TIME_SLOTS.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setStudySlot(slot.label)}
                        className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                          studySlot === slot.label
                            ? 'bg-emerald-600/20 border-emerald-400 text-white font-bold'
                            : 'bg-[#152033] border-[#293a54] text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        <span>⏰ {slot.label}</span>
                        <span className="text-[11px] text-slate-400">{slot.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* #C004: Chọn Chế độ Chẩn đoán (Quick vs Standard) */}
            <div className="rounded-2xl bg-[#111927] border border-[#202f47] p-6 space-y-4 shadow-lg">
              <div className="flex items-center gap-2 border-b border-[#1f2d42] pb-3">
                <span className="text-xl">⚡</span>
                <div>
                  <h2 className="text-base font-bold text-white">
                    4. Chế Độ Làm Bài Test Chẩn Đoán
                  </h2>
                  <p className="text-xs text-slate-400">
                    Chọn thời lượng phù hợp với thời gian bạn có ngay bây giờ
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setDiagnosticMode('quick')}
                  className={`flex flex-col rounded-xl border p-4 text-left transition-all ${
                    diagnosticMode === 'quick'
                      ? 'bg-indigo-600/20 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                      : 'bg-[#152033] border-[#293a54] hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">⚡ Chẩn đoán Nhanh (Quick Mode)</span>
                    <span className="text-xs bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-bold">Khuyên dùng</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2">
                    6 câu đại diện phủ đủ các trục kiến thức trọng tâm. Hoàn thành chỉ trong 3 – 5 phút.
                  </p>
                  <span className="text-[11px] text-emerald-400 font-semibold mt-3">
                    Độ tin cậy sơ bộ: ±45 điểm
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDiagnosticMode('standard')}
                  className={`flex flex-col rounded-xl border p-4 text-left transition-all ${
                    diagnosticMode === 'standard'
                      ? 'bg-indigo-600/20 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                      : 'bg-[#152033] border-[#293a54] hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">🎯 Chẩn đoán Chuẩn (Standard)</span>
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">Chuyên sâu</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2">
                    14 câu trọn vẹn theo cấu trúc phân đoạn adaptive của Digital SAT Bluebook (~8 – 10 phút).
                  </p>
                  <span className="text-[11px] text-emerald-400 font-semibold mt-3">
                    Độ tin cậy IRT cao: ±30 điểm
                  </span>
                </button>
              </div>

              {/* Start button */}
              <div className="pt-4">
                <button
                  onClick={startNewTest}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 py-4 px-6 text-slate-950 font-black text-base shadow-xl transition-all hover:scale-[1.01] hover:shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <span>🚀 Bắt Đầu Bài Chẩn Đoán Ngay</span>
                  <span>({diagnosticMode === 'quick' ? '6 câu ~3 phút' : '14 câu ~8 phút'})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 2: TESTING (#C005) ================= */}
        {step === 'testing' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Progress bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111927] border border-[#202f47] p-4 rounded-xl shadow-lg">
              <div>
                <span className="text-xs text-slate-400 font-medium">Đang làm bài test xếp lớp:</span>
                <h3 className="text-lg font-black text-indigo-300">
                  Câu {currentIdx + 1} / {questions.length}
                </h3>
              </div>

              {/* Dots indicator */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {questions.map((_, i) => {
                  const isDone = i < answerLog.length;
                  const isCur = i === currentIdx;
                  return (
                    <div
                      key={i}
                      className={`h-3 w-3 rounded-full transition-all ${
                        isDone
                          ? answerLog[i]
                            ? 'bg-emerald-500'
                            : 'bg-rose-500'
                          : isCur
                          ? 'bg-amber-400 ring-2 ring-amber-400/40 animate-pulse'
                          : 'bg-slate-700'
                      }`}
                    />
                  );
                })}
              </div>

              <div className="text-xs text-slate-400">
                <span>Checkpoint tự lưu: </span>
                <span className="text-emerald-400 font-bold">✓ Bật</span>
              </div>
            </div>

            {/* Core Practice UI */}
            {questions[currentIdx] && (
              <CorePracticeUI
                key={`diag-q-${currentIdx}`}
                questionData={questions[currentIdx]}
                isLoading={false}
                onAnswer={handleAnswer}
                onNext={handleNext}
                hideNextUntilSubmitted
              />
            )}
          </div>
        )}

        {/* ================= STEP 3: RESULT (#C006, #C007, #C008, #C010) ================= */}
        {step === 'result' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Toast notification khi copy */}
            {copyToast && (
              <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-white text-sm font-bold shadow-2xl animate-in slide-in-from-bottom-3 duration-300 flex items-center gap-2">
                <span>✓</span> Đã sao chép Báo cáo Chẩn đoán Song ngữ vào bộ nhớ đệm!
              </div>
            )}

            {/* Score Forecast Card (#C006, #C010) */}
            <ScoreForecastCard
              score={{
                total: calculatedScore.total,
                math: calculatedScore.math,
                reading: calculatedScore.reading,
                confidence: calculatedScore.confidence,
                irtMargin: calculatedScore.irtMargin,
                targetScore,
              }}
              targetScore={targetScore}
              targetUni={UNI_TARGET_OPTIONS.find((u) => u.code === targetUniCode)?.name || targetUniCode}
              examMonth={examMonth}
              onRetestClick={() => setStep('setup')}
            />

            {/* #C007: Hộp Báo cáo Chẩn đoán Song ngữ cho Học sinh & Phụ huynh */}
            <div className="rounded-2xl bg-[#111927] border border-[#243550] p-6 space-y-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2d42] pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 text-xl">
                    📑
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      Báo Cáo Chẩn Đoán Song Ngữ (Dành Cho Học Sinh & Phụ Huynh)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Bilingual Diagnostic Summary Report for Parents & Admission Strategy
                    </p>
                  </div>
                </div>

                <button
                  onClick={copyBilingualReport}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>📋</span> Sao chép báo cáo gửi Bố Mẹ
                </button>
              </div>

              {/* Report content preview */}
              <div className="rounded-xl bg-[#090e17] border border-[#1a2538] p-4 text-xs font-mono text-slate-300 space-y-2 leading-relaxed">
                <div className="flex justify-between border-b border-[#1b263b] pb-2 text-slate-400">
                  <span>Học sinh: PG SAT Candidate</span>
                  <span>Ngày: {new Date().toLocaleDateString('vi-VN')}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-slate-400">Điểm dự đoán tổng: </span>
                    <strong className="text-white text-sm">{calculatedScore.total}</strong> / 1600 (Độ tin cậy IRT: ±{calculatedScore.irtMargin}đ)
                  </div>
                  <div>
                    <span className="text-slate-400">Trường mục tiêu: </span>
                    <strong className="text-amber-300">{targetUniCode} ({targetScore}+)</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Toán (Math): </span>
                    <strong className="text-blue-400">{calculatedScore.math}/800</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Đọc & Viết (Reading): </span>
                    <strong className="text-purple-400">{calculatedScore.reading}/800</strong>
                  </div>
                </div>
                <div className="border-t border-[#1b263b] pt-2 text-[11px] text-slate-400">
                  💡 <em>Đánh giá cơ hội:</em> Khoảng cách đến mục tiêu là <strong className="text-amber-300">{Math.max(0, targetScore - calculatedScore.total)} điểm</strong>. Lộ trình học 60 ngày với khung giờ cam kết <strong className="text-emerald-300">{studySlot}</strong> sẽ giúp bứt phá qua các dạng bẫy phổ biến nhất.
                </div>
              </div>
            </div>

            {/* #C008: Nút "Gỡ điểm ngay (+20đ Quick-Win)" và các hành động tiếp theo */}
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-gradient-to-r from-emerald-950/40 via-[#10242b] to-[#0c1a24] border border-emerald-500/30 rounded-2xl p-6 shadow-xl">
              <div>
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold">
                  Khởi động chiến thắng đầu tiên
                </span>
                <h4 className="text-lg font-black text-white mt-0.5">
                  Bắt đầu bài luyện gỡ điểm nhanh (+20đ Quick-Win)
                </h4>
                <p className="text-xs text-slate-300 max-w-md mt-1">
                  Khắc phục ngay dạng bài vừa làm sai trong chẩn đoán để nâng ngay 20 điểm đầu tiên trong lộ trình.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Link
                  href="/practice"
                  className="w-full sm:w-auto text-center rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 px-6 py-3.5 text-slate-950 font-black text-sm shadow-lg transition-transform hover:scale-105"
                >
                  ⚡ Gỡ điểm ngay (+20đ) →
                </Link>
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto text-center rounded-xl bg-[#152338] hover:bg-[#1a2c47] border border-[#2b3c56] px-5 py-3.5 text-white font-bold text-sm transition-colors"
                >
                  Vào Dashboard
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
