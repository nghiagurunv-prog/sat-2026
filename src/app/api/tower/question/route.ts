import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { pickTowerSkill } from '@/lib/adaptive';
import { getUserTier } from '@/lib/subscription-store';
import { TIER_TOWER_CAP_PER_DAY } from '@/lib/subscription';
import { rateLimitDistributed, getRateLimitKey } from '@/lib/rate-limit';
import { POST as generatePracticePost } from '@/app/api/generate-practice/route';

/**
 * TOWER QUESTION API — Tháp Vô Tận adaptive (V1, kế thừa engine task #12).
 *
 * GET ?floor=N → chọn skill + độ khó cho tầng N dựa trên MASTERY thật của user
 * (server-authoritative), rồi sinh câu qua /api/generate-practice. Câu trả về
 * mang skillId THẬT nên CorePracticeUI ghi mastery đúng skill (trước đây Tower
 * gửi topic tự do → mọi câu quy nhầm về algebra.linear_eq).
 *
 * Cap theo GÓI (Wave 2): free tối đa TIER_TOWER_CAP_PER_DAY.free tầng/ngày, premium/
 * ultimate cao hơn. Hiện chưa có cột DB tower_floors_today → gate tạm theo "floor
 * yêu cầu không vượt cap/ngày" (chống nhảy tầng). Khi có cột sẽ enforce theo số
 * tầng thật đã leo hôm nay.
 *
 * Vì sao server-side: client KHÔNG được tự chọn skill/độ khó (chống chơi xấu),
 * và mastery chỉ đọc/ghi ở server (§9.1). Mirror pattern /api/gate-exam.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  const rl = await rateLimitDistributed(getRateLimitKey(request, 'tower-q', user.id), 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bạn leo tháp hơi nhanh. Chờ chút rồi thử lại nhé.', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  // Giới hạn count / limit truy vấn tối đa (<= 50) chống DoS/treo server (#016)
  const countParam = request.nextUrl.searchParams.get('count') ?? request.nextUrl.searchParams.get('limit');
  if (countParam !== null) {
    const parsed = parseInt(countParam, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 50) {
      return NextResponse.json(
        { error: 'Số lượng câu hỏi tháp (count/limit) tối đa là 50.' },
        { status: 400 }
      );
    }
  }

  const floorParam = request.nextUrl.searchParams.get('floor');
  const floor = Number(floorParam);
  if (!Number.isInteger(floor) || floor < 1) {
    return NextResponse.json({ error: 'floor phải là số nguyên >= 1' }, { status: 400 });
  }

  // Cap theo gói: floor yêu cầu không được vượt cap/ngày VÀ tổng số lượt gọi trong 24h không vượt cap*2 (chống lặp floor=1 vô hạn).
  const tier = await getUserTier(user.id);
  const towerCap = TIER_TOWER_CAP_PER_DAY[tier];
  if (floor > towerCap) {
    return NextResponse.json(
      {
        error: `Gói ${tier} chỉ được leo tối đa ${towerCap} tầng/ngày. Nâng cấp để leo cao hơn!`,
        tierLocked: tier === 'free',
        towerCap,
      },
      { status: 403 }
    );
  }
  // Cap theo gói chuẩn (vá #12): dùng rateLimitDistributed đúng mức towerCap (không nhân đôi)
  const dailyTowerKey = getRateLimitKey(request, 'tower-daily', user.id);
  const dailyTowerRl = await rateLimitDistributed(dailyTowerKey, towerCap, 86_400_000);
  if (!dailyTowerRl.allowed) {
    return NextResponse.json(
      {
        error: `Bạn đã đạt giới hạn ${towerCap} tầng Tháp hôm nay cho gói ${tier}. Nâng cấp để leo cao hơn!`,
        tierLocked: tier === 'free',
        towerCap,
      },
      { status: 429 }
    );
  }

  const summary = await getMasterySummary(user.id);
  const pick = pickTowerSkill(summary.skills, floor);
  if (!pick) {
    return NextResponse.json({ error: 'Không tìm thấy kỹ năng Toán để sinh câu hỏi' }, { status: 404 });
  }

  try {
    // Gọi trực tiếp handler nội bộ — không forward cookie qua request.nextUrl.origin
    const internalReq = new Request('http://internal.satguru.local/api/generate-practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleType: pick.moduleType,
        topic: pick.label,
        skillId: pick.skillId,
        difficulty: pick.difficulty,
      }),
    });
    const res = await generatePracticePost(internalReq);

    if (!res.ok) {
      // Chuyển nguyên trạng thái lỗi (quota 429 / budget 503 / cấu hình 500) để
      // client hiển thị đúng thông điệp thay vì nuốt mất.
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data?.error ?? 'Không sinh được câu hỏi cho tầng tháp.' },
        { status: res.status }
      );
    }

    const data = await res.json();
    // Gắn kèm difficulty + skillId đã chọn (đảm bảo client/Mastery dùng đúng mức,
    // không phụ thuộc field difficulty do AI tự ghi).
    return NextResponse.json({ ...data, difficulty: pick.difficulty, skillId: pick.skillId });
  } catch (e) {
    console.error('Tower question: lỗi sinh câu hỏi', e);
    return NextResponse.json({ error: 'Lỗi sinh câu hỏi cho tầng tháp.' }, { status: 503 });
  }
}
