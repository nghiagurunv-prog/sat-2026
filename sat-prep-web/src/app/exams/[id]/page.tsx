'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock,
  Flag,
  Calculator,
  FileText,
  Maximize,
  Minimize,
  Columns,
  ChevronLeft,
  ChevronRight,
  Grid,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Strikethrough,
  Highlighter,
  RotateCcw,
  Sparkles,
  BarChart3,
  Timer,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import DesmosCalculator from '@/components/DesmosCalculator';
import FormulaSheetModal from '@/components/FormulaSheetModal';
import mockExamsData from '@/data/mock_exams.json';
import diagnosticQuestionsData from '@/data/diagnostic_questions.json';

// ============================================================================
// TYPES & DATA STRUCTURES
// ============================================================================

export type SplitRatio = '40/60' | '50/50' | '60/40';
export type NavFilter = 'all' | 'unanswered' | 'flagged';

export interface ExamQuestion {
  id: string;
  order: number;
  section: 'rw' | 'math';
  domain: string;
  passage?: string;
  question: string;
  choices: string[];
  correctIndex?: number;
  explanation_vi?: string;
}

export interface QuestionPaceRecord {
  questionId: string;
  timeSpentSeconds: number;
  eliminatedOptionsCount: number;
  wasFlagged: boolean;
  answered: boolean;
}

// Bảng câu hỏi mẫu tiêu chuẩn mô phỏng kỳ thi Digital SAT College Board
const SAMPLE_QUESTIONS: ExamQuestion[] = [
  {
    id: 'q1',
    order: 1,
    section: 'rw',
    domain: 'Information and Ideas',
    passage:
      'In 2018, paleoclimatologist Dr. Elena Vance analyzed deep-sea sediment cores retrieved from the North Atlantic Ocean. The isotopic ratios of oxygen-18 trapped within fossilized benthic foraminifera shells revealed significant cyclical fluctuations. Vance hypothesized that periodic changes in oceanic thermohaline circulation were responsible for sudden decadal-scale climatic cooling episodes known as Dansgaard-Oeschger events during the late Pleistocene epoch.',
    question:
      'Which finding, if true, would most directly support Dr. Vance’s hypothesis regarding the Dansgaard-Oeschger events?',
    choices: [
      'A) Ice sheet melting coincided with abrupt slowdowns in deep-water North Atlantic convective mixing prior to cooling.',
      'B) The abundance of foraminifera shells remained largely static during periods of surface water warming.',
      'C) Carbon dioxide concentrations in polar ice bubbles fluctuated independently of oceanic circulation cycles.',
      'D) Volcanic aerosol depositions peaked simultaneously across multiple continents during the Holocene.',
    ],
    correctIndex: 0,
    explanation_vi:
      'Đáp án A củng cố trực tiếp giả thuyết của Vance vì nó chứng minh sự suy giảm lưu thông nhiệt muối ở Bắc Đại Tây Dương diễn ra đồng thời với các đợt làm lạnh khí hậu.',
  },
  {
    id: 'q2',
    order: 2,
    section: 'rw',
    domain: 'Craft and Structure',
    passage:
      'The traditional historical narrative posited that the ancient city of Teotihuacan exercised absolute political hegemony over contemporary Mayan city-states. However, recent excavations at the Tikal acropolis discovered residential enclaves built using authentic central Mexican architectural motifs alongside native Guatemalan jade burial artifacts, indicating a relationship characterized more by diplomatic reciprocity than by unyielding imperial subjugation.',
    question: 'As used in the text, what does the word "hegemony" most nearly mean?',
    choices: [
      'A) Cultural exchange',
      'B) Dominant authority',
      'C) Architectural uniformity',
      'D) Commercial rivalry',
    ],
    correctIndex: 1,
    explanation_vi:
      'Từ "hegemony" trong ngữ cảnh lịch sử chính trị có nghĩa là sự thống trị hoặc bá quyền (Dominant authority).',
  },
  {
    id: 'q3',
    order: 3,
    section: 'math',
    domain: 'Algebra',
    passage: undefined,
    question:
      'If 3x + 2y = 18 and 2x - y = 5, what is the value of 5x + y?',
    choices: ['A) 13', 'B) 23', 'C) 27', 'D) 31'],
    correctIndex: 1,
    explanation_vi:
      'Cộng hai phương trình vế theo vế: (3x + 2y) + (2x - y) = 18 + 5 ⇒ 5x + y = 23.',
  },
  {
    id: 'q4',
    order: 4,
    section: 'math',
    domain: 'Advanced Math',
    passage: undefined,
    question:
      'The parabola with equation y = a(x - 3)^2 + 8 passes through the point (1, -4). What is the value of constant a?',
    choices: ['A) -3', 'B) -2', 'C) 2', 'D) 3'],
    correctIndex: 0,
    explanation_vi:
      'Thay tọa độ (1, -4) vào phương trình: -4 = a(1 - 3)^2 + 8 ⇒ -4 = 4a + 8 ⇒ 4a = -12 ⇒ a = -3.',
  },
  {
    id: 'q5',
    order: 5,
    section: 'math',
    domain: 'Geometry and Trigonometry',
    passage: undefined,
    question:
      'In a right triangle ABC with right angle at B, the length of hypotenuse AC is 25 and the length of side AB is 24. What is the value of cos(A)?',
    choices: ['A) 7/25', 'B) 7/24', 'C) 24/25', 'D) 25/24'],
    correctIndex: 2,
    explanation_vi:
      'Trong tam giác vuông ABC vuông tại B: cos(A) = cạnh kề / cạnh huyền = AB / AC = 24 / 25.',
  },
];

