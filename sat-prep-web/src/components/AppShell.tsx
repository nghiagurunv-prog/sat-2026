'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';

/** Route chạy full-bleed, KHÔNG sidebar / KHÔNG padding khung (vd trang đăng nhập). */
const FULL_BLEED_ROUTES = ['/login'];

interface NavItem {
  id: string;
  title: string;
  desc: string;
  icon: string;
  path: string;
  category: 'Trang chính' | 'Học tập' | 'Công cụ';
}

const QUICK_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', title: 'Bảng Điều Khiển (Dashboard)', desc: 'Tổng quan tiến độ & thống kê học tập', icon: '🏠', path: '/dashboard', category: 'Trang chính' },
  { id: 'analytics', title: 'Phân Tích & Dự Báo Học Bổng ĐH', desc: 'Dự báo xác suất trúng tuyển Top ĐH & học bổng SAT', icon: '📊', path: '/analytics', category: 'Trang chính' },
  { id: 'journey', title: 'Hành Trình Lộ Trình 4 Tuần', desc: 'Lộ trình cá nhân hóa theo điểm mục tiêu', icon: '🧭', path: '/journey', category: 'Trang chính' },
  { id: 'skill-tree', title: 'Cây Kỹ Năng SAT (Skill Tree)', desc: 'Bản đồ kỹ năng Toán & Đọc-Viết', icon: '🌳', path: '/skill-tree', category: 'Học tập' },
  { id: 'grind', title: 'Luyện Tập Thích Ứng (Adaptive Grind)', desc: 'Cày câu hỏi theo năng lực & kỹ năng yếu', icon: '⚡', path: '/grind', category: 'Học tập' },
  { id: 'mock-exam', title: 'Phòng Thi Thử Mô Phỏng (Mock Exams)', desc: 'Trải nghiệm giao diện chuẩn Digital SAT College Board', icon: '📝', path: '/mock-exams', category: 'Học tập' },
  { id: 'real-exam', title: 'Kho Đề Thi Thật (Real SAT Exams)', desc: 'Bộ đề chuẩn cấu trúc College Board có chấm điểm', icon: '🏛️', path: '/real-exams', category: 'Học tập' },
  { id: 'boss', title: 'Đấu Trường Boss 8 Chương SAT', desc: 'Đánh bại 8 Boss đại diện 8 lỗ hổng kiến thức SAT', icon: '🐉', path: '/boss', category: 'Học tập' },
  { id: 'math', title: 'Luyện Toán SAT (Math Academy)', desc: 'Chuyên đề Đại số, Hình học & Thống kê nâng cao', icon: '📐', path: '/math', category: 'Học tập' },
  { id: 'reading', title: 'Đọc Hiểu & Syntax X-Ray', desc: 'Bóc tách cấu trúc câu, mệnh đề quan hệ & tư duy lập luận', icon: '📖', path: '/reading', category: 'Học tập' },
  { id: 'literature', title: 'Luyện Đọc Hiểu (Reading & Literature)', desc: 'Đọc hiểu văn học, khoa học & tư duy phản biện', icon: '📚', path: '/literature', category: 'Học tập' },
  { id: 'vocabulary', title: 'Từ Vựng Ngữ Cảnh (Words in Context)', desc: 'Luyện câu hỏi từ vựng ngữ cảnh & ma trận từ nối', icon: '✍️', path: '/vocabulary', category: 'Học tập' },
  { id: 'vocab', title: 'Sổ Từ Vựng Cá Nhân (Leitner Flashcards)', desc: 'Ôn từ vựng lặp lại ngắt quãng & gốc từ Latin', icon: '📖', path: '/vocab', category: 'Học tập' },
  { id: 'forge', title: 'Lò Rèn & Sổ Tay Lỗi Sai', desc: 'Khắc phục câu sai theo phương pháp Leitner 5 hộp', icon: '📕', path: '/forge', category: 'Học tập' },
  { id: 'desmos', title: 'Desmos Graphing Lab', desc: 'Máy tính đồ thị & 10 mẹo giải nhanh SAT Math 15s', icon: '🧮', path: '/desmos', category: 'Công cụ' },
  { id: 'library', title: 'Thư Viện Đề Thực Chiến', desc: 'Kho câu hỏi SAT phân loại theo kỹ năng & độ khó', icon: '🗂️', path: '/library', category: 'Học tập' },
  { id: 'collection', title: 'Bản Đồ Sưu Tập & Câu Hỏi Hay ⭐', desc: 'Kho cổ vật vinh quang & câu hỏi đã đánh dấu ⭐', icon: '🗺️', path: '/collection', category: 'Học tập' },
  { id: 'teacher', title: 'Cổng Giáo Viên & Quản Lý Lớp Học', desc: 'Giao bài tập, chấm điểm tự động & theo dõi nhóm học sinh', icon: '👨‍🏫', path: '/teacher', category: 'Trang chính' },
  { id: 'parent', title: 'Báo Cáo Phụ Huynh & Xét Tuyển ĐH', desc: 'Báo cáo tiến độ tuần & đối chiếu điểm ĐH Việt Nam', icon: '👨‍👩‍👧', path: '/parent-share', category: 'Trang chính' },
  { id: 'speed-quiz', title: 'Phản Xạ Tốc Độ (Speed Quiz)', desc: 'Đua tốc độ 60 giây rèn phản xạ nhanh', icon: '⏱️', path: '/speed-quiz', category: 'Học tập' },
  { id: 'pvp', title: 'Đấu Trường Tri Thức (PvP)', desc: 'Thi đấu trực tiếp cùng học viên khác', icon: '⚔️', path: '/pvp', category: 'Học tập' },
  { id: 'leaderboard', title: 'Bảng Xếp Hạng Học Thuật', desc: 'Top điểm cao & so sánh nhóm mục tiêu', icon: '👑', path: '/leaderboard', category: 'Trang chính' },
];

