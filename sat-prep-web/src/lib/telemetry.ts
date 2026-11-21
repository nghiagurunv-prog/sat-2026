import 'server-only';

/**
 * Structured Telemetry, Edge Webhook Dedup Lock & Alerting (Wave V2 — Mục #8 & #9).
 * - Không bao giờ throw làm ảnh hưởng luồng chính.
 * - Hỗ trợ ALERT_WEBHOOK_URL (Discord/Slack/Telegram bridge/Zalo proxy) nếu cấu hình.
 */

export interface MetricTags {
  [key: string]: string | number | boolean | undefined;
}

export function emitMetric(name: string, value = 1, tags?: MetricTags): void {
  try {
    const cleanTags: Record<string, string | number | boolean> = {};
    if (tags) {
      for (const [k, v] of Object.entries(tags)) {
        if (v !== undefined) cleanTags[k] = v;
      }
    }
    const payload = {
      type: 'sat_metric',
      name,
      value,
      tags: cleanTags,
      ts: new Date().toISOString(),
    };
    if (process.env.NODE_ENV !== 'test' && !process.execArgv.some((a) => a.includes('test'))) {
      console.info(JSON.stringify(payload));
    }
  } catch {
    // Telemetry không được phép làm gián đoạn nghiệp vụ
  }
}

export async function sendAlertIfConfigured(
  event: string,
  details: Record<string, unknown>
): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'sat-guru',
        event,
        details,
        ts: new Date().toISOString(),
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch (err) {
    console.warn(`[telemetry] Gửi cảnh báo ${event} thất bại:`, err instanceof Error ? err.message : String(err));
  }
}

// Edge LRU Dedup Cache chống replay flood trước khi hit Supabase RPC (Mục #8)
const MAX_DEDUP_ENTRIES = 2000;
const confirmedWebhookCache = new Map<string, number>();

function isTestProcess(): boolean {
  return process.env.NODE_ENV === 'test' || process.execArgv.some((a) => a.includes('test'));
}

export function isWebhookRecentlyConfirmed(key: string): boolean {
  if (isTestProcess()) return false;
  const exp = confirmedWebhookCache.get(key);
  if (!exp) return false;
  if (exp <= Date.now()) {
    confirmedWebhookCache.delete(key);
    return false;
  }
  return true;
}

export function markWebhookConfirmed(key: string, ttlMs = 60_000): void {
  if (isTestProcess()) return;
  const now = Date.now();
  if (confirmedWebhookCache.size >= MAX_DEDUP_ENTRIES) {
    for (const [k, exp] of confirmedWebhookCache) {
      if (exp <= now) confirmedWebhookCache.delete(k);
    }
    while (confirmedWebhookCache.size >= MAX_DEDUP_ENTRIES) {
      const oldest = confirmedWebhookCache.keys().next().value;
      if (oldest === undefined) break;
      confirmedWebhookCache.delete(oldest);
    }
  }
  confirmedWebhookCache.set(key, now + ttlMs);
}

export function clearWebhookDedupCache(): void {
  confirmedWebhookCache.clear();
}

/**
 * Kiểm tra bất thường mốc thời gian webhook (lệch > 24h) để log cảnh báo
 * mà KHÔNG reject cứng giao dịch retry hợp lệ (#G8).
 */
export function checkWebhookTimestampAnomaly(
  gateway: string,
  orderId: string,
  rawTimestamp?: string | number | null
): boolean {
  if (!rawTimestamp) return false;
  let parsedMs: number | null = null;
  const s = String(rawTimestamp).trim();

  // VNPay format: YYYYMMDDHHmmss (GMT+7)
  if (/^\d{14}$/.test(s)) {
    const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}+07:00`;
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) parsedMs = t;
  } else {
    // PayOS ISO hoặc "YYYY-MM-DD HH:mm:ss"
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)
      ? `${s.replace(' ', 'T')}+07:00`
      : s;
    const t = Date.parse(normalized);
    if (!Number.isNaN(t)) parsedMs = t;
  }

  if (parsedMs === null) return false;
  const driftMs = Math.abs(Date.now() - parsedMs);
  if (driftMs > 24 * 60 * 60 * 1000) {
    console.warn(`[${gateway}] Timestamp anomaly >24h for orderId=${orderId}: raw=${s}`);
    emitMetric('webhook_timestamp_anomaly', 1, { gateway, orderId });
    return true;
  }
  return false;
}
