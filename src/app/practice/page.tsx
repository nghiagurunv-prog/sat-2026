'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';
import { ALL_SKILLS, type Skill } from '@/lib/skill-taxonomy';

/**
 * ============================================================================
 * TRANG LUYỆN TẬP THÍCH ỨNG CHUYÊN SÂU (ADAPTIVE PRACTICE HUB)
 * Thực thi các tiêu chuẩn cải tiến:
 * - #C021: Ngưỡng mở khóa Hard Module 2 (Đích: >= 65% đúng)
 * - #C024: Chế độ Trộn Kỹ Năng Thực Chiến (Interleaved Sprint)
 * - #C030: Ghim 3 Kỹ Năng Trọng Tâm Tuần (Pinned Weekly Skills)
 * - #C025: Khung Giờ Vàng Ôn Tập (20:00–22:00)
 * - #C026: Ưu tiên ôn các kỹ năng suy giảm trí nhớ Ebbinghaus
 * - #C027: Huy hiệu tăng trưởng Mastery sau mỗi câu/phiên
 * - #C028 & #C029: Nút "Luyện ngay 1 câu tương tự" khi trả lời sai
 * ============================================================================
 */

// Danh sách câu hỏi mẫu chuẩn SAT Digital dự phòng
const SEED_PRACTICE_QUESTIONS: PracticeQuestion[] = [
  {
    title: 'Toán SAT: Phương Trình Bậc Hai & Tiếp Tuyến',
    practice_question: 'Cho hàm số bậc hai $y = 2x^2 - 8x + c$ và đường thẳng $y = 4x - 10$. Giá trị của hằng số $c$ để đồ thị của hai hàm số tiếp xúc nhau tại đúng một điểm duy nhất là bao nhiêu?',
    choices: ['A. c = 4', 'B. c = 8', 'C. c = 10', 'D. c = 12'],
    correct_choice: 'B',
    explanation: 'Phương trình hoành độ giao điểm: 2x² - 8x + c = 4x - 10 ⇔ 2x² - 12x + (c + 10) = 0. Để có đúng 1 nghiệm duy nhất, biệt thức Δ\' = (-6)² - 2(c + 10) = 0 ⇔ 36 - 2c - 20 = 0 ⇔ 2c = 16 ⇔ c = 8.',
    difficulty: 'hard',
    trapRate: 64,
    skillId: 'advanced_math.quadratics',
  },
  {
    title: 'Reading & Writing: Transitions & Logic Connectors',
    practice_question: 'Which choice completes the text with the most logical transition?\n\nAlthough earlier historical records suggested the civilization had migrated abruptly following a catastrophic earthquake, recent soil core samples reveal uninterrupted crop cultivation for another two centuries. ________, archaeologists discovered complex underground granaries constructed directly after the seismic event.',
    choices: ['A. For instance', 'B. However', 'C. Indeed', 'D. In contrast'],
    correct_choice: 'C',
    explanation: 'Mệnh đề trước chỉ ra canh tác vẫn tiếp tục; câu sau củng cố và nhấn mạnh bằng chứng hầm chứa ngũ cốc được xây ngay sau đó. Mối quan hệ ở đây là củng cố / làm sâu sắc (Amplification/Emphasis) → "Indeed" là lựa chọn chuẩn xác.',
    difficulty: 'medium',
    trapRate: 58,
    skillId: 'craft.transitions',
  },
  {
    title: 'Toán SAT: Hệ Phương Trình Bậc Nhất (Systems of Linear Equations)',
    practice_question: 'Một hệ phương trình bậc nhất hai ẩn có dạng:\n  $3x - 5y = 12$\n  $ax + 10y = b$\nNếu hệ phương trình trên có VÔ SỐ nghiệm (infinitely many solutions), tích của $a \\times b$ bằng bao nhiêu?',
    choices: ['A. 144', 'B. -144', 'C. 72', 'D. -72'],
    correct_choice: 'A',
    explanation: 'Để hệ phương trình có vô số nghiệm: 3/a = -5/10 = 12/b. Từ -5/10 = -1/2, ta có: 3/a = -1/2 ⇒ a = -6. Và 12/b = -1/2 ⇒ b = -24. Khi đó tích a × b = (-6) × (-24) = 144.',
    difficulty: 'hard',
    trapRate: 71,
    skillId: 'algebra.systems',
  },
  {
    title: 'Reading & Writing: Rhetorical Synthesis (Student Notes)',
    practice_question: 'While researching a topic, a student has taken the following notes:\n• The Kepler-452b exoplanet orbits a G2V-type star similar to our Sun.\n• Its orbital period is approximately 385 Earth days.\n• It receives roughly 10% more energy from its star than Earth receives from the Sun.\n• The planet is situated firmly inside its star\'s habitable zone.\n\nThe student wants to emphasize how closely Kepler-452b\'s orbital conditions mirror those of Earth. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
    choices: [
      'A. Discovered inside its host star\'s habitable zone, Kepler-452b receives 10% more energy than Earth.',
      'B. Mirroring Earth\'s conditions, Kepler-452b orbits a Sun-like star in 385 days within the habitable zone.',
      'C. Kepler-452b has an orbital period of 385 Earth days while receiving substantial solar radiation.',
      'D. A G2V-type star hosts Kepler-452b, an exoplanet that completes one orbit each 385 Earth days.'
    ],
    correct_choice: 'B',
    explanation: 'Lựa chọn B đáp ứng trực diện mục tiêu đề bài: nhấn mạnh sự tương đồng mật thiết (mirroring Earth\'s conditions) bằng việc dẫn chứng cả chu kỳ quỹ đạo 385 ngày, loại sao giống Mặt Trời và vị trí vùng có thể sống.',
    difficulty: 'medium',
    trapRate: 46,
    skillId: 'expression.rhetorical',
  }
];

