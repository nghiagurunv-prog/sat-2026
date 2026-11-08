'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import { getSkill } from '@/lib/skill-taxonomy';
import { BadgeSystem } from '@/components/BadgeSystem';
import { AITutoring } from '@/components/AITutoring';
import { MistakeNotebook } from '@/components/MistakeNotebook';
import { DiagnosticBanner } from '@/components/DiagnosticBanner';

export type TargetSchoolKey = 'FTU' | 'NEU' | 'HUST' | 'VINUNI' | 'US_TOP50';

export interface CollegeTargetState {
  targetSchool: TargetSchoolKey;
  targetScore: number;
  examMonth: string;
  completed: boolean;
}

const SCHOOL_DATA: Record<
  TargetSchoolKey,
  { name: string; full: string; safeScore: string; icon: string; desc: string; defaultScore: number }
> = {
  FTU: {
    name: 'Ngoại Thương (FTU)',
    full: 'ĐH Ngoại Thương Hà Nội & CS2 TP.HCM',
    safeScore: '1420 – 1480+',
    icon: '🏛️',
    desc: 'Xét tuyển kết hợp chứng chỉ SAT cho nhóm ngành Kinh tế & Kinh doanh Quốc tế.',
    defaultScore: 1450,
  },
  NEU: {
    name: 'Kinh Tế Quốc Dân (NEU)',
    full: 'ĐH Kinh Tế Quốc Dân',
    safeScore: '1380 – 1450+',
    icon: '📈',
    desc: 'Ưu tiên xét tuyển SAT vào các chương trình Tiên tiến & Chất lượng cao.',
    defaultScore: 1400,
  },
  HUST: {
    name: 'Bách Khoa Hà Nội (HUST)',
    full: 'ĐH Bách Khoa Hà Nội',
    safeScore: '1400 – 1480+',
    icon: '⚙️',
    desc: 'Xét tuyển tài năng & kết hợp SAT (yêu cầu Toán SAT ≥ 750 điểm cho IT/CS).',
    defaultScore: 1450,
  },
  VINUNI: {
    name: 'VinUni / RMIT',
    full: 'VinUniversity & RMIT Vietnam',
    safeScore: '1450 – 1530+',
    icon: '🦅',
    desc: 'Cơ hội săn học bổng danh giá 50% – 100% học phí toàn khóa.',
    defaultScore: 1500,
  },
  US_TOP50: {
    name: 'Du học Mỹ (Top 50 / Ivy)',
    full: 'Top 50 Đại học Mỹ & Ivy League',
    safeScore: '1520 – 1580+',
    icon: '🗽',
    desc: 'Cạnh tranh hồ sơ quốc tế, tối ưu hóa cơ hội nhận Financial Aid / Merit Scholarship.',
    defaultScore: 1550,
  },
};

const SCORE_PRESETS = [1300, 1400, 1500, 1550];

const EXAM_MONTH_OPTIONS = [
  { label: 'Tháng 5/2026', value: '2026-05' },
  { label: 'Tháng 6/2026', value: '2026-06' },
  { label: 'Tháng 8/2026', value: '2026-08' },
  { label: 'Tháng 10/2026', value: '2026-10' },
  { label: 'Tháng 12/2026', value: '2026-12' },
];

function getDaysUntilMonth(monthStr: string): number {
  try {
    if (!monthStr || typeof monthStr !== 'string') return 60;
    const parts = monthStr.split('-').map(Number);
    if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return 60;
    const [year, month] = parts;
    const targetDate = new Date(year, month - 1, 15);
    const targetTime = targetDate.getTime();
    if (!Number.isFinite(targetTime)) return 60;
    const now = new Date();
    const diff = targetTime - now.getTime();
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.ceil(diff / msPerDay);
    return Number.isFinite(days) ? Math.max(0, days) : 60;
  } catch {
    return 60;
  }
}

interface MiniQuestion {
  id: number;
  title: string;
  category: string;
  badge: string;
  badgeColor: string;
  prompt: string;
  passage?: string;
  options: { id: string; text: string }[];
  correct: string;
  explanation: string;
  trap: string;
  desmosTip?: string;
}

