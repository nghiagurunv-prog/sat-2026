import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { gradeAnswer } from '@/lib/issued-questions';
import { getExamById, getExamQuestionMap, isChoiceCorrect } from '@/lib/exams';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';
import { loadEconomy, saveEconomy, ensureEconomyRow, tryIncrementEconomyAtomic } from '@/lib/economy-store';
import { applyExamRewardFromDifficulties, MAX_EXAM_QUESTIONS, type Difficulty, type EconomyState } from '@/lib/economy';
import { getUserTier } from '@/lib/subscription-store';
import { TIER_COIN_MULTIPLIER } from '@/lib/subscription';
import { bumpDailyActivity } from '@/lib/daily-activity-store';
import { computeSectionScore } from '@/lib/exam-scoring';

/**
 * NỘP BÀI THI (ROOT A follow-up đường thi) — server chấm + thưởng.
 *
 * Client gửi mảng {questionId, answer}[] (KHÔNG gửi correctCount/số xu). Với mỗi
 * câu, server gradeAnswer (compare-and-swap answered:false→true) → chấm đúng/sai
 * TỪ đáp án đã lưu lúc /api/exams/start, và mỗi câu chỉ tính điểm ĐÚNG 1 LẦN
 * (replay/nộp lại → câu đã answered → bỏ qua, không cộng thêm). Phần thưởng =
 * tổng đơn giá theo ĐỘ KHÓ THẬT của từng câu ĐÚNG (từ đề, lưu server).
 *
 * → Đóng faucet cũ: client không còn tự khai số câu đúng hay độ khó.
 */

const VALID_DIFFICULTY: Difficulty[] = ['Easy', 'Medium', 'Hard'];

interface SubmittedAnswer {
  questionId: string;
  answer: string;
  userAns?: string;
  correctAns?: string;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    const rl = rateLimit(getRateLimitKey(req, 'exam-grade', user.id), 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Quá nhiều request. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }

    const body = await req.json();
    const rawAnswers = Array.isArray(body?.answers) ? body.answers : [];
    const examId = typeof body?.examId === 'string' ? body.examId.trim() : '';

    // Lọc + kẹp về trần (chống mảng phi lý). total = số câu client khai đã trả lời.
    const answers: SubmittedAnswer[] = rawAnswers
      .filter(
        (a: unknown): a is SubmittedAnswer =>
          !!a &&
          typeof (a as SubmittedAnswer).questionId === 'string' &&
          typeof (a as SubmittedAnswer).answer === 'string'
      )
      .slice(0, MAX_EXAM_QUESTIONS);

    // Chấm từng câu server-side (CAS). Kết quả correct/độ khó lấy TỪ SERVER, không
    // tin client. Câu đã answered (nộp lại) → gradeAnswer trả null → không tính.
    const correctDifficulties: Difficulty[] = [];
    const submittedAnswerMap: Record<string, string> = {};
    const correctAnswerMap: Record<string, string> = {};
    const difficultyMap: Record<string, string> = {};
    const results: Array<{ questionId: string; correct: boolean; correctChoice: string; explanation?: string | null }> = [];
    let correct = 0;
    let graded = 0;

    // Fallback server-authoritative CHỈ dành cho khách vãng lai (Guest Trial — 0 thưởng xu/XP)
    // khi chưa có dòng issued_questions trên DB (non-UUID guest).
    const guestQuestionMap =
      !user.isAuthenticated && examId
        ? (() => {
            const exam = getExamById(examId);
            return exam ? getExamQuestionMap(exam) : null;
          })()
        : null;

