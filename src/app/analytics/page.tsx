'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useGamification } from '@/context/GamificationContext';

/** Cấu trúc dữ liệu từ API */
interface ScorePrediction {
  math: number | null;
  reading: number | null;
  total: number;
  confidence: 'low' | 'medium' | 'high';
  totalAttempts: number;
  targetScore: number | null;
  pointsToTarget: number | null;
  focusSkills: Array<{ id: string; label: string; score: number; subject: string }>;
  detailLocked?: boolean;
}

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

interface ExamHistoryItem {
  id?: string;
  examId?: string;
  title?: string;
  date?: string;
  completedAt?: string;
  totalScore?: number;
  score?: number;
  mathScore?: number;
  readingScore?: number;
}

/** 8 Chuyên Đề Chuẩn Digital SAT theo College Board Framework */
interface SatDomainAxis {
  id: string;
  label: string;
  subject: 'math' | 'reading';
  fullTitle: string;
  weight: string;
  angle: number; // Góc trên Radar chart (độ)
  color: string;
  hexColor: string;
  practiceRoute: string;
}

const SAT_8_DOMAINS: SatDomainAxis[] = [
  // 4 Chuyên Đề Toán SAT (Math)
  {
    id: 'algebra',
    label: 'Đại Số Tuyến Tính',
    subject: 'math',
    fullTitle: 'Algebra (Phương trình, Hệ phương trình, Bất phương trình)',
    weight: '35% đề Toán (13-15 câu)',
    angle: 90,
    color: 'text-blue-400',
    hexColor: '#60a5fa',
    practiceRoute: '/math',
  },
  {
    id: 'advanced_math',
    label: 'Đại Số Nâng Cao',
    subject: 'math',
    fullTitle: 'Advanced Math (Hàm bậc hai, Đa thức, Hàm mũ, Phương trình phi tuyến)',
    weight: '35% đề Toán (13-15 câu)',
    angle: 45,
    color: 'text-cyan-400',
    hexColor: '#22d3ee',
    practiceRoute: '/math',
  },
  {
    id: 'problem_solving',
    label: 'Số Liệu & Thống Kê',
    subject: 'math',
    fullTitle: 'Problem-Solving & Data Analysis (Tỷ lệ, Phần trăm, Xác suất, Bảng biểu)',
    weight: '15% đề Toán (5-7 câu)',
    angle: 0,
    color: 'text-teal-400',
    hexColor: '#2dd4bf',
    practiceRoute: '/math',
  },
  {
    id: 'geometry_trig',
    label: 'Hình Học & Lượng Giác',
    subject: 'math',
    fullTitle: 'Geometry & Trigonometry (Diện tích, Thể tích, Đường tròn, Sin/Cos/Tan)',
    weight: '15% đề Toán (5-7 câu)',
    angle: 315,
    color: 'text-emerald-400',
    hexColor: '#34d399',
    practiceRoute: '/math',
  },

  // 4 Chuyên Đề Đọc & Viết (Reading & Writing)
  {
    id: 'info_ideas',
    label: 'Thông Tin & Ý Tưởng',
    subject: 'reading',
    fullTitle: 'Information and Ideas (Ý chính, Chi tiết, Bằng chứng văn bản & số liệu)',
    weight: '26% đề R&W (12-14 câu)',
    angle: 270,
    color: 'text-amber-400',
    hexColor: '#fbbf24',
    practiceRoute: '/literature',
  },
  {
    id: 'craft_structure',
    label: 'Cấu Trúc & Ngữ Cảnh',
    subject: 'reading',
    fullTitle: 'Craft and Structure (Từ vựng ngữ cảnh, Mục đích đoạn văn, Liên kết 2 văn bản)',
    weight: '28% đề R&W (13-15 câu)',
    angle: 225,
    color: 'text-orange-400',
    hexColor: '#fb923c',
    practiceRoute: '/vocabulary',
  },
  {
    id: 'expression_ideas',
    label: 'Biểu Đạt Ý Tưởng',
    subject: 'reading',
    fullTitle: 'Expression of Ideas (Tổng hợp nghiên cứu Rhetorical Synthesis, Từ nối Transitions)',
    weight: '20% đề R&W (8-10 câu)',
    angle: 180,
    color: 'text-rose-400',
    hexColor: '#fb7185',
    practiceRoute: '/literature',
  },
  {
    id: 'standard_english',
    label: 'Quy Chuẩn Ngữ Pháp',
    subject: 'reading',
    fullTitle: 'Standard English Conventions (Dấu câu Boundaries, Cấu trúc câu, Sự hòa hợp)',
    weight: '26% đề R&W (11-13 câu)',
    angle: 135,
    color: 'text-purple-400',
    hexColor: '#c084fc',
    practiceRoute: '/literature',
  },
];