const MINI_QUESTIONS: MiniQuestion[] = [
  {
    id: 1,
    title: 'Câu 1/3: Toán Desmos',
    category: 'Math — Advanced Math (Algebra & Systems)',
    badge: '⚡ Bí kíp Desmos 5 Giây',
    badgeColor: 'from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/30',
    prompt: 'Cho hệ phương trình bậc hai và đường thẳng:\n  y = 2x² - 8x + k\n  y = 4x - 10\n\nTìm giá trị của hằng số k để hệ phương trình trên có đúng MỘT nghiệm thực duy nhất (x, y).',
    options: [
      { id: 'A', text: 'k = 4' },
      { id: 'B', text: 'k = 8' },
      { id: 'C', text: 'k = 10' },
      { id: 'D', text: 'k = 12' },
    ],
    correct: 'B',
    explanation: 'Phương trình hoành độ giao điểm: 2x² - 8x + k = 4x - 10 ⇔ 2x² - 12x + (k + 10) = 0. Để hệ có đúng 1 nghiệm thực, biệt thức Δ\' = (-6)² - 2(k + 10) = 0 ⇔ 36 - 2k - 20 = 0 ⇔ 2k = 16 ⇔ k = 8.',
    trap: 'Bẫy kinh điển: Chuyển -10 từ vế phải sang vế trái quên đổi dấu thành +10, dẫn đến giải sai 36 - 2k + 20 = 0 → k = 28 hoặc nhầm lẫn công thức Δ.',
    desmosTip: '🔥 Tuyệt chiêu Desmos: Dòng 1 gõ: y = 2x^2 - 8x + k (bấm add slider k). Dòng 2 gõ: y = 4x - 10. Kéo slider k thấy ngay tại k = 8 parabol tiếp xúc đúng 1 điểm duy nhất với đường thẳng tại (3, 2). Ra đáp án trong 5 giây!',
  },
  {
    id: 2,
    title: 'Câu 2/3: Từ Nối Transitions',
    category: 'Reading & Writing — Craft and Structure (Transitions)',
    badge: '🎯 Bẫy Logic Quan Hệ',
    badgeColor: 'from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30',
    prompt: 'Which choice completes the text with the most logical transition?',
    passage: 'Although many historians previously believed that the ancient settlement was abandoned abruptly due to a catastrophic drought, recent sediment core analyses reveal that agricultural activities continued uninterrupted for over two centuries after the dry spell. ________, the community developed ingenious micro-irrigation canals to maintain consistent crop yields.',
    options: [
      { id: 'A', text: 'For example' },
      { id: 'B', text: 'However' },
      { id: 'C', text: 'In fact' },
      { id: 'D', text: 'In contrast' },
    ],
    correct: 'C',
    explanation: 'Mệnh đề trước đã chứng minh khu dân cư không hề bị bỏ hoang mà vẫn canh tác suốt 2 thế kỷ sau hạn hán. Câu tiếp theo đưa ra dẫn chứng củng cố, làm sâu sắc thêm thành tựu vượt trội của họ ("thực tế là/thậm chí họ còn phát triển kênh vi tưới"). Mối quan hệ ở đây là Nhấn mạnh & Làm sâu sắc (Emphasis/Amplification) → "In fact" là lựa chọn logic hoàn hảo.',
    trap: 'Bẫy SAT kinh điển: Thấy chữ "Although" ở đầu câu trước liền vội vã chọn "However" hoặc "In contrast". Lưu ý: "Although" đã giải quyết sự tương phản nội bộ ở câu trước rồi; câu tiếp theo nối tiếp bổ trợ cho mệnh đề khẳng định chính phía sau dấu phẩy!',
  },
  {
    id: 3,
    title: 'Câu 3/3: Reading Central Idea',
    category: 'Reading & Writing — Information and Ideas (Central Idea)',
    badge: '📖 Bẫy Extreme Language',
    badgeColor: 'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30',
    prompt: 'Which choice best describes the main idea of the text?',
    passage: 'Biologist Elena Morales investigated how urban noise affects the song frequency of great tits (Parus major). Morales observed that birds inhabiting bustling city centers vocalized at significantly higher minimum frequencies than their rural counterparts. While higher frequencies penetrate urban low-frequency rumble more effectively, Morales noted that these shrill songs are acoustically less rich, potentially diminishing a male\'s appeal to prospective mates during breeding season.',
    options: [
      { id: 'A', text: 'Urban noise has caused great tits to abandon low-frequency acoustic communication entirely in favor of visual mating displays.' },
      { id: 'B', text: 'Shifting to higher vocal frequencies aids urban great tits in overcoming noise pollution, though it may incur an evolutionary cost in mate attraction.' },
      { id: 'C', text: 'Rural great tits are more successful at mating than urban great tits because low-frequency songs are universally preferred by females.' },
      { id: 'D', text: 'Morales\'s findings prove that noise pollution is the single greatest threat to songbird populations worldwide.' },
    ],
    correct: 'B',
    explanation: 'Toàn bộ đoạn văn được triển khai theo cấu trúc 2 vế đối trọng kinh điển: (1) Lợi thế thích nghi (vượt qua tạp âm tần số thấp ở đô thị) và (2) Sự đánh đổi tiến hóa ("potentially diminishing mate appeal"). Đáp án B bao quát chuẩn xác cả hai vế (Benefit vs Trade-off).',
    trap: 'Bẫy SAT kinh điển: Đáp án A dùng từ ngữ cực đoan ("abandon entirely" - bài không nói chim bỏ hoàn toàn). Đáp án D phóng đại quá mức ("single greatest threat worldwide"). Đáp án C tự ý suy diễn ngoài bài ("universally preferred").',
  },
];

interface ScorePrediction {
  total: number;
  confidence: 'low' | 'medium' | 'high';
  totalAttempts: number;
  focusSkills: Array<{ id: string; label: string; score: number; subject?: string }>;
  detailLocked?: boolean;
}

function practiceRouteForSkill(skillId: string): string {
  const moduleType = getSkill(skillId)?.moduleType;
  if (moduleType === 'vocab') return '/vocab';
  if (moduleType === 'literature') return '/literature';
  if (moduleType === 'desmos') return '/desmos';
  return '/math';
}

