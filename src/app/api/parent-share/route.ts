import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimitDistributed, getRateLimitKey } from '@/lib/rate-limit';
import { createShareCode, listShareCodes, revokeShareCode, resolveShareCode } from '@/lib/parent-share-store';
import { isValidCodeFormat } from '@/lib/parent-share';

/** Thời hạn mặc định cho mã chia sẻ phụ huynh: 30 ngày (chống mã sống vĩnh viễn #2). */
const DEFAULT_SHARE_CODE_TTL_DAYS = 30;

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
 * PARENT SHARE — học sinh quản lý mã chia sẻ tiến độ cho phụ huynh.
 *
 * GET                       → list mã của mình (kèm trạng thái revoked/expires).
 * POST {action:'generate'}  → sinh mã mới có hạn 30 ngày (rate-limit chống spam).
 * POST {action:'revoke', code} → thu hồi 1 mã của mình.
 *
 * Yêu cầu đăng nhập (student). Ghi qua service-role trong store; RLS chỉ cho
 * student đọc/update mã của mình. Không auth → 401 (không tạo mã cho stub user).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();

  const rlKey = getRateLimitKey(req, 'parent-share', user.isAuthenticated ? user.id : undefined);
  const rl = await rateLimitDistributed(rlKey, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  // Hỗ trợ kiểm tra tính hợp lệ của mã công khai (KHÔNG lộ studentId UUID nội bộ — vá #9)
  const codeParam = req.nextUrl?.searchParams?.get('code');
  if (codeParam) {
    if (!isValidCodeFormat(codeParam)) {
      return NextResponse.json({ error: 'Mã không hợp lệ' }, { status: 404 });
    }
    const studentId = await resolveShareCode(codeParam);
    if (!studentId) {
      return NextResponse.json({ error: 'Mã không tồn tại hoặc đã hết hạn' }, { status: 404 });
    }
    return NextResponse.json({ valid: true });
  }

  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Cần đăng nhập' }, { status: 401 });
  }

  const rawCodes = await listShareCodes(user.id);
  const codes = Array.isArray(rawCodes)
    ? rawCodes.map((item) => {
        if (item && typeof item === 'object') {
          const sanitized = { ...item } as Record<string, unknown>;
          if (typeof sanitized.email === 'string') sanitized.email = maskEmail(sanitized.email);
          if (typeof sanitized.studentEmail === 'string') sanitized.studentEmail = maskEmail(sanitized.studentEmail);
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

  const rlKey = getRateLimitKey(req, 'parent-share', user.id);
  const rl = await rateLimitDistributed(rlKey, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều lần tạo mã. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === 'generate') {
    const rawTtl = typeof body?.ttlDays === 'number' && Number.isFinite(body.ttlDays) ? Math.floor(body.ttlDays) : DEFAULT_SHARE_CODE_TTL_DAYS;
    const ttlDays = Math.min(90, Math.max(1, rawTtl));
    const code = await createShareCode(user.id, ttlDays);
    if (!code) {
      return NextResponse.json({ error: 'Không thể tạo mã. Vui lòng thử lại.' }, { status: 503 });
    }
    return NextResponse.json({ code, ttlDays });
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
