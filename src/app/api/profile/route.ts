import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { loadMyProfile, saveMyProfile } from '@/lib/leaderboard-store';
import { validateNickname, nicknameReasonMessage } from '@/lib/nickname';

/**
 * PROFILE API — BÍ DANH + opt-in leaderboard của user hiện tại.
 *
 * GET  → { nickname, optIn, canChangeNickname, available }.
 * POST → đặt/đổi nickname và/hoặc bật-tắt opt-in.
 *   • Validate nickname (400 nếu bậy/sai định dạng).
 *   • Cooldown 24h giữa 2 lần ĐỔI nickname (chống spam đổi tên mạo danh).
 *   • CHẶN bật opt-in khi chưa có nickname (không lên bảng với tên rỗng).
 *   • available:false (not_ready) = bảng chưa migrate → UI ẩn tính năng, KHÔNG crash.
 *
 * Yêu cầu ĐÃ ĐĂNG NHẬP (không cho guest stub đặt profile).
 */

const NICKNAME_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Cần đăng nhập' }, { status: 401 });
  }

  const profile = await loadMyProfile(user.id);
  if (profile === null) {
    // Bảng chưa migrate.
    return NextResponse.json({
      available: false,
      nickname: null,
      optIn: false,
      canChangeNickname: true,
      displayName: null,
      targetScore: null,
      school: null,
      classCode: null,
    });
  }

  const canChangeNickname =
    !profile.nicknameUpdatedAt ||
    Date.now() - new Date(profile.nicknameUpdatedAt).getTime() >= NICKNAME_COOLDOWN_MS;

  const profRecord = profile as unknown as Record<string, unknown>;

  return NextResponse.json({
    available: true,
    nickname: profile.nickname,
    optIn: profile.optIn,
    canChangeNickname,
    displayName: profRecord.displayName ?? null,
    targetScore: profRecord.targetScore ?? null,
    school: profRecord.school ?? null,
    classCode: profRecord.classCode ?? null,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Cần đăng nhập' }, { status: 401 });
  }

  const rl = rateLimit(`profile:${user.id}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Quá nhiều thay đổi. Thử lại sau.', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  let body: {
    nickname?: unknown;
    optIn?: unknown;
    displayName?: unknown;
    targetScore?: unknown;
    school?: unknown;
    classCode?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }

  const current = await loadMyProfile(user.id);
  if (current === null) {
    // Bảng chưa migrate → không thể lưu.
    return NextResponse.json({ error: 'Tính năng sắp ra mắt.', code: 'not_ready' }, { status: 503 });
  }

  const currentRecord = current as unknown as Record<string, unknown>;

  const save: {
    nickname?: string;
    optIn?: boolean;
    displayName?: string;
    targetScore?: number;
    school?: string;
    classCode?: string;
  } = {};

  // 1) Đổi nickname (nếu gửi).
  if (typeof body.nickname === 'string') {
    const check = validateNickname(body.nickname);
    if (!check.ok) {
      return NextResponse.json(
        { error: nicknameReasonMessage(check.reason), code: check.reason },
        { status: 400 }
      );
    }
    // Cooldown chỉ áp khi THỰC SỰ đổi sang tên khác (đặt lại y hệt không tính).
    const isChanging = check.normalized !== current.nickname;
    if (isChanging && current.nicknameUpdatedAt) {
      const elapsed = Date.now() - new Date(current.nicknameUpdatedAt).getTime();
      if (elapsed < NICKNAME_COOLDOWN_MS) {
        const hoursLeft = Math.ceil((NICKNAME_COOLDOWN_MS - elapsed) / (60 * 60 * 1000));
        return NextResponse.json(
          { error: `Chỉ đổi bí danh mỗi 24 giờ. Thử lại sau ~${hoursLeft} giờ.`, code: 'cooldown' },
          { status: 429 }
        );
      }
    }
    if (isChanging) save.nickname = check.normalized;
  }

  // 2) Toggle opt-in (nếu gửi). CHẶN bật khi chưa có nickname (kể cả vừa gửi).
  if (typeof body.optIn === 'boolean') {
    const willHaveNickname = save.nickname ?? current.nickname;
    if (body.optIn && !willHaveNickname) {
      return NextResponse.json(
        { error: 'Hãy đặt bí danh trước khi hiển thị trên bảng xếp hạng.', code: 'need_nickname' },
        { status: 400 }
      );
    }
    save.optIn = body.optIn;
  }

  // 3) Validate & sanitize displayName (#050: <= 60 ký tự, xoá thẻ HTML <...>)
  if (body.displayName !== undefined && body.displayName !== null) {
    if (typeof body.displayName !== 'string') {
      return NextResponse.json({ error: 'Tên hiển thị không hợp lệ' }, { status: 400 });
    }
    const cleanDisplayName = stripHtml(body.displayName);
    if (cleanDisplayName.length > 60) {
      return NextResponse.json(
        { error: 'Tên hiển thị không được vượt quá 60 ký tự' },
        { status: 400 }
      );
    }
    save.displayName = cleanDisplayName;
  }

  // 4) Validate targetScore (#050: 400 đến 1600, bội số của 10)
  if (body.targetScore !== undefined && body.targetScore !== null) {
    const score = Number(body.targetScore);
    if (!Number.isInteger(score) || score < 400 || score > 1600 || score % 10 !== 0) {
      return NextResponse.json(
        { error: 'Mục tiêu điểm phải là số nguyên từ 400 đến 1600 và là bội số của 10' },
        { status: 400 }
      );
    }
    save.targetScore = score;
  }

  // 5) Validate & sanitize school (#050: <= 100 ký tự, xoá thẻ HTML <...>)
  if (body.school !== undefined && body.school !== null) {
    if (typeof body.school !== 'string') {
      return NextResponse.json({ error: 'Tên trường không hợp lệ' }, { status: 400 });
    }
    const cleanSchool = stripHtml(body.school);
    if (cleanSchool.length > 100) {
      return NextResponse.json(
        { error: 'Tên trường không được vượt quá 100 ký tự' },
        { status: 400 }
      );
    }
    save.school = cleanSchool;
  }

  // 6) Validate & sanitize classCode (#050: <= 30 ký tự, xoá thẻ HTML <...>)
  if (body.classCode !== undefined && body.classCode !== null) {
    if (typeof body.classCode !== 'string') {
      return NextResponse.json({ error: 'Mã lớp không hợp lệ' }, { status: 400 });
    }
    const cleanClassCode = stripHtml(body.classCode);
    if (cleanClassCode.length > 30) {
      return NextResponse.json(
        { error: 'Mã lớp không được vượt quá 30 ký tự' },
        { status: 400 }
      );
    }
    save.classCode = cleanClassCode;
  }

  if (
    save.nickname === undefined &&
    save.optIn === undefined &&
    save.displayName === undefined &&
    save.targetScore === undefined &&
    save.school === undefined &&
    save.classCode === undefined
  ) {
    // Không có gì để đổi (vd gửi lại tên cũ) — trả trạng thái hiện tại, không lỗi.
    return NextResponse.json({
      success: true,
      nickname: current.nickname,
      optIn: current.optIn,
      displayName: currentRecord.displayName ?? null,
      targetScore: currentRecord.targetScore ?? null,
      school: currentRecord.school ?? null,
      classCode: currentRecord.classCode ?? null,
    });
  }

  const ok = await saveMyProfile(user.id, save as any);
  if (!ok) {
    return NextResponse.json({ error: 'Không thể lưu lúc này.', code: 'save_failed' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    nickname: save.nickname ?? current.nickname,
    optIn: save.optIn ?? current.optIn,
    displayName: save.displayName ?? currentRecord.displayName ?? null,
    targetScore: save.targetScore ?? currentRecord.targetScore ?? null,
    school: save.school ?? currentRecord.school ?? null,
    classCode: save.classCode ?? currentRecord.classCode ?? null,
  });
}
