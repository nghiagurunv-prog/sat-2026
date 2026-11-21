import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';

/**
 * SUPABASE RLS CLASSROOM BACKEND (Mục #22 — Thay thế localStorage cho /teacher).
 *
 * GET  → Lấy danh sách lớp do giáo viên sở hữu (kèm số lượng học sinh & bài tập)
 *        hoặc lớp mà học sinh đã tham gia (?role=student).
 * POST → Giáo viên tạo lớp học mới (sinh mã lớp 6 ký tự duy nhất dạng SAT-XXXX).
 * PUT  → Học sinh tham gia lớp bằng mã lớp `{ action: 'join', code, displayName }`.
 */

function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return `SAT-${out}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập để quản lý lớp học.' }, { status: 401 });
  }

  try {
    const role = req.nextUrl.searchParams.get('role') || 'teacher';
    const admin = createAdminClient();

    if (role === 'student') {
      const { data, error } = await admin
        .from('classroom_members')
        .select('classroom_id, joined_at, classrooms(id, code, name, target_score, description)')
        .eq('student_id', user.id)
        .order('joined_at', { ascending: false });

      if (error) {
        return NextResponse.json({ classrooms: [], available: false, reason: error.message });
      }
      return NextResponse.json({ classrooms: data ?? [], available: true });
    }

    const { data: classes, error } = await admin
      .from('classrooms')
      .select('id, code, name, target_score, description, created_at')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ classrooms: [], available: false, reason: error.message });
    }

    const classIds = (classes ?? []).map((c: { id: string }) => c.id);
    const memberCounts: Record<string, number> = {};
    if (classIds.length > 0) {
      const { data: members } = await admin
        .from('classroom_members')
        .select('classroom_id')
        .in('classroom_id', classIds);
      for (const m of (members ?? []) as Array<{ classroom_id: string }>) {
        memberCounts[m.classroom_id] = (memberCounts[m.classroom_id] || 0) + 1;
      }
    }

    const enriched = (classes ?? []).map((c: Record<string, unknown>) => ({
      ...c,
      studentCount: memberCounts[String(c.id)] || 0,
    }));

    return NextResponse.json({ classrooms: enriched, available: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi tải danh sách lớp học.';
    return NextResponse.json({ classrooms: [], available: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập để tạo lớp học.' }, { status: 401 });
  }

  const rl = rateLimit(getRateLimitKey(req, 'teacher-class-create', user.id), 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Tạo lớp quá nhanh. Thử lại sau.' }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 300) : '';
    const targetScore = Math.max(400, Math.min(1600, Number(body?.targetScore) || 1450));

    if (!name) {
      return NextResponse.json({ error: 'Tên lớp học là bắt buộc.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const code = generateClassCode();
    const { data, error } = await admin
      .from('classrooms')
      .insert({
        teacher_id: user.id,
        code,
        name,
        target_score: targetScore,
        description,
      })
      .select('id, code, name, target_score, description, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message, available: false }, { status: 500 });
    }

    return NextResponse.json({ success: true, classroom: { ...data, studentCount: 0 } }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi tạo lớp học.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập để tham gia lớp học.' }, { status: 401 });
  }

  const rl = rateLimit(getRateLimitKey(req, 'class-join', user.id), 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Thử quá nhiều lần. Vui lòng đợi 1 phút.' }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim().slice(0, 80) : '';

    if (!code || !/^[A-Z0-9-]{4,16}$/.test(code)) {
      return NextResponse.json({ error: 'Mã lớp học không hợp lệ (ví dụ: SAT-AB12CD).' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: cls, error: findErr } = await admin
      .from('classrooms')
      .select('id, code, name, target_score')
      .eq('code', code)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }
    if (!cls) {
      return NextResponse.json({ error: 'Không tìm thấy lớp học với mã này.' }, { status: 404 });
    }

    const { error: joinErr } = await admin.from('classroom_members').upsert(
      {
        classroom_id: cls.id,
        student_id: user.id,
        display_name: displayName || `Học viên ${user.id.slice(0, 6)}`,
      },
      { onConflict: 'classroom_id,student_id' }
    );

    if (joinErr) {
      return NextResponse.json({ error: joinErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, classroom: cls });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi tham gia lớp học.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
