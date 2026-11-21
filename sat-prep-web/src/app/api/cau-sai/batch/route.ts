import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { addMistake, type MistakeEntry } from '@/lib/mistakes-store';
import { nextReview } from '@/lib/leitner';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';
import { classifyRootCause } from '@/lib/exam-runner-helpers';

/**
 * BATCH BULK INGESTION & HEURISTIC ROOT-CAUSE AUTO-TAGGING (Mục #13).
 *
 * POST { items: Array<MistakeEntry & { timeSpentSec?: number }> }
 * - Thay vòng lặp N+1 `fetch('/api/cau-sai')` tuần tự bằng 1 request duy nhất (< 300ms).
 * - Tự động phân loại `rootCause` dựa trên thời gian làm bài thực tế.
 */

const MAX_BATCH_ITEMS = 100;

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const rl = rateLimit(getRateLimitKey(req, 'cau-sai-batch', user.id), 15, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Thao tác lưu sổ lỗi quá nhanh. Vui lòng thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json({ error: 'Danh sách câu sai (items) trống.' }, { status: 400 });
    }
    if (items.length > MAX_BATCH_ITEMS) {
      return NextResponse.json({ error: `Tối đa ${MAX_BATCH_ITEMS} câu sai mỗi đợt lưu.` }, { status: 400 });
    }

    type BatchMistakeInput = MistakeEntry & {
      timeSpentSec?: number;
      timeSpent?: number;
      rootCause?: string;
      practice_question?: string;
      userChoice?: string;
      correctChoice?: string;
      domain?: string;
      skillId?: string;
    };

    const reviewIso = nextReview(1);
    const enriched = (items.slice(0, MAX_BATCH_ITEMS) as BatchMistakeInput[]).map((raw) => {
      const sec = typeof raw.timeSpentSec === 'number' ? raw.timeSpentSec : raw.timeSpent;
      const rootCause = classifyRootCause(sec, typeof raw.rootCause === 'string' ? raw.rootCause : undefined);
      return {
        ...raw,
        rootCause,
        box: 1,
        next_review: reviewIso,
      };
    });

    // Ưu tiên bulk insert 1 lượt vào bảng `user_mistakes` nếu user đã xác thực (UUID hợp lệ)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
    if (isUuid) {
      try {
        const admin = createAdminClient();
        const rows = enriched.map((item) => ({
          user_id: user.id,
          question_text: String(item.question ?? item.practice_question ?? '').slice(0, 4000),
          passage: typeof item.passage === 'string' ? item.passage.slice(0, 8000) : null,
          user_choice: String(item.userChoice ?? item.user_choice ?? '').slice(0, 500),
          correct_choice: String(item.correctChoice ?? item.correct_choice ?? '').slice(0, 500),
          explanation: String(item.explanation ?? '').slice(0, 4000),
          domain: String(item.domain ?? 'General').slice(0, 120),
          skill_id: typeof item.skill_id === 'string' ? item.skill_id : (typeof item.skillId === 'string' ? item.skillId : null),
          root_cause: item.rootCause,
          box: 1,
          next_review: reviewIso,
        }));

        const { data, error } = await admin.from('user_mistakes').insert(rows).select('id, root_cause');
        if (!error && Array.isArray(data)) {
          return NextResponse.json({
            success: true,
            savedCount: data.length,
            breakdown: {
              careless: enriched.filter((x: { rootCause: string }) => x.rootCause === 'Careless / Rushed').length,
              timeTrap: enriched.filter((x: { rootCause: string }) => x.rootCause === 'Trap / Time-Trap').length,
              conceptual: enriched.filter((x: { rootCause: string }) => x.rootCause === 'Conceptual Gap').length,
            },
          });
        }
      } catch {
        // Fallback sang addMistake song song nếu schema bảng dev khác cột
      }
    }

    // Fallback: lưu song song theo lô nhỏ qua mistakes-store
    const results = await Promise.all(
      enriched.map((item: MistakeEntry) => addMistake(user.id, item, { box: 1, next_review: reviewIso }))
    );
    const savedCount = results.filter(Boolean).length;

    return NextResponse.json({
      success: true,
      savedCount,
      breakdown: {
        careless: enriched.filter((x: { rootCause: string }) => x.rootCause === 'Careless / Rushed').length,
        timeTrap: enriched.filter((x: { rootCause: string }) => x.rootCause === 'Trap / Time-Trap').length,
        conceptual: enriched.filter((x: { rootCause: string }) => x.rootCause === 'Conceptual Gap').length,
      },
    });
  } catch (err) {
    console.error('[api/cau-sai/batch] Lỗi lưu hàng loạt:', err);
    return NextResponse.json({ error: 'Lỗi hệ thống khi lưu sổ lỗi hàng loạt.' }, { status: 500 });
  }
}
