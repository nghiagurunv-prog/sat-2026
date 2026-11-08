'use client';

import React, { useState, useId } from 'react';
import Link from 'next/link';

// Types for Teacher Classroom Management
interface Classroom {
  id: string;
  name: string;
  code: string;
  targetScore: number;
  season: string;
  studentCount: number;
  averageScore: number;
  completionRate: number; // percentage
  topWeakness: string;
}

interface SkillHeatmapItem {
  id: string;
  domain: 'Math' | 'Reading & Writing';
  skillName: string;
  subtopic: string;
  masteryRate: number; // 0 - 100
  failRate: number;    // % students struggling
  strugglingCount: number;
  totalTested: number;
  satWeight: string; // e.g. "12-15% đề thi"
}

interface HomeworkAssignment {
  id: string;
  classId: string;
  title: string;
  domain: string;
  questionCount: number;
  deadline: string;
  submittedCount: number;
  totalCount: number;
  code: string;
  createdAt: string;
}

interface AtRiskStudent {
  id: string;
  name: string;
  avatar: string;
  classCode: string;
  parentPhone: string;
  inactiveDays: number;
  currentEstimatedScore: number;
  scoreDelta: number; // e.g. -60
  primaryIssue: string;
  lastActive: string;
  status: 'critical' | 'warning' | 'resolved';
}

