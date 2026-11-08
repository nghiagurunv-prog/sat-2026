'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ParentReport, type ParentReportData } from '@/components/ParentReport';

/**
 * TRANG PHỤ HUYNH (KHÔNG cần đăng nhập) — mở /parent?code=PH-XXXX xem tiến độ con.
 * Đọc code từ URL (window.location, tránh Suspense của useSearchParams), fetch
 * /api/parent/report. Mã sai/hết hạn → thông báo, không crash.
 */

type State =
  | { phase: 'loading' }
  | { phase: 'no_code' }
  | { phase: 'invalid' }
  | { phase: 'ready'; data: ParentReportData; code: string };

/**
 * Helper fallback copy an toàn trong mọi môi trường (iframe, HTTP, không có Permissions API).
 */
async function copyToClipboardSafe(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback bên dưới
    }
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

/**
 * Bảo vệ các chỉ số tiến độ/điểm số khỏi NaN (Number.isFinite) theo quy chuẩn #073, #076.
 */
function sanitizeReportData(data: ParentReportData): ParentReportData {
  if (!data) return data;
  const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const optNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  return {
    ...data,
    prediction: {
      ...data.prediction,
      math: num(data.prediction?.math, 0),
      reading: num(data.prediction?.reading, 0),
      total: num(data.prediction?.total, 0),
      confidence: data.prediction?.confidence || 'medium',
      totalAttempts: num(data.prediction?.totalAttempts, 0),
      targetScore: optNum(data.prediction?.targetScore),
      pointsToTarget: optNum(data.prediction?.pointsToTarget),
      focusSkills: Array.isArray(data.prediction?.focusSkills)
        ? data.prediction.focusSkills.map((fs) => ({
            ...fs,
            score: num(fs.score, 0),
          }))
        : [],
    },
    mastery: {
      ...data.mastery,
      overall: num(data.mastery?.overall, 0),
      bySubject: {
        math: num(data.mastery?.bySubject?.math, 0),
        reading: num(data.mastery?.bySubject?.reading, 0),
      },
      domains: Array.isArray(data.mastery?.domains)
        ? data.mastery.domains.map((d) => ({
            ...d,
            score: num(d.score, 0),
          }))
        : [],
    },
    streak: num(data.streak, 0),
    weeklyTrend: data.weeklyTrend,
    recentTests: Array.isArray(data.recentTests)
      ? data.recentTests.map((t) => ({
          ...t,
          correct: num(t.correct, 0),
          total: num(t.total, 0),
          score: num(t.score, 0),
          when: num(t.when, Date.now()),
        }))
      : [],
    studentTier: data.studentTier,
    trendWindowDays: data.trendWindowDays,
    improvement: data.improvement
      ? {
          deltaOverall: num(data.improvement.deltaOverall, 0),
          deltaPredicted: num(data.improvement.deltaPredicted, 0),
          windowDays: num(data.improvement.windowDays, 7),
        }
      : data.improvement,
  };
}

/**
 * #C053: Bảng đối chiếu ngưỡng điểm xét tuyển Đại học trọng điểm tại Việt Nam
 */
interface TargetUniversity {
  name: string;
  shortName: string;
  benchmark: number;
  highlight: string;
  category: string;
}

