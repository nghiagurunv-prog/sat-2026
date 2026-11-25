import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimitDistributed, getRateLimitKey } from '@/lib/rate-limit';
import { loadOnboarding } from '@/lib/onboarding-store';
import { tryClaimOnceAtomic } from '@/lib/economy-store';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * REFERRAL ACADEMIC COIN REWARD API (W2 #24 — Mã giới thiệu bạn bè thưởng Xu học thuật).
 * - Không phá giá gói (không giảm tiền mặt, chỉ thưởng 300 Xu học thuật đổi quà/PDF).
 * - Yêu cầu người nhập mã đã hoàn thành bài Diagnostic đầu vào (chống clone nick farm xu).
 * - Khóa atomic 1 lần duy nhất mỗi tài khoản qua tryClaimOnceAtomic('referral_welcome', 'once').
 */

const REFERRAL_BONUS_COINS = 300;
const REFERRAL_CODE_REGEX = /^SAT-[A-Z0-9]{4,12}$/;

function buildOwnReferralCode(userId: string): string {
  const cleanId = (userId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  return `SAT-${cleanId || 'GURU26'}`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập để nhập mã giới thiệu.' }, { status: 401 });
  }

  const rl = await rateLimitDistributed(getRateLimitKey(req, 'referral-claim', user.id), 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Thử quá nhiều lần. Vui lòng đợi 1 phút.', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const rawCode = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!REFERRAL_CODE_REGEX.test(rawCode)) {
    return NextResponse.json(
      { error: 'Mã giới thiệu không đúng định dạng (ví dụ: SAT-A1B2C3).' },
      { status: 400 }
    );
  }

  const ownCode = buildOwnReferralCode(user.id);
  if (rawCode === ownCode) {
    return NextResponse.json(
      { error: 'Bạn không thể tự nhập mã giới thiệu của chính mình.' },
      { status: 400 }
    );
  }

  // Bắt buộc hoàn thành bài Diagnostic trước để chống tạo tài khoản ảo farm xu
  const onboarding = await loadOnboarding(user.id);
  if (!onboarding?.completed) {
    return NextResponse.json(
      {
        error: 'Hãy hoàn thành bài Test Xếp Lớp (Diagnostic) trước để mở khóa +300 Xu quà giới thiệu bạn bè!',
        requiresDiagnostic: true,
      },
      { status: 409 }
    );
  }

  // Khóa atomic duy nhất 1 lần/user cho phần thưởng nhập mã giới thiệu
  const claim = await tryClaimOnceAtomic(
    user.id,
    'referral_welcome',
    'once',
    REFERRAL_BONUS_COINS,
    50
  );
  if (!claim || !claim.ok) {
    if (claim && claim.reason === 'already_claimed') {
      return NextResponse.json(
        { error: 'Tài khoản của bạn đã nhận thưởng mã giới thiệu trước đó rồi.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Không thể xử lý thưởng giới thiệu lúc này. Thử lại sau.' },
      { status: 503 }
    );
  }

  // Ghi nhận vào bảng referral_claims (best-effort nếu bảng chưa migrate)
  try {
    const admin = createAdminClient();
    await admin.from('referral_claims').insert({
      referrer_code: rawCode,
      referee_user_id: user.id,
      coins_awarded: REFERRAL_BONUS_COINS,
    });
  } catch {
    // ignore if table not yet migrated
  }

  return NextResponse.json({
    success: true,
    code: rawCode,
    granted: { coins: REFERRAL_BONUS_COINS, xp: 50 },
    coins: claim.coins,
    xp: claim.xp,
    message: `🎉 Chúc mừng! Bạn đã nhận +${REFERRAL_BONUS_COINS} Xu học thuật từ mã giới thiệu ${rawCode}!`,
  });
}
