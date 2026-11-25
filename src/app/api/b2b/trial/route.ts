import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimitDistributed, getRateLimitKey } from '@/lib/rate-limit';

/**
 * B2B 14-DAY CENTER TRIAL PROVISIONING API (W3 #39).
 * Cho phép Giáo viên / Trung tâm đăng ký tạo ngay lớp demo 14 ngày (tối đa 10 học sinh)
 * thay vì phải chờ gọi Zalo thủ công 1–2 tuần.
 */

function generateDemoClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[bytes[i] % chars.length];
  return `TRIAL-${out}`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const rl = await rateLimitDistributed(
    getRateLimitKey(req, 'b2b-trial', user.isAuthenticated ? user.id : null),
    5,
    10 * 60_000
  );
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Bạn đã gửi yêu cầu gần đây. Vui lòng thử lại sau ít phút.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const centerName = typeof body?.centerName === 'string' ? body.centerName.trim().slice(0, 120) : '';
  const contactName = typeof body?.contactName === 'string' ? body.contactName.trim().slice(0, 80) : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim().slice(0, 24) : '';
  const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 120) : '';

  if (centerName.length < 2 || contactName.length < 2 || phone.replace(/\D/g, '').length < 9) {
    return NextResponse.json(
      { error: 'Vui lòng nhập đầy đủ Tên Trung tâm/Giáo viên, Người liên hệ và Số điện thoại hợp lệ.' },
      { status: 400 }
    );
  }

  const demoCode = generateDemoClassCode();
  const expiresAt = new Date(Date.now() + 14 * 86_400_000).toISOString();

  try {
    const admin = createAdminClient();

    // Nếu đã đăng nhập, tạo ngay lớp demo thật trong bảng classrooms
    let classroomCreated = false;
    if (user.isAuthenticated) {
      const { error: clsErr } = await admin.from('classrooms').insert({
        teacher_id: user.id,
        code: demoCode,
        name: `[Demo 14 Ngày] ${centerName}`,
        target_score: 1450,
        description: `Lớp dùng thử B2B 14 ngày (tối đa 10 học sinh) — Liên hệ: ${contactName} (${phone})`,
      });
      classroomCreated = !clsErr;
    }

    await admin
      .from('b2b_trial_requests')
      .insert({
        user_id: user.isAuthenticated ? user.id : null,
        center_name: centerName,
        contact_name: contactName,
        phone,
        email,
        seat_limit: 10,
        demo_classroom_code: demoCode,
        trial_expires_at: expiresAt,
      })
      .then(() => undefined, () => undefined);

    return NextResponse.json(
      {
        success: true,
        demoClassroomCode: demoCode,
        seatLimit: 10,
        trialDays: 14,
        expiresAt,
        classroomCreated,
        joinPath: `/join?code=${demoCode}`,
        teacherPortalPath: '/teacher',
        message: `🎉 Đã kích hoạt lớp dùng thử 14 ngày (10 học sinh) với mã lớp ${demoCode}!`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/b2b/trial:', err);
    return NextResponse.json({ error: 'Không thể khởi tạo lớp dùng thử lúc này.' }, { status: 500 });
  }
}
