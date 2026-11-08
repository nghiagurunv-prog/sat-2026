'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { CorePracticeUI, PracticeQuestion } from '@/components/CorePracticeUI';
import { useToast } from '@/context/ToastContext';

// ==========================================
// POINT 18: MA TRẬN TỪ NỐI SAT (TRANSITIONS MATRIX)
// ==========================================
interface TransitionGroup {
  id: string;
  name: string;
  enName: string;
  color: string;
  border: string;
  badgeBg: string;
  textColor: string;
  description: string;
  words: string[];
  sampleSentence: string;
  satTrap: string;
}

const TRANSITION_GROUPS: TransitionGroup[] = [
  {
    id: 'contrast',
    name: 'Tương phản',
    enName: 'Contrast',
    color: 'from-rose-500/20 to-red-600/10',
    border: 'border-rose-500/40',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    textColor: 'text-rose-400',
    description: 'Chỉ sự đối lập, phản đề, đảo ngược chiều hướng hoặc giới hạn thông tin trước đó.',
    words: ['however', 'nevertheless', 'nonetheless', 'conversely', 'on the other hand', 'whereas', 'still', 'yet'],
    sampleSentence: 'The experimental battery demonstrated exceptional energy density; however, its production costs remain prohibitively high for mass deployment.',
    satTrap: 'Chú ý bẫy "conversely" (chỉ dùng khi đối xứng 2 chiều đảo chiều) khác với "however" (tương phản thông thường).'
  },
  {
    id: 'cause_effect',
    name: 'Nguyên nhân - Kết quả',
    enName: 'Cause & Effect',
    color: 'from-amber-500/20 to-orange-600/10',
    border: 'border-amber-500/40',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    textColor: 'text-amber-400',
    description: 'Câu sau là hệ quả tất yếu, kết luận logic hoặc diễn biến sinh ra từ mệnh đề trước.',
    words: ['therefore', 'consequently', 'thus', 'hence', 'accordingly', 'as a result'],
    sampleSentence: 'Global temperatures exceeded historic medians for six consecutive months; consequently, glacial melting rates surged by thirty percent.',
    satTrap: '"Therefore", "Consequently" và "As a result" có chức năng logic giống hệt nhau trong 99% câu SAT.'
  },
  {
    id: 'addition',
    name: 'Bổ sung / Tương đồng',
    enName: 'Addition / Continuation',
    color: 'from-teal-500/20 to-emerald-600/10',
    border: 'border-teal-500/40',
    badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    textColor: 'text-teal-400',
    description: 'Bổ sung dẫn chứng, mở rộng luận điểm cùng chiều hoặc đối chiếu tương đồng giữa 2 đối tượng.',
    words: ['furthermore', 'moreover', 'in addition', 'similarly', 'likewise'],
    sampleSentence: 'The new composite material significantly decreases fuselage weight; furthermore, its corrosion resistance doubles aircraft lifespan.',
    satTrap: '"Similarly / Likewise" đòi hỏi 2 thực thể so sánh phải có tính chất song song, không dùng bừa để bổ sung ý thông thường.'
  },
  {
    id: 'example',
    name: 'Ví dụ / Giải thích cụ thể',
    enName: 'Example / Emphasis',
    color: 'from-sky-500/20 to-blue-600/10',
    border: 'border-sky-500/40',
    badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    textColor: 'text-sky-400',
    description: 'Minh họa luận cứ bằng ví dụ cụ thể, nhấn mạnh một sự thật hoặc làm rõ khái niệm chung quát.',
    words: ['for instance', 'specifically', 'in fact', 'indeed', 'notably'],
    sampleSentence: 'Urban green corridors provide immense biodiversity benefits; for instance, pollinator populations inside city centers rebounded by 45%.',
    satTrap: '"In fact / Indeed" dùng khi câu sau mạnh mẽ hơn hoặc xác nhận củng cố điều câu trước vừa ngờ vực.'
  }
];

// ==========================================
// ĐỘNG CƠ HUẤN LUYỆN PHẢN XẠ 15 GIÂY (15-SECOND TWIN TRANSITION ELIMINATOR)
// ==========================================
interface EliminatorChoice {
  key: 'A' | 'B' | 'C' | 'D';
  word: string;
  group: string;
  isTwin: boolean;
}

interface EliminatorDrill {
  id: number;
  scenario: string;
  sentence: string;
  choices: EliminatorChoice[];
  twinKeys: ('A' | 'B' | 'C' | 'D')[];
  twinReason: string;
  bestChoice: 'A' | 'B' | 'C' | 'D';
  fullExplanation: string;
}