    // Tuần tự để tránh dồn nhiều update đồng thời lên cùng user (đề ~vài chục câu).
    for (const item of answers) {
      const { questionId, answer } = item;
      const userAns = item.userAns ?? answer;
      const result = await gradeAnswer(questionId, user.id, userAns);
      if (result) {
        graded++;
        // CHỈ tin tưởng kết quả chấm server-authoritative từ gradeAnswer (cấm nhận item.correctAns từ client)
        const isCorrect = result.correct;
        const d: Difficulty = VALID_DIFFICULTY.includes(result.difficulty as Difficulty)
          ? (result.difficulty as Difficulty)
          : 'Medium';
        submittedAnswerMap[questionId] = userAns;
        correctAnswerMap[questionId] = result.correctChoice;
        difficultyMap[questionId] = d;
        results.push({
          questionId,
          correct: isCorrect,
          correctChoice: result.correctChoice,
          explanation: result.explanation,
        });
        if (isCorrect) {
          correct++;
          correctDifficulties.push(d);
        }
        continue;
      }

      if (guestQuestionMap) {
        const q = guestQuestionMap.get(questionId);
        if (q) {
          graded++;
          const isCorrect = isChoiceCorrect(userAns, q.correct_choice);
          const d: Difficulty = VALID_DIFFICULTY.includes(q.difficulty as Difficulty)
            ? (q.difficulty as Difficulty)
            : 'Medium';
          submittedAnswerMap[questionId] = userAns;
          correctAnswerMap[questionId] = q.correct_choice;
          difficultyMap[questionId] = d;
          results.push({
            questionId,
            correct: isCorrect,
            correctChoice: q.correct_choice,
            explanation: q.explanation_vi || q.explanation || null,
          });
          if (isCorrect) {
            correct++;
          }
        }
      }
    }

    // Thưởng 1 lần cho cả bài (từ độ khó các câu ĐÚNG server chấm). Hệ số gói nhân xu.
    const [economy, tier] = await Promise.all([loadEconomy(user.id), getUserTier(user.id)]);
    const { state: nextEconomy, granted } = applyExamRewardFromDifficulties(economy, correctDifficulties, TIER_COIN_MULTIPLIER[tier]);

    // Cộng thưởng ATOMIC (đóng lost-update ROOT C: 2 nộp ĐỒNG THỜI cùng đọc coins
    // cũ → saveEconomy last-write-wins → under-grant). increment_economy khóa dòng +
    // cộng delta. FALLBACK về saveEconomy khi atomic null (pre-migration) HOẶC
    // ok=false: CAS (gradeAnswer) đã chạy TRƯỚC → delta tiêu once, fail-closed sẽ
    // MẤT xu khi retry (correctDifficulties rỗng) → giữ grant qua saveEconomy. Xấu
    // nhất under-grant (đúng bug đang sửa), KHÔNG faucet (CAS chặn double-grant).
    let economyOut: EconomyState = nextEconomy;
    if (granted.coins > 0 || granted.xp > 0) {
      await ensureEconomyRow(user.id);
      const atomic = await tryIncrementEconomyAtomic(user.id, granted.coins, granted.xp);
      if (atomic?.ok) {
        economyOut = { ...economy, coins: atomic.coins, xp: atomic.xp };
      } else {
        await saveEconomy(user.id, nextEconomy);
        economyOut = nextEconomy;
      }
    }

    // Đường nộp CẢ BÀI 1 lần → đếm 1 "bài thi hoàn thành" hôm nay (quest
    // 'exam-completed'). Chỉ đếm khi thực sự có câu được chấm (graded>0) → nộp
    // rỗng/replay toàn bộ (graded=0) KHÔNG tính. Fire-and-forget (nuốt lỗi).
    if (graded > 0) {
      await bumpDailyActivity(user.id, 'exam_complete'); // await: tránh drop RPC khi serverless freeze
    }

    // Chấm điểm quy đổi IRT 2PL EAP server-authoritative (thang điểm đầy đủ 200-800, không tin body.adaptivePath từ client)
    const irtScore = computeSectionScore(
      [{ answers: submittedAnswerMap, correctAnswers: correctAnswerMap, difficulties: difficultyMap }],
      'hard'
    );

    return NextResponse.json({
      correct,
      graded,
      scaledScore: irtScore.scaled,
      theta: irtScore.theta,
      se: irtScore.se,
      scoringMethod: irtScore.scoringMethod,
      results,
      granted,
      economy: economyOut,
    });
  } catch (error) {
    console.error('Exam grade error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
