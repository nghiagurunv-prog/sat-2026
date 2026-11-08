'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/context/ToastContext';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';

interface FrameCosmetic {
  icon?: string;
  cssClass?: string;
  label?: string;
}

interface Entry {
  rank: number;
  nickname: string;
  basePower: number;
  isMe: boolean;
  frame?: FrameCosmetic;
  title?: string;
}

interface SchoolRankingItem {
  id: string;
  rank: number;
  name: string;
  shortName: string;
  province: string;
  region: 'North' | 'Central' | 'South';
  totalWarriors: number;
  avgSatScore: number;
  totalPower: number;
  target1500PlusRate: number;
  badge: string;
  motto: string;
  isMySchool?: boolean;
}

interface UserSchoolProfile {
  schoolName: string;
  targetScore: number;
  updatedAt: string;
}

interface ReferralStats {
  code: string;
  invitedCount: number;
  bonusDaysPro: number;
  bonusCoins: number;
  referralUrl: string;
  challengeUrl: string;
}

interface LeaderboardData {
  season: { key: string; label: string; daysLeft: number };
  top: Entry[];
  me: Entry | null;
  available: boolean;
  schoolRankings?: SchoolRankingItem[];
  userSchool?: UserSchoolProfile | null;
  referralStats?: ReferralStats;
}

interface ProfileData {
  available: boolean;
  nickname: string | null;
  optIn: boolean;
  canChangeNickname: boolean;
}

interface CohortConfig {
  id: '1300' | '1400' | '1500';
  label: string;
  badge: string;
  color: string;
  targetSat: string;
  targetUni: string;
  avgPower: number;
  weeklyPractice: string;
  accuracyRate: string;
  advice: string;
}

const TARGET_COHORTS: CohortConfig[] = [
  {
    id: '1300',
    label: 'Nhóm Mục Tiêu 1300+',
    badge: '🎯 Nền Tảng Vững',
    color: 'from-blue-500 to-cyan-500',
    targetSat: '1300 – 1380 SAT',
    targetUni: 'FTU, NEU, Bách Khoa HUST, ĐHQG Hà Nội / TP.HCM',
    avgPower: 650,
    weeklyPractice: '2 đề thi thử & 25 bài tập/tuần',
    accuracyRate: '75% – 82%',
    advice: 'Nắm chắc kiến thức cốt lõi (Algebra căn bản, quy tắc dấu câu tiếng Anh). Mục tiêu không sai câu Easy & Medium.',
  },
  {
    id: '1400',
    label: 'Nhóm Mục Tiêu 1400+',
    badge: '🚀 Bứt Phá Học Bổng',
    color: 'from-amber-500 to-yellow-500',
    targetSat: '1400 – 1480 SAT',
    targetUni: 'Học bổng RMIT, VinUni, BUV, Chương trình Tiên tiến FTU',
    avgPower: 880,
    weeklyPractice: '3 đề thi thử & 40 bài tập/tuần',
    accuracyRate: '85% – 90%',
    advice: 'Chinh phục câu hỏi Hard trong Reading & Writing (Suy luận logic, cấu trúc đoạn) và thành thạo bấm máy Desmos trong Math.',
  },
  {
    id: '1500',
    label: 'Nhóm Mục Tiêu 1500+',
    badge: '👑 Đỉnh Cao Ivy League',
    color: 'from-rose-500 to-amber-500',
    targetSat: '1500 – 1600 SAT',
    targetUni: 'Ivy League, Top 20 Đại học Mỹ & Toàn cầu, Học bổng Toàn phần',
    avgPower: 1150,
    weeklyPractice: '4 đề thi thử & 60 bài tập/tuần',
    accuracyRate: '94% – 98%',
    advice: 'Triệt tiêu 100% bẫy sai sót lặp lại trong Sổ tay lỗi sai. Rèn luyện tâm lý phòng thi và phản xạ tốc độ dưới 45s/câu.',
  },
];

// Danh sách gợi ý trường THPT Chuyên tiêu biểu
const POPULAR_SCHOOLS = [
  'THPT Chuyên Hà Nội - Amsterdam',
  'THPT Chuyên Ngoại Ngữ - ĐHQGHN',
  'THPT Chuyên Khoa Học Tự Nhiên - ĐHQGHN',
  'THPT Chuyên Đại Học Sư Phạm Hà Nội',
  'THPT Chuyên Lê Hồng Phong (TP.HCM)',
  'Trường Phổ Thông Năng Khiếu - ĐHQG TP.HCM',
  'THPT Chuyên Phan Bội Châu (Nghệ An)',
  'THPT Chuyên Lam Sơn (Thanh Hóa)',
  'THPT Chuyên Quốc Học Huế',
  'THPT Chuyên Trần Phú (Hải Phòng)',
  'THPT Chu Văn An (Hà Nội)',
  'THPT Chuyên Nguyễn Huệ (Hà Nội)',
  'THPT Chuyên Bắc Ninh',
  'THPT Chuyên Lương Thế Vinh (Đồng Nai)',
  'THPT Chuyên Thoại Ngọc Hầu (An Giang)',
];

const VIRAL_TITLES = [
  'Quái Vật Desmos 800/800 📐',
  'Bậc Thầy RW Suy Luận Logic ⚡',
  'Thần Tốc Không Sai Câu Dễ 🎯',
  'Chiến Thần Đọc Hiểu 780+ 📚',
  'Kẻ Hủy Diệt Đề SAT Official ⚔️',
  'Thợ Săn Học Bổng Toàn Phần Mỹ 🗽',
];

