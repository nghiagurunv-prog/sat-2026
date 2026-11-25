'use client';

import { useEffect, useState } from 'react';

interface VerifiedEvent {
  id: string;
  label: string;
  timestamp: string;
  verified: boolean;
}

/**
 * VERIFIED ACTIVITY TICKER (W3 #27 — Social Proof ẩn danh từ sự kiện DB THẬT).
 * Tự ẩn hoàn toàn nếu DB chưa có giao dịch paid thật — tuyệt đối 0 số liệu giả hardcode.
 */
export function VerifiedActivityTicker() {
  const [events, setEvents] = useState<VerifiedEvent[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    fetch('/api/activity/verified')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.verifiedFromDb && Array.isArray(d.events) && d.events.length > 0) {
          setEvents(d.events);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (events.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % events.length), 5000);
    return () => clearInterval(t);
  }, [events.length]);

  if (events.length === 0) return null;
  const active = events[idx];

  return (
    <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-emerald-200">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="truncate font-semibold">✅ {active.label}</span>
      </div>
      <span className="text-[10px] text-emerald-400/80 font-mono shrink-0">
        Xác thực từ hệ thống PayOS
      </span>
    </div>
  );
}