// ----------------------------------------------------------------------------
// HELPER: Chuyển đổi và chuẩn hóa phương án lựa chọn & đáp án đúng
// ----------------------------------------------------------------------------
function ensureChoices(rawChoices: string[] | undefined, correctChoice: string | number | undefined): { choices: string[]; correctIndex: number } {
  if (Array.isArray(rawChoices) && rawChoices.length >= 2) {
    const choices = rawChoices.map((c, i) => {
      const prefix = ['A)', 'B)', 'C)', 'D)'][i] || `${i + 1})`;
      const clean = String(c).replace(/^[A-D]\)\s*/, '').trim();
      return `${prefix} ${clean}`;
    });
    let correctIndex = 0;
    const target = String(correctChoice || '').trim();
    if (/^[A-D]\b/i.test(target)) {
      const letter = target[0].toUpperCase();
      correctIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
      if (correctIndex === -1) correctIndex = 0;
    } else {
      const matchedIdx = rawChoices.findIndex(
        (c) =>
          c.trim().toLowerCase() === target.toLowerCase() ||
          c.replace(/^[A-D]\)\s*/, '').trim().toLowerCase() === target.toLowerCase()
      );
      if (matchedIdx !== -1) correctIndex = matchedIdx;
    }
    return { choices, correctIndex };
  }

  // Câu hỏi Student-Produced Response (SPR) số học
  const numVal = parseFloat(String(correctChoice));
  if (!isNaN(numVal)) {
    const valStr = String(correctChoice).trim();
    const choices = [
      `A) ${valStr}`,
      `B) ${numVal + (numVal >= 10 ? 4 : 2)}`,
      `C) ${numVal > 2 ? numVal - 2 : numVal * 2}`,
      `D) ${numVal * 2 + 1}`,
    ];
    return { choices, correctIndex: 0 };
  }

  return {
    choices: [
      `A) ${correctChoice || 'True'}`,
      'B) Phương án sai B',
      'C) Phương án sai C',
      'D) Phương án sai D',
    ],
    correctIndex: 0,
  };
}

// ----------------------------------------------------------------------------
// HELPER: Nạp câu hỏi từ mock_exams.json
// ----------------------------------------------------------------------------
interface RawExamQuestion {
  id?: string;
  section?: 'rw' | 'math';
  domain?: string;
  full_passage?: string;
  passage?: string;
  practice_question?: string;
  prompt?: string;
  question?: string;
  choices?: string[];
  correct_choice?: string | number;
  explanation?: string;
  explanation_vi?: string;
}

interface RawExamModule {
  id?: string;
  name?: string;
  section?: 'rw' | 'math';
  questions?: RawExamQuestion[];
}

interface RawExamItem {
  id: string;
  title: string;
  modules?: RawExamModule[];
}

function parseMockExamQuestions(examItem: RawExamItem): ExamQuestion[] {
  const list: ExamQuestion[] = [];
  let order = 1;
  (examItem.modules || []).forEach((mod) => {
    const isMath = (mod.name || '').toLowerCase().includes('math');
    const defaultSection: 'rw' | 'math' = isMath ? 'math' : 'rw';

    (mod.questions || []).forEach((q) => {
      const qSection: 'rw' | 'math' = q.section === 'math' ? 'math' : q.section === 'rw' ? 'rw' : defaultSection;
      const { choices, correctIndex } = ensureChoices(q.choices, q.correct_choice);
      list.push({
        id: q.id || `m_${order}`,
        order: order++,
        section: qSection,
        domain: q.domain || (qSection === 'math' ? 'Advanced Math' : 'Information and Ideas'),
        passage: q.full_passage && q.full_passage.trim().length > 0 ? q.full_passage : (q.passage || undefined),
        question: q.practice_question || q.prompt || q.question || '',
        choices,
        correctIndex,
        explanation_vi: q.explanation || q.explanation_vi || 'Giải thích chi tiết chuẩn hóa College Board.',
      });
    });
  });
  return list;
}

// ----------------------------------------------------------------------------
// HELPER: Nạp câu hỏi từ diagnostic_questions.json
// ----------------------------------------------------------------------------
interface RawDiagQuestion {
  id?: string;
  skillId?: string;
  title?: string;
  difficulty?: string;
  practice_question?: string;
  question?: string;
  choices?: string[];
  correct_choice?: string | number;
  explanation?: string;
}

function parseDiagnosticQuestions(diagList: RawDiagQuestion[]): ExamQuestion[] {
  return diagList.map((q, idx) => {
    const { choices, correctIndex } = ensureChoices(q.choices, q.correct_choice);
    const isMath = !!(q.skillId && (q.skillId.includes('algebra') || q.skillId.includes('math')));
    return {
      id: q.id || `diag_${idx + 1}`,
      order: idx + 1,
      section: isMath ? 'math' : 'rw',
      domain: q.title || (isMath ? 'Algebra' : 'Craft and Structure'),
      passage: undefined,
      question: q.practice_question || q.question || '',
      choices,
      correctIndex,
      explanation_vi: q.explanation || 'Giải thích chuẩn chẩn đoán kiến thức nền tảng.',
    };
  });
}