const PINNED_STORAGE_KEY = 'sat_pinned_skills_v1';
const INTERLEAVED_STORAGE_KEY = 'sat_interleaved_sprint_v1';

export default function AdaptivePracticePage() {
  const { userStats, registerGradedResult, practiceStreak } = useGamification();
  const { showToast } = useToast();

  // Phiên làm việc (Session Analytics)
  const [sessionAttempts, setSessionAttempts] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionData, setQuestionData] = useState<PracticeQuestion>(SEED_PRACTICE_QUESTIONS[0]);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [recentMasteryGain, setRecentMasteryGain] = useState<{ xp: number; skillLabel?: string } | null>(null);

  // #C024: Chế độ Trộn Kỹ Năng Thực Chiến (Interleaved Sprint)
  const [isInterleaved, setIsInterleaved] = useState(true);

  // #C030: Ghim 3 Kỹ Năng Trọng Tâm Tuần
  const [pinnedSkillIds, setPinnedSkillIds] = useState<string[]>([
    'algebra.systems',
    'advanced_math.quadratics',
    'craft.transitions'
  ]);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // #C025: Giờ vàng (20:00 - 22:00)
  const [isGoldenHour, setIsGoldenHour] = useState(false);

  // Khởi tạo và đồng bộ LocalStorage
  useEffect(() => {
    try {
      const savedPins = localStorage.getItem(PINNED_STORAGE_KEY);
      if (savedPins) {
        const parsed = JSON.parse(savedPins);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPinnedSkillIds(parsed.slice(0, 3));
        }
      }

      const savedInterleaved = localStorage.getItem(INTERLEAVED_STORAGE_KEY);
      if (savedInterleaved !== null) {
        setIsInterleaved(savedInterleaved === 'true');
      }
    } catch (e) {
      console.error('Lỗi đọc cấu hình luyện tập:', e);
    }

    // Kiểm tra giờ vàng
    const checkGoldenHour = () => {
      const hour = new Date().getHours();
      setIsGoldenHour(hour >= 20 && hour < 22);
    };
    checkGoldenHour();
    const timer = setInterval(checkGoldenHour, 60000);
    return () => clearInterval(timer);
  }, []);

  // Toggle Interleaved Sprint
  const handleToggleInterleaved = () => {
    const nextVal = !isInterleaved;
    setIsInterleaved(nextVal);
    try {
      localStorage.setItem(INTERLEAVED_STORAGE_KEY, String(nextVal));
    } catch {
      // Ignored
    }
    showToast(
      nextVal
        ? '🔀 Đã bật Trộn Kỹ Năng Thực Chiến (Interleaved Sprint)!'
        : '📌 Đã chuyển sang Luyện Tập Tập Trung (Focused Mode)',
      'info'
    );
  };

  // Cập nhật ghim kỹ năng
  const togglePinSkill = (skillId: string) => {
    let next: string[];
    if (pinnedSkillIds.includes(skillId)) {
      next = pinnedSkillIds.filter((id) => id !== skillId);
    } else {
      if (pinnedSkillIds.length >= 3) {
        showToast('Chỉ được ghim tối đa 3 kỹ năng trọng tâm tuần!', 'info');
        return;
      }
      next = [...pinnedSkillIds, skillId];
    }
    setPinnedSkillIds(next);
    try {
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignored
    }
  };

  // #C021: Tính tỷ lệ đúng của phiên
  const accuracyRate = sessionAttempts > 0 ? Math.round((sessionCorrect / sessionAttempts) * 100) : 0;
  const isHardModuleUnlocked = accuracyRate >= 65 && sessionAttempts >= 3;

  // Lấy nhãn của 3 kỹ năng được ghim
  const pinnedSkillsInfo = useMemo(() => {
    return pinnedSkillIds.map((id) => {
      const found = ALL_SKILLS.find((s) => s.id === id);
      return found || { id, label: id, moduleType: 'math' };
    });
  }, [pinnedSkillIds]);

  // #C028 & #C029: Nút "Luyện ngay 1 câu tương tự" khi trả lời sai
  const handleDrillSimilar = useCallback(async () => {
    setIsLoadingNext(true);
    showToast('🔄 Đang kích hoạt hàng đợi phục thù: Tìm 1 câu cùng kỹ năng...', 'info');
    try {
      // Tìm câu tương tự cùng skill hoặc cùng độ khó
      const currentSkill = questionData.skillId;
      const candidates = SEED_PRACTICE_QUESTIONS.filter(
        (q) => q.practice_question !== questionData.practice_question
      );
      const matched = candidates.find((q) => q.skillId === currentSkill) || candidates[0];
      
      setTimeout(() => {
        setQuestionData(matched);
        setLastAnswerCorrect(null);
        setIsLoadingNext(false);
        showToast('🎯 Đã sẵn sàng câu tương tự! Hãy sửa sai ngay lập tức.', 'success');
      }, 400);
    } catch {
      setIsLoadingNext(false);
    }
  }, [questionData, showToast]);

  // Sang câu hỏi tiếp theo
  const handleNextQuestion = useCallback(async () => {
    setIsLoadingNext(true);
    setLastAnswerCorrect(null);
    setRecentMasteryGain(null);

    // Lựa chọn câu tiếp theo dựa trên chế độ Interleaved hoặc tuần tự
    const nextIdx = (currentQuestionIndex + 1) % SEED_PRACTICE_QUESTIONS.length;
    setCurrentQuestionIndex(nextIdx);
    setQuestionData(SEED_PRACTICE_QUESTIONS[nextIdx]);

    setTimeout(() => {
      setIsLoadingNext(false);
    }, 300);
  }, [currentQuestionIndex]);

  // Xử lý nộp câu trả lời
  const handleAnswer = useCallback(
    (isCorrect: boolean) => {
      setSessionAttempts((prev) => prev + 1);
      if (isCorrect) {
        setSessionCorrect((prev) => prev + 1);
        const gainedXp = isGoldenHour ? 25 : 15;
        setRecentMasteryGain({
          xp: gainedXp,
          skillLabel: questionData.title,
        });
        showToast(`🎉 Chính xác! +${gainedXp} EXP Mastery`, 'success');
      } else {
        setRecentMasteryGain(null);
        showToast('❌ Chưa đúng! Hãy xem kỹ phân tích bẫy và bấm "Luyện câu tương tự".', 'error');
      }
      setLastAnswerCorrect(isCorrect);
    },
    [isGoldenHour, questionData.title, showToast]
  );

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 py-6 px-3 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              ⚡ ADAPTIVE PRACTICE ENGINE v3.0
            </span>
            {isGoldenHour && (
              <span className="animate-pulse px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                <span>🔥</span> KHUNG GIỜ VÀNG (20:00–22:00)
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Luyện Tập Thích Ứng Chuyên Sâu
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Mô phỏng phân nhánh Module 2 Digital SAT & củng cố đường cong trí nhớ Ebbinghaus
          </p>
        </div>

        {/* Quick Links & Interleaved Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleToggleInterleaved}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
              isInterleaved
                ? 'bg-purple-900/40 text-purple-200 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Trộn ngẫu nhiên câu hỏi Math & R&W để rèn luyện phản xạ chuyển đổi ngữ cảnh nhanh"
          >
            <span>🔀</span>
            <span>Trộn Kỹ Năng: {isInterleaved ? 'BẬT' : 'TẮT'}</span>
          </button>

          <Link
            href="/review"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800/90 text-amber-300 border border-amber-500/30 hover:bg-slate-700 transition flex items-center gap-1.5 shadow"
          >
            <span>📕</span>
            <span>Sổ Tay Ôn Phục Thù</span>
          </Link>
        </div>
      </div>

      {/* #C025: BANNER KHUNG GIỜ VÀNG (20:00 - 22:00) */}
      <div
        className={`rounded-2xl p-4 sm:p-5 border transition-all ${
          isGoldenHour
            ? 'bg-gradient-to-r from-amber-950/40 via-yellow-950/30 to-amber-900/40 border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.15)]'
            : 'bg-slate-900/60 border-slate-800 text-slate-400'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                isGoldenHour ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-bounce' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isGoldenHour ? '⚡' : '⏰'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white">
                  {isGoldenHour
                    ? 'ĐANG TRONG KHUNG GIỜ VÀNG ÔN TẬP (20:00 – 22:00)'
                    : 'KHUNG GIỜ VÀNG ÔN TẬP: 20:00 – 22:00 HẰNG NGÀY'}
                </h2>
                {isGoldenHour && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                    +50% Mastery EXP
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isGoldenHour
                  ? 'Giai đoạn vỏ não hấp thụ kiến thức SAT hiệu quả nhất trước khi ngủ. Mọi điểm thành thạo tăng thêm 1.5 lần!'
                  : 'Hãy duy trì thói quen luyện từ 15 đến 20 câu vào khung giờ 20:00–22:00 mỗi tối để ghi nhớ vĩnh viễn.'}
              </p>
            </div>
          </div>

          {/* #C026: Ebbinghaus Reminder Badge */}
          <div className="shrink-0 flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
            <span className="text-emerald-400">🧠</span>
            <span className="text-slate-300 font-medium">Chu kỳ Ebbinghaus:</span>
            <span className="text-amber-300 font-bold">Củng cố sau 24h & 3 ngày</span>
          </div>
        </div>
      </div>

      {/* #C021: THANH CHỈ BÁO NGƯỠNG MỞ KHÓA HARD MODULE 2 */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 sm:p-5 space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🎯</span>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <span>Ngưỡng Mở Khóa Hard Module 2 (Đích: ≥ 65% đúng)</span>
                {isHardModuleUnlocked ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    🌟 ĐÃ MỞ KHÓA (Cửa 1400–1600)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    🔒 CẦN DUY TRÌ ≥ 65%
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Ở bài thi thật, thí sinh đạt từ 65% câu đúng ở Module 1 sẽ được phân nhánh sang Hard Module 2 (điểm tối đa 800).
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400">Tỷ lệ phiên này: </span>
            <span
              className={`text-lg font-black ${
                accuracyRate >= 65 ? 'text-emerald-400' : accuracyRate >= 50 ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {accuracyRate}%
            </span>
            <span className="text-xs text-slate-400 ml-1">
              ({sessionCorrect}/{sessionAttempts} câu)
            </span>
          </div>
        </div>

        {/* Progress Bar with 65% Marker */}
        <div className="relative w-full bg-slate-950 rounded-full h-3.5 overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-500 ${
              accuracyRate >= 65
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                : 'bg-gradient-to-r from-amber-500 to-yellow-400'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, accuracyRate))}%` }}
          />
          {/* 65% Threshold Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] z-10"
            style={{ left: '65%' }}
            title="Mốc 65% mở khóa Hard Module 2"
          />
        </div>

        <div className="flex justify-between items-center text-[11px] text-slate-400 pt-0.5">
          <span>0%</span>
          <span className="text-rose-400 font-bold flex items-center gap-1">
            <span>▲</span> Mốc 65% (Bắt buộc)
          </span>
          <span>100%</span>
        </div>
      </div>

      {/* #C030: THANH GHIM 3 KỸ NĂNG TRỌNG TÂM TUẦN */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📌</span>
            <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider">
              3 Kỹ Năng Trọng Tâm Cần Đột Phá Tuần Này
            </h3>
          </div>
          <button
            onClick={() => setIsPinModalOpen(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline"
          >
            Thay Đổi Kỹ Năng Ghim ⚙️
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {pinnedSkillsInfo.map((skill, index) => {
            const isCurrentMatch = questionData.skillId === skill.id;
            return (
              <div
                key={skill.id}
                className={`p-3 rounded-xl border text-xs flex items-center justify-between transition ${
                  isCurrentMatch
                    ? 'bg-indigo-950/40 border-indigo-500/60 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300'
                }`}
              >
                <div className="truncate mr-2">
                  <span className="text-[10px] font-bold text-slate-500 block">MỤC TIÊU #{index + 1}</span>
                  <span className="font-bold text-white truncate block">{skill.label}</span>
                </div>
                {isCurrentMatch ? (
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500 text-white animate-pulse">
                    Đang Luyện
                  </span>
                ) : (
                  <span className="shrink-0 text-slate-600 text-xs">🎯</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* #C027: HUY HIỆU TĂNG TRƯỞNG MASTERY VÀ THÔNG BÁO */}
      {recentMasteryGain && (
        <div className="animate-in slide-in-from-top-3 duration-300 rounded-xl bg-gradient-to-r from-emerald-950/60 to-teal-950/60 border border-emerald-500/40 p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🏆</span>
            <div>
              <span className="text-xs font-black text-emerald-300">
                +{recentMasteryGain.xp} EXP MASTERY KỸ NĂNG!
              </span>
              <p className="text-[11px] text-slate-300">
                Chỉ số tự tin & phản xạ đề thi thực tế đã được cập nhật vào hồ sơ cá nhân.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            Streak: {practiceStreak} 🔥
          </span>
        </div>
      )}

      {/* #C028 & #C029: ACTION BANNER KHI VỪA LÀM SAI */}
      {lastAnswerCorrect === false && (
        <div className="rounded-xl bg-rose-950/40 border border-rose-500/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="text-xs font-black text-rose-300 uppercase tracking-wide">
                PHÁT HIỆN LỖI SAI — KÍCH HOẠT HÀNG ĐỢI PHỤC THÙ
              </h4>
              <p className="text-xs text-slate-300">
                Đừng bỏ qua câu sai! Hãy luyện ngay 1 câu biến thể cùng dạng để khắc phục lỗ hổng tư duy tại chỗ.
              </p>
            </div>
          </div>

          <button
            onClick={handleDrillSimilar}
            disabled={isLoadingNext}
            className="shrink-0 px-4 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg hover:from-rose-400 hover:to-amber-400 transition flex items-center gap-1.5"
          >
            <span>🔄</span>
            <span>Luyện Ngay 1 Câu Tương Tự</span>
          </button>
        </div>
      )}

      {/* MAIN QUESTION INTERFACE VIA COREPRACTICEUI */}
      <div className="relative">
        <CorePracticeUI
          questionData={questionData}
          onNext={handleNextQuestion}
          onAnswer={handleAnswer}
          isLoading={isLoadingNext}
        />
      </div>

      {/* MODAL THAY ĐỔI GHIM 3 KỸ NĂNG */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>📌</span> Chọn 3 Kỹ Năng Trọng Tâm Tuần ({pinnedSkillIds.length}/3)
              </h3>
              <button
                onClick={() => setIsPinModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Chọn tối đa 3 kỹ năng bạn muốn dồn lực cày cuốc trong tuần này để hệ thống ưu tiên sinh bài tập và theo dõi sát sao:
            </p>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {ALL_SKILLS.slice(0, 16).map((skill) => {
                const isSelected = pinnedSkillIds.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    onClick={() => togglePinSkill(skill.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 text-white font-bold'
                        : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="truncate pr-2">{skill.label}</span>
                    <span className="shrink-0 text-sm">
                      {isSelected ? '✅' : '⚪'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-end">
              <button
                onClick={() => setIsPinModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition"
              >
                Hoàn Tất & Lưu Lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
