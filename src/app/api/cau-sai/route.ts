import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimitDistributed, getRateLimitKey } from '@/lib/rate-limit';
import { loadMistakes, addMistake, updateMistakeReview, getMistakeByIdFromDb, type MistakeEntry } from '@/lib/mistakes-store';
import { promote, nextReview, isDue } from '@/lib/leitner';

/**
 * SỔ TAY CÂU SAI + SRS RESURFACING (implementation_plan.md §10.A.4, task #13)
 *
 * GET            → tất cả câu sai (cho MistakeNotebook phân trang — giữ tương thích).
 * GET ?due=true  → chỉ câu đến hạn ôn lại theo Leitner (chế độ ôn tập).
 * POST           → thêm câu sai mới (auth bắt buộc, rate-limit, whitelist + clamp payload — vá #10).
 * PATCH          → ghi kết quả ôn { mistakeId, isRemembered } → cập nhật box + lịch.
 */

function clampStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function sanitizeMistakePayload(raw: unknown): MistakeEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const question = clampStr(obj.question, 4000);
  if (!question) return null;

  const choices = Array.isArray(obj.choices)
    ? obj.choices
        .filter((c): c is string => typeof c === 'string')
        .slice(0, 6)
        .map((c) => c.trim().slice(0, 500))
    : undefined;

  const entry: MistakeEntry = {
    ...(typeof obj.id === 'string' && obj.id.trim() ? { id: obj.id.trim().slice(0, 120) } : {}),
    question,
    choices: choices && choices.length > 0 ? choices : [],
    passage: clampStr(obj.passage, 6000) || undefined,
    correct_choice: clampStr(obj.correct_choice, 500) || '',
    user_choice: clampStr(obj.user_choice, 500) || '',
    explanation: clampStr(obj.explanation, 6000) || undefined,
    source: clampStr(obj.source, 120) || undefined,
    skill_id: typeof obj.skill_id === 'string' ? obj.skill_id.trim().slice(0, 100) : null,
  };
  return entry;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user.isAuthenticated) {
      return NextResponse.json([]);
    }
    const dueOnly = new URL(request.url).searchParams.get('due') === 'true';

    const data = await loadMistakes(user.id);
    const result = dueOnly ? data.filter((m) => isDue(m.next_review)) : data;
    return NextResponse.json(result);
  } catch (error) {
    console.error("Lỗi đọc câu sai:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi đọc dữ liệu" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user.isAuthenticated) {
      return NextResponse.json(
        { error: "Bạn cần đăng nhập để đồng bộ sổ tay câu sai lên đám mây." },
        { status: 401 }
      );
    }

    const rl = await rateLimitDistributed(getRateLimitKey(request, 'cau-sai-post', user.id), 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Lưu câu sai quá nhanh. Vui lòng thử lại sau.", retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const newMistake = sanitizeMistakePayload(rawBody);
    if (!newMistake) {
      return NextResponse.json({ error: "Dữ liệu câu sai không hợp lệ (thiếu question)." }, { status: 400 });
    }

    // Câu sai mới: box 1, đến hạn ôn ngay theo lịch Leitner.
    const saved = await addMistake(user.id, newMistake, { box: 1, next_review: nextReview(1) });
    if (!saved) {
      return NextResponse.json({ error: "Lỗi hệ thống khi lưu dữ liệu" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Đã lưu câu sai", data: saved });
  } catch (error) {
    console.error("Lỗi ghi câu sai:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi lưu dữ liệu" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user.isAuthenticated) {
      return NextResponse.json({ error: "Cần đăng nhập để cập nhật tiến độ ôn câu sai." }, { status: 401 });
    }

    const rl = await rateLimitDistributed(getRateLimitKey(request, 'cau-sai-patch', user.id), 60, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Cập nhật quá nhanh. Vui lòng thử lại sau.", retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const targetId = typeof body.id === 'string' ? body.id : (typeof body.mistakeId === 'string' ? body.mistakeId : undefined);
    if (!targetId) {
      return NextResponse.json({ error: "Thiếu mistakeId hoặc id" }, { status: 400 });
    }

    const cur = await getMistakeByIdFromDb(user.id, targetId);
    if (!cur) {
      return NextResponse.json({ error: "Không tìm thấy câu sai" }, { status: 404 });
    }

    const newBox = promote(cur.box ?? 1, !!body.isRemembered);
    const updated = await updateMistakeReview(user.id, targetId, newBox, nextReview(newBox));
    if (!updated) {
      return NextResponse.json({ error: "Lỗi hệ thống khi cập nhật" }, { status: 500 });
    }

    return NextResponse.json({ success: true, mistake: updated });
  } catch (error) {
    console.error("Lỗi cập nhật ôn tập câu sai:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi cập nhật" }, { status: 500 });
  }
}
