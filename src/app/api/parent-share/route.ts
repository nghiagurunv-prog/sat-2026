import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit, checkRateLimit, getRateLimitKey } from '@/lib/rate-limit';
import { createShareCode, listShareCodes, revokeShareCode, resolveShareCode } from '@/lib/parent-share-store';
import { isValidCodeFormat } from '@/lib/parent-share';

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
 * Sinh mã chia sẻ ngẫu nhiên an toàn bằng crypto.randomBytes.
 * Sử dụng tập ký tự không gây nhầm lẫn thị giác (bỏ 0, O, 1, I, L) với độ dài >= 8 ký tự.
 */
const SAFE_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function generateSecureShareCode(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SAFE_CODE_CHARS[bytes[i] % SAFE_CODE_CHARS.length];
  }
  return code;
}

/**
 * PARENT SHARE — học sinh quản lý mã chia sẻ tiến độ cho phụ huynh.
 *
 * GET                       → list mã của mình (kèm trạng thái revoked/expires).
 * POST {action:'generate'}  → sinh mã mới (rate-limit chống spam mã).
 * POST {action:'revoke', code} → thu hồi 1 mã của mình.
 *
 * Yêu cầu đăng nhập (student). Ghi qua service-role trong store; RLS chỉ cho
 * student đọc/update mã của mình. Không auth → 401 (không tạo mã cho stub user).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();

  // Rate limit tra cứu mã: 15 req / phút với key chuẩn từ getRateLimitKey
  const limiter = typeof checkRateLimit === 'function' ? checkRateLimit : rateLimit;
  const rlKey = typeof getRateLimitKey === 'function'
    ? getRateLimitKey(req, 'parent-share', user.isAuthenticated ? user.id : undefined)
    : `parent-share:${user.isAuthenticated ? user.id : 'anon'}`;
  const rl = limiter(rlKey, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  // Hỗ trợ kiểm tra mã chia sẻ công khai qua query param
  const codeParam = req.nextUrl?.searchParams?.get('code');
  if (codeParam) {
    if (!isValidCodeFormat(codeParam)) {
      return NextResponse.json({ error: 'Mã không hợp lệ' }, { status: 404 });
    }
    const studentId = await resolveShareCode(codeParam);
    if (!studentId) {
      return NextResponse.json({ error: 'Mã không tồn tại hoặc đã hết hạn' }, { status: 404 });
    }
    return NextResponse.json({ valid: true, studentId });
  }

  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Cần đăng nhập' }, { status: 401 });
  }

  const rawCodes = await listShareCodes(user.id);
  // Che bớt email nếu có thông tin email gắn kèm mã
  const codes = Array.isArray(rawCodes)
    ? rawCodes.map((item: any) => {
        if (item && typeof item === 'object') {
          const sanitized = { ...item };
          if (sanitized.email) sanitized.email = maskEmail(sanitized.email);
          if (sanitized.studentEmail) sanitized.studentEmail = maskEmail(sanitized.studentEmail);
          return sanitized;
        }
        return item;
      })
    : rawCodes;

  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Cần đăng nhập' }, { status: 401 });
  }

  // Rate-limit chuẩn 15 req / phút chống brute-force và spam tạo mã
  const limiter = typeof checkRateLimit === 'function' ? checkRateLimit : rateLimit;
  const rlKey = typeof getRateLimitKey === 'function'
    ? getRateLimitKey(req, 'parent-share', user.id)
    : `parent-share:${user.id}`;
  const rl = limiter(rlKey, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều lần tạo mã. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === 'generate') {
    // Sinh mã ngẫu nhiên an toàn bằng crypto.randomBytes chống dò mã
    const secureCode = generateSecureShareCode(8);
    const code = await (createShareCode as (userId: string, customCode?: string) => Promise<string | null>)(user.id, secureCode);
    if (!code) {
      return NextResponse.json({ error: 'Không thể tạo mã. Vui lòng thử lại.' }, { status: 503 });
    }
    return NextResponse.json({ code });
  }

  if (action === 'revoke') {
    const code = body?.code;
    if (!isValidCodeFormat(code)) {
      return NextResponse.json({ error: 'Mã không hợp lệ' }, { status: 400 });
    }
    const ok = await revokeShareCode(user.id, code);
    if (!ok) {
      return NextResponse.json({ error: 'Không thể thu hồi mã.' }, { status: 503 });
    }
    return NextResponse.json({ revoked: true });
  }

  return NextResponse.json({ error: 'action không hợp lệ' }, { status: 400 });
}
