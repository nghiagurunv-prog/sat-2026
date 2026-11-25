import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { SKILL_TREE } from '@/lib/skill-taxonomy';
import { loadGates, saveGateResult } from '@/lib/gate-store';
import { isGateEligible, evaluateGateResult, GATE_QUESTIONS } from '@/lib/gate-exam';
import { DOMAIN_PREREQS } from '@/lib/skill-tree';
import { countCorrectAmongIds, gradeAnswer, issueQuestion, type ChoiceAnalysis } from '@/lib/issued-questions';
import { getFromBank } from '@/lib/question-bank';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';
import type { MasterySummary } from '@/lib/mastery';

const VALID_DOMAINS = Object.keys(DOMAIN_PREREQS);

/** Mastery trung bình của 1 chương — DÙNG CHUNG GET/POST để eligibility nhất quán. */
function computeDomainAvg(summary: MasterySummary, domain: string): number {
  const domainSkills = summary.skills.filter((s) => s.domainId === domain);
  return domainSkills.length
    ? Math.round(domainSkills.reduce((sum, s) => sum + s.score, 0) / domainSkills.length)
    : 0;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const rl = rateLimit(getRateLimitKey(request, 'gate-start', user.id), 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bạn mở đề thi cổng hơi nhanh. Vui lòng thử lại sau ít phút.', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  const domain = request.nextUrl.searchParams.get('domain');

  if (!domain || !VALID_DOMAINS.includes(domain)) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
  }

  const [summary, gates] = await Promise.all([
    getMasterySummary(user.id),
    loadGates(user.id),
  ]);

  const domainAvg = computeDomainAvg(summary, domain);

  const gate = gates[domain];
  const eligible = isGateEligible(domainAvg, gate);

  if (!eligible) {
    return NextResponse.json({
      eligible: false,
      gateProgress: gate ?? null,
      domainAvg,
    });
  }

  const domainDef = SKILL_TREE.find((d) => d.id === domain);
  if (!domainDef) {
    return NextResponse.json({ error: 'Domain not found in taxonomy' }, { status: 400 });
  }

  // Local-First (0 internal HTTP loopback, 0 serverless timeout): chọn câu trực tiếp từ
  // Question Bank (Supabase + local JSON fallback) và issue server-side qua issueQuestion.
  const questions = [];
  const skillPool = domainDef.skills;
  const seenStems = new Set<string>();

  for (let i = 0; i < GATE_QUESTIONS; i++) {
    const skill = skillPool[i % skillPool.length];
    const difficulty = i < 2 ? 'Medium' : 'Hard';

    try {
      let picked: Record<string, unknown> | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = (
          (await getFromBank(skill.moduleType, skill.label, difficulty)) ??
          (await getFromBank(skill.moduleType, skill.label)) ??
          (await getFromBank(skill.moduleType))
        ) as Record<string, unknown> | null;
        if (!candidate) break;
        const stemKey = String(candidate.practice_question ?? candidate.stem ?? '').slice(0, 120);
        picked = candidate;
        if (!stemKey || !seenStems.has(stemKey)) {
          if (stemKey) seenStems.add(stemKey);
          break;
        }
      }

      if (picked && typeof picked.correct_choice === 'string' && picked.correct_choice.trim()) {
        const ca = Array.isArray(picked.choice_analysis)
          ? (picked.choice_analysis as ChoiceAnalysis[])
          : undefined;
        const qId = await issueQuestion(
          user.id,
          picked.correct_choice,
          skill.id,
          difficulty,
          {
            src: 'gate',
            choiceAnalysis: ca,
            explanation: typeof picked.explanation === 'string' ? picked.explanation : undefined,
          }
        );
        if (qId) {
          // 🔒 BẢO MẬT (#G7): Xóa toàn bộ đáp án & lời giải trước khi gửi xuống client
          const {
            correct_choice: _c,
            correct_answer: _ca2,
            correctAnswer: _ca3,
            explanation: _e,
            explanation_vi: _evi,
            choice_analysis: _ca,
            ...safeData
          } = picked;
          questions.push({ ...safeData, questionId: qId, skillId: skill.id, difficulty });
        }
      }
    } catch (e) {
      console.error(`Gate exam: failed to prepare question ${i + 1}`, e);
    }
  }

  if (questions.length < GATE_QUESTIONS) {
    return NextResponse.json(
      { error: 'Không thể chuẩn bị đủ câu hỏi cho đề thi cổng. Vui lòng thử lại.' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    eligible: true,
    gateProgress: gate ?? null,
    domainAvg,
    questions,
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const rl = rateLimit(getRateLimitKey(request, 'gate-submit', user.id), 10, 3_600_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Quá nhiều lượt nộp bài thi cổng. Vui lòng thử lại sau.', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { domain, questionIds } = body;

  if (!domain || !VALID_DOMAINS.includes(domain)) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
  }

  // Payload vẫn bắt buộc có đúng số lượng questionIds để client không bỏ qua bài thi,
  // nhưng server KHÔNG tin danh sách đó để tính điểm; điểm lấy từ các câu `src=gate`
  // đã issue/chấm cho đúng domain hiện tại.
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    return NextResponse.json(
      { error: 'Thiếu danh sách câu hỏi đã làm (questionIds).' },
      { status: 400 }
    );
  }
  // Ràng buộc đúng số lượng câu của 1 attempt gate. Server KHÔNG tin questionIds để
  // "lấy điểm từ đó", nhưng CHỈ đếm câu đúng trong đúng bộ ID client nộp (đã được
  // issue/chấm src=gate) → user không thể dùng câu gate CŨ của domain để pass attempt mới.
  if (questionIds.length !== GATE_QUESTIONS || new Set(questionIds.map(String)).size !== GATE_QUESTIONS) {
    return NextResponse.json(
      { error: `Cần nộp đúng ${GATE_QUESTIONS} câu phân biệt của đề thi cổng.` },
      { status: 400 }
    );
  }
  const domainDef = SKILL_TREE.find((d) => d.id === domain);
  if (!domainDef) {
    return NextResponse.json({ error: 'Domain not found in taxonomy' }, { status: 400 });
  }

  // 🔒 SERVER-AUTHORITATIVE: Nếu client gửi kèm mảng `answers`, chỉ chấm các questionId
  // nằm TRONG `questionIds` thông qua `gradeAnswer` (so với `issued_questions` server-side).
  // TUYỆT ĐỐI KHÔNG đọc/tin `correctAns` hoặc `correct_choice` do client gửi.
  const allowedIdSet = new Set(questionIds.map((id: unknown) => String(id)));
  if (Array.isArray(body?.answers) && body.answers.length > 0) {
    for (const ans of body.answers) {
      const qId = typeof ans?.questionId === 'string' ? ans.questionId : '';
      const userAns = ans?.userAns ?? ans?.answer;
      if (qId && allowedIdSet.has(qId) && userAns !== undefined) {
        await gradeAnswer(qId, user.id, String(userAns));
      }
    }
  }

  // Điểm cuối cùng LUÔN đếm từ `issued_questions` đã được chấm đúng + đúng src='gate'
  const correctCount = await countCorrectAmongIds(user.id, questionIds, 'gate');

  // RE-CHECK eligibility server-side
  const [summary, gates] = await Promise.all([
    getMasterySummary(user.id),
    loadGates(user.id),
  ]);
  const domainAvg = computeDomainAvg(summary, domain);
  if (!isGateEligible(domainAvg, gates[domain])) {
    return NextResponse.json(
      { error: 'Chưa đủ điều kiện thi cổng (mastery chưa đạt hoặc đang trong thời gian luyện lại).' },
      { status: 403 }
    );
  }

  const result = evaluateGateResult(correctCount);
  await saveGateResult(user.id, domain, result);

  return NextResponse.json({
    result,
    gateProgress: {
      passed: result.passed,
      lastAttempt: new Date().toISOString(),
      score: result.score,
      correctSinceFail: 0,
    },
  });
}
