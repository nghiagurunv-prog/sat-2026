'use client';

/**
 * OFFLINE-RESILIENT QUIZ SESSION QUEUE (Mục #29 — PWA Mobile).
 * Lưu tạm các lượt nộp bài / lưu câu sai vào localStorage khi học sinh mất mạng 4G/Wi-Fi
 * và tự động đồng bộ trở lại server ngay khi trình duyệt bắt sự kiện `online`.
 */

const QUEUE_KEY = 'sat_guru_offline_sync_queue_v1';

export interface OfflineSyncItem {
  id: string;
  endpoint: '/api/grade' | '/api/cau-sai' | '/api/cau-sai/batch';
  payload: Record<string, unknown>;
  createdAt: number;
}

export function loadOfflineQueue(): OfflineSyncItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(items: OfflineSyncItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-50)));
  } catch {
    // QuotaExceededError → bỏ qua an toàn
  }
}

export function enqueueOfflineSync(
  endpoint: OfflineSyncItem['endpoint'],
  payload: Record<string, unknown>
): OfflineSyncItem {
  const item: OfflineSyncItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    endpoint,
    payload,
    createdAt: Date.now(),
  };
  const current = loadOfflineQueue();
  current.push(item);
  saveOfflineQueue(current);
  return item;
}

export async function flushOfflineQueue(): Promise<{ synced: number; remaining: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { synced: 0, remaining: loadOfflineQueue().length };
  }

  const queue = loadOfflineQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  const failed: OfflineSyncItem[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      const res = await fetch(item.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });
      if (res.ok || res.status === 400 || res.status === 409) {
        synced++;
      } else {
        failed.push(item);
      }
    } catch {
      failed.push(item);
    }
  }

  saveOfflineQueue(failed);
  return { synced, remaining: failed.length };
}