const TARGET_UNIVERSITIES: TargetUniversity[] = [
  { name: 'ĐH Ngoại Thương (FTU)', shortName: 'FTU', benchmark: 1350, highlight: 'Xét tuyển sớm / Tuyển thẳng', category: 'Kinh tế & Đối ngoại' },
  { name: 'ĐH Kinh Tế Quốc Dân (NEU)', shortName: 'NEU', benchmark: 1300, highlight: 'Quy đổi kết hợp điểm thi tốt nghiệp', category: 'Kinh tế & Tài chính' },
  { name: 'ĐH Bách Khoa Hà Nội (HUST)', shortName: 'HUST', benchmark: 1450, highlight: 'Phương thức tài năng & Ưu tiên', category: 'Công nghệ & Kỹ thuật' },
  { name: 'Đại Học Quốc Gia (VNU Hà Nội / HCM)', shortName: 'VNU', benchmark: 1300, highlight: 'Chương trình Chất lượng cao & Tiên tiến', category: 'Đa ngành Trọng điểm' },
  { name: 'VinUniversity (VinUni)', shortName: 'VinUni', benchmark: 1400, highlight: 'Học bổng tài năng 50% - 100%', category: 'Quốc tế Tinh hoa' },
  { name: 'Fulbright University Vietnam', shortName: 'Fulbright', benchmark: 1400, highlight: 'Học bổng & Hỗ trợ tài chính theo nhu cầu', category: 'Khai phóng Quốc tế' },
];

/**
 * #C054: Ước tính giá trị học bổng tiềm năng (ROI Học tập)
 */
function getScholarshipEstimate(score: number) {
  if (score >= 1520) {
    return {
      tier: 'Học bổng Toàn phần Toàn Cầu / VinUni Presidential',
      value: '1.5 – 4.0 Tỷ VNĐ',
      color: 'from-amber-500/20 to-yellow-500/10 border-yellow-500/40 text-yellow-300',
      badge: '🏆 Top 1% Toàn cầu',
      desc: 'Cơ hội nhận học bổng 100% học phí + sinh hoạt phí các đại học Top 20-50 thế giới và gói toàn phần tại Việt Nam.',
    };
  }
  if (score >= 1450) {
    return {
      tier: 'Học bổng Danh dự 70% – 100%',
      value: '500 – 900 Triệu VNĐ',
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/40 text-emerald-300',
      badge: '💎 Xuất sắc toàn diện',
      desc: 'Mức điểm vào danh sách ưu tiên học bổng cao nhất tại VinUni, RMIT, BUV và Top 50-100 Đại học Quốc tế.',
    };
  }
  if (score >= 1350) {
    return {
      tier: 'Học bổng Bán phần & Tuyển thẳng ĐH Top đầu',
      value: '150 – 350 Triệu VNĐ',
      color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/40 text-blue-300',
      badge: '⭐ Lợi thế tuyển sinh vượt trội',
      desc: 'Miễn thi tốt nghiệp môn Tiếng Anh, xét tuyển thẳng FTU, NEU, Bách Khoa và học bổng 30-50% trường quốc tế.',
    };
  }
  return {
    tier: 'Giai đoạn Xây dựng Nền tảng Bứt phá',
    value: 'Mục tiêu tiếp cận mốc 1350+',
    color: 'from-purple-500/20 to-slate-500/10 border-purple-500/40 text-purple-300',
    badge: '🚀 Đang trên đà phát triển',
    desc: 'Tập trung bù đắp các lỗ hổng kiến thức cốt lõi để nâng điểm vượt ngưỡng 1350+ trong 4-8 tuần tới.',
  };
}

/**
 * #C059: Lịch thi SAT Quốc tế chính thức từ College Board
 */
interface OfficialSatDate {
  dateStr: string;
  name: string;
  regDeadline: string;
}

const OFFICIAL_SAT_DATES: OfficialSatDate[] = [
  { dateStr: '2025-05-03', name: 'Đợt thi SAT Tháng 5/2025', regDeadline: '18/04/2025' },
  { dateStr: '2025-06-07', name: 'Đợt thi SAT Tháng 6/2025', regDeadline: '22/05/2025' },
  { dateStr: '2025-08-23', name: 'Đợt thi SAT Tháng 8/2025', regDeadline: '08/08/2025' },
  { dateStr: '2025-10-04', name: 'Đợt thi SAT Tháng 10/2025', regDeadline: '19/09/2025' },
  { dateStr: '2025-11-08', name: 'Đợt thi SAT Tháng 11/2025', regDeadline: '24/10/2025' },
  { dateStr: '2025-12-06', name: 'Đợt thi SAT Tháng 12/2025', regDeadline: '21/11/2025' },
  { dateStr: '2026-03-14', name: 'Đợt thi SAT Tháng 3/2026', regDeadline: '27/02/2026' },
  { dateStr: '2026-05-02', name: 'Đợt thi SAT Tháng 5/2026', regDeadline: '17/04/2026' },
];