const ELIMINATOR_DRILLS: EliminatorDrill[] = [
  {
    id: 1,
    scenario: "Vật Liệu Hàng Không & Pin Năng Lượng Mới (Science)",
    sentence: "The silicon-perovskite tandem solar cell achieved an unprecedented 33% photon conversion efficiency in controlled laboratory tests; [______], commercial deployment remains hindered by high manufacturing costs and ambient moisture degradation.",
    choices: [
      { key: 'A', word: 'Therefore', group: 'Nguyên nhân - Kết quả (Cause & Effect)', isTwin: true },
      { key: 'B', word: 'Consequently', group: 'Nguyên nhân - Kết quả (Cause & Effect)', isTwin: true },
      { key: 'C', word: 'However', group: 'Tương phản (Contrast)', isTwin: false },
      { key: 'D', word: 'In addition', group: 'Bổ sung (Addition)', isTwin: false },
    ],
    twinKeys: ['A', 'B'],
    twinReason: '"Therefore" và "Consequently" đều biểu thị hệ quả tất yếu (Cause & Effect). Trong bài thi Digital SAT chỉ có 1 chỗ trống duy nhất, nếu 2 đáp án có chức năng logic giống hệt nhau thì BẮT BUỘC LOẠI CẢ HAI NGAY LẬP TỨC!',
    bestChoice: 'C',
    fullExplanation: 'Vế 1 nói về hiệu suất kỷ lục (tích cực), vế 2 nói về rào cản thương mại hóa (tiêu cực) ➔ Cần từ nối Tương phản đối lập. Sau khi loại A & B trong 5 giây, chỉ còn phân vân giữa C (However) và D (In addition) ➔ Chọn ngay C!'
  },
  {
    id: 2,
    scenario: "Kỹ Thuật Môi Trường & Bê Tông Sinh Học (Environmental Engineering)",
    sentence: "Traditional Portland cement curing emits substantial greenhouse gases throughout its hydration lifecycle. [______], the bio-cement formulation developed by environmental engineers absorbs atmospheric carbon dioxide during hardening.",
    choices: [
      { key: 'A', word: 'For instance', group: 'Ví dụ (Example)', isTwin: false },
      { key: 'B', word: 'In contrast', group: 'Tương phản (Contrast)', isTwin: false },
      { key: 'C', word: 'Furthermore', group: 'Bổ sung (Addition)', isTwin: true },
      { key: 'D', word: 'Moreover', group: 'Bổ sung (Addition)', isTwin: true },
    ],
    twinKeys: ['C', 'D'],
    twinReason: '"Furthermore" và "Moreover" cùng thuộc nhóm Bổ sung luận cứ (Addition/Continuation). Thí sinh đẳng cấp phát hiện cặp song sinh này trong 3 giây và gạch bỏ đồng loạt!',
    bestChoice: 'B',
    fullExplanation: 'Bê tông truyền thống xả khí thải vs. Bê tông sinh học hấp thụ CO2 ➔ Hai đối tượng đối lập trực diện về mặt tác động môi trường ➔ Chọn B ("In contrast").'
  },
  {
    id: 3,
    scenario: "Thiên Văn Học & Va Chạm Cụm Thiên Hà (Astrophysics)",
    sentence: "Astronomers discovered that galaxy cluster MACS J0717 contains four separate colliding sub-clusters. [______], deep radio telescope maps confirmed colossal shock waves rippling through intergalactic gas at millions of miles per hour.",
    choices: [
      { key: 'A', word: 'Conversely', group: 'Tương phản đảo chiều (Contrast)', isTwin: true },
      { key: 'B', word: 'On the other hand', group: 'Tương phản đảo chiều (Contrast)', isTwin: true },
      { key: 'C', word: 'In addition', group: 'Bổ sung (Addition)', isTwin: false },
      { key: 'D', word: 'Thus', group: 'Nguyên nhân - Kết quả (Cause & Effect)', isTwin: false },
    ],
    twinKeys: ['A', 'B'],
    twinReason: '"Conversely" và "On the other hand" đều chỉ sự đối lập đảo chiều 2 mặt (Direct Contrast). Chúng triệt tiêu lẫn nhau 100%, gạch bỏ cả A lẫn B!',
    bestChoice: 'C',
    fullExplanation: 'Câu thứ hai cung cấp thêm bằng chứng chấn động từ kính thiên văn vô tuyến để củng cố hiện tượng va chạm ở câu trước ➔ Quan hệ Bổ sung thông tin (Addition) ➔ Chọn C ("In addition").'
  },
  {
    id: 4,
    scenario: "Xử Lý Ngôn Ngữ Tự Nhiên & AI (Computer Science)",
    sentence: "The natural language processing model underwent extensive pre-training on millions of historical literary texts. [______], it encountered severe interpretive ambiguity when tasked with parsing contemporary slang and idiomatic expressions.",
    choices: [
      { key: 'A', word: 'As a result', group: 'Nguyên nhân - Kết quả (Cause & Effect)', isTwin: true },
      { key: 'B', word: 'Hence', group: 'Nguyên nhân - Kết quả (Cause & Effect)', isTwin: true },
      { key: 'C', word: 'Nevertheless', group: 'Tương phản nhượng bộ (Contrast)', isTwin: false },
      { key: 'D', word: 'Specifically', group: 'Cụ thể hóa (Example/Focus)', isTwin: false },
    ],
    twinKeys: ['A', 'B'],
    twinReason: '"As a result" và "Hence" đều là từ nối diễn tả hệ quả nhân - quả (Cause & Effect). Triệt hạ ngay cả đôi trong vòng 5 giây!',
    bestChoice: 'C',
    fullExplanation: 'Mô hình được huấn luyện đồ sộ nhưng lại gặp khó khăn bất ngờ trước tiếng lóng hiện đại ➔ Quan hệ Tương phản nhượng bộ (Concession) ➔ Chọn C ("Nevertheless").'
  },
  {
    id: 5,
    scenario: "Tàu Thăm Dò Khám Phá Sao Hỏa (Space Exploration)",
    sentence: "The autonomous exploration rover is equipped with multi-spectral cameras to identify surface mineral deposits. [______], its robotic arm carries an alpha-particle X-ray spectrometer for elemental rock composition analysis.",
    choices: [
      { key: 'A', word: 'That is to say', group: 'Diễn giải lại (Restatement)', isTwin: true },
      { key: 'B', word: 'In other words', group: 'Diễn giải lại (Restatement)', isTwin: true },
      { key: 'C', word: 'Similarly', group: 'Tương đồng / Song song (Similarity)', isTwin: false },
      { key: 'D', word: 'However', group: 'Tương phản (Contrast)', isTwin: false },
    ],
    twinKeys: ['A', 'B'],
    twinReason: '"That is to say" và "In other words" đều là từ nối giải thích diễn ngôn cùng một nghĩa (Restatement). Bị gạch tên ngay!',
    bestChoice: 'C',
    fullExplanation: 'Thân tàu có camera quan sát bề mặt; tương tự như vậy, cánh tay robot có máy quang phổ đo thành phần ➔ Hai thiết bị hoạt động song song với mục tiêu khoa học tương đồng ➔ Chọn C ("Similarly").'
  }
];

// ==========================================
// POINT 29: CẶP TỪ DỄ NHẦM LẪN (CONFUSABLE SAT WORDS)
// ==========================================
interface ConfusablePair {
  id: string;
  title: string;
  wordA: string;
  posA: string;
  meaningA: string;
  exampleA: string;
  wordB: string;
  posB: string;
  meaningB: string;
  exampleB: string;
  satTip: string;
}

