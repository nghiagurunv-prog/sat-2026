import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { loadMistakes, addMistake, updateMistakeReview, getMistakeByIdFromDb, type MistakeEntry } from '@/lib/mistakes-store';
import { promote, nextReview, isDue } from '@/lib/leitner';

/**
 * SỔ TAY CÂU SAI + SRS RESURFACING (implementation_plan.md §10.A.4, task #13)
 *
 * GET            → tất cả câu sai (cho MistakeNotebook phân trang — giữ tương thích).
 * GET ?due=true  → chỉ câu đến hạn ôn lại theo Leitner (chế độ ôn tập).
 * POST           → thêm câu sai mới (tự gắn box=1 + lịch ôn).
 * PATCH          → ghi kết quả ôn { mistakeId, isRemembered } → cập nhật box + lịch.
 *
 * Lưu trữ: Supabase `user_mistakes` (Phase 1.5) — thay file cau_sai.json.
 * Câu sai là dữ liệu SRS: nhớ → lên box (ôn thưa dần), quên → về box 1.
 */

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
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
    const newMistake: MistakeEntry = await request.json();

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
    const body = await request.json();
    const targetId = typeof body.id === 'string' ? body.id : (typeof body.mistakeId === 'string' ? body.mistakeId : undefined);
    if (!targetId) {
      return NextResponse.json({ error: "Thiếu mistakeId hoặc id" }, { status: 400 });
    }

    // Tìm bản ghi trực tiếp theo ID O(1) thay vì tải toàn bộ bảng về RAM (#023)
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
