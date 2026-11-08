'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';

interface BossInfo {
  id: string;
  name: string;
  vietnameseTitle: string;
  domain: string;
  domainSlug: string;
  category: 'math' | 'reading-writing';
  icon: string;
  element: string;
  maxHp: number;
  description: string;
  keySkills: string[];
  recommendedPreparation: string;
  rewards: {
    gems: number;
    title: string;
    badge: string;
    chestName: string;
  };
}

const BOSS_LIST: BossInfo[] = [
  // 4 BOSS TOÁN
  {
    id: 'boss-algebra',
    name: 'Algebra Titan',
    vietnameseTitle: 'Thần Binh Đại Số Tuyến Tính',
    domain: 'Algebra',
    domainSlug: 'algebra',
    category: 'math',
    icon: '⚡',
    element: 'Lôi Điện (Lightning)',
    maxHp: 1000,
    description: 'Thủ lĩnh trấn giữ phương trình bậc nhất, hệ hai phương trình, bất đẳng thức tuyến tính và đồ thị tọa độ $xy$.',
    keySkills: ['Linear Equations in 1 Variable', 'Linear Equations in 2 Variables', 'Linear Functions', 'Systems of Two Linear Equations'],
    recommendedPreparation: 'Nắm vững phép thế, phương pháp cộng đại số và ý nghĩa hệ số góc (slope) trong bài toán thực tế.',
    rewards: {
      gems: 500,
      title: 'Chúa Tể Đại Số Tuyến Tính',
      badge: '⚡ Algebra Conqueror',
      chestName: 'Rương Báu Sấm Sét Đại Số'
    }
  },
  {
    id: 'boss-adv-math',
    name: 'Advanced Math Dragon',
    vietnameseTitle: 'Hắc Long Toán Cao Cấp',
    domain: 'Advanced Math',
    domainSlug: 'advanced-math',
    category: 'math',
    icon: '🐉',
    element: 'Hắc Hỏa (Dark Fire)',
    maxHp: 1200,
    description: 'Chúa tể thống trị đa thức, biểu thức hữu tỉ, hàm mũ, phương trình bậc hai phi tuyến và nghiệm ảo phức tạp.',
    keySkills: ['Equivalent Expressions', 'Nonlinear Equations in 1 Variable', 'Nonlinear Functions & Graphs', 'Exponential Functions'],
    recommendedPreparation: 'Luyện kỹ dạng đỉnh (vertex form), công thức nghiệm bậc hai và biến đổi số mũ phân số.',
    rewards: {
      gems: 600,
      title: 'Kẻ Diệt Rồng Toán Cao Cấp',
      badge: '🐉 Dragon Slayer',
      chestName: 'Rương Long Tộc Thượng Đẳng'
    }
  },
  {
    id: 'boss-data',
    name: 'Data Golem',
    vietnameseTitle: 'Thạch Thần Phân Tích Dữ Liệu',
    domain: 'Problem-Solving & Data Analysis',
    domainSlug: 'problem-solving',
    category: 'math',
    icon: '🗿',
    element: 'Địa Nham (Earth & Magma)',
    maxHp: 1000,
    description: 'Người khổng lồ đá quản lý xác suất có điều kiện, bảng tần số hai chiều, độ lệch chuẩn và tương quan thống kê.',
    keySkills: ['Ratios, Rates & Proportions', 'Percentages', 'One-variable Data: Distributions & Measures of Center', 'Two-way Tables & Probability'],
    recommendedPreparation: 'Cẩn thận với đơn vị đo lường và tỉ lệ xác suất dựa trên mẫu con (subgroup percentage).',
    rewards: {
      gems: 500,
      title: 'Bậc Thầy Thống Kê Dữ Liệu',
      badge: '📊 Data Mastermind',
      chestName: 'Rương Thạch Bảo Dữ Liệu'
    }
  },
  {
    id: 'boss-geom',
    name: 'Geometry Sphinx',
    vietnameseTitle: 'Nhân Sư Hình Học & Lượng Giác',
    domain: 'Geometry & Trigonometry',
    domainSlug: 'geometry',
    category: 'math',
    icon: '🦁',
    element: 'Kim Sa (Golden Sand)',
    maxHp: 1100,
    description: 'Kẻ canh giữ bí mật vòng tròn lượng giác, tam giác đồng dạng, diện tích xung quanh, thể tích và phương trình đường tròn.',
    keySkills: ['Area & Volume Formulas', 'Lines, Angles & Triangles', 'Right Triangles & Trigonometry', 'Circle Equations & Theorems'],
    recommendedPreparation: 'Nhớ kỹ định lý tam giác đặc biệt $30^\\circ-60^\\circ-90^\\circ$, sin/cos của hai góc phụ nhau và phương trình $(x-h)^2 + (y-k)^2 = r^2$.',
    rewards: {
      gems: 550,
      title: 'Chiêm Tinh Nhân Sư Hình Học',
      badge: '📐 Geometry Sphinx Master',
      chestName: 'Rương Cổ Tự Kim Tự Tháp'
    }
  },

  // 4 BOSS R&W
  {
    id: 'boss-vocab',
    name: 'Vocabulary Phantom',
    vietnameseTitle: 'Ảo Ảnh Từ Vựng Ngữ Cảnh',
    domain: 'Craft and Structure',
    domainSlug: 'craft-and-structure',
    category: 'reading-writing',
    icon: '👻',
    element: 'Hư Không (Void & Shadow)',
    maxHp: 1000,
    description: 'Bóng ma từ vựng SAT khó nuốt với các nghĩa phái sinh, từ vựng học thuật đa nghĩa và bẫy tương phản câu.',
    keySkills: ['Words in Context', 'Text Structure and Purpose', 'Cross-Text Connections'],
    recommendedPreparation: 'Dựa vào từ khóa bản lề (pivot words như however, nevertheless) để đoán nghĩa trước khi nhìn đáp án.',
    rewards: {
      gems: 500,
      title: 'Đại Pháp Sư Ngữ Nghĩa',
      badge: '📖 Lexicon Virtuoso',
      chestName: 'Rương Hư Không Tri Thức'
    }
  },
  {
    id: 'boss-structure',
    name: 'Structure Warden',
    vietnameseTitle: 'Cai Ngục Cấu Trúc Đoạn Văn',
    domain: 'Information and Ideas',
    domainSlug: 'information-and-ideas',
    category: 'reading-writing',
    icon: '🏰',
    element: 'Thiết Bích (Iron Citadel)',
    maxHp: 1050,
    description: 'Cai quản chức năng câu, bố cục lập luận tác giả và mối liên hệ giữa hai đoạn văn học thuật đối sánh.',
    keySkills: ['Central Ideas & Details', 'Inferences', 'Text Structure & Function'],
    recommendedPreparation: 'Phân tích vai trò của từng câu: Câu mở đề, luận điểm dẫn chứng, hay sự nhượng bộ phản biện.',
    rewards: {
      gems: 550,
      title: 'Kẻ Thấu Thị Luận Điểm',
      badge: '🏰 Architect of Logic',
      chestName: 'Rương Thiết Giáp Cấu Trúc'
    }
  },
  {
    id: 'boss-evidence',
    name: 'Evidence Oracle',
    vietnameseTitle: 'Nhà Tiên Tri Dẫn Chứng Thực Nghiệm',
    domain: 'Command of Evidence',
    domainSlug: 'command-of-evidence',
    category: 'reading-writing',
    icon: '🔮',
    element: 'Lam Tinh (Crystal Revelation)',
    maxHp: 1150,
    description: 'Đòi hỏi sự sắc bén tuyệt đối trong việc trích xuất bằng chứng văn bản hoặc biểu đồ thực nghiệm củng cố/bác bỏ giả thuyết.',
    keySkills: ['Command of Evidence (Textual)', 'Command of Evidence (Quantitative)', 'Hypothesis Verification'],
    recommendedPreparation: 'Đối chiếu số liệu cột/hàng trên biểu đồ trực tiếp với câu khẳng định trong giả thuyết nghiên cứu.',
    rewards: {
      gems: 600,
      title: 'Nhà Tiên Tri Sự Thật Khách Quan',
      badge: '🔮 Oracle of Truth',
      chestName: 'Rương Pha Lê Tiên Tri'
    }
  },
  {
    id: 'boss-grammar',
    name: 'Grammar Colossus',
    vietnameseTitle: 'Khổng Lồ Ngữ Pháp Chuẩn Mực',
    domain: 'Standard English Conventions',
    domainSlug: 'standard-english-conventions',
    category: 'reading-writing',
    icon: '🖋️',
    element: 'Kim Cương Bất Hoại (Diamond Bastion)',
    maxHp: 1000,
    description: 'Bức tường thành kiên cố của dấu ranh giới câu, bổ ngữ lơ lửng, mệnh đề quan hệ và hòa hợp chủ ngữ - vị ngữ.',
    keySkills: ['Boundaries: Semicolon, Colon & Dash', 'Form, Structure, and Sense', 'Subject-Verb & Pronoun Agreement'],
    recommendedPreparation: 'Nhận diện mệnh đề độc lập (Independent Clause) và các liên từ kết hợp FANBOYS để tránh lỗi Comma Splice.',
    rewards: {
      gems: 500,
      title: 'Hiệp Sĩ Ngữ Pháp Chuẩn Mực',
      badge: '🖋️ Master of Syntax',
      chestName: 'Rương Hoàng Gia Văn Phạm'
    }
  }
];

