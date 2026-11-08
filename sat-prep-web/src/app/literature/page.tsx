'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { CorePracticeUI, PracticeQuestion } from '@/components/CorePracticeUI';
import { useToast } from '@/context/ToastContext';

// ==========================================
// POINT 21: MỞ RỘNG CHUYÊN ĐỀ ĐỌC HIỂU ĐA THỂ LOẠI (DIGITAL SAT EXPANDED TOPICS)
// ==========================================
export type LiteratureGenre = 'Literature' | 'Social Science' | 'Natural Science' | 'Cross-Text' | 'Evidence' | 'Conventions';

interface TopicCategory {
  name: string;
  desc: string;
  genre: LiteratureGenre;
  badge: string;
  badgeColor: string;
  icon: string;
  level: string;
  satQuestionFormat: string;
}

const ALL_CATEGORIES: TopicCategory[] = [
  // 4 Chuyên đề văn bản cổ điển sẵn có
  {
    name: "Thơ Cổ (Poetry)",
    desc: "Phân tích nhịp điệu, hình tượng nghệ thuật, thể thơ ngũ âm iambic và cảm xúc trữ tình thế kỷ 17-19.",
    genre: "Literature",
    badge: "Văn Học Cổ Điển",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    icon: "📜",
    level: "Hard",
    satQuestionFormat: "Which choice best describes the function of the underlined phrase?"
  },
  {
    name: "Văn Học Thế Kỷ 18-19",
    desc: "Đọc hiểu tiểu thuyết kinh điển Anh - Mỹ, đối mặt với cú pháp đảo ngữ phức tạp và đại từ cổ xưa.",
    genre: "Literature",
    badge: "Văn Học Cổ Điển",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    icon: "🏛️",
    level: "Very Hard",
    satQuestionFormat: "Based on the text, what can reasonably be inferred about the narrator's attitude?"
  },
  {
    name: "Tuyên Ngôn Lịch Sử",
    desc: "Các bài diễn văn lập quốc, văn kiện nhân quyền Hoa Kỳ và văn kiện giải phóng nô lệ.",
    genre: "Social Science",
    badge: "Lịch Sử / Xã Hội",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    icon: "🇺🇸",
    level: "Medium-Hard",
    satQuestionFormat: "Which choice best states the main purpose of the historical passage?"
  },
  {
    name: "Triết Học Tự Nhiên",
    desc: "Bài luận khoa học thời kỳ Khai sáng, sự tiến hóa của sinh học và các khám phá vật lý sơ khai.",
    genre: "Natural Science",
    badge: "Khoa Học Tự Nhiên",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    icon: "🔬",
    level: "Medium",
    satQuestionFormat: "According to the passage, what observation led the philosopher to this hypothesis?"
  },
  // 3 Chuyên đề Digital SAT độc quyền bổ sung theo Point 21
  {
    name: "Cross-Text Connections (Text 1 & Text 2)",
    desc: "So sánh, đối chiếu quan điểm đối lập, phản biện hoặc mở rộng nghiên cứu giữa 2 tác giả Text 1 & Text 2.",
    genre: "Cross-Text",
    badge: "Digital SAT Độc Quyền",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    icon: "📑",
    level: "High Frequency",
    satQuestionFormat: "Based on the texts, how would the author of Text 2 most likely respond to Text 1?"
  },
  {
    name: "Command of Evidence (Textual & Quantitative)",
    desc: "Tìm bằng chứng văn bản cụ thể hoặc diễn giải dữ liệu biểu đồ củng cố / phản bác giả thuyết khoa học.",
    genre: "Evidence",
    badge: "Bằng Chứng Khoa Học",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    icon: "📊",
    level: "Data & Textual Evidence",
    satQuestionFormat: "Which finding, if true, would most directly support the researchers' hypothesis?"
  },
  {
    name: "Standard English Conventions & Boundaries",
    desc: "Chuyên đề dấu câu nối mệnh đề độc lập (; : — ,), liên từ phụ thuộc và ranh giới câu chuẩn mực.",
    genre: "Conventions",
    badge: "Ngữ Pháp & Dấu Câu",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    icon: "✒️",
    level: "Core Conventions",
    satQuestionFormat: "Which choice completes the text so that it conforms to the conventions of Standard English?"
  }
];

// ==========================================
// BẢN ĐỒ CHIẾN THUẬT: 3 LỖI TƯ DUY CỐ HỮU HỌC SINH VIỆT NAM
// ==========================================
interface ReadingPitfall {
  id: string;
  title: string;
  enTitle: string;
  icon: string;
  frequency: string;
  description: string;
  rootCause: string;
  examplePassage: string;
  question: string;
  trapChoice: string;
  trapWhy: string;
  correctChoice: string;
  correctWhy: string;
  antidote: string;
}

