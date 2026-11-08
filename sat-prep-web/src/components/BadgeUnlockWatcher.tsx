'use client';

import { useEffect, useRef } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import { BADGE_CATALOG } from '@/lib/rpg-rules';

/**
 * Theo dõi `unlockedBadges` (dẫn xuất từ state) và BẮN TOAST khi có huy hiệu MỚI
 * mở khóa. Đặt BÊN TRONG ToastProvider (GamificationProvider là tổ tiên nên đọc
 * được cả hai context — GamificationContext KHÔNG tự gọi useToast được vì nó bọc
 * NGOÀI ToastProvider).
 *
 * First-load guard: lần đầu chỉ GHI NHẬN tập badge hiện có (không toast) để tránh
 * spam mọi huy hiệu đã sở hữu khi mới vào app. Từ lần sau, chỉ toast phần CHÊNH.
 */
export function BadgeUnlockWatcher() {
  const { unlockedBadges } = useGamification();
  const { showToast } = useToast();
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];
    const safeBadges = Array.isArray(unlockedBadges) ? unlockedBadges : [];

    // Lần đầu: ghi nhận baseline, không thông báo.
    if (seenRef.current === null) {
      seenRef.current = new Set(safeBadges);
      return;
    }
    const seen = seenRef.current;
    const newBadges: string[] = [];
    for (const id of safeBadges) {
      if (!seen.has(id)) {
        seen.add(id);
        newBadges.push(id);
      }
    }

    // Nếu vừa hydrate từ localStorage/server sau khi mount (seen ban đầu rỗng nhưng đổ về > 1 badge)
    // thì chỉ cập nhật seen mà không bắn bão toast.
    if (seen.size === newBadges.length && newBadges.length > 1) {
      return;
    }

    newBadges.forEach((id, index) => {
      const badge = BADGE_CATALOG.find((b) => b.id === id);
      if (badge) {
        const timer = setTimeout(() => {
          showToast(`${badge.icon} Mở khóa huy hiệu: ${badge.title}!`, 'success');
        }, index * 300);
        timeouts.push(timer);
      }
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [unlockedBadges, showToast]);

  return null;
}