// ----------------------------------------------------------------------------
// HELPER: Sinh bộ câu hỏi đặc thù cho các đề Mock 03-06 và QAS 2024
// ----------------------------------------------------------------------------
function createDedicatedExamQuestions(examKey: string, region: string, mathOffset: number): ExamQuestion[] {
  return [
    {
      id: `${examKey}_q1`,
      order: 1,
      section: 'rw',
      domain: 'Craft and Structure',
      passage: `Recent archaeological fieldwork in ${region} revealed ceramic fragments with distinct geometric pigmentations. While previous scholars assumed the community operated in complete seclusion, Dr. Martinez argues that the chemical composition of the glazes suggests regular, reciprocal exchange with neighboring coastal settlements.`,
      question: 'Which choice best describes the main function of the underlined claim regarding the chemical composition?',
      choices: [
        'A) It challenges the established historical consensus about the community’s isolation.',
        'B) It provides conclusive proof of warfare between the settlements.',
        'C) It disputes the authenticity of the ceramic fragments found by Martinez.',
        'D) It suggests that trade was restricted solely to raw ceramic minerals.',
      ],
      correctIndex: 0,
      explanation_vi: 'Chi tiết phân tích hóa học lớp men chứng minh có sự trao đổi với các khu vực duyên hải lân cận, trực tiếp phản bác quan điểm truyền thống cho rằng cộng đồng này hoàn toàn biệt lập.',
    },
    {
      id: `${examKey}_q2`,
      order: 2,
      section: 'rw',
      domain: 'Craft and Structure',
      passage: 'The critic noted that although the author’s prose was undeniably _______, it occasionally slipped into esoteric phrasing that alienated casual readers.',
      question: 'Which choice completes the text with the most logical and precise word?',
      choices: ['A) lucid', 'B) pedantic', 'C) opaque', 'D) fragmented'],
      correctIndex: 0,
      explanation_vi: 'Liên từ "although" tạo sự đối lập giữa điểm tích cực (văn phong sáng sủa, mạch lạc - lucid) với việc thỉnh thoảng dùng từ ngữ quá hàn lâm, khó hiểu.',
    },
    {
      id: `${examKey}_q3`,
      order: 3,
      section: 'rw',
      domain: 'Information and Ideas',
      passage: 'In marine biology, the concept of "trophic cascades" describes how predators indirectly suppress lower trophic levels. In Monterey Bay, the reintroduction of sea otters led to an immediate decline in herbivorous sea urchin density, allowing kelp forests to rapidly regenerate.',
      question: 'Based on the passage, what would most likely happen if the sea otter population were abruptly depleted?',
      choices: [
        'A) Sea urchin populations would proliferate, leading to overgrazing of kelp forests.',
        'B) Kelp forests would expand even faster due to excess sunlight.',
        'C) Deep-sea fish species would immediately replace sea otters as apex predators.',
        'D) Sea urchins would alter their diet from kelp to photosynthetic phytoplankton.',
      ],
      correctIndex: 0,
      explanation_vi: 'Theo cơ chế trophic cascade, rái cá biển kiểm soát mật độ nhím biển. Nếu rái cá sụt giảm, nhím biển sẽ sinh sôi bùng nổ và gặm nhẵn các cánh rừng tảo bẹ.',
    },
    {
      id: `${examKey}_q4`,
      order: 4,
      section: 'rw',
      domain: 'Expression of Ideas',
      passage: 'Urban ecologists observed that artificial lighting at night significantly delays the migratory departures of several songbird species. _______, urban noise pollution impairs their auditory orientation.',
      question: 'Which choice completes the text with the most logical transition?',
      choices: ['A) Furthermore', 'B) In contrast', 'C) Therefore', 'D) Instead'],
      correctIndex: 0,
      explanation_vi: 'Cả hai câu đều nêu các tác động tiêu cực của đô thị hóa lên loài chim di cư (ánh sáng nhân tạo và ô nhiễm tiếng ồn), do đó cần từ nối mang tính bổ sung (Furthermore).',
    },
    {
      id: `${examKey}_q5`,
      order: 5,
      section: 'rw',
      domain: 'Standard English Conventions',
      passage: undefined,
      question: 'Composer Florence Price, whose symphonic works blend African American spiritual melodies with European classical orchestration, _______ the first African American woman to have a composition played by a major American orchestra.',
      choices: ['A) was', 'B) being', 'C) were', 'D) having been'],
      correctIndex: 0,
      explanation_vi: 'Chủ ngữ chính là danh từ số ít "Composer Florence Price", mệnh đề phụ "whose symphonic..." nằm giữa hai dấu phẩy, nên động từ vị ngữ chính phải ở thì quá khứ đơn số ít "was".',
    },
    {
      id: `${examKey}_q6`,
      order: 6,
      section: 'math',
      domain: 'Algebra',
      passage: undefined,
      question: `If ${2 + mathOffset}x - 7 = ${13 + 3 * mathOffset}, what is the value of x?`,
      choices: [
        `A) ${Math.round((20 + 2 * mathOffset) / (2 + mathOffset))}`,
        `B) ${Math.round((20 + 2 * mathOffset) / (2 + mathOffset)) + 3}`,
        `C) ${Math.round((20 + 2 * mathOffset) / (2 + mathOffset)) - 2}`,
        `D) ${Math.round((20 + 2 * mathOffset) / (2 + mathOffset)) + 5}`,
      ],
      correctIndex: 0,
      explanation_vi: 'Chuyển vế đổi dấu và giải phương trình bậc nhất: chia cả hai vế cho hệ số của x để tìm nghiệm x duy nhất.',
    },
    {
      id: `${examKey}_q7`,
      order: 7,
      section: 'math',
      domain: 'Advanced Math',
      passage: undefined,
      question: `The function f(x) = (x - ${3 + mathOffset})(x + ${5 + mathOffset}). What is the y-intercept of the graph of y = f(x) in the xy-plane?`,
      choices: [
        `A) (0, -${(3 + mathOffset) * (5 + mathOffset)})`,
        `B) (0, ${(3 + mathOffset) * (5 + mathOffset)})`,
        `C) (-${3 + mathOffset}, 0)`,
        `D) (${5 + mathOffset}, 0)`,
      ],
      correctIndex: 0,
      explanation_vi: 'Giao điểm với trục tung (y-intercept) đạt được khi thay x = 0 vào hàm số: f(0) = (0 - a)(0 + b) = -ab.',
    },
    {
      id: `${examKey}_q8`,
      order: 8,
      section: 'math',
      domain: 'Problem-Solving and Data Analysis',
      passage: undefined,
      question: `A retail store purchased an electronic item for $${100 + 10 * mathOffset}. The manager marked up the price by 20%. During a holiday sale, the item was discounted by 10%. What was the final selling price?`,
      choices: [
        `A) $${((100 + 10 * mathOffset) * 1.2 * 0.9).toFixed(2)}`,
        `B) $${((100 + 10 * mathOffset) * 1.1).toFixed(2)}`,
        `C) $${((100 + 10 * mathOffset) * 1.25).toFixed(2)}`,
        `D) $${((100 + 10 * mathOffset) * 0.9).toFixed(2)}`,
      ],
      correctIndex: 0,
      explanation_vi: 'Giá bán sau tăng 20%: P1 = P0 * 1.2. Giá bán cuối sau giảm 10%: P2 = P1 * 0.9 = P0 * 1.08.',
    },
    {
      id: `${examKey}_q9`,
      order: 9,
      section: 'math',
      domain: 'Geometry and Trigonometry',
      passage: undefined,
      question: `In a right triangle XYZ with right angle at Y, the length of side XY is ${8 + 2 * mathOffset} and YZ is ${6 + 2 * mathOffset}. What is the value of tan(X)?`,
      choices: [
        `A) ${(6 + 2 * mathOffset) / (8 + 2 * mathOffset) === 0.75 ? '3/4' : `${6 + 2 * mathOffset}/${8 + 2 * mathOffset}`}`,
        `B) ${(8 + 2 * mathOffset) / (6 + 2 * mathOffset) === 1.33 ? '4/3' : `${8 + 2 * mathOffset}/${6 + 2 * mathOffset}`}`,
        `C) 3/5`,
        `D) 4/5`,
      ],
      correctIndex: 0,
      explanation_vi: 'Trong tam giác vuông: tan(X) = cạnh đối / cạnh kề = YZ / XY.',
    },
    {
      id: `${examKey}_q10`,
      order: 10,
      section: 'math',
      domain: 'Advanced Math',
      passage: undefined,
      question: `For what value of k does the equation x^2 - ${4 + 2 * mathOffset}x + k = 0 have exactly one real solution?`,
      choices: [
        `A) ${Math.pow((4 + 2 * mathOffset) / 2, 2)}`,
        `B) ${Math.pow((4 + 2 * mathOffset) / 2, 2) + 4}`,
        `C) ${Math.pow((4 + 2 * mathOffset) / 2, 2) - 4}`,
        `D) ${4 + 2 * mathOffset}`,
      ],
      correctIndex: 0,
      explanation_vi: 'Phương trình bậc hai có nghiệm kép khi và chỉ khi biệt thức Delta = b^2 - 4ac = 0 => k = (b/2)^2.',
    },
  ];
}