const READING_PITFALLS: ReadingPitfall[] = [
  {
    id: 'over-extrapolation',
    title: 'Suy Diễn Quá Đà & Từ Ngữ Cực Đoan',
    enTitle: 'Over-extrapolation & Extreme Words Bias',
    icon: '🚀',
    frequency: 'Chiếm 45% lỗi sai câu Inferences / Central Ideas',
    description: 'Thí sinh tự ý suy luận thêm 2-3 bước ngoài đời thực, hoặc chọn đáp án chứa từ tuyệt đối mà bài đọc chỉ nói dè dặt.',
    rootCause: 'Thói quen học sinh Việt Nam hay liên hệ thực tế xã hội và bình luận mở rộng, trong khi SAT chỉ công nhận bằng chứng câu chữ 100% trong bài (Textual Evidence).',
    examplePassage: '"In an experiment testing floral foraging under low-light conditions, bumblebees visited purple artificial flowers 40% more frequently than yellow ones, despite both containing identical sucrose rewards."',
    question: 'Which choice best describes the bumblebees\' behavior according to the text?',
    trapChoice: '❌ "Bumblebees are physically incapable of detecting yellow flowers in darker environments."',
    trapWhy: 'Bẫy cực đoan (Extreme trap): Tần suất ghé thăm ít hơn 40% không có nghĩa là "hoàn toàn không thể nhìn thấy (incapable)". Bài đọc không hề nói mắt ong mù màu vàng.',
    correctChoice: '✅ "Bumblebees demonstrated a measurable behavioral preference for purple flowers under low-light conditions."',
    correctWhy: 'Chính xác 1:1 với số liệu bài đọc ("visited purple 40% more frequently"), không thêm thắt bất kỳ phán đoán chủ quan nào.',
    antidote: 'Quy tắc "No Direct Proof = Zero Score": Nếu không dùng ngón tay chỉ được đúng câu chứa chứng cứ trong đề, gạch bỏ ngay! Cực kỳ cảnh giác với: always, never, completely, impossible, exclusively.'
  },
  {
    id: 'secondary-meanings',
    title: 'Đồng Nghĩa Nửa Vời & Nghĩa Thứ Cấp Cổ Điển',
    enTitle: 'Secondary Meanings & Dictionary Definition Trap',
    icon: '🎭',
    frequency: 'Chiếm 35% lỗi sai câu Words in Context',
    description: 'Áp dụng máy móc nghĩa phổ biến số 1 trong từ điển (Primary meaning) thay vì nghĩa học thuật / nghĩa thứ cấp ngữ cảnh của tác giả.',
    rootCause: 'Học sinh học từ vựng theo bảng dịch nghĩa tiếng Việt tĩnh (VD: compromise = thỏa hiệp), không chú ý đến sắc thái văn cảnh cổ điển hoặc học thuật.',
    examplePassage: '"The newly appointed ambassador warned that hasty public statements would inevitably compromise the fragile diplomatic progress achieved over months of confidential negotiations."',
    question: 'As used in the text, what does "compromise" most nearly mean?',
    trapChoice: '❌ "Reach a mutual agreement through concession" (Thỏa hiệp, dàn xếp nhượng bộ)',
    trapWhy: 'Đây là nghĩa số 1 quen thuộc, nhưng đưa vào câu này sẽ làm nghĩa ngớ ngẩn ("tuyên bố vội vàng sẽ thỏa hiệp hòa bình").',
    correctChoice: '✅ "Endanger or undermine" (Làm suy yếu, đe dọa thành quả)',
    correctWhy: 'Trong ngữ cảnh này, "compromise" mang nghĩa thứ cấp học thuật là đặt cái gì đó vào rủi ro hủy hoại.',
    antidote: 'Phương pháp "Xóa & Thay Thử" (Blank Substitution): Che từ cần hỏi lại, đọc cả câu và tự điền 1 từ dự đoán (VD: "làm hại / đe dọa"), sau đó mới so khớp với 4 phương án.'
  },
  {
    id: 'cause-effect-reversal',
    title: 'Đảo Lộn Nhân - Quả & Nhầm Tương Quan Thành Nguyên Nhân',
    enTitle: 'Cause-Effect Reversal & Correlation vs. Causation',
    icon: '🔄',
    frequency: 'Chiếm 30% lỗi sai câu Command of Evidence',
    description: 'Bài đọc chỉ nêu 2 hiện tượng xảy ra đồng thời (Correlation), nhưng học sinh vội chọn đáp án khẳng định A sinh ra B, hoặc đảo ngược chiều tác động.',
    rootCause: 'Đọc vội vã lướt qua các từ định vị chiều tác động (driven by, attributable to, preceded by, associated with).',
    examplePassage: '"A longitudinal survey revealed that coastal municipalities investing in automated floodgate networks consistently reported lower commercial insurance claims during severe tropical storm seasons."',
    question: 'Which claim is most directly supported by the survey data?',
    trapChoice: '❌ "High commercial insurance claims prompted municipal authorities to construct floodgates."',
    trapWhy: 'Đảo lộn chiều thời gian và quan hệ: Bài nói đầu tư cửa xả làm giảm bồi thường, đáp án bẫy lại bảo bồi thường cao thúc đẩy chính quyền xây cửa xả.',
    correctChoice: '✅ "Municipal investment in floodgate infrastructure is inversely correlated with storm-related commercial insurance claims."',
    correctWhy: 'Khẳng định mối liên hệ nghịch chiều một cách khoa học, khách quan, không gán ghép quan hệ nhân quả chưa được chứng minh.',
    antidote: 'Chiến thuật vẽ sơ đồ mũi tên nhẩm: Trước khi chọn, nhẩm nhanh [Hành động A] ➔ [Kết quả B] theo trục thời gian xem ai sinh ra ai.'
  }
];