export default function LeaderboardPage() {
  const { showToast } = useToast();
  const [board, setBoard] = useState<LeaderboardData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickInput, setNickInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Tabs điều hướng chính
  const [activeTab, setActiveTab] = useState<'individual' | 'schools' | 'viral_card' | 'challenge'>('schools');

  // State so sánh nhóm mục tiêu
  const [activeCohortId, setActiveCohortId] = useState<'1300' | '1400' | '1500'>('1400');

  // State trường THPT
  const [selectedSchool, setSelectedSchool] = useState('');
  const [customSchoolInput, setCustomSchoolInput] = useState('');
  const [targetScoreInput, setTargetScoreInput] = useState('1500');
  const [regionFilter, setRegionFilter] = useState<'all' | 'North' | 'Central' | 'South'>('all');
  const [savingSchool, setSavingSchool] = useState(false);

  // State Story Flex Card
  const [cardRatio, setCardRatio] = useState<'story' | 'post'>('story'); // 'story' (9:16) vs 'post' (16:9)
  const [cardTheme, setCardTheme] = useState<'cyber' | 'gold' | 'neon'>('gold');
  const [selectedTitle, setSelectedTitle] = useState(VIRAL_TITLES[0]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [bRes, pRes] = await Promise.all([fetch('/api/leaderboard'), fetch('/api/profile')]);
        if (bRes.ok) {
          const bData: LeaderboardData = await bRes.json();
          setBoard(bData);
          if (bData.userSchool) {
            setSelectedSchool(bData.userSchool.schoolName);
            setTargetScoreInput(String(bData.userSchool.targetScore));
          } else {
            setSelectedSchool(POPULAR_SCHOOLS[0]);
          }
        }
        if (pRes.ok) {
          const p = await pRes.json();
          setProfile(p);
          if (p.nickname) setNickInput(p.nickname);
        }
      } catch (e) {
        console.error('Failed to load leaderboard', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const refresh = async () => {
    const [bRes, pRes] = await Promise.all([fetch('/api/leaderboard'), fetch('/api/profile')]);
    if (bRes.ok) {
      const bData: LeaderboardData = await bRes.json();
      setBoard(bData);
      if (bData.userSchool) {
        setSelectedSchool(bData.userSchool.schoolName);
        setTargetScoreInput(String(bData.userSchool.targetScore));
      }
    }
    if (pRes.ok) setProfile(await pRes.json());
  };

  const saveNickname = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickInput }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('✅ Đã lưu bí danh!', 'success');
        await refresh();
      } else {
        showToast(`❌ ${data.error ?? 'Không lưu được bí danh.'}`, 'error');
      }
    } catch {
      showToast('❌ Lỗi kết nối.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleOptIn = async (next: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optIn: next }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(next ? '🏆 Bạn đã tham gia bảng xếp hạng!' : 'Đã ẩn khỏi bảng xếp hạng.', 'success');
        await refresh();
      } else {
        showToast(`❌ ${data.error ?? 'Không đổi được.'}`, 'error');
      }
    } catch {
      showToast('❌ Lỗi kết nối.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Cập nhật trường THPT cống hiến điểm
  const handleSaveSchool = async () => {
    const finalSchool = selectedSchool === 'other' ? customSchoolInput.trim() : selectedSchool;
    if (!finalSchool) {
      showToast('⚠️ Vui lòng chọn hoặc nhập tên trường THPT!', 'info');
      return;
    }

    setSavingSchool(true);
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: finalSchool,
          targetScore: Number(targetScoreInput) || 1500,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || '🎉 Đã ghi danh thành công cho trường!', 'success');
        await refresh();
      } else {
        showToast(`❌ ${data.error || 'Lỗi khi lưu trường.'}`, 'error');
      }
    } catch {
      showToast('❌ Lỗi kết nối máy chủ.', 'error');
    } finally {
      setSavingSchool(false);
    }
  };

  // Copy nội dung vào Clipboard
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 Đã sao chép ${label}! Dán ngay cho bạn bè nhé!`, 'success');
  };

  // Xuất ảnh Canvas Story
  const handleDownloadStoryCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      showToast('⚠️ Đang tạo thẻ, vui lòng thử lại sau 1 giây...', 'info');
      return;
    }
    try {
      const link = document.createElement('a');
      link.download = `SAT-GURU-Story-${(profile?.nickname || 'Warrior').replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('📸 Đã tải thẻ vinh danh về máy! Đăng Story ngay nào!', 'success');
    } catch (e) {
      console.error(e);
      showToast('❌ Không thể tải ảnh trực tiếp. Bạn có thể chụp màn hình thẻ bên dưới!', 'error');
    }
  };

  // Vẽ Canvas đồ họa Story 9:16
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isStory = cardRatio === 'story';
    const width = isStory ? 720 : 1080;
    const height = isStory ? 1280 : 608;

    canvas.width = width;
    canvas.height = height;

    // Background Gradient theo Theme
    if (cardTheme === 'gold') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#1c1305');
      grad.addColorStop(0.4, '#2e1c07');
      grad.addColorStop(1, '#0f0a02');
      ctx.fillStyle = grad;
    } else if (cardTheme === 'cyber') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0a0a23');
      grad.addColorStop(0.5, '#1e1145');
      grad.addColorStop(1, '#070514');
      ctx.fillStyle = grad;
    } else {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#042f2e');
      grad.addColorStop(0.5, '#064e3b');
      grad.addColorStop(1, '#021c17');
      ctx.fillStyle = grad;
    }
    ctx.fillRect(0, 0, width, height);

    // Đường viền Neon vàng / gradient
    ctx.lineWidth = 10;
    ctx.strokeStyle = cardTheme === 'gold' ? '#f59e0b' : cardTheme === 'cyber' ? '#8b5cf6' : '#10b981';
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // Header Thẻ
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('⚡ SAT GURU VIỆT NAM ⚡', width / 2, isStory ? 110 : 80);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 20px sans-serif';
    ctx.fillText('OFFICIAL SAT WARRIOR CARD • DIGITAL SAT 2026', width / 2, isStory ? 145 : 110);

    // Avatar Box & Tên Bí danh
    const myNick = profile?.nickname || 'Chiến Binh Ẩn Danh';
    const mySchool = board?.userSchool?.schoolName || selectedSchool || 'Trường THPT Chuyên Toàn Quốc';
    const myScore = board?.userSchool?.targetScore || 1520;
    const myPower = board?.me?.basePower ?? 950;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(myNick, width / 2, isStory ? 240 : 180);

    // Danh hiệu
    ctx.fillStyle = cardTheme === 'gold' ? '#fbbf24' : '#a78bfa';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`👑 ${selectedTitle}`, width / 2, isStory ? 285 : 220);

    // Trường THPT
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 22px sans-serif';
    ctx.fillText(`🏫 Đại diện: ${mySchool}`, width / 2, isStory ? 330 : 255);

    // Big SAT Target Box
    const boxY = isStory ? 410 : 290;
    const boxH = isStory ? 220 : 160;
    const boxW = width - 120;
    const boxX = 60;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxH, 20) : ctx.rect(boxX, boxY, boxW, boxH);
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('MỤC TIÊU ĐIỂM SỐ CHÍNH THỨC', width / 2, boxY + 45);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 80px sans-serif';
    ctx.fillText(`${myScore}`, width / 2, boxY + 125);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('⭐ TOP 1% QUỐC GIA • SẴN SÀNG CHINH PHỤC IVY LEAGUE ⭐', width / 2, boxY + 175);

    // 3 Hộp Thống Kê
    const statBoxY = isStory ? 680 : 470;
    const statBoxW = (width - 160) / 3;

    // Stat 1: Lực chiến
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(60, statBoxY, statBoxW, isStory ? 150 : 90);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(`${myPower} ⚔️`, 60 + statBoxW / 2, statBoxY + (isStory ? 70 : 45));
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '18px sans-serif';
    ctx.fillText('Lực Chiến', 60 + statBoxW / 2, statBoxY + (isStory ? 115 : 75));

    // Stat 2: Chuỗi Luyện Đề
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(80 + statBoxW, statBoxY, statBoxW, isStory ? 150 : 90);
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('🔥 28 Ngày', 80 + statBoxW * 1.5, statBoxY + (isStory ? 70 : 45));
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '18px sans-serif';
    ctx.fillText('Chuỗi Bất Bại', 80 + statBoxW * 1.5, statBoxY + (isStory ? 115 : 75));

    // Stat 3: Dự Kiến Percentile
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(100 + statBoxW * 2, statBoxY, statBoxW, isStory ? 150 : 90);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('99th %', 100 + statBoxW * 2.5, statBoxY + (isStory ? 70 : 45));
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '18px sans-serif';
    ctx.fillText('Percentile', 100 + statBoxW * 2.5, statBoxY + (isStory ? 115 : 75));

    // Khẩu hiệu & Lời thách đấu
    if (isStory) {
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('💬 "Học thật - Thi thật - 1500+ không phải chuyện viễn vông!"', width / 2, 890);

      // Thách đấu QR section
      ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
      ctx.roundRect ? ctx.roundRect(80, 940, width - 160, 180, 16) : ctx.rect(80, 940, width - 160, 180);
      ctx.fill();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('⚔️ THÁCH ĐẤU SOLO SAT TỐC ĐỘ 1v1', width / 2, 995);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '20px sans-serif';
      ctx.fillText('Vào ngay satguru.edu.vn để solo 5 câu SAT với tôi!', width / 2, 1040);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px monospace';
      ctx.fillText(`Mã Khiêu Chiến: ${board?.referralStats?.code || 'SAT-GURU-2026'}`, width / 2, 1080);

      // Footer
      ctx.fillStyle = '#64748b';
      ctx.font = '16px sans-serif';
      ctx.fillText('Designed by SAT Guru Việt Nam • Nền Tảng Luyện SAT Số 1 Cho HS Cấp 3', width / 2, 1220);
    }
  }, [cardRatio, cardTheme, selectedTitle, profile, board, selectedSchool]);

  // Lọc trường theo vùng miền
  const filteredSchools = (board?.schoolRankings || []).filter((s) => {
    if (regionFilter === 'all') return true;
    return s.region === regionFilter;
  });

  const mySchoolInfo = board?.schoolRankings?.find((s) => s.isMySchool);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-24 text-slate-100">
      {/* HEADER ĐẤU TRƯỜNG PHONG THẦN & LIÊN TRƯỜNG */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 sm:p-10 border border-amber-500/30 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #451a03 0%, #1e1103 40%, #0f172a 100%)',
        }}
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold tracking-wide uppercase">
              <span>⚔️</span> Giải Đấu Liên Trường THPT Chuyên Toàn Quốc 2026
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500">
              BẢNG PHONG THẦN & ĐẤU TRƯỜNG LIÊN TRƯỜNG
            </h1>
            <p className="text-sm sm:text-base text-amber-100/80 max-w-2xl leading-relaxed">
              Xếp hạng năng lực học tập SAT thực thụ. Đem vinh quang về cho ngôi trường THPT của bạn, khẳng định vị thế và thách đấu bạn bè toàn quốc!
            </p>
          </div>

          {/* Quick Stats box */}
          <div className="flex flex-wrap sm:flex-nowrap gap-3 bg-slate-950/60 p-4 rounded-2xl border border-amber-500/30 backdrop-blur-md shrink-0">
            <div className="text-center px-4 py-1 border-r border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Mùa Thi Đấu</div>
              <div className="text-base font-black text-amber-300">{board?.season.label || 'Mùa Xuân 2026'}</div>
            </div>
            <div className="text-center px-4 py-1 border-r border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Thời Gian Còn</div>
              <div className="text-base font-black text-rose-400">⏳ {board?.season.daysLeft ?? 24} ngày</div>
            </div>
            <div className="text-center px-4 py-1">
              <div className="text-xs text-slate-400 font-medium">Trường Đang Dẫn Đầu</div>
              <div className="text-base font-black text-yellow-300">🏆 Amsers</div>
            </div>
          </div>
        </div>

        {/* 4 Tabs Điều Hướng Chính */}
        <div className="mt-8 flex flex-wrap gap-2 pt-4 border-t border-amber-500/20">
          <button
            onClick={() => setActiveTab('schools')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'schools'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/70 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <span>🏫</span> Bảng Vàng Tự Hào Trường THPT
          </button>

          <button
            onClick={() => setActiveTab('individual')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'individual'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/70 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <span>🏆</span> Bảng Cá Nhân & Mục Tiêu
          </button>

          <button
            onClick={() => setActiveTab('viral_card')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'viral_card'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20'
                : 'bg-slate-900/70 text-purple-300 hover:bg-slate-800 hover:text-white border border-purple-900/50'
            }`}
          >
            <span>📸</span> Tạo Thẻ Flex Story 9:16
          </button>

          <button
            onClick={() => setActiveTab('challenge')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'challenge'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20'
                : 'bg-slate-900/70 text-rose-300 hover:bg-slate-800 hover:text-white border border-rose-900/50'
            }`}
          >
            <span>⚔️</span> Thách Đấu 1v1 & Tặng 7 Ngày Pro
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Đang tải dữ liệu phong thần liên trường..." />
      ) : !board?.available ? (
        <EmptyState icon="🚧" title="Bảng xếp hạng sắp ra mắt" message="Tính năng đang được hoàn thiện. Hãy quay lại sau nhé!" />
      ) : (
        <>
          {/* TAB 1: ĐẤU TRƯỜNG CÁC TRƯỜNG THPT */}
          {activeTab === 'schools' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Box Ghi Danh / Chọn Trường Của Tôi */}
              <div className="bg-gradient-to-br from-[#1e1b4b]/60 via-[#0f172a] to-[#1e293b]/70 border-2 border-indigo-500/40 rounded-2xl p-6 sm:p-8 shadow-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm uppercase tracking-wider">
                      <span>🚩</span> MÀU CỜ SẮC ÁO • CHỌN TRƯỜNG THPT CỦA BẠN
                    </div>
                    <h2 className="text-2xl font-black text-white">
                      Cống Hiến Lực Chiến Cho Ngôi Trường Của Bạn
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl">
                      Mỗi bài luyện đề, mỗi câu hỏi đúng và điểm lực chiến của bạn sẽ được cộng dồn trực tiếp vào tổng điểm của trường trên bảng xếp hạng toàn quốc!
                    </p>
                    {board.userSchool && (
                      <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                        <span>✅</span> Bạn đang cống hiến cho: <strong>{board.userSchool.schoolName}</strong> (Mục tiêu: {board.userSchool.targetScore} SAT)
                      </div>
                    )}
                  </div>

                  {/* Form Chọn Trường */}
                  <div className="bg-slate-900/90 p-5 rounded-2xl border border-indigo-500/30 w-full lg:w-auto min-w-[340px] space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Chọn trường THPT của bạn:
                      </label>
                      <select
                        value={selectedSchool}
                        onChange={(e) => setSelectedSchool(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                      >
                        {POPULAR_SCHOOLS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                        <option value="other">Trường THPT khác (Nhập tay)...</option>
                      </select>
                    </div>

                    {selectedSchool === 'other' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Nhập tên trường của bạn:
                        </label>
                        <input
                          type="text"
                          value={customSchoolInput}
                          onChange={(e) => setCustomSchoolInput(e.target.value)}
                          placeholder="VD: THPT Marie Curie, THPT Chu Văn An..."
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Mục tiêu SAT:
                        </label>
                        <select
                          value={targetScoreInput}
                          onChange={(e) => setTargetScoreInput(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
                        >
                          <option value="1350">1350+ SAT</option>
                          <option value="1450">1450+ SAT</option>
                          <option value="1500">1500+ SAT</option>
                          <option value="1550">1550+ SAT (Top 1%)</option>
                          <option value="1600">1600 Perfect Score</option>
                        </select>
                      </div>

                      <div className="flex items-end">
                        <button
                          onClick={handleSaveSchool}
                          disabled={savingSchool}
                          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-2 px-3 rounded-xl text-sm transition-all shadow-md disabled:opacity-50"
                        >
                          {savingSchool ? 'Đang lưu...' : 'Ghi Danh Ngay'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BỤC VINH QUANG TOP 3 TRƯỜNG DẪN ĐẦU */}
              {board.schoolRankings && board.schoolRankings.length >= 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <span>👑</span> Bục Vinh Quang Top 3 Trường Dẫn Đầu Toàn Quốc
                    </h3>
                    <span className="text-xs text-amber-400 font-medium">Cập nhật theo thời gian thực</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    {/* Hạng 2 */}
                    {board.schoolRankings[1] && (
                      <div className="order-2 md:order-1 bg-gradient-to-t from-slate-900 to-slate-800/80 border-2 border-slate-400/50 rounded-2xl p-6 text-center space-y-3 relative hover:scale-[1.02] transition-transform">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-950 font-black px-4 py-1 rounded-full text-sm shadow-md">
                          🥈 HẠNG 2 TOÀN QUỐC
                        </div>
                        <div className="pt-2 text-3xl">🏛️</div>
                        <h4 className="font-bold text-lg text-white">{board.schoolRankings[1].name}</h4>
                        <div className="inline-block px-2.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300 text-xs font-semibold">
                          {board.schoolRankings[1].badge}
                        </div>
                        <p className="text-xs text-slate-400 italic">"{board.schoolRankings[1].motto}"</p>
                        <div className="pt-3 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400">SAT Trung Bình:</span>
                            <div className="font-black text-amber-300 text-base">{board.schoolRankings[1].avgSatScore}</div>
                          </div>
                          <div>
                            <span className="text-slate-400">Tổng Lực Chiến:</span>
                            <div className="font-black text-cyan-300 text-base">{board.schoolRankings[1].totalPower.toLocaleString()} ⚔️</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Hạng 1 (Quán Quân) */}
                    {board.schoolRankings[0] && (
                      <div className="order-1 md:order-2 bg-gradient-to-t from-amber-950/80 via-slate-900 to-amber-900/60 border-2 border-amber-400 rounded-3xl p-7 text-center space-y-3 relative shadow-2xl shadow-amber-500/20 md:-translate-y-4 hover:scale-[1.03] transition-transform">
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black px-5 py-1.5 rounded-full text-sm shadow-lg">
                          👑 ĐƯƠNG KIM QUÁN QUÂN
                        </div>
                        <div className="pt-3 text-4xl animate-bounce">🏆</div>
                        <h4 className="font-black text-xl text-yellow-300">{board.schoolRankings[0].name}</h4>
                        <div className="inline-block px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-bold">
                          {board.schoolRankings[0].badge}
                        </div>
                        <p className="text-xs text-amber-200/90 italic font-medium">"{board.schoolRankings[0].motto}"</p>
                        <div className="pt-4 border-t border-amber-500/30 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-amber-200/70">Chiến Binh:</span>
                            <div className="font-black text-white text-base">{board.schoolRankings[0].totalWarriors} 👤</div>
                          </div>
                          <div>
                            <span className="text-amber-200/70">SAT TB:</span>
                            <div className="font-black text-yellow-300 text-lg">{board.schoolRankings[0].avgSatScore}</div>
                          </div>
                          <div>
                            <span className="text-amber-200/70">Lực Chiến:</span>
                            <div className="font-black text-amber-400 text-base">{board.schoolRankings[0].totalPower.toLocaleString()} ⚔️</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Hạng 3 */}
                    {board.schoolRankings[2] && (
                      <div className="order-3 md:order-3 bg-gradient-to-t from-slate-900 to-amber-950/40 border-2 border-amber-700/60 rounded-2xl p-6 text-center space-y-3 relative hover:scale-[1.02] transition-transform">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-700 text-white font-black px-4 py-1 rounded-full text-sm shadow-md">
                          🥉 HẠNG 3 TOÀN QUỐC
                        </div>
                        <div className="pt-2 text-3xl">🏛️</div>
                        <h4 className="font-bold text-lg text-white">{board.schoolRankings[2].name}</h4>
                        <div className="inline-block px-2.5 py-0.5 rounded-full bg-amber-800/40 text-amber-300 text-xs font-semibold">
                          {board.schoolRankings[2].badge}
                        </div>
                        <p className="text-xs text-slate-400 italic">"{board.schoolRankings[2].motto}"</p>
                        <div className="pt-3 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400">SAT Trung Bình:</span>
                            <div className="font-black text-amber-300 text-base">{board.schoolRankings[2].avgSatScore}</div>
                          </div>
                          <div>
                            <span className="text-slate-400">Tổng Lực Chiến:</span>
                            <div className="font-black text-cyan-300 text-base">{board.schoolRankings[2].totalPower.toLocaleString()} ⚔️</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BẢNG XẾP HẠNG TẤT CẢ CÁC TRƯỜNG */}
              <div className="bg-[#1b2533] border border-[#262730] rounded-2xl overflow-hidden shadow-xl">
                {/* Header thanh lọc vùng miền */}
                <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📊</span>
                    <div>
                      <h3 className="font-bold text-white text-base">Bảng Xếp Hạng Đầy Đủ Các Trường THPT</h3>
                      <p className="text-xs text-slate-400">Xếp hạng theo tổng điểm lực chiến tích lũy của toàn thể học sinh</p>
                    </div>
                  </div>

                  {/* Filter Region Buttons */}
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 shrink-0">
                    {[
                      { key: 'all', label: 'Toàn Quốc' },
                      { key: 'North', label: 'Miền Bắc' },
                      { key: 'Central', label: 'Miền Trung' },
                      { key: 'South', label: 'Miền Nam' },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setRegionFilter(f.key as any)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                          regionFilter === f.key
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Danh sách trường */}
                <div className="divide-y divide-slate-800/70">
                  {filteredSchools.map((school) => {
                    const isMy = school.isMySchool;
                    return (
                      <div
                        key={school.id}
                        className={`p-4 sm:px-6 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                          isMy ? 'bg-amber-500/10 border-l-4 border-amber-400' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Cột 1: Thứ hạng & Tên trường */}
                        <div className="flex items-center gap-4 min-w-0">
                          <span
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base shrink-0 ${
                              school.rank === 1
                                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/40'
                                : school.rank === 2
                                ? 'bg-slate-300 text-slate-950'
                                : school.rank === 3
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {school.rank}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-base truncate">
                                {school.name}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {school.shortName}
                              </span>
                              {isMy && (
                                <span className="text-[11px] font-black px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                                  Trường của bạn
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                              <span>📍 {school.province}</span>
                              <span>•</span>
                              <span className="text-amber-400 font-medium">🎯 {school.badge}</span>
                            </div>
                          </div>
                        </div>

                        {/* Cột 2: Các chỉ số */}
                        <div className="flex items-center gap-6 justify-between md:justify-end shrink-0 text-sm">
                          <div className="text-center">
                            <div className="text-[11px] text-slate-400">Chiến Binh</div>
                            <div className="font-bold text-white">{school.totalWarriors} 👤</div>
                          </div>

                          <div className="text-center">
                            <div className="text-[11px] text-slate-400">SAT TB</div>
                            <div className="font-black text-amber-300">{school.avgSatScore}</div>
                          </div>

                          <div className="text-center">
                            <div className="text-[11px] text-slate-400">Tỷ Lệ 1500+</div>
                            <div className="font-bold text-emerald-400">{school.target1500PlusRate}%</div>
                          </div>

                          <div className="text-right min-w-[100px]">
                            <div className="text-[11px] text-slate-400">Lực Chiến</div>
                            <div className="font-black font-mono text-cyan-300">
                              {school.totalPower.toLocaleString()} ⚔️
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Banner kêu gọi chia sẻ trường */}
              <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border border-amber-500/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div>
                  <h4 className="text-lg font-bold text-amber-300">
                    📢 Muốn Trường Bạn Vươn Lên Ngôi Vị Quán Quân?
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">
                    Hãy rủ ngay các bạn cùng lớp, câu lạc bộ SAT hoặc đồng môn trường bạn tham gia cày đề để tích lũy lực chiến khổng lồ!
                  </p>
                </div>
                <button
                  onClick={() => {
                    const text = `🔥 Bạn ơi! Hãy gia nhập biệt đội SAT của ${
                      mySchoolInfo?.name || selectedSchool || 'trường mình'
                    } trên SAT GURU để đua top trường toàn quốc nhé! https://satguru.edu.vn`;
                    handleCopy(text, 'Lời kêu gọi đồng đội');
                  }}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg shrink-0"
                >
                  📣 Kêu Gọi Bạn Cùng Trường
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: BẢNG CÁ NHÂN & NHÓM MỤC TIÊU */}
          {activeTab === 'individual' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Nhãn mùa + đếm ngược */}
              <div className="flex items-center justify-between bg-[#1b2533] border border-[#262730] rounded-xl px-6 py-4">
                <div className="text-lg font-black text-[#fbbf24]">🗓️ {board.season.label}</div>
                <div className="text-sm text-gray-400">
                  Còn <span className="text-white font-bold">{board.season.daysLeft}</span> ngày
                </div>
              </div>

              {/* Khối bí danh + opt-in */}
              <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-white">🪪 Bí danh của bạn</h2>
                <p className="text-sm text-gray-400">
                  Chọn một bí danh (không phải tên thật) để hiển thị trên bảng. Mặc định bạn KHÔNG xuất hiện — chỉ khi bạn tự bật.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={nickInput}
                    onChange={(e) => setNickInput(e.target.value)}
                    placeholder="Nhập bí danh (3-20 ký tự)"
                    aria-label="Bí danh hiển thị trên bảng xếp hạng"
                    maxLength={20}
                    className="flex-1 bg-[#0f172a] border border-[#334155] text-white rounded px-4 py-2 outline-none focus:border-[#fbbf24]"
                  />
                  <button
                    onClick={saveNickname}
                    disabled={saving || !profile?.canChangeNickname}
                    className="bg-[#fbbf24] hover:bg-[#f59e0b] text-[#78350f] font-bold px-6 py-2 rounded transition-colors disabled:opacity-50"
                    title={!profile?.canChangeNickname ? 'Chỉ đổi bí danh mỗi 24 giờ' : ''}
                  >
                    {profile?.nickname ? 'Đổi bí danh' : 'Lưu bí danh'}
                  </button>
                </div>
                {!profile?.canChangeNickname && (
                  <p className="text-xs text-amber-400">⏳ Bạn vừa đổi bí danh — chỉ đổi được mỗi 24 giờ.</p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-[#262730]">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile?.optIn ?? false}
                      disabled={saving || !profile?.nickname}
                      onChange={(e) => toggleOptIn(e.target.checked)}
                      className="w-5 h-5"
                    />
                    <span className="text-sm text-[#e2e8f0]">
                      Hiển thị tôi trên bảng xếp hạng
                      {!profile?.nickname && <span className="text-gray-500"> (đặt bí danh trước)</span>}
                    </span>
                  </label>

                  <button
                    onClick={() => setActiveTab('viral_card')}
                    className="inline-flex items-center gap-2 text-xs font-bold text-purple-300 hover:text-purple-200 bg-purple-950/60 border border-purple-800/80 px-4 py-2 rounded-lg"
                  >
                    <span>📸</span> Tạo Thẻ Flex Story Khoe Ngay
                  </button>
                </div>
              </div>

              {/* POINT 84: Chế độ So sánh Bản thân với Nhóm Mục tiêu */}
              {(() => {
                const activeCohort = TARGET_COHORTS.find((c) => c.id === activeCohortId) || TARGET_COHORTS[1];
                const myPower = board.me?.basePower ?? 0;
                const progressRatio = Math.min(100, Math.round((myPower / activeCohort.avgPower) * 100));
                const diff = myPower - activeCohort.avgPower;

                return (
                  <div className="bg-gradient-to-br from-[#1b2533] via-[#161f2e] to-[#0f172a] border-2 border-indigo-500/40 rounded-2xl p-6 shadow-xl space-y-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🎯</span>
                          <h2 className="text-lg font-bold text-white">So Sánh Năng Lực Với Nhóm Học Sinh Mục Tiêu</h2>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          Tự tin bước đi theo lộ trình riêng — không bị nản lòng bởi các bạn bắt đầu trước trên bảng xếp hạng tổng.
                        </p>
                      </div>

                      {/* Tabs chọn Nhóm mục tiêu */}
                      <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-700 gap-1 shrink-0">
                        {TARGET_COHORTS.map((c) => {
                          const isActive = c.id === activeCohortId;
                          return (
                            <button
                              key={c.id}
                              onClick={() => setActiveCohortId(c.id)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                                isActive
                                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                              }`}
                            >
                              {c.label.replace('Nhóm Mục Tiêu ', '')}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Thẻ chi tiết nhóm được chọn */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Cột 1: Thông tin nhóm */}
                      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {activeCohort.badge}
                        </span>
                        <div className="text-base font-black text-white">{activeCohort.targetSat}</div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          <strong>Đích đến:</strong> {activeCohort.targetUni}
                        </p>
                        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                          <div>📚 <strong>Cường độ:</strong> {activeCohort.weeklyPractice}</div>
                          <div>🎯 <strong>Độ chính xác:</strong> {activeCohort.accuracyRate}</div>
                        </div>
                      </div>

                      {/* Cột 2 & 3: Thanh so sánh trực quan lực chiến */}
                      <div className="md:col-span-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-slate-300 font-medium flex items-center gap-2">
                              <span>👤</span> Lực chiến của bạn: <strong className="text-amber-300 text-base font-mono">{myPower} ⚔️</strong>
                            </span>
                            <span className="text-slate-400 text-xs">
                              Mục tiêu nhóm: <strong className="text-cyan-300 font-mono">{activeCohort.avgPower} ⚔️</strong>
                            </span>
                          </div>

                          {/* Progress bar so sánh */}
                          <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden p-0.5 border border-slate-700 relative">
                            <div
                              className="bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 h-full rounded-full transition-all duration-700"
                              style={{ width: `${progressRatio}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow">
                              {progressRatio}% MỤC TIÊU
                            </div>
                          </div>

                          {/* Trạng thái chênh lệch */}
                          <div className="mt-2 text-xs flex items-center justify-between">
                            {diff >= 0 ? (
                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                <span>🎉</span> Xuất sắc! Bạn đã vượt mức trung bình của nhóm này +{diff} lực chiến!
                              </span>
                            ) : (
                              <span className="text-amber-300 font-semibold flex items-center gap-1">
                                <span>⚡</span> Còn cách mốc chuẩn của nhóm {Math.abs(diff)} điểm lực chiến
                              </span>
                            )}
                            <span className="text-slate-500 text-[11px]">
                              {board.me ? `Hạng #${board.me.rank} toàn server` : 'Chưa bật xếp hạng'}
                            </span>
                          </div>
                        </div>

                        {/* Lời khuyên hành động */}
                        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                          <div className="text-[11px] font-bold text-amber-400 mb-0.5 flex items-center gap-1">
                            <span>💡</span> HÀNH ĐỘNG TUẦN NÀY ĐỂ BẮT KỊP NHÓM:
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{activeCohort.advice}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* #C080: Thẻ Huy hiệu Cột mốc Điểm số (1300+ / 1400+ / 1500+) */}
              <div className="bg-gradient-to-r from-amber-950/40 via-slate-900/80 to-purple-950/40 border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🏅</span>
                    <div>
                      <h3 className="text-base font-black text-white">Huy Hiệu Cột Mốc Điểm Số Danh Giá</h3>
                      <p className="text-xs text-amber-200/80">Các mốc son minh chứng cho nỗ lực rèn luyện vượt bậc của chiến binh SAT</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-800">
                    Lực chiến của bạn: <strong className="text-amber-400">{board.me?.basePower ?? 0} ⚔️</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      score: '1300+',
                      powerReq: 650,
                      badge: '🎯 Nền Tảng Vàng',
                      desc: 'Làm chủ toàn bộ câu Easy & Medium. Không để rơi rớt điểm vô lý.',
                      targetUni: 'FTU, NEU, HUST, VNU',
                      color: 'border-blue-500/40 bg-blue-950/30',
                      textColor: 'text-blue-400',
                    },
                    {
                      score: '1400+',
                      powerReq: 880,
                      badge: '🚀 Bứt Phá Học Bổng',
                      desc: 'Xử lý thành thạo Desmos và câu hỏi suy luận logic Reading & Writing.',
                      targetUni: 'Học bổng RMIT, VinUni, Fulbright',
                      color: 'border-amber-500/50 bg-amber-950/30',
                      textColor: 'text-amber-400',
                    },
                    {
                      score: '1500+',
                      powerReq: 1150,
                      badge: '👑 Đỉnh Cao Ivy League',
                      desc: 'Top 1% quốc gia. Phản xạ hoàn hảo với tốc độ dưới 45 giây mỗi câu.',
                      targetUni: 'Top 20 Đại học Mỹ & Toàn cầu',
                      color: 'border-rose-500/50 bg-rose-950/30',
                      textColor: 'text-rose-400',
                    },
                  ].map((m) => {
                    const myPower = board.me?.basePower ?? 0;
                    const isUnlocked = myPower >= m.powerReq;
                    return (
                      <div
                        key={m.score}
                        className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                          isUnlocked ? m.color + ' shadow-lg' : 'border-slate-800 bg-slate-900/40 opacity-70'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-950 text-white border border-slate-800">
                              SAT {m.score}
                            </span>
                            <span className={`text-xs font-bold ${isUnlocked ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {isUnlocked ? '✓ Đã Mở Khóa' : `Cần ${m.powerReq} ⚔️`}
                            </span>
                          </div>
                          <div className={`text-base font-black ${m.textColor}`}>{m.badge}</div>
                          <p className="text-xs text-slate-300 leading-relaxed">{m.desc}</p>
                        </div>
                        <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                          🎯 <strong className="text-slate-300">Đích đến:</strong> {m.targetUni}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bảng xếp hạng */}
              {board.top.length === 0 ? (
                <EmptyState message="Chưa có ai trên bảng mùa này. Hãy là người đầu tiên!" />
              ) : (
                <div className="bg-[#1b2533] border border-[#262730] rounded-xl overflow-hidden shadow-xl">
                  {board.top.map((e) => (
                    <div
                      key={e.rank}
                      className={`flex items-center justify-between px-6 py-3.5 border-b border-[#0f172a] last:border-0 ${
                        e.isMe ? 'bg-[rgba(251,191,36,0.12)]' : ''
                      } ${e.frame?.cssClass ?? ''}`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className={`text-lg font-black w-10 text-center ${e.rank <= 3 ? 'text-[#fbbf24]' : 'text-gray-500'}`}>
                          {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`}
                        </span>
                        <span className={`font-bold truncate ${e.isMe ? 'text-[#fbbf24]' : 'text-white'}`}>
                          {e.nickname} {e.isMe && <span className="text-xs text-amber-400">(Bạn)</span>}
                        </span>
                        {e.title && (
                          <span
                            className="text-xs font-bold text-amber-300 bg-[rgba(251,191,36,0.15)] border border-[rgba(251,191,36,0.3)] rounded px-2 py-0.5 shrink-0"
                            title={e.title}
                          >
                            {e.frame?.icon ?? '🎖️'} {e.title}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-mono text-[#60a5fa] shrink-0">⚔️ {e.basePower}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Vị trí của mình nếu ngoài top hiển thị */}
              {board.me && !board.top.some((e) => e.isMe) && (
                <div className={`bg-[rgba(251,191,36,0.12)] border border-[rgba(251,191,36,0.3)] rounded-xl px-6 py-3 flex items-center justify-between ${board.me.frame?.cssClass ?? ''}`}>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-black w-10 text-center text-[#fbbf24]">#{board.me.rank}</span>
                    <span className="font-bold text-[#fbbf24]">{board.me.nickname} <span className="text-xs text-amber-400">(Bạn)</span></span>
                    {board.me.title && (
                      <span
                        className="text-xs font-bold text-amber-300 bg-[rgba(251,191,36,0.15)] border border-[rgba(251,191,36,0.3)] rounded px-2 py-0.5 shrink-0"
                        title={board.me.title}
                      >
                        {board.me.frame?.icon ?? '🎖️'} {board.me.title}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-mono text-[#60a5fa]">⚔️ {board.me.basePower}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MÁY TẠO THẺ VINH DANH STORY 9:16 & 16:9 (VIRAL STORY ENGINE) */}
          {activeTab === 'viral_card' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/30 rounded-2xl p-6 sm:p-8">
                <div className="flex flex-col lg:flex-row gap-8 items-start justify-between">
                  {/* Cột Trái: Bộ Điều Khiển Thẻ */}
                  <div className="w-full lg:w-1/2 space-y-6">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold uppercase mb-2">
                        <span>📸</span> 1-CLICK VIRAL STORY CARD
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-white">
                        Máy Tạo Thẻ Vinh Danh Flex Story
                      </h2>
                      <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                        Tạo tấm thẻ đồ họa cực chất thể hiện điểm SAT mục tiêu, danh hiệu chiến binh và màu cờ sắc áo trường THPT. Tải về khoe ngay lên Instagram, TikTok, Facebook Story!
                      </p>
                    </div>

                    {/* Bộ Chọn Định Dạng */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">1. Định Dạng Thẻ:</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setCardRatio('story')}
                          className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                            cardRatio === 'story'
                              ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>📱</span> Story 9:16 (IG / TikTok)
                        </button>
                        <button
                          onClick={() => setCardRatio('post')}
                          className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                            cardRatio === 'post'
                              ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>💻</span> Feed 16:9 (FB / Zalo)
                        </button>
                      </div>
                    </div>

                    {/* Bộ Chọn Theme Phong Cách */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">2. Phong Cách Màu Sắc:</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'gold', label: '👑 Hoàng Gia', color: 'from-amber-600 to-yellow-600' },
                          { id: 'cyber', label: '🌌 Cyber Neon', color: 'from-indigo-600 to-purple-600' },
                          { id: 'neon', label: '⚡ Emerald Pro', color: 'from-emerald-600 to-teal-600' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setCardTheme(t.id as any)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                              cardTheme === t.id
                                ? 'bg-gradient-to-r text-white border-white shadow'
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            } ${t.color}`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bộ Chọn Danh Hiệu Chiến Binh */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">3. Danh Hiệu Của Bạn:</label>
                      <select
                        value={selectedTitle}
                        onChange={(e) => setSelectedTitle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-400"
                      >
                        {VIRAL_TITLES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Các Nút Hành Động */}
                    <div className="space-y-3 pt-2">
                      <button
                        onClick={handleDownloadStoryCard}
                        className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 hover:opacity-95 text-white font-black py-3.5 px-6 rounded-xl text-base shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
                      >
                        <span>📥</span> Tải Thẻ Ảnh Story Về Máy (PNG Nét Căng)
                      </button>

                      <button
                        onClick={() => {
                          const schoolHashtag = (board?.userSchool?.schoolName || selectedSchool || 'SAT')
                            .replace(/[^a-zA-Z0-9]/g, '');
                          const caption = `🔥 Đã sẵn sàng chinh phục mục tiêu ${board?.userSchool?.targetScore || 1500}+ SAT cùng đội ngũ SAT GURU Việt Nam! Quyết tâm đem vinh quang về cho ${
                            board?.userSchool?.schoolName || selectedSchool
                          }! 👑\n\nBạn nào muốn solo 5 câu SAT tốc độ thì vào đây thách đấu tôi nhé: ${board?.referralStats?.challengeUrl}\n\n#SATGuru #SAT2026 #DigitalSAT #IvyLeague #${schoolHashtag}`;
                          handleCopy(caption, 'Caption Story có sẵn hashtag');
                        }}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-purple-200 border border-purple-700/60 font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>📋</span> Copy Caption Flex Story Kèm Hashtag Trường
                      </button>
                    </div>
                  </div>

                  {/* Cột Phải: Xem Trước Thẻ Canvas (Interactive Preview) */}
                  <div className="w-full lg:w-1/2 flex flex-col items-center">
                    <div className="text-xs text-slate-400 font-medium mb-3 flex items-center gap-1">
                      <span>👁️</span> BẢN XEM TRƯỚC THỰC TẾ:
                    </div>
                    <div className="w-full max-w-[360px] rounded-2xl overflow-hidden border-2 border-purple-500/40 shadow-2xl bg-black">
                      <canvas ref={canvasRef} className="w-full h-auto block" />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-3 text-center">
                      Mẹo: Nhấn nút <strong>"Tải Thẻ Ảnh"</strong> ở trên hoặc nhấp chuột phải / giữ tay để lưu ảnh vào điện thoại!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: THÁCH ĐẤU 1v1 & TẶNG 7 NGÀY PRO */}
          {activeTab === 'challenge' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Box 1: THÁCH ĐẤU SOLO 1v1 TỐC ĐỘ */}
              <div className="bg-gradient-to-br from-red-950/70 via-slate-900 to-amber-950/60 border-2 border-rose-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold uppercase">
                      <span>⚔️</span> ĐẤU TRƯỜNG TỐC ĐỘ 1v1
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white">
                      Gửi Lời Thách Đấu 5 Câu SAT Tốc Độ Cho Bạn Bè!
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                      Bạn tự tin vào phản xạ và tốc độ bấm máy Desmos hay đọc lướt logic? Hãy gửi link thách đấu 1v1. 5 câu hỏi ngẫu nhiên trong 4 phút — ai đúng nhiều hơn và nhanh hơn sẽ giành cúp và cướp 50 điểm lực chiến!
                    </p>
                    <div className="flex items-center gap-4 text-xs text-amber-300 font-semibold pt-1">
                      <span>⚡ 5 Câu Ngẫu Nhiên</span>
                      <span>⏱️ 4 Phút Đếm Ngược</span>
                      <span>🏆 Vinh Quang Sàn Đấu</span>
                    </div>
                  </div>

                  {/* Nút Tạo & Copy Link Thách Đấu */}
                  <div className="bg-slate-950 p-6 rounded-2xl border border-rose-500/30 text-center space-y-4 w-full lg:w-auto min-w-[320px]">
                    <div className="text-3xl">⚔️ 🥊 ⚡</div>
                    <div className="text-xs text-slate-400">Link Khiêu Chiến Cá Nhân Của Bạn:</div>
                    <div className="bg-slate-900 px-3 py-2 rounded-lg font-mono text-xs text-amber-300 truncate border border-slate-800">
                      {board.referralStats?.challengeUrl || 'https://satguru.edu.vn/arena?mode=speed5'}
                    </div>
                    <button
                      onClick={() => {
                        const url = board.referralStats?.challengeUrl || 'https://satguru.edu.vn/arena?mode=speed5';
                        const msg = `⚔️ TÔI THÁCH BẠN DÁM SOLO 5 CÂU SAT TỐC ĐỘ VỚI TÔI!\nAi thua phải bao chè bưởi / trà sữa nhé! Bấm vào đây đấu ngay: ${url}`;
                        handleCopy(msg, 'Link thách đấu 1v1');
                      }}
                      className="w-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-black py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-rose-600/30 active:scale-95"
                    >
                      🔥 Sao Chép Lời Thách Đấu Ngay
                    </button>
                  </div>
                </div>
              </div>

              {/* Box 2: TẶNG BẠN 7 NGÀY PRO — NHẬN NGAY 7 NGÀY PRO + 500 XU */}
              <div className="bg-gradient-to-br from-emerald-950/70 via-slate-900 to-teal-950/60 border-2 border-emerald-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase">
                      <span>🎁</span> CHƯƠNG TRÌNH ĐỒNG ĐỘI WIN - WIN
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white">
                      Tặng Bạn 7 Ngày VIP Pro — Nhận Ngay 7 Ngày Pro + 500 Xu
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                      Chia sẻ đường link đăng ký cho bạn bè cùng trường. Khi bạn bè đăng ký và bắt đầu làm bài luyện đề đầu tiên:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="bg-slate-900/80 p-3 rounded-xl border border-emerald-500/30">
                        <div className="text-emerald-400 font-bold text-xs">👤 BẠN BÈ ĐƯỢC NHẬN:</div>
                        <div className="text-white font-black text-sm mt-0.5">7 Ngày Trải Nghiệm Pro Miễn Phí + 200 Xu</div>
                      </div>
                      <div className="bg-slate-900/80 p-3 rounded-xl border border-amber-500/30">
                        <div className="text-amber-400 font-bold text-xs">👑 BẠN ĐƯỢC NHẬN:</div>
                        <div className="text-white font-black text-sm mt-0.5">+7 Ngày Pro Cộng Dồn + 500 Xu Luyện Đề</div>
                      </div>
                    </div>
                  </div>

                  {/* Bảng Thống Kê Giới Thiệu Của Bạn */}
                  <div className="bg-slate-950 p-6 rounded-2xl border border-emerald-500/30 w-full lg:w-auto min-w-[340px] space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <span className="text-xs text-slate-400">Mã giới thiệu của bạn:</span>
                      <span className="font-mono font-black text-amber-300 text-base">
                        {board.referralStats?.code || 'SAT-GURU26'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center py-1">
                      <div className="bg-slate-900 p-2 rounded-lg">
                        <div className="text-slate-400 text-[10px]">Đã Mời</div>
                        <div className="font-black text-white text-base">
                          {board.referralStats?.invitedCount ?? 3} 👥
                        </div>
                      </div>
                      <div className="bg-slate-900 p-2 rounded-lg">
                        <div className="text-slate-400 text-[10px]">Pro Đã Nhận</div>
                        <div className="font-black text-emerald-400 text-base">
                          +{board.referralStats?.bonusDaysPro ?? 21} ngày
                        </div>
                      </div>
                      <div className="bg-slate-900 p-2 rounded-lg">
                        <div className="text-slate-400 text-[10px]">Xu Thưởng</div>
                        <div className="font-black text-amber-300 text-base">
                          +{board.referralStats?.bonusCoins ?? 1500} 🪙
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const url = board.referralStats?.referralUrl || 'https://satguru.edu.vn';
                        const msg = `🎁 Tặng bạn 7 ngày dùng thử gói Pro SAT GURU hoàn toàn miễn phí để cùng nhau đạt 1500+ SAT nhé! Đăng ký ngay tại link này: ${url}`;
                        handleCopy(msg, 'Link giới thiệu nhận 7 ngày Pro');
                      }}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black py-3 px-4 rounded-xl text-sm transition-all shadow-lg active:scale-95"
                    >
                      🔗 Sao Chép Link Tặng 7 Ngày Pro
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
