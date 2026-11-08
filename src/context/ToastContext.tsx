'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast phải được dùng bên trong <ToastProvider>');
  return ctx;
}

let nextId = 0;
const MAX_TOASTS = 5;

// Cùng bảng màu với banner kết quả sẵn có trong app (xanh đúng / đỏ sai / xanh dương info).
const STYLES: Record<ToastType, string> = {
  success: 'bg-[#064e3b] border-[#10b981] text-[#34d399]',
  error: 'bg-[#450a0a] border-[#ef4444] text-[#fca5a5]',
  info: 'bg-[#1e293b] border-[#3b82f6] text-[#93c5fd]',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Dọn dẹp toàn bộ timer khi unmount để chống rò rỉ bộ nhớ
  useEffect(() => {
    const currentTimers = timersRef.current;
    return () => {
      currentTimers.forEach((timer) => clearTimeout(timer));
      currentTimers.clear();
    };
  }, []);

  const removeToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;

    setToasts((prev) => {
      const updated = [...prev, { id, message, type }];
      if (updated.length > MAX_TOASTS) {
        // Hủy timer của những toast cũ bị đẩy ra khỏi hàng đợi
        const pruned = updated.slice(0, updated.length - MAX_TOASTS);
        pruned.forEach((t) => {
          const tTimer = timersRef.current.get(t.id);
          if (tTimer) {
            clearTimeout(tTimer);
            timersRef.current.delete(t.id);
          }
        });
        return updated.slice(-MAX_TOASTS);
      }
      return updated;
    });

    const timer = setTimeout(() => {
      removeToast(id);
    }, 3500);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl border-2 shadow-lg font-bold text-sm max-w-sm animate-in slide-in-from-right-4 fade-in duration-300 ${STYLES[t.type]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