const CUSTOM_EXAMS_METADATA: Record<string, { title: string; region: string; offset: number }> = {
  'sat-mock-03': { title: 'Digital SAT Practice Test 3 (Official Bluebook Format)', region: 'Mesoamerica', offset: 1 },
  'sat-mock-04': { title: 'Digital SAT Practice Test 4 (Advanced High-Score Drill)', region: 'the Aegean Archipelago', offset: 2 },
  'sat-mock-05': { title: 'Digital SAT Practice Test 5 (Official Bluebook Full Module)', region: 'the Indus Valley', offset: 3 },
  'sat-mock-06': { title: 'Digital SAT Practice Test 6 (Official Bluebook Full Module)', region: 'Sub-Saharan Africa', offset: 4 },
  'sat-qas-2024-03': { title: 'Digital SAT QAS Tháng 03/2024 (US Official Test)', region: 'Central Anatolia', offset: 5 },
  'sat-qas-2024-05': { title: 'Digital SAT QAS Tháng 05/2024 (International Official Test)', region: 'Polynesia', offset: 6 },
  'sat-qas-2024-06': { title: 'Digital SAT QAS Tháng 06/2024 (US Official Test)', region: 'Ancient Mesopotamia', offset: 7 },
  'sat-qas-2024-08': { title: 'Digital SAT QAS Tháng 08/2024 (International Official Test)', region: 'Scandinavia', offset: 8 },
  'sat-qas-2024-10': { title: 'Digital SAT QAS Tháng 10/2024 (US Official Test)', region: 'the Mediterranean Basin', offset: 9 },
  'sat-qas-2024-11': { title: 'Digital SAT QAS Tháng 11/2024 (International Official Test)', region: 'East Asia', offset: 10 },
};