const CONFUSABLE_PAIRS: ConfusablePair[] = [
  {
    id: 'affect-effect',
    title: 'Affect vs. Effect',
    wordA: 'affect',
    posA: 'Verb (động từ)',
    meaningA: 'Tác động trực tiếp, gây ảnh hưởng hoặc thay đổi lên đối tượng',
    exampleA: 'Rising ocean acidity adversely affects coral reef calcification.',
    wordB: 'effect',
    posB: 'Noun (danh từ / hiếm khi là Verb: tạo ra thay đổi lớn)',
    meaningB: 'Kết quả, tác động, hiệu ứng sinh ra từ một nguyên nhân',
    exampleB: 'The greenhouse effect has accelerated polar ice retreat.',
    satTip: 'Mẹo nhớ: RAVEN (Remember Affect is a Verb, Effect is a Noun). Nếu đứng sau "the/an/a", chắc chắn là EFFECT!'
  },
  {
    id: 'allude-elude',
    title: 'Allude vs. Elude',
    wordA: 'allude',
    posA: 'Verb (thường + to)',
    meaningA: 'Ám chỉ gián tiếp, nhắc khéo đến mà không gọi thẳng tên',
    exampleA: 'In his monologue, the playwright alluded to Shakespearean tragedies.',
    wordB: 'elude',
    posB: 'Verb',
    meaningB: 'Trốn thoát, né tránh / Vượt quá tầm hiểu biết hoặc trí nhớ',
    exampleB: 'The precise cellular mechanism of aging continues to elude biologists.',
    satTip: 'Allude = Ám chỉ (có "A"); Elude = Escape/Evade (trốn thoát, khó nắm bắt, có "E").'
  },
  {
    id: 'compliment-complement',
    title: 'Compliment vs. Complement',
    wordA: 'compliment',
    posA: 'Noun / Verb',
    meaningA: 'Lời khen ngợi, ca tụng, tán thưởng',
    exampleA: 'The curator complimented the restoration team on their surgical precision.',
    wordB: 'complement',
    posB: 'Noun / Verb',
    meaningB: 'Phần bổ sung hoàn hảo, kết hợp làm cho toàn vẹn',
    exampleB: 'Qualitative interviews complement the statistical survey data ideally.',
    satTip: 'ComplIment có chữ "I" = "I like praise" (thích được khen); ComplEment có chữ "E" = "Complete" (bổ sung cho đủ).'
  },
  {
    id: 'disinterested-uninterested',
    title: 'Disinterested vs. Uninterested',
    wordA: 'disinterested',
    posA: 'Adjective',
    meaningA: 'Khách quan, chí công vô tư, không có lợi ích cá nhân thiên vị (BẪY CỰC NÓNG SAT!)',
    exampleA: 'Arbitration requires a completely disinterested judge with no financial stake.',
    wordB: 'uninterested',
    posB: 'Adjective',
    meaningB: 'Thờ ơ, lãnh đạm, chán nản, không có hứng thú',
    exampleB: 'The board members were uninterested in expanding into volatile overseas markets.',
    satTip: 'Đừng dịch "disinterested" là không quan tâm! SAT rất hay dùng "disinterested researcher/observer" với nghĩa khách quan khoa học.'
  },
  {
    id: 'ingenious-ingenuous',
    title: 'Ingenious vs. Ingenuous',
    wordA: 'ingenious',
    posA: 'Adjective',
    meaningA: 'Tài tình, thông minh, phát minh khéo léo xuất chúng',
    exampleA: 'The rover utilized an ingenious suspension system to traverse Mars dunes.',
    wordB: 'ingenuous',
    posB: 'Adjective',
    meaningB: 'Chân thật, ngây thơ, mộc mạc, không mưu mô (dễ bị lừa)',
    exampleB: 'Her ingenuous answers revealed an innocent unawareness of political rivalry.',
    satTip: 'IngenIous có chữ "I" = Intelligent (thông minh); IngenUous có chữ "U" = Unsuspecting (ngây thơ).'
  },
  {
    id: 'elicit-illicit',
    title: 'Elicit vs. Illicit',
    wordA: 'elicit',
    posA: 'Verb (động từ)',
    meaningA: 'Gợi ra phản ứng, khơi mở thông tin hoặc cảm xúc từ ai đó',
    exampleA: 'The defense attorney sought to elicit a confession during cross-examination.',
    wordB: 'illicit',
    posB: 'Adjective (tính từ)',
    meaningB: 'Bất hợp pháp, phi pháp, bị cấm đoán theo luật hoặc luân lý',
    exampleB: 'Customs agents intercepted an illicit shipment of endangered timber.',
    satTip: 'Elicit bắt đầu bằng "E" = Extract (rút ra thông tin); Illicit bắt đầu bằng "IL" = Illegal (bất hợp pháp).'
  },
  {
    id: 'prescribe-proscribe',
    title: 'Prescribe vs. Proscribe',
    wordA: 'prescribe',
    posA: 'Verb (động từ)',
    meaningA: 'Kê đơn thuốc / Quy định, ban hành hướng dẫn bắt buộc thực thi',
    exampleA: 'Building codes prescribe seismic retrofitting for old brick structures.',
    wordB: 'proscribe',
    posB: 'Verb (động từ)',
    meaningB: 'Cấm đoán, bài trừ, đặt ra ngoài vòng pháp luật',
    exampleB: 'The school board voted to proscribe personal phone usage during exams.',
    satTip: 'Prescribe = Cho phép/Quy định (như bác sĩ kê đơn); Proscribe = Prohibit (cấm đoán triệt để).'
  }
];

