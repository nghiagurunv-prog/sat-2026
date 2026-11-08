import 'server-only';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

const buckets = new Map<string, { count: number; resetAt: number }>();
// Giữ alias windows để tương thích ngược hoàn toàn
const windows = buckets;

const CLEANUP_INTERVAL = 60_000;
export const MAX_BUCKETS = 5000;
export const MAX_WINDOWS_SIZE = MAX_BUCKETS;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, val] of buckets) {
    if (val.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Cắt tỉa các phần tử cũ nhất (LRU eviction) khi Map vượt ngưỡng MAX_BUCKETS
 * để chống tràn bộ nhớ (OOM) khi bị bot flood IP / request.
 * Ưu tiên dọn các bucket đã hết hạn trước; nếu vẫn đầy thì xóa key cũ nhất theo FIFO/LRU.
 */
function evictOldestEntries() {
  if (buckets.size < MAX_BUCKETS) return;

  // 1. Dọn các bucket đã hết hạn trước
  const now = Date.now();
  for (const [k, val] of buckets) {
    if (val.resetAt <= now) {
      buckets.delete(k);
    }
  }

  // 2. Nếu vẫn đầy (>= MAX_BUCKETS), xóa key cũ nhất theo thứ tự Map iteration (LRU/FIFO)
  while (buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey !== undefined) {
      buckets.delete(oldestKey);
    } else {
      break;
    }
  }
}

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  cleanup();
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    evictOldestEntries();
    buckets.delete(key); // Xóa để đưa xuống cuối (LRU order)
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
  }

  if (entry.count < maxRequests) {
    entry.count++;
    // Đưa entry vừa dùng xuống cuối hàng đợi (LRU refresh)
    buckets.delete(key);
    buckets.set(key, entry);
    return { allowed: true, remaining: maxRequests - entry.count, retryAfterMs: 0 };
  }

  return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
}

/**
 * Trích xuất IP khách hàng từ Request / Headers an toàn và chuẩn xác.
 * Ưu tiên các header tin cậy: cf-connecting-ip -> x-vercel-forwarded-for -> x-real-ip -> x-forwarded-for.
 * Chuẩn hóa và giới hạn độ dài <= 64 ký tự chống tấn công OOM.
 */
export function getClientIp(req: Request | { headers: Headers }): string {
  try {
    const headers = 'headers' in req && req.headers ? req.headers : null;
    if (!headers) return '127.0.0.1';

    const candidates = [
      headers.get('cf-connecting-ip'),
      headers.get('x-vercel-forwarded-for'),
      headers.get('x-real-ip'),
      headers.get('x-forwarded-for')?.split(',')[0],
    ];

    for (const raw of candidates) {
      if (raw) {
        const trimmed = raw.trim();
        if (trimmed.length > 0) {
          // Giới hạn độ dài <= 64 ký tự (IPv6 tối đa 45 chars) để chống header flood làm tràn RAM
          return trimmed.slice(0, 64);
        }
      }
    }
  } catch {
    // fallback
  }
  return '127.0.0.1';
}

/**
 * Tạo key rate-limit kết hợp tiền tố, userId (nếu đã đăng nhập) hoặc IP khách hàng.
 */
export function getRateLimitKey(
  req: Request | { headers: Headers },
  prefix: string,
  userId?: string | null
): string {
  return `${prefix}:${userId ? `u:${userId}` : `ip:${getClientIp(req)}`}`;
}

/** Alias cho các route gọi checkRateLimit */
export const checkRateLimit = rateLimit;
