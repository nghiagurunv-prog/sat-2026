import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { buildSpeedQuizLeaderboard } from '@/lib/speed-quiz-leaderboard-store';
import type { SeasonCycle } from '@/lib/season';

/**
 * SPEED QUIZ LEADERBOARD API (đọc-only) — xếp hạng theo LƯỢT TỐT NHẤT trong kỳ.
 *
 * GET ?cycle=day|week|month|year[&bracket=ultimate] → { cycle, cycleKey, cycleLabel, msLeft, top, me, available }.
 *   • Metric = MAX(correct_count) mỗi user trong kỳ (server chấm → không fake).
 *   • Chỉ user OPT-IN mới lên bảng (tái dùng opt_in_leaderboard của user_profiles).
 *   • bracket=ultimate → GIẢI ĐẤU ĐỘC QUYỀN: chỉ user gói ultimate có mặt trong
 *     bảng. AI XEM CŨNG ĐƯỢC (không chặn đọc) — chỉ tư cách GÓP MẶT bị gate tier.
 *   • available:false = bảng chưa migrate → UI "sắp ra mắt".
 *
 * 🔴 PRIVACY: response CHỈ nickname + score + rank + isMe. KHÔNG user_id/email.
 */

const TOP_N = 50;
const VALID_CYCLES: SeasonCycle[] = ['day', 'week', 'month', 'year'];

// Helper bảo vệ PII: Che email nếu nickname/displayName/name chứa ký tự '@'
function maskEmailOrName(str?: string | null): string {
  if (!str) return 'Học viên SAT';
  const trimmed = str.trim();
  if (trimmed.includes('@')) {
    const localPart = trimmed.split('@')[0];
    return localPart.length <= 2 ? `${localPart}***` : `${localPart.slice(0, 3)}***`;
  }
  return trimmed;
}

// Helper loại bỏ trường email nhạy cảm khỏi bảng xếp hạng công khai (#027)
function sanitizeLeaderboardEntry<T extends Record<string, any>>(entry: T): T {
  if (!entry || typeof entry !== 'object') return entry;
  const { email: _removedEmail, ...rest } = entry;
  const sanitized: Record<string, any> = { ...rest };

  if (typeof sanitized.nickname === 'string') {
    sanitized.nickname = maskEmailOrName(sanitized.nickname);
  }
  if (typeof sanitized.name === 'string') {
    sanitized.name = maskEmailOrName(sanitized.name);
  }
  if (typeof sanitized.displayName === 'string') {
    sanitized.displayName = maskEmailOrName(sanitized.displayName);
  }

  return sanitized as T;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  const rl = rateLimit(`sq-lb:${user.id}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  const cycleParam = request.nextUrl.searchParams.get('cycle') ?? 'day';
  if (!VALID_CYCLES.includes(cycleParam as SeasonCycle)) {
    return NextResponse.json({ error: 'cycle phải là day|week|month|year' }, { status: 400 });
  }

  // bracket=ultimate → bảng giải đấu độc quyền (chỉ user ultimate góp mặt). Giá trị
  // khác/vắng → bảng chung. Không chặn xem — ai cũng đọc được, chỉ tư cách góp mặt gate.
  const bracket = request.nextUrl.searchParams.get('bracket') === 'ultimate' ? 'ultimate' : undefined;

  try {
    const view = await buildSpeedQuizLeaderboard(user.id, cycleParam as SeasonCycle, TOP_N, new Date(), bracket);
    const sanitizedTop = Array.isArray(view.top) ? view.top.map(sanitizeLeaderboardEntry) : [];
    const sanitizedMe = view.me ? sanitizeLeaderboardEntry(view.me) : null;

    return NextResponse.json({
      ...view,
      top: sanitizedTop,
      me: sanitizedMe,
    });
  } catch (error) {
    console.error('Lỗi speed-quiz leaderboard:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