/** Bảng đối chiếu Bách phân vị & Học bổng Du học Mỹ */
const US_SCHOLARSHIP_TIERS = [
  {
    minScore: 1520,
    maxScore: 1600,
    percentile: 'Top 1% (99th Percentile)',
    tierName: 'Nhóm Tinh Hoa Ivy League & Top 20 Quốc Gia',
    schools: 'Harvard, Stanford, MIT, Yale, Columbia, UPenn, Princeton, Duke, Northwestern',
    scholarshipPerYear: '$55,000 – $88,000',
    fourYearTotal: '$220,000 – $352,000 (~5.5 – 8.8 tỷ VNĐ)',
    policy: 'Học bổng Toàn phần & Need-based Hỗ trợ 100% tài chính',
    competitiveness: 'Xuất sắc tuyệt đối',
  },
  {
    minScore: 1440,
    maxScore: 1510,
    percentile: 'Top 3% – 5% (95th – 97th Percentile)',
    tierName: 'Nhóm Đại Học Nghiên Cứu Top 25 – 50 US News',
    schools: 'NYU, Georgia Tech, UNC Chapel Hill, Boston University, Tufts, Rochester, Case Western',
    scholarshipPerYear: '$35,000 – $60,000',
    fourYearTotal: '$140,000 – $240,000 (~3.5 – 6.0 tỷ VNĐ)',
    policy: 'Học bổng Danh dự (Presidential & Merit Scholarships) 50% – 85% học phí',
    competitiveness: 'Rất cao',
  },
  {
    minScore: 1350,
    maxScore: 1430,
    percentile: 'Top 10% – 12% (88th – 92nd Percentile)',
    tierName: 'Nhóm Bang Trọng Điểm & Top 50 – 90 US News',
    schools: 'Purdue, Penn State, Ohio State, Fordham, Syracuse, Drexel, UConn',
    scholarshipPerYear: '$20,000 – $40,000',
    fourYearTotal: '$80,000 – $160,000 (~2.0 – 4.0 tỷ VNĐ)',
    policy: 'Học bổng Khuyến học & Giảm trừ học phí sinh viên quốc tế (Out-of-state Waiver)',
    competitiveness: 'Thuận lợi',
  },
  {
    minScore: 1250,
    maxScore: 1340,
    percentile: 'Top 20% – 25% (75th – 80th Percentile)',
    tierName: 'Nhóm Đại Học Đa Ngành & Khai Phóng (Top 100 – 150)',
    schools: 'Arizona State, Michigan State, Iowa State, UT Dallas, USF, Cincinnati',
    scholarshipPerYear: '$12,000 – $25,000',
    fourYearTotal: '$48,000 – $100,000 (~1.2 – 2.5 tỷ VNĐ)',
    policy: 'Học bổng Nhập học Tự động (Automatic Merit Award) dựa trên SAT + GPA',
    competitiveness: 'Cơ hội tốt',
  },
  {
    minScore: 400,
    maxScore: 1240,
    percentile: 'Dưới Top 30% (Foundation Level)',
    tierName: 'Giai Đoạn Nền Tảng & Chuẩn Bị Tăng Tốc',
    schools: 'Các trường Cao đẳng Cộng đồng (2+2 Transfer) hoặc Đại học Vùng',
    scholarshipPerYear: '$5,000 – $12,000',
    fourYearTotal: '$20,000 – $48,000 (~500 triệu – 1.2 tỷ VNĐ)',
    policy: 'Cần củng cố kiến thức trọng điểm để bứt phá lên 1350+ mở rộng học bổng lớn',
    competitiveness: 'Cần nâng điểm',
  },
];

