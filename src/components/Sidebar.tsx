'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useGamification } from '@/context/GamificationContext';
import { useAuth } from '@/context/AuthContext';

export interface MenuItem {
  name: string;
  path: string;
  href?: string;
  icon: string;
}

export interface MenuGroup {
  title: string;
  icon: string;
  items: MenuItem[];
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    title: '🏠 HỌC MỖI NGÀY',
    icon: '🏠',
    items: [
      { name: '✨ Ôn Luyện Hằng Ngày', path: '/', icon: '✨' },
      { name: '⚡ Trả Lời Nhanh', path: '/speed-quiz', icon: '⚡' },
      { name: '💎 Nâng Cấp Gói VIP', path: '/upgrade', icon: '💎' },
    ]
  },
  {
    title: '⚔️ THỰC CHIẾN & KIỂM TRA',
    icon: '⚔️',
    items: [
      { name: '🏆 Đấu Trường Thi Thử', path: '/mock-exams', icon: '🏆' },
      { name: '🎓 Vượt Vũ Môn Thi Thật', path: '/real-exams', icon: '🎓' },
      { name: '📚 Thư Viện Đề', path: '/library', icon: '📚' },
    ]
  },
  {
    title: '🧠 HUẤN LUYỆN KỸ NĂNG',
    icon: '🧠',
    items: [
      { name: '📐 Chinh Phục Toán Học', path: '/math', icon: '📐' },
      { name: '📚 Làm Chủ Từ Vựng', path: '/vocab', icon: '📚' },
      { name: '🧮 Bí Kíp Hack Desmos', path: '/desmos', icon: '🧮' },
      { name: '📜 Giải Mã Văn Học Cổ', path: '/literature', icon: '📜' },
      { name: '📖 Đọc Hiểu & Syntax X-Ray', path: '/reading', icon: '📖' },
      { name: '🔥 Khổ Luyện Chuyên Sâu', path: '/grind', icon: '🔥' },
    ]
  },
  {
    title: '📈 TIẾN ĐỘ & HỒ SƠ',
    icon: '📈',
    items: [
      { name: '🎯 Test Xếp Lớp', path: '/diagnostic', icon: '🎯' },
      { name: '🌳 Cây Năng Lực SAT', path: '/skill-tree', icon: '🌳' },
      { name: '📊 Nhật Ký Trưởng Thành', path: '/dashboard', icon: '📊' },
      { name: '📊 Phân Tích & Học Bổng ĐH', path: '/analytics', icon: '📈' },
      { name: '👨‍🏫 Cổng Giáo Viên & Lớp Học', path: '/teacher', icon: '👨‍🏫' },
      { name: '👨‍👩‍👧 Chia Sẻ Phụ Huynh', path: '/parent-share', icon: '👨‍👩‍👧' },
    ]
  },
  {
    title: '🎮 HỆ SINH THÁI CHIẾN BINH',
    icon: '🎮',
    items: [
      { name: '🗺️ Bản Đồ Sưu Tập', path: '/collection', icon: '🗺️' },
      { name: '🛒 Cửa Hàng Vật Phẩm', path: '/shop', icon: '🛒' },
      { name: '📜 Sổ Tay Nhiệm Vụ', path: '/quests', icon: '📜' },
      { name: '🗼 Tháp Vô Tận', path: '/tower', icon: '🗼' },
      { name: '🐉 Đấu Trường Boss 8 Chương', path: '/boss', icon: '🐉' },
      { name: '🏟️ Đấu Trường PvP', path: '/pvp', icon: '🏟️' },
      { name: '🏆 Bảng Xếp Hạng', path: '/leaderboard', icon: '🏆' },
      { name: '⚒️ Lò Rèn Chiến Binh', path: '/forge', icon: '⚒️' },
      { name: '🗺️ Hành Trình Chinh Phục', path: '/journey', icon: '🧭' },
      { name: '📔 Thư Viện Quái Thú', path: '/pets', icon: '📔' },
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { learningMode, setLearningMode, subject, setSubject, focusMode, incrementQuestionKey } = useGamification();
  const { isAuthenticated, signOut } = useAuth();
  const [expandedGroups, setExpandedGroups] = useState<number[]>([0]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // [Point 14] Thu gọn Sidebar dạng Icon Rail 64px - 72px cho iPad & Laptop
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sat_sidebar_collapsed_v1');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sat_sidebar_collapsed_v1', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Lắng nghe phím tắt Ctrl+B để đóng/mở nhanh Sidebar
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const activeEl = document.activeElement;
        const isInput =
          activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement ||
          activeEl?.getAttribute('contenteditable') === 'true';
        if (!isInput) {
          e.preventDefault();
          toggleCollapse();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleCollapse]);

  const closeMobileDrawer = useCallback(() => {
    setMobileOpen(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('close-mobile-sidebar'));
    }
  }, []);

  const openMobileDrawer = useCallback(() => {
    setMobileOpen(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-mobile-sidebar'));
    }
  }, []);

  // Lắng nghe sự kiện mở/đóng menu từ Mobile Bottom Nav (AppShell)
  useEffect(() => {
    const handleOpenMobile = () => setMobileOpen(true);
    const handleCloseMobile = () => setMobileOpen(false);
    window.addEventListener('open-mobile-sidebar', handleOpenMobile);
    window.addEventListener('close-mobile-sidebar', handleCloseMobile);
    return () => {
      window.removeEventListener('open-mobile-sidebar', handleOpenMobile);
      window.removeEventListener('close-mobile-sidebar', handleCloseMobile);
    };
  }, []);

  // Tự động đóng menu/drawer trên mobile mỗi khi pathname thay đổi (#067)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Khóa cuộn trang nền khi mobile drawer đang mở và khôi phục khi đóng hoặc unmount (#068)
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // [Point 60] Badge Thông báo Số câu sai Đến hạn Ôn trên Sidebar
  const [dueMistakesCount, setDueMistakesCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchDueMistakes = async () => {
      try {
        const res = await fetch('/api/cau-sai?due=true');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && isMounted) {
            let archived: string[] = [];
            try {
              const raw = localStorage.getItem('sat_mistake_archived_v1');
              if (raw) archived = JSON.parse(raw);
            } catch {}
            const activeDue = data.filter((m: { id?: string }) => !archived.includes(m?.id || ''));
            setDueMistakesCount(activeDue.length);
          }
        }
      } catch {
        // Fallback im lặng nếu offline hoặc chưa cấu hình API
      }
    };

    fetchDueMistakes();
    const interval = setInterval(fetchDueMistakes, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // [Point 67] Đồng hồ Pomodoro 25p Tích hợp gọn trên Sidebar
  const [pomoMinutes, setPomoMinutes] = useState<number>(25);
  const [pomoSeconds, setPomoSeconds] = useState<number>(0);
  const [pomoIsRunning, setPomoIsRunning] = useState<boolean>(false);
  const [pomoMode, setPomoMode] = useState<'work' | 'break'>('work');
  const [pomoCollapsed, setPomoCollapsed] = useState<boolean>(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (pomoIsRunning) {
      interval = setInterval(() => {
        setPomoSeconds((prevSec) => {
          if (prevSec > 0) {
            return prevSec - 1;
          } else {
            setPomoMinutes((prevMin) => {
              if (prevMin > 0) {
                return prevMin - 1;
              } else {
                const nextMode = pomoMode === 'work' ? 'break' : 'work';
                setPomoMode(nextMode);
                setPomoIsRunning(false);
                return nextMode === 'work' ? 25 : 5;
              }
            });
            return 59;
          }
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pomoIsRunning, pomoMode]);

  const togglePomoTimer = () => setPomoIsRunning((prev) => !prev);

  const resetPomoTimer = () => {
    setPomoIsRunning(false);
    setPomoMinutes(pomoMode === 'work' ? 25 : 5);
    setPomoSeconds(0);
  };

  const switchPomoMode = (mode: 'work' | 'break') => {
    setPomoIsRunning(false);
    setPomoMode(mode);
    setPomoMinutes(mode === 'work' ? 25 : 5);
    setPomoSeconds(0);
  };

  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileDrawer();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, closeMobileDrawer]);

  if (focusMode) return null;

  const handleSignOut = async () => {
    await signOut();
    closeMobileDrawer();
    router.push('/login');
  };

  const toggleGroup = (idx: number) => {
    if (expandedGroups.includes(idx)) {
      setExpandedGroups(expandedGroups.filter((i) => i !== idx));
    } else {
      setExpandedGroups([...expandedGroups, idx]);
    }
  };

  // =========================================================================
  // GIAO DIỆN THU GỌN: ICON RAIL 72px CHO IPAD / LAPTOP / CHIA ĐÔI MÀN HÌNH
  // =========================================================================
  const renderCollapsedRail = () => (
    <div className="flex flex-col h-full items-center py-3.5 px-2 justify-between">
      {/* Top Section: Nút mở rộng & Logo */}
      <div className="w-full flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={toggleCollapse}
          className="w-10 h-10 rounded-xl bg-[#1b2533] hover:bg-[#26354a] border border-[#334155] text-amber-400 hover:text-white flex items-center justify-center transition-all shadow-sm"
          title="Mở rộng Sidebar (Ctrl+B)"
          aria-label="Mở rộng Sidebar"
        >
          <PanelLeftOpen size={19} />
        </button>

        <Link
          href="/"
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border border-amber-500/40 text-amber-400 font-extrabold flex items-center justify-center text-xs tracking-tighter shadow-sm hover:scale-105 transition-transform"
          title="SAT Prep Master - Nghia Guru"
        >
          NG
        </Link>

        <div className="w-8 h-[1px] bg-[#262730] my-0.5" />

        {/* Quick Mode Switcher */}
        <div className="flex flex-col gap-1.5 items-center w-full">
          <button
            type="button"
            onClick={() => setLearningMode('ai')}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-base transition-all",
              learningMode === 'ai'
                ? "bg-blue-600/30 text-blue-400 border border-blue-500/60 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                : "text-gray-400 hover:text-white hover:bg-[#1b2533]"
            )}
            title="Chế độ AI: Luyện câu hỏi mới"
          >
            🤖
          </button>

          <button
            type="button"
            onClick={() => setLearningMode('notebook')}
            className={cn(
              "relative w-10 h-10 rounded-xl flex items-center justify-center text-base transition-all",
              learningMode === 'notebook'
                ? "bg-amber-600/30 text-amber-400 border border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                : "text-gray-400 hover:text-white hover:bg-[#1b2533]"
            )}
            title={`Sổ tay ôn câu sai${dueMistakesCount > 0 ? ` (${dueMistakesCount} câu đến hạn)` : ''}`}
          >
            📂
            {dueMistakesCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                {dueMistakesCount > 9 ? '9+' : dueMistakesCount}
              </span>
            )}
          </button>
        </div>

        <div className="w-8 h-[1px] bg-[#262730] my-0.5" />
      </div>

      {/* Middle Section: Danh sách Icon Nav gọn gàng cuộn mượt mà */}
      <div className="flex-1 w-full overflow-y-auto no-scrollbar py-2 flex flex-col items-center gap-1.5">
        {MENU_GROUPS.map((group) =>
          group.items.map((item) => {
            const itemHref = item.href || item.path;
            const isActive =
              pathname === itemHref ||
              (itemHref !== '/' && pathname?.startsWith(itemHref + '/'));
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-base transition-all duration-200 group relative",
                  isActive
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(251,191,36,0.25)] scale-105"
                    : "text-gray-400 hover:text-white hover:bg-[#1b2533] border border-transparent"
                )}
                title={item.name}
              >
                <span>{item.icon}</span>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-amber-400 rounded-r-full" />
                )}
              </Link>
            );
          })
        )}
      </div>

      {/* Bottom Section: Pomodoro mini & Auth */}
      <div className="w-full flex flex-col items-center gap-2 pt-2 border-t border-[#262730]">
        <button
          type="button"
          onClick={togglePomoTimer}
          className={cn(
            "w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all text-xs border",
            pomoIsRunning
              ? "bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse"
              : "bg-[#1b2533] text-gray-300 border-[#334155] hover:text-white"
          )}
          title={`Pomodoro: ${String(pomoMinutes).padStart(2, '0')}:${String(pomoSeconds).padStart(2, '0')} (${pomoIsRunning ? 'Tạm dừng' : 'Bắt đầu'})`}
        >
          <span className="text-sm">🍅</span>
        </button>

        {isAuthenticated ? (
          <button
            type="button"
            onClick={handleSignOut}
            className="w-10 h-10 rounded-xl bg-[#1b2533] hover:bg-red-950/40 text-gray-400 hover:text-red-400 border border-[#334155] hover:border-red-500/40 flex items-center justify-center text-base transition-all"
            title="Đăng xuất"
          >
            🚪
          </button>
        ) : (
          <Link
            href="/login"
            className="w-10 h-10 rounded-xl bg-[#1b2533] hover:bg-blue-950/40 text-gray-400 hover:text-blue-400 border border-[#334155] hover:border-blue-500/40 flex items-center justify-center text-base transition-all"
            title="Đăng nhập"
          >
            🔑
          </Link>
        )}
      </div>
    </div>
  );

  // =========================================================================
  // GIAO DIỆN ĐẦY ĐỦ 330px
  // =========================================================================
  const renderContent = (isMobile = false) => (
    <>
      {/* Top Header & Signature Section */}
      <div className="flex items-center justify-between mx-4 mt-3 mb-2">
        <div className="signature-container !my-0 flex-1">
          <div className="produced-by">PRODUCED BY</div>
          <div className="guru-name">Nghia Guru</div>
        </div>

        {!isMobile && (
          <button
            type="button"
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg bg-[#161f2e] hover:bg-[#202b3d] text-gray-400 hover:text-amber-400 border border-[#334155] transition-all flex items-center gap-1 text-xs"
            title="Thu gọn thành thanh Icon Rail 72px (Ctrl+B)"
            aria-label="Thu gọn Sidebar"
          >
            <PanelLeftClose size={16} />
            <span className="text-[11px] font-medium pr-0.5">Thu gọn</span>
          </button>
        )}
      </div>

      <div className="px-4 pb-8 space-y-6">
        {/* CHẾ ĐỘ HỌC TẬP */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[#fafafa] uppercase tracking-wider mb-2">
            ⚙️ CHẾ ĐỘ HỌC TẬP
          </h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-[#1b2533] rounded transition-colors">
              <input
                type="radio"
                name={isMobile ? 'learning_mode_mobile' : 'learning_mode'}
                checked={learningMode === 'ai'}
                onChange={() => setLearningMode('ai')}
                className="w-4 h-4 text-[#ff4b4b] bg-transparent border-gray-500"
              />
              <span className="text-[14px] text-[#e2e8f0]">✨ Luyện câu hỏi mới từ AI</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-[#1b2533] rounded transition-colors">
              <input
                type="radio"
                name={isMobile ? 'learning_mode_mobile' : 'learning_mode'}
                checked={learningMode === 'notebook'}
                onChange={() => setLearningMode('notebook')}
                className="w-4 h-4 text-[#ff4b4b] bg-transparent border-gray-500"
              />
              <span className="text-[14px] text-[#e2e8f0] flex-1">📂 Sổ tay ôn câu sai</span>
              {/* [Point 60] Badge Thông báo Số câu sai Đến hạn Ôn trên Sidebar */}
              {dueMistakesCount > 0 && (
                <span
                  title={`${dueMistakesCount} câu sai đến hạn ôn tập ngay!`}
                  className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse shadow-sm"
                >
                  🔥 {dueMistakesCount}
                </span>
              )}
            </label>
          </div>

          {learningMode === 'ai' && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Chọn môn học:</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-[#1b2533] border border-[#262730] text-[#fafafa] text-sm rounded p-2 outline-none focus:border-[#3b82f6]"
                >
                  <option>Reading &amp; Writing (Đọc hiểu)</option>
                  <option>Math (Toán học)</option>
                </select>
              </div>
              <button
                type="button"
                onClick={incrementQuestionKey}
                className="w-full bg-[#262730] hover:bg-[#333] border border-[#404353] hover:border-[#3b82f6] text-[#e2e8f0] px-4 py-2 rounded text-sm transition-colors text-left flex items-center gap-2"
              >
                🔄 Đổi câu hỏi khác
              </button>
            </div>
          )}
        </div>

        <hr className="border-[#262730]" />

        <h2 className="text-[14px] font-bold text-white mb-2 px-2">🗺️ BẢN ĐỒ HUẤN LUYỆN</h2>

        <div className="space-y-4">
          {MENU_GROUPS.map((group, idx) => {
            const isExpanded = expandedGroups.includes(idx);
            return (
              <div key={idx} className="st-expander border-[#262730]">
                <div
                  className="st-expander-header hover:text-white"
                  onClick={() => toggleGroup(idx)}
                >
                  <span className="flex items-center gap-2">{group.title}</span>
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400" />
                  )}
                </div>

                {isExpanded && (
                  <div className="st-expander-content">
                    {group.items.map((item) => {
                      const itemHref = item.href || item.path;
                      const isActive =
                        pathname === itemHref ||
                        (itemHref !== '/' && pathname?.startsWith(itemHref + '/'));
                      return (
                        <Link
                          key={item.path}
                          href={item.path}
                          onClick={closeMobileDrawer}
                          className={cn(
                            "px-3 py-2 rounded-md text-[14px] transition-colors duration-200 flex items-center justify-between",
                            isActive
                              ? "bg-[rgba(255,255,255,0.08)] text-[#fbbf24] font-semibold border border-[rgba(251,191,36,0.3)] shadow-[0_0_10px_rgba(251,191,36,0.1)]"
                              : "text-[#e2e8f0] hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
                          )}
                        >
                          <span className="truncate">{item.name}</span>
                          {isActive && <span className="text-amber-400 text-xs">●</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <hr className="border-[#262730]" />

        {/* [Point 67] Đồng hồ Pomodoro 25p Tích hợp gọn trên Sidebar */}
        <div className="bg-[#131922] border border-[#262730] rounded-xl p-3 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🍅</span>
              <span className="text-xs font-bold text-[#fafafa] tracking-wide uppercase">
                {pomoMode === 'work' ? 'Pomodoro Học (25p)' : 'Nghỉ giải lao (5p)'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPomoCollapsed((prev) => !prev)}
              className="text-gray-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-[#1f2937]"
              title={pomoCollapsed ? 'Mở rộng đồng hồ' : 'Thu gọn'}
            >
              {pomoCollapsed ? '▼' : '▲'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="font-mono text-xl font-extrabold text-[#fbbf24] tracking-wider">
              {String(pomoMinutes).padStart(2, '0')}:{String(pomoSeconds).padStart(2, '0')}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={togglePomoTimer}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-bold transition-all shadow-sm",
                  pomoIsRunning
                    ? "bg-amber-600 hover:bg-amber-500 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                )}
              >
                {pomoIsRunning ? '⏸ Tạm dừng' : '▶ Bắt đầu'}
              </button>
              <button
                type="button"
                onClick={resetPomoTimer}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1f2937] text-xs transition-colors"
                title="Đặt lại 25:00"
              >
                🔄
              </button>
            </div>
          </div>

          {!pomoCollapsed && (
            <div className="pt-1 flex gap-1 border-t border-[#1e2736]">
              <button
                type="button"
                onClick={() => switchPomoMode('work')}
                className={cn(
                  "flex-1 py-1 rounded text-[11px] font-medium transition-colors",
                  pomoMode === 'work'
                    ? "bg-[#2563eb] text-white font-semibold"
                    : "bg-[#1a2230] text-gray-400 hover:text-white"
                )}
              >
                🎯 Học 25p
              </button>
              <button
                type="button"
                onClick={() => switchPomoMode('break')}
                className={cn(
                  "flex-1 py-1 rounded text-[11px] font-medium transition-colors",
                  pomoMode === 'break'
                    ? "bg-[#10b981] text-white font-semibold"
                    : "bg-[#1a2230] text-gray-400 hover:text-white"
                )}
              >
                ☕ Nghỉ 5p
              </button>
            </div>
          )}
        </div>

        <hr className="border-[#262730]" />

        {/* Lối vào/ra tài khoản */}
        {isAuthenticated ? (
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 rounded-md text-[14px] text-[#e2e8f0] hover:bg-[rgba(255,255,255,0.05)] hover:text-white transition-colors"
          >
            🚪 Đăng xuất
          </button>
        ) : (
          <Link
            href="/login"
            onClick={closeMobileDrawer}
            className="block px-3 py-2 rounded-md text-[14px] text-[#e2e8f0] hover:bg-[rgba(255,255,255,0.05)] hover:text-white transition-colors"
          >
            🔑 Đăng nhập
          </Link>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button (Góc trên bên trái) */}
      <button
        type="button"
        onClick={openMobileDrawer}
        className="md:hidden fixed top-3 left-3 z-40 bg-[#0e1117] border border-[#334155] text-white rounded-lg p-2 shadow-lg"
        aria-label="Mở menu điều hướng"
        aria-expanded={mobileOpen}
        aria-controls="mobile-training-menu"
      >
        <Menu size={22} />
      </button>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-xs"
            onClick={closeMobileDrawer}
            aria-label="Đóng menu điều hướng"
          />
          <aside
            id="mobile-training-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu huấn luyện"
            className="relative w-[88vw] max-w-[340px] bg-[#0e1117] border-r border-[#262730] h-screen overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-left duration-200"
          >
            <div className="sticky top-0 z-10 bg-[#0e1117]/95 backdrop-blur border-b border-[#262730] flex items-center justify-between px-4 py-3">
              <span className="text-sm font-bold text-white">Menu huấn luyện</span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeMobileDrawer}
                className="text-gray-300 hover:text-white p-1 rounded-lg hover:bg-white/10"
                aria-label="Đóng menu"
              >
                <X size={22} />
              </button>
            </div>
            {renderContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop / iPad Sidebar: Tự động chuyển đổi giữa 330px và 72px (Icon Rail) */}
      <aside
        className={cn(
          "flex-shrink-0 bg-[#0e1117] border-r border-[#262730] h-screen overflow-y-auto hidden md:flex flex-col transition-[width] duration-300 ease-in-out select-none",
          isCollapsed ? "w-[72px]" : "w-[330px]"
        )}
      >
        {isCollapsed ? renderCollapsedRail() : renderContent(false)}
      </aside>
    </>
  );
}
