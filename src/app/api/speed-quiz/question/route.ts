import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { pickSpeedQuizSkill } from '@/lib/adaptive';
import { tagQuestion } from '@/lib/speed-quiz-store';
import { gradeAnswer, getGradedResult } from '@/lib/issued-questions';
import { rateLimitDistributed, getRateLimitKey } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { POST as generatePracticePost } from '@/app/api/generate-practice/route';

/**
 * SPEED QUIZ QUESTION API — "Trả lời nhanh" adaptive + Anti-Cheat Telemetry (W2 #16).
 *
 * GET ?answered=N → chọn skill + độ khó theo MASTERY thật, gọi trực tiếp generatePracticePost.
 * POST            → chấm server-authoritative + gắn anomalyFlag khi câu Hard < 2000ms
 *                   hoặc chuyển tab >= 2 lần để lọc BXH công khai.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  const answeredParam = request.nextUrl.searchParams.get('answered');
  const answered = Number(answeredParam ?? '0');
  if (!Number.isInteger(answered) || answered < 0) {
    return NextResponse.json({ error: 'answered phải là số nguyên >= 0' }, { status: 400 });
  }
  const sessionId = request.nextUrl.searchParams.get('session');

  const summary = await getMasterySummary(user.id);
  const pick = pickSpeedQuizSkill(summary.skills, answered);
  if (!pick) {
    return NextResponse.json({ error: 'Không tìm thấy kỹ năng để sinh câu hỏi' }, { status: 404 });
  }

  try {
    const internalReq = new Request('http://internal.satguru.local/api/generate-practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleType: pick.moduleType,
        topic: pick.label,
        skillId: pick.skillId,
        difficulty: pick.difficulty,
      }),
    });
    const res = await generatePracticePost(internalReq);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data?.error ?? 'Không sinh được câu hỏi cho lượt trả lời nhanh.' },
        { status: res.status }
      );
    }

    const data = await res.json();
    if (sessionId && typeof data?.questionId === 'string') {
      await tagQuestion(sessionId, user.id, data.questionId);
    }

    return NextResponse.json({ ...data, difficulty: pick.difficulty, skillId: pick.skillId });
  } catch (e) {
    console.error('Speed Quiz question: lỗi sinh câu hỏi', e);
    return NextResponse.json({ error: 'Lỗi sinh câu hỏi cho lượt trả lời nhanh.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const rl = await rateLimitDistributed(getRateLimitKey(request, 'speed-quiz-grade', user.id), 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bạn gửi đáp án quá nhanh. Vui lòng thử lại sau.', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { userAnswer, questionId, timeSpentMs, tabSwitches, difficulty } = body ?? {};

  if (typeof questionId !== 'string' || !questionId.trim() || userAnswer === undefined) {
    return NextResponse.json({ error: 'questionId và userAnswer là bắt buộc' }, { status: 400 });
  }

  // W2 #16: Phát hiện đoán mò siêu tốc (< 2s ở câu Hard) hoặc chuyển tab bất thường (>= 2 lần)
  const parsedTimeMs =
    typeof timeSpentMs === 'number' && Number.isFinite(timeSpentMs)
      ? Math.max(0, Math.round(timeSpentMs))
      : null;
  const parsedTabs =
    typeof tabSwitches === 'number' && Number.isFinite(tabSwitches)
      ? Math.max(0, Math.round(tabSwitches))
      : 0;
  const isHard = String(difficulty ?? '').toLowerCase() === 'hard';
  const fastHardCheat = isHard && parsedTimeMs !== null && parsedTimeMs > 0 && parsedTimeMs < 2000;
  const tabCheat = parsedTabs >= 2;
  const anomalyFlag = fastHardCheat || tabCheat;

  const graded = await gradeAnswer(questionId.trim(), user.id, String(userAnswer));
  if (graded) {
    if (anomalyFlag && user.isAuthenticated) {
      try {
        const admin = createAdminClient();
        await admin.from('speed_quiz_anomalies').insert({
          user_id: user.id,
          question_id: questionId.trim(),
          difficulty: String(difficulty ?? 'Unknown'),
          time_spent_ms: parsedTimeMs ?? 0,
          tab_switches: parsedTabs,
          reason: fastHardCheat ? 'hard_under_2s' : 'excessive_tab_switches',
        });
      } catch {
        // fail-safe nếu bảng chưa migrate
      }
    }
    return NextResponse.json({
      isCorrect: graded.correct,
      correct: graded.correct,
      correctChoice: graded.correctChoice,
      questionId: questionId.trim(),
      anomalyFlag,
      ...(parsedTimeMs !== null ? { timeSpentMs: parsedTimeMs } : {}),
    });
  }

  const existing = await getGradedResult(questionId.trim(), user.id);
  if (existing) {
    return NextResponse.json({
      isCorrect: existing.correct,
      correct: existing.correct,
      correctChoice: existing.correctChoice ?? null,
      questionId: questionId.trim(),
      alreadyGraded: true,
      anomalyFlag,
    });
  }

  return NextResponse.json({ error: 'Câu hỏi không hợp lệ hoặc không thuộc phiên của bạn.' }, { status: 404 });
}