export default function VocabularyPage() {
  const { showToast } = useToast();
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [questionData, setQuestionData] = useState<PracticeQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const prefetchedRef = useRef<{ topic: string; promise: Promise<PracticeQuestion | null> } | null>(null);

  // Sub-tabs navigation
  const [activeTab, setActiveTab] = useState<'practice' | 'transitions' | 'confusables'>('practice');
  const [transitionFilter, setTransitionFilter] = useState<string>('all');
  const [confusableSearch, setConfusableSearch] = useState<string>('');

  // Transitions Sub-View: 'drill' (15s Eliminator Drill) vs 'matrix' (Bảng ma trận & Cheat-sheet)
  const [transitionSubMode, setTransitionSubMode] = useState<'drill' | 'matrix'>('drill');

  // Động cơ Huấn luyện Phản xạ 15s (Twin Eliminator State)
  const [drillIndex, setDrillIndex] = useState(0);
  const [drillTimeRemaining, setDrillTimeRemaining] = useState<number>(15.0);
  const [selectedTwinKeys, setSelectedTwinKeys] = useState<('A' | 'B' | 'C' | 'D')[]>([]);
  const [isTwinEliminated, setIsTwinEliminated] = useState(false);
  const [pickedFinalChoice, setPickedFinalChoice] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [eliminationSpeedSec, setEliminationSpeedSec] = useState<number | null>(null);
  const [drillStreak, setDrillStreak] = useState(0);

  const currentDrill = ELIMINATOR_DRILLS[drillIndex];

  // Timer 15s đếm ngược cho vòng drill
  useEffect(() => {
    if (activeTab !== 'transitions' || transitionSubMode !== 'drill') return;
    if (isTwinEliminated || pickedFinalChoice) return;

    const interval = setInterval(() => {
      setDrillTimeRemaining(prev => {
        if (prev <= 0.1) {
          clearInterval(interval);
          return 0;
        }
        return Math.round((prev - 0.1) * 10) / 10;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeTab, transitionSubMode, drillIndex, isTwinEliminated, pickedFinalChoice]);

  // Reset drill state khi chuyển câu
  const loadDrillQuestion = (index: number) => {
    setDrillIndex(index);
    setDrillTimeRemaining(15.0);
    setSelectedTwinKeys([]);
    setIsTwinEliminated(false);
    setPickedFinalChoice(null);
    setEliminationSpeedSec(null);
  };

  // Kích hoạt loại bỏ đôi từ nối đồng nghĩa
  const triggerEliminateTwins = () => {
    if (isTwinEliminated) return;
    const speed = Math.max(0.6, Math.round((15.0 - drillTimeRemaining) * 10) / 10);
    setSelectedTwinKeys(currentDrill.twinKeys);
    setIsTwinEliminated(true);
    setEliminationSpeedSec(speed);
    showToast(`⚡ Xuất sắc! Đã triệt hạ cặp đồng nghĩa [${currentDrill.twinKeys.join(' & ')}] trong ${speed}s!`, 'success');
  };

  // Người dùng tự bấm chọn 2 đáp án để test phản xạ
  const handleToggleChoiceForElimination = (choiceKey: 'A' | 'B' | 'C' | 'D') => {
    if (isTwinEliminated) {
      // Khi đã loại đôi đồng nghĩa, click vào đáp án còn lại để chọn đáp án đúng
      if (currentDrill.twinKeys.includes(choiceKey)) return;
      setPickedFinalChoice(choiceKey);
      if (choiceKey === currentDrill.bestChoice) {
        setDrillStreak(prev => prev + 1);
        showToast("🎉 CHÍNH XÁC! Bạn đã làm chủ câu hỏi Transitions trong nháy mắt!", 'success');
      } else {
        showToast("Chưa đúng! Hãy đọc kỹ lại mối liên hệ logic giữa 2 câu.", 'error');
      }
      return;
    }

    if (selectedTwinKeys.includes(choiceKey)) {
      setSelectedTwinKeys(selectedTwinKeys.filter(k => k !== choiceKey));
      return;
    }

    const nextSelected = [...selectedTwinKeys, choiceKey];
    setSelectedTwinKeys(nextSelected);

    if (nextSelected.length === 2) {
      // Kiểm tra 2 đáp án vừa chọn có phải là cặp song sinh
      const isMatch =
        (nextSelected[0] === currentDrill.twinKeys[0] && nextSelected[1] === currentDrill.twinKeys[1]) ||
        (nextSelected[0] === currentDrill.twinKeys[1] && nextSelected[1] === currentDrill.twinKeys[0]);

      if (isMatch) {
        const speed = Math.max(0.6, Math.round((15.0 - drillTimeRemaining) * 10) / 10);
        setIsTwinEliminated(true);
        setEliminationSpeedSec(speed);
        showToast(`🎯 CHÍNH XÁC! Đã loại 2 từ nối đồng chức năng trong ${speed}s!`, 'success');
      } else {
        showToast("⚠️ Chưa chính xác! Hai từ này không đồng nhất chức năng logic. Hãy chọn lại!", 'info');
        setSelectedTwinKeys([]);
      }
    }
  };

  const categories = [
    { name: "Words in Context", desc: "Điền từ vựng cao cấp vào chỗ trống phù hợp ngữ cảnh đoạn văn SAT." },
    { name: "Transitions", desc: "Từ nối (However, Therefore, Conversely...) trong logic mạch lạc đoạn văn." },
    { name: "Idioms & Phrasal Verbs", desc: "Các cụm từ đặc dụng và thành ngữ học thuật thường xuất hiện trong SAT." }
  ];

  const fetchQuestion = async (topic: string): Promise<PracticeQuestion | null> => {
    try {
      const res = await fetch('/api/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleType: 'vocab', topic })
      });
      if (res.ok) return await res.json();
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const prefetchNext = (topic: string) => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = { topic, promise: fetchQuestion(topic) };
  };

  const handleGenerateQuestion = async (topic: string) => {
    setCurrentTopic(topic);
    setIsLoading(true);
    setQuestionData(null);
    setLoadError(false);

    const prefetched = prefetchedRef.current;
    prefetchedRef.current = null;
    const data = prefetched && prefetched.topic === topic
      ? await prefetched.promise
      : await fetchQuestion(topic);

    if (data) {
      setQuestionData(data);
    } else {
      setLoadError(true);
      showToast("Lỗi khi sinh câu hỏi. Vui lòng thử lại.", 'error');
    }
    setIsLoading(false);
  };

  const filteredConfusables = CONFUSABLE_PAIRS.filter(pair => {
    const q = confusableSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      pair.title.toLowerCase().includes(q) ||
      pair.wordA.toLowerCase().includes(q) ||
      pair.wordB.toLowerCase().includes(q) ||
      pair.meaningA.toLowerCase().includes(q) ||
      pair.meaningB.toLowerCase().includes(q) ||
      pair.satTip.toLowerCase().includes(q)
    );
  });

  const filteredTransitions = transitionFilter === 'all'
    ? TRANSITION_GROUPS
    : TRANSITION_GROUPS.filter(g => g.id === transitionFilter);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">
      {/* ========================================== */}
      {/* THANH LIÊN THÔNG 3 CHIỀU TỪ VỰNG & ĐỌC HIỂU */}
      {/* ========================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#0e1117] border border-[#262730] rounded-2xl shadow-md">
        <div className="flex items-center gap-2 text-xs font-bold text-teal-400">
          <span>⚡</span>
          <span className="uppercase tracking-wider">Hệ Thống Liên Thông 3 Chiều Từ Vựng & Đọc Hiểu:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/vocabulary"
            className="px-3.5 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/50 text-xs font-black flex items-center gap-1.5 shadow-[0_0_10px_rgba(20,184,166,0.2)]"
          >
            <span>🔗</span> Từ Nối & Ngữ Cảnh (/vocabulary)
          </Link>
          <Link
            href="/vocab"
            className="px-3.5 py-1.5 rounded-xl bg-[#1b2533] hover:bg-emerald-500/20 text-gray-300 hover:text-emerald-300 border border-[#262730] hover:border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <span>🗂️</span> Flashcard Leitner SRS (/vocab)
          </Link>
          <Link
            href="/reading"
            className="px-3.5 py-1.5 rounded-xl bg-[#1b2533] hover:bg-sky-500/20 text-gray-300 hover:text-sky-300 border border-[#262730] hover:border-sky-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <span>📖</span> Đọc Hiểu & Syntax X-Ray (/reading)
          </Link>
          <Link
            href="/literature"
            className="px-3.5 py-1.5 rounded-xl bg-[#1b2533] hover:bg-amber-500/20 text-gray-300 hover:text-amber-300 border border-[#262730] hover:border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <span>📜</span> Giải Mã Đọc Hiểu (/literature)
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #0f766e 0%, #042f2e 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">📚</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #2dd4bf, #14b8a6)", WebkitBackgroundClip: "text" }}>
              LÀM CHỦ TỪ VỰNG & TỪ NỐI SAT
            </h1>
            <p className="math-subtitle text-teal-200">
              Động cơ huấn luyện phản xạ 15s loại trừ đôi từ nối đồng nghĩa & ma trận logic chuyên sâu Digital SAT.
            </p>
          </div>
        </div>
      </div>

      {!currentTopic ? (
        <>
          {/* Navigation Sub-Tabs */}
          <div className="flex flex-wrap items-center gap-3 p-1.5 bg-[#0e1117] border border-[#262730] rounded-2xl">
            <button
              onClick={() => setActiveTab('practice')}
              className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                activeTab === 'practice'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-[0_0_15px_rgba(20,184,166,0.4)]'
                  : 'text-gray-400 hover:text-white hover:bg-[#1b2533]'
              }`}
            >
              <span>🎯</span> Luyện Đề Theo Chủ Đề
            </button>
            <button
              onClick={() => setActiveTab('transitions')}
              className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                activeTab === 'transitions'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-[0_0_15px_rgba(20,184,166,0.4)]'
                  : 'text-gray-400 hover:text-white hover:bg-[#1b2533]'
              }`}
            >
              <span>🔗</span> Động Cơ Loại Trừ Đôi Từ Nối (15s Eliminator)
            </button>
            <button
              onClick={() => setActiveTab('confusables')}
              className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                activeTab === 'confusables'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-[0_0_15px_rgba(20,184,166,0.4)]'
                  : 'text-gray-400 hover:text-white hover:bg-[#1b2533]'
              }`}
            >
              <span>⚠️</span> Cặp Từ Dễ Nhầm (Confusable Words)
            </button>
          </div>

          {/* TAB 1: PRACTICE OVERVIEW */}
          {activeTab === 'practice' && (
            <div className="space-y-6">
              <div className="bg-[#1b2533] border border-[#14b8a6] rounded-xl p-6 shadow-[0_0_15px_rgba(20,184,166,0.1)]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#2dd4bf]">Lựa Chọn Chủ Đề Vocab</h2>
                    <p className="text-[#e2e8f0] text-sm mt-1">Luyện tập khả năng phán đoán từ vựng dựa trên ngữ cảnh với hàng ngàn câu hỏi động:</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('transitions')}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 transition-colors"
                    >
                      🔗 Luyện Đôi Từ Nối 15s
                    </button>
                    <button
                      onClick={() => setActiveTab('confusables')}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                    >
                      ⚠️ Cặp từ dễ nhầm
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {categories.map((cat, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handleGenerateQuestion(cat.name)}
                      className="bg-[#0e1117] border border-[#262730] p-6 rounded-xl hover:border-[#14b8a6] hover:shadow-[0_0_15px_rgba(20,184,166,0.25)] cursor-pointer transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-xl mb-3 text-teal-400 group-hover:scale-110 transition-transform">
                          {idx === 0 ? '📖' : idx === 1 ? '🔗' : '💡'}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#2dd4bf]">{cat.name}</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">{cat.desc}</p>
                      </div>
                      <div className="mt-5 pt-3 border-t border-[#262730] flex items-center justify-between text-xs font-medium text-teal-400">
                        <span>Bắt đầu luyện tập</span>
                        <span className="group-hover:translate-x-1 transition-transform">➔</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Peek Banners */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => setActiveTab('transitions')}
                  className="bg-gradient-to-r from-teal-950/60 to-[#1b2533] p-5 rounded-xl border border-teal-500/30 hover:border-teal-400 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🔗</span>
                    <div>
                      <h4 className="font-bold text-teal-300">Động cơ Phản Xạ 15s Loại Trừ Đôi Từ Nối (Point 18)</h4>
                      <p className="text-xs text-gray-300 mt-0.5">Therefore = Consequently? Loại ngay cả hai trong 5 giây để nâng tỷ lệ đúng lên 50%!</p>
                    </div>
                  </div>
                </div>

                <div 
                  onClick={() => setActiveTab('confusables')}
                  className="bg-gradient-to-r from-amber-950/60 to-[#1b2533] p-5 rounded-xl border border-amber-500/30 hover:border-amber-400 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">⚠️</span>
                    <div>
                      <h4 className="font-bold text-amber-300">Cặp từ Dễ Nhầm Lẫn (Point 29)</h4>
                      <p className="text-xs text-gray-300 mt-0.5">Affect/Effect, Allude/Elude, Disinterested/Uninterested...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: POINT 18 - 15-SECOND TWIN TRANSITION ELIMINATOR ENGINE */}
          {activeTab === 'transitions' && (
            <div className="space-y-6">
              {/* SAT Golden Tip Alert */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border-2 border-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.15)] flex items-start gap-4">
                <div className="text-3xl select-none">👑</div>
                <div className="space-y-1">
                  <h4 className="text-base font-black text-amber-300 uppercase tracking-wide">
                    Quy Tắc Vàng SAT: Loại Trừ Đôi Từ Nối Đồng Nghĩa (15-Second Twin Eliminator)
                  </h4>
                  <p className="text-sm text-amber-100 font-semibold leading-relaxed">
                    &quot;Nếu trong 4 phương án xuất hiện 2 từ nối cùng 1 nhóm logic (VD: <code className="bg-amber-900/40 text-amber-200 px-1.5 py-0.5 rounded border border-amber-400/30">Therefore</code> và <code className="bg-amber-900/40 text-amber-200 px-1.5 py-0.5 rounded border border-amber-400/30">Consequently</code>), <span className="text-yellow-300 underline font-black">hãy loại cả hai trong 5 giây!</span> Tiếng Anh chuẩn mực không thể có 2 đáp án cùng đúng cho 1 chỗ trống.&quot;
                  </p>
                </div>
              </div>

              {/* Switch Sub-Mode: Drill Mode vs Full Matrix */}
              <div className="flex items-center justify-between border-b border-[#262730] pb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTransitionSubMode('drill')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                      transitionSubMode === 'drill'
                        ? 'bg-teal-500 text-black shadow-md'
                        : 'bg-[#1b2533] text-gray-300 hover:text-white border border-[#262730]'
                    }`}
                  >
                    <span>⚡</span> Phòng Huấn Luyện Phản Xạ 15 Giây (Twin Drill)
                  </button>
                  <button
                    onClick={() => setTransitionSubMode('matrix')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                      transitionSubMode === 'matrix'
                        ? 'bg-teal-500 text-black shadow-md'
                        : 'bg-[#1b2533] text-gray-300 hover:text-white border border-[#262730]'
                    }`}
                  >
                    <span>📚</span> Ma Trận 4 Nhóm & Bảng Tra Cứu (Full Matrix)
                  </button>
                </div>

                {transitionSubMode === 'drill' && (
                  <div className="text-xs font-mono text-gray-400 hidden sm:block">
                    Chuỗi phản xạ chuẩn: <strong className="text-teal-300 font-bold">{drillStreak}</strong> câu
                  </div>
                )}
              </div>

              {/* ========================================== */}
              {/* SUB-VIEW 1: PHÒNG HUẤN LUYỆN PHẢN XẠ 15 GIÂY */}
              {/* ========================================== */}
              {transitionSubMode === 'drill' && (
                <div className="space-y-6">
                  {/* Drill Card */}
                  <div className="bg-[#1b2533] border-2 border-teal-500/40 rounded-2xl p-6 shadow-2xl space-y-6">
                    {/* Drill Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262730] pb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono font-bold">
                            Câu {drillIndex + 1} / {ELIMINATOR_DRILLS.length}
                          </span>
                          <span className="text-xs text-gray-400">
                            {currentDrill.scenario}
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-white">
                          Nhiệm Vụ: Xác định & Gạch tên 2 đáp án song sinh trong vòng 15 giây!
                        </h3>
                      </div>

                      {/* 15s Countdown Timer */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[11px] text-gray-400 block uppercase">Đồng hồ phản xạ:</span>
                          <span className={`text-2xl font-black font-mono ${
                            drillTimeRemaining <= 5
                              ? 'text-rose-400 animate-pulse'
                              : drillTimeRemaining <= 10
                              ? 'text-amber-300'
                              : 'text-teal-300'
                          }`}>
                            {drillTimeRemaining.toFixed(1)}s
                          </span>
                        </div>

                        {/* Quick Eliminate Button */}
                        <button
                          onClick={triggerEliminateTwins}
                          disabled={isTwinEliminated}
                          className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-1.5 ${
                            isTwinEliminated
                              ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                              : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:scale-105 active:scale-95'
                          }`}
                        >
                          <span>✂️</span> Bấm Loại Đôi Song Sinh Ngay
                        </button>
                      </div>
                    </div>

                    {/* Câu Đề Bài Chuẩn SAT */}
                    <div className="p-4 rounded-xl bg-[#0e1117] border border-[#262730] text-sm text-gray-200 leading-relaxed font-serif">
                      {currentDrill.sentence.split('[______]').map((part, i, arr) => (
                        <span key={i}>
                          {part}
                          {i < arr.length - 1 && (
                            <span className="inline-block px-3 py-0.5 mx-1.5 rounded-lg bg-teal-950/80 text-teal-300 border border-teal-500/50 font-sans font-bold text-xs">
                              {isTwinEliminated ? (pickedFinalChoice ? currentDrill.choices.find(c => c.key === pickedFinalChoice)?.word : '[ Chọn đáp án còn lại ]') : '[ ? Chỗ trống ? ]'}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Step Instruction Indicator */}
                    <div className="flex items-center justify-between text-xs">
                      {!isTwinEliminated ? (
                        <span className="text-amber-300 font-bold flex items-center gap-1.5">
                          <span>👉</span> BƯỚC 1: Chọn hoặc bấm nút loại bỏ 2 đáp án mang cùng ý nghĩa logic ({currentDrill.twinKeys.length}/2):
                        </span>
                      ) : !pickedFinalChoice ? (
                        <span className="text-teal-300 font-bold flex items-center gap-1.5 animate-pulse">
                          <span>🎯</span> BƯỚC 2: Xuất sắc! Giờ hãy bấm chọn đáp án đúng trong 2 phương án còn lại:
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                          <span>✅</span> HOÀN THÀNH VÒNG PHẢN XẠ! Xem phân tích giải thích bên dưới:
                        </span>
                      )}

                      {eliminationSpeedSec && (
                        <span className="font-mono text-xs text-amber-200">
                          ⚡ Tốc độ diệt cặp đôi: <strong>{eliminationSpeedSec}s</strong>
                        </span>
                      )}
                    </div>

                    {/* 4 Lựa chọn A, B, C, D */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {currentDrill.choices.map(choice => {
                        const isTwin = currentDrill.twinKeys.includes(choice.key);
                        const isSelectedAsTwin = selectedTwinKeys.includes(choice.key);
                        const isEliminated = isTwinEliminated && isTwin;
                        const isChosenFinal = pickedFinalChoice === choice.key;
                        const isCorrectFinal = choice.key === currentDrill.bestChoice;

                        return (
                          <div
                            key={choice.key}
                            onClick={() => handleToggleChoiceForElimination(choice.key)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                              isEliminated
                                ? 'bg-rose-950/15 border-rose-900/50 opacity-40 line-through'
                                : isChosenFinal
                                ? isCorrectFinal
                                  ? 'bg-emerald-950/40 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                                  : 'bg-rose-950/40 border-rose-500'
                                : isSelectedAsTwin
                                ? 'bg-amber-500/20 border-amber-400 shadow-md'
                                : isTwinEliminated && !isTwin
                                ? 'bg-[#0e1117] border-teal-400/80 hover:bg-teal-950/30 ring-1 ring-teal-500/50'
                                : 'bg-[#0e1117] border-[#262730] hover:border-teal-500/40'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  isEliminated
                                    ? 'bg-rose-900/40 text-rose-400'
                                    : isChosenFinal && isCorrectFinal
                                    ? 'bg-emerald-500 text-black'
                                    : 'bg-[#1b2533] text-white border border-[#262730]'
                                }`}>
                                  {choice.key}
                                </span>
                                <span className={`text-base font-bold ${
                                  isEliminated ? 'text-gray-500' : 'text-white'
                                }`}>
                                  {choice.word}
                                </span>
                              </div>

                              {isEliminated && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                                  ĐÃ LOẠI BỎ ✖
                                </span>
                              )}
                              {!isTwinEliminated && isSelectedAsTwin && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                                  ĐÃ CHỌN
                                </span>
                              )}
                            </div>

                            <div className="mt-2 text-[11px] text-gray-400 flex items-center justify-between">
                              <span className="truncate">{choice.group}</span>
                              {isTwinEliminated && !isTwin && !pickedFinalChoice && (
                                <span className="text-teal-400 font-bold text-[10px]">Bấm chọn ➔</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Giải Thích Cặp Đôi Đồng Nghĩa & Đáp Án */}
                    {isTwinEliminated && (
                      <div className="p-4 rounded-xl bg-[#0e1117] border border-amber-500/40 text-xs space-y-3 animate-in fade-in">
                        <div className="flex items-start gap-2 text-amber-300">
                          <span className="text-base">💡</span>
                          <div>
                            <strong className="block text-amber-200 uppercase tracking-wide">
                              Vì sao loại cặp đôi [{currentDrill.twinKeys.join(' & ')}]:
                            </strong>
                            <p className="text-gray-300 leading-relaxed mt-0.5">
                              {currentDrill.twinReason}
                            </p>
                          </div>
                        </div>

                        {pickedFinalChoice && (
                          <div className="pt-3 border-t border-[#262730] flex items-start gap-2 text-emerald-300">
                            <span className="text-base">🎯</span>
                            <div>
                              <strong className="block text-emerald-200 uppercase tracking-wide">
                                Phân tích đáp án chuẩn ({currentDrill.bestChoice}):
                              </strong>
                              <p className="text-gray-300 leading-relaxed mt-0.5">
                                {currentDrill.fullExplanation}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Next Question Navigation */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#262730]">
                      <button
                        onClick={() => loadDrillQuestion((drillIndex - 1 + ELIMINATOR_DRILLS.length) % ELIMINATOR_DRILLS.length)}
                        className="px-4 py-2 rounded-lg bg-[#0e1117] text-gray-400 hover:text-white text-xs font-bold border border-[#262730]"
                      >
                        ⬅️ Câu trước
                      </button>

                      <div className="flex items-center gap-2">
                        {ELIMINATOR_DRILLS.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => loadDrillQuestion(idx)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                              idx === drillIndex
                                ? 'bg-teal-500 text-black shadow-md'
                                : 'bg-[#0e1117] text-gray-400 hover:text-white border border-[#262730]'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => loadDrillQuestion((drillIndex + 1) % ELIMINATOR_DRILLS.length)}
                        className="px-4 py-2 rounded-lg bg-teal-500 text-black font-bold text-xs shadow-md hover:scale-105 transition-transform"
                      >
                        Câu tiếp theo ➔
                      </button>
                    </div>
                  </div>

                  {/* BẢNG TRA CỨU NHANH CẶP ĐÔI SONG SINH TỬ THẦN */}
                  <div className="bg-[#1b2533] border border-[#262730] rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-black text-amber-300 flex items-center gap-2">
                        <span>☠️</span> Bảng Tra Cứu &quot;Cặp Đôi Song Sinh Tử Thần&quot; Thường Gặp Trong SAT
                      </h4>
                      <span className="text-xs text-gray-400 font-mono">Bảo chứng 100% triệt tiêu</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-[#0e1117] border border-amber-500/20">
                        <span className="font-bold text-amber-400 block mb-1">1. Đôi Hệ Quả (Cause & Effect):</span>
                        <code className="text-white block font-mono bg-[#1b2533] p-1.5 rounded mb-1">
                          Therefore ⟷ Consequently ⟷ Thus ⟷ As a result
                        </code>
                        <p className="text-gray-400 text-[11px]">Nếu 2 từ này cùng xuất hiện ở các đáp án ➔ Loại bỏ cả 2 ngay lập tức!</p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#0e1117] border border-teal-500/20">
                        <span className="font-bold text-teal-400 block mb-1">2. Đôi Bổ Sung Ý (Addition):</span>
                        <code className="text-white block font-mono bg-[#1b2533] p-1.5 rounded mb-1">
                          Furthermore ⟷ Moreover ⟷ In addition
                        </code>
                        <p className="text-gray-400 text-[11px]">Cùng dùng để bổ sung một ý tương đương ➔ Triệt tiêu lẫn nhau.</p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#0e1117] border border-rose-500/20">
                        <span className="font-bold text-rose-400 block mb-1">3. Đôi Nhượng Bộ (Concession/Contrast):</span>
                        <code className="text-white block font-mono bg-[#1b2533] p-1.5 rounded mb-1">
                          However ⟷ Nevertheless ⟷ Nonetheless ⟷ Still
                        </code>
                        <p className="text-gray-400 text-[11px]">Cùng biểu đạt ý tương phản nhượng bộ thông thường.</p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#0e1117] border border-purple-500/20">
                        <span className="font-bold text-purple-400 block mb-1">4. Đôi Diễn Giải Lại (Restatement):</span>
                        <code className="text-white block font-mono bg-[#1b2533] p-1.5 rounded mb-1">
                          In other words ⟷ That is to say
                        </code>
                        <p className="text-gray-400 text-[11px]">Cùng dùng để diễn giải lại mệnh đề trước bằng ngôn từ khác.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================== */}
              {/* SUB-VIEW 2: FULL TRANSITIONS MATRIX */}
              {/* ========================================== */}
              {transitionSubMode === 'matrix' && (
                <div className="space-y-6">
                  {/* Filter pills */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Lọc nhóm logic:</span>
                    <button
                      onClick={() => setTransitionFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        transitionFilter === 'all'
                          ? 'bg-teal-500 text-black'
                          : 'bg-[#1b2533] text-gray-300 hover:text-white border border-[#262730]'
                      }`}
                    >
                      Tất cả (4 nhóm)
                    </button>
                    {TRANSITION_GROUPS.map(g => (
                      <button
                        key={g.id}
                        onClick={() => setTransitionFilter(g.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          transitionFilter === g.id
                            ? 'bg-teal-500 text-black'
                            : 'bg-[#1b2533] text-gray-300 hover:text-white border border-[#262730]'
                        }`}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>

                  {/* 4 Transition Group Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredTransitions.map(group => (
                      <div
                        key={group.id}
                        className={`rounded-2xl p-6 bg-gradient-to-br ${group.color} border ${group.border} shadow-xl flex flex-col justify-between`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className={`text-xs font-extrabold uppercase px-2.5 py-1 rounded-md border ${group.badgeBg}`}>
                              {group.enName}
                            </span>
                            <span className="text-xs text-gray-400 font-mono">{group.words.length} từ tiêu biểu</span>
                          </div>

                          <h3 className={`text-2xl font-black mb-2 ${group.textColor}`}>{group.name}</h3>
                          <p className="text-gray-300 text-sm mb-4 leading-relaxed">{group.description}</p>

                          {/* Words Pill Badges */}
                          <div className="mb-4">
                            <span className="text-xs font-bold text-gray-400 block mb-2 uppercase tracking-wide">Các từ khóa hay thi:</span>
                            <div className="flex flex-wrap gap-2">
                              {group.words.map((w, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#0e1117]/80 text-white border border-[#262730] shadow-sm hover:border-teal-400 transition-colors"
                                >
                                  {w}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Example sentence */}
                          <div className="p-3.5 rounded-xl bg-[#0e1117]/90 border border-[#262730] mb-3">
                            <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider block mb-1">Ví dụ chuẩn SAT:</span>
                            <p className="text-xs text-gray-200 italic leading-relaxed">&quot;{group.sampleSentence}&quot;</p>
                          </div>
                        </div>

                        {/* SAT Trap alert */}
                        <div className="pt-3 border-t border-white/10 flex items-start gap-2 text-xs text-amber-200">
                          <span className="text-amber-400 font-bold">⚠️ Bẫy SAT:</span>
                          <span>{group.satTrap}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  <div className="text-center pt-4">
                    <button
                      onClick={() => handleGenerateQuestion('Transitions')}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold text-sm shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:scale-105 transition-transform"
                    >
                      🚀 Luyện tập Câu hỏi Transitions thực tế ngay
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: POINT 29 - CONFUSABLE WORDS */}
          {activeTab === 'confusables' && (
            <div className="space-y-6">
              <div className="bg-[#1b2533] p-6 rounded-2xl border border-amber-500/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-amber-300">Cảnh Báo Cặp Từ Dễ Nhầm Lẫn (Confusable SAT Words)</h2>
                    <p className="text-sm text-gray-300 mt-1">
                      7 cặp từ học sinh Việt Nam dễ đánh mất điểm oan uổng nhất trong phân mục <em>Words in Context</em>:
                    </p>
                  </div>
                  {/* Search box */}
                  <div className="w-full md:w-72">
                    <input
                      type="text"
                      value={confusableSearch}
                      onChange={(e) => setConfusableSearch(e.target.value)}
                      placeholder="🔍 Tìm nhanh (VD: affect, elicit)..."
                      className="w-full px-3.5 py-2 rounded-xl bg-[#0e1117] border border-[#262730] text-sm text-white focus:outline-none focus:border-amber-400 placeholder:text-gray-500"
                    />
                  </div>
                </div>
              </div>

              {/* Cards List */}
              <div className="grid grid-cols-1 gap-6">
                {filteredConfusables.map(pair => (
                  <div
                    key={pair.id}
                    className="bg-[#1b2533] border border-[#262730] hover:border-amber-500/40 rounded-2xl p-6 transition-all shadow-lg"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262730] pb-3 mb-4">
                      <h3 className="text-xl font-black text-white flex items-center gap-2">
                        <span className="text-amber-400">⚡</span> {pair.title}
                      </h3>
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        Words in Context Alert
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Word A */}
                      <div className="p-4 rounded-xl bg-[#0e1117] border border-teal-500/20">
                        <div className="flex items-baseline justify-between mb-2">
                          <span className="text-2xl font-black text-teal-300">{pair.wordA}</span>
                          <span className="text-xs text-gray-400 font-mono italic">{pair.posA}</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium mb-3">{pair.meaningA}</p>
                        <div className="text-xs text-teal-200/90 italic bg-teal-950/40 p-2.5 rounded-lg border border-teal-800/30">
                          &quot;{pair.exampleA}&quot;
                        </div>
                      </div>

                      {/* Word B */}
                      <div className="p-4 rounded-xl bg-[#0e1117] border border-rose-500/20">
                        <div className="flex items-baseline justify-between mb-2">
                          <span className="text-2xl font-black text-rose-300">{pair.wordB}</span>
                          <span className="text-xs text-gray-400 font-mono italic">{pair.posB}</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium mb-3">{pair.meaningB}</p>
                        <div className="text-xs text-rose-200/90 italic bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/30">
                          &quot;{pair.exampleB}&quot;
                        </div>
                      </div>
                    </div>

                    {/* SAT Tip Box */}
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                      <span className="text-amber-400 text-base">💡</span>
                      <p className="text-xs text-amber-100 font-medium leading-relaxed">
                        <strong className="text-amber-300">Bí kíp phân biệt: </strong>
                        {pair.satTip}
                      </p>
                    </div>
                  </div>
                ))}

                {filteredConfusables.length === 0 && (
                  <div className="p-8 text-center text-gray-400 bg-[#1b2533] rounded-2xl border border-[#262730]">
                    Không tìm thấy cặp từ phù hợp với từ khóa &quot;{confusableSearch}&quot;.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        /* PRACTICE SESSION WITH BACK BUTTON */
        <>
          <div className="flex justify-between items-center bg-[#1b2533] p-4 rounded-xl border border-[#262730]">
            <div>
              <span className="text-gray-400 text-sm">Chủ đề hiện tại:</span>
              <h2 className="text-xl font-bold text-[#2dd4bf]">{currentTopic}</h2>
            </div>
            <button 
              onClick={() => { setCurrentTopic(null); setQuestionData(null); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
            >
              ⬅️ Quay lại danh mục
            </button>
          </div>
          
          {(isLoading || questionData) && (
            <CorePracticeUI
              questionData={questionData as PracticeQuestion}
              isLoading={isLoading}
              onNext={() => handleGenerateQuestion(currentTopic)}
              onSubmitted={() => prefetchNext(currentTopic)}
            />
          )}

          {loadError && !isLoading && !questionData && (
            <div className="bg-[#1b2533] p-8 rounded-xl border border-red-500/40 flex flex-col items-center text-center">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-white mb-1">Không sinh được câu hỏi</h3>
              <p className="text-gray-400 text-sm mb-4">Gia sư AI tạm thời chưa phản hồi. Kiểm tra kết nối rồi thử lại.</p>
              <button
                onClick={() => handleGenerateQuestion(currentTopic)}
                className="text-sm font-bold bg-gradient-to-r from-yellow-300 to-amber-500 text-[#78350f] px-5 py-2 rounded-lg hover:from-yellow-200 hover:to-amber-400"
              >
                🔄 Thử lại
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