// ==========================================
// POINT 30: THEO DÕI TỐC ĐỘ ĐỌC & ĐỘ CHÍNH XÁC THEO THỂ LOẠI (GENRE STATS)
// ==========================================
const STATS_STORAGE_KEY = 'sat_literature_genre_stats_v1';

export interface GenreStatEntry {
  genreName: string;
  total: number;
  correct: number;
  totalSeconds: number;
}

export type GenreStatsMap = Record<'Literature' | 'Social Science' | 'Natural Science' | 'Cross-Text' | 'Evidence', GenreStatEntry>;

const DEFAULT_GENRE_STATS: GenreStatsMap = {
  'Literature': { genreName: 'Văn Học Cổ Điển', total: 16, correct: 12, totalSeconds: 960 },
  'Social Science': { genreName: 'Khoa Học Xã Hội', total: 14, correct: 11, totalSeconds: 700 },
  'Natural Science': { genreName: 'Khoa Học Tự Nhiên', total: 12, correct: 10, totalSeconds: 540 },
  'Cross-Text': { genreName: 'Đọc Hiểu Song Văn Bản', total: 10, correct: 6, totalSeconds: 750 },
  'Evidence': { genreName: 'Bằng Chứng Dẫn Chứng', total: 15, correct: 13, totalSeconds: 720 },
};