export default function Home() {
  const {
    level, masteredCount, totalNodes, coins, shields, maxPower, dayStreak,
    syncDayStreak, claimDailyLogin,
    soundEnabled, setSoundEnabled,
    focusMode, setFocusMode,
    hideBanner, setHideBanner,
    learningMode,
    onboardingCompleted,
    gamificationLoaded
  } = useGamification();

  const { showToast } = useToast();

  const [todayPlan, setTodayPlan] = useState<ScorePrediction | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [todayItems, setTodayItems] = useState<Array<{ kind: string; title: string; href: string; rationale: string }>>([]);
  const [weeklyDelta, setWeeklyDelta] = useState<number | null>(null);

  // --- WIZARD ONBOARDING 30 GIÂY STATE ---
  const [collegeGoal, setCollegeGoal] = useState<CollegeTargetState | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [draftSchool, setDraftSchool] = useState<TargetSchoolKey>('FTU');
  const [draftScore, setDraftScore] = useState<number>(1450);
  const [draftMonth, setDraftMonth] = useState<string>('2026-06');
  const [isClient, setIsClient] = useState(false);

  // Đọc localStorage khi client mount
  useEffect(() => {
    setIsClient(true);
    try {
      const raw = localStorage.getItem('sat_onboarding_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as CollegeTargetState;
        if (parsed && parsed.completed) {
          setCollegeGoal(parsed);
          setDraftSchool(parsed.targetSchool || 'FTU');
          setDraftScore(parsed.targetScore || 1450);
          setDraftMonth(parsed.examMonth || '2026-06');
          setShowWizard(false);
          return;
        }
      }
      // Nếu chưa có mục tiêu, mở wizard chào đón
      setShowWizard(true);
    } catch {
      setShowWizard(true);
    }
  }, []);

  const handleSaveCollegeGoal = () => {
    const newGoal: CollegeTargetState = {
      targetSchool: draftSchool,
      targetScore: draftScore,
      examMonth: draftMonth,
      completed: true,
    };
    try {
      localStorage.setItem('sat_onboarding_v1', JSON.stringify(newGoal));
    } catch (e) {
      console.error('Không lưu được onboarding', e);
    }
    setCollegeGoal(newGoal);
    setShowWizard(false);
    showToast(`🎯 Đã lưu mục tiêu: ${SCHOOL_DATA[draftSchool].name} — Target ${draftScore}!`, 'success');
  };

  // --- WIDGET MINI-DIAGNOSTIC 60 GIÂY STATE ---
  const [miniQIndex, setMiniQIndex] = useState(0);
  const [miniAnswers, setMiniAnswers] = useState<Record<number, string>>({});
  const [miniShowResult, setMiniShowResult] = useState(false);
  const [miniCompleted, setMiniCompleted] = useState(false);

  const currentQ = MINI_QUESTIONS[miniQIndex];
  const selectedAnswer = miniAnswers[miniQIndex];
  const isAnswerCorrect = selectedAnswer === currentQ?.correct;

  const totalCorrectMini = useMemo(() => {
    return MINI_QUESTIONS.reduce((acc, q, idx) => {
      return miniAnswers[idx] === q.correct ? acc + 1 : acc;
    }, 0);
  }, [miniAnswers]);

  const handlePickOption = (optionId: string) => {
    if (miniShowResult) return;
    setMiniAnswers((prev) => ({ ...prev, [miniQIndex]: optionId }));
    setMiniShowResult(true);
  };

  const handleNextMiniQ = () => {
    if (miniQIndex < MINI_QUESTIONS.length - 1) {
      setMiniQIndex((prev) => prev + 1);
      setMiniShowResult(false);
    } else {
      setMiniCompleted(true);
    }
  };

  const handleRestartMini = () => {
    setMiniAnswers({});
    setMiniQIndex(0);
    setMiniShowResult(false);
    setMiniCompleted(false);
  };

  // 🔥 Đồng bộ chuỗi ngày học 1 lần khi vào trang chủ
  const streakSyncedRef = useRef(false);
  useEffect(() => {
    if (!gamificationLoaded) return;
    if (streakSyncedRef.current) return;
    streakSyncedRef.current = true;
    async function sync() {
      const r = await syncDayStreak();
      if (r.grantedCoins > 0 && r.milestonesReached.length > 0) {
        const topMilestone = Math.max(...r.milestonesReached);
        showToast(`🔥 Chuỗi ${topMilestone} ngày! Nhận thưởng ${r.grantedCoins} Xu. Giữ lửa nhé!`, 'success');
      }
      const login = await claimDailyLogin();
      if (login.grantedCoins > 0) {
        showToast(`🎁 Điểm danh hôm nay: +${login.grantedCoins} Xu! Mai quay lại nhé.`, 'success');
      }
    }
    sync();
  }, [syncDayStreak, claimDailyLogin, showToast, gamificationLoaded]);

  useEffect(() => {
    let cancelled = false;
    async function loadTodayPlan() {
      try {
        const res = await fetch('/api/score');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setTodayPlan(data);
      } catch (e) {
        console.error('Không tải được kế hoạch hôm nay', e);
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    }
    loadTodayPlan();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadToday() {
      try {
        const res = await fetch('/api/today');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data?.plan?.items)) setTodayItems(data.plan.items);
        if (typeof data?.weeklyDelta === 'number') setWeeklyDelta(data.weeklyDelta);
      } catch (e) {
        console.error('Không tải được /api/today', e);
      }
    }
    loadToday();
    return () => { cancelled = true; };
  }, []);

  const masteryPercent =
    totalNodes > 0 && Number.isFinite(totalNodes) && Number.isFinite(masteredCount)
      ? Math.min(100, Math.max(0, (masteredCount / totalNodes) * 100))
      : 0;
  const planFocusSkill = todayPlan?.focusSkills?.[0];
  const hasPracticeData = (todayPlan?.totalAttempts ?? 0) > 0;
  const primaryPlanHref = planFocusSkill ? practiceRouteForSkill(planFocusSkill.id) : onboardingCompleted ? '/math' : '/diagnostic';
  const primaryPlanLabel = planFocusSkill ? `Luyện ngay: ${planFocusSkill.label}` : onboardingCompleted ? 'Bắt đầu luyện 10 câu' : 'Làm diagnostic 5 phút';

  return (
    <div className="space-y-8 animate-in fade-in duration-700 relative">

      {/* CÁC NÚT ĐIỀU KHIỂN GIAO DIỆN (GÓC PHẢI) */}
      <div className="flex justify-end gap-6 items-center mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} className="toggle-checkbox" />
          <span className="text-sm text-gray-300">🔊 Âm thanh</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={focusMode} onChange={(e) => setFocusMode(e.target.checked)} className="toggle-checkbox" />
          <span className="text-sm text-gray-300">📺 Tập trung</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={hideBanner} onChange={(e) => setHideBanner(e.target.checked)} className="toggle-checkbox" />
          <span className="text-sm text-gray-300">🙈 Ẩn Banner</span>
        </label>
      </div>

      {focusMode && (
        <div className="mb-4">
          <button onClick={() => setFocusMode(false)} className="bg-[#262730] hover:bg-[#333] text-white px-4 py-2 rounded text-sm transition-colors border border-[#404353]">
            ⬅️ Thoát chế độ tập trung (Hiện lại Menu)
          </button>
        </div>
      )}

      {/* Gợi ý làm bài test xếp lớp */}
      {!focusMode && <DiagnosticBanner />}

      {/* ======================================================== */}
      {/* 🎯 WIZARD ONBOARDING 30S & HERO GOAL BANNER               */}
      {/* ======================================================== */}
      {isClient && !focusMode && (
        <>
          {showWizard ? (
            <section className="relative overflow-hidden rounded-2xl border-2 border-amber-400/40 bg-gradient-to-br from-slate-900 via-[#131b2e] to-indigo-950 p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.15)]">
              {/* Ánh sáng trang trí nền */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-6">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
                    <span>⚡ Onboarding 30 Giây</span>
                    <span>•</span>
                    <span>Cá nhân hóa mục tiêu ĐH</span>
                  </div>
                  <h2 className="mt-2 text-xl sm:text-2xl font-black text-white">
                    🎯 Thiết Lập Mục Tiêu Đại Học & Kỳ Thi SAT 2026
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">
                    Chọn trường mơ ước để AI tự động căn chỉnh mức độ câu hỏi và bẫy đề thi theo đúng ngưỡng điểm an toàn.
                  </p>
                </div>
                {collegeGoal && (
                  <button
                    onClick={() => setShowWizard(false)}
                    className="self-start sm:self-auto rounded-lg border border-white/10 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition"
                  >
                    ✕ Đóng
                  </button>
                )}
              </div>

              {/* Step Bar */}
              <div className="mb-6 grid grid-cols-3 gap-2">
                <button
                  onClick={() => setWizardStep(1)}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    wizardStep === 1
                      ? 'border-amber-400 bg-amber-500/15 text-white'
                      : 'border-white/10 bg-slate-800/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider">Bước 1</div>
                  <div className="text-xs sm:text-sm font-bold truncate">🏛️ Trường Mơ Ước</div>
                </button>
                <button
                  onClick={() => setWizardStep(2)}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    wizardStep === 2
                      ? 'border-amber-400 bg-amber-500/15 text-white'
                      : 'border-white/10 bg-slate-800/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider">Bước 2</div>
                  <div className="text-xs sm:text-sm font-bold truncate">🎯 Target Score</div>
                </button>
                <button
                  onClick={() => setWizardStep(3)}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    wizardStep === 3
                      ? 'border-amber-400 bg-amber-500/15 text-white'
                      : 'border-white/10 bg-slate-800/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider">Bước 3</div>
                  <div className="text-xs sm:text-sm font-bold truncate">📅 Kỳ Thi 2026</div>
                </button>
              </div>

              {/* BƯỚC 1: CHỌN TRƯỜNG */}
              {wizardStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="text-sm font-semibold text-slate-300">
                    Chọn trường Đại học mục tiêu của bạn:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(Object.keys(SCHOOL_DATA) as TargetSchoolKey[]).map((key) => {
                      const item = SCHOOL_DATA[key];
                      const isSelected = draftSchool === key;
                      return (
                        <div
                          key={key}
                          onClick={() => {
                            setDraftSchool(key);
                            setDraftScore(item.defaultScore);
                          }}
                          className={`cursor-pointer rounded-xl border p-4 transition-all ${
                            isSelected
                              ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                              : 'border-white/10 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-2xl">{item.icon}</span>
                            <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              An toàn: {item.safeScore}
                            </span>
                          </div>
                          <div className="mt-2 text-sm font-black text-white">{item.name}</div>
                          <div className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {item.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md hover:from-amber-300 hover:to-yellow-400 transition"
                    >
                      Tiếp tục: Chọn Target Score ➜
                    </button>
                  </div>
                </div>
              )}

              {/* BƯỚC 2: CHỌN TARGET SCORE */}
              {wizardStep === 2 && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="text-sm font-semibold text-slate-300">
                    Chọn mức điểm SAT mục tiêu cho trường <strong className="text-amber-300">{SCHOOL_DATA[draftSchool].name}</strong>:
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {SCORE_PRESETS.map((sc) => {
                      const isSelected = draftScore === sc;
                      return (
                        <button
                          key={sc}
                          type="button"
                          onClick={() => setDraftScore(sc)}
                          className={`rounded-xl border p-4 text-center transition ${
                            isSelected
                              ? 'border-amber-400 bg-amber-500/20 text-white shadow-lg shadow-amber-500/10'
                              : 'border-white/10 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="text-xl sm:text-2xl font-black text-amber-300">{sc}+</div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {sc >= 1550 ? 'Top 1% Thế Giới' : sc >= 1500 ? 'Ivy League / VinUni' : sc >= 1400 ? 'FTU / NEU / HUST' : 'Nền tảng vững chắc'}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Thanh kéo tùy chỉnh điểm */}
                  <div className="rounded-xl border border-white/10 bg-slate-800/40 p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-400">Tùy chỉnh điểm chi tiết:</span>
                      <span className="text-lg font-black text-amber-400">{draftScore} / 1600</span>
                    </div>
                    <input
                      type="range"
                      min={1200}
                      max={1600}
                      step={10}
                      value={draftScore}
                      onChange={(e) => setDraftScore(Number(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>1200</span>
                      <span>1350</span>
                      <span>1450</span>
                      <span>1550</span>
                      <span>1600</span>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setWizardStep(1)}
                      className="rounded-xl border border-white/15 bg-slate-800 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-700 transition"
                    >
                      ⬅ Quay lại
                    </button>
                    <button
                      onClick={() => setWizardStep(3)}
                      className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md hover:from-amber-300 hover:to-yellow-400 transition"
                    >
                      Tiếp tục: Chọn Kỳ Thi ➜
                    </button>
                  </div>
                </div>
              )}

              {/* BƯỚC 3: CHỌN KỲ THI */}
              {wizardStep === 3 && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="text-sm font-semibold text-slate-300">
                    Kỳ thi Digital SAT mục tiêu trong năm 2026:
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {EXAM_MONTH_OPTIONS.map((opt) => {
                      const isSelected = draftMonth === opt.value;
                      const daysLeft = getDaysUntilMonth(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDraftMonth(opt.value)}
                          className={`rounded-xl border p-3 text-center transition ${
                            isSelected
                              ? 'border-amber-400 bg-amber-500/20 text-white shadow-lg shadow-amber-500/10'
                              : 'border-white/10 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="text-xs sm:text-sm font-bold">{opt.label}</div>
                          <div className="text-[10px] text-amber-300 mt-1 font-semibold">
                            Còn ~{daysLeft} ngày
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Summary Box */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-slate-200">
                    <div className="font-bold text-amber-300 mb-1">📋 Tóm tắt lộ trình được thiết lập:</div>
                    <div>• Mục tiêu trường: <strong className="text-white">{SCHOOL_DATA[draftSchool].name}</strong></div>
                    <div>• Ngưỡng điểm SAT cam kết: <strong className="text-amber-300">{draftScore}+</strong> (Khuyến nghị an toàn: {SCHOOL_DATA[draftSchool].safeScore})</div>
                    <div>• Kỳ thi: <strong className="text-white">{EXAM_MONTH_OPTIONS.find((o) => o.value === draftMonth)?.label}</strong> (còn khoảng {getDaysUntilMonth(draftMonth)} ngày luyện tập)</div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="rounded-xl border border-white/15 bg-slate-800 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-700 transition"
                    >
                      ⬅ Quay lại
                    </button>
                    <button
                      onClick={handleSaveCollegeGoal}
                      className="rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 px-6 py-2.5 text-sm font-black text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-[1.02] transition"
                    >
                      🚀 Khóa Mục Tiêu & Kích Hoạt Lộ Trình
                    </button>
                  </div>
                </div>
              )}
            </section>
          ) : collegeGoal ? (
            /* HERO GOAL BANNER KHI ĐÃ CÓ MỤC TIÊU */
            <section className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 p-5 shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-3xl shadow-inner">
                    {SCHOOL_DATA[collegeGoal.targetSchool]?.icon || '🎯'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Mục Tiêu Tuyển Sinh 2026</span>
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Đang theo sát</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-white">
                      {SCHOOL_DATA[collegeGoal.targetSchool]?.name || collegeGoal.targetSchool}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-0.5">
                      <span>🎯 Target: <strong className="text-amber-300 font-black">{collegeGoal.targetScore}+</strong></span>
                      <span>📅 Kỳ thi: <strong className="text-white">{EXAM_MONTH_OPTIONS.find((m) => m.value === collegeGoal.examMonth)?.label || collegeGoal.examMonth}</strong></span>
                      <span>⏳ Còn <strong className="text-emerald-400">{getDaysUntilMonth(collegeGoal.examMonth)}</strong> ngày ôn luyện</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setDraftSchool(collegeGoal.targetSchool);
                      setDraftScore(collegeGoal.targetScore);
                      setDraftMonth(collegeGoal.examMonth);
                      setWizardStep(1);
                      setShowWizard(true);
                    }}
                    className="rounded-xl border border-amber-400/30 bg-slate-800/80 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-amber-300 transition"
                  >
                    🎯 Thiết lập lại Mục tiêu ĐH
                  </button>
                  <Link
                    href="/diagnostic"
                    className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 px-4 py-2 text-xs font-black text-slate-950 shadow transition"
                  >
                    Đo điểm chuẩn ➜
                  </Link>
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* ======================================================== */}
      {/* ⚡ WIDGET MINI-DIAGNOSTIC 60 GIÂY (3 CÂU SAT THỰC CHIẾN)  */}
      {/* ======================================================== */}
      {!focusMode && (
        <section className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-[#0c1322] via-[#101b30] to-[#0e1628] p-5 sm:p-7 shadow-[0_0_35px_rgba(245,158,11,0.08)]">
          {/* Header Widget */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4 mb-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-amber-300">
                <span>⚡ Thử Sức Nhanh (Mini-Diagnostic 60 Giây)</span>
                <span>•</span>
                <span>Không cần đăng nhập</span>
              </div>
              <h2 className="mt-1.5 text-lg sm:text-xl font-black text-white">
                Thử Sức 3 Câu Điểm Nóng Digital SAT — Nhận Phản Hồi Bẫy Tức Thì
              </h2>
              <p className="text-xs text-slate-400">
                1 câu Toán Desmos • 1 câu Từ nối Transitions • 1 câu Reading Central Idea
              </p>
            </div>
            {!miniCompleted && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {MINI_QUESTIONS.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      setMiniQIndex(idx);
                      setMiniShowResult(Boolean(miniAnswers[idx]));
                    }}
                    className={`h-7 w-7 rounded-lg text-xs font-bold transition ${
                      idx === miniQIndex
                        ? 'border border-amber-400 bg-amber-500 text-slate-950 shadow'
                        : miniAnswers[idx]
                        ? miniAnswers[idx] === q.correct
                          ? 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                          : 'border border-red-500/40 bg-red-500/20 text-red-300'
                        : 'border border-white/10 bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!miniCompleted ? (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Question metadata badge */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {currentQ.title}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold bg-gradient-to-r ${currentQ.badgeColor}`}
                >
                  {currentQ.badge}
                </span>
              </div>

              {/* Passage (if any) */}
              {currentQ.passage && (
                <div className="rounded-xl border border-white/10 bg-slate-900/90 p-4 text-xs sm:text-sm text-slate-200 leading-relaxed font-serif">
                  {currentQ.passage}
                </div>
              )}

              {/* Question Prompt */}
              <div className="rounded-xl border border-white/10 bg-slate-800/40 p-4 text-xs sm:text-sm font-semibold text-white whitespace-pre-line leading-relaxed">
                {currentQ.prompt}
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQ.options.map((opt) => {
                  const isSelected = selectedAnswer === opt.id;
                  const isCorrect = opt.id === currentQ.correct;

                  let cardStyle =
                    'border-white/10 bg-slate-800/50 hover:border-slate-500 text-slate-200';
                  if (miniShowResult) {
                    if (isCorrect) {
                      cardStyle =
                        'border-emerald-500/80 bg-emerald-500/20 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)] font-bold';
                    } else if (isSelected) {
                      cardStyle =
                        'border-red-500/80 bg-red-500/20 text-red-200 font-bold';
                    } else {
                      cardStyle = 'border-white/5 bg-slate-900/40 text-slate-500 opacity-60';
                    }
                  } else if (isSelected) {
                    cardStyle =
                      'border-amber-400 bg-amber-500/20 text-white font-bold';
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={miniShowResult}
                      onClick={() => handlePickOption(opt.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${cardStyle}`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                          miniShowResult && isCorrect
                            ? 'bg-emerald-500 text-slate-950'
                            : miniShowResult && isSelected
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {opt.id}
                      </span>
                      <span className="text-xs sm:text-sm pt-0.5 leading-snug">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Result & Trap Explanation Box */}
              {miniShowResult && (
                <div className="space-y-3 rounded-xl border border-amber-500/30 bg-slate-900/90 p-4 sm:p-5 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2">
                    {isAnswerCorrect ? (
                      <span className="flex items-center gap-1.5 text-sm font-black text-emerald-400">
                        <span>✅</span> CHÍNH XÁC! Bạn đã nắm chắc tư duy câu này.
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm font-black text-red-400">
                        <span>❌</span> CHƯA CHÍNH XÁC! Đáp án đúng là{' '}
                        <strong className="underline text-emerald-400 font-black">
                          {currentQ.correct}
                        </strong>.
                      </span>
                    )}
                  </div>

                  <div className="border-t border-white/10 pt-3 space-y-2 text-xs text-slate-300 leading-relaxed">
                    <div>
                      <strong className="text-amber-300">🔍 Phân tích cốt lõi: </strong>
                      {currentQ.explanation}
                    </div>

                    {currentQ.desmosTip && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-200">
                        <strong className="text-amber-300">{currentQ.desmosTip}</strong>
                      </div>
                    )}

                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 text-red-200/90">
                      <strong className="text-red-300">⚠️ Bẫy đề thi cần tránh: </strong>
                      {currentQ.trap}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleNextMiniQ}
                      className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-2.5 text-xs sm:text-sm font-black text-slate-950 shadow-md hover:from-amber-300 hover:to-yellow-400 transition"
                    >
                      {miniQIndex < MINI_QUESTIONS.length - 1
                        ? 'Câu tiếp theo ➜'
                        : 'Xem Tổng Kết & Nhận Đánh Giá 🏆'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* COMPLETION VIEW */
            <div className="space-y-6 text-center py-4 animate-in zoom-in-95 duration-400">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-3xl shadow-[0_0_30px_rgba(245,158,11,0.25)]">
                🏆
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Hoàn Thành Mini-Diagnostic 60 Giây!
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Kết quả sơ bộ: <strong className="text-amber-400 font-black text-base">{totalCorrectMini} / 3</strong> câu đúng
                </p>
              </div>

              {/* Assessment Band */}
              <div className="mx-auto max-w-lg rounded-xl border border-amber-500/30 bg-slate-900/80 p-4 text-xs text-slate-300 space-y-2">
                <div className="font-bold text-amber-300">
                  {totalCorrectMini === 3
                    ? '🌟 Xuất sắc! Nền tảng tư duy & phản xạ bẫy đề thi đạt mốc 1450–1550+'
                    : totalCorrectMini === 2
                    ? '⚡ Rất tốt! Bạn có phản xạ cơ bản tốt (ước tính 1350–1450+), cần mài giũa thêm bẫy đề'
                    : '🎯 Cần rèn luyện phản xạ bẫy đề thi và thành thạo Desmos để bứt phá lên 1350+'}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="rounded-lg bg-slate-800/80 p-2 border border-white/5">
                    <div className="text-slate-400">Toán Desmos</div>
                    <div className={`font-bold mt-0.5 ${miniAnswers[0] === 'B' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {miniAnswers[0] === 'B' ? '✓ Thành thạo' : '⚡ Cần mẹo 5s'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-800/80 p-2 border border-white/5">
                    <div className="text-slate-400">Transitions</div>
                    <div className={`font-bold mt-0.5 ${miniAnswers[1] === 'C' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {miniAnswers[1] === 'C' ? '✓ Chắc logic' : '⚡ Bẫy Although'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-800/80 p-2 border border-white/5">
                    <div className="text-slate-400">Reading Idea</div>
                    <div className={`font-bold mt-0.5 ${miniAnswers[2] === 'B' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {miniAnswers[2] === 'B' ? '✓ Tránh cực đoan' : '⚡ Bẫy Extreme'}
                    </div>
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link
                  href="/diagnostic"
                  className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-6 py-3 text-xs sm:text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition"
                >
                  🚀 Làm Diagnostic Toàn Diện 10 Phút
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto rounded-xl border border-emerald-400/40 bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow hover:from-emerald-500 hover:to-teal-500 transition"
                >
                  💾 Lưu Kết Quả & Kích Hoạt AI
                </Link>
                <button
                  type="button"
                  onClick={handleRestartMini}
                  className="w-full sm:w-auto rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                >
                  🔄 Thử Lại
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Dynamic Banner - Render Exactly like Streamlit math-academy-header */}
      {!hideBanner && !focusMode && (
        <div className="math-academy-header epic-shake-active">
          <div className="math-title-container">
            <div className="math-icon">🚀</div>
            <div>
              <h1 className="math-title">ÔN LUYỆN HẰNG NGÀY</h1>
              <p className="math-subtitle">Cày cuốc chăm chỉ, tương lai rộng mở!</p>
            </div>
          </div>

          <div className="rpg-hud-container">
            <div className="hud-row" style={{ marginBottom: "2px" }}>
              <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "#1e293b", border: "2px solid #64748b", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "24px" }}>
                👤
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                <div className="hud-row">
                  <div style={{ fontSize: "11px", color: "#e2e8f0", width: "50px" }}><b>Lv.{level}</b></div>
                  <div style={{ flex: 1, background: "#1e293b", height: "4px", borderRadius: "2px", overflow: "hidden", marginRight: "5px" }}>
                    <div style={{ background: "#ef4444", width: `${masteryPercent}%`, height: "100%", transition: "width 0.5s ease" }}></div>
                  </div>
                  <div style={{ fontSize: "9px", color: "#94a3b8", width: "45px", textAlign: "right" }}>{masteredCount}/{totalNodes}</div>
                </div>
                <div className="hud-row">
                  <div style={{ fontSize: "11px", color: "#a5b4fc", width: "50px" }}><b>MP</b></div>
                  <div style={{ flex: 1, background: "#1e293b", height: "4px", borderRadius: "2px", overflow: "hidden", marginRight: "5px" }}>
                    <div style={{ background: "linear-gradient(90deg, #6366f1, #a855f7)", width: "100%", height: "100%" }}></div>
                  </div>
                  <div style={{ fontSize: "9px", color: "#94a3b8", width: "45px", textAlign: "right" }}>100/100</div>
                </div>
              </div>
            </div>

            <div className="hud-row" style={{ background: "rgba(30,41,59,0.5)", borderRadius: "6px", padding: "4px 8px" }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#fbbf24" }}>
                💰 {coins} <span style={{ fontWeight: "normal", color: "#cbd5e1", fontSize: "10px" }}>Coins</span>
              </div>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#f87171" }}>
                🛡️ {shields} <span style={{ fontWeight: "normal", color: "#cbd5e1", fontSize: "10px" }}>Khiên</span>
              </div>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#fb923c" }} title="Chuỗi ngày học liên tiếp">
                🔥 {dayStreak} <span style={{ fontWeight: "normal", color: "#cbd5e1", fontSize: "10px" }}>ngày</span>
              </div>
            </div>

            <div className="hud-row" style={{ justifyContent: "flex-start", gap: "4px" }}>
              <span className="tag-pill" style={{ background: "rgba(59,130,246,0.2)", color: "#60a5fa", border: "1px solid #3b82f6" }}>
                {level >= 15 ? "Thần Thoại Học Thuật" : level >= 11 ? "Đỉnh Phong Thủ Khoa" : level >= 7 ? "Đại Pháp Sư SAT" : level >= 4 ? "Kiếm Khách SAT" : "Tân Sinh"}
              </span>
              <span className="tag-pill" style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc", border: "1px solid #a855f7" }}>🏆 Tân thủ học thuật</span>
              <span className="tag-pill" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid #ef4444" }}>⚔️ {maxPower >= 2000 ? "Chúa Tể Sức Mạnh" : maxPower >= 1000 ? "Chiến Thần Hủy Diệt" : maxPower >= 500 ? "Đòn Đánh Chí Mạng" : maxPower >= 300 ? "Kẻ Phá Vỡ Giới Hạn" : maxPower >= 100 ? "Sức Mạnh Đánh Thức" : "Sức Mạnh Cấp 1"}</span>
            </div>

            <div style={{ fontSize: "10px", color: "#94a3b8", textAlign: "center", marginTop: "2px" }}>
              🐾 Chưa đồng hành Linh Thú
            </div>
          </div>
        </div>
      )}
      
      {/* Streamlit Divider */}
      <hr className="border-[#262730] my-6" />

      {!focusMode && (
        <section className="bg-gradient-to-br from-[#10233a] to-[#111827] border border-blue-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(59,130,246,0.12)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Kế hoạch hôm nay</div>
              <h2 className="text-2xl font-black text-white">
                {planLoading ? 'Đang dựng lộ trình cá nhân...' : planFocusSkill ? 'Tập trung 1 kỹ năng yếu nhất' : onboardingCompleted ? 'Giữ nhịp luyện tập hôm nay' : 'Bắt đầu bằng diagnostic 5 phút'}
              </h2>
              <p className="text-sm text-[#cbd5e1] max-w-2xl">
                {planFocusSkill
                  ? `Ưu tiên ${planFocusSkill.label} (mastery ${planFocusSkill.score}/100). Làm một phiên ngắn rồi quay lại xem mastery delta.`
                  : onboardingCompleted
                    ? 'Bạn đã có nền tảng ban đầu. Làm 10 câu luyện tập để app cập nhật điểm dự đoán và gợi ý skill kế tiếp.'
                    : 'Hoàn thành bài xếp lớp để app biết điểm mạnh/yếu, dự đoán điểm SAT và tạo lộ trình luyện phù hợp.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 lg:items-center">
              <Link href={primaryPlanHref} className="text-center bg-gradient-to-r from-yellow-300 to-amber-500 hover:from-yellow-200 hover:to-amber-400 text-[#78350f] font-black px-6 py-3 rounded-xl shadow-lg">
                🎯 {primaryPlanLabel}
              </Link>
              <Link href="/dashboard" className="text-center bg-[#0f172a] hover:bg-[#1e293b] text-blue-200 border border-blue-500/30 font-bold px-5 py-3 rounded-xl">
                📊 Xem tiến bộ
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
            <div className="bg-[#0f172a]/80 border border-[#334155] rounded-xl p-4">
              <div className="text-xs text-gray-400">Bước 1</div>
              <div className="font-bold text-white">{onboardingCompleted ? 'Đã xếp lớp' : 'Diagnostic'}</div>
              <div className="text-xs text-gray-500 mt-1">{onboardingCompleted ? 'Dữ liệu đầu vào đã sẵn sàng.' : '5–10 phút để cá nhân hóa lộ trình.'}</div>
            </div>
            <div className="bg-[#0f172a]/80 border border-[#334155] rounded-xl p-4">
              <div className="text-xs text-gray-400">Bước 2</div>
              <div className="font-bold text-white">Practice đúng skill</div>
              <div className="text-xs text-gray-500 mt-1">{planFocusSkill ? planFocusSkill.label : 'Luyện Toán / Đọc-Viết để mở gợi ý.'}</div>
            </div>
            <div className="bg-[#0f172a]/80 border border-[#334155] rounded-xl p-4">
              <div className="text-xs text-gray-400">Bước 3</div>
              <div className="font-bold text-white">Mastery delta</div>
              <div className="text-xs text-gray-500 mt-1">
                {weeklyDelta !== null
                  ? `Tiến độ tuần: ${weeklyDelta >= 0 ? '+' : ''}${weeklyDelta} điểm SAT so với 7 ngày trước.`
                  : hasPracticeData
                    ? `Điểm dự đoán hiện tại: ${todayPlan?.total ?? '—'}`
                    : 'Dashboard sẽ hiện khi có câu trả lời đầu tiên.'}
              </div>
            </div>
          </div>

          {/* Kế hoạch hôm nay — 3 mục học (due SRS + skill yếu + stamina) từ /api/today */}
          {todayItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {todayItems.map((it, i) => (
                <Link
                  key={`${it.kind}-${i}`}
                  href={it.href}
                  className="block bg-[#0f172a]/80 hover:bg-[#111c30] border border-[#334155] hover:border-[#3b82f6]/60 rounded-xl p-4 transition-colors"
                >
                  <div className="text-xs text-blue-300 font-bold">
                    {it.kind === 'due' ? '🔁 Ôn đến hạn' : it.kind === 'weakness' ? '🎯 Luyện điểm yếu' : '⚡ Stamina'}
                  </div>
                  <div className="font-bold text-white mt-1">{it.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{it.rationale}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* COMPONENT 1: Hộp Quà Huy Hiệu (Badges) */}
      {!focusMode && <BadgeSystem />}

      {/* Streamlit Divider */}
      {!focusMode && <hr className="border-[#262730] my-6" />}

      {/* COMPONENT 2: AI Tutoring (Luyện Câu Hỏi Mới) / Sổ tay ôn câu sai */}
      {learningMode === 'ai' ? <AITutoring /> : <MistakeNotebook />}

    </div>
  );
}