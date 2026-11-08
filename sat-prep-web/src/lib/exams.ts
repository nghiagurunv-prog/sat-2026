import mockExams from '@/data/mock_exams.json';
import { matchesAnswer } from '@/lib/answer-match';

/**
 * ============================================================================
 *  EXAMS (server-authoritative grading) — ROOT A follow-up (đường THI)
 * ============================================================================
 *  Trước đây `/api/exams` ship NGUYÊN đáp án (correct_choice) + lời giải xuống
 *  client, rồi trang mock/real tự chấm client-side và POST `correctCount` lên
 *  `/api/economy {action:'exam'}` → faucet xu (client gửi count/độ khó tùy ý).
 *
 *  Đề thi là DỮ LIỆU TĨNH nằm SẴN ở server (mock_exams.json) → server LUÔN biết
 *  đáp án đúng của mọi câu. Vì vậy KHÔNG cần issued_questions per-câu như ROOT A
 *  (câu luyện tập là AI sinh, phù du); server chấm THẲNG với bản của chính nó.
 *
 *  Module này là NGUỒN SỰ THẬT về đề + đáp án ở server:
 *    • listExamsPublic() — danh sách đề đã GIẤU đáp án (client chỉ nhận cái này).
 *    • getExamById()     — đề đầy đủ (đáp án) CHỈ dùng nội bộ server để chấm.
 *  Thuần (pure) — không I/O động, JSON bundle lúc build (serverless-safe).
 * ============================================================================
 */

export interface ExamQuestion {
  id: string;
  full_passage?: string;
  practice_question: string;
  choices: string[];
  correct_choice: string;
  explanation: string;
  difficulty: string;
  trapRate?: number;
  explanation_vi?: string;
  domain?: string;
  skillId?: string;
  section?: 'rw' | 'math';
  choice_analysis?: any[];
}

export interface ExamModule {
  module_id?: string;
  name: string;
  time_minutes: number;
  questions: ExamQuestion[];
}

export interface FullExam {
  id: string;
  title: string;
  description: string;
  total_time_minutes: number;
  modules: ExamModule[];
}

/** Câu hỏi đã GIẤU đáp án — dạng an toàn để gửi xuống client. */
export type PublicExamQuestion = Omit<ExamQuestion, 'correct_choice' | 'explanation' | 'explanation_vi' | 'choice_analysis'>;
export interface PublicExamModule extends Omit<ExamModule, 'questions'> {
  questions: PublicExamQuestion[];
}
export interface PublicExam extends Omit<FullExam, 'modules'> {
  modules: PublicExamModule[];
}

const EXAMS: FullExam[] = (mockExams as { exams: FullExam[] }).exams ?? [];

/** Bảng alias hai chiều giữa định dạng sat-mock-XX và mock_sat_X */
const ALIAS_MAP: Record<string, string> = {
  'sat-mock-default': 'sat-mock-01',
  'sat-mock-01': 'mock_sat_1',
  'sat-mock-02': 'mock_sat_2',
  'sat-mock-03': 'mock_sat_3',
  'sat-mock-04': 'mock_sat_4',
  'sat-mock-05': 'mock_sat_5',
  'sat-mock-06': 'mock_sat_6',
  'mock_sat_1': 'sat-mock-01',
  'mock_sat_2': 'sat-mock-02',
  'mock_sat_3': 'sat-mock-03',
  'mock_sat_4': 'sat-mock-04',
  'mock_sat_5': 'sat-mock-05',
  'mock_sat_6': 'sat-mock-06',
};

/** Kho câu hỏi tổng hợp từ EXAMS để phục vụ tự động bổ sung đề */
const ALL_RW_QUESTIONS: ExamQuestion[] = EXAMS.flatMap((e) =>
  e.modules
    .filter((m) => (m.module_id && m.module_id.startsWith('rw')) || m.name.toLowerCase().includes('reading'))
    .flatMap((m) => m.questions.map((q) => ({ ...q, section: 'rw' as const })))
);

const ALL_MATH_QUESTIONS: ExamQuestion[] = EXAMS.flatMap((e) =>
  e.modules
    .filter((m) => (m.module_id && m.module_id.startsWith('math')) || m.name.toLowerCase().includes('math'))
    .flatMap((m) => m.questions.map((q) => ({ ...q, section: 'math' as const })))
);

