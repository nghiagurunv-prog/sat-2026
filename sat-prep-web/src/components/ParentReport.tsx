'use client';

/**
 * PARENT REPORT — render read-only tiến độ con cho phụ huynh (Hướng A mã chia sẻ).
 * Tái dụng radar SVG 5 domain (như dashboard học sinh) + WeeklyTrendPanel chung.
 * Nhận data từ /api/parent/report (không cần login).
 */

import { useState, useEffect, useMemo } from 'react';
import { WeeklyTrendPanel, type WeeklyTrend } from './WeeklyTrendPanel';

export interface ParentReportData {
  prediction: {
    math: number;
    reading: number;
    total: number;
    confidence: 'low' | 'medium' | 'high';
    totalAttempts: number;
    targetScore: number | null;
    pointsToTarget: number | null;
    focusSkills: Array<{ id: string; label: string; score: number; subject: string }>;
  };
  mastery: {
    overall: number;
    bySubject: { math: number; reading: number };
    domains: Array<{ domainId: string; domainLabel: string; score: number }>;
  };
  streak: number;
  weeklyTrend: WeeklyTrend;
  recentTests: Array<{ module: string; subject: string; correct: number; total: number; score: number; when: number }>;
  /** Optional (backward-compat) — gói của con quyết định độ sâu báo cáo. */
  studentTier?: 'free' | 'premium' | 'ultimate';
  /** Optional — số ngày cửa sổ xu hướng (7/30/90). */
  trendWindowDays?: number;
  /** Optional — "tốc độ cải thiện" thuần (mọi tier có >=2 snapshot). */
  improvement?: { deltaOverall: number; deltaPredicted: number; windowDays: number } | null;
}

const RADAR_AXES: { domainId: string; label: string; color: string; angle: number }[] = [
  { domainId: 'algebra', label: 'Đại số', color: 'text-blue-400', angle: 90 },
  { domainId: 'advanced_math', label: 'Nâng cao', color: 'text-emerald-400', angle: 18 },
  { domainId: 'data_analysis', label: 'Số liệu', color: 'text-yellow-400', angle: 306 },
  { domainId: 'geometry', label: 'Hình học', color: 'text-purple-400', angle: 234 },
  { domainId: 'reading_writing', label: 'Đọc & Viết', color: 'text-red-400', angle: 162 },
];

const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'Tham khảo (con cần luyện thêm để chính xác hơn)',
  medium: 'Khá tin cậy',
  high: 'Tin cậy cao',
};

/**
 * Point 77: Dữ liệu Ngưỡng Điểm Tham Khảo Xét Tuyển Đại Học Top Đầu Việt Nam
 * (FTU, NEU, HUST, VNU ĐHQG, DAV) theo phương thức kết hợp chứng chỉ quốc tế SAT.
 */
interface UniBenchmark {
  id: string;
  name: string;
  shortName: string;
  badge: string;
  topMajors: string;
  minScore: number;
  safeScore: number;
  description: string;
}

const VN_UNI_BENCHMARKS: UniBenchmark[] = [
  {
    id: 'ftu',
    name: 'Đại học Ngoại thương',
    shortName: 'FTU',
    badge: '🏛️ Ngoại Thương',
    topMajors: 'Kinh tế đối ngoại, Tài chính quốc tế, CLC & Tiên tiến',
    minScore: 1300,
    safeScore: 1380,
    description: 'Phương thức xét tuyển kết hợp chứng chỉ quốc tế SAT từ 1300+, các ngành Kinh tế đối ngoại thường cần từ 1380+ để an toàn.',
  },
  {
    id: 'neu',
    name: 'Đại học Kinh tế Quốc dân',
    shortName: 'NEU',
    badge: '📊 Kinh Tế Quốc Dân',
    topMajors: 'Logistics, Kinh doanh quốc tế, Phân tích kinh doanh, Tài chính',
    minScore: 1250,
    safeScore: 1340,
    description: 'Xét tuyển kết hợp SAT từ 1200+, ngành hot như Logistics & KDQT đạt điểm an toàn khi đạt từ 1340+.',
  },
  {
    id: 'hust',
    name: 'Đại học Bách Khoa Hà Nội',
    shortName: 'HUST',
    badge: '⚙️ Bách Khoa',
    topMajors: 'Khoa học máy tính (IT1, IT2), Tự động hóa, Vi mạch bán dẫn',
    minScore: 1300,
    safeScore: 1420,
    description: 'Xét tuyển tài năng chứng chỉ SAT từ 1300+; nhóm CNTT IT1/IT2 có tính cạnh tranh rất cao, khuyến nghị 1420-1450+.',
  },
  {
    id: 'vnu',
    name: 'Đại học Quốc gia Hà Nội',
    shortName: 'VNU ĐHQG',
    badge: '🎓 ĐHQG Hà Nội',
    topMajors: 'ĐH Công nghệ (UET CNTT), ĐH Kinh tế (UEB), ĐH Ngoại ngữ (ULIS)',
    minScore: 1200,
    safeScore: 1330,
    description: 'Ngưỡng nộp hồ sơ từ 1200+; nhóm ngành CNTT tại ĐH Công nghệ (UET) khuyến nghị từ 1330-1380+.',
  },
  {
    id: 'dav',
    name: 'Học viện Ngoại giao',
    shortName: 'DAV',
    badge: '🌐 Ngoại Giao',
    topMajors: 'Quan hệ quốc tế, Truyền thông quốc tế, Luật quốc tế',
    minScore: 1250,
    safeScore: 1350,
    description: 'Xét tuyển kết hợp chứng chỉ quốc tế SAT với điểm học bạ, các ngành Truyền thông & Quan hệ quốc tế khuyến nghị từ 1350+.',
  },
];

/**
 * Sao chép text vào clipboard an toàn, có fallback khi browser chặn Permissions API
 * hoặc khi chạy trong WebView / iFrame không hỗ trợ navigator.clipboard.
 */
async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback qua textarea bên dưới
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
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

