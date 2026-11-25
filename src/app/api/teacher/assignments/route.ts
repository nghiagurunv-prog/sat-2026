import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimitDistributed, getRateLimitKey } from '@/lib/rate-limit';

/**
 * TEACHER ASSIGNMENTS, FULL MOCK DISPATCH & CLASS LEADERBOARD API (Mục #22, #23 & W3 #36, #37).
 *
 * GET  ?classroomId=... → Danh sách bài tập + Full Mock đã giao & bảng điểm submissions của lớp.
 * POST { classroomId, title, skillIds, questionCount, targetTrapType, dueAt,
 *        assignmentType?: 'drill' | 'full_mock', examId?, windowStart?, windowEnd? }
 *      → Tạo bài tập cứu hộ / Đề Thi Thử Full Mock Adaptive có khóa khung giờ,
 *        khởi tạo submission pending cho toàn bộ học sinh trong lớp.
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
      return NextResponse.json({ assignments: [], leaderboard: [], available: false, reason: error.message });
    }

    const assignments = (data ?? []) as Array<Record<string, unknown>>;
    const assignmentIds = assignments.map((a) => String(a.id));
    let leaderboard: Array<{ studentId: string; totalScore: number; totalQuestions: number; completedCount: number; accuracyPct: number }> = [];

    if (assignmentIds.length > 0) {
      const { data: subs } = await admin
        .from('assignment_submissions')
        .select('student_id, score, total, status')
        .in('assignment_id', assignmentIds);

      const agg = new Map<string, { score: number; total: number; completed: number }>();
      for (const s of (subs ?? []) as Array<{ student_id: string; score: number; total: number; status: string }>) {
        const prev = agg.get(s.student_id) ?? { score: 0, total: 0, completed: 0 };
        prev.score += Number(s.score) || 0;
        prev.total += Number(s.total) || 0;
        if (s.status === 'completed') prev.completed += 1;
        agg.set(s.student_id, prev);
      }
      leaderboard = Array.from(agg.entries())
        .map(([studentId, st]) => ({
          studentId,
          totalScore: st.score,
          totalQuestions: st.total,
          completedCount: st.completed,
          accuracyPct: st.total > 0 ? Math.round((st.score / st.total) * 100) : 0,
        }))
        .sort((a, b) => b.accuracyPct - a.accuracyPct || b.completedCount - a.completedCount)
        .slice(0, 50);
    }

    return NextResponse.json({ assignments, leaderboard, available: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi tải danh sách bài tập.';
    return NextResponse.json({ assignments: [], leaderboard: [], available: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập để giao bài tập.' }, { status: 401 });
  }

  const rl = await rateLimitDistributed(getRateLimitKey(req, 'teacher-assign', user.id), 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Giao bài quá nhanh. Thử lại sau.' }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const classroomId = typeof body?.classroomId === 'string' ? body.classroomId.trim() : '';
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : '';
    const assignmentType = body?.assignmentType === 'full_mock' ? 'full_mock' : 'drill';
    const examId = typeof body?.examId === 'string' ? body.examId.trim().slice(0, 80) : null;
    const skillIds: string[] = Array.isArray(body?.skillIds)
      ? body.skillIds.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 10)
      : assignmentType === 'full_mock' && examId
      ? [`full_mock:${examId}`]
      : [];
    const questionCount =
      assignmentType === 'full_mock'
        ? 98
        : Math.max(1, Math.min(98, Number(body?.questionCount) || 10));
    const targetTrapType =
      typeof body?.targetTrapType === 'string'
        ? body.targetTrapType.slice(0, 60)
        : assignmentType === 'full_mock'
        ? 'full_mock_adaptive'
        : null;
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
        assignmentType,
        examId,
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