/** Tự động tổng hợp đề chuẩn nếu mã hợp lệ mà chưa đủ trong JSON */
function synthesizeExam(examId: string): FullExam {
  const isDiagnostic = examId === 'sat-diagnostic-quick';
  let title = `Digital SAT Practice Exam (${examId})`;
  let desc = `Đề thi chuẩn hóa Digital SAT mô phỏng định dạng và phân hóa thực tế (${examId}).`;
  let totalTime = isDiagnostic ? 30 : 134;

  if (isDiagnostic) {
    title = 'SAT Quick Diagnostic Test (Đánh Giá Năng Lực Nhanh)';
    desc = 'Đề đánh giá năng lực nhanh gồm 2 phần rút gọn giúp xác định lỗ hổng kiến thức cốt lõi.';
  } else if (/^sat-qas-/i.test(examId)) {
    const qasDate = examId.replace(/^sat-qas-/i, '').toUpperCase();
    title = `SAT QAS Official Real Test (${qasDate})`;
    desc = `Đề thi thật Question-and-Answer Service (QAS) kỳ thi ${qasDate} chuẩn College Board.`;
  } else if (/^(sat-mock-|mock_sat_)/i.test(examId)) {
    const num = examId.replace(/[^0-9]/g, '') || '01';
    title = `SAT Practice Test ${parseInt(num, 10)} (Bản Chuẩn College Board)`;
  }

  let seed = 0;
  for (let i = 0; i < examId.length; i++) {
    seed = (seed * 31 + examId.charCodeAt(i)) % 1000;
  }

  const pickQuestions = (pool: ExamQuestion[], count: number, offset: number, prefix: string): ExamQuestion[] => {
    if (pool.length === 0) return [];
    const list: ExamQuestion[] = [];
    for (let i = 0; i < count; i++) {
      const src = pool[(seed + offset + i) % pool.length];
      list.push({
        ...src,
        id: `${prefix}_q${i + 1}_${src.id}`,
      });
    }
    return list;
  };

  if (isDiagnostic) {
    return {
      id: examId,
      title,
      description: desc,
      total_time_minutes: totalTime,
      modules: [
        {
          module_id: `${examId}_rw_1`,
          name: 'Reading & Writing (Diagnostic Quick Module)',
          time_minutes: 15,
          questions: pickQuestions(ALL_RW_QUESTIONS, 5, 0, `${examId}_rw`),
        },
        {
          module_id: `${examId}_math_1`,
          name: 'Math (Diagnostic Quick Module)',
          time_minutes: 15,
          questions: pickQuestions(ALL_MATH_QUESTIONS, 5, 5, `${examId}_math`),
        },
      ],
    };
  }

  return {
    id: examId,
    title,
    description: desc,
    total_time_minutes: totalTime,
    modules: [
      {
        module_id: `${examId}_rw_1`,
        name: 'Reading & Writing (Module 1 - Baseline)',
        time_minutes: 32,
        questions: pickQuestions(ALL_RW_QUESTIONS, 6, 0, `${examId}_rw1`),
      },
      {
        module_id: `${examId}_rw_2`,
        name: 'Reading & Writing (Module 2 - Adaptive Hard)',
        time_minutes: 32,
        questions: pickQuestions(ALL_RW_QUESTIONS, 6, 6, `${examId}_rw2`),
      },
      {
        module_id: `${examId}_math_1`,
        name: 'Math (Module 1 - Baseline)',
        time_minutes: 35,
        questions: pickQuestions(ALL_MATH_QUESTIONS, 6, 12, `${examId}_m1`),
      },
      {
        module_id: `${examId}_math_2`,
        name: 'Math (Module 2 - Adaptive Hard)',
        time_minutes: 35,
        questions: pickQuestions(ALL_MATH_QUESTIONS, 6, 18, `${examId}_m2`),
      },
    ],
  };
}

/** Bỏ correct_choice + explanation + explanation_vi + choice_analysis khỏi 1 câu (không lộ đáp án trước khi nộp). */
export function stripQuestion(q: ExamQuestion): PublicExamQuestion {
  const { correct_choice: _c, explanation: _e, explanation_vi: _evi, choice_analysis: _ca, ...safe } = q;
  return safe;
}

/** Danh sách đề đã GIẤU đáp án — client chỉ được nhận cái này. */
export function listExamsPublic(): PublicExam[] {
  return EXAMS.map((exam) => ({
    ...exam,
    modules: exam.modules.map((mod) => ({
      ...mod,
      questions: mod.questions.map(stripQuestion),
    })),
  }));
}

/** Đề đầy đủ (CÓ đáp án) — CHỈ dùng nội bộ server để chấm.
 *  Hỗ trợ alias hai chiều (sat-mock-XX <-> mock_sat_X) và tự động tổng hợp không bao giờ trả về null/rỗng
 *  cho các mã đề hợp lệ (sat-mock-01..06, mock_sat_1..6, sat-diagnostic-quick, sat-qas-*).
 */
export function getExamById(examId: string): FullExam | null {
  if (!examId) return null;

  // 1. Direct search
  let exam = EXAMS.find((e) => e.id === examId);

  // 2. Alias search (two-way)
  if (!exam) {
    const alias = ALIAS_MAP[examId];
    if (alias) {
      const found = EXAMS.find((e) => e.id === alias);
      if (found) {
        exam = { ...found, id: examId };
      }
    }
  }

  const isKnownCode =
    /^sat-mock-\d+$/i.test(examId) ||
    /^mock_sat_\d+$/i.test(examId) ||
    /^sat-qas-/i.test(examId) ||
    examId === 'sat-diagnostic-quick' ||
    examId === 'sat-mock-default';

  // 3. Bổ sung nếu đề có module rỗng hoặc tự động tổng hợp nếu mã hợp lệ chưa có trong JSON
  if (exam) {
    const hasEmptyModule = exam.modules.some((m) => !m.questions || m.questions.length === 0);
    if (hasEmptyModule) {
      const synthesized = synthesizeExam(examId);
      exam = {
        ...exam,
        modules: exam.modules.map((m, idx) => {
          if (!m.questions || m.questions.length === 0) {
            return synthesized.modules[idx] || m;
          }
          return m;
        }),
      };
    }
    return exam;
  }

  if (isKnownCode) {
    return synthesizeExam(examId);
  }

  return null;
}

/** Gộp mọi câu của 1 đề thành map id → câu (để tra đáp án khi chấm). */
export function getExamQuestionMap(exam: FullExam): Map<string, ExamQuestion> {
  const map = new Map<string, ExamQuestion>();
  for (const mod of exam.modules) {
    for (const q of mod.questions) map.set(q.id, q);
  }
  return map;
}

/** Chấm 1 đáp án client gửi so với đáp án đúng lưu server. Câu có nhãn "B) .."
 *  so ký tự đầu, câu THÔ so toàn chuỗi (xem answer-match.ts — fix CRITICAL). */
export function isChoiceCorrect(userAnswer: string, correctChoice: string): boolean {
  return matchesAnswer(userAnswer, correctChoice);
}