export function ParentReport({ data }: { data: ParentReportData }) {
  const { prediction, mastery, streak, weeklyTrend, recentTests } = data;

  // Lớp phòng hộ chống NaN% / Infinity khi học sinh mới chưa có dữ liệu (#026, #073)
  const safeMath = typeof prediction?.math === 'number' && Number.isFinite(prediction.math) ? prediction.math : 0;
  const safeReading = typeof prediction?.reading === 'number' && Number.isFinite(prediction.reading) ? prediction.reading : 0;
  const safeTotal = typeof prediction?.total === 'number' && Number.isFinite(prediction.total) ? prediction.total : safeMath + safeReading;
  const safeAttempts = typeof prediction?.totalAttempts === 'number' && Number.isFinite(prediction.totalAttempts) ? Math.max(0, prediction.totalAttempts) : 0;
  const safeStreak = typeof streak === 'number' && Number.isFinite(streak) ? Math.max(0, streak) : 0;
  const safeScoreDelta = typeof weeklyTrend?.scoreDelta === 'number' && Number.isFinite(weeklyTrend.scoreDelta) ? weeklyTrend.scoreDelta : 0;
  const hasData = safeAttempts > 0;

  // Fallback an toàn nếu API cũ chưa trả field (backward-compat).
  const studentTier = data.studentTier ?? 'free';
  const trendWindowDays = data.trendWindowDays ?? 7;
  const isFreeStudent = studentTier === 'free';
  const improvement = data.improvement ?? null;

  // Point 79: Trạng thái sao chép Zalo & URL hiện tại
  const [copiedZalo, setCopiedZalo] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [studentCode, setStudentCode] = useState('PH-SAT2026');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
      const urlCode = new URLSearchParams(window.location.search).get('code');
      if (urlCode) {
        setStudentCode(urlCode.toUpperCase());
      } else {
        // Đồng bộ mã chia sẻ phụ huynh server-side qua /api/parent-share (fallback local an toàn nếu offline)
        (async () => {
          try {
            const res = await fetch('/api/parent-share');
            if (res.ok) {
              const resData = await res.json();
              const serverCode = resData?.shareCode || resData?.code;
              if (serverCode && typeof serverCode === 'string') {
                const cleanCode = serverCode.toUpperCase();
                setStudentCode(cleanCode);
                const current = new URL(window.location.href);
                current.searchParams.set('code', cleanCode);
                setCurrentUrl(current.toString());
              }
            }
          } catch {
            // Fallback an toàn nếu offline / không có session
          }
        })();
      }
    }
  }, []);

  // Point 78: Tạo văn bản lời khuyên tiếng Việt đời thường cho bố mẹ
  const adviceItems = useMemo(() => {
    const list: { icon: string; title: string; desc: string; type: 'strength' | 'weakness' | 'routine' | 'health' }[] = [];

    if (!hasData) {
      list.push({
        icon: '🌱',
        title: 'Bắt đầu hành trình chinh phục SAT',
        desc: 'Con mới tham gia và chưa có đủ dữ liệu làm bài thi. Bố mẹ hãy đồng hành, động viên con hoàn thành bài Mini Test đầu tiên (khoảng 15 phút) để hệ thống AI đo lường năng lực chính xác nhất!',
        type: 'routine',
      });
      return list;
    }

    // Nhận định Toán vs Đọc Viết
    if (safeMath >= safeReading + 60) {
      list.push({
        icon: '📐',
        title: 'Toán là thế mạnh vượt trội của con',
        desc: `Con làm rất tốt phần Toán (${safeMath}/800 điểm). Bố mẹ hãy khen ngợi con, đồng thời nhẹ nhàng nhắc con dành thêm 20-25 phút mỗi ngày cho phần Đọc & Viết để điểm số bứt phá đều cả hai môn.`,
        type: 'strength',
      });
    } else if (safeReading >= safeMath + 60) {
      list.push({
        icon: '📖',
        title: 'Tư duy đọc hiểu và vốn tiếng Anh của con rất sáng',
        desc: `Con có điểm Đọc & Viết ấn tượng (${safeReading}/800 điểm). Với môn Toán (${safeMath}/800), con chỉ cần củng cố thêm các dạng Đại số và Hình học là sẽ đạt mốc điểm mơ ước.`,
        type: 'strength',
      });
    } else {
      list.push({
        icon: '⚖️',
        title: 'Con đang phát triển đồng đều cả Toán và Đọc - Viết',
        desc: `Điểm Toán (${safeMath}) và Đọc & Viết (${safeReading}) của con rất cân bằng. Đây là lợi thế lớn giúp con giữ tâm lý ổn định khi thi thật.`,
        type: 'strength',
      });
    }

    // Phân tích kỹ năng yếu nhất (focus skills) dịch sang tiếng Việt đời thường
    if (prediction?.focusSkills && prediction.focusSkills.length > 0) {
      const topWeak = prediction.focusSkills[0];
      let simpleExplanation = `Nhắc con ôn lại 15 phút/ngày phần "${topWeak.label}" trên ứng dụng.`;
      if (topWeak.label.toLowerCase().includes('đại số') || topWeak.id.includes('algebra')) {
        simpleExplanation = 'Tuần này con làm rất tốt phần Đại số, nhưng cần nhắc con giải lại 5-10 phương trình mẫu trên app mỗi ngày để tránh sai sót vặt.';
      } else if (topWeak.label.toLowerCase().includes('dấu câu') || topWeak.id.includes('grammar') || topWeak.id.includes('punctuation') || topWeak.subject.includes('reading')) {
        simpleExplanation = 'Cần nhắc con ôn lại 15 phút/ngày phần Dấu câu tiếng Anh và quy tắc ngữ pháp câu ghép trước khi đi ngủ.';
      } else if (topWeak.label.toLowerCase().includes('hình học') || topWeak.id.includes('geometry')) {
        simpleExplanation = 'Khuyên con khi làm phần Hình học nên vẽ nháp hình ra giấy để không bị bẫy tỉ lệ và góc.';
      } else if (topWeak.label.toLowerCase().includes('số liệu') || topWeak.id.includes('data')) {
        simpleExplanation = 'Nhắc con đọc kỹ biểu đồ và trục số liệu trong bài thi, tránh nhìn vội bảng số liệu.';
      }

      list.push({
        icon: '🎯',
        title: `Hành động cụ thể: Củng cố "${topWeak.label}"`,
        desc: `${simpleExplanation} Không cần học dồn nhiều giờ, chỉ cần 15-20 phút bền bỉ mỗi ngày là con tiến bộ rõ rệt.`,
        type: 'weakness',
      });
    }

    // Nhắc nhở sinh hoạt & giấc ngủ (Point 78)
    list.push({
      icon: '🌙',
      title: 'Giấc ngủ vàng: Đi ngủ trước 23h',
      desc: 'SAT là kỳ thi kiểm tra sự tỉnh táo và tư duy phản xạ trong hơn 2 giờ. Bố mẹ hãy nhắc con đi ngủ trước 23h, tuyệt đối không thức khuya cày đề sát ngày thi thử để giữ bộ não luôn sắc bén nhất.',
      type: 'health',
    });

    // Nhắc nhở chuỗi học và tinh thần
    list.push({
      icon: '🔥',
      title: `Chuỗi ${safeStreak} ngày học liên tục: Động viên kịp thời`,
      desc: safeStreak >= 3
        ? `Con đang duy trì thói quen học tập rất đáng khen (${safeStreak} ngày liên tục). Một lời động viên và một bữa sáng đủ chất từ bố mẹ là liều thuốc tinh thần tốt nhất cho con!`
        : 'Hãy rủ con dành ra 15 phút vào khung giờ cố định mỗi tối (ví dụ 20h00) để thiết lập chuỗi ngày học đều đặn.',
      type: 'routine',
    });

    return list;
  }, [hasData, prediction, safeMath, safeReading, safeStreak]);

  // Point 79: Xử lý sao chép Zalo
  const handleCopyZalo = async () => {
    const today = new Date().toLocaleDateString('vi-VN');
    const ftu = VN_UNI_BENCHMARKS[0];
    const neu = VN_UNI_BENCHMARKS[1];
    const hust = VN_UNI_BENCHMARKS[2];

    const formatUniStatus = (b: UniBenchmark) => {
      const predTotal = safeTotal;
      if (predTotal >= b.safeScore) return `✅ Đạt vùng an toàn (+${predTotal - b.safeScore}đ)`;
      if (predTotal >= b.minScore) return `🟡 Đạt ngưỡng xét tuyển (còn thiếu ${b.safeScore - predTotal}đ tới vùng an toàn)`;
      return `🎯 Cần tích lũy thêm +${Math.max(0, b.minScore - predTotal)}đ`;
    };

    const text = `📱 BÁO CÁO TIẾN ĐỘ HỌC SAT CỦA CON (IVY LEAGUE MATH ACADEMY)
📅 Cập nhật ngày: ${today}
--------------------------------------------------
📈 Điểm SAT dự đoán: ${hasData ? `${safeTotal}/1600` : 'Đang cập nhật'}
   • Toán: ${hasData ? `${safeMath}/800` : '—'}
   • Đọc & Viết: ${hasData ? `${safeReading}/800` : '—'}
🔥 Chuỗi ngày học liên tục: ${safeStreak} ngày
🎯 Tổng số câu đã luyện: ${safeAttempts} câu
📊 Xu hướng ${trendWindowDays} ngày qua: ${safeScoreDelta >= 0 ? '+' : ''}${safeScoreDelta} điểm

🏫 ĐỐI CHIẾU XÉT TUYỂN ĐẠI HỌC TOP ĐẦU VIỆT NAM:
• FTU Ngoại Thương: ${formatUniStatus(ftu)}
• NEU Kinh Tế Quốc Dân: ${formatUniStatus(neu)}
• HUST Bách Khoa: ${formatUniStatus(hust)}

💡 LỜI KHUYÊN CHO BỐ MẸ TUẦN NÀY:
${adviceItems.map((a) => `• ${a.title}: ${a.desc}`).join('\n')}

🔗 Bố mẹ xem biểu đồ chi tiết của con tại:
${currentUrl || 'https://sat.nghiaguru.com/parent'}
--------------------------------------------------
Gia đình cùng đồng hành giúp con tự tin bứt phá điểm số! ❤️`;

    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedZalo(true);
      setTimeout(() => setCopiedZalo(false), 2500);
    }
  };

  // Sao chép liên kết chia sẻ trực tiếp cho phụ huynh
  const handleCopyLink = async () => {
    const shareUrl = currentUrl || (typeof window !== 'undefined' ? `${window.location.origin}/parent?code=${studentCode}` : '');
    const success = await copyTextToClipboard(shareUrl);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Point 79: Xử lý in PDF
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Radar geometry (giống dashboard học sinh).
  const size = 200;
  const center = size / 2;
  const radius = size / 2 - 20;
  const getPoint = (value: number, angle: number) => {
    const safeVal = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    const rad = (Math.PI / 180) * angle;
    const x = center + ((radius * safeVal) / 100) * Math.cos(rad);
    const y = center - ((radius * safeVal) / 100) * Math.sin(rad);
    const safeX = Number.isFinite(x) ? x : center;
    const safeY = Number.isFinite(y) ? y : center;
    return `${safeX.toFixed(1)},${safeY.toFixed(1)}`;
  };
  const domainScore = (domainId: string) => {
    const d = mastery?.domains?.find((item) => item.domainId === domainId);
    const raw = d?.score;
    return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
  };
  const axisValues = RADAR_AXES.map((ax) => ({ ...ax, value: domainScore(ax.domainId) }));
  const points = axisValues.map((a) => getPoint(a.value, a.angle)).join(' ');
  const gridPolygons = [20, 40, 60, 80, 100].map((val) => RADAR_AXES.map((ax) => getPoint(val, ax.angle)).join(' '));

  return (
    <div className="space-y-6">
      {/* Point 79: Thanh công cụ Sao chép Zalo & In PDF */}
      <div className="bg-[#1b2533] p-4 rounded-xl border border-[#334155] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xl shrink-0">
            👨‍👩‍👧
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Báo Cáo Tiến Độ Gia Đình</h4>
            <p className="text-xs text-gray-400">Chia sẻ tóm tắt cho nhóm Zalo gia đình hoặc in lưu hồ sơ</p>
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={handleCopyZalo}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow transition-all active:scale-95"
            title="Sao chép văn bản báo cáo chuẩn định dạng Zalo"
          >
            {copiedZalo ? '✅ Đã sao chép tin nhắn Zalo!' : '📱 Sao chép Báo cáo Tuần gửi Zalo'}
          </button>
          <button
            onClick={handleCopyLink}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3.5 py-2.5 rounded-lg border border-slate-600 transition-all active:scale-95"
            title="Sao chép link xem trực tiếp báo cáo phụ huynh"
          >
            {copiedLink ? '✅ Đã chép link!' : '🔗 Sao chép Link'}
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-lg border border-slate-600 transition-all active:scale-95"
            title="In báo cáo hoặc lưu dưới dạng PDF"
          >
            🖨️ In PDF
          </button>
        </div>
      </div>

      {/* KHUNG TÀI TRỢ GÓI HỌC VIP CHO CON (QUÉT VIETQR 1 CHẠM - KHÔNG CẦN ĐĂNG NHẬP) & ĐẶT THƯỞNG ĐỘNG VIÊN */}
      <ParentVietQRSponsorAndReward
        studentCode={studentCode}
        isFreeStudent={isFreeStudent}
        trendWindowDays={trendWindowDays}
      />

      {/* Hàng chỉ số chính */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="📈" value={hasData ? String(safeTotal) : '—'} label="Điểm SAT dự đoán" />
        <StatCard icon="🔥" value={`${safeStreak}`} label="Chuỗi ngày học" />
        <StatCard icon="🎯" value={String(safeAttempts)} label="Tổng câu đã luyện" />
        <StatCard
          icon={safeScoreDelta >= 0 ? '⬆️' : '⬇️'}
          value={`${safeScoreDelta >= 0 ? '+' : ''}${safeScoreDelta}`}
          label={`Điểm thay đổi ${trendWindowDays} ngày`}
        />
      </div>

      {/* Tốc độ cải thiện (thuần — mọi tier có >=2 snapshot trong cửa sổ) */}
      {improvement && (
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730]">
          <h3 className="text-lg font-bold text-white mb-3">🚀 Tốc độ cải thiện ({Number.isFinite(improvement.windowDays) ? improvement.windowDays : trendWindowDays} ngày)</h3>
          <div className="flex gap-8 flex-wrap">
            <div>
              <div className={`text-2xl font-bold ${(Number.isFinite(improvement.deltaPredicted) ? improvement.deltaPredicted : 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {Number.isFinite(improvement.deltaPredicted) ? `${improvement.deltaPredicted >= 0 ? '+' : ''}${improvement.deltaPredicted}` : '0'}
              </div>
              <div className="text-xs text-gray-400">Điểm SAT dự đoán</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${(Number.isFinite(improvement.deltaOverall) ? improvement.deltaOverall : 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {Number.isFinite(improvement.deltaOverall) ? `${improvement.deltaOverall >= 0 ? '+' : ''}${improvement.deltaOverall}` : '0'}
              </div>
              <div className="text-xs text-gray-400">Năng lực tổng (0-100)</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">So sánh mốc đầu và cuối trong cửa sổ {Number.isFinite(improvement.windowDays) ? improvement.windowDays : trendWindowDays} ngày — càng dương càng tiến bộ.</p>
        </div>
      )}

      {/* 🧠 Nhận xét từ Mentor AI — CHỈ gói Ultimate; tự ẩn nếu chưa có nhận xét. */}
      {studentTier === 'ultimate' && <MentorAiPanel />}

      {/* Chi tiết điểm */}
      <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730]">
        <h3 className="text-lg font-bold text-white mb-3">🎓 Dự đoán điểm SAT của con</h3>
        {hasData ? (
          <>
            <div className="flex gap-6 flex-wrap">
              <div><div className="text-2xl font-bold text-blue-400">{safeMath}</div><div className="text-xs text-gray-400">Toán (200-800)</div></div>
              <div><div className="text-2xl font-bold text-emerald-400">{safeReading}</div><div className="text-xs text-gray-400">Đọc & Viết (200-800)</div></div>
              {prediction?.targetScore !== null && typeof prediction?.targetScore === 'number' && Number.isFinite(prediction.targetScore) && (
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{prediction.targetScore}</div>
                  <div className="text-xs text-gray-400">
                    Mục tiêu (còn {typeof prediction.pointsToTarget === 'number' && Number.isFinite(prediction.pointsToTarget) ? Math.max(0, prediction.pointsToTarget) : Math.max(0, prediction.targetScore - safeTotal)})
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-3">Độ tin cậy: {CONFIDENCE_LABEL[prediction?.confidence ?? 'low']} — ước lượng động viên, không phải điểm chính thức.</p>
          </>
        ) : (
          <p className="text-gray-500 text-sm">Con chưa luyện đủ để dự đoán điểm. Hãy động viên con luyện tập mỗi ngày!</p>
        )}
      </div>

      {/* Point 77: Bảng Đối chiếu Ngưỡng Điểm Xét tuyển Đại học Top đầu Việt Nam cho Phụ huynh */}
      <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#334155] pb-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🏛️ Đối chiếu Ngưỡng Điểm Đại Học Top Đầu Việt Nam</span>
              <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                FTU · NEU · HUST · VNU · DAV
              </span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              So sánh điểm dự đoán hiện tại của con ({hasData ? `${safeTotal}/1600` : 'chưa có dữ liệu'}) với chuẩn xét tuyển kết hợp chứng chỉ SAT năm 2024–2025
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {VN_UNI_BENCHMARKS.map((uni) => {
            const predTotal = safeTotal;
            const isSafe = predTotal >= uni.safeScore;
            const isQualified = predTotal >= uni.minScore;
            const deltaSafe = predTotal - uni.safeScore;
            const deltaMin = predTotal - uni.minScore;
            const safeScoreVal = typeof uni.safeScore === 'number' && Number.isFinite(uni.safeScore) && uni.safeScore > 0 ? uni.safeScore : 1600;
            const rawPercent = safeScoreVal > 0 ? (predTotal / safeScoreVal) * 100 : 0;
            const percent = Number.isFinite(rawPercent) ? Math.min(100, Math.max(15, Math.round(rawPercent))) : 0;

            return (
              <div key={uni.id} className="bg-[#0f172a] p-4 rounded-xl border border-[#262730] space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl shrink-0">{uni.badge.slice(0, 2)}</span>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {uni.name} ({uni.shortName})
                      </h4>
                      <p className="text-xs text-gray-400">{uni.topMajors}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {hasData ? (
                      isSafe ? (
                        <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 rounded-full flex items-center gap-1">
                          ✅ Vùng an toàn ({deltaSafe >= 0 ? `+${deltaSafe}` : ''}đ)
                        </span>
                      ) : isQualified ? (
                        <span className="text-xs font-bold text-yellow-300 bg-yellow-500/20 border border-yellow-500/40 px-2.5 py-1 rounded-full flex items-center gap-1">
                          🟡 Đạt ngưỡng sàn (còn {Math.max(0, uni.safeScore - predTotal)}đ tới vùng an toàn)
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-sky-300 bg-sky-500/20 border border-sky-500/40 px-2.5 py-1 rounded-full flex items-center gap-1">
                          🎯 Cần +{Math.max(0, uni.minScore - predTotal)}đ để đạt sàn
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-gray-500">Cần làm thêm bài thi</span>
                    )}
                  </div>
                </div>

                {/* Thanh so sánh trực quan */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span>Sàn xét tuyển: <strong className="text-white">{uni.minScore}đ</strong></span>
                    <span>Điểm an toàn ngành hot: <strong className="text-amber-300">{uni.safeScore}đ</strong></span>
                  </div>
                  <div className="w-full bg-[#1e293b] h-2.5 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isSafe
                          ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                          : isQualified
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                          : 'bg-gradient-to-r from-blue-500 to-sky-400'
                      }`}
                      style={{ width: `${hasData && Number.isFinite(percent) ? percent : 0}%` }}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 italic">{uni.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Point 78: Tư vấn Hành động bằng Tiếng Việt Đời thường cho Phụ huynh */}
      <div className="bg-gradient-to-br from-[#1e293b] via-[#1b2533] to-[#0f172a] p-6 rounded-xl border border-amber-500/30 space-y-4">
        <div className="border-b border-amber-500/20 pb-3">
          <h3 className="text-lg font-bold text-amber-300 flex items-center gap-2">
            <span>💡 Lời Khuyên Hành Động Dành Riêng Cho Bố Mẹ</span>
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-200 border border-amber-500/40 px-2 py-0.5 rounded-full">
              Tiếng Việt Đời Thường
            </span>
          </h3>
          <p className="text-xs text-gray-300 mt-1">
            Chuyển hóa số liệu kỹ thuật SAT thành các việc cụ thể, gần gũi bố mẹ có thể làm ngay tại nhà để cùng con về đích
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {adviceItems.map((item, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition-all ${
                item.type === 'weakness'
                  ? 'bg-amber-950/20 border-amber-500/40'
                  : item.type === 'health'
                  ? 'bg-indigo-950/20 border-indigo-500/40'
                  : item.type === 'strength'
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-[#0f172a] border-[#334155]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 mt-0.5">{item.icon}</span>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">{item.title}</h4>
                  <p className="text-xs leading-relaxed text-gray-300">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Radar năng lực */}
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center">
          <h3 className="text-lg font-bold text-white mb-6">Biểu đồ năng lực</h3>
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="overflow-visible">
              {gridPolygons.map((pts, i) => (<polygon key={i} points={pts} fill="none" stroke="#334155" strokeWidth="1" />))}
              {RADAR_AXES.map((ax, i) => (<line key={i} x1={center} y1={center} x2={getPoint(100, ax.angle).split(',')[0]} y2={getPoint(100, ax.angle).split(',')[1]} stroke="#334155" strokeWidth="1" />))}
              <polygon points={points} fill="rgba(16, 185, 129, 0.4)" stroke="#10b981" strokeWidth="2" />
              {points.split(' ').map((pt, i) => (<circle key={i} cx={pt.split(',')[0]} cy={pt.split(',')[1]} r="4" fill="#34d399" />))}
            </svg>
            <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-xs font-bold text-blue-400">{axisValues[0].label} ({axisValues[0].value})</div>
            <div className="absolute top-[30%] right-[-45px] text-xs font-bold text-emerald-400">{axisValues[1].label} ({axisValues[1].value})</div>
            <div className="absolute bottom-[-15px] right-[-10px] text-xs font-bold text-yellow-400">{axisValues[2].label} ({axisValues[2].value})</div>
            <div className="absolute bottom-[-15px] left-[-15px] text-xs font-bold text-purple-400">{axisValues[3].label} ({axisValues[3].value})</div>
            <div className="absolute top-[30%] left-[-45px] text-xs font-bold text-red-400">{axisValues[4].label} ({axisValues[4].value})</div>
          </div>
        </div>

        {/* Xu hướng tuần + skill yếu */}
        <div className="space-y-6">
          <WeeklyTrendPanel trend={weeklyTrend} />

          <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730]">
            <h3 className="text-lg font-bold text-white mb-3">Kỹ năng con cần tập trung</h3>
            {prediction.focusSkills.length > 0 && hasData ? (
              <ul className="space-y-2">
                {prediction.focusSkills.map((s) => (
                  <li key={s.id} className="flex justify-between items-center text-sm border-b border-[#334155] pb-2 last:border-0">
                    <span className="text-gray-200 pr-2">{s.label}</span>
                    <span className="text-red-400 whitespace-nowrap">{s.score}/100</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">Chưa đủ dữ liệu.</p>
            )}
          </div>
        </div>
      </div>

      {/* Lịch sử thi gần đây */}
      {recentTests.length > 0 && (
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730]">
          <h3 className="text-lg font-bold text-white mb-3">📝 Bài thi gần đây</h3>
          <ul className="space-y-2">
            {recentTests.map((t, i) => (
              <li key={i} className="flex justify-between items-center text-sm border-b border-[#334155] pb-2 last:border-0">
                <span className="text-gray-200">{t.module} <span className="text-gray-500">({t.subject})</span></span>
                <span className="text-emerald-400">{t.correct}/{t.total} đúng</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="bg-[#1b2533] p-4 rounded-xl border border-[#262730] flex flex-col items-center justify-center text-center">
      <div className="text-3xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-gray-400 text-xs">{label}</div>
    </div>
  );
}

/**
 * Khối "Nhận xét từ Mentor AI" (chỉ render khi con dùng gói Ultimate).
 * Đọc mã chia sẻ từ URL (?code=PH-...) — cùng nguồn với /parent — rồi fetch
 * /api/mentor-comment. Nhận xét được server CACHE theo ngày (1 lần gọi OpenAI/
 * học sinh/ngày). comment=null (fail-safe: OpenAI chặn VN / hết ngân sách / lỗi)
 * → ẩn khối IM LẶNG, không làm vỡ phần số liệu của báo cáo.
 */
function MentorAiPanel() {
  const [phase, setPhase] = useState<'loading' | 'hidden' | 'ready'>('loading');
  const [comment, setComment] = useState('');

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      setPhase('hidden');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/mentor-comment?code=${encodeURIComponent(code)}`);
        if (!res.ok) {
          setPhase('hidden');
          return;
        }
        const json = (await res.json()) as { comment?: string | null };
        if (json.comment) {
          setComment(json.comment);
          setPhase('ready');
        } else {
          setPhase('hidden');
        }
      } catch {
        setPhase('hidden');
      }
    })();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (phase === 'hidden') return null;

  return (
    <div className="bg-gradient-to-br from-[#1e293b] to-[#312e81] p-6 rounded-xl border border-[#6366f1]">
      <h3 className="text-lg font-bold text-white mb-3">🧠 Nhận xét từ Mentor AI</h3>
      {phase === 'loading' ? (
        <div className="flex items-center gap-2 text-indigo-200 text-sm">
          <span className="animate-spin">⚙️</span> Đang tạo nhận xét cho con...
        </div>
      ) : (
        <p className="text-sm text-indigo-100 whitespace-pre-line leading-relaxed">{comment}</p>
      )}
    </div>
  );
}

interface SponsorPlan {
  id: '45d' | '3m' | '1y';
  title: string;
  badge: string;
  badgeColor: string;
  price: number;
  priceDisplay: string;
  originalPrice: string;
  savePercent: string;
  codeSuffix: string;
  features: string[];
}

const SPONSOR_PLANS: SponsorPlan[] = [
  {
    id: '45d',
    title: 'Gói Nước Rút 45 Ngày',
    badge: 'Cấp Tốc Thi Thật',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    price: 699000,
    priceDisplay: '699.000đ',
    originalPrice: '990.000đ',
    savePercent: 'Tiết kiệm 30%',
    codeSuffix: '45D',
    features: [
      '20+ Đề thi thử Mock Test chuẩn Bluebook 2026',
      'AI giải chi tiết từng bước & chỉ rõ bẫy College Board',
      'Phân tích hổng kiến thức thần tốc trong 48 giờ',
    ],
  },
  {
    id: '3m',
    title: 'Gói 3 Tháng Toàn Diện',
    badge: 'Khuyên Dùng • Bứt Phá 150-250đ',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    price: 1350000,
    priceDisplay: '1.350.000đ',
    originalPrice: '2.100.000đ',
    savePercent: 'Tiết kiệm 35%',
    codeSuffix: '3M',
    features: [
      'Toàn bộ tính năng gói 45 ngày + Đề mới hàng tuần',
      'AI Mentor kèm 24/7 theo phong cách Ivy League',
      'Báo cáo phụ huynh chuyên sâu 90 ngày (kèm nhận xét AI)',
      'Lộ trình thông minh tự động vá điểm yếu hàng ngày',
    ],
  },
  {
    id: '1y',
    title: 'Gói 1 Năm - Cam Kết 1450+',
    badge: 'VIP Nhất • Bảo Lãnh Điểm Số',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    price: 3990000,
    priceDisplay: '3.990.000đ',
    originalPrice: '8.800.000đ',
    savePercent: 'Tiết kiệm 55%',
    codeSuffix: '1Y',
    features: [
      'Không giới hạn toàn bộ khoá luyện thi & đề thi 2026',
      'Cam kết tăng điểm hoặc học lại miễn phí',
      'Đặc quyền kết nối giáo viên trưởng cố vấn 1-1',
      'Bảo lưu tài khoản linh hoạt trước các kỳ thi chính',
    ],
  },
];

interface ParentRewardData {
  targetScore: number;
  rewardName: string;
  parentNote: string;
  createdAt: string;
}

const PRESET_REWARDS = [
  '✈️ Chuyến du lịch hè cùng cả gia đình',
  '📱 iPad Pro M2 / Laptop mới chuẩn bị đại học',
  '🎧 Tai nghe chống ồn Sony / AirPods Max cày đề',
  '💵 Học bổng nóng 10.000.000đ thưởng con tự do chi tiêu',
  '👗 Giày / Quần áo / Sở thích cá nhân con yêu thích',
];

function ParentVietQRSponsorAndReward({
  studentCode,
  isFreeStudent,
  trendWindowDays,
}: {
  studentCode: string;
  isFreeStudent: boolean;
  trendWindowDays: number;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState<'45d' | '3m' | '1y'>('3m');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [reward, setReward] = useState<ParentRewardData | null>(null);

  // Form state đặt thưởng
  const [targetScoreInput, setTargetScoreInput] = useState<number>(1450);
  const [rewardNameInput, setRewardNameInput] = useState<string>('✈️ Chuyến du lịch hè cùng cả gia đình');
  const [customRewardInput, setCustomRewardInput] = useState<string>('');
  const [parentNoteInput, setParentNoteInput] = useState<string>(
    'Bố mẹ tin con chắc chắn sẽ đạt được! Hãy giữ vững tinh thần và chiến đấu hết mình nhé con yêu!'
  );
  const [savedRewardSuccess, setSavedRewardSuccess] = useState(false);

  // Đọc phần thưởng đã lưu từ localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && studentCode) {
      try {
        const stored = localStorage.getItem(`sat_reward_${studentCode}`);
        if (stored) {
          const parsed = JSON.parse(stored) as ParentRewardData;
          setReward(parsed);
          setTargetScoreInput(parsed.targetScore);
          setRewardNameInput(parsed.rewardName);
          setParentNoteInput(parsed.parentNote);
        }
      } catch {
        // Fallback an toàn
      }
    }
  }, [studentCode]);

  const selectedPlan = SPONSOR_PLANS.find((p) => p.id === selectedPlanId) || SPONSOR_PLANS[1];

  // Cấu hình tài khoản ngân hàng thụ hưởng chính thức
  const BANK_ID = 'MB'; // Ngân hàng Quân Đội
  const ACCOUNT_NO = '0348888688';
  const ACCOUNT_NAME = 'NGUYEN HONG NGHIA';
  const cleanStudentCode = studentCode ? studentCode.replace(/[^A-Za-z0-9]/g, '').slice(-8) : 'SAT2026';
  const transferContent = `VIP ${cleanStudentCode} ${selectedPlan.codeSuffix}`;

  // VietQR URL sinh tự động từ chuẩn cổng thanh toán ngân hàng
  const vietQrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${selectedPlan.price}&addInfo=${encodeURIComponent(
    transferContent
  )}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

  const copyToClipboard = (text: string, fieldKey: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleSaveReward = () => {
    const finalRewardName = rewardNameInput === '__custom__' ? customRewardInput.trim() : rewardNameInput;
    if (!finalRewardName) return;

    const newReward: ParentRewardData = {
      targetScore: targetScoreInput,
      rewardName: finalRewardName,
      parentNote: parentNoteInput.trim(),
      createdAt: new Date().toLocaleDateString('vi-VN'),
    };

    setReward(newReward);
    if (typeof window !== 'undefined' && studentCode) {
      try {
        localStorage.setItem(`sat_reward_${studentCode}`, JSON.stringify(newReward));
      } catch {
        // ignore
      }
    }
    setSavedRewardSuccess(true);
    setTimeout(() => {
      setSavedRewardSuccess(false);
      setShowRewardModal(false);
    }, 1200);
  };

  const handleDeleteReward = () => {
    if (confirm('Bố mẹ có chắc chắn muốn xóa phần thưởng động viên này không?')) {
      setReward(null);
      if (typeof window !== 'undefined' && studentCode) {
        localStorage.removeItem(`sat_reward_${studentCode}`);
      }
    }
  };

  return (
    <div className="space-y-6 print:hidden">
      {/* 1. THẺ HUY HIỆU ĐỘNG VIÊN ĐÃ ĐẶT (NẾU CÓ) */}
      {reward && (
        <div className="bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-orange-500/15 border-2 border-amber-400/50 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-7xl opacity-15 pointer-events-none select-none">
            🏆
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                🎖️
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider bg-amber-400 text-slate-900 px-2 py-0.5 rounded-md shadow-sm">
                    Phần Thưởng Từ Bố Mẹ
                  </span>
                  <span className="text-xs text-amber-200 font-semibold">
                    Mục tiêu: <strong className="text-white text-sm">{reward.targetScore}+ điểm SAT</strong>
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-amber-200">
                  🎁 {reward.rewardName}
                </h4>
                {reward.parentNote && (
                  <p className="text-xs italic text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-amber-500/20 max-w-2xl">
                    &ldquo;{reward.parentNote}&rdquo;
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                onClick={() => setShowRewardModal(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition-all"
              >
                ✏️ Đổi phần thưởng
              </button>
              <button
                onClick={handleDeleteReward}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 border border-slate-700 transition-all"
                title="Xóa phần thưởng"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. KHUNG CHÍNH: TÀI TRỢ GÓI HỌC VIP 1-CHẠM VIETQR */}
      <div className="bg-gradient-to-br from-[#131d2e] via-[#1b2533] to-[#111827] rounded-2xl border-2 border-indigo-500/40 p-6 shadow-xl relative overflow-hidden">
        {/* Glow hiệu ứng nền */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">💎</span>
                <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-indigo-200 to-amber-200">
                  Tài Trợ Gói Học VIP Cho Con (Quét VietQR 1 Chạm)
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Phụ huynh trực tiếp thanh toán tài trợ mà <span className="text-amber-300 font-semibold">không cần đăng nhập vào tài khoản của con</span>. Hệ thống tự động kích hoạt tài khoản con ngay khi ngân hàng khớp lệnh.
              </p>
            </div>

            <button
              onClick={() => setShowRewardModal(true)}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 shrink-0"
            >
              <span>🎁</span>
              <span>{reward ? 'Sửa Thưởng Cho Con' : 'Gửi Huy Hiệu & Đặt Thưởng Cho Con'}</span>
            </button>
          </div>

          {/* 3 Lựa chọn gói */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SPONSOR_PLANS.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`cursor-pointer rounded-xl p-4.5 border-2 transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-gradient-to-b from-indigo-950/60 to-slate-900 border-indigo-400 shadow-lg shadow-indigo-500/20 scale-[1.02]'
                      : 'bg-slate-900/60 hover:bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute -top-3 right-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow">
                      ✓ Đang chọn
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${plan.badgeColor}`}>
                        {plan.badge}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold">{plan.savePercent}</span>
                    </div>

                    <div>
                      <h4 className="text-base font-extrabold text-white">{plan.title}</h4>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-black text-amber-300">{plan.priceDisplay}</span>
                        <span className="text-xs text-slate-400 line-through">{plan.originalPrice}</span>
                      </div>
                    </div>

                    <ul className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-emerald-400 text-xs">✓</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {isSelected ? '✓ Đang xem mã chuyển khoản' : 'Chọn gói này'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* VÙNG QUÉT MÃ VIETQR VÀ THÔNG TIN CHUYỂN KHOẢN TỰ ĐỘNG */}
          <div className="bg-[#0b1322] rounded-2xl border border-indigo-500/30 p-5 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Cột Trái: Ảnh Mã QR VietQR */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-2xl relative group">
              <div className="text-[11px] font-extrabold text-slate-800 mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>QUÉT QUA MỌI APP NGÂN HÀNG & VÍ MOMO</span>
              </div>

              {/* Ảnh VietQR tự động sinh */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={vietQrUrl}
                alt="Mã VietQR Tài Trợ Gói Học"
                className="w-full max-w-[260px] object-contain rounded-lg"
                loading="eager"
              />

              <div className="text-[10px] text-slate-500 mt-1 font-medium text-center">
                Mã QR chứa sẵn Số tiền ({selectedPlan.priceDisplay}) & Cú pháp tài trợ cho con
              </div>
            </div>

            {/* Cột Phải: Thông tin chi tiết + Nút sao chép */}
            <div className="md:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full">
                  Bước Thanh Toán Nhanh 1-Chạm
                </span>
                <span className="text-xs text-slate-400">
                  Mã học sinh: <strong className="text-amber-300 font-mono">{studentCode}</strong>
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* 1. Ngân hàng */}
                <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Ngân hàng thụ hưởng:</span>
                  <span className="text-white font-bold">MB Bank (Ngân hàng Quân Đội)</span>
                </div>

                {/* 2. Số tài khoản */}
                <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Số tài khoản:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-amber-300 font-mono tracking-wider">
                      {ACCOUNT_NO}
                    </span>
                    <button
                      onClick={() => copyToClipboard(ACCOUNT_NO, 'accountNo')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition-all"
                    >
                      {copiedField === 'accountNo' ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>

                {/* 3. Tên người nhận */}
                <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Chủ tài khoản:</span>
                  <span className="text-white font-bold tracking-wide">{ACCOUNT_NAME}</span>
                </div>

                {/* 4. Số tiền */}
                <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Số tiền:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-emerald-400">
                      {selectedPlan.priceDisplay}
                    </span>
                    <button
                      onClick={() => copyToClipboard(String(selectedPlan.price), 'amount')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition-all"
                    >
                      {copiedField === 'amount' ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>

                {/* 5. Cú pháp bắt buộc */}
                <div className="flex items-center justify-between bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-500/40">
                  <span className="text-indigo-200">Nội dung chuyển khoản:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-amber-300 font-mono">
                      {transferContent}
                    </span>
                    <button
                      onClick={() => copyToClipboard(transferContent, 'content')}
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow transition-all"
                    >
                      {copiedField === 'content' ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Lời cam kết hỗ trợ */}
              <div className="flex items-start gap-2 text-[11px] text-slate-400 pt-1">
                <span className="text-emerald-400 text-sm shrink-0">⚡</span>
                <p>
                  Hệ thống đối soát tự động kích hoạt tài khoản VIP của con sau <strong className="text-white">1–3 phút</strong>. Cần hỗ trợ nhanh hoặc xuất hóa đơn, phụ huynh liên hệ Zalo Hotline Thầy Nghĩa: <strong className="text-amber-300 font-mono">034.8888.688</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MODAL / DIALOG ĐẶT THƯỞNG ĐỘNG VIÊN CHO CON */}
      {showRewardModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1b2533] border-2 border-amber-400/60 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowRewardModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg p-1"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 border-b border-slate-700 pb-3">
              <span className="text-3xl">🎁</span>
              <div>
                <h3 className="text-lg font-bold text-white">Gửi Huy Hiệu & Đặt Thưởng Cho Con</h3>
                <p className="text-xs text-slate-400">Tạo động lực bứt phá để con hứng khởi cày đề mỗi ngày</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Mục tiêu điểm */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-200 flex justify-between">
                  <span>Mục tiêu điểm số của con:</span>
                  <span className="text-amber-300 font-bold text-sm">{targetScoreInput}+ điểm SAT</span>
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[1350, 1400, 1450, 1500, 1550].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setTargetScoreInput(score)}
                      className={`py-2 rounded-lg font-bold border transition-all ${
                        targetScoreInput === score
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {score}+
                    </button>
                  ))}
                </div>
              </div>

              {/* Phần thưởng */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200">Phần thưởng bố mẹ sẽ tặng con:</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {PRESET_REWARDS.map((rew, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setRewardNameInput(rew);
                        setCustomRewardInput('');
                      }}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                        rewardNameInput === rew
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {rew}
                    </div>
                  ))}

                  <div
                    onClick={() => setRewardNameInput('__custom__')}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                      rewardNameInput === '__custom__'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    ✏️ Tùy chỉnh phần thưởng khác...
                  </div>
                </div>

                {rewardNameInput === '__custom__' && (
                  <input
                    type="text"
                    value={customRewardInput}
                    onChange={(e) => setCustomRewardInput(e.target.value)}
                    placeholder="VD: Chiếc xe máy điện / Chuyến du lịch Hàn Quốc / Thưởng 15 triệu..."
                    className="w-full bg-slate-900 border border-amber-400/60 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                )}
              </div>

              {/* Lời nhắn nhủ */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-200">Lời nhắn nhủ yêu thương từ bố mẹ:</label>
                <textarea
                  rows={3}
                  value={parentNoteInput}
                  onChange={(e) => setParentNoteInput(e.target.value)}
                  placeholder="Viết vài dòng động viên con..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Nút hành động */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setShowRewardModal(false)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white font-medium text-xs"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveReward}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-95 flex items-center gap-2"
              >
                <span>{savedRewardSuccess ? '✓ Đã thiết lập!' : '🎖️ Lưu & Đặt Thưởng Cho Con'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
