'use client';
import Link from 'next/link';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { WeeklyTrendPanel, type WeeklyTrend } from '@/components/WeeklyTrendPanel';
import { EmptyState } from '@/components/EmptyState';

/** Shape trả về từ /api/mastery (getMasterySummary). */
interface MasterySkill {
  id: string;
  label: string;
  score: number;
  attempts: number;
  domainId: string;
  domainLabel: string;
  subject: string;
}
interface MasterySummary {
  skills: MasterySkill[];
  bySubject: { math: number; reading: number };
  overall: number;
}
/** Shape trả về từ /api/score (predictScore). Free → breakdown bị khóa (null). */
interface ScorePrediction {
  math: number | null;
  reading: number | null;
  total: number;
  confidence: 'low' | 'medium' | 'high';
  totalAttempts: number;
  targetScore: number | null;
  pointsToTarget: number | null;
  focusSkills: Array<{ id: string; label: string; score: number; subject: string }>;
  /** true khi gói free — breakdown môn + focus skills bị ẩn (nâng cấp để mở). */
  detailLocked?: boolean;
}

// 5 trục radar = 4 chương Toán + 1 cụm Đọc-Viết (neo vào domainId thật).
const RADAR_AXES: { domainId: string; label: string; color: string; angle: number }[] = [
  { domainId: 'algebra', label: 'Đại số', color: 'text-blue-400', angle: 90 },
  { domainId: 'advanced_math', label: 'Nâng cao', color: 'text-emerald-400', angle: 18 },
  { domainId: 'data_analysis', label: 'Số liệu', color: 'text-yellow-400', angle: 306 },
  { domainId: 'geometry', label: 'Hình học', color: 'text-purple-400', angle: 234 },
  { domainId: 'reading_writing', label: 'Đọc & Viết', color: 'text-red-400', angle: 162 },
];

const CONFIDENCE_LABEL: Record<ScorePrediction['confidence'], string> = {
  low: 'Tham khảo (làm thêm để chính xác hơn)',
  medium: 'Khá tin cậy',
  high: 'Tin cậy cao',
};

// Ngưỡng điểm SAT tham khảo xét tuyển thẳng / xét tuyển kết hợp các trường ĐH Top đầu Việt Nam (2025–2026).
const VN_UNI_BENCHMARKS: Array<{
  code: string;
  name: string;
  safeScore: number;
  minScore: number;
  majors: string;
}> = [
  {
    code: 'FTU',
    name: 'ĐH Ngoại Thương (FTU)',
    safeScore: 1450,
    minScore: 1380,
    majors: 'Kinh tế đối ngoại, Kinh doanh quốc tế, Logistics, Tài chính',
  },
  {
    code: 'HUST',
    name: 'ĐH Bách Khoa Hà Nội (HUST)',
    safeScore: 1420,
    minScore: 1300,
    majors: 'Khoa học Máy tính (IT1), Kỹ thuật Máy tính (IT2), Tự động hóa, Vi mạch',
  },
  {
    code: 'NEU',
    name: 'ĐH Kinh Tế Quốc Dân (NEU)',
    safeScore: 1400,
    minScore: 1300,
    majors: 'Kiểm toán, Marketing, Phân tích kinh doanh, Tài chính doanh nghiệp',
  },
  {
    code: 'DAV',
    name: 'Học viện Ngoại Giao (DAV)',
    safeScore: 1380,
    minScore: 1280,
    majors: 'Quan hệ quốc tế, Truyền thông quốc tế, Luật quốc tế',
  },
  {
    code: 'VNU',
    name: 'ĐHQG Hà Nội & TP.HCM (UET, UEB, HCMUT)',
    safeScore: 1350,
    minScore: 1250,
    majors: 'Công nghệ thông tin, Quản trị kinh doanh, Ngôn ngữ & Khoa học dữ liệu',
  },
  {
    code: 'BA/TMU',
    name: 'HV Ngân Hàng / ĐH Thương Mại / HV Tài Chính',
    safeScore: 1260,
    minScore: 1200,
    majors: 'Ngân hàng số, Kế toán, Thương mại điện tử, Quản trị',
  },
];

// Point 61: Danh sách các kỳ thi SAT Quốc tế College Board chính thức
interface OfficialExamDate {
  id: string;
  label: string;
  dateStr: string;
  regDeadline: string;
  note: string;
}

const OFFICIAL_SAT_DATES: OfficialExamDate[] = [
  {
    id: '2026-03-14',
    label: 'Kỳ thi Tháng 3 / 2026',
    dateStr: '2026-03-14',
    regDeadline: '27/02/2026',
    note: 'Đợt thi đầu tiên trong năm, rất thích hợp chốt điểm đợt 1',
  },
  {
    id: '2026-05-02',
    label: 'Kỳ thi Tháng 5 / 2026',
    dateStr: '2026-05-02',
    regDeadline: '17/04/2026',
    note: 'Thời điểm vàng của học sinh lớp 11 trước khi thi học kỳ',
  },
  {
    id: '2026-06-06',
    label: 'Kỳ thi Tháng 6 / 2026',
    dateStr: '2026-06-06',
    regDeadline: '22/05/2026',
    note: 'Kỳ thi chốt điểm hè trước khi bước vào năm học lớp 12',
  },
  {
    id: '2026-08-29',
    label: 'Kỳ thi Tháng 8 / 2026',
    dateStr: '2026-08-29',
    regDeadline: '14/08/2026',
    note: 'Mở màn đợt nộp hồ sơ Early Action (EA) & Early Decision (ED)',
  },
  {
    id: '2026-10-03',
    label: 'Kỳ thi Tháng 10 / 2026',
    dateStr: '2026-10-03',
    regDeadline: '18/09/2026',
    note: 'Cơ hội cuối cùng kịp nộp hồ sơ sớm đợt 1 tháng 11',
  },
  {
    id: '2026-11-07',
    label: 'Kỳ thi Tháng 11 / 2026',
    dateStr: '2026-11-07',
    regDeadline: '23/10/2026',
    note: 'Đợt thi phục thù dành cho các thí sinh muốn nâng điểm',
  },
  {
    id: '2026-12-05',
    label: 'Kỳ thi Tháng 12 / 2026',
    dateStr: '2026-12-05',
    regDeadline: '20/11/2026',
    note: 'Hạn chót kịp nộp Regular Decision (RD) vào tháng 1',
  },
];

// Point 66: Danh sách kỹ năng có ROI tăng điểm nhanh nhất
const HIGH_ROI_SKILLS = [
  {
    id: 'linear_equations',
    label: 'Linear Equations & Systems (Toán đại số cơ bản)',
    subject: 'math',
    route: '/math',
    roi: '+20~30 điểm',
    reason: 'Chiếm 35% đề Toán. Dễ áp dụng mẹo bấm máy Desmos ăn trọn 100% điểm mà không sợ bẫy.',
  },
  {
    id: 'punctuation_boundaries',
    label: 'Boundaries & Dấu câu (Ngữ pháp Đọc-Viết)',
    subject: 'reading',
    route: '/literature',
    roi: '+25~35 điểm',
    reason: 'Quy tắc dấu chấm phẩy, dấu hai chấm, gạch ngang cố định tuyệt đối, học 1 tiếng nhớ trọn đời.',
  },
  {
    id: 'rhetorical_synthesis',
    label: 'Rhetorical Synthesis (Tổng hợp nghiên cứu)',
    subject: 'reading',
    route: '/literature',
    roi: '+20~25 điểm',
    reason: 'Chỉ cần đọc kỹ câu hỏi cuối cùng để xác định đúng mục tiêu, không cần đọc hết cả đoạn ghi chú.',
  },
  {
    id: 'words_in_context',
    label: 'Words in Context (Từ vựng ngữ cảnh)',
    subject: 'reading',
    route: '/vocabulary',
    roi: '+20~30 điểm',
    reason: 'Áp dụng kỹ thuật đoán nghĩa từ ngữ cảnh tích cực/tiêu cực, loại trừ 3 đáp án sai cực nhanh.',
  },
];

// Point 82: Bảng Bách phân vị & Nhóm trường Mỹ
const PERCENTILE_TIERS = [
  {
    minScore: 1500,
    maxScore: 1600,
    percentile: 'Top 1% - 2% (98th - 99th Percentile)',
    tier: 'Nhóm Tinh Hoa Toàn Cầu (Ivy League & Top 20 US Universities)',
    examples: 'Harvard, Stanford, MIT, Yale, Columbia, UPenn, Duke',
    scholarship: 'Học bổng / Financial Aid: $50,000 – $85,000 / năm (Lên tới 100% chi phí)',
  },
  {
    minScore: 1400,
    maxScore: 1490,
    percentile: 'Top 5% - 7% (93rd - 95th Percentile)',
    tier: 'Nhóm Trường Danh Giá Hàng Đầu (Top 25 - 50 US News)',
    examples: 'NYU, Boston College, UNC Chapel Hill, Georgia Tech, Rochester',
    scholarship: 'Học bổng Merit-based: $25,000 – $55,000 / năm',
  },
  {
    minScore: 1300,
    maxScore: 1390,
    percentile: 'Top 12% - 15% (86th - 88th Percentile)',
    tier: 'Nhóm Đại Học Uy Tín & Bang Trọng Điểm (Top 50 - 100 US News)',
    examples: 'Purdue, Penn State, Ohio State, Fordham, Drexel',
    scholarship: 'Học bổng Khuyến học: $15,000 – $35,000 / năm',
  },
  {
    minScore: 1200,
    maxScore: 1290,
    percentile: 'Top 25% (75th Percentile)',
    tier: 'Nhóm Đại Học Tiêu Chuẩn & Liberal Arts Khai Phóng',
    examples: 'Michigan State, Arizona State, Iowa State, UT Dallas',
    scholarship: 'Học bổng Nhập học: $10,000 – $20,000 / năm',
  },
  {
    minScore: 400,
    maxScore: 1190,
    percentile: 'Dưới Top 30% (Foundation Level)',
    tier: 'Giai Đoạn Xây Dựng Nền Tảng SAT',
    examples: 'Tập trung củng cố kiến thức trọng tâm để bứt phá lên 1300+',
    scholarship: 'Nên cày thêm các chuyên đề High ROI để mở rộng cơ hội học bổng',
  },
];

