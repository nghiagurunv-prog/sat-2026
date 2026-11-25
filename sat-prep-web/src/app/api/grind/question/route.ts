import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary, type Difficulty } from '@/lib/mastery';
import { recommendNext, selectDifficulty } from '@/lib/adaptive';
import { buildStudyQueue, pickNextSkillId } from '@/lib/study-queue';
import { loadMistakes } from '@/lib/mistakes-store';
import { loadVocab } from '@/lib/vocab-store';
import { isDue, todayStr } from '@/lib/leitner';
import { getUserTier } from '@/lib/subscription-store';
import { isValidSkill } from '@/lib/skill-taxonomy';
import { rateLimitDistributed, getRateLimitKey } from '@/lib/rate-limit';
import { POST as generatePracticePost } from '@/app/api/generate-practice/route';

/**
 * GRIND QUESTION API — Khổ Luyện (nhồi 1 skill yếu nhất tới mastered).
 * W2 #09: Tự động nhồi từ vựng yếu Hộp 1 Leitner vào đoạn văn khổ luyện Đọc-Viết/Từ vựng.
 * Gọi trực tiếp handler nội bộ generatePracticePost (không forward cookie ra nextUrl.origin).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  const rl = await rateLimitDistributed(getRateLimitKey(request, 'grind-q', user.id), 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bạn gọi câu khổ luyện hơi nhanh. Chờ chút rồi thử lại nhé.', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  const countParam = request.nextUrl.searchParams.get('count') ?? request.nextUrl.searchParams.get('limit');
  if (countParam !== null) {
    const parsed = parseInt(countParam, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 50) {
      return NextResponse.json(
        { error: 'Số lượng câu hỏi khổ luyện (count/limit) tối đa là 50.' },
        { status: 400 }
      );
    }
  }

  const tier = await getUserTier(user.id);
  if (tier !== 'ultimate') {
    return NextResponse.json({ locked: true }, { status: 403 });
  }

  const summary = await getMasterySummary(user.id);
  const requested = request.nextUrl.searchParams.get('skillId');

  let skillId: string;
  let label: string;
  let moduleType: string;
  let difficulty: Difficulty;
  let box1Words: string[] = [];

  try {
    const vocab = await loadVocab(user.id);
    box1Words = vocab.words
      .filter((w) => (w.box ?? 1) <= 1)
      .map((w) => (typeof w.word === 'string' ? w.word.trim() : ''))
      .filter((word) => word.length > 1)
      .slice(0, 4);
  } catch {
    // fail-safe
  }

  if (requested && isValidSkill(requested)) {
    const s = summary.skills.find((x) => x.id === requested);
    if (!s) {
      return NextResponse.json({ error: 'Không tìm thấy kỹ năng để khổ luyện' }, { status: 404 });
    }
    skillId = s.id;
    label = s.label;
    moduleType = s.moduleType;
    difficulty = selectDifficulty(s.score);
  } else {
    const today = todayStr();
    let dueMistakes: { skill_id?: string | null }[] = [];
    let dueVocabCount = 0;
    try {
      const mistakes = await loadMistakes(user.id);
      dueMistakes = mistakes.filter((m) => isDue(m.next_review, today));
    } catch (e) {
      console.error('Grind: loadMistakes lỗi:', e);
    }
    try {
      const vocab = await loadVocab(user.id);
      dueVocabCount = vocab.words.filter((w) => isDue(w.next_review, today)).length;
    } catch (e) {
      console.error('Grind: loadVocab lỗi:', e);
    }
    const rec = recommendNext(summary);
    const queue = buildStudyQueue(summary, dueMistakes, dueVocabCount, rec);
    const picked = pickNextSkillId(queue);

    if (picked && isValidSkill(picked)) {
      const s = summary.skills.find((x) => x.id === picked);
      if (s) {
        skillId = s.id;
        label = s.label;
        moduleType = s.moduleType;
        difficulty = selectDifficulty(s.score);
      } else if (rec) {
        skillId = rec.skillId;
        label = rec.label;
        moduleType = rec.moduleType;
        difficulty = rec.difficulty;
      } else {
        return NextResponse.json({ error: 'Không tìm thấy kỹ năng để khổ luyện' }, { status: 404 });
      }
    } else if (rec) {
      skillId = rec.skillId;
      label = rec.label;
      moduleType = rec.moduleType;
      difficulty = rec.difficulty;
    } else {
      return NextResponse.json({ error: 'Không tìm thấy kỹ năng để khổ luyện' }, { status: 404 });
    }
  }

  const isRwContext =
    moduleType === 'literature' ||
    moduleType === 'vocab' ||
    moduleType === 'vocabulary' ||
    skillId.startsWith('rw_');
  const injectedBox1Words = isRwContext ? box1Words : [];
  const enrichedTopic =
    injectedBox1Words.length > 0
      ? `${label} — Lồng ghép tự nhiên từ vựng Leitner Hộp 1 cần ôn: ${injectedBox1Words.join(', ')}`
      : label;

  try {
    const internalReq = new Request('http://internal.satguru.local/api/generate-practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleType,
        topic: enrichedTopic,
        skillId,
        difficulty,
      }),
    });
    const res = await generatePracticePost(internalReq);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data?.error ?? 'Không sinh được câu khổ luyện.' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      ...data,
      difficulty,
      skillId,
      ...(injectedBox1Words.length > 0 ? { injectedBox1Words } : {}),
    });
  } catch (e) {
    console.error('Grind question: lỗi sinh câu hỏi', e);
    return NextResponse.json({ error: 'Lỗi sinh câu khổ luyện.' }, { status: 503 });
  }
}