export default function AnalyticsCenterPage() {
  const { userStats } = useGamification();
  const [score, setScore] = useState<ScorePrediction | null>(null);
  const [mastery, setMastery] = useState<MasterySummary | null>(null);
  const [examHistory, setExamHistory] = useState<ExamHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Bộ lọc mô phỏng xét tuyển ĐH Việt Nam
  const [satInput, setSatInput] = useState<number>(1420);
  const [ieltsInput, setIeltsInput] = useState<number>(7.5);
  const [gpaInput, setGpaInput] = useState<number>(8.8);

  // Tải dữ liệu từ API và localStorage
  useEffect(() => {
    async function initData() {
      try {
        const [scoreRes, masteryRes] = await Promise.all([
          fetch('/api/score'),
          fetch('/api/mastery'),
        ]);

        if (scoreRes.ok) {
          const sData: ScorePrediction = await scoreRes.json();
          setScore(sData);
          if (sData.total && sData.total >= 400) {
            setSatInput(sData.total);
          }
        }

        if (masteryRes.ok) {
          const mData: MasterySummary = await masteryRes.json();
          setMastery(mData);
        }
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu analytics:', err);
      } finally {
        setLoading(false);
      }

      // Đọc lịch sử thi thử từ localStorage
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('sat_exam_history_v1');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setExamHistory(parsed);
            }
          }
        } catch (e) {
          console.warn('Lỗi đọc sat_exam_history_v1:', e);
        }
      }
    }

    initData();
  }, []);

  // Tính điểm Mastery cho từng chuyên đề trong 8 chuyên đề Digital SAT
  const domainMasteryMap = useMemo(() => {
    const scores: Record<string, number> = {};

    SAT_8_DOMAINS.forEach((domain) => {
      if (!mastery || !mastery.skills || mastery.skills.length === 0) {
        // Giá trị baseline mặc định khi người dùng mới bắt đầu
        const base = domain.subject === 'math' ? 55 : 50;
        scores[domain.id] = base;
        return;
      }

      // Lọc các skill tương ứng với domain
      const matched = mastery.skills.filter((s) => {
        const dId = (s.domainId || '').toLowerCase();
        const sId = (s.id || '').toLowerCase();
        const dTarget = domain.id.toLowerCase();

        if (dTarget === 'algebra') return dId.includes('algebra') || sId.includes('alg');
        if (dTarget === 'advanced_math') return dId.includes('adv') || sId.includes('quad');
        if (dTarget === 'problem_solving') return dId.includes('data') || dId.includes('stat') || sId.includes('ratio');
        if (dTarget === 'geometry_trig') return dId.includes('geom') || dId.includes('trig') || sId.includes('circle');
        if (dTarget === 'info_ideas') return dId.includes('info') || sId.includes('idea') || sId.includes('detail');
        if (dTarget === 'craft_structure') return dId.includes('craft') || sId.includes('vocab') || sId.includes('context');
        if (dTarget === 'expression_ideas') return dId.includes('expression') || sId.includes('trans') || sId.includes('synth');
        if (dTarget === 'standard_english') return dId.includes('conventions') || sId.includes('bound') || sId.includes('punct');

        return s.subject === domain.subject;
      });

      if (matched.length > 0) {
        const totalScore = matched.reduce((acc, cur) => acc + (Number.isFinite(cur.score) ? cur.score : 0), 0);
        const avg = Math.round(totalScore / matched.length);
        scores[domain.id] = Math.max(10, Math.min(100, Number.isFinite(avg) ? avg : 50));
      } else {
        // Fallback theo điểm subject chung
        const subAvg = domain.subject === 'math' ? mastery.bySubject?.math : mastery.bySubject?.reading;
        scores[domain.id] = Math.max(15, Math.min(95, Math.round(Number.isFinite(subAvg) ? subAvg : 50)));
      }
    });

    return scores;
  }, [mastery]);

  // Tìm chuyên đề yếu nhất (Lowest Mastery Domain) để tạo nút 1-click hành động
  const weakestDomain = useMemo(() => {
    let lowest = SAT_8_DOMAINS[0];
    let minScore = 999;

    SAT_8_DOMAINS.forEach((domain) => {
      const s = domainMasteryMap[domain.id] ?? 50;
      if (s < minScore) {
        minScore = s;
        lowest = domain;
      }
    });

    return {
      domain: lowest,
      score: minScore,
    };
  }, [domainMasteryMap]);

  // Geometry tính tọa độ biểu đồ Radar 8 trục
  const radarSize = 340;
  const center = radarSize / 2;
  const radius = center - 45;

  const getRadarCoords = (valPercent: number, angleDeg: number) => {
    const rad = (Math.PI / 180) * angleDeg;
    const safePercent = Number.isFinite(valPercent) ? Math.max(0, Math.min(100, valPercent)) : 50;
    const r = (radius * safePercent) / 100;
    const x = center + r * Math.cos(rad);
    const y = center - r * Math.sin(rad);
    const safeX = Number.isFinite(x) ? x : center;
    const safeY = Number.isFinite(y) ? y : center;
    return { x: safeX, y: safeY, str: `${safeX.toFixed(1)},${safeY.toFixed(1)}` };
  };

  const radarPolygonPoints = useMemo(() => {
    return SAT_8_DOMAINS.map((d) => {
      const val = domainMasteryMap[d.id] ?? 50;
      return getRadarCoords(val, d.angle).str;
    }).join(' ');
  }, [domainMasteryMap]);

  // Đánh giá cơ hội học bổng Mỹ theo điểm SAT nhập vào
  const currentScholarshipTier = useMemo(() => {
    return (
      US_SCHOLARSHIP_TIERS.find(
        (t) => satInput >= t.minScore && satInput <= t.maxScore
      ) || US_SCHOLARSHIP_TIERS[US_SCHOLARSHIP_TIERS.length - 1]
    );
  }, [satInput]);

  // Tính toán Xét tuyển 6 Đại Học Hàng Đầu Việt Nam (2026)
  const vnAdmissions = useMemo(() => {
    // 1. FTU (Ngoại Thương): Thang 30 = (SAT/1600)*30. Sàn >= 1300 + GPA >= 8.5. An toàn >= 1420
    const ftuScore = Number(((satInput / 1600) * 30).toFixed(2));
    const ftuEligible = satInput >= 1300 && gpaInput >= 8.5;
    const ftuSafe = satInput >= 1420 && gpaInput >= 8.8;

    // 2. NEU (Kinh Tế Quốc Dân): Môn SAT quy đổi thang 10 = (SAT/1600)*10. Sàn >= 1200. An toàn >= 1380
    const neuScore = Number(((satInput / 1600) * 10).toFixed(2));
    const neuEligible = satInput >= 1200;
    const neuSafe = satInput >= 1380;

    // 3. HUST (Bách Khoa): Phương thức tài năng thang 100 = (SAT/1600)*100. IT1/IT2 an toàn >= 1450
    const hustScore = Number(((satInput / 1600) * 100).toFixed(2));
    const hustEligible = satInput >= 1300;
    const hustSafeIT = satInput >= 1450;
    const hustSafeEng = satInput >= 1350;

    // 4. VNU (ĐHQG Hà Nội & TP.HCM: UET, HCMUT, UEB): Sàn >= 1100. Nhóm CNTT an toàn >= 1350
    const vnuEligible = satInput >= 1100;
    const vnuSafe = satInput >= 1340;

    // 5. VinUni: Đánh giá toàn diện. Sàn >= 1350. Học bổng 50-80% >= 1450. Full ride 100% >= 1520
    const vinEligible = satInput >= 1350;
    const vinScholarship = satInput >= 1450;
    const vinFullRide = satInput >= 1520;

    // 6. RMIT: Tuyển thẳng Kinh doanh >= 1190, Công nghệ >= 1240. Học bổng Hiệu trưởng >= 1400
    const rmitDirect = satInput >= 1240;
    const rmitScholarship = satInput >= 1400;

    return {
      ftu: { score: ftuScore, eligible: ftuEligible, safe: ftuSafe },
      neu: { score: neuScore, eligible: neuEligible, safe: neuSafe },
      hust: { score: hustScore, eligible: hustEligible, safeIT: hustSafeIT, safeEng: hustSafeEng },
      vnu: { eligible: vnuEligible, safe: vnuSafe },
      vinuni: { eligible: vinEligible, scholarship: vinScholarship, fullRide: vinFullRide },
      rmit: { direct: rmitDirect, scholarship: rmitScholarship },
    };
  }, [satInput, gpaInput]);

  // Phân tích Velocity Trajectory (Tốc độ tăng điểm & Ngày dự kiến đạt mục tiêu)
  const trajectoryData = useMemo(() => {
    const currentScore = score?.total ?? 1320;
    const target = score?.targetScore || 1480;

    // Chuẩn bị các mốc điểm trong quá khứ
    let dataPoints: Array<{ label: string; score: number; dateStr: string }> = [];

    if (examHistory.length > 0) {
      // Sắp xếp theo ngày tăng dần
      const sorted = [...examHistory].sort((a, b) => {
        const tA = new Date(a.completedAt || a.date || 0).getTime();
        const tB = new Date(b.completedAt || b.date || 0).getTime();
        return tA - tB;
      });

      dataPoints = sorted.map((ex, i) => ({
        label: `Thi thử #${i + 1}`,
        score: ex.totalScore || ex.score || 1200,
        dateStr: (ex.completedAt || ex.date || '').slice(0, 10) || `Tuần -${sorted.length - i}`,
      }));
    }

    // Nếu chưa đủ điểm dữ liệu, tạo quỹ đạo hợp lý từ ngày tham gia
    if (dataPoints.length < 3) {
      const baseScore = Math.max(900, currentScore - 120);
      const midScore = Math.max(950, currentScore - 50);
      dataPoints = [
        { label: 'Khảo sát đầu vào', score: baseScore, dateStr: '1 tháng trước' },
        { label: 'Thi thử giữa kỳ', score: midScore, dateStr: '2 tuần trước' },
        { label: 'Năng lực hiện tại', score: currentScore, dateStr: 'Hôm nay' },
      ];
    } else {
      // Đảm bảo điểm cuối cùng là điểm hiện tại
      dataPoints.push({ label: 'Hiện tại', score: currentScore, dateStr: 'Hôm nay' });
    }

    // Tính tốc độ tăng điểm (Velocity: số điểm / tuần)
    const firstScore = dataPoints[0].score;
    const lastScore = currentScore;
    const scoreDiff = Math.max(10, lastScore - firstScore);
    const estimatedWeeks = Math.max(2, dataPoints.length);
    const velocityPerWeek = Math.max(8, Math.round(scoreDiff / estimatedWeeks));

    // Tính số ngày cần thiết để đạt Target
    const remainingPoints = Math.max(0, target - currentScore);
    const weeksNeeded = Math.ceil(remainingPoints / velocityPerWeek);
    const daysNeeded = weeksNeeded * 7;

    const projectedDate = new Date();
    projectedDate.setDate(projectedDate.getDate() + daysNeeded);
    const targetDateFormatted = projectedDate.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    return {
      currentScore,
      targetScore: target,
      velocityPerWeek,
      remainingPoints,
      daysNeeded,
      targetDateFormatted,
      dataPoints,
    };
  }, [score, examHistory]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">
      {/* Header Trung Tâm Chiến Lược */}
      <div
        className="p-8 rounded-2xl border border-emerald-500/40 shadow-2xl relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #022c22 0%, #064e3b 40%, #0f172a 100%)',
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider">
              <span>🎯</span> Trung Tâm Phân Tích Chiến Lược & Tuyển Sinh Đại Học
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              BẢNG ĐIỀU KHIỂN CHIẾN LƯỢC DIGITAL SAT 2026
            </h1>
            <p className="text-sm text-emerald-200/90 max-w-2xl leading-relaxed">
              Phân tích đa chiều 8 chuyên đề College Board, mô phỏng cơ hội trúng tuyển Đại học hàng đầu Việt Nam
              và săn học bổng du học Mỹ trị giá tới $85,000/năm.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>←</span> Về Bảng Điều Khiển
            </Link>
            <Link
              href="/grind"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-black shadow-lg transition flex items-center gap-1.5"
            >
              <span>⚡</span> Vào Khổ Luyện SAT
            </Link>
          </div>
        </div>
      </div>

      {/* KHU VỰC 1: BIỂU ĐỒ RADAR 8 CHUYÊN ĐỀ DIGITAL SAT & NÚT 1-CLICK DIỆT ĐIỂM YẾU */}
      <section className="bg-[#1b2533] p-6 sm:p-8 rounded-2xl border border-[#262730] shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#334155]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Biểu Đồ Radar 8 Chuyên Đề Chuẩn Digital SAT
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Khảo sát toàn diện 4 Domain Toán + 4 Domain Đọc-Viết theo đúng khung chuẩn kiến thức College Board.
            </p>
          </div>

          {/* Badge tổng thể */}
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
              Toán: {mastery?.bySubject.math ?? 60}%
            </span>
            <span className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
              Đọc-Viết: {mastery?.bySubject.reading ?? 55}%
            </span>
          </div>
        </div>

        {/* Thẻ Cảnh Báo 1-Click Diệt Kỹ Năng Yếu Nhất */}
        <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-red-950/60 via-amber-950/40 to-slate-900 border-2 border-amber-500/40 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <span className="text-3xl p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 shrink-0">
              🎯
            </span>
            <div>
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Điểm Mù Cần Đột Phá Ngay Hôm Nay
              </div>
              <div className="text-base sm:text-lg font-black text-white mt-0.5">
                {weakestDomain.domain.label} ({weakestDomain.score}% Mastery)
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {weakestDomain.domain.fullTitle} • Chiếm <strong className="text-amber-300">{weakestDomain.domain.weight}</strong>
              </p>
            </div>
          </div>

          <Link
            href={weakestDomain.domain.practiceRoute}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-amber-950 font-black text-sm shadow-xl transition transform hover:scale-105 flex items-center justify-center gap-2 shrink-0"
          >
            <span>⚡</span> 1-Click Luyện Đúng Kỹ Năng Này
          </Link>
        </div>

        {/* Biểu đồ Radar SVG & Danh sách 8 Chuyên Đề */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Cột Radar Chart SVG */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center p-4 bg-[#0f172a] rounded-2xl border border-[#334155]/70 relative">
            <div className="relative" style={{ width: radarSize, height: radarSize }}>
              <svg width={radarSize} height={radarSize} className="overflow-visible">
                {/* Các vòng đa giác đồng tâm (20%, 40%, 60%, 80%, 100%) */}
                {[20, 40, 60, 80, 100].map((ring) => {
                  const pts = SAT_8_DOMAINS.map((d) => getRadarCoords(ring, d.angle).str).join(' ');
                  return (
                    <polygon
                      key={ring}
                      points={pts}
                      fill="none"
                      stroke="#334155"
                      strokeWidth={ring === 100 ? '1.5' : '1'}
                      strokeDasharray={ring === 100 ? 'none' : '3,3'}
                    />
                  );
                })}

                {/* Các trục nan hoa 8 hướng */}
                {SAT_8_DOMAINS.map((d) => {
                  const edge = getRadarCoords(100, d.angle);
                  return (
                    <line
                      key={d.id}
                      x1={center}
                      y1={center}
                      x2={edge.x}
                      y2={edge.y}
                      stroke="#334155"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Diện tích Mastery thực tế */}
                <polygon
                  points={radarPolygonPoints}
                  fill="rgba(16, 185, 129, 0.35)"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  className="filter drop-shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                />

                {/* Các điểm nút (Nodes) */}
                {SAT_8_DOMAINS.map((d) => {
                  const val = domainMasteryMap[d.id] ?? 50;
                  const pt = getRadarCoords(val, d.angle);
                  return (
                    <circle
                      key={d.id}
                      cx={pt.x}
                      cy={pt.y}
                      r="5"
                      fill={d.hexColor}
                      stroke="#0f172a"
                      strokeWidth="2"
                      className="cursor-pointer hover:r-7 transition-all"
                    />
                  );
                })}
              </svg>

              {/* Nhãn 8 trục xung quanh */}
              {SAT_8_DOMAINS.map((d) => {
                const labelCoord = getRadarCoords(118, d.angle);
                return (
                  <div
                    key={d.id}
                    style={{
                      position: 'absolute',
                      left: `${labelCoord.x}px`,
                      top: `${labelCoord.y}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded bg-black/60 border border-[#334155] whitespace-nowrap ${d.color}`}
                  >
                    {d.label.split(' ')[0]} {domainMasteryMap[d.id]}%
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-6 mt-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> 4 Chuyên Đề Toán
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" /> 4 Chuyên Đề Đọc-Viết
              </span>
            </div>
          </div>

          {/* Cột Chi Tiết & Nút Luyện Từng Domain */}
          <div className="lg:col-span-6 space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {SAT_8_DOMAINS.map((domain) => {
              const currentVal = domainMasteryMap[domain.id] ?? 50;
              const isWeak = currentVal < 60;
              const isGood = currentVal >= 75;

              return (
                <div
                  key={domain.id}
                  className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                    isWeak
                      ? 'bg-red-950/20 border-red-500/30'
                      : isGood
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-[#0f172a] border-[#334155]'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black ${domain.color}`}>
                        {domain.subject === 'math' ? '📐 Math' : '📖 R&W'}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                        {domain.label}
                      </h4>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {domain.fullTitle}
                    </div>

                    {/* Thanh Progress mini */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isWeak ? 'bg-red-500' : isGood ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${currentVal}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-slate-300 w-8 text-right font-bold">
                        {currentVal}%
                      </span>
                    </div>
                  </div>

                  <Link
                    href={domain.practiceRoute}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-bold transition shrink-0 border border-slate-700"
                  >
                    Luyện →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* KHU VỰC 2: BỘ CÔNG CỤ TÍNH ĐIỂM XÉT TUYỂN ĐH VIỆT NAM 2026 */}
      <section className="bg-[#1b2533] p-6 sm:p-8 rounded-2xl border border-emerald-500/30 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#334155]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎓</span>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Bộ Công Cụ Tính Điểm Xét Tuyển Đại Học Việt Nam 2026
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Tích hợp công thức tuyển sinh chính thức: Ngoại Thương (FTU), KT Quốc Dân (NEU), Bách Khoa (HUST), ĐHQG, VinUni, RMIT.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 self-start sm:self-auto">
            Quy Chế Tuyển Sinh 2026
          </span>
        </div>

        {/* Bảng nhập thông số Tương tác */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 p-5 rounded-2xl bg-[#0f172a] border border-[#334155] mb-6">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-300">Điểm Digital SAT:</label>
              <span className="text-sm font-black text-amber-400">{satInput} / 1600</span>
            </div>
            <input
              type="range"
              min={1000}
              max={1600}
              step={10}
              value={satInput}
              onChange={(e) => setSatInput(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>1000</span>
              <span>1300 (Chuẩn sàn ĐH)</span>
              <span>1600</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-300">Điểm IELTS Academic:</label>
              <span className="text-sm font-black text-blue-400">{ieltsInput.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={5.5}
              max={9.0}
              step={0.5}
              value={ieltsInput}
              onChange={(e) => setIeltsInput(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>5.5</span>
              <span>7.0 (Chuẩn FTU/NEU)</span>
              <span>9.0</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-300">Điểm GPA THPT:</label>
              <span className="text-sm font-black text-emerald-400">{gpaInput.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={7.0}
              max={10.0}
              step={0.1}
              value={gpaInput}
              onChange={(e) => setGpaInput(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>7.0</span>
              <span>8.5 (Điều kiện sàn)</span>
              <span>10.0</span>
            </div>
          </div>
        </div>

        {/* 6 Thẻ Phân Tích Cơ Hội Vào Các Trường */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. FTU */}
          <div className="p-5 rounded-2xl bg-[#0f172a] border border-[#334155] flex flex-col justify-between hover:border-emerald-500/50 transition">
            <div>
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-white text-base">ĐH Ngoại Thương (FTU)</h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                  Phương thức 2
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Kinh tế đối ngoại, Kinh doanh quốc tế, Logistics
              </div>

              <div className="mt-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Quy đổi thang 30:</span>
                  <span className="font-bold text-amber-300">{vnAdmissions.ftu.score} / 30</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Điều kiện sàn:</span>
                  <span className="text-slate-300">SAT ≥ 1300 & GPA ≥ 8.5</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#334155]">
              {vnAdmissions.ftu.safe ? (
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold text-center border border-emerald-500/30">
                  ✅ Rất an toàn mọi ngành hot (≥ 1420)
                </div>
              ) : vnAdmissions.ftu.eligible ? (
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold text-center border border-amber-500/30">
                  ⚡ Đủ điều kiện nộp (+{1420 - satInput}đ để an toàn)
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold text-center border border-red-500/30">
                  ⚠️ Chưa đạt sàn SAT 1300 hoặc GPA 8.5
                </div>
              )}
            </div>
          </div>

          {/* 2. NEU */}
          <div className="p-5 rounded-2xl bg-[#0f172a] border border-[#334155] flex flex-col justify-between hover:border-emerald-500/50 transition">
            <div>
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-white text-base">ĐH Kinh Tế Quốc Dân (NEU)</h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                  Phương thức Kết hợp
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Kiểm toán, Phân tích dữ liệu, Marketing, Tài chính
              </div>

              <div className="mt-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Môn SAT quy đổi:</span>
                  <span className="font-bold text-blue-300">{vnAdmissions.neu.score} / 10</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Điểm sàn nhận hồ sơ:</span>
                  <span className="text-slate-300">SAT ≥ 1200</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#334155]">
              {vnAdmissions.neu.safe ? (
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold text-center border border-emerald-500/30">
                  ✅ Rất an toàn các ngành Top 1 (≥ 1380)
                </div>
              ) : vnAdmissions.neu.eligible ? (
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold text-center border border-amber-500/30">
                  ⚡ Cơ hội tốt ngành chuẩn (+{1380 - satInput}đ để an toàn)
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold text-center border border-red-500/30">
                  ⚠️ Chưa đạt điểm sàn SAT 1200
                </div>
              )}
            </div>
          </div>

          {/* 3. HUST */}
          <div className="p-5 rounded-2xl bg-[#0f172a] border border-[#334155] flex flex-col justify-between hover:border-emerald-500/50 transition">
            <div>
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-white text-base">ĐH Bách Khoa Hà Nội (HUST)</h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Xét Tuyển Tài Năng
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Khoa học Máy tính (IT1), Kỹ thuật Máy tính (IT2), Vi mạch
              </div>

              <div className="mt-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Điểm tài năng thang 100:</span>
                  <span className="font-bold text-emerald-300">{vnAdmissions.hust.score} / 100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Chuẩn sàn hồ sơ:</span>
                  <span className="text-slate-300">SAT ≥ 1300</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#334155]">
              {vnAdmissions.hust.safeIT ? (
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold text-center border border-emerald-500/30">
                  ✅ Cơ hội cao trúng IT1 / IT2 (≥ 1450)
                </div>
              ) : vnAdmissions.hust.safeEng ? (
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-bold text-center border border-cyan-500/30">
                  ⚡ An toàn ngành Kỹ thuật / Tự động hóa
                </div>
              ) : vnAdmissions.hust.eligible ? (
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold text-center border border-amber-500/30">
                  ⚡ Đủ ngưỡng nộp hồ sơ xét tuyển
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold text-center border border-red-500/30">
                  ⚠️ Cần nâng SAT ≥ 1300
                </div>
              )}
            </div>
          </div>

          {/* 4. VNU */}
          <div className="p-5 rounded-2xl bg-[#0f172a] border border-[#334155] flex flex-col justify-between hover:border-emerald-500/50 transition">
            <div>
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-white text-base">ĐHQG Hà Nội & TP.HCM</h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                  UET / UEB / HCMUT
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Công nghệ thông tin, Trí tuệ nhân tạo, Quản trị
              </div>

              <div className="mt-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Yêu cầu chứng chỉ:</span>
                  <span className="font-bold text-white">SAT ≥ 1100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ngưỡng an toàn CNTT:</span>
                  <span className="text-slate-300">SAT ≥ 1340</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#334155]">
              {vnAdmissions.vnu.safe ? (
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold text-center border border-emerald-500/30">
                  ✅ An toàn tuyệt đối mọi phân viện & ngành hot
                </div>
              ) : vnAdmissions.vnu.eligible ? (
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold text-center border border-amber-500/30">
                  ⚡ Đủ điều kiện trúng tuyển hầu hết các ngành
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold text-center border border-red-500/30">
                  ⚠️ Chưa đạt ngưỡng tối thiểu 1100
                </div>
              )}
            </div>
          </div>

          {/* 5. VinUni */}
          <div className="p-5 rounded-2xl bg-[#0f172a] border border-[#334155] flex flex-col justify-between hover:border-emerald-500/50 transition">
            <div>
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-white text-base">VinUniversity (VinUni)</h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300">
                  Xét Toàn Diện
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Khoa học Máy tính, Y khoa, Quản trị Kinh doanh
              </div>

              <div className="mt-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Chuẩn nộp hồ sơ:</span>
                  <span className="font-bold text-white">SAT ≥ 1350</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ngưỡng Học bổng 50-80%:</span>
                  <span className="text-amber-300 font-bold">SAT ≥ 1450</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#334155]">
              {vnAdmissions.vinuni.fullRide ? (
                <div className="p-2 rounded-lg bg-yellow-500/20 text-yellow-300 text-xs font-bold text-center border border-yellow-500/40">
                  💎 Ứng viên Học bổng 90% – 100% Toàn phần
                </div>
              ) : vnAdmissions.vinuni.scholarship ? (
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold text-center border border-emerald-500/30">
                  ✅ Cơ hội cao nhận Học bổng 50% – 80%
                </div>
              ) : vnAdmissions.vinuni.eligible ? (
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold text-center border border-amber-500/30">
                  ⚡ Đạt chuẩn vào vòng phỏng vấn cá nhân
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold text-center border border-red-500/30">
                  ⚠️ Khuyến nghị nâng SAT ≥ 1350
                </div>
              )}
            </div>
          </div>

          {/* 6. RMIT Việt Nam */}
          <div className="p-5 rounded-2xl bg-[#0f172a] border border-[#334155] flex flex-col justify-between hover:border-emerald-500/50 transition">
            <div>
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-white text-base">RMIT University Vietnam</h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                  Úc & Toàn Cầu
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Kinh doanh quốc tế, Truyền thông số, CNTT & Kỹ thuật
              </div>

              <div className="mt-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Tuyển thẳng ngành CNTT:</span>
                  <span className="font-bold text-white">SAT ≥ 1240</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Học bổng Hiệu trưởng:</span>
                  <span className="text-rose-300 font-bold">SAT ≥ 1400</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#334155]">
              {vnAdmissions.rmit.scholarship ? (
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold text-center border border-emerald-500/30">
                  ✅ Đủ tiêu chuẩn ứng tuyển Học bổng 50-100%
                </div>
              ) : vnAdmissions.rmit.direct ? (
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-bold text-center border border-blue-500/30">
                  ⚡ Tuyển thẳng 100% tất cả các chương trình
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold text-center border border-slate-700">
                  Cần nâng SAT ≥ 1190 để tuyển thẳng
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* KHU VỰC 3: BẢNG ĐỐI CHIẾU BÁCH PHÂN VỊ & CƠ HỘI HỌC BỔNG MỸ ($15,000 - $45,000/NĂM) */}
      <section className="bg-[#1b2533] p-6 sm:p-8 rounded-2xl border border-blue-500/30 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#334155]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌎</span>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Bảng Bách Phân Vị & Cơ Hội Học Bổng Đại Học Mỹ ($15.000 – $85.000/Năm)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Quy chuẩn bách phân vị College Board quốc tế và định mức học bổng Merit-based 4 năm đại học tại Hoa Kỳ.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 self-start sm:self-auto">
            US News & College Board 2026
          </span>
        </div>

        {/* Khung vị thế của thí sinh */}
        <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900 border-2 border-blue-500/40 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <div className="text-xs font-bold text-blue-300 uppercase tracking-widest">
                Đánh Giá Vị Thế Điểm Số Hiện Tại ({satInput} / 1600):
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1">
                {currentScholarshipTier.tierName}
              </div>
              <div className="text-xs sm:text-sm text-slate-300 mt-1.5 flex flex-wrap items-center gap-2">
                <span>Thứ hạng toàn cầu:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
                  {currentScholarshipTier.percentile}
                </span>
                <span>• Trường tiêu biểu:</span>
                <strong className="text-white">{currentScholarshipTier.schools}</strong>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-blue-500/30 shrink-0 text-center lg:text-right">
              <div className="text-[11px] text-amber-300 font-bold uppercase tracking-wider">
                Mức Học Bổng Dự Kiến
              </div>
              <div className="text-2xl font-black text-amber-400 mt-0.5">
                {currentScholarshipTier.scholarshipPerYear} <span className="text-xs text-slate-400">/ năm</span>
              </div>
              <div className="text-xs text-slate-300 mt-1">
                Tổng 4 năm: <strong className="text-white">{currentScholarshipTier.fourYearTotal}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Bảng Chi Tiết Từng Tier */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#334155] text-slate-400">
                <th className="py-3 px-3">Mức Điểm SAT</th>
                <th className="py-3 px-3">Bách Phân Vị (Percentile)</th>
                <th className="py-3 px-3">Phân Hạng Trường (Tier)</th>
                <th className="py-3 px-3">Học Bổng / Năm</th>
                <th className="py-3 px-3">Chính Sách Xét Tuyển</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/60">
              {US_SCHOLARSHIP_TIERS.map((tier, i) => {
                const isSelected = satInput >= tier.minScore && satInput <= tier.maxScore;
                return (
                  <tr
                    key={i}
                    className={`transition ${
                      isSelected
                        ? 'bg-blue-600/20 font-medium text-white border-l-4 border-l-blue-400'
                        : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <td className="py-3.5 px-3 font-bold whitespace-nowrap">
                      {tier.minScore} – {tier.maxScore}đ
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap text-blue-300 font-bold">
                      {tier.percentile}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-white">{tier.tierName}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{tier.schools}</div>
                    </td>
                    <td className="py-3.5 px-3 font-black text-amber-300 whitespace-nowrap">
                      {tier.scholarshipPerYear}
                    </td>
                    <td className="py-3.5 px-3 text-[11px] text-slate-300">
                      {tier.policy}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* KHU VỰC 4: LỊCH SỬ ĐIỂM THI THỬ & DỰ BÁO NGÀY ĐẠT MỤC TIÊU (VELOCITY TRAJECTORY) */}
      <section className="bg-[#1b2533] p-6 sm:p-8 rounded-2xl border border-teal-500/30 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#334155]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📈</span>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Lịch Sử Điểm Thi Thử & Dự Báo Ngày Đạt Mục Tiêu (Velocity Trajectory)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Đo lường gia tốc bứt phá điểm số thực tế và dự báo thời điểm hoàn thành mục tiêu.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 self-start sm:self-auto">
            Gia Tốc Tăng Điểm: +{trajectoryData.velocityPerWeek}đ / Tuần
          </span>
        </div>

        {/* Hàng Thống Kê Velocity Metric */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#334155] text-center">
            <div className="text-xs text-slate-400">Điểm Hiện Tại</div>
            <div className="text-2xl font-black text-white mt-1">
              {trajectoryData.currentScore} <span className="text-xs text-slate-500">/ 1600</span>
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 font-semibold">
              Chuỗi chuyên cần {userStats.streak} ngày 🔥
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#334155] text-center">
            <div className="text-xs text-slate-400">Mục Tiêu Kỳ Thi</div>
            <div className="text-2xl font-black text-amber-400 mt-1">
              {trajectoryData.targetScore} <span className="text-xs text-slate-500">/ 1600</span>
            </div>
            <div className="text-[11px] text-amber-300 mt-1 font-semibold">
              Cách đích {trajectoryData.remainingPoints} điểm
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#334155] text-center">
            <div className="text-xs text-slate-400">Tốc Độ Bứt Phá (Velocity)</div>
            <div className="text-2xl font-black text-cyan-400 mt-1">
              +{trajectoryData.velocityPerWeek}đ
            </div>
            <div className="text-[11px] text-cyan-300 mt-1 font-semibold">
              Trung bình mỗi 7 ngày
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-b from-emerald-950/60 to-slate-900 border border-emerald-500/40 text-center">
            <div className="text-xs text-emerald-300 font-bold">Dự Kiến Chạm Đích</div>
            <div className="text-xl font-black text-emerald-400 mt-1">
              {trajectoryData.targetDateFormatted}
            </div>
            <div className="text-[11px] text-slate-300 mt-1">
              Sau khoảng <strong className="text-white">{trajectoryData.daysNeeded} ngày</strong> rèn luyện
            </div>
          </div>
        </div>

        {/* Đồ Thị Quỹ Đạo SVG (Trajectory Growth Curve) */}
        <div className="p-6 rounded-2xl bg-[#0f172a] border border-[#334155] relative overflow-hidden">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-4">
            <span className="font-bold text-white">Quỹ Đạo Tăng Trưởng Thực Tế & Dự Phóng:</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Đã hoàn thành
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-400 inline-block" /> Dự phóng mục tiêu
              </span>
            </div>
          </div>

          <div className="w-full h-56 relative">
            <svg viewBox="0 0 800 200" className="w-full h-full overflow-visible">
              {/* Lưới ngang tham chiếu điểm 1000, 1200, 1400, 1600 */}
              {[1000, 1200, 1400, 1600].map((gridScore) => {
                const y = 180 - ((gridScore - 800) / (1600 - 800)) * 160;
                return (
                  <g key={gridScore}>
                    <line x1="50" y1={y} x2="760" y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />
                    <text x="15" y={y + 4} fill="#64748b" fontSize="10" fontFamily="monospace">
                      {gridScore}
                    </text>
                  </g>
                );
              })}

              {/* Tính tọa độ các điểm đã thi */}
              {(() => {
                const totalPointsCount = trajectoryData.dataPoints.length + 1; // +1 cho điểm target
                const stepX = (760 - 70) / Math.max(1, totalPointsCount - 1);

                const realCoords = trajectoryData.dataPoints.map((pt, i) => {
                  const x = 70 + i * stepX;
                  const y = 180 - ((pt.score - 800) / (1600 - 800)) * 160;
                  return { x, y, pt };
                });

                const targetCoord = {
                  x: 70 + (totalPointsCount - 1) * stepX,
                  y: 180 - ((trajectoryData.targetScore - 800) / (1600 - 800)) * 160,
                };

                const realPathStr = realCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                const lastReal = realCoords[realCoords.length - 1];
                const dashedPathStr = `M ${lastReal.x} ${lastReal.y} L ${targetCoord.x} ${targetCoord.y}`;

                return (
                  <>
                    {/* Vùng bóng mờ gradient dưới đường đồ thị */}
                    <path
                      d={`${realPathStr} L ${lastReal.x} 180 L ${realCoords[0].x} 180 Z`}
                      fill="rgba(16, 185, 129, 0.15)"
                    />

                    {/* Đường nét liền cho quá khứ */}
                    <path d={realPathStr} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />

                    {/* Đường nét đứt phóng tới tương lai */}
                    <path
                      d={dashedPathStr}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeDasharray="6,6"
                      strokeLinecap="round"
                    />

                    {/* Các điểm mốc trong quá khứ */}
                    {realCoords.map((c, i) => (
                      <g key={i}>
                        <circle cx={c.x} cy={c.y} r="6" fill="#10b981" stroke="#0f172a" strokeWidth="2" />
                        <text
                          x={c.x}
                          y={c.y - 12}
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {c.pt.score}
                        </text>
                        <text
                          x={c.x}
                          y="196"
                          fill="#94a3b8"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {c.pt.label}
                        </text>
                      </g>
                    ))}

                    {/* Điểm mốc Target */}
                    <g>
                      <circle cx={targetCoord.x} cy={targetCoord.y} r="8" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                      <text
                        x={targetCoord.x}
                        y={targetCoord.y - 14}
                        fill="#fbbf24"
                        fontSize="12"
                        fontWeight="black"
                        textAnchor="middle"
                      >
                        Target {trajectoryData.targetScore}
                      </text>
                      <text
                        x={targetCoord.x}
                        y="196"
                        fill="#f59e0b"
                        fontSize="10"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {trajectoryData.targetDateFormatted}
                      </text>
                    </g>
                  </>
                );
              })()}
            </svg>
          </div>

          <div className="mt-4 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              💡 <strong>Lời khuyên bứt tốc:</strong> Với quỹ đạo hiện tại, duy trì tối thiểu <strong>20 câu hỏi/ngày</strong> và sửa dứt điểm các lỗi sai trong Sổ tay lỗi sai sẽ đảm bảo bạn đạt mốc <strong>{trajectoryData.targetScore}</strong> đúng hạn dự kiến!
            </div>
            <Link
              href="/forge"
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shrink-0 transition text-center"
            >
              Vào Ôn Lỗi Sai Ngay →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