export default function TeacherPortalPage() {
  const customModalId = useId();

  // Initial Classrooms
  const [classrooms, setClassrooms] = useState<Classroom[]>([
    {
      id: 'cls-1',
      name: 'Lớp SAT Chuyên Sâu 1500+ Ams - CSP (K26)',
      code: 'CLASS-AMS-1500',
      targetScore: 1500,
      season: 'SAT Tháng 12/2026',
      studentCount: 32,
      averageScore: 1410,
      completionRate: 91,
      topWeakness: 'Dấu câu Boundaries & Hàm bậc hai nâng cao',
    },
    {
      id: 'cls-2',
      name: 'Lớp Luyện Đề Nước Rút 1400+ Chu Văn An - Kim Liên',
      code: 'CLASS-CVA-1400',
      targetScore: 1400,
      season: 'SAT Tháng 11/2026',
      studentCount: 28,
      averageScore: 1335,
      completionRate: 84,
      topWeakness: 'Biến đổi đồ thị & Logical Transitions',
    },
    {
      id: 'cls-3',
      name: 'Gia Sư 1 kèm 5 - Mục Tiêu Học Bổng Mỹ 1530+',
      code: 'VIP-IVY-1530',
      targetScore: 1530,
      season: 'SAT Tháng 03/2027',
      studentCount: 5,
      averageScore: 1470,
      completionRate: 98,
      topWeakness: 'Trắc nghiệm từ vựng vĩ mô (Words in Context)',
    },
  ]);

  const [activeClassId, setActiveClassId] = useState<string>('cls-1');
  const activeClass = classrooms.find((c) => c.id === activeClassId) || classrooms[0] || {
    id: 'empty',
    name: 'Chưa có lớp học',
    code: 'CLASS-NONE',
    targetScore: 1400,
    season: '2026',
    studentCount: 0,
    averageScore: 0,
    completionRate: 0,
    topWeakness: 'Chưa có dữ liệu',
  };

  // Classroom Code Generator Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newTargetScore, setNewTargetScore] = useState(1450);
  const [newSeason, setNewSeason] = useState('SAT Tháng 12/2026');
  const [copiedCodeNotice, setCopiedCodeNotice] = useState<string | null>(null);

  // Skill Heatmap Data
  const [activeDomainFilter, setActiveDomainFilter] = useState<'All' | 'Math' | 'Reading & Writing'>('All');
  const [skillsHeatmap] = useState<SkillHeatmapItem[]>([
    {
      id: 'sk-1',
      domain: 'Reading & Writing',
      skillName: 'Boundaries (Dấu câu ngắt mệnh đề & câu ghép)',
      subtopic: 'Semicolons, Colons, Dashes, Comma Splices',
      masteryRate: 32,
      failRate: 68,
      strugglingCount: 22,
      totalTested: 32,
      satWeight: '12 - 15% R&W',
    },
    {
      id: 'sk-2',
      domain: 'Math',
      skillName: 'Hàm số bậc hai & Đồ thị Parabol (Advanced Math)',
      subtopic: 'Vertex form, Discriminant, Phép dịch chuyển đồ thị',
      masteryRate: 35,
      failRate: 65,
      strugglingCount: 21,
      totalTested: 32,
      satWeight: '15 - 18% Math',
    },
    {
      id: 'sk-3',
      domain: 'Reading & Writing',
      skillName: 'Logical Transitions (Từ nối logic & lập luận)',
      subtopic: 'Contrast, Continuation, Cause/Effect, Concession',
      masteryRate: 48,
      failRate: 52,
      strugglingCount: 17,
      totalTested: 32,
      satWeight: '8 - 10% R&W',
    },
    {
      id: 'sk-4',
      domain: 'Math',
      skillName: 'Hệ phương trình tuyến tính chứa tham số k (Algebra)',
      subtopic: 'No solution, Infinite solutions, Intersecting lines',
      masteryRate: 54,
      failRate: 46,
      strugglingCount: 15,
      totalTested: 32,
      satWeight: '10 - 12% Math',
    },
    {
      id: 'sk-5',
      domain: 'Reading & Writing',
      skillName: 'Central Idea & Details (Đọc hiểu ý chính)',
      subtopic: 'Scientific Passages & Dual Perspective Claims',
      masteryRate: 74,
      failRate: 26,
      strugglingCount: 8,
      totalTested: 32,
      satWeight: '10 - 12% R&W',
    },
    {
      id: 'sk-6',
      domain: 'Math',
      skillName: 'Hình học tọa độ & Lượng giác cơ bản (Geometry & Trig)',
      subtopic: 'Circle equations, Right triangle trig, Radians',
      masteryRate: 81,
      failRate: 19,
      strugglingCount: 6,
      totalTested: 32,
      satWeight: '6 - 8% Math',
    },
  ]);

  // Homework Dispatch State
  const [homeworkList, setHomeworkList] = useState<HomeworkAssignment[]>([
    {
      id: 'hw-101',
      classId: 'cls-1',
      title: 'Bẫy Dấu Câu Boundaries - Đề Luyện Cấp Tốc 15 Phút',
      domain: 'Reading & Writing',
      questionCount: 10,
      deadline: '22:00 Hôm nay',
      submittedCount: 28,
      totalCount: 32,
      code: 'HW-BD-101',
      createdAt: 'Hôm nay, 08:30',
    },
    {
      id: 'hw-102',
      classId: 'cls-1',
      title: 'Parabol & Điểm Cực Trị Nâng Cao Không Bấm Máy',
      domain: 'Math',
      questionCount: 12,
      deadline: '23:59 Ngày mai',
      submittedCount: 19,
      totalCount: 32,
      code: 'HW-M-PARABOL',
      createdAt: 'Hôm qua, 15:00',
    },
  ]);

  const [hwTitle, setHwTitle] = useState('Chuyên đề khắc phục hổng kiến thức Boundaries');
  const [hwDomain, setHwDomain] = useState('Reading & Writing');
  const [hwCount, setHwCount] = useState<number>(10);
  const [hwDeadline, setHwDeadline] = useState('22:00 Chủ Nhật');
  const [generatedHwMessage, setGeneratedHwMessage] = useState<string | null>(null);

  // At-Risk Students State
  const [atRiskList] = useState<AtRiskStudent[]>([
    {
      id: 'st-01',
      name: 'Nguyễn Trần Minh Đức (Ams)',
      avatar: '👨‍🎓',
      classCode: 'CLASS-AMS-1500',
      parentPhone: '0912.888.xxx (Bố Tuấn)',
      inactiveDays: 4,
      currentEstimatedScore: 1330,
      scoreDelta: -60,
      primaryIssue: 'Nghỉ làm bài 4 ngày, sai 6/7 câu Hàm số bậc hai',
      lastActive: '4 ngày trước',
      status: 'critical',
    },
    {
      id: 'st-02',
      name: 'Phạm Quỳnh Chi (Chu Văn An)',
      avatar: '👩‍🎓',
      classCode: 'CLASS-AMS-1500',
      parentPhone: '0983.666.xxx (Mẹ Hằng)',
      inactiveDays: 3,
      currentEstimatedScore: 1360,
      scoreDelta: -40,
      primaryIssue: 'Chưa nộp bài tập Boundaries, tụt 40đ bài test Tuần 3',
      lastActive: '3 ngày trước',
      status: 'warning',
    },
    {
      id: 'st-03',
      name: 'Lê Hoàng Nam (Chuyên Sư Phạm)',
      avatar: '🧑‍💻',
      classCode: 'CLASS-AMS-1500',
      parentPhone: '0904.333.xxx (Bố Dũng)',
      inactiveDays: 5,
      currentEstimatedScore: 1290,
      scoreDelta: -70,
      primaryIssue: 'Vắng 5 ngày liên tiếp, tỷ lệ hoàn thành chỉ đạt 42%',
      lastActive: '5 ngày trước',
      status: 'critical',
    },
  ]);

  const [contactedStudents, setContactedStudents] = useState<Record<string, boolean>>({});
  const [selectedAtRiskStudent, setSelectedAtRiskStudent] = useState<AtRiskStudent | null>(null);

  // Quick Action: Copy to clipboard helper với fallback an toàn (#026, #073)
  const copyToClipboard = async (text: string, label: string) => {
    let success = false;
    if (typeof window !== 'undefined' && navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch {
        success = false;
      }
    }
    if (!success && typeof document !== 'undefined') {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch {
        // clipboard unaccessible
      }
    }
    setCopiedCodeNotice(label);
    setTimeout(() => setCopiedCodeNotice(null), 3500);
  };

  // Tính toán an toàn các chỉ số lớp học tránh chia cho 0 khi studentCount === 0 (#073, #076)
  const isClassEmpty = !activeClass || activeClass.studentCount <= 0;
  
  // Điểm trung bình an toàn
  const displayAverageScore = isClassEmpty
    ? 0
    : Number.isFinite(activeClass.averageScore)
    ? activeClass.averageScore
    : 0;

  // Tỷ lệ hoàn thành BTVN an toàn
  const displayCompletionRate = isClassEmpty
    ? 0
    : Number.isFinite(activeClass.completionRate)
    ? activeClass.completionRate
    : 0;

  // Tỷ lệ học sinh hoạt động (Active Rate) an toàn: tránh chia cho 0
  const atRiskForActiveClass = atRiskList.filter((s) => s.classCode === activeClass.code && s.status !== 'resolved');
  const activeStudentCount = isClassEmpty ? 0 : Math.max(0, activeClass.studentCount - atRiskForActiveClass.length);
  const activeStudentRate = isClassEmpty ? 0 : Math.round((activeStudentCount / activeClass.studentCount) * 100);

  // Handle Create Classroom
  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    // Chuẩn hoá mã lớp: .trim().toUpperCase() (#026)
    const sanitizedName = newClassName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    const generatedCode = `CLASS-${sanitizedName || 'SAT'}-${newTargetScore}`;
    const newClass: Classroom = {
      id: `cls-${Date.now()}`,
      name: newClassName.trim(),
      code: generatedCode,
      targetScore: newTargetScore,
      season: newSeason,
      studentCount: 0,
      averageScore: 0, // Bảo vệ khỏi số ảo khi chưa có học sinh
      completionRate: 0, // 0% khi chưa có học sinh
      topWeakness: 'Chưa có bài test chẩn đoán đầu vào',
    };

    setClassrooms([newClass, ...classrooms]);
    setActiveClassId(newClass.id);
    setNewClassName('');
    setShowCreateModal(false);
    copyToClipboard(generatedCode, `Mã lớp ${generatedCode} đã tạo thành công & sao chép vào bộ nhớ!`);
  };

  // Handle Dispatch Homework
  const handleDispatchHomework = (e: React.FormEvent) => {
    e.preventDefault();
    const newHwCode = `HW-${activeClass.code.slice(6, 9)}-${Math.floor(100 + Math.random() * 900)}`;
    const link = `https://sat.nghiaguru.com/practice?class=${encodeURIComponent(activeClass.code)}&hw=${encodeURIComponent(newHwCode)}`;

    const zaloMessage = `📢 [BÀI TẬP SAT - ${activeClass.name.toUpperCase()}]\n` +
      `Thầy Nghĩa gửi cả lớp bài luyện trọng tâm:\n` +
      `🎯 Chuyên đề: ${hwTitle} (${hwCount} câu - ${hwDomain})\n` +
      `⏰ Hạn nộp: ${hwDeadline}\n` +
      `👉 Link làm bài trực tiếp (1-Click không cần cài app): ${link}\n` +
      `📌 Chú ý: Hệ thống AI SAT Guru sẽ tự động chấm điểm và thông báo bảng xếp hạng ngay khi hết giờ. Chúc các em đạt 100% độ chính xác!`;

    const newAssignment: HomeworkAssignment = {
      id: `hw-${Date.now()}`,
      classId: activeClass.id,
      title: hwTitle,
      domain: hwDomain,
      questionCount: hwCount,
      deadline: hwDeadline,
      submittedCount: 0,
      totalCount: Math.max(0, activeClass.studentCount),
      code: newHwCode,
      createdAt: 'Vừa xong',
    };

    setHomeworkList([newAssignment, ...homeworkList]);
    setGeneratedHwMessage(zaloMessage);
    copyToClipboard(zaloMessage, 'Đã sao chép tin nhắn Zalo bài tập vào clipboard! Hãy paste ngay vào nhóm lớp.');
  };

  // Filter skills
  const filteredSkills = skillsHeatmap.filter((sk) => {
    if (activeDomainFilter === 'All') return true;
    return sk.domain === activeDomainFilter;
  });

  return (
    <div className="min-h-screen bg-[#0b1322] text-slate-100 pb-20 font-sans">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 bg-[#0e1726]/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-indigo-400 hover:text-indigo-300 transition-colors font-bold text-lg"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              🎓
            </div>
            <span>SAT Guru <span className="text-slate-400 font-normal">| Teacher Portal</span></span>
          </Link>
          <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            B2B2C Trung Tâm & Giáo Viên
          </span>
        </div>

        {/* Global Action / Quick Info */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium text-sm px-4 py-2 rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Tạo Lớp Học Mới</span>
          </button>

          <Link
            href="/parent"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/60 border border-slate-700/60 px-3 py-2 rounded-xl transition-colors"
          >
            <span>Cổng Phụ Huynh 👨‍👩‍👧</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-8">
        
        {/* Toast Notification */}
        {copiedCodeNotice && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400/30 animate-bounce">
            <span className="text-xl">✅</span>
            <span className="text-sm font-semibold">{copiedCodeNotice}</span>
          </div>
        )}

        {/* Classroom Switcher Banner */}
        <section className="bg-gradient-to-r from-[#141e33] via-[#16233d] to-[#121c2e] p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 tracking-wider uppercase">
                <span>Trực Quan Hóa Lớp Học Đang Phụ Trách</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={activeClassId}
                  onChange={(e) => setActiveClassId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white font-bold text-lg sm:text-xl rounded-2xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner cursor-pointer"
                >
                  {classrooms.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.code})
                    </option>
                  ))}
                </select>
                <span className="bg-indigo-500/20 text-indigo-300 text-xs px-3 py-1.5 rounded-full border border-indigo-500/30 font-semibold">
                  Mục tiêu {activeClass.targetScore}+
                </span>
                <span className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-full border border-slate-700">
                  {activeClass.season}
                </span>
              </div>
            </div>

            {/* Quick Share Code Widget */}
            <div className="bg-slate-900/80 backdrop-blur border border-indigo-500/30 p-3.5 rounded-2xl flex items-center gap-4">
              <div>
                <div className="text-[11px] text-slate-400 font-medium">MÃ LỚP HỌC (CLASSROOM CODE)</div>
                <div className="font-mono text-xl font-black text-indigo-300 tracking-wider">
                  {activeClass.code}
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(
                  `https://sat.nghiaguru.com/join?code=${encodeURIComponent(activeClass.code)}`,
                  `Đã chép link tham gia lớp ${activeClass.code} cho học sinh!`
                )}
                className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy Link Zalo</span>
              </button>
            </div>
          </div>

          {/* KPI Mini Grid — Bảo vệ mọi phép chia và chỉ số khỏi NaN (#073, #076) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 mt-6 pt-6 border-t border-slate-800/80">
            <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800">
              <div className="text-xs text-slate-400">Sĩ Số Học Sinh</div>
              <div className="text-2xl font-bold text-white mt-1 flex items-baseline gap-1.5">
                <span>{activeClass.studentCount}</span>
                <span className="text-xs text-slate-400 font-normal">học viên</span>
              </div>
            </div>
            <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800">
              <div className="text-xs text-slate-400">Điểm Ước Lượng Trung Bình</div>
              <div className="text-2xl font-bold text-cyan-400 mt-1 flex items-baseline gap-1.5">
                <span>{displayAverageScore > 0 ? displayAverageScore : 'Chưa có'}</span>
                {displayAverageScore > 0 && <span className="text-xs text-slate-400 font-normal">/ 1600</span>}
              </div>
            </div>
            <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800">
              <div className="text-xs text-slate-400">Tỷ Lệ Hoàn Thành BTVN</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1 flex items-baseline gap-1.5">
                <span>{displayCompletionRate}%</span>
                <span className="text-xs text-emerald-500 font-normal">tuần này</span>
              </div>
            </div>
            <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800">
              <div className="text-xs text-slate-400">Tỷ Lệ Học Sinh Hoạt Động</div>
              <div className="text-2xl font-bold text-indigo-400 mt-1 flex items-baseline gap-1.5">
                <span>{activeStudentRate}%</span>
                <span className="text-xs text-indigo-300 font-normal">({activeStudentCount}/{activeClass.studentCount})</span>
              </div>
            </div>
            <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800 col-span-2 sm:col-span-4 lg:col-span-1">
              <div className="text-xs text-slate-400">Lỗ Hổng Lớn Nhất Lớp</div>
              <div className="text-sm font-semibold text-rose-300 mt-1 line-clamp-1" title={activeClass.topWeakness}>
                {activeClass.topWeakness}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: BẢNG NHIỆT NĂNG LỰC CẢ LỚP (COHORT SKILL HEATMAP) */}
        <section className="bg-[#131d2e] rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Bảng Nhiệt Năng Lực Cả Lớp (Cohort Skill Heatmap)
                </h2>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                AI SAT Guru quét ma trận sai sót của {activeClass.studentCount} học sinh theo thời gian thực để phát hiện ngay vùng trũng kiến thức.
              </p>
            </div>

            {/* Domain Filter Pills */}
            <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 self-start md:self-auto">
              {(['All', 'Math', 'Reading & Writing'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveDomainFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                    activeDomainFilter === filter
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {filter === 'All' ? 'Tất cả kỹ năng' : filter}
                </button>
              ))}
            </div>
          </div>

          {/* Crucial Insight Highlight Alert Banner */}
          <div className="bg-gradient-to-r from-rose-950/40 via-amber-950/30 to-slate-900/60 border border-rose-500/30 rounded-2xl p-4 flex items-start sm:items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-xl shrink-0 border border-rose-500/30">
              ⚠️
            </div>
            <div className="flex-1 text-sm">
              <span className="font-bold text-rose-300">CẢNH BÁO TRỌNG ĐIỂM: </span>
              <span className="text-slate-200">
                Có <strong className="text-rose-400 font-bold">68% học sinh</strong> trong lớp đang mất điểm nghiêm trọng ở chuyên đề{' '}
                <strong className="underline decoration-rose-400 underline-offset-2">Dấu câu Boundaries</strong> và{' '}
                <strong className="text-amber-300 font-bold">65% học sinh</strong> vướng bẫy{' '}
                <strong className="underline decoration-amber-400 underline-offset-2">Hàm số bậc hai Parabol</strong>!
              </span>
            </div>
            <button
              onClick={() => {
                setHwTitle('Luyện Nóng: Khắc Phục Bẫy Boundaries & Hàm Bậc Hai Cấp Tốc');
                setHwCount(15);
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
              }}
              className="hidden lg:inline-flex shrink-0 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
            >
              🚀 Giao Bài Khắc Phục Ngay
            </button>
          </div>

          {/* Heatmap Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSkills.map((skill) => {
              // Rating calculation an toàn tránh chia cho 0
              const isDanger = skill.failRate >= 60;
              const isWarning = skill.failRate >= 40 && skill.failRate < 60;
              const tested = skill.totalTested > 0 ? skill.totalTested : 0;
              const struggling = Math.min(tested, skill.strugglingCount || 0);
              const displayMastery = tested > 0 ? Math.round(((tested - struggling) / tested) * 100) : 0;

              return (
                <div
                  key={skill.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-1 ${
                    isDanger
                      ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                      : isWarning
                      ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
                      : 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        skill.domain === 'Math'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}
                    >
                      {skill.domain}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Tỉ trọng: {skill.satWeight}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-sm mt-2.5 leading-snug">
                    {skill.skillName}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                    {skill.subtopic}
                  </p>

                  {/* Progress Heatbar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-400">Tỷ lệ thành thạo:</span>
                      <span
                        className={
                          isDanger ? 'text-rose-400 font-bold' : isWarning ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'
                        }
                      >
                        {displayMastery}% ({tested > 0 ? tested - struggling : 0}/{tested} HS)
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden flex border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isDanger
                            ? 'bg-gradient-to-r from-rose-600 to-rose-400'
                            : isWarning
                            ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                            : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                        }`}
                        style={{ width: `${displayMastery}%` }}
                      />
                    </div>
                  </div>

                  {/* Action bottom */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-rose-300 font-medium">
                      ❌ {skill.strugglingCount} học sinh còn yếu
                    </span>
                    <button
                      onClick={() => {
                        setHwTitle(`Khắc Phục Hổng Kiến Thức: ${skill.skillName}`);
                        setHwDomain(skill.domain);
                        setHwCount(10);
                        copyToClipboard(
                          `https://sat.nghiaguru.com/practice?skill=${encodeURIComponent(skill.id)}&class=${encodeURIComponent(activeClass.code)}`,
                          `Đã tạo link luyện 1-Click cho chuyên đề "${skill.skillName}"!`
                        );
                      }}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline flex items-center gap-1"
                    >
                      <span>Giao 1-Click</span>
                      <span>👉</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2 & 3: GRID LAYOUT (1-CLICK HOMEWORK DISPATCH & AT-RISK STUDENTS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: GIAO BÀI TẬP 1-CLICK (1-CLICK HOMEWORK DISPATCH) */}
          <section className="lg:col-span-7 bg-[#131d2e] rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-xl space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Giao Bài Tập 1-Click (Homework Dispatch)
                  </h2>
                </div>
                <span className="text-xs bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20 font-medium">
                  Tự Động Tạo Mẫu Zalo / Messenger
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Chọn chuyên đề và thời hạn, hệ thống lập tức sinh link làm bài kèm nội dung thông báo chuẩn chỉnh để giáo viên gửi thẳng vào group chat lớp.
              </p>

              {/* Form Dispatch */}
              <form onSubmit={handleDispatchHomework} className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Tên Bài Luyện / Chuyên Đề:
                  </label>
                  <input
                    type="text"
                    value={hwTitle}
                    onChange={(e) => setHwTitle(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="VD: Bẫy Dấu Câu Boundaries Đề Luyện 15 Phút"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Phân Môn:
                    </label>
                    <select
                      value={hwDomain}
                      onChange={(e) => setHwDomain(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Reading & Writing">Reading & Writing</option>
                      <option value="Math">Math</option>
                      <option value="Full Test Simulation">Full Test (Cả 2 phần)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Số Lượng Câu:
                    </label>
                    <div className="flex rounded-xl bg-slate-900 border border-slate-700 p-0.5">
                      {[5, 10, 20].map((count) => (
                        <button
                          type="button"
                          key={count}
                          onClick={() => setHwCount(count)}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            hwCount === count
                              ? 'bg-indigo-600 text-white shadow'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {count} câu
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Hạn Nộp:
                    </label>
                    <input
                      type="text"
                      value={hwDeadline}
                      onChange={(e) => setHwDeadline(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="VD: 22:00 Chủ Nhật"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-sm py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <span>🚀</span>
                  <span>Phát Động Bài Tập & Sao Chép Tin Nhắn Zalo Lớp</span>
                </button>
              </form>

              {/* Generated Zalo Template Preview */}
              {generatedHwMessage && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-cyan-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <span>💬</span> Mẫu Tin Nhắn Đã Sao Chép (Sẵn Sàng Dán Vào Zalo / Messenger):
                    </span>
                    <button
                      onClick={() => copyToClipboard(generatedHwMessage, 'Đã sao chép lại mẫu tin nhắn Zalo!')}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                    >
                      Copy Lại
                    </button>
                  </div>
                  <pre className="text-xs text-slate-300 bg-slate-900/90 p-3 rounded-xl whitespace-pre-wrap font-sans border border-slate-800 leading-relaxed">
                    {generatedHwMessage}
                  </pre>
                </div>
              )}

              {/* List of active homework */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                  Bài Tập Đang Chạy Trong Lớp ({homeworkList.length})
                </div>
                {homeworkList.map((hw) => {
                  const total = Math.max(0, hw.totalCount);
                  const submitted = Math.min(total, Math.max(0, hw.submittedCount));
                  // Bảo vệ phép chia tỷ lệ hoàn thành bài tập khỏi chia cho 0 (#073, #076)
                  const percent = total > 0 ? Math.round((submitted / total) * 100) : 0;

                  return (
                    <div
                      key={hw.id}
                      className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="font-semibold text-white text-sm flex items-center gap-2">
                          <span>{hw.title}</span>
                          <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-indigo-300">
                            {hw.code}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                          <span>{hw.questionCount} câu hỏi</span>
                          <span>•</span>
                          <span>Hạn: <strong className="text-amber-300">{hw.deadline}</strong></span>
                          <span>•</span>
                          <span>Tạo: {hw.createdAt}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-emerald-400">
                          {submitted}/{total} đã nộp
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ({percent}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: BẢNG CẢNH BÁO HỌC SINH NGUY CƠ TỤT HẬU (AT-RISK STUDENTS ALERT) */}
          <section className="lg:col-span-5 bg-[#131d2e] rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-xl space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚨</span>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Cảnh Báo Nguy Cơ Tụt Hậu
                  </h2>
                </div>
                <span className="bg-rose-500/20 text-rose-300 text-xs px-2.5 py-1 rounded-full border border-rose-500/30 font-bold">
                  {atRiskList.filter((s) => !contactedStudents[s.id]).length} Cần Nhắc Nhở
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Tự động phát hiện học sinh vắng luyện &gt; 3 ngày hoặc điểm dự đoán tụt dốc để giáo viên can thiệp kịp thời trước kỳ thi.
              </p>

              {/* At-risk student card list */}
              <div className="space-y-3">
                {atRiskList.map((student) => {
                  const isContacted = contactedStudents[student.id];

                  return (
                    <div
                      key={student.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isContacted
                          ? 'bg-slate-900/40 border-slate-800 opacity-70'
                          : student.status === 'critical'
                          ? 'bg-rose-950/20 border-rose-500/40 shadow-sm'
                          : 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-xl shrink-0">
                            {student.avatar}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">
                              {student.name}
                            </div>
                            <div className="text-xs text-slate-400">
                              Phụ huynh: {student.parentPhone}
                            </div>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div className="text-right">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isContacted
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : student.status === 'critical'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {isContacted ? 'Đã Nhắc Nhở' : `Vắng ${student.inactiveDays} ngày`}
                          </span>
                          <div className="text-xs font-mono text-rose-400 font-bold mt-1">
                            {student.scoreDelta} điểm
                          </div>
                        </div>
                      </div>

                      {/* Issue description */}
                      <div className="mt-3 text-xs bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-slate-300 flex items-center gap-2">
                        <span className="text-amber-400">⚠️</span>
                        <span>{student.primaryIssue}</span>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            setSelectedAtRiskStudent(student);
                            const msg = `Kính gửi Phụ huynh em ${student.name},\n` +
                              `Thầy Nghĩa (Chủ nhiệm lớp ${activeClass.name}) xin phép gửi thông báo tình hình học SAT của em:\n` +
                              `- Hiện tại em đã ngưng luyện bài ${student.inactiveDays} ngày liên tiếp.\n` +
                              `- Vấn đề cần khắc phục gấp: ${student.primaryIssue}.\n` +
                              `- Điểm số dự kiến hiện tại: ${student.currentEstimatedScore}/1600 (có dấu hiệu giảm sút).\n` +
                              `Kính mong Gia đình cùng động viên em hoàn thành bài luyện tập tối nay để không bị tụt lại so với mục tiêu ${activeClass.targetScore}+ của lớp. Trân trọng!`;
                            copyToClipboard(msg, `Đã chép tin nhắn Zalo gửi Phụ Huynh em ${student.name}!`);
                          }}
                          className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all border border-indigo-500/30 flex items-center gap-1.5"
                        >
                          <span>💬</span>
                          <span>Soạn Zalo Gửi Phụ Huynh</span>
                        </button>

                        <button
                          onClick={() => {
                            setContactedStudents((prev) => ({
                              ...prev,
                              [student.id]: !prev[student.id],
                            }));
                          }}
                          className={`text-xs px-3 py-1.5 rounded-xl transition-all font-medium ${
                            isContacted
                              ? 'text-slate-400 hover:text-slate-200'
                              : 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isContacted ? 'Bỏ đánh dấu' : '✓ Đã liên hệ'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Preview modal for parent contact */}
              {selectedAtRiskStudent && (
                <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/40 text-xs text-slate-300 space-y-2">
                  <div className="font-bold text-indigo-300 flex items-center justify-between">
                    <span>💌 Tin Nhắn Zalo Đã Sinh Cho: {selectedAtRiskStudent.name}</span>
                    <button
                      onClick={() => setSelectedAtRiskStudent(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 italic">
                    Hệ thống đã tự động sao chép vào bộ nhớ đệm. Bạn chỉ cần mở Zalo và dán (Ctrl+V) gửi cho Phụ huynh.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* CREATE CLASSROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#131d2e] border border-slate-700 w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl relative space-y-5">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white text-lg p-1"
            >
              ✕
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                🏫
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Tạo Mã Lớp Học Mới</h3>
                <p className="text-xs text-slate-400">Cổng Quản Trị Giáo Viên & Trung Tâm</p>
              </div>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label htmlFor={`${customModalId}-name`} className="block text-xs font-semibold text-slate-300 mb-1">
                  Tên Lớp Học:
                </label>
                <input
                  id={`${customModalId}-name`}
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  required
                  placeholder="VD: SAT Chuyên Sư Phạm - Nhóm 1"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${customModalId}-target`} className="block text-xs font-semibold text-slate-300 mb-1">
                    Điểm Mục Tiêu:
                  </label>
                  <select
                    id={`${customModalId}-target`}
                    value={newTargetScore}
                    onChange={(e) => setNewTargetScore(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={1400}>1400+ (Mục tiêu giỏi)</option>
                    <option value={1450}>1450+ (Mục tiêu xuất sắc)</option>
                    <option value={1500}>1500+ (Top University)</option>
                    <option value={1550}>1550+ (Ivy League)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`${customModalId}-season`} className="block text-xs font-semibold text-slate-300 mb-1">
                    Kỳ Thi SAT Nhắm Tới:
                  </label>
                  <select
                    id={`${customModalId}-season`}
                    value={newSeason}
                    onChange={(e) => setNewSeason(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="SAT Tháng 12/2026">SAT Tháng 12/2026</option>
                    <option value="SAT Tháng 03/2027">SAT Tháng 03/2027</option>
                    <option value="SAT Tháng 05/2027">SAT Tháng 05/2027</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1">
                <span className="text-slate-400">Mã lớp dự kiến sinh ra:</span>
                <div className="font-mono text-base font-bold text-indigo-400">
                  {newClassName ? `CLASS-${newClassName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)}-${newTargetScore}` : 'CLASS-XXXXX-1450'}
                </div>
                <p className="text-[11px] text-slate-500">
                  Học sinh chỉ cần quét mã QR hoặc nhập mã này trên web để vào thẳng lớp và nhận bài tập.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  Tạo Mã & Bắt Đầu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}