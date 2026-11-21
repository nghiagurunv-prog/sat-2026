'use client';

import { useState, useMemo, useCallback } from 'react';

/**
 * MODULAR HOOK TÁCH TỪ MistakeNotebook.tsx (Mục #26 — Clean Modular Architecture).
 * Quản lý lọc, thống kê phân bổ Hộp Leitner 1–5 và trạng thái đến hạn ôn tập.
 */

export interface MistakeBankItemLike {
  id: string;
  domain?: string;
  subject?: string;
  box?: number;
  next_review?: string | null;
  rootCause?: string;
  question?: string;
}

export interface MistakeFilterState {
  subject: 'all' | 'Math' | 'Reading & Writing';
  box: number | 'all';
  onlyDue: boolean;
  search: string;
}

export function useMistakeBankFilter<T extends MistakeBankItemLike>(items: T[], referenceNowMs = 0) {
  const [filter, setFilter] = useState<MistakeFilterState>({
    subject: 'all',
    box: 'all',
    onlyDue: false,
    search: '',
  });

  const updateFilter = useCallback((patch: Partial<MistakeFilterState>) => {
    setFilter((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilter({ subject: 'all', box: 'all', onlyDue: false, search: '' });
  }, []);

  const stats = useMemo(() => {
    const byBox: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let dueCount = 0;

    for (const item of items) {
      const b = Math.max(1, Math.min(5, Number(item.box) || 1));
      byBox[b] = (byBox[b] || 0) + 1;
      if (!item.next_review || (referenceNowMs > 0 && Date.parse(item.next_review) <= referenceNowMs)) {
        dueCount++;
      }
    }

    return { total: items.length, dueCount, byBox };
  }, [items, referenceNowMs]);

  const filteredItems = useMemo(() => {
    const q = filter.search.trim().toLowerCase();

    return items.filter((item) => {
      if (filter.subject !== 'all' && item.subject && item.subject !== filter.subject) {
        return false;
      }
      if (filter.box !== 'all' && (Number(item.box) || 1) !== filter.box) {
        return false;
      }
      if (filter.onlyDue && item.next_review && referenceNowMs > 0 && Date.parse(item.next_review) > referenceNowMs) {
        return false;
      }
      if (q) {
        const hay = `${item.question ?? ''} ${item.domain ?? ''} ${item.rootCause ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, filter, referenceNowMs]);

  return {
    filter,
    updateFilter,
    resetFilter,
    stats,
    filteredItems,
  };
}