// ----------------------------------------------------------------------------
// NẠP ĐỀ THEO EXAM ID
// ----------------------------------------------------------------------------
function loadExamById(examId: string): { title: string; durationMinutes: number; questions: ExamQuestion[] } {
  const normId = (examId || '').toLowerCase().trim();

  // Test 1 aliases
  if (normId === 'sat-mock-01' || normId === 'mock_sat_1' || normId === '1') {
    const rawList = (mockExamsData as { exams?: RawExamItem[] })?.exams || [];
    const rawExam = rawList.find((e) => e.id === 'mock_sat_1') || rawList[0];
    if (rawExam) {
      return {
        title: rawExam.title || 'Digital SAT Practice Test 1 (Bản Chuẩn College Board)',
        durationMinutes: 32,
        questions: parseMockExamQuestions(rawExam),
      };
    }
  }

  // Test 2 aliases
  if (normId === 'sat-mock-02' || normId === 'mock_sat_2' || normId === '2') {
    const rawList = (mockExamsData as { exams?: RawExamItem[] })?.exams || [];
    const rawExam = rawList.find((e) => e.id === 'mock_sat_2') || rawList[1];
    if (rawExam) {
      return {
        title: rawExam.title || 'Digital SAT Practice Test 2 (Bản Nâng Cao Phân Hóa)',
        durationMinutes: 32,
        questions: parseMockExamQuestions(rawExam),
      };
    }
  }

  // Diagnostic
  if (normId === 'sat-diagnostic-quick' || normId === 'diagnostic' || normId.includes('diagnostic')) {
    return {
      title: 'Đề Chẩn Đoán Nhanh 15 Phút (Diagnostic Quick Assessment)',
      durationMinutes: 15,
      questions: parseDiagnosticQuestions(diagnosticQuestionsData as RawDiagQuestion[]),
    };
  }

  // Custom mock and QAS
  if (CUSTOM_EXAMS_METADATA[normId]) {
    const meta = CUSTOM_EXAMS_METADATA[normId];
    return {
      title: meta.title,
      durationMinutes: 32,
      questions: createDedicatedExamQuestions(normId, meta.region, meta.offset),
    };
  }

  // Fallback: Nếu không tìm thấy, trả về bộ mẫu kết hợp đầy đủ
  return {
    title: `Digital SAT Practice Test (${examId.toUpperCase()})`,
    durationMinutes: 32,
    questions: createDedicatedExamQuestions(normId, 'Global', 1),
  };
}

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = (params?.id as string) || 'sat-mock-01';

  // Tải ngân hàng câu hỏi động theo đúng examId
  const examData = useMemo(() => loadExamById(examId), [examId]);
  const questions = examData.questions;
  const examTitle = examData.title;
  const durationMinutes = examData.durationMinutes;

  // State câu hỏi & điều hướng
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});

  // #C011: Tỷ lệ Split-Pane (40/60, 50/50, 60/40)
  const [splitRatio, setSplitRatio] = useState<SplitRatio>('50/50');

  // #C012 & #C013: Topic Note & Gạch bỏ phương án (Eliminated Options)
  const [passageNotes, setPassageNotes] = useState<Record<string, string>>({});
  const [passageHighlights, setPassageHighlights] = useState<Record<string, string[]>>({});
  const [eliminatedOptions, setEliminatedOptions] = useState<Record<string, number[]>>({});
  const [eliminationMode, setEliminationMode] = useState<boolean>(false);

  // #C014 & #C015: Modals Desmos & Formula Sheet
  const [isDesmosOpen, setIsDesmosOpen] = useState<boolean>(false);
  const [isFormulaOpen, setIsFormulaOpen] = useState<boolean>(false);

  // #C016: Smart Pacing tracker
  const [timeSpentPerQuestion, setTimeSpentPerQuestion] = useState<Record<string, number>>({});
  const [isPacingAlertDismissed, setIsPacingAlertDismissed] = useState<Record<string, boolean>>({});

  // #C018: Navigation drawer & Filter
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);
  const [navFilter, setNavFilter] = useState<NavFilter>('all');

  // #C019: Fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // #C020: Nộp bài & Thống kê
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [totalRemainingSeconds, setTotalRemainingSeconds] = useState<number>(durationMinutes * 60);
  const [isTimerHidden, setIsTimerHidden] = useState<boolean>(false);

  // Reset state khi đổi đề thi
  useEffect(() => {
    setCurrentIndex(0);
    setAnswers({});
    setFlagged({});
    setTimeSpentPerQuestion({});
    setIsPacingAlertDismissed({});
    setEliminatedOptions({});
    setPassageNotes({});
    setPassageHighlights({});
    setIsSubmitted(false);
    setTotalRemainingSeconds(durationMinutes * 60);
  }, [examId, durationMinutes]);

  const currentQ = questions[currentIndex] || questions[0] || SAMPLE_QUESTIONS[0];

  // --------------------------------------------------------------------------
  // TIMER & PACING MONITOR (#C016)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (isSubmitted) return;
    const interval = setInterval(() => {
      setTotalRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      setTimeSpentPerQuestion((prev) => {
        const qid = currentQ.id;
        return {
          ...prev,
          [qid]: (prev[qid] || 0) + 1,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQ.id, isSubmitted]);

  const currentQuestionTime = timeSpentPerQuestion[currentQ.id] || 0;
  const isStuckWarning = currentQuestionTime >= 90 && !isPacingAlertDismissed[currentQ.id];

  // --------------------------------------------------------------------------
  // HOTKEYS (#C017)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bỏ qua khi đang gõ vào input hoặc textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.altKey) {
        if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          // Alt+F: Toggle Flag
          setFlagged((prev) => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }));
        } else if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          // Alt+C: Toggle Desmos
          setIsDesmosOpen((prev) => !prev);
        } else if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          // Alt+R: Toggle Reference Formula Sheet
          setIsFormulaOpen((prev) => !prev);
        } else if (e.key.toLowerCase() === 'x') {
          e.preventDefault();
          // Alt+X: Toggle Elimination Mode
          setEliminationMode((prev) => !prev);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          // Alt+Right: Next Question
          if (currentIndex < questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          // Alt+Left: Prev Question
          if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQ.id, currentIndex, questions.length]);

  // --------------------------------------------------------------------------
  // FULLSCREEN TOGGLE (#C019)
  // --------------------------------------------------------------------------
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // --------------------------------------------------------------------------
  // ELIMINATION TOGGLE (#C013)
  // --------------------------------------------------------------------------
  const handleToggleEliminate = (choiceIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const qid = currentQ.id;
    const currentList = eliminatedOptions[qid] || [];
    if (currentList.includes(choiceIdx)) {
      setEliminatedOptions({
        ...eliminatedOptions,
        [qid]: currentList.filter((idx) => idx !== choiceIdx),
      });
    } else {
      setEliminatedOptions({
        ...eliminatedOptions,
        [qid]: [...currentList, choiceIdx],
      });
      // Nếu đáp án bị gạch mà đang được chọn thì hủy chọn
      if (answers[qid] === choiceIdx) {
        const nextAnswers = { ...answers };
        delete nextAnswers[qid];
        setAnswers(nextAnswers);
      }
    }
  };

  const handleSelectAnswer = (choiceIdx: number) => {
    const qid = currentQ.id;
    const eliminated = eliminatedOptions[qid] || [];
    if (eliminated.includes(choiceIdx)) {
      // Bỏ gạch trước khi chọn
      setEliminatedOptions({
        ...eliminatedOptions,
        [qid]: eliminated.filter((idx) => idx !== choiceIdx),
      });
    }
    setAnswers({ ...answers, [qid]: choiceIdx });
  };

  // --------------------------------------------------------------------------
  // SPLIT RATIO STYLES (#C011)
  // --------------------------------------------------------------------------
  const leftPaneClass = useMemo(() => {
    if (splitRatio === '40/60') return 'w-full md:w-[40%]';
    if (splitRatio === '60/40') return 'w-full md:w-[60%]';
    return 'w-full md:w-[50%]';
  }, [splitRatio]);

  const rightPaneClass = useMemo(() => {
    if (splitRatio === '40/60') return 'w-full md:w-[60%]';
    if (splitRatio === '60/40') return 'w-full md:w-[40%]';
    return 'w-full md:w-[50%]';
  }, [splitRatio]);

  // --------------------------------------------------------------------------
  // FILTERED QUESTIONS FOR NAV DRAWER (#C018)
  // --------------------------------------------------------------------------
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const isAnswered = answers[q.id] !== undefined;
      const isFlag = !!flagged[q.id];
      if (navFilter === 'unanswered') return !isAnswered;
      if (navFilter === 'flagged') return isFlag;
      return true;
    });
  }, [questions, answers, flagged, navFilter]);

  // --------------------------------------------------------------------------
  // SUBMISSION & PACE BREAKDOWN (#C020)
  // --------------------------------------------------------------------------
  const paceSummary = useMemo(() => {
    let totalSec = 0;
    let totalEliminated = 0;
    let answeredCount = 0;
    let correctCount = 0;

    questions.forEach((q) => {
      const sec = timeSpentPerQuestion[q.id] || 0;
      totalSec += sec;
      totalEliminated += (eliminatedOptions[q.id] || []).length;
      if (answers[q.id] !== undefined) {
        answeredCount++;
        if (answers[q.id] === q.correctIndex) {
          correctCount++;
        }
      }
    });

    const avgSecPerQuestion = questions.length > 0 ? Math.round(totalSec / questions.length) : 0;

    return {
      totalTimeSec: totalSec,
      avgSecPerQuestion,
      answeredCount,
      totalCount: questions.length,
      correctCount,
      totalEliminated,
      flaggedCount: Object.values(flagged).filter(Boolean).length,
    };
  }, [questions, answers, timeSpentPerQuestion, eliminatedOptions, flagged]);

  // Format mm:ss
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none overflow-hidden font-sans">
      {/* ==================================================================== */}
      {/* 1. TOP HEADER (Bluebook Authentic Bar)                               */}
      {/* ==================================================================== */}
      <header className="h-14 px-3 sm:px-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push('/exams')}
            title="Quay lại danh mục đề thi"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700/60"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Kho đề</span>
          </button>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white truncate max-w-[180px] sm:max-w-[320px]">
                {examTitle}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium shrink-0">
                {currentQ.section === 'rw' ? 'RW' : 'Math'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Câu {currentIndex + 1} / {questions.length} • {currentQ.domain}
            </div>
          </div>
        </div>

        {/* Center: Timer (#C020 countdown) */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
          <Clock className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-sm font-bold tracking-wider text-emerald-400">
            {isTimerHidden ? '--:--' : formatTime(totalRemainingSeconds)}
          </span>
          <button
            type="button"
            onClick={() => setIsTimerHidden(!isTimerHidden)}
            title={isTimerHidden ? 'Hiện thời gian' : 'Ẩn thời gian'}
            className="text-slate-400 hover:text-white p-0.5"
          >
            {isTimerHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Right Toolbar: Tools & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* #C011: Chọn tỷ lệ Split-Pane */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
            <Columns className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
            {(['40/60', '50/50', '60/40'] as SplitRatio[]).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setSplitRatio(ratio)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  splitRatio === ratio
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Tỷ lệ chia màn hình: ${ratio}`}
              >
                {ratio}
              </button>
            ))}
          </div>

          {/* #C014: Desmos Calculator */}
          <button
            type="button"
            onClick={() => setIsDesmosOpen(!isDesmosOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isDesmosOpen
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title="Mở máy tính Desmos (Alt+C)"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Desmos</span>
          </button>

          {/* #C015: Formula Reference Sheet */}
          <button
            type="button"
            onClick={() => setIsFormulaOpen(!isFormulaOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isFormulaOpen
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title="Mở bảng công thức (Alt+R)"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Công thức</span>
          </button>

          {/* #C019: Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-colors"
            title={isFullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* 2. SUB-HEADER TOOLBAR (Review Flag & Tools)                          */}
      {/* ==================================================================== */}
      <div className="h-10 px-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-3">
          {/* Flag for review */}
          <button
            type="button"
            onClick={() => setFlagged({ ...flagged, [currentQ.id]: !flagged[currentQ.id] })}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
              flagged[currentQ.id]
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
            title="Đánh dấu xem lại câu này (Alt+F)"
          >
            <Flag className={`w-3.5 h-3.5 ${flagged[currentQ.id] ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>{flagged[currentQ.id] ? 'Đã đánh dấu xem lại' : 'Đánh dấu xem lại (Alt+F)'}</span>
          </button>

          {/* #C013: Option elimination mode toggle */}
          <button
            type="button"
            onClick={() => setEliminationMode(!eliminationMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
              eliminationMode
                ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
            title="Chế độ gạch bỏ phương án sai (Alt+X)"
          >
            <Strikethrough className="w-3.5 h-3.5" />
            <span>Gạch bỏ đáp án (Alt+X)</span>
          </button>
        </div>

        {/* #C016: Smart Pacing Alert Pill */}
        {isStuckWarning && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/40 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full text-[11px] animate-pulse">
            <Timer className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Đã dừng ở câu này {currentQuestionTime}s. Cân nhắc gắn cờ rồi làm tiếp!</span>
            <button
              type="button"
              onClick={() =>
                setIsPacingAlertDismissed({ ...isPacingAlertDismissed, [currentQ.id]: true })
              }
              className="hover:text-amber-900 ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400">
            Thời gian câu này: <strong>{currentQuestionTime}s</strong>
          </span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. SPLIT-PANE MAIN STAGE (#C011)                                     */}
      {/* ==================================================================== */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* LEFT PANE: Passage & Notes (#C012) */}
        <div
          className={`${leftPaneClass} border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-y-auto p-6 custom-scrollbar bg-white dark:bg-slate-900/50`}
        >
          {currentQ.passage ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Đoạn văn đọc hiểu (Reading Passage)
                </span>
                <span className="text-[11px] text-slate-400">SAT Standard Text</span>
              </div>

              {/* Nội dung đoạn văn */}
              <div className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-200 font-serif selection:bg-yellow-200 dark:selection:bg-yellow-900">
                {currentQ.passage}
              </div>

              {/* #C012: Thanh ghi chú câu chủ đề / Highlight nhanh */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Highlighter className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Ghi chú câu chủ đề / Luận điểm chính (Topic Note):</span>
                </div>
                <textarea
                  value={passageNotes[currentQ.id] || ''}
                  onChange={(e) =>
                    setPassageNotes({ ...passageNotes, [currentQ.id]: e.target.value })
                  }
                  placeholder="Ghi chú nhanh từ khóa hoặc ý chính đoạn văn để dễ đối chiếu..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <Calculator className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="font-semibold text-sm text-slate-600 dark:text-slate-300">
                Câu hỏi Toán không kèm đoạn văn dài
              </div>
              <p className="text-xs max-w-sm mt-1 text-slate-500">
                Sử dụng giấy nháp hoặc bấm nút <strong>Desmos (Alt+C)</strong> / <strong>Công thức (Alt+R)</strong> phía trên để hỗ trợ tính toán.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT PANE: Question & Options (#C013) */}
        <div
          className={`${rightPaneClass} flex flex-col h-full overflow-y-auto p-6 custom-scrollbar bg-slate-50 dark:bg-slate-950`}
        >
          <div className="space-y-6 max-w-2xl mx-auto w-full">
            {/* Question Text */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  Câu hỏi {currentIndex + 1}
                </span>
                {eliminationMode && (
                  <span className="text-[11px] text-red-600 font-semibold bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200">
                    Bấm vào dấu gạch (/) để loại phương án
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-medium text-slate-900 dark:text-slate-100 leading-snug">
                {currentQ.question}
              </h2>
            </div>

            {/* Choices list with Elimination Support (#C013) */}
            <div className="space-y-3">
              {currentQ.choices.map((choice, cIdx) => {
                const isSelected = answers[currentQ.id] === cIdx;
                const isEliminated = (eliminatedOptions[currentQ.id] || []).includes(cIdx);

                return (
                  <div
                    key={cIdx}
                    onClick={() => !isEliminated && handleSelectAnswer(cIdx)}
                    className={`group relative flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                      isEliminated
                        ? 'opacity-40 bg-slate-100 dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-800'
                        : isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Radio indicator */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>

                    {/* Choice text */}
                    <div
                      className={`text-sm sm:text-base flex-1 leading-relaxed ${
                        isEliminated ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {choice}
                    </div>

                    {/* Elimination button (#C013) */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleEliminate(cIdx, e)}
                      title={isEliminated ? 'Khôi phục phương án này' : 'Gạch bỏ phương án sai này'}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isEliminated
                          ? 'text-red-600 bg-red-50 dark:bg-red-950/60'
                          : 'text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-60 group-hover:opacity-100'
                      }`}
                    >
                      <Strikethrough className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. BOTTOM FOOTER BAR (Bluebook Navigation)                           */}
      {/* ==================================================================== */}
      <footer className="h-16 px-4 bg-slate-900 text-white flex items-center justify-between border-t border-slate-800 shrink-0 z-30">
        <div className="flex items-center gap-2">
          {/* #C018: Question Navigator trigger */}
          <button
            type="button"
            onClick={() => setIsNavOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors"
          >
            <Grid className="w-4 h-4 text-indigo-400" />
            <span>
              Câu hỏi: {currentIndex + 1} / {questions.length}
            </span>
          </button>
        </div>

        {/* Prev / Next controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => currentIndex > 0 && setCurrentIndex((prev) => prev - 1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white text-xs font-semibold border border-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Câu trước</span>
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => prev + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
            >
              <span>Câu sau</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsSubmitted(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-colors animate-pulse"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Nộp bài thi</span>
            </button>
          )}
        </div>
      </footer>

      {/* ==================================================================== */}
      {/* 5. MODAL: QUESTION NAVIGATOR DRAWER (#C018)                          */}
      {/* ==================================================================== */}
      {isNavOpen && (
        <div
          role="presentation"
          onClick={() => setIsNavOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        >
          <div
            role="dialog"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-4 bg-slate-100 dark:bg-slate-800 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
              <div className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Grid className="w-4 h-4 text-indigo-500" />
                <span>Bảng điều hướng câu hỏi (Bluebook Review)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsNavOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* #C018: 3 Filter Tabs */}
            <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-2 gap-2 text-xs">
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'unanswered', label: 'Chưa làm' },
                  { id: 'flagged', label: 'Đã gắn cờ' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setNavFilter(tab.id)}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    navFilter === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Question Badges Grid */}
            <div className="p-5 max-h-72 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-5 gap-3">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered = answers[q.id] !== undefined;
                  const isFlag = !!flagged[q.id];

                  // Filter visibility
                  if (navFilter === 'unanswered' && isAnswered) return null;
                  if (navFilter === 'flagged' && !isFlag) return null;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setIsNavOpen(false);
                      }}
                      className={`relative flex flex-col items-center justify-center h-12 rounded-xl font-bold text-xs border-2 transition-all ${
                        isCurrent
                          ? 'border-indigo-600 ring-2 ring-indigo-400 ring-offset-1'
                          : 'border-slate-200 dark:border-slate-700'
                      } ${
                        isAnswered
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{idx + 1}</span>
                      {isFlag && (
                        <Flag className="w-3 h-3 fill-amber-400 text-amber-400 absolute -top-1.5 -right-1.5 drop-shadow" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500">
              <span>Đã làm: {Object.keys(answers).length}/{questions.length}</span>
              <span>Gắn cờ: {Object.values(flagged).filter(Boolean).length}</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. MODAL: SUBMISSION & PACE SUMMARY (#C020)                          */}
      {/* ==================================================================== */}
      {isSubmitted && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl p-6 space-y-6">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Hoàn thành bài thi: {examTitle}
              </h2>
              <p className="text-xs text-slate-500">
                Mã đề: {examId.toUpperCase()} • Thống kê nhịp độ làm bài & phân tích hiệu suất chuẩn College Board
              </p>
            </div>

            {/* Grid 4 chỉ số Pacing */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">Tổng thời gian</div>
                <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {formatTime(paceSummary.totalTimeSec)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">Nhịp độ trung bình</div>
                <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                  {paceSummary.avgSecPerQuestion}s / câu
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">Số câu gạch bỏ</div>
                <div className="text-base font-bold text-red-600 dark:text-red-400">
                  {paceSummary.totalEliminated} lượt
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">Điểm đúng sơ bộ</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {paceSummary.correctCount} / {paceSummary.totalCount}
                </div>
              </div>
            </div>

            {/* Chi tiết từng câu */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Phân bổ thời gian từng câu:
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar text-xs">
                {questions.map((q, idx) => {
                  const sec = timeSpentPerQuestion[q.id] || 0;
                  const isRight = answers[q.id] === q.correctIndex;
                  return (
                    <div
                      key={q.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Câu {idx + 1}
                        </span>
                        <span className="text-[10px] text-slate-400">({q.domain})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-600 dark:text-slate-400">{sec}s</span>
                        {isRight ? (
                          <span className="text-emerald-600 font-semibold">Đúng (+1)</span>
                        ) : (
                          <span className="text-red-500 font-semibold">Chưa đúng</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsSubmitted(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Xem lại bài thi
              </button>
              <button
                type="button"
                onClick={() => router.push('/exams')}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md"
              >
                Về danh mục đề thi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. INTEGRATED POPUPS: DESMOS & FORMULA SHEET                         */}
      {/* ==================================================================== */}
      <DesmosCalculator isOpen={isDesmosOpen} onClose={() => setIsDesmosOpen(false)} />
      <FormulaSheetModal isOpen={isFormulaOpen} onClose={() => setIsFormulaOpen(false)} />
    </div>
  );
}
