import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';

/**
 * TEACHER ASSIGNMENTS & 1-CLICK AI REMEDIAL HOMEWORK DISPATCHER (Mục #22 & #23).
 *
 * GET  ?classroomId=... → Danh sách bài tập đã giao cho lớp (hoặc toàn bộ lớp của giáo viên).
 * POST { classroomId, title, skillIds, questionCount, targetTrapType, dueAt }
 *      → Tạo bài tập mới (hỗ trợ 1-Click Remedial từ Skill Heatmap lớp),
 *        tự động khởi tạo submission pending cho toàn bộ học sinh trong lớp.
 */

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  }

  try {
    const classroomId = req.nextUrl.searchParams.get('classroomId');
    const admin = createAdminClient();
    let query = admin
      .from('classroom_assignments')
      .select('id, classroom_id, title, skill_ids, question_count, target_trap_type, due_at, created_at')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (classroomId) {
      query = query.eq('classroom_id', classroomId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ assignments: [], available: false, reason: error.message });
    }
    return NextResponse.json({ assignments: data ?? [], available: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi tải danh sách bài tập.';
    return NextResponse.json({ assignments: [], available: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập để giao bài tập.' }, { status: 401 });
  }

  const rl = rateLimit(getRateLimitKey(req, 'teacher-assign', user.id), 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Giao bài quá nhanh. Thử lại sau.' }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const classroomId = typeof body?.classroomId === 'string' ? body.classroomId.trim() : '';
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : '';
    const skillIds: string[] = Array.isArray(body?.skillIds)
      ? body.skillIds.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 10)
      : [];
    const questionCount = Math.max(1, Math.min(50, Number(body?.questionCount) || 10));
    const targetTrapType = typeof body?.targetTrapType === 'string' ? body.targetTrapType.slice(0, 60) : null;
    const dueAt =
      typeof body?.dueAt === 'string' && !Number.isNaN(Date.parse(body.dueAt))
        ? new Date(body.dueAt).toISOString()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (!classroomId || !title) {
      return NextResponse.json({ error: 'Thiếu classroomId hoặc tiêu đề bài tập.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: cls } = await admin
      .from('classrooms')
      .select('id, teacher_id')
      .eq('id', classroomId)
      .eq('teacher_id', user.id)
      .maybeSingle();

    if (!cls) {
      return NextResponse.json({ error: 'Không tìm thấy lớp học hoặc bạn không có quyền giao bài.' }, { status: 403 });
    }

    const { data: assignment, error } = await admin
      .from('classroom_assignments')
      .insert({
        classroom_id: classroomId,
        teacher_id: user.id,
        title,
        skill_ids: skillIds,
        question_count: questionCount,
        target_trap_type: targetTrapType,
        due_at: dueAt,
      })
      .select('id, classroom_id, title, skill_ids, question_count, target_trap_type, due_at, created_at')
      .single();

    if (error || !assignment) {
      return NextResponse.json({ error: error?.message || 'Không tạo được bài tập.' }, { status: 500 });
    }

    const { data: members } = await admin
      .from('classroom_members')
      .select('student_id')
      .eq('classroom_id', classroomId);

    const memberList = (members ?? []) as Array<{ student_id: string }>;
    if (memberList.length > 0) {
      await admin.from('assignment_submissions').upsert(
        memberList.map((m) => ({
          assignment_id: assignment.id,
          student_id: m.student_id,
          score: 0,
          total: questionCount,
          status: 'pending',
        })),
        { onConflict: 'assignment_id,student_id' }
      );
    }

    return NextResponse.json(
      {
        success: true,
        assignment,
        dispatchedStudents: memberList.length,
      },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi giao bài tập.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
