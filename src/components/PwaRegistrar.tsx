'use client';

import { useEffect } from 'react';

/**
 * Đăng ký Service Worker PWA (/sw.js — W2 #30) cache tĩnh KaTeX/Icons.
 * Chỉ kích hoạt trên trình duyệt hỗ trợ và production/HTTPS hoặc localhost.
 */
export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Bỏ qua êm ái nếu trình duyệt chặn SW
    });
  }, []);
  return null;
}
