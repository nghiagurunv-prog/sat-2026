/**
 * Batch Question Generator for Full-Length Digital SAT Exams.
 *
 * Sinh song song câu hỏi cho từng module bằng internal fetch tới /api/generate-practice.
 * Pattern giống gate-exam/route.ts nhưng scale lên 22–27 câu/module.
 */

import { SKILL_TREE, type Skill } from './skill-taxonomy';
import type { AdaptivePath } from './exam-scoring';
import { getExamById } from './exams';
import questionBankJson from '../../data/question_bank.json';

export interface ExamQuestion {
  id: string;
  full_passage?: string;
  practice_question: string;
  choices: string[];
  correct_choice: string;
  explanation?: string;
  explanation_vi?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  skillId?: string;
}

export interface GeneratedModule {
  name: string;
  timeMinutes: number;
  questions: ExamQuestion[];
  section: 'rw' | 'math';
  moduleNum: 1 | 2;
}

type Difficulty = 'Easy' | 'Medium' | 'Hard';

const LOCAL_ANSWER_CACHE = new Map<string, ExamQuestion>();

function normalizeDifficulty(d?: string): Difficulty {
  if (d === 'Easy' || d === 'Medium' || d === 'Hard') return d;
  return 'Medium';
}

function getLocalBankPool(section: 'rw' | 'math'): ExamQuestion[] {
  const rawList = Array.isArray((questionBankJson as { questions?: unknown[] })?.questions)
    ? ((questionBankJson as { questions: Array<{ id?: string; moduleType?: string; data?: Record<string, unknown> }> }).questions)
    : [];
  return rawList
    .filter((item) => {
      if (section === 'rw') return item.moduleType === 'literature' || item.moduleType === 'vocab';
      return item.moduleType === 'math' || item.moduleType === 'desmos';
    })
    .map((item, idx) => {
      const d = item.data ?? {};
      const q: ExamQuestion = {
        id: item.id || `bank_${section}_${idx}`,
        full_passage: String(d.full_passage || d.theory || ''),
        practice_question: String(d.practice_question || ''),
        choices: Array.isArray(d.choices) ? (d.choices as string[]) : ['A', 'B', 'C', 'D'],
        correct_choice: String(d.correct_choice || 'A'),
        explanation: String(d.explanation_vi || d.explanation || ''),
        explanation_vi: String(d.explanation_vi || d.explanation || ''),
        difficulty: normalizeDifficulty(typeof d.difficulty === 'string' ? d.difficulty : 'Medium'),
        skillId: typeof d.skillId === 'string' ? d.skillId : (section === 'rw' ? 'rw_info_central_ideas' : 'math_algebra_linear_eq_1var'),
      };
      LOCAL_ANSWER_CACHE.set(q.id, q);
      return q;
    })
    .filter((q) => q.practice_question.length > 0 && q.choices.length >= 4);
}

export function getLocalExamAnswer(questionId: string, examId?: string): ExamQuestion | null {
  if (!questionId) return null;
  const cached = LOCAL_ANSWER_CACHE.get(questionId);
  if (cached) return cached;

  const targetExam = getExamById(examId || 'sat-mock-01') ?? getExamById('mock_sat_1');
  if (targetExam) {
    for (const mod of targetExam.modules) {
      for (const q of mod.questions) {
        if (q.id === questionId) {
          return {
            id: q.id,
            full_passage: q.full_passage,
            practice_question: q.practice_question,
            choices: q.choices,
            correct_choice: q.correct_choice,
            explanation: q.explanation_vi || q.explanation,
            explanation_vi: q.explanation_vi || q.explanation,
            difficulty: normalizeDifficulty(q.difficulty),
            skillId: q.skillId,
          };
        }
      }
    }
  }

  const rwPool = getLocalBankPool('rw');
  const mathPool = getLocalBankPool('math');
  for (const q of [...rwPool, ...mathPool]) {
    if (q.id === questionId) return q;
  }
  return null;
}

/**
 * Difficulty distribution chuẩn Digital SAT.
 * Module 1: mix cân bằng để đo năng lực.
 * Module 2 Hard: thiên khó (trần 800).
 * Module 2 Easy: thiên dễ (trần 650).
 */