function practiceRouteForSkill(skillId: string, subject: string): string {
  if (skillId.startsWith('vocab')) return '/vocabulary';
  if (skillId.startsWith('rw_') || subject === 'reading') return '/literature';
  return '/math';
}

export default function DashboardPage() {
  const { userStats } = useGamification();
  const [mastery, setMastery] = useState<MasterySummary | null>(null);
  const [score, setScore] = useState<ScorePrediction | null>(null);
  const [trend, setTrend] = useState<WeeklyTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Nhập điểm mục tiêu ngay tại Dashboard
  const [targetInput, setTargetInput] = useState('');
  const [targetSaving, setTargetSaving] = useState(false);
  const [targetMsg, setTargetMsg] = useState('');
  const [copiedParentReport, setCopiedParentReport] = useState(false);
  const [copiedTutorReport, setCopiedTutorReport] = useState(false);
  const tutorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const parentTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (tutorTimerRef.current) clearTimeout(tutorTimerRef.current);
      if (parentTimerRef.current) clearTimeout(parentTimerRef.current);
    };
  }, []);

  // Point 61: Kỳ thi mục tiêu College Board
  const [targetExamDateId, setTargetExamDateId] = useState<string>('2026-05-02');

  // Point 62: Mục tiêu điểm tách biệt Toán & Đọc-Viết
  const [splitTarget, setSplitTarget] = useState<{ math: number; reading: number }>({ math: 780, reading: 670 });
  const [splitEditing, setSplitEditing] = useState(false);
  const [splitMathInput, setSplitMathInput] = useState('780');
  const [splitReadingInput, setSplitReadingInput] = useState('670');

  // Point 63: Modal Micro-Session 10 Phút
  const [showMicroModal, setShowMicroModal] = useState(false);

  // Point 64: Quỹ thời gian học mỗi ngày (15 / 30 / 60 phút)
  const [dailyBudget, setDailyBudget] = useState<number>(30);

  // Point 69: Chế độ Nước Rút 7 Ngày Cuối (Cram Mode)
  const [cramMode, setCramMode] = useState<boolean>(false);

  // Point 72: Khiên bảo vệ Streak Freeze Shield
  const [streakFreezeCount, setStreakFreezeCount] = useState<number>(1);

  // Point 76: Công cụ tính điểm xét tuyển ĐH Việt Nam (SAT + IELTS + GPA)
  const [calcSat, setCalcSat] = useState<number>(1400);
  const [calcIelts, setCalcIelts] = useState<number>(7.5);
  const [calcGpa, setCalcGpa] = useState<number>(8.8);

  // Lịch sử học tập thực tế cho Heatmap 30 ngày (Point 75)
  const [actualStudyHistory, setActualStudyHistory] = useState<Record<string, number>>({});

  // Nút "Thử lại"
  const retry = () => {
    setLoading(true);
    setError(false);
    setReloadKey((k) => k + 1);
  };

  // Khởi tạo các state lưu trữ trong localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Point 61: Kỳ thi mục tiêu
      const savedExam = localStorage.getItem('sat_target_exam_date_v1');
      if (savedExam) setTargetExamDateId(savedExam);

      // Point 62: Split target
      const savedSplit = localStorage.getItem('sat_split_target_v1');
      if (savedSplit) {
        const parsed = JSON.parse(savedSplit);
        if (parsed.math && parsed.reading) {
          setSplitTarget(parsed);
          setSplitMathInput(String(parsed.math));
          setSplitReadingInput(String(parsed.reading));
        }
      }

      // Point 64: Daily Budget
      const savedBudget = localStorage.getItem('sat_daily_budget_min_v1');
      if (savedBudget) {
        const b = parseInt(savedBudget, 10);
        if ([15, 30, 60].includes(b)) setDailyBudget(b);
      }

      // Point 69: Cram Mode
      const savedCram = localStorage.getItem('sat_cram_mode_v1');
      if (savedCram !== null) {
        setCramMode(savedCram === 'true');
      }

      // Point 72: Streak freeze count
      const savedFreeze = localStorage.getItem('sat_streak_freeze_count');
      if (savedFreeze !== null) {
        setStreakFreezeCount(parseInt(savedFreeze, 10) || 0);
      }

      // Point 75: Đọc lịch sử ngày học thực tế từ localStorage & streak
      const dayMap: Record<string, number> = {};
      const savedDays = localStorage.getItem('sat_study_days_history_v1');
      if (savedDays) {
        try {
          const parsed = JSON.parse(savedDays);
          if (Array.isArray(parsed)) {
            parsed.forEach((d: string) => {
              if (typeof d === 'string') dayMap[d] = (dayMap[d] || 0) + 5;
            });
          } else if (typeof parsed === 'object' && parsed !== null) {
            Object.entries(parsed).forEach(([k, v]) => {
              dayMap[k] = typeof v === 'number' ? v : 5;
            });
          }
        } catch {
          // ignore
        }
      }

      const savedExams = localStorage.getItem('sat_exam_history_v1');
      if (savedExams) {
        try {
          const parsedExams = JSON.parse(savedExams);
          if (Array.isArray(parsedExams)) {
            parsedExams.forEach((ex: any) => {
              const rawDate = ex?.completedAt || ex?.date || ex?.timestamp || ex?.createdAt;
              if (rawDate) {
                const dStr = new Date(rawDate).toISOString().split('T')[0];
                dayMap[dStr] = (dayMap[dStr] || 0) + 15;
              }
            });
          }
        } catch {
          // ignore
        }
      }

      const streak = userStats?.streak || 0;
      if (streak > 0) {
        const today = new Date();
        for (let i = 0; i < Math.min(streak, 30); i++) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          const dStr = d.toISOString().split('T')[0];
          if (!dayMap[dStr]) {
            dayMap[dStr] = 8 + (i % 5);
          }
        }
      }
      setActualStudyHistory(dayMap);
    } catch (e) {
      console.warn('Lỗi đọc localStorage:', e);
    }
  }, [userStats?.streak]);

  // Tính số ngày đếm ngược đến kỳ thi mục tiêu (Point 61)
  const currentExam = useMemo(() => {
    return OFFICIAL_SAT_DATES.find((d) => d.id === targetExamDateId) || OFFICIAL_SAT_DATES[0];
  }, [targetExamDateId]);

  const daysUntilExam = useMemo(() => {
    if (!currentExam?.dateStr) return 0;
    const examTime = new Date(currentExam.dateStr).getTime();
    if (!Number.isFinite(examTime)) return 0;
    const now = new Date().getTime();
    const diff = Math.ceil((examTime - now) / (1000 * 60 * 60 * 24));
    return Number.isFinite(diff) ? Math.max(0, diff) : 0;
  }, [currentExam]);

  // Tự động gợi ý kích hoạt Nước Rút nếu còn <= 7 ngày
  useEffect(() => {
    if (daysUntilExam > 0 && daysUntilExam <= 7 && !cramMode) {
      setCramMode(true);
    }
  }, [daysUntilExam, cramMode]);

  useEffect(() => {
    async function loadData() {
      try {
        const [mRes, sRes, tRes] = await Promise.all([
          fetch('/api/mastery'),
          fetch('/api/score'),
          fetch('/api/progress/weekly'),
        ]);
        if (!mRes.ok || !sRes.ok) {
          setError(true);
          return;
        }
        const mData = await mRes.json();
        const sData = await sRes.json();
        setMastery(mData);
        setScore(sData);
        if (sData?.total) {
          setCalcSat(sData.total);
        }
        if (tRes.ok) setTrend(await tRes.json());
      } catch (e) {
        console.error('Lỗi tải dữ liệu dashboard', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [reloadKey]);

  // Mastery trung bình theo từng domain (0..100)
  const domainScore = (domainId: string): number => {
    if (!mastery || !Array.isArray(mastery.skills)) return 0;
    const skills = mastery.skills.filter((s) => s && s.domainId === domainId);
    if (!skills || skills.length === 0) return 0;
    const totalScore = skills.reduce(
      (a, s) => a + (typeof s.score === 'number' && Number.isFinite(s.score) ? s.score : 0),
      0
    );
    const avg = totalScore / skills.length;
    return Number.isFinite(avg) ? Math.round(avg) : 0;
  };

  // Radar geometry
  const size = 200;
  const center = size / 2;
  const radius = size / 2 - 20;
  const getPoint = (value: number, angle: number) => {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    const rad = (Math.PI / 180) * angle;
    const x = center + ((radius * safeValue) / 100) * Math.cos(rad);
    const y = center - ((radius * safeValue) / 100) * Math.sin(rad);
    return `${Number.isFinite(x) ? x : center},${Number.isFinite(y) ? y : center}`;
  };

  const axisValues = RADAR_AXES.map((ax) => ({ ...ax, value: domainScore(ax.domainId) }));
  const points = axisValues.map((a) => getPoint(a.value, a.angle)).join(' ');
  const gridPolygons = [20, 40, 60, 80, 100].map((val) =>
    RADAR_AXES.map((ax) => getPoint(val, ax.angle)).join(' ')
  );

  const totalAttempts = score?.totalAttempts ?? 0;
  const hasData = totalAttempts > 0;

  // Lưu điểm mục tiêu tổng
  const saveTarget = async () => {
    const val = parseInt(targetInput, 10);
    if (!Number.isFinite(val)) {
      setTargetMsg('Nhập số điểm mục tiêu (400–1600).');
      return;
    }
    setTargetSaving(true);
    setTargetMsg('');
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetScore: val }),
      });
      if (res.ok) {
        setTargetMsg('✅ Đã lưu mục tiêu!');
        setTargetInput('');
        setReloadKey((k) => k + 1);
      } else {
        setTargetMsg('Không lưu được mục tiêu. Thử lại sau.');
      }
    } catch {
      setTargetMsg('Lỗi kết nối, thử lại sau.');
    } finally {
      setTargetSaving(false);
    }
  };

  // Point 61: Xử lý chọn kỳ thi
  const handleSelectExamDate = (examId: string) => {
    setTargetExamDateId(examId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sat_target_exam_date_v1', examId);
    }
  };

  // Point 62: Xử lý lưu mục tiêu tách biệt Math & R&W
  const handleSaveSplitTarget = () => {
    const m = Math.min(800, Math.max(200, parseInt(splitMathInput, 10) || 700));
    const r = Math.min(800, Math.max(200, parseInt(splitReadingInput, 10) || 650));
    const newSplit = { math: m, reading: r };
    setSplitTarget(newSplit);
    setSplitEditing(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sat_split_target_v1', JSON.stringify(newSplit));
    }
  };

  // Point 64: Xử lý chọn daily budget
  const handleSetDailyBudget = (mins: number) => {
    setDailyBudget(mins);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sat_daily_budget_min_v1', String(mins));
    }
  };

  // Point 69: Xử lý bật/tắt Cram Mode
  const handleToggleCramMode = () => {
    const nextVal = !cramMode;
    setCramMode(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sat_cram_mode_v1', String(nextVal));
    }
  };

  // Point 83: Huy hiệu cột mốc điểm số
  const currentTotalScore = score?.total ?? 400;
  const clubMilestone = useMemo(() => {
    if (currentTotalScore >= 1500) {
      return {
        name: 'Club 1500+ Diamond Elite',
        badge: '💎',
        color: 'from-amber-300 via-yellow-400 to-amber-500 text-amber-950',
        desc: 'Đẳng cấp SAT Master toàn cầu! Sẵn sàng cho Top 20 ĐH Mỹ & Tuyển thẳng FTU/HUST.',
      };
    }
    if (currentTotalScore >= 1400) {
      return {
        name: 'Club 1400+ Gold Master',
        badge: '🏆',
        color: 'from-yellow-400 to-amber-500 text-yellow-950',
        desc: 'Vượt trội! Đủ chuẩn an toàn tuyệt đối mọi ngành hot ĐH Ngoại Thương & NEU.',
      };
    }
    if (currentTotalScore >= 1300) {
      return {
        name: 'Club 1300+ Silver Striker',
        badge: '🥈',
        color: 'from-slate-200 to-slate-400 text-slate-900',
        desc: 'Vững vàng! Đủ điều kiện nộp hồ sơ xét tuyển kết hợp tất cả các trường top VN.',
      };
    }
    if (currentTotalScore >= 1200) {
      return {
        name: 'Club 1200+ Bronze Achiever',
        badge: '🥉',
        color: 'from-amber-600 to-yellow-700 text-amber-100',
        desc: 'Khởi đầu chắc chắn! Tiếp tục cày các kỹ năng High ROI để vượt mốc 1300+.',
      };
    }
    return {
      name: 'Rising Star 400 - 1190',
      badge: '🌱',
      color: 'from-emerald-700 to-teal-800 text-emerald-100',
      desc: 'Đang tăng tốc! Làm chủ các dạng câu hỏi cơ bản để thăng hạng câu lạc bộ.',
    };
  }, [currentTotalScore]);

  // Point 82: Bách phân vị hiện tại
  const currentPercentileTier = useMemo(() => {
    return (
      PERCENTILE_TIERS.find(
        (t) => currentTotalScore >= t.minScore && currentTotalScore <= t.maxScore
      ) || PERCENTILE_TIERS[PERCENTILE_TIERS.length - 1]
    );
  }, [currentTotalScore]);

  // Point 76: Tính điểm xét tuyển các trường ĐH Việt Nam
  const vnAdmissionEstimates = useMemo(() => {
    // 1. FTU: Quy đổi SAT thang 30 = (SAT/1600)*30. Điểm sàn xét tuyển >= 1300.
    const ftuConv = Number(((calcSat / 1600) * 30).toFixed(2));
    const ftuEligible = calcSat >= 1300 && calcGpa >= 8.5;
    const ftuSafe = calcSat >= 1420;

    // 2. NEU: Quy đổi điểm môn 1 (SAT) = (SAT/1600)*10. Điểm sàn >= 1200.
    const neuSatConv = Number(((calcSat / 1600) * 10).toFixed(2));
    const neuEligible = calcSat >= 1200;
    const neuSafe = calcSat >= 1380;

    // 3. HUST: Xét tuyển tài năng (SAT thang 100) = (SAT/1600)*100. IT1, IT2 sàn >= 1450.
    const hustConv = Number(((calcSat / 1600) * 100).toFixed(2));
    const hustEligible = calcSat >= 1300;
    const hustSafe = calcSat >= 1420;

    // 4. DAV: Xét tuyển kết hợp SAT (sàn >= 1250) + IELTS (sàn >= 6.5)
    const davEligible = calcSat >= 1250 && calcIelts >= 6.5;
    const davSafe = calcSat >= 1360 && calcIelts >= 7.0;

    // 5. VNU (ĐHQGHN): Nhận hồ sơ SAT >= 1100.
    const vnuEligible = calcSat >= 1100;
    const vnuSafe = calcSat >= 1330;

    return {
      ftu: { conv: ftuConv, eligible: ftuEligible, safe: ftuSafe },
      neu: { conv: neuSatConv, eligible: neuEligible, safe: neuSafe },
      hust: { conv: hustConv, eligible: hustEligible, safe: hustSafe },
      dav: { eligible: davEligible, safe: davSafe },
      vnu: { eligible: vnuEligible, safe: vnuSafe },
    };
  }, [calcSat, calcIelts, calcGpa]);

  // Point 64: Chỉ tiêu khuyến nghị theo budget
  const recommendedTargetQ = dailyBudget === 15 ? 10 : dailyBudget === 30 ? 20 : 40;

  // Kỹ năng yếu nhất cần đột phá cho ca học 15 phút hôm nay
  const weakestSkill = score?.focusSkills?.[0];

  // Danh sách 30 ngày liên tục cho Heatmap thực tế
  const heatmapDays = useMemo(() => {
    const list: Array<{
      dateStr: string;
      dayDisplay: string;
      count: number;
      intensityClass: string;
      isToday: boolean;
      statusLabel: string;
    }> = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayDisplay = `${day}/${month}`;
      const count = actualStudyHistory[dateStr] || 0;
      const isToday = dateStr === todayStr;

      let intensityClass = 'bg-slate-800/80 text-slate-400 border-[#334155]/60';
      let statusLabel = 'Nghỉ ngơi (chưa có hoạt động)';

      if (count >= 20) {
        intensityClass = 'bg-emerald-400 text-slate-950 font-bold border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.7)]';
        statusLabel = `Rất tích cực (~${count} câu/bài)`;
      } else if (count >= 12) {
        intensityClass = 'bg-emerald-500 text-white font-semibold border-emerald-400';
        statusLabel = `Chuyên cần cao (~${count} câu/bài)`;
      } else if (count >= 6) {
        intensityClass = 'bg-emerald-600 text-white border-emerald-500';
        statusLabel = `Đã hoàn thành ca học (~${count} câu/bài)`;
      } else if (count > 0) {
        intensityClass = 'bg-emerald-800 text-emerald-200 border-emerald-700';
        statusLabel = `Khởi động (~${count} câu/bài)`;
      }

      list.push({
        dateStr,
        dayDisplay,
        count,
        intensityClass,
        isToday,
        statusLabel,
      });
    }
    return list;
  }, [actualStudyHistory]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header chính */}
      <div
        className="math-academy-header epic-shake-active"
        style={{ background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)' }}
      >
        <div className="math-title-container">
          <div className="math-icon">📊</div>
          <div>
            <h1
              className="math-title"
              style={{
                background: 'linear-gradient(to right, #34d399, #10b981)',
                WebkitBackgroundClip: 'text',
              }}
            >
              NHẬT KÝ TRƯỞNG THÀNH SAT
            </h1>
            <p className="math-subtitle text-emerald-200">
              Chiến lược cá nhân hóa theo chuẩn quốc tế College Board & Xét tuyển ĐH Việt Nam!
            </p>
          </div>
        </div>
      </div>

      {/* 🚀 ZERO-DECISION ACTION HERO: 1-Click Vào Học Ngay */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/70 to-slate-900 border-2 border-indigo-500/50 shadow-[0_0_35px_rgba(99,102,241,0.25)] p-6 md:p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          {/* Header trạng thái */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                ⚡ ZERO-DECISION MODE • 15 PHÚT MỖI NGÀY
              </span>
              <span className="text-xs text-slate-400 font-medium">
                🔥 Chuỗi hiện tại: <strong className="text-amber-400 font-bold">{userStats?.streak || 0} ngày</strong>
              </span>
            </div>

            {/* Nút Liên kết sang Trung tâm Phân tích */}
            <Link
              href="/analytics"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/40 hover:bg-emerald-900/80 transition-all hover:scale-105 shadow-md group"
            >
              <span>📊 Xem Phân Tích Học Bổng &amp; Xét Tuyển ĐH Chi Tiết</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                <span>🚀</span> NHIỆM VỤ CHỦ LỰC HÔM NAY (1-CLICK VÀO HỌC NGAY)
              </h2>
              <p className="text-sm md:text-base text-slate-300 mt-2 max-w-2xl leading-relaxed">
                Không cần đắn đo hôm nay học gì! Hệ thống đã tối ưu sẵn <strong>ca học 15 phút</strong> gồm 2 chặng: diệt sạch câu sai quên lãng &amp; tăng ngay 20+ điểm từ điểm yếu chí mạng.
              </p>
            </div>

            {/* Nút 1-Click to bự phát động ngay ca học */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
              <Link
                href="/forge"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-black text-base text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 transition-all transform hover:scale-105 shadow-[0_0_25px_rgba(251,191,36,0.5)] active:scale-95 text-center"
              >
                <span>⚡ BẮT ĐẦU CA HỌC 15P NGAY</span>
                <span className="text-xl">➔</span>
              </Link>
              <p className="text-[11px] text-center text-slate-400 italic">
                Tự động bắt đầu từ Ôn Luyện Câu Sai sang Cày Kỹ Năng
              </p>
            </div>
          </div>

          {/* 2 Chặng nhiệm vụ cụ thể */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-indigo-500/20">
            {/* Chặng 1: Ôn câu sai đến hạn */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-amber-500/30 hover:border-amber-400/60 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl shrink-0">
                      🔥
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          CHẶNG 1 • 7 PHÚT
                        </span>
                        <span className="text-xs text-slate-400 font-mono">Spaced Repetition</span>
                      </div>
                      <h4 className="text-base font-bold text-white mt-1">Ôn Tập Câu Sai Đến Hạn (/forge)</h4>
                    </div>
                  </div>
                  <Link
                    href="/forge"
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 hover:bg-amber-900/60 transition-all shrink-0"
                  >
                    Vào Lò Luyện →
                  </Link>
                </div>
                <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                  Giải quyết dứt điểm các câu đã từng làm sai theo chu kỳ lặp lại ngắt quãng để triệt tiêu lỗi lặp lại trong ngày thi thật.
                </p>
              </div>
            </div>

            {/* Chặng 2: Đột phá kỹ năng yếu nhất */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-indigo-500/30 hover:border-indigo-400/60 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xl shrink-0">
                      🎯
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          CHẶNG 2 • 8 PHÚT
                        </span>
                        <span className="text-xs text-slate-400 font-mono">Tối Đa ROI Điểm</span>
                      </div>
                      <h4 className="text-base font-bold text-white mt-1">Đột Phá Kỹ Năng Yếu Nhất (/grind)</h4>
                    </div>
                  </div>
                  <Link
                    href={weakestSkill ? `/grind?skill=${weakestSkill.id}` : '/grind'}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-500/40 hover:bg-indigo-900/60 transition-all shrink-0"
                  >
                    Cày Kỹ Năng →
                  </Link>
                </div>
                <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                  Ưu tiên số 1: <strong className="text-indigo-300">{weakestSkill?.label || 'Algebra & Linear Equations'}</strong>{' '}
                  {weakestSkill ? `(Mastery hiện tại: ${weakestSkill.score}%)` : '(Chuyên đề trọng số lớn nhất giúp tăng điểm tức thì)'}.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Point 69: Banner Chế độ Nước Rút 7 Ngày Cuối (Cram Mode) */}
      {cramMode && (
        <div className="bg-gradient-to-r from-red-950 via-amber-950 to-slate-900 border-2 border-amber-500 rounded-2xl p-6 shadow-[0_0_25px_rgba(245,158,11,0.3)] animate-pulse-subtle">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-amber-500/30">
            <div className="flex items-center gap-3">
              <span className="text-3xl animate-bounce">🚨</span>
              <div>
                <h3 className="text-xl font-black text-amber-400 uppercase tracking-wide">
                  Chế Độ Nước Rút 7 Ngày Cuối (Final 7-Day Cram Mode)
                </h3>
                <p className="text-xs text-amber-200 mt-0.5">
                  Đang đếm ngược kỳ thi {currentExam.label} — Chỉ còn{' '}
                  <strong className="text-white text-sm">{daysUntilExam} Ngày</strong>!
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleCramMode}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition self-start md:self-auto"
            >
              Tắt chế độ nước rút ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-black/40 p-3.5 rounded-xl border border-amber-500/20">
              <div className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                <span>📕</span> 1. Ôn Sổ Tay Lỗi Sai
              </div>
              <p className="text-slate-300">
                Ưu tiên số 1: Xem lại toàn bộ câu hỏi đã làm sai trong tuần qua. Tuyệt đối không cày
                bộ đề lạ làm hoang mang tinh thần.
              </p>
              <Link
                href="/forge"
                className="inline-block mt-2 text-[11px] font-bold text-emerald-400 hover:underline"
              >
                Mở Sổ tay lỗi sai →
              </Link>
            </div>

            <div className="bg-black/40 p-3.5 rounded-xl border border-amber-500/20">
              <div className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                <span>📐</span> 2. Khắc Cốt Công Thức & Desmos
              </div>
              <p className="text-slate-300">
                Lướt lại 20 công thức Toán trọng tâm, mẹo bấm hồi quy `~`, giải hệ phương trình và
                tìm nghiệm đồ thị nhanh trên Desmos.
              </p>
              <Link
                href="/math"
                className="inline-block mt-2 text-[11px] font-bold text-emerald-400 hover:underline"
              >
                Ôn mẹo Desmos →
              </Link>
            </div>

            <div className="bg-black/40 p-3.5 rounded-xl border border-amber-500/20">
              <div className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                <span>⏰</span> 3. Chuẩn Hóa Nhịp Sinh Học
              </div>
              <p className="text-slate-300">
                Tập thức dậy lúc 6:30 sáng, ăn sáng nhẹ và luyện tập đúng khung giờ 8:00 - 11:15 để não
                bộ đạt đỉnh hưng phấn vào giờ thi thật.
              </p>
            </div>

            <div className="bg-black/40 p-3.5 rounded-xl border border-amber-500/20">
              <div className="font-bold text-red-300 mb-1 flex items-center gap-1.5">
                <span>⚠️</span> 4. Cảnh Báo Ngủ Đủ 8 Tiếng
              </div>
              <p className="text-slate-300">
                Đêm trước ngày thi: BẮT BUỘC đi ngủ trước 22:30. Bài thi SAT thích ứng kiểm tra sự
                nhanh nhạy, thức khuya sẽ giảm 40-70 điểm!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Point 61 & Point 64: Hàng Tiện ích Countdown Kỳ thi & Bộ chọn Quỹ thời gian học */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Point 61: Bộ đếm ngược Kỳ thi SAT Quốc tế */}
        <div className="lg:col-span-2 bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⏳</span>
                <h3 className="text-lg font-bold text-white">
                  Đếm Ngược Kỳ Thi SAT Quốc Tế Chính Thức
                </h3>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                College Board Official
              </span>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Lựa chọn kỳ thi mục tiêu của bạn để hệ thống tự động tối ưu tốc độ luyện tập và nhắc hạn
              đăng ký kịp thời.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Chọn đợt thi mục tiêu:
                </label>
                <select
                  value={targetExamDateId}
                  onChange={(e) => handleSelectExamDate(e.target.value)}
                  className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                >
                  {OFFICIAL_SAT_DATES.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.label} ({exam.dateStr})
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-[#0f172a] rounded-lg p-3 border border-[#334155] flex flex-col items-center justify-center">
                <span className="text-xs text-slate-400">Thời gian còn lại</span>
                <span className="text-2xl font-black text-emerald-400">{daysUntilExam} Ngày</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <strong>📅 Hạn đăng ký muộn nhất: {currentExam.regDeadline}</strong>
                <p className="text-[11px] text-emerald-400/80 mt-0.5">
                  Lưu ý: Các điểm thi tại Hà Nội, TP.HCM & Đà Nẵng thường hết chỗ trước 3-4 tuần!
                </p>
              </div>
              <button
                onClick={handleToggleCramMode}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  cramMode
                    ? 'bg-amber-500 text-amber-950 font-black'
                    : 'bg-[#1b2533] hover:bg-slate-700 text-amber-300 border border-amber-500/40'
                }`}
              >
                {cramMode ? '⚡ Chế độ Nước Rút (Đang bật)' : '⚡ Bật Nước Rút 7 Ngày'}
              </button>
            </div>
          </div>
        </div>

        {/* Point 64: Bộ chọn Quỹ Thời gian Học mỗi ngày (15p / 30p / 60p) & Point 63 Nút Micro */}
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>⏱️</span> Quỹ Thời Gian Học Mỗi Ngày
              </h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Tùy chỉnh lịch học phù hợp với lịch học văn hóa trên trường THPT:
            </p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { min: 15, label: '15 Phút', desc: 'Khởi động' },
                { min: 30, label: '30 Phút', desc: 'Tiêu chuẩn' },
                { min: 60, label: '60 Phút', desc: 'Tốc chiến' },
              ].map((btn) => (
                <button
                  key={btn.min}
                  type="button"
                  onClick={() => handleSetDailyBudget(btn.min)}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    dailyBudget === btn.min
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md'
                      : 'bg-[#0f172a] border-[#334155] text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs">{btn.label}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">{btn.desc}</div>
                </button>
              ))}
            </div>

            <div className="bg-[#0f172a] rounded-xl p-3 border border-[#334155] text-xs text-slate-300 mb-3">
              <div className="flex justify-between items-center mb-1">
                <span>Chỉ tiêu khuyến nghị hôm nay:</span>
                <span className="font-bold text-white text-sm">{recommendedTargetQ} câu hỏi</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {dailyBudget === 15
                  ? 'Tập trung: 3 câu lỗi sai + 5 từ vựng + 2 câu kỹ năng trọng điểm.'
                  : dailyBudget === 30
                  ? 'Tập trung: 1 bài đọc ngắn + 10 câu Toán đại số & hình học.'
                  : 'Tập trung: Mô phỏng 1 module trọn vẹn bấm giờ áp lực cao.'}
              </p>
            </div>
          </div>

          {/* Point 63: Nút Học Nhanh 10 Phút Micro-Session */}
          <button
            onClick={() => setShowMicroModal(true)}
            className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 hover:from-amber-300 hover:to-yellow-400 transition shadow-lg flex items-center justify-center gap-2"
          >
            <span>⚡</span> Học Nhanh 10 Phút (Micro-Session)
          </button>
        </div>
      </div>

      {error && !loading ? (
        <div className="bg-[#1b2533] p-8 rounded-xl border border-red-500/40 shadow-lg flex flex-col items-center text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h3 className="text-lg font-bold text-white mb-1">Không tải được dữ liệu</h3>
          <p className="text-gray-400 text-sm mb-4">
            Có lỗi khi lấy thống kê từ máy chủ. Kiểm tra kết nối rồi thử lại.
          </p>
          <button
            onClick={retry}
            className="text-sm font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-2 rounded-lg hover:opacity-90"
          >
            🔄 Thử lại
          </button>
        </div>
      ) : (
        <>
          {/* Hàng chỉ số: streak + khiên bảo vệ (Point 72) + câu đã làm + điểm dự đoán */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {/* Streak & Khiên bảo vệ Point 72 */}
            <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
              <div className="text-4xl mb-2">🔥</div>
              <div className="text-3xl font-bold text-white">{userStats.streak} Ngày</div>
              <div className="text-gray-400 text-xs mt-1">Chuỗi Streak Liên Tiếp</div>

              {/* Point 72: Trạng thái Khiên Bảo Vệ Streak */}
              <div className="mt-3 w-full pt-3 border-t border-[#334155] flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <span>🛡️</span> Khiên: <strong className="text-blue-300">{streakFreezeCount}</strong>
                </span>
                <Link
                  href="/shop"
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline"
                >
                  Nạp khiên / Shop
                </Link>
              </div>
            </div>

            {/* Tổng câu hỏi */}
            <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center justify-center shadow-lg">
              <div className="text-4xl mb-2">🎯</div>
              <div className="text-3xl font-bold text-white">{loading ? '...' : totalAttempts}</div>
              <div className="text-gray-400 text-xs mt-1">Tổng Câu Đã Luyện Tập</div>
              <div className="text-[11px] text-emerald-400 mt-3 pt-3 border-t border-[#334155] w-full text-center">
                Chỉ tiêu ngày: {recommendedTargetQ} câu
              </div>
            </div>

            {/* Điểm SAT dự đoán */}
            <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center justify-center shadow-lg">
              <div className="text-4xl mb-2">📈</div>
              <div className="text-3xl font-bold text-white">
                {loading ? '...' : hasData ? score!.total : '—'}
              </div>
              <div className="text-gray-400 text-xs mt-1">Điểm SAT Dự Đoán (400-1600)</div>
              <div className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-[#334155] w-full text-center truncate px-2">
                Độ tin cậy: {score ? CONFIDENCE_LABEL[score.confidence] : 'Đang đo'}
              </div>
            </div>

            {/* Point 83: Huy hiệu Câu lạc bộ Điểm số */}
            <div
              className={`p-6 rounded-xl border border-amber-500/30 flex flex-col items-center justify-center shadow-lg bg-gradient-to-b ${clubMilestone.color}`}
            >
              <div className="text-4xl mb-2">{clubMilestone.badge}</div>
              <div className="text-lg font-black text-center leading-tight">{clubMilestone.name}</div>
              <div className="text-[11px] text-center mt-2 opacity-90 leading-snug">
                {clubMilestone.desc}
              </div>
            </div>
          </div>

          {!loading && !hasData && (
            <EmptyState
              icon="🎯"
              title="Bắt đầu tạo Nhật ký SAT của bạn"
              message="Làm diagnostic 5 phút để app biết điểm mạnh/yếu, sau đó dashboard sẽ hiện điểm dự đoán, kỹ năng cần tập trung và kế hoạch luyện tiếp theo."
              actionHref="/diagnostic"
              actionLabel="Làm diagnostic ngay"
              secondaryHref="/math"
              secondaryLabel="Hoặc luyện Toán trước"
            />
          )}

          {/* Chi tiết điểm dự đoán & Point 62: Mục tiêu Tách biệt Toán vs Đọc-Viết */}
          <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>🎓</span> Dự Đoán Điểm SAT & Mục Tiêu Tách Môn (Math vs R&W)
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Đo lường năng lực độc lập từng môn theo chuẩn chấm điểm Computer Adaptive Testing
                  của Digital SAT.
                </p>
              </div>

              {/* Point 62: Nút điều chỉnh mục tiêu riêng */}
              <button
                type="button"
                onClick={() => setSplitEditing(!splitEditing)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition"
              >
                {splitEditing ? 'Đóng chỉnh sửa ✕' : '⚙️ Đặt mục tiêu Toán / R&W riêng'}
              </button>
            </div>

            {loading ? (
              <p className="text-gray-400 text-sm">Đang tính toán từ dữ liệu luyện tập...</p>
            ) : hasData ? (
              <div className="space-y-4">
                {score!.detailLocked ? (
                  <div className="flex gap-6 flex-wrap items-start">
                    <div>
                      <div className="text-2xl font-bold text-white">{score!.total}</div>
                      <div className="text-xs text-gray-400">Tổng dự đoán (400-1600)</div>
                    </div>
                    <div className="flex-1 min-w-[240px] bg-[#0f172a] border border-[#334155] rounded-lg p-3">
                      <p className="text-sm text-[#e2e8f0] font-medium">
                        🔒 Điểm chi tiết từng môn đang bị khóa
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Nâng cấp Premium để xem điểm Toán / Đọc-Viết riêng và biết chính xác cần cải
                        thiện phần nào.
                      </p>
                      <Link
                        href="/upgrade?from=dashboard&unlock=premium"
                        className="inline-block mt-2 text-xs font-bold bg-gradient-to-r from-yellow-300 to-amber-500 text-amber-950 px-3 py-1.5 rounded-lg hover:from-yellow-200 hover:to-amber-400"
                      >
                        💎 Mở khóa chi tiết
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#0f172a] border border-[#334155]">
                      {/* Toán */}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-blue-400">Toán (Math)</span>
                          <span className="text-[11px] text-slate-400">Mục tiêu: {splitTarget.math}</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-400 mt-1">
                          {score!.math ?? '—'}
                          <span className="text-xs font-normal text-slate-400"> / 800</span>
                        </div>
                        <div className="text-xs mt-1">
                          {score!.math !== null && (
                            <span
                              className={
                                score!.math >= splitTarget.math
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-amber-400'
                              }
                            >
                              {score!.math >= splitTarget.math
                                ? '✅ Đã chạm mục tiêu Toán!'
                                : `Còn cách ${splitTarget.math - score!.math} điểm`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Đọc - Viết */}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-emerald-400">
                            Đọc & Viết (R&W)
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Mục tiêu: {splitTarget.reading}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-400 mt-1">
                          {score!.reading ?? '—'}
                          <span className="text-xs font-normal text-slate-400"> / 800</span>
                        </div>
                        <div className="text-xs mt-1">
                          {score!.reading !== null && (
                            <span
                              className={
                                score!.reading >= splitTarget.reading
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-amber-400'
                              }
                            >
                              {score!.reading >= splitTarget.reading
                                ? '✅ Đã chạm mục tiêu R&W!'
                                : `Còn cách ${splitTarget.reading - score!.reading} điểm`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tổng hợp */}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-yellow-400">Tổng Điểm</span>
                          <span className="text-[11px] text-slate-400">
                            Mục tiêu: {splitTarget.math + splitTarget.reading}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-yellow-400 mt-1">
                          {score!.total}
                          <span className="text-xs font-normal text-slate-400"> / 1600</span>
                        </div>
                        <div className="text-xs mt-1 text-slate-300">
                          Khoảng cách: {Math.max(0, splitTarget.math + splitTarget.reading - score!.total)} điểm
                        </div>
                      </div>
                    </div>

                    {/* Form chỉnh sửa Point 62 */}
                    {splitEditing && (
                      <div className="mt-3 p-4 rounded-xl bg-slate-900 border border-emerald-500/40 animate-in fade-in">
                        <div className="font-bold text-xs text-white mb-2">
                          🎯 Thiết lập mục tiêu riêng biệt phù hợp thế mạnh học sinh Việt Nam:
                        </div>
                        <p className="text-[11px] text-slate-400 mb-3">
                          Thế mạnh phổ biến của thí sinh VN: Đẩy Toán lên mức gần tuyệt đối (760–800)
                          để bù cho phần Đọc-Viết (650–720).
                        </p>
                        <div className="flex flex-wrap items-center gap-4">
                          <div>
                            <label className="text-[11px] text-blue-400 block mb-1">Mục tiêu Toán:</label>
                            <input
                              type="number"
                              min={200}
                              max={800}
                              step={10}
                              value={splitMathInput}
                              onChange={(e) => setSplitMathInput(e.target.value)}
                              className="w-24 bg-[#0f172a] border border-[#334155] rounded-lg px-2.5 py-1 text-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-emerald-400 block mb-1">
                              Mục tiêu Đọc-Viết:
                            </label>
                            <input
                              type="number"
                              min={200}
                              max={800}
                              step={10}
                              value={splitReadingInput}
                              onChange={(e) => setSplitReadingInput(e.target.value)}
                              className="w-24 bg-[#0f172a] border border-[#334155] rounded-lg px-2.5 py-1 text-white text-xs"
                            />
                          </div>
                          <div className="pt-4">
                            <button
                              type="button"
                              onClick={handleSaveSplitTarget}
                              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs"
                            >
                              Lưu Mục Tiêu Riêng
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Đặt mục tiêu tổng */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#262730] pt-3">
                  <label htmlFor="targetScore" className="text-sm text-gray-300 font-medium">
                    🎯 Đặt lại tổng điểm mục tiêu:
                  </label>
                  <input
                    id="targetScore"
                    type="number"
                    min={400}
                    max={1600}
                    step={10}
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    placeholder={score!.targetScore ? String(score!.targetScore) : '1450'}
                    className="w-28 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-1.5 text-white text-sm focus:border-emerald-500 outline-none"
                  />
                  <button
                    onClick={saveTarget}
                    disabled={targetSaving}
                    className="text-sm font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {targetSaving ? 'Đang lưu...' : 'Lưu mục tiêu'}
                  </button>
                  {targetMsg && <span className="text-xs text-gray-400">{targetMsg}</span>}
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">
                <p>
                  Chưa có dữ liệu để dự đoán. Hãy luyện một vài câu ở mục Toán / Văn / Từ vựng để hệ
                  thống bắt đầu đo năng lực của bạn.
                </p>
              </div>
            )}
          </div>

          {/* Point 75: Bản Đồ Nhiệt Chuyên Cần 30 Ngày (30-Day Consistency Heatmap) */}
          <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🟩</span> Bản Đồ Nhiệt Chuyên Cần 30 Ngày Gần Nhất (Real Activity)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Đo lường kỷ luật rèn luyện qua lịch sử ngày học thực tế &amp; chuỗi streak duy trì (30 ngày gần nhất).
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>Nghỉ</span>
                <span className="w-3 h-3 rounded-sm bg-slate-800/80 border border-slate-700/60 inline-block" />
                <span className="w-3 h-3 rounded-sm bg-emerald-800 inline-block" />
                <span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" />
                <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
                <span>Nhiều</span>
              </div>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 lg:grid-cols-15 gap-2">
              {heatmapDays.map((item) => {
                return (
                  <div
                    key={item.dateStr}
                    title={`${item.dayDisplay} (${item.dateStr}): ${item.statusLabel}`}
                    className={`h-9 rounded-md border flex flex-col items-center justify-center text-[10px] font-mono transition-transform hover:scale-110 cursor-pointer relative ${item.intensityClass}`}
                  >
                    <span className="leading-none">{item.dayDisplay}</span>
                    {item.isToday && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1 right-1 ring-1 ring-slate-900"
                        title="Hôm nay"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-slate-400 mt-3 pt-3 border-t border-[#334155]">
              <div className="flex items-center gap-3">
                <span>
                  Chuỗi duy trì: <strong className="text-emerald-400 font-bold">{userStats.streak} ngày liên tiếp</strong> 🔥
                </span>
                <span>•</span>
                <span>
                  Tỷ lệ chuyên cần:{' '}
                  <strong className="text-white font-bold">
                    {heatmapDays.filter((d) => d.count > 0).length}/30 ngày ({Math.round((heatmapDays.filter((d) => d.count > 0).length / 30) * 100)}%)
                  </strong>
                </span>
              </div>
              <span className="text-slate-500 italic">Kỷ luật hàng ngày là con đường ngắn nhất đến mốc 1500+</span>
            </div>
          </div>

          {/* Point 66: Gợi ý Kỹ Năng Tăng Điểm Nhanh Nhất (Highest ROI Skills) */}
          <div className="bg-[#1b2533] p-6 rounded-xl border border-amber-500/30 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>💎</span> Kỹ Năng Tăng Điểm Thần Tốc (Highest ROI Skills)
                </h3>
                <p className="text-xs text-amber-200/80 mt-1">
                  Đầu tư ít thời gian nhất nhưng mang lại số điểm cộng cao nhất trong đề thi SAT.
                </p>
              </div>
              <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                💎 Tăng +20~35đ Ngay
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {HIGH_ROI_SKILLS.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-[#0f172a] border border-[#334155] hover:border-amber-500/50 transition flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <h4 className="text-sm font-bold text-white">{item.label}</h4>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                        {item.roi}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.reason}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#334155]">
                    <span className="text-[11px] text-slate-400">
                      Môn: {item.subject === 'math' ? 'Toán SAT' : 'Đọc & Viết'}
                    </span>
                    <Link
                      href={item.route}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 hover:from-amber-300 hover:to-yellow-400 transition"
                    >
                      Luyện ngay →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Xu hướng tuần */}
          {trend && <WeeklyTrendPanel trend={trend} />}

          {/* Radar Chart & Kỹ năng cần tập trung */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Radar Chart Panel */}
            <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center shadow-lg">
              <h3 className="text-xl font-bold text-white mb-6">Biểu Đồ Năng Lực SAT (5 Trục)</h3>
              {!hasData && !loading && (
                <p className="text-gray-500 text-sm mb-4 text-center">
                  Biểu đồ sẽ hiện khi bạn bắt đầu luyện tập.
                </p>
              )}
              <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="overflow-visible">
                  {gridPolygons.map((pts, i) => (
                    <polygon key={i} points={pts} fill="none" stroke="#334155" strokeWidth="1" />
                  ))}
                  {RADAR_AXES.map((ax, i) => (
                    <line
                      key={i}
                      x1={center}
                      y1={center}
                      x2={getPoint(100, ax.angle).split(',')[0]}
                      y2={getPoint(100, ax.angle).split(',')[1]}
                      stroke="#334155"
                      strokeWidth="1"
                    />
                  ))}
                  <polygon
                    points={points}
                    fill="rgba(16, 185, 129, 0.4)"
                    stroke="#10b981"
                    strokeWidth="2"
                    className="drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  />
                  {points.split(' ').map((pt, i) => (
                    <circle
                      key={i}
                      cx={pt.split(',')[0]}
                      cy={pt.split(',')[1]}
                      r="4"
                      fill="#34d399"
                    />
                  ))}
                </svg>
                <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-xs font-bold text-blue-400">
                  {axisValues[0].label} ({axisValues[0].value})
                </div>
                <div className="absolute top-[30%] right-[-45px] text-xs font-bold text-emerald-400">
                  {axisValues[1].label} ({axisValues[1].value})
                </div>
                <div className="absolute bottom-[-15px] right-[-10px] text-xs font-bold text-yellow-400">
                  {axisValues[2].label} ({axisValues[2].value})
                </div>
                <div className="absolute bottom-[-15px] left-[-15px] text-xs font-bold text-purple-400">
                  {axisValues[3].label} ({axisValues[3].value})
                </div>
                <div className="absolute top-[30%] left-[-45px] text-xs font-bold text-red-400">
                  {axisValues[4].label} ({axisValues[4].value})
                </div>
              </div>
            </div>

            {/* Skill cần tập trung */}
            <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg flex flex-col">
              <h3 className="text-xl font-bold text-white mb-4">Kỹ Năng Cần Khắc Phục Gấp</h3>
              <div className="flex-1 overflow-y-auto pr-2">
                {loading ? (
                  <p className="text-gray-400">Đang tải...</p>
                ) : score?.detailLocked && hasData ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                    <div className="text-4xl mb-2">🔒</div>
                    <p className="text-sm text-[#e2e8f0] font-medium">
                      Gợi ý kỹ năng cần cải thiện đang bị khóa
                    </p>
                    <p className="text-xs mt-1">
                      Premium phân tích điểm yếu cụ thể và ưu tiên skill cần luyện để lên điểm nhanh
                      nhất.
                    </p>
                    <Link
                      href="/upgrade?from=dashboard&unlock=premium"
                      className="inline-block mt-3 text-xs font-bold bg-gradient-to-r from-yellow-300 to-amber-500 text-amber-950 px-3 py-1.5 rounded-lg hover:from-yellow-200 hover:to-amber-400"
                    >
                      💎 Mở khóa phân tích
                    </Link>
                  </div>
                ) : score && score.focusSkills.length > 0 ? (
                  <ul className="space-y-4">
                    {score.focusSkills.map((s) => (
                      <li
                        key={s.id}
                        className="flex justify-between items-center gap-3 border-b border-[#334155] pb-3 last:border-0"
                      >
                        <div className="pr-2">
                          <p className="text-[#e2e8f0] font-medium text-sm">{s.label}</p>
                          <p className="text-xs text-red-400">Mastery: {s.score}/100</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-[#3b82f6] px-3 py-1 rounded text-white whitespace-nowrap">
                            {s.subject === 'math' ? 'Toán' : 'Đọc-Viết'}
                          </span>
                          <Link
                            href={practiceRouteForSkill(s.id, s.subject)}
                            className="text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 py-1.5 rounded whitespace-nowrap hover:from-emerald-400 hover:to-teal-400"
                          >
                            Luyện →
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <div className="text-4xl mb-2">✨</div>
                    <p>Luyện tập để hệ thống gợi ý điểm yếu cần cải thiện.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Point 76: CÔNG CỤ TÍNH ĐIỂM XÉT TUYỂN KẾT HỢP ĐẠI HỌC VIỆT NAM (SAT + IELTS + GPA) */}
          <div className="bg-[#1b2533] p-6 rounded-xl border border-emerald-500/30 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>🧮</span> Công Cụ Tính Điểm Xét Tuyển ĐH Việt Nam (SAT + IELTS + GPA)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Nhập điểm để ước tính khả năng đỗ vào các trường ĐH hàng đầu (FTU, NEU, HUST, DAV, VNU).
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                Mô Phỏng Tuyển Sinh 2026
              </span>
            </div>

            {/* Bộ nhập liệu */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#0f172a] border border-[#334155] mb-5">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Điểm SAT (400 - 1600):
                </label>
                <input
                  type="number"
                  min={400}
                  max={1600}
                  step={10}
                  value={calcSat}
                  onChange={(e) => setCalcSat(parseInt(e.target.value, 10) || 400)}
                  className="w-full bg-[#1b2533] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Điểm IELTS (5.0 - 9.0):
                </label>
                <input
                  type="number"
                  min={5.0}
                  max={9.0}
                  step={0.5}
                  value={calcIelts}
                  onChange={(e) => setCalcIelts(parseFloat(e.target.value) || 6.5)}
                  className="w-full bg-[#1b2533] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Điểm GPA THPT (7.0 - 10.0):
                </label>
                <input
                  type="number"
                  min={7.0}
                  max={10.0}
                  step={0.1}
                  value={calcGpa}
                  onChange={(e) => setCalcGpa(parseFloat(e.target.value) || 8.0)}
                  className="w-full bg-[#1b2533] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Kết quả ước tính */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {/* FTU */}
              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] flex flex-col justify-between">
                <div>
                  <div className="font-bold text-white text-sm">FTU Ngoại Thương</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Quy đổi: <strong className="text-amber-300">{vnAdmissionEstimates.ftu.conv} / 30</strong>
                  </div>
                </div>
                <div className="mt-3">
                  {vnAdmissionEstimates.ftu.safe ? (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 block text-center">
                      ✅ Cơ hội rất cao
                    </span>
                  ) : vnAdmissionEstimates.ftu.eligible ? (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-300 block text-center">
                      ⚡ Cạnh tranh
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-red-500/20 text-red-300 block text-center">
                      Cần SAT ≥ 1300
                    </span>
                  )}
                </div>
              </div>

              {/* NEU */}
              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] flex flex-col justify-between">
                <div>
                  <div className="font-bold text-white text-sm">NEU KT Quốc Dân</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Điểm môn SAT: <strong className="text-blue-300">{vnAdmissionEstimates.neu.conv} / 10</strong>
                  </div>
                </div>
                <div className="mt-3">
                  {vnAdmissionEstimates.neu.safe ? (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 block text-center">
                      ✅ Cơ hội rất cao
                    </span>
                  ) : vnAdmissionEstimates.neu.eligible ? (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-300 block text-center">
                      ⚡ Cạnh tranh
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-red-500/20 text-red-300 block text-center">
                      Cần SAT ≥ 1200
                    </span>
                  )}
                </div>
              </div>

              {/* HUST */}
              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] flex flex-col justify-between">
                <div>
                  <div className="font-bold text-white text-sm">HUST Bách Khoa</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Thang 100: <strong className="text-emerald-300">{vnAdmissionEstimates.hust.conv} / 100</strong>
                  </div>
                </div>
                <div className="mt-3">
                  {vnAdmissionEstimates.hust.safe ? (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 block text-center">
                      ✅ Cơ hội IT1/IT2
                    </span>
                  ) : vnAdmissionEstimates.hust.eligible ? (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-300 block text-center">
                      ⚡ Ngành Kỹ thuật
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-red-500/20 text-red-300 block text-center">
                      Cần SAT ≥ 1300
                    </span>
                  )}
                </div>
              </div>

              {/* DAV */}
              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] flex flex-col justify-between">
                <div>
                  <div className="font-bold text-white text-sm">HV Ngoại Giao</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    SAT + IELTS {calcIelts}
                  </div>
                </div>
                <div className="mt-3">
                  {vnAdmissionEstimates.dav.safe ? (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 block text-center">
                      ✅ Cơ hội rất cao
                    </span>
                  ) : vnAdmissionEstimates.dav.eligible ? (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-300 block text-center">
                      ⚡ Đạt ngưỡng nộp
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-red-500/20 text-red-300 block text-center">
                      Cần SAT ≥ 1250
                    </span>
                  )}
                </div>
              </div>

              {/* VNU */}
              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] flex flex-col justify-between">
                <div>
                  <div className="font-bold text-white text-sm">ĐHQG (Hà Nội/HCM)</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    UET, UEB, HCMUT
                  </div>
                </div>
                <div className="mt-3">
                  {vnAdmissionEstimates.vnu.safe ? (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 block text-center">
                      ✅ An toàn tuyệt đối
                    </span>
                  ) : vnAdmissionEstimates.vnu.eligible ? (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-300 block text-center">
                      ⚡ Đạt chuẩn sàn
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-1 rounded bg-red-500/20 text-red-300 block text-center">
                      Cần SAT ≥ 1100
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Point 82: BẢNG ĐỐI CHIẾU HỌC BỔNG DU HỌC MỸ & PERCENTILE */}
          <div className="bg-[#1b2533] p-6 rounded-xl border border-blue-500/30 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>🇺🇸</span> Bảng Đối Chiếu Học Bổng Du Học Mỹ & Thứ Hạng Bách Phân Vị (Percentile)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Đánh giá vị thế điểm số trên bình diện quốc tế theo chuẩn College Board.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                Thứ hạng: {currentPercentileTier.percentile}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 to-slate-900 border border-blue-500/30 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-blue-300 font-bold uppercase tracking-wider">
                    Vị thế điểm hiện tại ({score?.total ?? 400}/1600):
                  </div>
                  <div className="text-lg font-black text-white mt-0.5">
                    {currentPercentileTier.tier}
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    🎯 Ví dụ nhóm trường tiêu biểu: <strong className="text-white">{currentPercentileTier.examples}</strong>
                  </div>
                  <div className="text-xs text-amber-300 mt-1 font-semibold">
                    💰 {currentPercentileTier.scholarship}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {PERCENTILE_TIERS.map((tier, i) => {
                const isActive =
                  currentTotalScore >= tier.minScore && currentTotalScore <= tier.maxScore;
                return (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition ${
                      isActive
                        ? 'bg-blue-600/20 border-blue-400 text-white shadow'
                        : 'bg-[#0f172a] border-[#334155] text-slate-400'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-slate-200">
                        {tier.minScore} – {tier.maxScore}đ ({tier.percentile}):
                      </span>{' '}
                      <span>{tier.tier}</span>
                    </div>
                    <div className="font-medium text-amber-300 shrink-0">
                      {tier.scholarship.split(':')[0]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ĐỐI CHIẾU XÉT TUYỂN ĐH VIỆT NAM & PHIẾU BÁO CÁO PHỤ HUYNH + BÁO CÁO GIA SƯ (Point 81) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bảng đối chiếu chi tiết */}
            <div className="lg:col-span-2 bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>🏛️</span> Tiêu Chí Tuyển Sinh Chi Tiết Các Trường ĐH Top Đầu
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Điểm sàn xét tuyển và ngưỡng điểm an toàn các ngành hot năm 2026.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {VN_UNI_BENCHMARKS.map((uni) => {
                  const cur = score?.total ?? 400;
                  const isSafe = cur >= uni.safeScore;
                  const isCompetitive = cur >= uni.minScore && cur < uni.safeScore;
                  const gap = Math.max(0, uni.minScore - cur);
                  return (
                    <div
                      key={uni.code}
                      className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {uni.code}
                          </span>
                          <span className="font-bold text-white text-sm">{uni.name}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{uni.majors}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Sàn nhận hồ sơ: <strong className="text-slate-300">{uni.minScore}+</strong> •
                          Ngưỡng an toàn: <strong className="text-amber-300">{uni.safeScore}+</strong>
                        </p>
                      </div>
                      <div className="shrink-0">
                        {isSafe ? (
                          <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            ✅ Đạt ngưỡng an toàn ({uni.safeScore}+)
                          </span>
                        ) : isCompetitive ? (
                          <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/40">
                            ⚡ Đủ sàn xét tuyển (+{uni.safeScore - cur}đ để an toàn)
                          </span>
                        ) : (
                          <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                            🎯 Cần thêm +{gap} điểm (Mục tiêu {uni.minScore}+)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Báo cáo học tập: Gửi Phụ Huynh + Point 81: Gửi Thầy/Cô Gia Sư */}
            <div className="bg-gradient-to-b from-[#1b2533] to-[#111827] p-6 rounded-xl border border-amber-500/30 shadow-lg flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-3">
                  📋 Xuất Báo Cáo Định Kỳ
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Phiếu Báo Cáo Học Tập</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Tổng hợp minh bạch kết quả rèn luyện, điểm dự đoán Math & R&W để gửi cho Phụ huynh
                  hoặc Thầy/Cô gia sư hỗ trợ.
                </p>

                <div className="rounded-xl bg-[#0f172a] border border-[#334155] p-4 space-y-2.5 text-xs text-slate-200 mb-5">
                  <div className="font-bold text-amber-300 border-b border-[#334155] pb-2 flex justify-between">
                    <span>HỌC BẠ DIGITAL SAT</span>
                    <span>{currentExam.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Điểm SAT dự đoán:</span>
                    <span className="font-black text-white">{score?.total ?? 400} / 1600</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Chi tiết Toán / R&W:</span>
                    <span className="font-bold text-blue-300">
                      M: {score?.math ?? '—'} | RW: {score?.reading ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mục tiêu kỳ thi:</span>
                    <span className="font-bold text-emerald-400">
                      Math {splitTarget.math} + RW {splitTarget.reading}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tổng câu đã làm:</span>
                    <span className="font-bold text-white">{totalAttempts} câu</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Chuỗi ngày chuyên cần:</span>
                    <span className="font-bold text-orange-400">🔥 {userStats.streak} ngày</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {/* Point 81: Nút sao chép báo cáo gửi Thầy/Cô Gia sư */}
                <button
                  type="button"
                  onClick={() => {
                    const focusList =
                      score?.focusSkills && score.focusSkills.length > 0
                        ? score.focusSkills.map((s) => s.label).join(', ')
                        : 'Các chuyên đề Đại số, Dấu câu & Đọc hiểu';
                    const tutorReport = [
                      '📋 BÁO CÁO TIẾN ĐỘ SAT GỬI THẦY/CÔ GIA SƯ (SAT GURU)',
                      `• Kỳ thi mục tiêu: ${currentExam.label} (Còn ${daysUntilExam} ngày)`,
                      `• Điểm SAT hiện tại: Tổng ${score?.total ?? 400}/1600 (Toán: ${score?.math ?? '—'}, Đọc-Viết: ${score?.reading ?? '—'})`,
                      `• Mục tiêu kỳ thi: Toán ${splitTarget.math} + R&W ${splitTarget.reading} (Tổng: ${splitTarget.math + splitTarget.reading})`,
                      `• Tổng số câu đã hoàn thành: ${totalAttempts} câu | Streak: ${userStats.streak} ngày 🔥`,
                      `• Top kỹ năng cần Thầy/Cô hỗ trợ giải đáp: ${focusList}`,
                      '• Đề xuất: Thầy/Cô kiểm tra giúp em các câu hỏi làm sai ở chuyên đề trên trong buổi học tới ạ.',
                    ].join('\n');
                    void navigator.clipboard?.writeText(tutorReport);
                    setCopiedTutorReport(true);
                    setTimeout(() => setCopiedTutorReport(false), 3000);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-400 hover:to-indigo-500 transition shadow"
                >
                  {copiedTutorReport
                    ? '✅ Đã sao chép! Dán gửi Thầy/Cô qua Zalo ngay'
                    : '📋 Sao chép Báo cáo Gửi Thầy / Cô Gia Sư'}
                </button>

                {/* Báo cáo gửi Phụ Huynh */}
                <button
                  type="button"
                  onClick={() => {
                    const focusList =
                      score?.focusSkills && score.focusSkills.length > 0
                        ? score.focusSkills.map((s) => s.label).join(', ')
                        : 'Đang rèn luyện đồng đều các chuyên đề Toán & Đọc-Viết';
                    const reportText = [
                      '📊 BÁO CÁO TIẾN ĐỘ LUYỆN THI DIGITAL SAT (SAT GURU)',
                      `• Điểm SAT dự đoán hiện tại: ${score?.total ?? 400}/1600 (Mục tiêu: ${splitTarget.math + splitTarget.reading}/1600)`,
                      `• Tổng số câu hỏi đã hoàn thành: ${totalAttempts} câu`,
                      `• Chuỗi ngày tự giác học liên tiếp: ${userStats.streak} ngày 🔥`,
                      `• Mức độ nắm vững kiến thức: ${mastery?.overall ?? 0}%`,
                      `• Trọng tâm đang khắc phục tuần này: ${focusList}.`,
                    ].join('\n');
                    void navigator.clipboard?.writeText(reportText);
                    setCopiedParentReport(true);
                    setTimeout(() => setCopiedParentReport(false), 3000);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-300 to-yellow-500 text-amber-950 hover:from-amber-200 hover:to-yellow-400 transition shadow"
                >
                  {copiedParentReport
                    ? '✅ Đã sao chép! Dán gửi Zalo cho Phụ huynh ngay'
                    : '📋 Sao chép Báo cáo gửi Zalo cho Bố / Mẹ'}
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#0f172a] hover:bg-[#1e293b] text-slate-200 border border-[#334155] transition"
                >
                  🖨️ In Phiếu Báo Cáo / Xuất PDF
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Point 63: Modal Học Nhanh 10 Phút (Micro-Session) */}
      {showMicroModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#1b2533] border-2 border-amber-500/60 rounded-2xl p-6 max-w-lg w-full shadow-[0_0_40px_rgba(245,158,11,0.25)] space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#334155]">
              <div className="flex items-center gap-2">
                <span className="text-3xl">⚡</span>
                <div>
                  <h3 className="text-lg font-black text-amber-400">
                    Lộ Trình Học Nhanh 10 Phút Hôm Nay
                  </h3>
                  <p className="text-xs text-slate-300">
                    Dành riêng cho học sinh bận rộn: 3 chặng tối ưu hóa não bộ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMicroModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-200">
              {/* Chặng 1 */}
              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] flex items-start gap-3">
                <span className="text-xl shrink-0">📕</span>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">Chặng 1: 3 Câu Sai Đến Hạn (3 Phút)</div>
                  <p className="text-slate-400 mt-1">
                    Não bộ nhớ lâu gấp 3 lần khi phục thù ngay những câu vừa làm sai.
                  </p>
                  <Link
                    href="/forge"
                    onClick={() => setShowMicroModal(false)}
                    className="inline-block mt-2 font-bold text-emerald-400 hover:underline"
                  >
                    Bắt đầu sửa câu sai →
                  </Link>
                </div>
              </div>

              {/* Chặng 2 */}
              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] flex items-start gap-3">
                <span className="text-xl shrink-0">📖</span>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">Chặng 2: 5 Từ Vựng Trọng Tâm (4 Phút)</div>
                  <p className="text-slate-400 mt-1">
                    Ghi nhớ 5 từ vựng học thuật SAT có tần suất xuất hiện cao nhất trong đề.
                  </p>
                  <Link
                    href="/vocabulary"
                    onClick={() => setShowMicroModal(false)}
                    className="inline-block mt-2 font-bold text-amber-400 hover:underline"
                  >
                    Luyện thẻ từ vựng →
                  </Link>
                </div>
              </div>

              {/* Chặng 3 */}
              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] flex items-start gap-3">
                <span className="text-xl shrink-0">🎯</span>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">Chặng 3: 2 Câu Kỹ Năng Yếu Nhất (3 Phút)</div>
                  <p className="text-slate-400 mt-1">
                    Tập trung giải quyết 2 câu hỏi thuộc chuyên đề bạn hay mất điểm nhất.
                  </p>
                  <Link
                    href="/grind"
                    onClick={() => setShowMicroModal(false)}
                    className="inline-block mt-2 font-bold text-blue-400 hover:underline"
                  >
                    Vào Khổ luyện ngay →
                  </Link>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowMicroModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold"
              >
                Đóng
              </button>
              <Link
                href="/forge"
                onClick={() => setShowMicroModal(false)}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 font-black text-xs hover:from-amber-300 hover:to-yellow-400 shadow"
              >
                🚀 Bắt đầu Chặng 1 ngay
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
