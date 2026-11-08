'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Wifi, 
  WifiOff, 
  ArrowLeft, 
  BookOpen, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export interface NavbarProps {
  title?: string;
  subtitle?: string;
  showNetworkStatus?: boolean;
  showBack?: boolean;
  backHref?: string;
  onBack?: () => void;
  className?: string;
  extraLeft?: React.ReactNode;
  extraRight?: React.ReactNode;
}

/**
 * Navbar chuẩn hóa tích hợp trạng thái mạng thông minh (#C093, #C094, #C098, #C099)
 * - Tự động phát hiện Online / Offline (4G/Wifi chập chờn).
 * - Hiển thị chấm trạng thái và thông báo bảo vệ dữ liệu làm bài thi ngoại tuyến.
 * - An toàn 100% cho Server-Side Rendering (SSR hydration safe).
 */
export function Navbar({
  title = 'SAT.Guru 2026',
  subtitle,
  showNetworkStatus = true,
  showBack = false,
  backHref,
  onBack,
  className = '',
  extraLeft,
  extraRight,
}: NavbarProps) {
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // #C093, #C094, #C098, #C099: GIÁM SÁT TRẠNG THÁI MẠNG ONLINE / OFFLINE AN TOÀN
  // ---------------------------------------------------------------------------
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showNetworkAlert, setShowNetworkAlert] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [alertType, setAlertType] = useState<'online' | 'offline'>('online');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Khởi tạo trạng thái thực tế từ browser sau khi mount
    setIsOnline(window.navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setAlertType('online');
      setAlertMessage('Đã kết nối lại Internet. Dữ liệu làm bài đã được đồng bộ an toàn!');
      setShowNetworkAlert(true);
      const timer = setTimeout(() => setShowNetworkAlert(false), 4500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setAlertType('offline');
      setAlertMessage('Bạn đang ngoại tuyến. Hệ thống tự động chuyển sang chế độ lưu offline trên máy!');
      setShowNetworkAlert(true);
      const timer = setTimeout(() => setShowNetworkAlert(false), 6000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleBackClick = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <>
      <header className={`sticky top-0 z-40 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Khu vực bên trái: Nút Back + Brand / Title */}
          <div className="flex items-center gap-3 min-w-0">
            {showBack && (
              <button
                type="button"
                onClick={handleBackClick}
                className="p-1.5 -ml-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Quay lại"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            {extraLeft ? (
              extraLeft
            ) : (
              <Link href="/dashboard" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-400 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-tight truncate">
                    <span>{title}</span>
                    <span className="hidden sm:inline-block px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold rounded-md uppercase tracking-wider">
                      PRO
                    </span>
                  </div>
                  {subtitle && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {subtitle}
                    </div>
                  )}
                </div>
              </Link>
            )}
          </div>

          {/* Khu vực bên phải: Trạng thái mạng (#C093-#C099) & Action phụ */}
          <div className="flex items-center gap-2 sm:gap-3">
            {showNetworkStatus && (
              <div 
                className="flex items-center" 
                title={isOnline ? 'Kết nối Internet ổn định • Tự động đồng bộ' : 'Mất kết nối mạng • Tự động lưu bộ nhớ tạm'}
              >
                {isOnline ? (
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="hidden md:inline">Trực tuyến</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    <WifiOff className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Offline (Lưu tạm)</span>
                  </div>
                )}
              </div>
            )}

            {extraRight}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* BANNER THÔNG BÁO MẠNG RỚT / PHỤC HỒI (#C094, #C098) */}
      {/* ========================================================================= */}
      {showNetworkAlert && (
        <div className={`w-full py-2 px-4 text-xs font-medium transition-all ${
          alertType === 'online'
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'bg-amber-600 text-white shadow-sm'
        }`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {alertType === 'online' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-white animate-bounce" />
              )}
              <span>{alertMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowNetworkAlert(false)}
              className="text-white/80 hover:text-white font-bold px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
