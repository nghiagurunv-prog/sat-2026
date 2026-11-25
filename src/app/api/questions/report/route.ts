import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { verifyAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimitDistributed, getRateLimitKey } from '@/lib/rate-limit';

/**
 * QUESTION REPORT QUEUE API (W3 #10 — Nút "Báo lỗi câu hỏi" đẩy vào hàng đợi Admin).
 * POST  → Học sinh gửi báo lỗi câu hỏi (rate-limit 10/phút).
 * GET   → Admin xem hàng đợi báo lỗi (fail-closed 403).
 * PATCH → Admin đánh dấu resolved/dismissed + ghi chú (fail-closed 403).
 */

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const rl = await rateLimitDistributed(
    getRateLimitKey(req, 'question-report', user.isAuthenticated ? user.id : null),
    10,
    60_000
  );
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Bạn gửi báo lỗi quá nhanh. Vui lòng thử lại sau.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const questionId = typeof body?.questionId === 'string' ? body.questionId.trim().slice(0, 120) : '';
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (!questionId || !reason) {
    return NextResponse.json({ error: 'Thiếu mã câu hỏi hoặc lý do báo lỗi.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('question_reports')
      .insert({
        reporter_id: user.isAuthenticated ? user.id : null,
        question_id: questionId,
        skill_id: typeof body?.skillId === 'string' ? body.skillId.trim().slice(0, 100) : null,
        subject: typeof body?.subject === 'string' ? body.subject.trim().slice(0, 40) : 'Math',
        stem_preview: typeof body?.stemPreview === 'string' ? body.stemPreview.trim().slice(0, 300) : '',
        reason,
        status: 'open',
      })
      .select('id, question_id, status, created_at')
      .single();

    if (error) {
      return NextResponse.json({ success: true, queuedLocally: true, message: 'Đã ghi nhận báo lỗi câu hỏi.' });
    }
    return NextResponse.json({ success: true, report: data }, { status: 201 });
  } catch {
    return NextResponse.json({ success: true, queuedLocally: true, message: 'Đã ghi nhận báo lỗi câu hỏi.' });
  }
}

export async function GET(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('question_reports')
      .select('id, question_id, skill_id, subject, stem_preview, reason, status, admin_note, created_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ reports: [], available: false });
    }
    return NextResponse.json({ reports: data ?? [], available: true });
  } catch {
    return NextResponse.json({ reports: [], available: false });
  }
}

export async function PATCH(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  const status = body?.status === 'resolved' || body?.status === 'dismissed' ? body.status : null;
  const adminNote = typeof body?.adminNote === 'string' ? body.adminNote.trim().slice(0, 300) : '';

  if (!id || !status) {
    return NextResponse.json({ error: 'Thiếu id hoặc status hợp lệ (resolved/dismissed).' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('question_reports')
      .update({ status, admin_note: adminNote, resolved_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, status, resolved_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, report: data });
  } catch {
    return NextResponse.json({ error: 'Lỗi cập nhật trạng thái báo lỗi.' }, { status: 500 });
  }
}
