import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { recommendNext } from '@/lib/adaptive';
import { getUserTier } from '@/lib/subscription-store';
import type { Subject } from '@/lib/skill-taxonomy';

/**
 * ADAPTIVE API (implementation_plan.md §10.A.1, task #12)
 *
 * GET → đề xuất skill + độ khó kế tiếp nên luyện, dựa trên mastery hiện tại.
 *   ?subject=math|reading   lọc theo môn
 *   ?moduleType=math|vocab|literature|desmos   lọc theo loại module
 *
 * Ghép tầng I/O (mastery) với engine thuần (adaptive) — đúng ranh giới đã thiết kế.
 *
 * PHÂN TẦNG (định giá theo phễu 2026-07-06): "Luyện Mục Tiêu" cá nhân hóa (skill
 * yếu nhất + độ khó ZPD) là quyền lợi Premium+. Free → trả cờ `locked` (KHÔNG
 * lộ đề xuất) để UI hiện upsell. Redact SERVER-SIDE. Dữ liệu mastery vẫn ghi/đo
 * đủ ở free — chỉ khóa tầng ĐỌC đề xuất.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const tier = await getUserTier(user.id);

  // Chỉ khóa gói Free; cả Premium & Ultimate đều được mở khóa Luyện Mục Tiêu (Adaptive).
  if (tier === 'free') {
    return NextResponse.json({ recommendation: null, locked: true });
  }

  const summary = await getMasterySummary(user.id);

  const params = new URL(request.url).searchParams;

  // Giới hạn count / limit truy vấn tối đa (<= 50) chống DoS/treo server (#016)
  const countParam = params.get('count') ?? params.get('limit');
  if (countParam !== null) {
    const parsed = parseInt(countParam, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 50) {
      return NextResponse.json(
        { error: 'Số lượng đề xuất truy vấn (count/limit) tối đa là 50.' },
        { status: 400 }
      );
    }
  }

  const subjectParam = params.get('subject');
  const subject =
    subjectParam === 'math' || subjectParam === 'reading'
      ? (subjectParam as Subject)
      : undefined;
  const moduleType = params.get('moduleType') ?? undefined;

  const recommendation = recommendNext(summary, { subject, moduleType });

  if (!recommendation) {
    return NextResponse.json(
      { error: 'Không tìm thấy kỹ năng phù hợp với bộ lọc' },
      { status: 404 }
    );
  }

  return NextResponse.json({ recommendation, overall: summary.overall, locked: false });
}