/** 5 Tab ngón cái trên Mobile Bottom Navigation Bar */
const MOBILE_BOTTOM_TABS = [
  { id: 'dashboard', label: 'Tổng quan', icon: '🏠', path: '/dashboard' },
  { id: 'grind', label: 'Luyện tập', icon: '⚡', path: '/grind' },
  { id: 'mock-exams', label: 'Thi thử', icon: '📝', path: '/mock-exams' },
  { id: 'forge', label: 'Câu sai', icon: '📕', path: '/forge' },
  { id: 'menu', label: 'Menu', icon: '☰', isMenu: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // =========================================================================
  // POINT 91: CẢNH BÁO MẤT KẾT NỐI MẠNG MƯỢT MÀ (OFFLINE RESILIENCE BANNER)
  // =========================================================================
  const [isOffline, setIsOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOffline(!window.navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      setJustReconnected(true);
      const timer = setTimeout(() => setJustReconnected(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setJustReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // =========================================================================
  // POINT 96: TÙY CHỌN "TẮT HIỆU ỨNG RUNG / CHUYỂN ĐỘNG MẠNH" (REDUCED MOTION)
  // =========================================================================
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('sat_reduced_motion_v1');
      const shouldReduce = saved === 'true';
      setReducedMotion(shouldReduce);
      applyReducedMotion(shouldReduce);
    } catch {
      // ignore
    }
  }, []);

  const applyReducedMotion = (enabled: boolean) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (enabled) {
      root.classList.add('sat-reduced-motion');
      let styleTag = document.getElementById('sat-reduced-motion-style');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'sat-reduced-motion-style';
        styleTag.innerHTML = `
          .sat-reduced-motion *,
          .sat-reduced-motion *::before,
          .sat-reduced-motion *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
            scroll-behavior: auto !important;
          }
        `;
        document.head.appendChild(styleTag);
      }
    } else {
      root.classList.remove('sat-reduced-motion');
      const styleTag = document.getElementById('sat-reduced-motion-style');
      if (styleTag) {
        styleTag.remove();
      }
    }
  };

  const toggleReducedMotion = () => {
    const next = !reducedMotion;
    setReducedMotion(next);
    try {
      localStorage.setItem('sat_reduced_motion_v1', next ? 'true' : 'false');
    } catch {
      // ignore
    }
    applyReducedMotion(next);
  };

  // =========================================================================
  // POINT 89: COMMAND PALETTE (CTRL+K / CMD+K) - ĐIỀU HƯỚNG & TÌM KIẾM TOÀN CỤC
  // =========================================================================
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // =========================================================================
  // POINT 98: BẢNG TỔNG HỢP PHÍM TẮT TOÀN HỆ THỐNG ('?' SHORTCUT MODAL)
  // =========================================================================
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false);

  // =========================================================================
  // POINT 67 & 68: MOBILE DRAWER TRACKING, SCROLL LOCK & ESCAPE HANDLER (#067, #068)
  // =========================================================================
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Lắng nghe sự kiện mở/đóng mobile sidebar từ Sidebar & BottomNav
  useEffect(() => {
    const handleOpen = () => setMobileDrawerOpen(true);
    const handleClose = () => setMobileDrawerOpen(false);
    window.addEventListener('open-mobile-sidebar', handleOpen);
    window.addEventListener('close-mobile-sidebar', handleClose);
    return () => {
      window.removeEventListener('open-mobile-sidebar', handleOpen);
      window.removeEventListener('close-mobile-sidebar', handleClose);
    };
  }, []);

  // Khóa cuộn trang nền khi drawer hoặc modal mở và khôi phục khi đóng hoặc unmount (#068)
  useEffect(() => {
    const shouldLock = paletteOpen || shortcutModalOpen || mobileDrawerOpen;
    if (shouldLock) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [paletteOpen, shortcutModalOpen, mobileDrawerOpen]);

  // Tự động đóng menu/drawer trên mobile & modals mỗi khi pathname thay đổi (#067)
  useEffect(() => {
    setMobileDrawerOpen(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('close-mobile-sidebar'));
    }
    setPaletteOpen(false);
    setShortcutModalOpen(false);
  }, [pathname]);

  // Keyboard shortcut listener (Ctrl+K, Cmd+K, ?, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        activeEl?.getAttribute('contenteditable') === 'true';

      // Ctrl+K / Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => {
          if (!prev) {
            setSearchQuery('');
            setSelectedIndex(0);
          }
          return !prev;
        });
        return;
      }

      // '?' Modal (only when NOT in input/textarea)
      if (e.key === '?' && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShortcutModalOpen((prev) => !prev);
        return;
      }

      // Escape key closes modals & mobile drawer (#068)
      if (e.key === 'Escape') {
        if (paletteOpen) setPaletteOpen(false);
        if (shortcutModalOpen) setShortcutModalOpen(false);
        if (mobileDrawerOpen) {
          setMobileDrawerOpen(false);
          window.dispatchEvent(new CustomEvent('close-mobile-sidebar'));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paletteOpen, shortcutModalOpen, mobileDrawerOpen]);

  // Focus input when palette opens
  useEffect(() => {
    if (paletteOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [paletteOpen]);

  // Filtered items in Command Palette
  const filteredNavItems = QUICK_NAV_ITEMS.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.path.toLowerCase().includes(q)
    );
  });

  const handleSelectNav = (path: string) => {
    setPaletteOpen(false);
    router.push(path);
  };

  // Keyboard navigation within Command Palette
  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredNavItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (filteredNavItems.length || 1)) % (filteredNavItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredNavItems[selectedIndex]) {
        handleSelectNav(filteredNavItems[selectedIndex].path);
      }
    }
  };

  // =========================================================================
  // POINT 90: SAO LƯU & KHÔI PHÚC DỮ LIỆU HỌC TẬP RA FILE JSON (EXPORT / IMPORT)
  // =========================================================================
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  const handleExportBackup = () => {
    try {
      if (typeof window === 'undefined') return;
      const backupData: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sat_') || key.startsWith('gamification_') || key.includes('sat'))) {
          backupData[key] = localStorage.getItem(key) || '';
        }
      }

      const payload = {
        app: 'SAT_PREP_APP_MASTER',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        totalKeys: Object.keys(backupData).length,
        data: backupData,
      };

      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `sat_prep_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBackupStatus(`Đã tải xuống bản sao lưu (${Object.keys(backupData).length} mục)!`);
      setTimeout(() => setBackupStatus(null), 4000);
    } catch {
      setBackupStatus('Lỗi khi xuất bản sao lưu!');
      setTimeout(() => setBackupStatus(null), 4000);
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object' || !parsed.data) {
          alert('Tệp sao lưu không đúng định dạng SAT Prep JSON!');
          return;
        }

        const keys = Object.keys(parsed.data);
        let restoredCount = 0;
        keys.forEach((k) => {
          if (typeof parsed.data[k] === 'string') {
            localStorage.setItem(k, parsed.data[k]);
            restoredCount++;
          }
        });

        alert(`✅ Khôi phục thành công ${restoredCount} mục dữ liệu học tập! Trang sẽ được làm mới.`);
        window.location.reload();
      } catch {
        alert('Tệp sao lưu bị hỏng hoặc không thể đọc được.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (FULL_BLEED_ROUTES.includes(pathname)) {
    return (
      <>
        {/* Point 91: Offline Banner */}
        {isOffline && (
          <div className="bg-amber-600 text-amber-50 px-4 py-2.5 text-center text-sm font-medium flex items-center justify-center gap-2 shadow-md sticky top-0 z-[100] animate-pulse">
            <span>⚠️</span>
            <span>Kết nối mạng đang gián đoạn — bài làm và ghi chú của bạn vẫn đang được lưu an toàn trên thiết bị!</span>
          </div>
        )}
        {children}
      </>
    );
  }

  return (
    <>
      {/* Hidden input for Point 90 Backup restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportFileChange}
        accept=".json"
        className="hidden"
        aria-hidden="true"
      />

      {/* =================================================================== */}
      {/* POINT 91: CẢNH BÁO MẤT KẾT NỐI MẠNG MƯỢT MÀ (OFFLINE BANNER)       */}
      {/* =================================================================== */}
      {isOffline && (
        <div className="bg-gradient-to-r from-amber-600 to-red-600 text-amber-50 px-4 py-2.5 text-center text-xs md:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg sticky top-0 z-[999] border-b border-amber-400/40">
          <span className="text-base">⚠️</span>
          <span>Kết nối mạng đang gián đoạn — bài làm và ghi chú của bạn vẫn đang được lưu an toàn trên thiết bị!</span>
        </div>
      )}
      {justReconnected && (
        <div className="bg-emerald-600 text-emerald-50 px-4 py-2 text-center text-xs md:text-sm font-semibold flex items-center justify-center gap-2 shadow-md sticky top-0 z-[999] border-b border-emerald-400 animate-in fade-in duration-300">
          <span>✅</span>
          <span>Đã khôi phục kết nối mạng! Dữ liệu của bạn đã được đồng bộ an toàn.</span>
        </div>
      )}

      {/* Floating Status Notification for Backup */}
      {backupStatus && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-[1000] bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium border border-emerald-400 animate-in fade-in slide-in-from-bottom duration-300">
          <span>💾</span>
          <span>{backupStatus}</span>
        </div>
      )}

      {/* Desktop / iPad Sidebar */}
      <Sidebar />

      {/* Main Content Area với padding responsive 100dvh chống che bởi Mobile Bottom Nav */}
      <main className="flex-1 overflow-y-auto min-h-[100dvh]">
        <div className="max-w-[1200px] mx-auto p-3 sm:p-5 md:p-8 pb-24 md:pb-8 relative">

          {/* Top Quick Bar with Shortcut / Palette / Reduced Motion Controls */}
          <div className="flex items-center justify-end gap-2 mb-4 text-xs">
            <button
              onClick={() => setPaletteOpen(true)}
              className="bg-[#1b2533] hover:bg-[#253245] text-gray-300 hover:text-white px-3 py-1.5 rounded-lg border border-[#334155] transition-all flex items-center gap-1.5 shadow-sm"
              title="Tìm kiếm & Điều hướng nhanh (Ctrl+K)"
            >
              <span>🔍</span>
              <span className="hidden sm:inline">Tìm nhanh</span>
              <kbd className="bg-[#0f172a] text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-mono border border-[#334155]">
                Ctrl+K
              </kbd>
            </button>

            <button
              onClick={toggleReducedMotion}
              className={`px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                reducedMotion
                  ? 'bg-purple-950/70 border-purple-500/60 text-purple-200'
                  : 'bg-[#1b2533] border-[#334155] text-gray-300 hover:text-white'
              }`}
              title="Bật/Tắt chế độ giảm chuyển động cho mắt"
            >
              <span>{reducedMotion ? '👁️‍🗨️' : '✨'}</span>
              <span className="hidden sm:inline">Giảm rung lắc:</span>
              <span className={reducedMotion ? 'text-purple-300 font-bold' : 'text-gray-400'}>
                {reducedMotion ? 'BẬT' : 'TẮT'}
              </span>
            </button>

            <button
              onClick={() => setShortcutModalOpen(true)}
              className="bg-[#1b2533] hover:bg-[#253245] text-gray-300 hover:text-white px-3 py-1.5 rounded-lg border border-[#334155] transition-all flex items-center gap-1.5"
              title="Xem bảng phím tắt thông minh (?)"
            >
              <span>⌨️</span>
              <span className="hidden sm:inline">Phím tắt</span>
              <kbd className="bg-[#0f172a] text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-mono border border-[#334155]">
                ?
              </kbd>
            </button>
          </div>

          {children}
        </div>
      </main>

      {/* =================================================================== */}
      {/* POINT 14: THANH ĐIỀU HƯỚNG ĐÁY 5 TAB CHUẨN APP NATIVE TRÊN MOBILE */}
      {/* =================================================================== */}
      <nav
        aria-label="Thanh điều hướng đáy di động"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0e1117]/95 backdrop-blur-lg border-t border-[#262730] px-1 py-1 flex items-center justify-around shadow-[0_-4px_25px_rgba(0,0,0,0.6)]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}
      >
        {MOBILE_BOTTOM_TABS.map((tab) => {
          if (tab.isMenu) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('open-mobile-sidebar'));
                  }
                }}
                className="flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-gray-400 hover:text-white transition-all active:scale-95"
                aria-label="Mở Menu huấn luyện"
              >
                <span className="text-xl leading-none mb-1">{tab.icon}</span>
                <span className="text-[10px] font-medium tracking-tight leading-none text-gray-400">
                  {tab.label}
                </span>
              </button>
            );
          }

          const isActive =
            tab.path === '/'
              ? pathname === '/'
              : pathname === tab.path || (tab.path && tab.path !== '/' && pathname.startsWith(tab.path + '/'));

          return (
            <Link
              key={tab.id}
              href={tab.path!}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all active:scale-95 relative ${
                isActive ? 'text-amber-400 font-bold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span className="text-xl leading-none mb-1">{tab.icon}</span>
              <span
                className={`text-[10px] tracking-tight leading-none ${
                  isActive ? 'text-amber-400 font-bold' : 'text-gray-400'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1 shadow-[0_0_6px_#fbbf24]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* =================================================================== */}
      {/* POINT 89: COMMAND PALETTE MODAL (CTRL+K / CMD+K)                   */}
      {/* =================================================================== */}
      {paletteOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex items-start justify-center pt-20 px-4 animate-in fade-in duration-200"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-[#0f172a] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handlePaletteKeyDown}
          >
            {/* Search Input */}
            <div className="flex items-center px-4 py-3.5 border-b border-[#1e293b] gap-3 bg-[#1e293b]/50">
              <span className="text-xl">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Gõ tên trang, tính năng hoặc công cụ (vd: mock, toán, từ vựng, lỗi sai)..."
                className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none text-base"
              />
              <kbd className="text-xs bg-[#0f172a] text-gray-400 px-2 py-1 rounded border border-[#334155] font-mono">
                ESC
              </kbd>
            </div>

            {/* Quick Actions Bar inside Palette (Points 90 & 96) */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#141e30] border-b border-[#1e293b] text-xs text-gray-300 flex-wrap">
              <span className="text-gray-400 font-semibold">Thao tác nhanh:</span>
              <button
                onClick={handleExportBackup}
                className="bg-[#1e293b] hover:bg-emerald-900/60 hover:text-emerald-300 text-gray-300 px-2.5 py-1 rounded-md border border-[#334155] transition-colors flex items-center gap-1"
                title="Tải toàn bộ tiến độ cá nhân ra file JSON"
              >
                <span>💾</span> Sao lưu JSON
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#1e293b] hover:bg-blue-900/60 hover:text-blue-300 text-gray-300 px-2.5 py-1 rounded-md border border-[#334155] transition-colors flex items-center gap-1"
                title="Khôi phục tiến độ cá nhân từ file JSON"
              >
                <span>📥</span> Khôi phục JSON
              </button>
              <button
                onClick={toggleReducedMotion}
                className="bg-[#1e293b] hover:bg-purple-900/60 hover:text-purple-300 text-gray-300 px-2.5 py-1 rounded-md border border-[#334155] transition-colors flex items-center gap-1"
              >
                <span>{reducedMotion ? '👁️‍🗨️' : '✨'}</span>
                <span>{reducedMotion ? 'Tắt Giảm rung' : 'Bật Giảm rung'}</span>
              </button>
              <button
                onClick={() => {
                  setPaletteOpen(false);
                  setShortcutModalOpen(true);
                }}
                className="bg-[#1e293b] hover:bg-amber-900/60 hover:text-amber-300 text-gray-300 px-2.5 py-1 rounded-md border border-[#334155] transition-colors flex items-center gap-1"
              >
                <span>⌨️</span> Bảng phím tắt
              </button>
            </div>

            {/* Navigation Results List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredNavItems.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Không tìm thấy trang hoặc công cụ phù hợp với từ khóa.
                </div>
              ) : (
                filteredNavItems.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectNav(item.path)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 border border-amber-500/40 text-white'
                          : 'hover:bg-[#1b2533] text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl p-2 bg-[#1e293b] rounded-lg border border-[#334155]">
                          {item.icon}
                        </span>
                        <div>
                          <div className="font-bold text-sm text-white flex items-center gap-2">
                            <span>{item.title}</span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              {item.category}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 font-mono hidden sm:block">
                        {item.path}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Tip */}
            <div className="p-3 bg-[#0a0f1d] border-t border-[#1e293b] text-gray-400 text-xs flex justify-between items-center">
              <span>
                Dùng <kbd className="bg-[#1e293b] px-1 py-0.5 rounded text-amber-300">↑</kbd>{' '}
                <kbd className="bg-[#1e293b] px-1 py-0.5 rounded text-amber-300">↓</kbd> để di chuyển,{' '}
                <kbd className="bg-[#1e293b] px-1 py-0.5 rounded text-amber-300">Enter</kbd> để chọn
              </span>
              <span>Đóng bằng <kbd className="bg-[#1e293b] px-1 py-0.5 rounded text-gray-300">ESC</kbd></span>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* POINT 98: BẢNG TỔNG HỢP PHÍM TẮT TOÀN HỆ THỐNG ('?' SHORTCUT MODAL) */}
      {/* =================================================================== */}
      {shortcutModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShortcutModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-[#0f172a] border border-[#334155] rounded-2xl shadow-2xl p-6 relative max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-4 border-b border-[#1e293b] mb-5">
              <div className="flex items-center gap-3">
                <span className="text-2xl p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                  ⌨️
                </span>
                <div>
                  <h3 className="text-lg font-bold text-white">Bảng Phím Tắt Thông Minh Hệ Thống</h3>
                  <p className="text-xs text-gray-400">Tăng tốc độ làm bài và thao tác mượt mà như Digital SAT thật</p>
                </div>
              </div>
              <button
                onClick={() => setShortcutModalOpen(false)}
                className="text-gray-400 hover:text-white text-sm bg-[#1e293b] hover:bg-[#334155] px-3 py-1.5 rounded-lg border border-[#334155] transition-colors"
              >
                ✕ Đóng
              </button>
            </div>

            <div className="space-y-6">
              {/* Category 1: Practice & Exam */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                  <span>📝</span> Trong Phòng Thi & Làm Bài Thực Chiến
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#1b2533] border border-[#2d3748]">
                    <span className="text-gray-200">Chọn đáp án A, B, C, D</span>
                    <div className="flex gap-1 font-mono">
                      <kbd className="bg-[#0f172a] text-amber-300 px-1.5 py-0.5 rounded border border-[#334155]">1 - 4</kbd>
                      <span className="text-gray-500">/</span>
                      <kbd className="bg-[#0f172a] text-amber-300 px-1.5 py-0.5 rounded border border-[#334155]">A - D</kbd>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#1b2533] border border-[#2d3748]">
                    <span className="text-gray-200">Gắn cờ xem lại (Flag Question)</span>
                    <kbd className="bg-[#0f172a] text-amber-300 px-2 py-0.5 rounded border border-[#334155] font-mono">F</kbd>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#1b2533] border border-[#2d3748]">
                    <span className="text-gray-200">Gạch phương án loại trừ (Eliminate)</span>
                    <kbd className="bg-[#0f172a] text-amber-300 px-2 py-0.5 rounded border border-[#334155] font-mono">E</kbd>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#1b2533] border border-[#2d3748]">
                    <span className="text-gray-200">Chuyển câu Trước / Tiếp theo</span>
                    <div className="flex gap-1 font-mono">
                      <kbd className="bg-[#0f172a] text-amber-300 px-1.5 py-0.5 rounded border border-[#334155]">←</kbd>
                      <kbd className="bg-[#0f172a] text-amber-300 px-1.5 py-0.5 rounded border border-[#334155]">→</kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category 2: Global Navigation */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3 flex items-center gap-2">
                  <span>🌐</span> Điều Hướng & Tiện Ích Toàn Hệ Thống
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#1b2533] border border-[#2d3748]">
                    <span className="text-gray-200">Thu gọn / Mở rộng Sidebar</span>
                    <div className="flex gap-1 font-mono">
                      <kbd className="bg-[#0f172a] text-amber-300 px-1.5 py-0.5 rounded border border-[#334155]">Ctrl</kbd>
                      <span>+</span>
                      <kbd className="bg-[#0f172a] text-amber-300 px-1.5 py-0.5 rounded border border-[#334155]">B</kbd>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#1b2533] border border-[#2d3748]">
                    <span className="text-gray-200">Mở Command Palette tìm nhanh</span>
                    <div className="flex gap-1 font-mono">
                      <kbd className="bg-[#0f172a] text-blue-300 px-1.5 py-0.5 rounded border border-[#334155]">Ctrl</kbd>
                      <span>+</span>
                      <kbd className="bg-[#0f172a] text-blue-300 px-1.5 py-0.5 rounded border border-[#334155]">K</kbd>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#1b2533] border border-[#2d3748]">
                    <span className="text-gray-200">Mở bảng tra cứu phím tắt này</span>
                    <kbd className="bg-[#0f172a] text-blue-300 px-2 py-0.5 rounded border border-[#334155] font-mono">?</kbd>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#1b2533] border border-[#2d3748]">
                    <span className="text-gray-200">Đóng Popup / Hộp thoại đang mở</span>
                    <kbd className="bg-[#0f172a] text-gray-300 px-1.5 py-0.5 rounded border border-[#334155] font-mono">Esc</kbd>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#1b2533] border border-[#2d3748]">
                    <span className="text-gray-200">Sao lưu dữ liệu học tập ra JSON</span>
                    <span className="text-[11px] text-emerald-400 font-medium">Ctrl+K &gt; Sao lưu</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1e293b] flex justify-end">
              <button
                onClick={() => setShortcutModalOpen(false)}
                className="bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-[#78350f] font-bold px-5 py-2 rounded-lg text-xs transition-colors"
              >
                Đã Hiểu (Đóng)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