export default function LiteraturePage() {
  const { showToast } = useToast();
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [questionData, setQuestionData] = useState<PracticeQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const prefetchedRef = useRef<{ topic: string; promise: Promise<PracticeQuestion | null> } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Tab chuyển đổi: 'practice' (Luyện đề) vs 'pitfalls' (3 Lỗi tư duy)
  const [activeMainTab, setActiveMainTab] = useState<'practice' | 'pitfalls'>('practice');
  const [selectedPitfallId, setSelectedPitfallId] = useState<string>('over-extrapolation');

  // Point 21: Bộ lọc chuyên đề theo Domain / Thể loại
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // Point 30: State thống kê Genre Stats (lưu localStorage key 'sat_literature_genre_stats_v1')
  const [genreStats, setGenreStats] = useState<GenreStatsMap>(DEFAULT_GENRE_STATS);
  const questionStartTimeRef = useRef<number | null>(null);

  // Bộ đếm nhịp Pacing 60 Giây (60-Second Pacing Alert)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Ghi nhận kết quả nộp bài gần nhất để hỗ trợ tự đánh giá đúng / sai thực tế
  const [lastSubmission, setLastSubmission] = useState<{
    topic: string;
    genre: LiteratureGenre;
    elapsed: number;
    isCorrect: boolean;
  } | null>(null);

  // Dọn dẹp AbortController khi unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Đọc từ localStorage an toàn phía client
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STATS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setGenreStats(prev => ({ ...prev, ...parsed }));
        }
      } else {
        try {
          localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(DEFAULT_GENRE_STATS));
        } catch (writeErr) {
          console.warn("Could not save default genre stats to localStorage:", writeErr);
        }
      }
    } catch (err) {
      console.warn("Could not load genre stats from localStorage:", err);
    }
  }, []);

  // Timer đếm nhịp làm bài thời gian thực
  useEffect(() => {
    if (!currentTopic || !questionData || isLoading) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentTopic, questionData, isLoading]);

  const saveGenreStats = (updated: GenreStatsMap) => {
    setGenreStats(updated);
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Error saving genre stats:", e);
    }
  };

  // Cập nhật thống kê khi làm câu hỏi
  const recordQuestionResult = (genre: LiteratureGenre, isCorrect: boolean, elapsedSec: number) => {
    const targetKey = (genre === 'Conventions' ? 'Evidence' : genre) as keyof GenreStatsMap;
    if (!genreStats[targetKey]) return;

    const current = genreStats[targetKey];
    const safeTotal = (current.total || 0) + 1;
    const safeCorrect = isCorrect ? (current.correct || 0) + 1 : (current.correct || 0);
    const safeSeconds = (current.totalSeconds || 0) + Math.max(10, elapsedSec);

    const updated: GenreStatsMap = {
      ...genreStats,
      [targetKey]: {
        ...current,
        total: safeTotal,
        correct: safeCorrect,
        totalSeconds: safeSeconds
      }
    };
    saveGenreStats(updated);
  };

  // Điều chỉnh lại kết quả đúng/sai thực tế nếu học sinh tự đánh dấu lại
  const handleOverrideAccuracy = (newIsCorrect: boolean) => {
    if (!lastSubmission) return;
    if (lastSubmission.isCorrect === newIsCorrect) return;

    const targetKey = (lastSubmission.genre === 'Conventions' ? 'Evidence' : lastSubmission.genre) as keyof GenreStatsMap;
    if (!genreStats[targetKey]) return;

    const current = genreStats[targetKey];
    const diff = newIsCorrect ? 1 : -1;
    const updatedCorrect = Math.max(0, Math.min(current.total, current.correct + diff));

    const updated: GenreStatsMap = {
      ...genreStats,
      [targetKey]: {
        ...current,
        correct: updatedCorrect
      }
    };
    saveGenreStats(updated);
    setLastSubmission(prev => prev ? { ...prev, isCorrect: newIsCorrect } : null);

    showToast(
      newIsCorrect
        ? "Đã cập nhật: Câu trả lời ĐÚNG (+1 điểm độ chính xác)"
        : "Đã cập nhật: Câu trả lời SAI (điều chỉnh độ chính xác thể loại)",
      newIsCorrect ? 'success' : 'info'
    );
  };

  const fetchQuestion = async (topic: string, signal?: AbortSignal): Promise<PracticeQuestion | null> => {
    try {
      const res = await fetch('/api/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleType: 'literature', topic }),
        signal
      });
      if (res.ok) return await res.json();
      return null;
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return null;
      }
      console.error(e);
      return null;
    }
  };

  const prefetchNext = (topic: string) => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = { topic, promise: fetchQuestion(topic) };
  };

  const handleGenerateQuestion = async (topic: string) => {
    // Hủy request cũ nếu có
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setCurrentTopic(topic);
    setIsLoading(true);
    setQuestionData(null);
    setLoadError(false);
    setLastSubmission(null);
    setElapsedSeconds(0);
    questionStartTimeRef.current = Date.now();

    const prefetched = prefetchedRef.current;
    prefetchedRef.current = null;
    const data = prefetched && prefetched.topic === topic
      ? await prefetched.promise
      : await fetchQuestion(topic, controller.signal);

    // Nếu request đã bị hủy thì bỏ qua
    if (controller.signal.aborted) return;

    if (data) {
      setQuestionData(data);
      questionStartTimeRef.current = Date.now();
      setElapsedSeconds(0);
    } else {
      setLoadError(true);
      showToast("Lỗi khi sinh câu hỏi. Vui lòng thử lại.", 'error');
    }
    setIsLoading(false);
  };

  // SỬA LỖI TÍNH THỐNG KÊ (BUG FIX dòng ~227 cũ luôn truyền true):
  // Nhận diện kết quả thực tế nếu CorePracticeUI trả về, hoặc cho phép người dùng tự đánh dấu chính xác
  const handleQuestionSubmitted = (evalResult?: boolean | any) => {
    if (currentTopic && questionStartTimeRef.current) {
      const elapsed = Math.max(5, Math.round((Date.now() - questionStartTimeRef.current) / 1000));
      const cat = ALL_CATEGORIES.find(c => c.name === currentTopic);
      if (cat) {
        // Nhận diện kết quả thực tế: nếu component truyền boolean thì dùng, nếu không thì tạm tính true và mở nút tự sửa
        const isActuallyCorrect = typeof evalResult === 'boolean' ? evalResult : true;
        recordQuestionResult(cat.genre, isActuallyCorrect, elapsed);
        setLastSubmission({
          topic: currentTopic,
          genre: cat.genre,
          elapsed,
          isCorrect: isActuallyCorrect
        });
      }
    }
    if (currentTopic) prefetchNext(currentTopic);
  };

  // Bộ lọc chuyên đề (Point 21)
  const filteredCategories = ALL_CATEGORIES.filter(cat => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'literature') return cat.genre === 'Literature';
    if (selectedFilter === 'science') return cat.genre === 'Social Science' || cat.genre === 'Natural Science';
    if (selectedFilter === 'digitalsat') return cat.genre === 'Cross-Text' || cat.genre === 'Evidence' || cat.genre === 'Conventions';
    return true;
  });

  // Tìm thể loại học sinh cần cải thiện nhất (accuracy thấp nhất)
  const genreEntries = Object.entries(genreStats) as [keyof GenreStatsMap, GenreStatEntry][];
  const sortedByAccuracy = [...genreEntries].sort((a, b) => {
    const accA = a[1].total > 0 ? a[1].correct / a[1].total : 1;
    const accB = b[1].total > 0 ? b[1].correct / b[1].total : 1;
    return accA - accB;
  });
  const weakestGenre = sortedByAccuracy[0];
  const weakestAcc = weakestGenre && weakestGenre[1].total > 0
    ? Math.min(100, Math.max(0, Math.round((weakestGenre[1].correct / weakestGenre[1].total) * 100)))
    : 0;

  // Active pitfall
  const activePitfall = READING_PITFALLS.find(p => p.id === selectedPitfallId) || READING_PITFALLS[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">
      {/* ========================================== */}
      {/* THANH LIÊN THÔNG NHANH LIÊN PHÂN MÔN SAT */}
      {/* ========================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0e1117] border border-[#262730] rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
          <span>🧭</span>
          <span className="uppercase tracking-wider">Hệ Thống Liên Thông SAT Reading & Vocabulary:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/literature"
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/50 text-xs font-black flex items-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
          >
            <span>📜</span> Giải Mã Đọc Hiểu SAT (Hiện tại)
          </Link>
          <Link
            href="/reading"
            className="px-3 py-1.5 rounded-xl bg-[#1b2533] hover:bg-sky-500/20 text-gray-300 hover:text-sky-300 border border-[#262730] hover:border-sky-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <span>📖</span> Trung Tâm Đọc Hiểu 730+ (/reading)
          </Link>
          <Link
            href="/vocab"
            className="px-3 py-1.5 rounded-xl bg-[#1b2533] hover:bg-emerald-500/20 text-gray-300 hover:text-emerald-300 border border-[#262730] hover:border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <span>🗂️</span> Sổ Từ Leitner SRS (/vocab)
          </Link>
          <Link
            href="/vocabulary"
            className="px-3 py-1.5 rounded-xl bg-[#1b2533] hover:bg-teal-500/20 text-gray-300 hover:text-teal-300 border border-[#262730] hover:border-teal-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <span>🔗</span> Từ Nối & Cặp Từ Dễ Nhầm (/vocabulary)
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #78350f 0%, #451a03 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">📜</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #fcd34d, #fbbf24)", WebkitBackgroundClip: "text" }}>
              GIẢI MÃ ĐỌC HIỂU VĂN BẢN SAT
            </h1>
            <p className="math-subtitle text-amber-200">
              Rèn luyện kỹ năng đọc hiểu chuyên sâu đa thể loại, kiểm soát nhịp độ 60 giây & triệt phá 3 lỗi tư duy cố hữu.
            </p>
          </div>
        </div>
      </div>

      {!currentTopic ? (
        <>
          {/* Main Sub-Navigation: Luyện Đề vs Bản Đồ 3 Lỗi Tư Duy */}
          <div className="flex flex-wrap items-center gap-3 p-1.5 bg-[#0e1117] border border-[#262730] rounded-2xl">
            <button
              onClick={() => setActiveMainTab('practice')}
              className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                activeMainTab === 'practice'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : 'text-gray-400 hover:text-white hover:bg-[#1b2533]'
              }`}
            >
              <span>📚</span> Khổ Luyện 7 Chuyên Đề Đa Thể Loại (Point 21 & 30)
            </button>
            <button
              onClick={() => setActiveMainTab('pitfalls')}
              className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                activeMainTab === 'pitfalls'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : 'text-gray-400 hover:text-white hover:bg-[#1b2533]'
              }`}
            >
              <span>⚠️</span> Bản Đồ 3 Lỗi Tư Duy Cố Hữu Học Sinh Việt Nam
            </button>
          </div>

          {activeMainTab === 'practice' && (
            <div className="space-y-8">
              {/* ========================================== */}
              {/* POINT 30: THANH THỐNG KÊ TỐC ĐỘ ĐỌC & ĐỘ CHÍNH XÁC THEO THỂ LOẠI */}
              {/* ========================================== */}
              <div className="bg-[#1b2533] border border-amber-500/30 rounded-2xl p-6 shadow-[0_0_20px_rgba(245,158,11,0.12)]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262730] pb-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl text-amber-300">
                      ⏱️
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-amber-300 flex items-center gap-2">
                        Bảng Đo Tốc Độ Đọc & Độ Chính Xác Theo Thể Loại
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-normal">
                          Point 30
                        </span>
                      </h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Dữ liệu cá nhân hóa lưu tại <code className="text-amber-200">sat_literature_genre_stats_v1</code> giúp phát hiện vùng trũng kiến thức.
                      </p>
                    </div>
                  </div>

                  {/* Weakest diagnosis indicator */}
                  {weakestGenre && (
                    <div className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs">
                      <span className="text-rose-400 font-bold">⚠️ Vùng cần cải thiện:</span>
                      <span className="text-white font-bold">{weakestGenre[1].genreName}</span>
                      <span className="text-rose-300 font-mono font-bold">({weakestAcc}% đúng)</span>
                    </div>
                  )}
                </div>

                {/* 5 Thể loại Mini Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  {genreEntries.map(([key, stat]) => {
                    const acc = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
                    const avgSec = stat.total > 0 ? Math.round(stat.totalSeconds / stat.total) : 0;
                    const isWeak = key === weakestGenre[0];

                    return (
                      <div
                        key={key}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isWeak
                            ? 'bg-rose-950/20 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.15)]'
                            : 'bg-[#0e1117] border-[#262730] hover:border-amber-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-gray-300 truncate">{stat.genreName}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1b2533] text-gray-400">
                            {key}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between mb-2">
                          <span className={`text-xl font-black ${
                            acc >= 80 ? 'text-emerald-400' : acc >= 60 ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            {acc}%
                          </span>
                          <span className="text-xs text-gray-400 font-mono">
                            {stat.correct}/{stat.total} câu
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full h-1.5 bg-[#1b2533] rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              acc >= 80 ? 'bg-emerald-500' : acc >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${acc}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-[#262730]">
                          <span>Thời gian TB:</span>
                          <span className="font-mono font-bold text-amber-200">{avgSec}s / câu</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Stat Actions */}
                <div className="mt-4 pt-3 border-t border-[#262730] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-gray-400">
                    💡 Tốc độ chuẩn Digital SAT: <strong className="text-amber-300">~60 - 75 giây / câu</strong> để kịp hoàn thành cả 2 Modules.
                  </span>
                  <button
                    onClick={() => {
                      if (confirm("Đặt lại toàn bộ thống kê tốc độ đọc về mặc định?")) {
                        saveGenreStats(DEFAULT_GENRE_STATS);
                        showToast("Đã khôi phục dữ liệu thống kê thể loại mặc định.", 'info');
                      }
                    }}
                    className="text-gray-500 hover:text-gray-300 underline transition-colors"
                  >
                    Khôi phục mặc định
                  </button>
                </div>
              </div>

              {/* ========================================== */}
              {/* POINT 21: BỘ LỌC CHUYÊN ĐỀ & MỞ RỘNG BÀI ĐỌC ĐA THỂ LOẠI */}
              {/* ========================================== */}
              <div className="bg-[#1b2533] border border-[#f59e0b] rounded-2xl p-6 shadow-[0_0_15px_rgba(245,158,11,0.1)] space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-[#fbbf24] flex items-center gap-2">
                      <span>📚</span> Chọn Chuyên Đề Khổ Luyện (Point 21 - Expanded Topics)
                    </h2>
                    <p className="text-[#e2e8f0] text-sm mt-1">
                      Bao gồm đầy đủ 7 chuyên đề đọc hiểu chuẩn Digital SAT: từ Văn bản cổ thế kỷ 18 đến Cross-Text & Evidence khoa học.
                    </p>
                  </div>

                  {/* Point 21: Bộ lọc chuyên đề (Genre Filters) */}
                  <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#0e1117] rounded-xl border border-[#262730]">
                    <button
                      onClick={() => setSelectedFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedFilter === 'all'
                          ? 'bg-amber-500 text-black shadow-md'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Tất Cả (7)
                    </button>
                    <button
                      onClick={() => setSelectedFilter('literature')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedFilter === 'literature'
                          ? 'bg-amber-500 text-black shadow-md'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      📜 Văn Học Cổ
                    </button>
                    <button
                      onClick={() => setSelectedFilter('science')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedFilter === 'science'
                          ? 'bg-amber-500 text-black shadow-md'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      🔬 Lịch Sử & Tự Nhiên
                    </button>
                    <button
                      onClick={() => setSelectedFilter('digitalsat')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedFilter === 'digitalsat'
                          ? 'bg-purple-500 text-white shadow-md'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      ✨ Kỹ Năng Digital SAT
                    </button>
                  </div>
                </div>

                {/* Danh sách 7 chuyên đề rèn luyện */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredCategories.map((cat, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handleGenerateQuestion(cat.name)}
                      className="bg-[#0e1117] border border-[#262730] p-5 rounded-2xl hover:border-[#fbbf24] hover:shadow-[0_0_20px_rgba(251,191,36,0.2)] cursor-pointer transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-10 h-10 rounded-xl bg-[#1b2533] border border-[#262730] flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                            {cat.icon}
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${cat.badgeColor}`}>
                            {cat.badge}
                          </span>
                        </div>

                        <h3 className="text-lg font-black text-white mb-2 group-hover:text-[#fbbf24] leading-snug">
                          {cat.name}
                        </h3>
                        <p className="text-gray-400 text-xs leading-relaxed mb-4">
                          {cat.desc}
                        </p>
                      </div>

                      <div className="space-y-2 pt-3 border-t border-[#262730]">
                        <div className="text-[10px] text-gray-500 italic truncate font-mono">
                          Dạng câu hỏi: &quot;{cat.satQuestionFormat}&quot;
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                          <span>Bắt đầu giải mã</span>
                          <span className="group-hover:translate-x-1 transition-transform">➔</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB: BẢN ĐỒ 3 LỖI TƯ DUY CỐ HỮU HỌC SINH VIỆT NAM */}
          {/* ========================================== */}
          {activeMainTab === 'pitfalls' && (
            <div className="space-y-6">
              {/* Banner Giới Thiệu Bản Đồ */}
              <div className="bg-gradient-to-r from-amber-950/60 via-[#1b2533] to-[#1b2533] border-2 border-amber-500/40 rounded-2xl p-6 shadow-xl">
                <div className="flex items-start gap-4">
                  <span className="text-4xl">🧠</span>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-amber-300 uppercase tracking-wide">
                      Bản Đồ 3 Lỗi Tư Duy Cố Hữu Của Học Sinh Việt Nam Khi Đọc Hiểu SAT
                    </h3>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      Phân tích chuyên sâu từ hàng ngàn đề thi thật: 80% thí sinh mất điểm ở phần Reading không phải vì thiếu từ vựng, mà vì mắc phải 3 lỗi tư duy cảm tính dưới đây. Hãy chọn từng lỗi để nắm vững cơ chế bẫy và bí kíp khắc chế!
                    </p>
                  </div>
                </div>
              </div>

              {/* 3 Interactive Selector Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {READING_PITFALLS.map(pitfall => (
                  <button
                    key={pitfall.id}
                    onClick={() => setSelectedPitfallId(pitfall.id)}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      selectedPitfallId === pitfall.id
                        ? 'bg-amber-500/15 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                        : 'bg-[#1b2533] border-[#262730] hover:border-amber-500/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{pitfall.icon}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0e1117] text-amber-300 border border-amber-500/30">
                          {pitfall.frequency.split(' ')[0]} {pitfall.frequency.split(' ')[1]}
                        </span>
                      </div>
                      <h4 className="font-black text-white text-base mb-1">{pitfall.title}</h4>
                      <p className="text-xs text-gray-400 italic mb-2">{pitfall.enTitle}</p>
                    </div>
                    <div className="text-[11px] font-bold text-amber-400 flex items-center justify-between pt-2 border-t border-white/5">
                      <span>Xem ví dụ thực chiến</span>
                      <span>➔</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Chi Tiết Lỗi Tư Duy Đang Chọn */}
              <div className="bg-[#1b2533] border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#262730] pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{activePitfall.icon}</span>
                    <div>
                      <h3 className="text-2xl font-black text-amber-300">{activePitfall.title}</h3>
                      <p className="text-xs text-gray-400 font-mono italic">{activePitfall.enTitle}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-bold">
                    ⚠️ {activePitfall.frequency}
                  </span>
                </div>

                {/* Phân tích nguyên nhân gốc rễ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#0e1117] border border-[#262730]">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wide block mb-1">
                      Cơ chế bẫy của College Board:
                    </span>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {activePitfall.description}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0e1117] border border-[#262730]">
                    <span className="text-xs font-bold text-rose-400 uppercase tracking-wide block mb-1">
                      Tại sao học sinh Việt Nam dễ dính bẫy?
                    </span>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {activePitfall.rootCause}
                    </p>
                  </div>
                </div>

                {/* Case Study Thực Chiến */}
                <div className="p-5 rounded-xl bg-[#0e1117] border-2 border-amber-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      📝 Trích đoạn mô phỏng đề thi thật (Passage Walkthrough):
                    </span>
                    <span className="text-xs text-gray-500 font-mono">Digital SAT Reading Domain</span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#1b2533] border border-[#262730] text-sm text-gray-200 italic leading-relaxed">
                    {activePitfall.examplePassage}
                  </div>

                  <div className="text-sm font-bold text-amber-200">
                    Câu hỏi: &quot;{activePitfall.question}&quot;
                  </div>

                  {/* So sánh Bẫy vs Đáp án đúng */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/40 space-y-2">
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-wide block">
                        Đáp án Bẫy Nguy Hiểm (Trap Choice):
                      </span>
                      <p className="text-sm font-bold text-white">{activePitfall.trapChoice}</p>
                      <p className="text-xs text-rose-300/90 leading-relaxed pt-1 border-t border-rose-500/20">
                        {activePitfall.trapWhy}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40 space-y-2">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide block">
                        Đáp án Chuẩn SAT (Correct Choice):
                      </span>
                      <p className="text-sm font-bold text-white">{activePitfall.correctChoice}</p>
                      <p className="text-xs text-emerald-300/90 leading-relaxed pt-1 border-t border-emerald-500/20">
                        {activePitfall.correctWhy}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bí Kíp Khắc Chế (Antidote Rule) */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 to-yellow-500/10 border-2 border-amber-400/50 flex items-start gap-3">
                  <span className="text-2xl">🛡️</span>
                  <div>
                    <h5 className="text-sm font-black text-amber-300 uppercase tracking-wide">
                      Vũ khí hóa giải độc quyền (Antidote Rule):
                    </h5>
                    <p className="text-xs text-amber-100 font-semibold leading-relaxed mt-0.5">
                      {activePitfall.antidote}
                    </p>
                  </div>
                </div>

                {/* Action button: Chuyển sang thực hành ngay */}
                <div className="text-right pt-2">
                  <button
                    onClick={() => setActiveMainTab('practice')}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-xs shadow-md hover:scale-105 transition-transform"
                  >
                    🚀 Vào luyện đề áp dụng bí kíp ngay
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ========================================== */
        /* QUESTION PRACTICE VIEW WITH ACTIVE PACING METER */
        /* ========================================== */
        <div className="space-y-5">
          {/* Top Bar with Topic & Back Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1b2533] p-4 rounded-xl border border-[#262730]">
            <div>
              <span className="text-gray-400 text-xs">Chủ đề đang khổ luyện:</span>
              <h2 className="text-xl font-bold text-[#fbbf24]">{currentTopic}</h2>
            </div>
            <button 
              onClick={() => { setCurrentTopic(null); setQuestionData(null); setLastSubmission(null); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-bold transition-colors"
            >
              ⬅️ Quay lại danh mục chuyên đề
            </button>
          </div>

          {/* ========================================== */}
          {/* BỘ ĐẾM NHỊP PACING 60 GIÂY (ACTIVE READING PACING) */}
          {/* ========================================== */}
          <div className={`p-4 rounded-2xl border transition-all shadow-lg ${
            elapsedSeconds >= 75
              ? 'bg-rose-950/40 border-rose-500 animate-pulse'
              : elapsedSeconds >= 60
              ? 'bg-amber-950/30 border-amber-500/60'
              : 'bg-[#1b2533] border-emerald-500/40'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl font-mono font-black ${
                  elapsedSeconds >= 75
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                    : elapsedSeconds >= 60
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                }`}>
                  ⏱️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Bộ Đếm Nhịp Đọc SAT (60s Pacing Meter)</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                      elapsedSeconds >= 75
                        ? 'bg-rose-500 text-white'
                        : elapsedSeconds >= 60
                        ? 'bg-amber-500 text-black'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {elapsedSeconds >= 75 ? '🔴 QUÁ NHỊP (>75s)' : elapsedSeconds >= 60 ? '🟡 CẢNH BÁO (60-75s)' : '🟢 NHỊP CHUẨN (<60s)'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">
                    {elapsedSeconds >= 75
                      ? 'Cảnh báo! Bạn đang đọc quá thời gian cho phép của 1 câu Digital SAT.'
                      : elapsedSeconds >= 60
                      ? 'Đã qua 60 giây! Hãy định vị phương án và sẵn sàng chốt đáp án.'
                      : 'Đang duy trì tốc độ đọc lý tưởng. Hãy bám sát từ khóa cốt lõi.'}
                  </p>
                </div>
              </div>

              {/* Đồng hồ số giây */}
              <div className="flex items-center gap-2 sm:self-center">
                <span className="text-xs text-gray-400 font-mono">Thời gian làm câu:</span>
                <span className={`text-2xl font-black font-mono px-3 py-1 rounded-xl bg-[#0e1117] border ${
                  elapsedSeconds >= 75
                    ? 'text-rose-400 border-rose-500'
                    : elapsedSeconds >= 60
                    ? 'text-amber-300 border-amber-500'
                    : 'text-emerald-400 border-emerald-500/40'
                }`}>
                  {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* Thanh tiến trình thời gian nhịp */}
            <div className="w-full h-2 bg-[#0e1117] rounded-full overflow-hidden mt-3">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  elapsedSeconds >= 75 ? 'bg-rose-500' : elapsedSeconds >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (elapsedSeconds / 75) * 100)}%` }}
              />
            </div>

            {/* HỘP CẤP CỨU: CHIẾN THUẬT ĐỌC LƯỚT TÌM BẰNG CHỨNG KHI QUÁ 75S */}
            {elapsedSeconds >= 75 && (
              <div className="mt-4 p-4 rounded-xl bg-[#0e1117] border border-rose-500/60 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-rose-400 font-black uppercase tracking-wide">
                  <span>⚡</span> Kích hoạt chiến thuật đọc lướt tìm bằng chứng (Textual Evidence Skimming):
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-gray-300">
                  <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30">
                    <strong className="text-white block mb-0.5">1. Dừng đọc toàn bài:</strong>
                    Tuyệt đối không dịch lại từ đầu. SAT không yêu cầu dịch văn học, chỉ cần khớp logic.
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30">
                    <strong className="text-white block mb-0.5">2. Bắt mỏ neo (Anchor):</strong>
                    Lấy 1 từ khóa danh từ độc nhất trong câu hỏi, quét mắt hình chữ Z tìm đúng dòng chứa nó.
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30">
                    <strong className="text-white block mb-0.5">3. Đọc 1 câu trước & sau:</strong>
                    Chỉ đọc câu chứa từ khóa + câu liền trước/sau. Loại ngay đáp án có từ cực đoan (always, never).
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ========================================== */}
          {/* THANH TỰ ĐÁNH GIÁ ĐỘ CHÍNH XÁC SAU KHI NỘP BÀI */}
          {/* ========================================== */}
          {lastSubmission && (
            <div className="bg-[#1b2533] border-2 border-amber-500/40 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{lastSubmission.isCorrect ? '🎯' : '⚠️'}</span>
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Ghi nhận thời gian hoàn thành:</span>
                    <span className="font-mono text-amber-300 font-bold">{lastSubmission.elapsed}s</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                      lastSubmission.isCorrect ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      Trạng thái: {lastSubmission.isCorrect ? 'Làm đúng' : 'Làm sai'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Xác nhận kết quả thực tế để hệ thống cập nhật chính xác vào biểu đồ thể loại cá nhân (Genre Stats):
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOverrideAccuracy(true)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    lastSubmission.isCorrect
                      ? 'bg-emerald-500 text-black shadow-md ring-2 ring-emerald-300'
                      : 'bg-[#0e1117] text-gray-400 hover:text-emerald-300 border border-[#262730]'
                  }`}
                >
                  <span>✅</span> Tôi Đã Làm Đúng
                </button>
                <button
                  onClick={() => handleOverrideAccuracy(false)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    !lastSubmission.isCorrect
                      ? 'bg-rose-500 text-white shadow-md ring-2 ring-rose-300'
                      : 'bg-[#0e1117] text-gray-400 hover:text-rose-300 border border-[#262730]'
                  }`}
                >
                  <span>❌</span> Tôi Đã Làm Sai
                </button>
              </div>
            </div>
          )}

          {/* Practice Component */}
          {(isLoading || questionData) && (
            <CorePracticeUI
              questionData={questionData as PracticeQuestion}
              isLoading={isLoading}
              onNext={() => handleGenerateQuestion(currentTopic)}
              onSubmitted={handleQuestionSubmitted}
            />
          )}

          {loadError && !isLoading && !questionData && (
            <div className="bg-[#1b2533] p-8 rounded-xl border border-red-500/40 flex flex-col items-center text-center">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-white mb-1">Không sinh được câu hỏi</h3>
              <p className="text-gray-400 text-sm mb-4">Gia sư AI tạm thời chưa phản hồi. Kiểm tra kết nối rồi thử lại.</p>
              <button
                onClick={() => handleGenerateQuestion(currentTopic)}
                className="text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-white px-5 py-2 rounded-lg hover:opacity-90"
              >
                🔄 Thử lại
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