export default function BossPage() {
  const { showToast } = useToast();
  const [filterCategory, setFilterCategory] = useState<'all' | 'math' | 'reading-writing'>('all');
  const [masteryData, setMasteryData] = useState<Record<string, number>>({});
  const [claimedRewards, setClaimedRewards] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [selectedBoss, setSelectedBoss] = useState<BossInfo | null>(null);

  // Tải mastery từ /api/score và localStorage
  useEffect(() => {
    async function fetchScoresAndProgress() {
      setLoading(true);
      const masteryMap: Record<string, number> = {};

      // 1. Đọc từ localStorage trước nếu có
      try {
        const storedMastery = localStorage.getItem('sat_domain_mastery_v1');
        if (storedMastery) {
          const parsed = JSON.parse(storedMastery);
          Object.assign(masteryMap, parsed);
        }

        const storedClaimed = localStorage.getItem('sat_boss_rewards_claimed_v1');
        if (storedClaimed) {
          setClaimedRewards(JSON.parse(storedClaimed));
        }
      } catch (e) {
        console.error('Error reading localStorage:', e);
      }

      // 2. Fetch điểm thực tế từ /api/score
      try {
        const res = await fetch('/api/score');
        if (res.ok) {
          const data = await res.json();
          // Kiểm tra các định dạng phản hồi có thể có từ API
          if (data && typeof data === 'object') {
            const domainScores = data.domainScores || data.domains || data.scores || data.mastery || {};
            
            // Ánh xạ linh hoạt từ domain scores
            Object.keys(domainScores).forEach(key => {
              const val = domainScores[key];
              const scoreNum = typeof val === 'number' ? val : (val?.mastery || val?.score || 0);
              const lowerKey = key.toLowerCase();

              if (lowerKey.includes('algebra')) masteryMap['algebra'] = scoreNum;
              else if (lowerKey.includes('adv') || lowerKey.includes('nonlinear')) masteryMap['advanced-math'] = scoreNum;
              else if (lowerKey.includes('data') || lowerKey.includes('problem')) masteryMap['problem-solving'] = scoreNum;
              else if (lowerKey.includes('geom') || lowerKey.includes('trig')) masteryMap['geometry'] = scoreNum;
              else if (lowerKey.includes('craft') || lowerKey.includes('vocab')) masteryMap['craft-and-structure'] = scoreNum;
              else if (lowerKey.includes('info') || lowerKey.includes('structure')) masteryMap['information-and-ideas'] = scoreNum;
              else if (lowerKey.includes('evidence')) masteryMap['command-of-evidence'] = scoreNum;
              else if (lowerKey.includes('convention') || lowerKey.includes('grammar')) masteryMap['standard-english-conventions'] = scoreNum;
            });

            // Nếu có tổng điểm Math / RW từ API, gán nền tối thiểu nếu domain chưa có
            if (data.mathScore && typeof data.mathScore === 'number') {
              const mathPercent = Math.min(100, Math.round(((data.mathScore - 200) / 600) * 100));
              if (mathPercent > 0) {
                if (!masteryMap['algebra']) masteryMap['algebra'] = mathPercent;
                if (!masteryMap['advanced-math']) masteryMap['advanced-math'] = Math.max(0, mathPercent - 10);
                if (!masteryMap['problem-solving']) masteryMap['problem-solving'] = mathPercent;
                if (!masteryMap['geometry']) masteryMap['geometry'] = Math.max(0, mathPercent - 5);
              }
            }
            if (data.rwScore && typeof data.rwScore === 'number') {
              const rwPercent = Math.min(100, Math.round(((data.rwScore - 200) / 600) * 100));
              if (rwPercent > 0) {
                if (!masteryMap['craft-and-structure']) masteryMap['craft-and-structure'] = rwPercent;
                if (!masteryMap['information-and-ideas']) masteryMap['information-and-ideas'] = rwPercent;
                if (!masteryMap['command-of-evidence']) masteryMap['command-of-evidence'] = Math.max(0, rwPercent - 5);
                if (!masteryMap['standard-english-conventions']) masteryMap['standard-english-conventions'] = rwPercent;
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch /api/score, fallback to local data:', err);
      }

      // Đảm bảo mọi domain đều có giá trị mặc định để hiển thị đẹp
      BOSS_LIST.forEach(b => {
        if (masteryMap[b.domainSlug] === undefined) {
          // Giá trị mặc định mô phỏng khởi đầu từ 15% - 40% nếu chưa có dữ liệu
          masteryMap[b.domainSlug] = 25;
        }
      });

      setMasteryData(masteryMap);
      setLoading(false);
    }

    fetchScoresAndProgress();
  }, []);

  const handleClaimChest = (boss: BossInfo) => {
    if (claimedRewards[boss.id]) return;

    const newClaimed = { ...claimedRewards, [boss.id]: true };
    setClaimedRewards(newClaimed);
    try {
      localStorage.setItem('sat_boss_rewards_claimed_v1', JSON.stringify(newClaimed));
      
      // Cộng dọn tiền vàng và đá quý vào hệ thống nếu có
      const currentGems = parseInt(localStorage.getItem('sat_user_gems') || '120', 10);
      localStorage.setItem('sat_user_gems', (currentGems + boss.rewards.gems).toString());
    } catch (e) {
      console.error(e);
    }

    showToast(`🎉 CHÚC MỪNG! Bạn đã mở [${boss.rewards.chestName}], nhận ${boss.rewards.gems} Kim Cương & Danh hiệu: "${boss.rewards.title}"!`, 'success');
  };

  const filteredBosses = BOSS_LIST.filter(b => {
    if (filterCategory === 'all') return true;
    return b.category === filterCategory;
  });

  const defeatedCount = BOSS_LIST.filter(b => {
    const mastery = masteryData[b.domainSlug] || 0;
    return mastery >= 85;
  }).length;

  // #C074: Danh sách Boss thuộc kỹ năng còn yếu (< 60% Mastery) nhận Đòn Chí Mạng x2
  const weakBosses = BOSS_LIST.filter(b => (masteryData[b.domainSlug] || 0) < 60);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-24 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header Đấu Trường Boss */}
      <div 
        className="math-academy-header epic-shake-active relative overflow-hidden rounded-2xl p-6 sm:p-8 border border-red-900/50 shadow-2xl" 
        style={{ background: "linear-gradient(135deg, #1e0505 0%, #3b0707 50%, #0f172a 100%)" }}
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-500/30 text-xs font-bold text-red-400 uppercase tracking-widest">
              <span>⚔️ ĐẤU TRƯỜNG HUYỀN THOẠI DIGITAL SAT</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-amber-300 to-yellow-500 tracking-tight">
              8 ĐẠI BOSS HỌC THUẬT
            </h1>
            <p className="text-gray-300 text-sm sm:text-base max-w-2xl leading-relaxed">
              Trực diện đương đầu với 8 Vị Thần trấn giữ 8 Domain cốt lõi của bài thi SAT. Rèn giũa Mastery để hạ gục thanh máu Boss, đoạt Rương Báu Huyền Thoại và mở khóa Cổng Kỳ Thi Đích Thực!
            </p>
          </div>

          {/* Huy hiệu chiến tích tổng hợp */}
          <div className="bg-[#111827]/90 border border-amber-500/30 p-4 rounded-xl flex items-center gap-5 shadow-xl min-w-[240px]">
            <div className="text-4xl animate-bounce">🏆</div>
            <div>
              <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">Tiến Độ Diệt Boss</div>
              <div className="text-2xl font-black text-white">
                <span className="text-amber-400">{defeatedCount}</span> / 8 <span className="text-xs text-gray-400 font-normal">Đã Thu Phục</span>
              </div>
              <div className="w-full bg-gray-800 h-2 rounded-full mt-2 overflow-hidden border border-gray-700">
                <div 
                  className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full transition-all duration-1000"
                  style={{ width: `${(defeatedCount / 8) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vòng Lặp 4 Bước Liên Kết Nhanh */}
      <div className="bg-[#0f172a]/80 border border-blue-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <span className="font-bold text-blue-400 flex items-center gap-2">
          <span>🔄</span> VÒNG LẶP 4 BƯỚC SAT MASTERY:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/skill-tree" className="px-3 py-1.5 rounded-lg bg-[#1e293b] hover:bg-blue-600/20 text-gray-300 hover:text-blue-300 border border-gray-700 transition">
            1. 🌳 Cây Kỹ Năng
          </Link>
          <span className="text-gray-600">→</span>
          <Link href="/grind" className="px-3 py-1.5 rounded-lg bg-[#1e293b] hover:bg-emerald-600/20 text-gray-300 hover:text-emerald-300 border border-gray-700 transition">
            2. 🎯 Grind Thích Ứng
          </Link>
          <span className="text-gray-600">→</span>
          <Link href="/forge" className="px-3 py-1.5 rounded-lg bg-[#1e293b] hover:bg-amber-600/20 text-gray-300 hover:text-amber-300 border border-gray-700 transition">
            3. 🔥 Lò Rèn Câu Sai
          </Link>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-300 font-bold border border-red-500/40">
            4. ⚔️ Đấu Trường Boss (Bạn Đang Ở Đây)
          </span>
        </div>
      </div>

      {/* #C074: Banner Đòn Chí Mạng Kỹ Năng Yếu (x2 Sát thương khi diệt đúng lỗ hổng kiến thức) */}
      <div className="bg-gradient-to-r from-red-950/70 via-amber-950/40 to-slate-900/80 border-2 border-red-500/40 rounded-2xl p-5 shadow-[0_0_30px_rgba(239,68,68,0.2)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-600/20 border border-red-500/50 flex items-center justify-center text-2xl shrink-0 animate-pulse">
            💥
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-red-600 text-white shadow-sm">
                Cơ chế Đòn Chí Mạng x2
              </span>
              <h3 className="text-base font-black text-white">
                Săn Boss Điểm Yếu: Nhân Đôi Sát Thương Khi Bịt Lỗ Hổng Kiến Thức!
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Tấn công vào Boss có tỉ lệ Tinh thông &lt; 60% sẽ kích hoạt <strong className="text-amber-300">Đòn Chí Mạng (Critical Hit x2)</strong>. 
              Mỗi câu trả lời đúng tại các kỹ năng yếu vừa giúp bạn hạ máu Boss thần tốc, vừa xóa sổ triệt để điểm mù kiến thức trước kỳ thi thật!
            </p>
            {weakBosses.length > 0 && (
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[11px] font-bold text-red-400">Mục tiêu chí mạng hiện tại:</span>
                {weakBosses.map(b => (
                  <span key={b.id} className="text-[11px] font-semibold bg-red-950/80 text-amber-200 border border-red-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span>{b.icon}</span> {b.name} ({masteryData[b.domainSlug] || 0}%)
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <Link
          href="/grind"
          className="shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-transform hover:scale-105 flex items-center gap-1.5"
        >
          <span>🎯</span> Kích hoạt x2 ngay
        </Link>
      </div>

      {/* Tabs Phân Loại */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-2 bg-[#1e293b]/60 p-1.5 rounded-xl border border-gray-800">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              filterCategory === 'all'
                ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            Tất Cả Đại Boss (8)
          </button>
          <button
            onClick={() => setFilterCategory('math')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              filterCategory === 'math'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            📐 Boss Toán Học (4)
          </button>
          <button
            onClick={() => setFilterCategory('reading-writing')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              filterCategory === 'reading-writing'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            📖 Boss Đọc & Viết (4)
          </button>
        </div>

        <div className="text-xs text-gray-400 flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span>Dữ liệu Mastery tự động đồng bộ từ bài luyện tập & thi thử</span>
        </div>
      </div>

      {/* Grid Danh Sách 8 Đại Boss */}
      {loading ? (
        <div className="text-center py-20 bg-[#0f172a] rounded-2xl border border-gray-800">
          <div className="text-5xl animate-spin mb-4">⚔️</div>
          <p className="text-gray-400 font-medium">Đang triệu hồi dữ liệu 8 Đại Boss và chỉ số HP...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredBosses.map((boss) => {
            const mastery = masteryData[boss.domainSlug] || 0;
            // Boss HP tỷ lệ nghịch với Mastery: Mastery càng cao -> Máu Boss càng tụt
            const remainingHpPercent = Math.max(0, 100 - mastery);
            const currentHp = Math.round((remainingHpPercent / 100) * boss.maxHp);
            const isDefeated = mastery >= 85 || currentHp <= 0;
            const isWeakened = mastery >= 50 && !isDefeated;
            const isClaimed = claimedRewards[boss.id];

            return (
              <div
                key={boss.id}
                className={`group relative flex flex-col justify-between rounded-2xl bg-gradient-to-b from-[#161f30] to-[#0b101b] border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl overflow-hidden ${
                  isDefeated
                    ? 'border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                    : isWeakened
                    ? 'border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                    : 'border-red-900/40 hover:border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                }`}
              >
                {/* Dải băng trạng thái */}
                <div className="absolute top-3 right-3 z-10">
                  {isDefeated ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow">
                      👑 ĐÃ BỊ HẠ GỤC
                    </span>
                  ) : isWeakened ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      ⚡ ĐANG SUY YẾU
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/40 animate-pulse">
                      🔥 HÙNG MẠNH
                    </span>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  {/* Avatar & Nguyên tố */}
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-[#090d16] border border-gray-700/80 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                      {boss.icon}
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        {boss.element}
                      </div>
                      <h3 className="font-black text-lg text-white group-hover:text-amber-400 transition-colors leading-tight">
                        {boss.name}
                      </h3>
                      <p className="text-xs text-gray-400 font-medium">
                        {boss.vietnameseTitle}
                      </p>
                    </div>
                  </div>

                  {/* Thanh Máu Boss (HP Bar) */}
                  <div className="space-y-1.5 bg-[#090d16]/80 p-3 rounded-xl border border-gray-800">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-gray-400 flex items-center gap-1">
                        <span>❤️</span> Sinh Lực Boss:
                      </span>
                      <span className={`font-bold ${isDefeated ? 'text-amber-400' : currentHp < boss.maxHp * 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {currentHp} / {boss.maxHp} HP ({remainingHpPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-900 h-3 rounded-full overflow-hidden border border-gray-700/60 p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isDefeated
                            ? 'bg-gray-600'
                            : remainingHpPercent < 30
                            ? 'bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400'
                            : 'bg-gradient-to-r from-red-700 to-red-500'
                        }`}
                        style={{ width: `${remainingHpPercent}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-gray-400 pt-1">
                      <span>Mức độ thông thạo của bạn:</span>
                      <span className="font-bold text-emerald-400">{mastery}% Mastery</span>
                    </div>
                  </div>

                  {/* Mô tả ngắn */}
                  <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                    {boss.description}
                  </p>

                  {/* Kỹ năng trọng tâm */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Kỹ năng tử huyệt:</span>
                    <div className="flex flex-wrap gap-1">
                      {boss.keySkills.slice(0, 2).map((skill, sIdx) => (
                        <span key={sIdx} className="text-[10px] px-2 py-0.5 rounded bg-gray-800/80 text-gray-300 border border-gray-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Phần Thưởng & Các Nút Hành Động */}
                <div className="p-5 pt-0 space-y-3">
                  {/* Rương báu khi hạ Boss */}
                  <div className="bg-[#0b101b] border border-amber-500/20 rounded-xl p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{isDefeated ? '🎁' : '🔒'}</span>
                      <div className="text-[11px]">
                        <div className="font-bold text-amber-300 leading-tight">
                          {boss.rewards.chestName}
                        </div>
                        <div className="text-gray-400">+{boss.rewards.gems} 💎 • {boss.rewards.title}</div>
                      </div>
                    </div>

                    {isDefeated && !isClaimed && (
                      <button
                        onClick={() => handleClaimChest(boss)}
                        className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-black text-xs rounded-lg shadow-md animate-pulse transition"
                      >
                        Mở Rương
                      </button>
                    )}
                    {isClaimed && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                        ✓ Đã Nhận
                      </span>
                    )}
                  </div>

                  {/* Nút hành động chính */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedBoss(boss)}
                      className="w-full py-2 bg-[#1e293b] hover:bg-[#334155] text-gray-300 hover:text-white text-xs font-bold rounded-xl border border-gray-700 transition flex items-center justify-center gap-1"
                    >
                      <span>🔍</span> Chiến Thuật
                    </button>

                    <Link
                      href={`/gate-exam/${boss.domainSlug}`}
                      className="w-full py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-xs font-black rounded-xl shadow-[0_0_15px_rgba(220,38,38,0.4)] transition hover:scale-[1.02] flex items-center justify-center gap-1"
                    >
                      <span>⚔️</span> Khiêu Chiến
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Chiến Thuật & Thông Tin Chi Tiết Boss */}
      {selectedBoss && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-gray-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedBoss(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 text-lg font-bold"
            >
              ✕
            </button>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1e293b] border border-gray-700 flex items-center justify-center text-4xl">
                {selectedBoss.icon}
              </div>
              <div>
                <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">{selectedBoss.element}</div>
                <h2 className="text-2xl font-black text-white">{selectedBoss.name}</h2>
                <p className="text-sm text-gray-400">{selectedBoss.vietnameseTitle}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-[#1e293b]/70 p-3.5 rounded-xl border border-gray-800">
                <h4 className="text-xs uppercase font-bold text-blue-400 mb-1">📖 Khái Quát Về Boss:</h4>
                <p className="text-gray-300 text-xs leading-relaxed">{selectedBoss.description}</p>
              </div>

              <div className="bg-[#1e293b]/70 p-3.5 rounded-xl border border-gray-800">
                <h4 className="text-xs uppercase font-bold text-amber-400 mb-1">🎯 Điểm Yếu & Lời Khuyên Chiến Thuật:</h4>
                <p className="text-gray-300 text-xs leading-relaxed">{selectedBoss.recommendedPreparation}</p>
              </div>

              <div className="bg-[#1e293b]/70 p-3.5 rounded-xl border border-gray-800">
                <h4 className="text-xs uppercase font-bold text-emerald-400 mb-1.5">🗝️ Kỹ Năng Quyết Định Thắng Bại:</h4>
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-300">
                  {selectedBoss.keySkills.map((sk, i) => (
                    <li key={i}>{sk}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href={`/grind?domain=${selectedBoss.domainSlug}`}
                className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition"
              >
                Rèn Kỹ Năng (/grind)
              </Link>
              <Link
                href={`/gate-exam/${selectedBoss.domainSlug}`}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 text-white text-xs font-black shadow-lg transition"
              >
                ⚔️ Khiêu Chiến Boss Ngay
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
