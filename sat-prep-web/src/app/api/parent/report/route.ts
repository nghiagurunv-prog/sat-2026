import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, checkRateLimit, getRateLimitKey } from '@/lib/rate-limit';
import { isValidCodeFormat } from '@/lib/parent-share';
import { resolveShareCode } from '@/lib/parent-share-store';
import { buildParentReport } from '@/lib/parent-report-store';

/**
 * Chuyển đổi timestamp/Date sang chuỗi ngày YYYY-MM-DD theo múi giờ Việt Nam (UTC+7).
 */
function getVietnamDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Che bớt email để bảo vệ quyền riêng tư học sinh (ví dụ: ab***@gmail.com).
 */
function maskEmail(email?: string | null): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return email || '';
  }
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local}***@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
}

/**
 * Đệ quy làm sạch dữ liệu báo cáo:
 * - Khử lỗi chia cho 0 (NaN, Infinity, "NaN%") thành 0 hoặc "0%".
 * - Che thông tin PII/Email nếu có vô tình lọt vào.
 */
function sanitizeReportData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'number') {
    if (isNaN(data) || !isFinite(data)) return 0;
    return data;
  }
  if (typeof data === 'string') {
    if (data.includes('NaN%') || data === 'NaN') {
      return data.replace(/NaN%/g, '0%').replace(/^NaN$/, '0');
    }
    if (data.includes('@') && data.includes('.')) {
      return maskEmail(data);
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeReportData);
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase().includes('email') && typeof value === 'string') {
        cleaned[key] = maskEmail(value);
      } else {
        cleaned[key] = sanitizeReportData(value);
      }
    }
    // Chặn chia cho 0 khi tổng số câu = 0
    if (('total' in cleaned && cleaned.total === 0) || ('totalQuestions' in cleaned && cleaned.totalQuestions === 0)) {
      if ('accuracy' in cleaned && (typeof cleaned.accuracy !== 'number' || isNaN(cleaned.accuracy))) {
        cleaned.accuracy = 0;
      }
      if ('accuracyRate' in cleaned && (typeof cleaned.accuracyRate !== 'number' || isNaN(cleaned.accuracyRate))) {
        cleaned.accuracyRate = 0;
      }
      if ('percentage' in cleaned && (typeof cleaned.percentage !== 'number' || isNaN(cleaned.percentage))) {
        cleaned.percentage = 0;
      }
    }
    return cleaned;
  }
  return data;
}

/**
 * PARENT REPORT (KHÔNG auth) — phụ huynh nhập mã chia sẻ → xem tiến độ con.
 *
 * Bảo mật:
 *  • Mã là bearer token đủ dài (parent-share.ts) → rate-limit theo mã + theo IP
 *    proxy chống brute-force dò mã.
 *  • resolveShareCode kiểm mã còn dùng được (chưa thu hồi/hết hạn) → studentId.
 *  • buildParentReport CHỈ trả tiến độ học (điểm, mastery, streak, trend, lịch sử
 *    thi), KHÔNG email/PII con.
 *  • Mã sai/thu hồi/hết hạn → 404 (không phân biệt để không lộ mã nào tồn tại).
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code') ?? '';

  if (!isValidCodeFormat(code)) {
    return NextResponse.json({ error: 'Mã không hợp lệ' }, { status: 404 });
  }

  // Rate-limit chuẩn theo IP proxy (20 req/phút) chống brute-force quét mã
  const limiter = typeof checkRateLimit === 'function' ? checkRateLimit : rateLimit;
  const rateLimitKey = typeof getRateLimitKey === 'function'
    ? getRateLimitKey(request, 'parent-report')
    : `parent-report:${request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'}`;
  const rlGeneral = limiter(rateLimitKey, 20, 60_000);
  if (!rlGeneral.allowed) {
    return NextResponse.json({ error: 'Quá nhiều yêu cầu. Thử lại sau.', retryAfterMs: rlGeneral.retryAfterMs }, { status: 429 });
  }

  // Rate-limit theo mã (chống dò 1 mã) — 30 lần/phút đủ cho reload thật.
  const rl = limiter(`parent-report:${code}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều yêu cầu. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  // Rate-limit theo IP proxy (chống dò NHIỀU mã từ 1 nguồn — key-theo-mã ở trên
  // cho mỗi mã đoán 1 bucket mới nên không chặn enumeration). 60 lần/phút/IP.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const rlIp = limiter(`parent-report-ip:${ip}`, 60, 60_000);
  if (!rlIp.allowed) {
    return NextResponse.json({ error: 'Quá nhiều yêu cầu. Thử lại sau.', retryAfterMs: rlIp.retryAfterMs }, { status: 429 });
  }

  const studentId = await resolveShareCode(code);
  if (!studentId) {
    return NextResponse.json({ error: 'Mã không tồn tại hoặc đã hết hạn' }, { status: 404 });
  }

  try {
    const report = await buildParentReport(studentId);
    // Khử triệt để lỗi chia cho 0, NaN, và che bớt PII email
    const sanitized = sanitizeReportData(report);
    // Đảm bảo định dạng múi giờ Việt Nam (UTC+7)
    const finalReport = {
      ...sanitized,
      timezone: 'Asia/Ho_Chi_Minh',
      reportDateVN: getVietnamDateString(),
    };
    return NextResponse.json(finalReport);
  } catch (e) {
    console.error('Parent report error:', e);
    return NextResponse.json({ error: 'Không thể tải báo cáo. Vui lòng thử lại.' }, { status: 500 });
  }
}