const DIFFICULTY_MIX: Record<string, Record<Difficulty, number>> = {
  rw_m1:      { Easy: 8,  Medium: 11, Hard: 8 },
  rw_m2_hard: { Easy: 3,  Medium: 9,  Hard: 15 },
  rw_m2_easy: { Easy: 12, Medium: 11, Hard: 4 },
  math_m1:      { Easy: 6,  Medium: 9,  Hard: 7 },
  math_m2_hard: { Easy: 2,  Medium: 7,  Hard: 13 },
  math_m2_easy: { Easy: 10, Medium: 8,  Hard: 4 },
};

function getDifficultyList(section: 'rw' | 'math', moduleNum: 1 | 2, path?: AdaptivePath): Difficulty[] {
  let key: string;
  if (moduleNum === 1) {
    key = `${section}_m1`;
  } else {
    key = `${section}_m2_${path ?? 'hard'}`;
  }
  const mix = DIFFICULTY_MIX[key];
  const list: Difficulty[] = [];
  for (const [diff, count] of Object.entries(mix)) {
    for (let i = 0; i < count; i++) list.push(diff as Difficulty);
  }
  // Xáo trộn để không theo thứ tự dễ→khó cố định
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function getSkillsForSection(section: 'rw' | 'math'): Skill[] {
  const subject = section === 'rw' ? 'reading' : 'math';
  return SKILL_TREE
    .filter(d => d.subject === subject)
    .flatMap(d => d.skills);
}

/**
 * Sinh 1 module đầy đủ câu hỏi (song song).
 * @param origin - URL origin của server (e.g. http://localhost:3000)
 * @param cookie - cookie header để pass auth
 */
export async function generateModule(
  section: 'rw' | 'math',
  moduleNum: 1 | 2,
  origin: string,
  cookie: string,
  adaptivePath?: AdaptivePath,
  examId?: string,
  _userId?: string
): Promise<GeneratedModule> {
  const isDiagnostic = examId === 'sat-diagnostic-quick';
  const totalQuestions = isDiagnostic ? 8 : section === 'rw' ? 27 : 22;
  const timeMinutes = isDiagnostic ? 15 : section === 'rw' ? 32 : 35;
  const moduleName = section === 'rw'
    ? `Reading & Writing (Module ${moduleNum})`
    : `Math (Module ${moduleNum})`;

  const difficulties = getDifficultyList(section, moduleNum, adaptivePath);
  const skills = getSkillsForSection(section);

  // 1. Local-First: Lấy câu hỏi từ đề chuẩn (getExamById) + kho local (question_bank.json)
  const localQuestions: ExamQuestion[] = [];
  const targetExam = getExamById(examId || 'sat-mock-01') ?? getExamById('mock_sat_1');
  if (targetExam) {
    const matchingMod = targetExam.modules.find((m) => {
      const mId = (m.module_id || '').toLowerCase();
      const mName = (m.name || '').toLowerCase();
      const isSection = section === 'rw'
        ? (mId.includes('rw') || mName.includes('reading'))
        : (mId.includes('m') || mName.includes('math'));
      const isModNum = mId.endsWith(`_${moduleNum}`) || mName.includes(`module ${moduleNum}`) || (isDiagnostic && moduleNum === 1);
      return isSection && isModNum;
    }) ?? targetExam.modules.find((m) => {
      const mId = (m.module_id || '').toLowerCase();
      const mName = (m.name || '').toLowerCase();
      return section === 'rw'
        ? (mId.includes('rw') || mName.includes('reading'))
        : (mId.includes('m') || mName.includes('math'));
    });

    if (matchingMod && Array.isArray(matchingMod.questions)) {
      for (let i = 0; i < matchingMod.questions.length; i++) {
        const q = matchingMod.questions[i];
        const skill = skills[i % skills.length];
        const mapped: ExamQuestion = {
          id: q.id || `${examId || 'mock'}_${section}_m${moduleNum}_q${i + 1}`,
          full_passage: q.full_passage || '',
          practice_question: q.practice_question,
          choices: q.choices,
          correct_choice: q.correct_choice,
          explanation: q.explanation_vi || q.explanation || '',
          explanation_vi: q.explanation_vi || q.explanation || '',
          difficulty: normalizeDifficulty(q.difficulty || difficulties[i]),
          skillId: q.skillId || skill?.id,
        };
        LOCAL_ANSWER_CACHE.set(mapped.id, mapped);
        localQuestions.push(mapped);
      }
    }
  }

  // Bổ sung thêm câu hỏi từ kho local bank nếu đề gốc có ít câu hơn chuẩn (full 27 RW / 22 Math)
  // và ưu tiên phân tách độ khó theo adaptivePath (hard → ưu tiên Hard/Medium; easy → Easy/Medium).
  const rawBankPool = getLocalBankPool(section);
  const usedStems = new Set(localQuestions.map((q) => q.practice_question.trim().toLowerCase().slice(0, 100)));
  const rankDiff = (d: Difficulty): number => {
    if (moduleNum === 2 && adaptivePath === 'hard') {
      return d === 'Hard' ? 0 : d === 'Medium' ? 1 : 2;
    }
    if (moduleNum === 2 && adaptivePath === 'easy') {
      return d === 'Easy' ? 0 : d === 'Medium' ? 1 : 2;
    }
    return d === 'Medium' ? 0 : d === 'Hard' ? 1 : 2;
  };
  const bankPool = [...rawBankPool].sort((a, b) => rankDiff(a.difficulty) - rankDiff(b.difficulty));
  const freshPool = bankPool.filter((q) => !usedStems.has(q.practice_question.trim().toLowerCase().slice(0, 100)));
  const sourcePool = freshPool.length > 0 ? freshPool : bankPool;

  if (localQuestions.length < totalQuestions && sourcePool.length > 0) {
    const baseLen = localQuestions.length;
    const needed = totalQuestions - baseLen;
    const offset = moduleNum === 2 ? (adaptivePath === 'hard' ? 3 : 7) : 0;
    for (let i = 0; i < needed; i++) {
      const src = sourcePool[(i + offset) % sourcePool.length];
      const skill = skills[(baseLen + i) % skills.length];
      const cloned: ExamQuestion = {
        ...src,
        id: `${examId || 'sat'}_${section}_m${moduleNum}_${adaptivePath ?? 'base'}_b${i + 1}_${src.id}`,
        difficulty: difficulties[(baseLen + i) % difficulties.length] || src.difficulty,
        skillId: src.skillId || skill?.id,
      };
      LOCAL_ANSWER_CACHE.set(cloned.id, cloned);
      localQuestions.push(cloned);
    }
  }

  if (localQuestions.length > 0) {
    return {
      name: moduleName,
      timeMinutes,
      questions: localQuestions,
      section,
      moduleNum,
    };
  }

  // 2. Fallback gọi internal /api/generate-practice nếu kho local hoàn toàn rỗng
  const promises = difficulties.slice(0, totalQuestions).map((difficulty, idx) => {
    const skill = skills[idx % skills.length];
    return generateOneQuestion(origin, cookie, skill, difficulty, idx);
  });

  const results = await Promise.allSettled(promises);
  const questions: ExamQuestion[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      LOCAL_ANSWER_CACHE.set(result.value.id, result.value);
      questions.push(result.value);
    }
  }

  return {
    name: moduleName,
    timeMinutes,
    questions,
    section,
    moduleNum,
  };
}

async function generateOneQuestion(
  origin: string,
  cookie: string,
  skill: Skill,
  difficulty: Difficulty,
  index: number
): Promise<ExamQuestion | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(`${origin}/api/generate-practice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({
        moduleType: skill.moduleType,
        topic: skill.label,
        skillId: skill.id,
        difficulty,
        prefer: 'auto',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    return {
      id: `exam_q_${index}_${Date.now().toString(36)}`,
      full_passage: data.full_passage || data.theory || '',
      practice_question: data.practice_question,
      choices: data.choices,
      correct_choice: data.correct_choice,
      explanation: data.explanation,
      difficulty,
      skillId: skill.id,
    };
  } catch {
    return null;
  }
}
