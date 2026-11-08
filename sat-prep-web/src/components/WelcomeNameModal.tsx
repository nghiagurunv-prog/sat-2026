'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { NICKNAME_MIN, NICKNAME_MAX } from '@/lib/nickname';

/**
 * ============================================================================
 *  WELCOME NAME MODAL — đặt TÊN HIỂN THỊ (bí danh) ở lần đầu vào app
 * ============================================================================
 *  Trước đây: đăng nhập (Google / email) → vào thẳng app, KHÔNG có bước đặt tên
 *  → user "bay vèo vào" mà chưa kịp chọn tên hiển thị (chỗ đặt bí danh nằm sâu
 *  trong trang Bảng xếp hạng, user mới không thấy).
 *
 *  Modal này TỰ bật khi:
 *    • Đã đăng nhập (useAuth), và
 *    • /api/profile trả available:true NHƯNG nickname còn trống, và
 *    • User CHƯA bấm "Để sau" trong phiên trước (nhớ qua localStorage).
 *
 *  Prefill sẵn tên từ tài khoản Google (full_name / name) cho tiện — user chỉ
 *  cần bấm Lưu. KHÔNG ép: có nút "Để sau" (đặt sau ở trang Bảng xếp hạng).
 *  Dùng lại /api/profile (validate + cooldown server-side), không thêm API mới.
 * ============================================================================
 */

const SKIP_KEY = 'welcome-name-skipped-v1';

/** Rút tên gợi ý từ metadata Google, cắt còn tối đa NICKNAME_MAX ký tự. */
function suggestFromUser(meta: Record<string, unknown> | undefined): string {
  if (!meta) return '';
  const raw = (meta.full_name ?? meta.name ?? meta.user_name ?? '') as unknown;
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, NICKNAME_MAX || 40);
}

export function WelcomeNameModal() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    // Đã bỏ qua ở phiên trước → không làm phiền lại.
    try {
      if (localStorage.getItem(SKIP_KEY) === '1') return;
    } catch {
      /* localStorage bị chặn → cứ tiếp tục kiểm tra profile */
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const p = await res.json();
        // Chỉ bật khi bảng đã sẵn sàng NHƯNG user chưa có bí danh.
        if (p?.available === true && !p?.nickname) {
          setNickname(suggestFromUser(user?.user_metadata as Record<string, unknown> | undefined));
          setOpen(true);
        }
      } catch {
        /* lỗi mạng → không bật modal, không phiền user */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, user]);

  const skip = () => {
    try {
      localStorage.setItem(SKIP_KEY, '1');
    } catch {
      /* bỏ qua nếu không ghi được */
    }
    setOpen(false);
  };

  const save = async () => {
    if (isSubmitting) return;
    const sanitized = nickname
      .replace(/<[^>]*>/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim();

    if (sanitized.length < 2 || sanitized.length > 40) {
      setError('Tên hiển thị cần từ 2–40 ký tự.');
      return;
    }
    if (sanitized.length < NICKNAME_MIN || sanitized.length > NICKNAME_MAX) {
      setError(`Tên hiển thị cần ${NICKNAME_MIN}–${NICKNAME_MAX} ký tự.`);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: sanitized }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        try {
          localStorage.setItem(SKIP_KEY, '1'); // đã đặt tên → không hỏi lại
        } catch {
          /* bỏ qua */
        }
        showToast(`✅ Chào ${data.nickname ?? sanitized}! Bắt đầu học thôi.`, 'success');
        setOpen(false);
      } else {
        setError(data.error ?? 'Không lưu được tên. Thử lại nhé.');
      }
    } catch {
      setError('Lỗi kết nối. Thử lại nhé.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-400/25 bg-slate-900/95 p-7 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)]">
        <div className="mb-5 text-center">
          <div className="mb-2 text-4xl">👋</div>
          <h2
            id="welcome-modal-title"
            className="bg-gradient-to-r from-yellow-300 to-amber-500 bg-clip-text text-xl font-extrabold text-transparent"
          >
            Chào mừng! Bạn muốn được gọi là gì?
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Đặt tên hiển thị (bí danh) để dùng trong app và trên bảng xếp hạng. Không cần tên thật — bạn đổi lại sau được.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-medium text-red-300">
            {error}
          </div>
        )}

        <label htmlFor="welcome-nickname" className="sr-only">
          Tên hiển thị
        </label>
        <input
          id="welcome-nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isSubmitting) {
              e.preventDefault();
              void save();
            }
          }}
          placeholder={`Tên hiển thị (${NICKNAME_MIN}–${NICKNAME_MAX} ký tự)`}
          maxLength={NICKNAME_MAX}
          autoFocus
          className="mb-2 block w-full rounded-lg border border-white/10 bg-slate-800/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        />
        <p className="mb-5 text-right text-xs text-slate-500">
          {nickname.trim().length}/{NICKNAME_MAX}
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={skip}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-white/10 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
          >
            Để sau
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isSubmitting || nickname.trim().length < 2 || nickname.trim().length < NICKNAME_MIN}
            className="flex-[2] rounded-lg bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition hover:from-yellow-300 hover:to-amber-400 disabled:opacity-50"
          >
            {isSubmitting ? 'Đang lưu…' : '✨ Lưu & bắt đầu'}
          </button>
        </div>
      </div>
    </div>
  );
}