export default function ParentPage() {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [manualCode, setManualCode] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedZalo, setCopiedZalo] = useState(false);
  
  // #C060: Danh sách mã học sinh đã xem gần đây (lưu trong localStorage)
  const [recentCodes, setRecentCodes] = useState<string[]>([]);

  // #C058: Gửi lời động viên cho con
  const [encouragementNote, setEncouragementNote] = useState('');
  const [savedNoteSuccess, setSavedNoteSuccess] = useState(false);

  // #C051: Mở rộng / thu gọn giải thích thuật ngữ SAT
  const [showGlossary, setShowGlossary] = useState(false);

  // Đọc danh sách mã đã xem gần đây từ localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sat_parent_recent_codes');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentCodes(parsed.filter((item): item is string => typeof item === 'string'));
        }
      }
    } catch {
      // Bỏ qua lỗi localStorage
    }
  }, []);

  const saveRecentCode = (code: string) => {
    try {
      const norm = code.trim().toUpperCase();
      if (!norm) return;
      setRecentCodes((prev) => {
        const filtered = prev.filter((c) => c !== norm);
        const updated = [norm, ...filtered].slice(0, 5);
        try {
          localStorage.setItem('sat_parent_recent_codes', JSON.stringify(updated));
        } catch {
          // Bỏ qua lỗi localStorage
        }
        return updated;
      });
    } catch {
      // An toàn không crash
    }
  };

  const fetchReport = useCallback(async (codeToFetch: string) => {
    // Chuẩn hoá mã chia sẻ: trim và toUpperCase theo quy chuẩn #026
    const normalized = (codeToFetch || '').trim().toUpperCase();
    if (!normalized) {
      setState({ phase: 'no_code' });
      return;
    }

    setState({ phase: 'loading' });
    try {
      const res = await fetch(`/api/parent/report?code=${encodeURIComponent(normalized)}`);
      if (!res.ok) {
        setState({ phase: 'invalid' });
        return;
      }
      const rawData = (await res.json()) as ParentReportData;
      // Khắc phục lỗ hổng #073, #076: làm sạch mọi chỉ số tiến độ/điểm số khỏi NaN
      const cleanData = sanitizeReportData(rawData);
      setState({ phase: 'ready', data: cleanData, code: normalized });
      saveRecentCode(normalized);

      // Đọc lời nhắn động viên cũ (nếu có)
      try {
        const existingNote = localStorage.getItem(`sat_parent_note_${normalized}`);
        if (existingNote) {
          setEncouragementNote(existingNote);
        } else {
          setEncouragementNote('');
        }
      } catch {
        // Bỏ qua lỗi
      }
    } catch {
      setState({ phase: 'invalid' });
    }
  }, []);

  useEffect(() => {
    // Mount-fetch hợp lệ: đọc code từ URL (window chỉ có ở client) rồi tải báo cáo.
    // Đây KHÔNG phải derived-state (cần window.location + fetch async), nên setState
    // trong effect là đúng pattern fetch-on-mount, không gây cascading render thật.
    /* eslint-disable react-hooks/set-state-in-effect */
    const rawCode = new URLSearchParams(window.location.search).get('code');
    if (!rawCode || !rawCode.trim()) {
      setState({ phase: 'no_code' });
      return;
    }
    fetchReport(rawCode);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [fetchReport]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    fetchReport(manualCode);
  };

  const handleCopyCurrentLink = async () => {
    const success = await copyToClipboardSafe(window.location.href);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // #C055: Xuất phiếu báo cáo Zalo
  const handleCopyZaloReport = async () => {
    if (state.phase !== 'ready') return;
    const { data, code } = state;
    const total = data.prediction.total || 0;
    const math = data.prediction.math || 0;
    const reading = data.prediction.reading || 0;
    const streak = data.streak || 0;
    const attempts = data.prediction.totalAttempts || 0;
    const hours = ((attempts * 2.2) / 60).toFixed(1);
    const todayStr = new Date().toLocaleDateString('vi-VN');

    const topUniversity = TARGET_UNIVERSITIES.find((u) => total >= u.benchmark) || TARGET_UNIVERSITIES[0];
    const scholarship = getScholarshipEstimate(total);

    const zaloText = [
      `🎓 PHIẾU BÁO CÁO TIẾN ĐỘ SAT — GIA ĐÌNH ĐỒNG HÀNH`,
      `📅 Ngày cập nhật: ${todayStr}`,
      `👤 Mã học viên: ${code}`,
      `----------------------------------------`,
      `📊 ĐIỂM DỰ BÁO HIỆN TẠI: ${total}/1600`,
      `  • Toán học (Math): ${math}/800`,
      `  • Đọc - Viết (Reading & Writing): ${reading}/800`,
      `  • Độ tin cậy dự báo: ${data.prediction.confidence === 'high' ? 'Rất cao (Nhiều dữ liệu)' : 'Đang củng cố'}`,
      ``,
      `⏱️ THỜI LƯỢNG HỌC TẬP THỰC CHẤT:`,
      `  • Đã hoàn thành: ${attempts} câu hỏi SAT chuẩn hóa`,
      `  • Thời gian tập trung tích lũy: ~${hours} giờ thực học`,
      `  • Chuỗi ngày kiên trì: ${streak} ngày liên tiếp 🔥`,
      ``,
      `🎯 ĐỐI CHIẾU MỤC TIÊU ĐẠI HỌC:`,
      `  • Mức điểm hiện tại tiệm cận/đạt ngưỡng: ${topUniversity.name}`,
      `  • Đánh giá tiềm năng: ${scholarship.badge} — ${scholarship.tier}`,
      ``,
      `💡 LỜI NHẮN GIA SƯ AI:`,
      `  "Con đang duy trì nỗ lực rất tốt! Sự đồng hành và khích lệ từ gia đình là động lực to lớn nhất giúp con bứt phá."`,
      ``,
      `🔗 Xem bảng phân tích chi tiết: ${typeof window !== 'undefined' ? window.location.href : ''}`,
    ].join('\n');

    const ok = await copyToClipboardSafe(zaloText);
    if (ok) {
      setCopiedZalo(true);
      setTimeout(() => setCopiedZalo(false), 2500);
    }
  };

  // #C058: Lưu lời động viên của Phụ huynh
  const handleSaveEncouragement = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.phase !== 'ready' || !encouragementNote.trim()) return;
    try {
      localStorage.setItem(`sat_parent_note_${state.code}`, encouragementNote.trim());
      setSavedNoteSuccess(true);
      setTimeout(() => setSavedNoteSuccess(false), 3000);
    } catch {
      // Bỏ qua lỗi
    }
  };

  // #C059: Tính toán đợt thi gần nhất
  const nextExam = useMemo(() => {
    const now = new Date();
    for (const item of OFFICIAL_SAT_DATES) {
      const examDate = new Date(item.dateStr);
      if (examDate.getTime() > now.getTime()) {
        const diffDays = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { ...item, daysLeft: diffDays };
      }
    }
    return null;
  }, []);

  // #C052: Tính thời lượng tập trung thực chất
  const activeFocusMetrics = useMemo(() => {
    if (state.phase !== 'ready') return { questions: 0, hours: '0', paceText: 'Chưa có' };
    const attempts = state.data.prediction.totalAttempts || 0;
    const minutes = Math.round(attempts * 2.2);
    const hours = (minutes / 60).toFixed(1);
    let paceText = 'Cần tăng tốc độ luyện';
    if (attempts >= 150) paceText = 'Kỷ luật xuất sắc (Bứt phá nhanh)';
    else if (attempts >= 60) paceText = 'Duy trì đều đặn (Đúng tiến độ)';
    else if (attempts >= 20) paceText = 'Đang khởi động tích cực';
    return { questions: attempts, hours, paceText };
  }, [state]);

  // #C056 & #C057: 3 Điểm làm tốt nhất và 3 Trọng tâm tuần tới
  const learningHighlights = useMemo(() => {
    if (state.phase !== 'ready') return { strengths: [], focuses: [] };
    const { data } = state;
    const mathScore = data.prediction.math || 0;
    const readingScore = data.prediction.reading || 0;
    const streak = data.streak || 0;

    const strengths: string[] = [];
    if (mathScore >= 650) {
      strengths.push(`Tư duy Toán học vững vàng (Điểm Toán dự báo đạt ${mathScore}/800)`);
    } else if (mathScore > 0) {
      strengths.push(`Tiếp thu tốt các dạng bài Toán cơ bản và đồ thị`);
    }
    if (readingScore >= 600) {
      strengths.push(`Khả năng đọc hiểu ngữ cảnh học thuật tiến bộ rõ rệt (${readingScore}/800)`);
    } else if (readingScore > 0) {
      strengths.push(`Kiên trì rèn luyện vốn từ vựng và ngữ pháp tiếng Anh`);
    }
    if (streak >= 3) {
      strengths.push(`Duy trì chuỗi học liên tục ${streak} ngày — tính kỷ luật rất cao`);
    } else {
      strengths.push(`Chủ động hoàn thành các bài tập được giao trong tuần`);
    }

    const focuses: string[] = [];
    if (Array.isArray(data.prediction.focusSkills) && data.prediction.focusSkills.length > 0) {
      data.prediction.focusSkills.slice(0, 3).forEach((fs) => {
        focuses.push(`Ôn luyện chuyên sâu chủ điểm: ${fs.label}`);
      });
    }
    if (focuses.length < 3) {
      if (mathScore < 700) focuses.push('Củng cố phần Đại số nâng cao & Hình học lượng giác');
      if (readingScore < 700) focuses.push('Nâng cao tốc độ quét ý chính trong bài đọc Khoa học / Lịch sử');
      if (focuses.length < 3) focuses.push('Luyện tập dưới áp lực thời gian bấm giờ thực tế');
    }

    return { strengths: strengths.slice(0, 3), focuses: focuses.slice(0, 3) };
  }, [state]);

  return (
    <div className="min-h-screen bg-[#0e1117] px-4 py-8 print:bg-white print:py-2 print:px-0 text-slate-100 print:text-black">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="text-center space-y-2 print:hidden">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-3 py-1 rounded-full text-xs font-semibold">
            <span>🛡️ Cổng Giám Sát Học Tập Dành Cho Phụ Huynh Việt Nam</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">📈 Tiến độ học tập & Dự báo Đại học của con</h1>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            Hệ thống phân tích thông minh từ SAT Guru — Minh bạch tiến độ, đồng hành cùng tương lai con
          </p>

          {/* #C060: Thanh chuyển đổi nhanh mã học sinh đã xem gần đây */}
          {recentCodes.length > 0 && (
            <div className="pt-2 flex items-center justify-center flex-wrap gap-2 text-xs">
              <span className="text-gray-400">🕒 Mã đã xem gần đây:</span>
              {recentCodes.map((code) => (
                <button
                  key={code}
                  onClick={() => fetchReport(code)}
                  className="bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 hover:border-indigo-500/50 px-2.5 py-1 rounded-lg font-mono font-medium transition active:scale-95"
                >
                  {code}
                </button>
              ))}
            </div>
          )}
        </header>

        {state.phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20 bg-[#1b2533] rounded-2xl border border-slate-800">
            <div className="text-5xl animate-spin mb-4">⚙️</div>
            <p className="text-gray-300 font-medium">Đang tải và đồng bộ báo cáo học tập của con...</p>
            <p className="text-gray-500 text-xs mt-1">Đang đối chiếu dữ liệu với ngân hàng đề thi chuẩn College Board</p>
          </div>
        )}

        {state.phase === 'no_code' && (
          <div className="bg-[#1b2533] p-8 rounded-xl border border-[#334155] text-center space-y-4">
            <div className="text-5xl mb-2">🔗</div>
            <p className="text-gray-300 font-medium">Thiếu mã chia sẻ theo dõi học tập của con.</p>
            <p className="text-gray-400 text-sm">
              Hãy mở đúng đường link mà con bạn gửi (dạng <span className="text-indigo-300 font-mono">/parent?code=PH-...</span>) hoặc nhập mã xác nhận bên dưới.
            </p>
            
            {/* Hộp nhập mã thủ công dự phòng */}
            <form onSubmit={handleManualSubmit} className="max-w-md mx-auto flex gap-2 pt-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Nhập mã chia sẻ (VD: PH-A1B2C3)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono uppercase"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition shadow active:scale-95"
              >
                Xem báo cáo
              </button>
            </form>
          </div>
        )}

        {state.phase === 'invalid' && (
          <div className="bg-[#1b2533] p-8 rounded-xl border border-red-500/30 text-center space-y-4">
            <div className="text-5xl mb-2">🚫</div>
            <p className="text-gray-300 font-medium">Mã không tồn tại hoặc đã hết hạn.</p>
            <p className="text-gray-500 text-sm">Hãy đề nghị con tạo mã mới trong ứng dụng và gửi lại link, hoặc thử nhập lại mã chính xác bên dưới.</p>
            
            {/* Nhập lại mã chia sẻ */}
            <form onSubmit={handleManualSubmit} className="max-w-md mx-auto flex gap-2 pt-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Nhập lại mã (VD: PH-A1B2C3)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono uppercase"
              />
              <button
                type="submit"
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition shadow active:scale-95"
              >
                Thử lại
              </button>
            </form>
          </div>
        )}

        {state.phase === 'ready' && (
          <>
            {/* Thanh công cụ tương tác trên cùng */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#131d2a] p-3 rounded-xl border border-slate-800 print:hidden">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Mã học viên: <strong className="text-indigo-300 font-mono">{state.code}</strong></span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* #C055: Nút Xuất Phiếu Báo Cáo Tuần gửi Zalo Gia Đình */}
                <button
                  onClick={handleCopyZaloReport}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1.5 active:scale-95"
                  title="Sao chép nội dung tóm tắt để gửi vào nhóm Zalo gia đình"
                >
                  <span>{copiedZalo ? '✓ Đã chép bản Zalo!' : '📲 Xuất tin nhắn Zalo gia đình'}</span>
                </button>

                {/* Sao chép link xem */}
                <button
                  onClick={handleCopyCurrentLink}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
                >
                  <span>{copiedLink ? '✓ Đã sao chép link' : '📋 Sao chép link'}</span>
                </button>
              </div>
            </div>

            {/* #C059: Thông báo lịch thi SAT chính thức sắp tới */}
            {nextExam && (
              <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📅</span>
                    <h3 className="text-sm font-bold text-white">{nextExam.name}</h3>
                    <span className="bg-blue-500/20 text-blue-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-500/30">
                      Còn {nextExam.daysLeft} ngày
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Hạn đăng ký cuối cùng từ College Board: <strong className="text-amber-300">{nextExam.regDeadline}</strong>. Phụ huynh nên chuẩn bị thẻ thanh toán quốc tế (Visa/Mastercard) để hoàn tất thủ tục đúng hạn.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-indigo-300 font-mono bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700 inline-block">
                    Kỳ thi chuẩn hóa quốc tế
                  </span>
                </div>
              </div>
            )}

            {/* #C052: Thời lượng Tập trung Thực chất (Active Focus Verification) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#1b2533] p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                  <span>⏱️ Thời gian thực học tích lũy</span>
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  ~{activeFocusMetrics.hours} <span className="text-sm font-normal text-slate-400">giờ</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Ước tính từ các phiên giải bài hợp lệ (trung bình ~2.2 phút/câu SAT).
                </p>
              </div>

              <div className="bg-[#1b2533] p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                  <span>📝 Tổng câu hỏi đã giải</span>
                </div>
                <div className="text-2xl font-black text-indigo-400">
                  {activeFocusMetrics.questions} <span className="text-sm font-normal text-slate-400">câu</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Bao gồm cả Toán học, Đọc hiểu và Viết ngữ pháp học thuật.
                </p>
              </div>

              <div className="bg-[#1b2533] p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                  <span>🔥 Đánh giá tính kỷ luật</span>
                </div>
                <div className="text-sm font-bold text-amber-300 pt-1">
                  {activeFocusMetrics.paceText}
                </div>
                <p className="text-[11px] text-gray-400">
                  Chuỗi học: <strong className="text-white">{state.data.streak}</strong> ngày liên tục.
                </p>
              </div>
            </div>

            {/* #C054: Ước tính Giá trị Học bổng Tiềm năng (ROI Học tập) */}
            {(() => {
              const totalScore = state.data.prediction.total || 0;
              const sch = getScholarshipEstimate(totalScore);
              return (
                <div className={`p-5 rounded-2xl border bg-gradient-to-br ${sch.color} space-y-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💎</span>
                      <div>
                        <span className="text-xs uppercase tracking-wider font-bold opacity-80">Ước tính Giá trị Học bổng Tiềm năng (ROI Học tập)</span>
                        <h3 className="text-lg font-black text-white">{sch.tier}</h3>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-300 block">Ước tính quy đổi:</span>
                      <span className="text-xl font-black text-amber-300">{sch.value}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {sch.desc}
                  </p>
                </div>
              );
            })()}

            {/* #C053: Bảng Đối Chiếu Ngưỡng Xét Tuyển Đại Học Trọng Điểm */}
            <div className="bg-[#1b2533] p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>🎓 Đối Chiếu Ngưỡng Xét Tuyển Đại Học Hàng Đầu</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    So sánh điểm dự báo của con ({state.data.prediction.total || 0}/1600) với mức điểm chuẩn tham khảo tại các trường trọng điểm:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {TARGET_UNIVERSITIES.map((uni) => {
                  const currentScore = state.data.prediction.total || 0;
                  const isSafe = currentScore >= uni.benchmark;
                  const diff = uni.benchmark - currentScore;

                  return (
                    <div
                      key={uni.shortName}
                      className={`p-3.5 rounded-xl border text-xs transition ${
                        isSafe
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-white text-sm">{uni.name}</div>
                          <div className="text-slate-400 text-[11px] mt-0.5">{uni.category} • Ngưỡng SAT: <strong className="text-indigo-300">{uni.benchmark}+</strong></div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            isSafe
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isSafe ? '✓ Đạt ngưỡng an toàn' : `Cần +${diff} điểm`}
                        </span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between">
                        <span>Lợi thế: {uni.highlight}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* #C056 & #C057: Hộp 3 Điểm Con Làm Tốt Nhất & 3 Trọng Tâm Tuần Tới */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#1b2533] p-5 rounded-2xl border border-emerald-500/20 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌟</span>
                  <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wide">
                    3 Điểm Con Đang Làm Tốt Nhất
                  </h3>
                </div>
                <ul className="space-y-2 text-xs text-slate-200">
                  {learningHighlights.strengths.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#1b2533] p-5 rounded-2xl border border-indigo-500/20 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wide">
                    3 Trọng Tâm Cần Bứt Phá Tuần Tới
                  </h3>
                </div>
                <ul className="space-y-2 text-xs text-slate-200">
                  {learningHighlights.focuses.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-indigo-400 font-bold">👉</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* #C051: Hộp Giải thích Tiếng Việt dễ hiểu dành cho Phụ huynh */}
            <div className="bg-[#1b2533] rounded-2xl border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📘</span>
                  <h3 className="text-sm font-bold text-white">Giải thích Tiếng Việt dễ hiểu về bài thi SAT dành cho Phụ huynh</h3>
                </div>
                <button
                  onClick={() => setShowGlossary((prev) => !prev)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline"
                >
                  {showGlossary ? 'Thu gọn' : 'Xem chi tiết'}
                </button>
              </div>

              {showGlossary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs border-t border-slate-800">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
                    <strong className="text-indigo-300 block">📐 Thang điểm Toán (Math)</strong>
                    <p className="text-slate-400 leading-relaxed">
                      Điểm từ 200 đến 800. Đánh giá tư duy logic, giải quyết bài toán đại số, phân tích hàm số và hình học. Học sinh Việt Nam thường có thế mạnh đạt mốc 700 - 800 điểm.
                    </p>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
                    <strong className="text-purple-300 block">📖 Đọc & Viết (Reading & Writing)</strong>
                    <p className="text-slate-400 leading-relaxed">
                      Điểm từ 200 đến 800. Kiểm tra khả năng đọc hiểu văn bản học thuật (khoa học, văn học, lịch sử) và ngữ pháp chuẩn xác. Mốc 650+ là rất tốt cho học sinh THPT.
                    </p>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
                    <strong className="text-emerald-300 block">🏆 Tổng điểm (Total: 400 - 1600)</strong>
                    <p className="text-slate-400 leading-relaxed">
                      1200+ tương đương IELTS 6.5 - 7.0; 1350+ mở ra cơ hội tuyển thẳng Đại học top đầu Việt Nam; 1450+ mở ra các gói học bổng quốc tế danh giá.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Báo cáo phân tích chuyên sâu hiện hữu */}
            <ParentReport data={state.data} />

            {/* #C058: Gửi Lời Động Viên Cho Con */}
            <div className="bg-[#1b2533] p-5 rounded-2xl border border-rose-500/20 space-y-3 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💌</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Gửi Lời Động Viên Tiếp Sức Cho Con</h3>
                  <p className="text-xs text-gray-400">Lời nhắn của Bố Mẹ sẽ được hiển thị khi con mở ứng dụng luyện thi SAT.</p>
                </div>
              </div>

              <form onSubmit={handleSaveEncouragement} className="space-y-3">
                <textarea
                  rows={2}
                  value={encouragementNote}
                  onChange={(e) => setEncouragementNote(e.target.value)}
                  placeholder="Ví dụ: Bố mẹ rất tự hào về nỗ lực tuần này của con. Cố gắng giữ sức khỏe và tự tin lên nhé con yêu!"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-400 font-medium">
                    {savedNoteSuccess && '✓ Đã lưu lời động viên! Lời nhắn sẽ truyền đến con trong phiên học kế tiếp.'}
                  </span>
                  <button
                    type="submit"
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow active:scale-95"
                  >
                    Gửi lời chúc cho con
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        <footer className="text-center text-xs text-gray-500 pt-4 pb-8 space-y-1 print:hidden">
          <p>Chế độ xem bảo mật dành riêng cho Gia đình học viên. Dữ liệu tự động cập nhật theo tiến trình học tập của con.</p>
          <p>© SAT Guru 2026 — Nền tảng Luyện thi SAT Cá nhân hóa số 1 Việt Nam</p>
        </footer>
      </div>
    </div>
  );
}
