'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';

// ==========================================
// INTERFACES & CORE DATA
// ==========================================
export interface VocabWord {
  id: string;
  box: number;
  word: string;
  meaning: string;
  example: string;
  roots?: string[];
  isPinned?: boolean;
  leechCount?: number;
}

// ==========================================
// POINT 22 & #C043/#C044: CẨM NANG GỐC TỪ & CẶP TỪ DỄ NHẦM TRONG SAT
// ==========================================
export interface ConfusablePair {
  pairWith: string;
  distinction: string;
}

const CONFUSABLE_PAIRS: Record<string, ConfusablePair> = {
  'affect': { pairWith: 'effect', distinction: 'Affect (Động từ: tác động, làm ảnh hưởng) vs. Effect (Danh từ: kết quả, hệ quả, hiệu ứng)' },
  'discrete': { pairWith: 'discreet', distinction: 'Discrete (tách biệt, rời rạc) vs. Discreet (kín đáo, cẩn trọng trong lời nói/hành vi)' },
  'elicit': { pairWith: 'illicit', distinction: 'Elicit (khêu gợi, moi ra thông tin) vs. Illicit (trái pháp luật, phi pháp)' },
  'complement': { pairWith: 'compliment', distinction: 'Complement (bổ sung cho hoàn chỉnh) vs. Compliment (lời khen ngợi, ca ngợi)' },
  'ambivalent': { pairWith: 'ambiguous', distinction: 'Ambivalent (mâu thuẫn nội tâm, vừa yêu vừa ghét) vs. Ambiguous (mơ hồ, đa nghĩa, tối nghĩa)' },
  'mitigate': { pairWith: 'militate', distinction: 'Mitigate (làm giảm nhẹ thiệt hại/đau đớn) vs. Militate against (chống lại, cản trở)' },
  'censor': { pairWith: 'censure', distinction: 'Censor (kiểm duyệt văn bản/truyền thông) vs. Censure (khiển trách, phê phán kịch liệt)' },
  'allusion': { pairWith: 'illusion', distinction: 'Allusion (sự ám chỉ văn học/lịch sử) vs. Illusion (ảo ảnh, ảo giác sai lầm)' },
  'eminent': { pairWith: 'imminent', distinction: 'Eminent (kiệt xuất, lỗi lạc, danh tiếng lẫy lừng) vs. Imminent (sắp xảy ra đến nơi, cận kề)' },
  'prescribe': { pairWith: 'proscribe', distinction: 'Prescribe (kê đơn thuốc, quy định hướng dẫn) vs. Proscribe (nghiêm cấm, bài trừ, trục xuất)' },
  'tenuous': { pairWith: 'arduous', distinction: 'Tenuous (yếu ớt, mong manh, ít cơ sở) vs. Arduous (gian nan, đòi hỏi nhiều nỗ lực)' },
  'pragmatic': { pairWith: 'dogmatic', distinction: 'Pragmatic (thực tiễn, linh hoạt trọng hiệu quả) vs. Dogmatic (giáo điều, bảo thủ, áp đặt)' },
  'corroborate': { pairWith: 'collaborate', distinction: 'Corroborate (chứng thực, đưa thêm bằng chứng củng cố) vs. Collaborate (hợp tác làm việc chung)' },
  'ephemeral': { pairWith: 'eternal', distinction: 'Ephemeral (phù du, chóng tàn, ngắn ngủi) vs. Eternal (bất diệt, vĩnh cửu)' },
  'undermine': { pairWith: 'understate', distinction: 'Undermine (làm suy yếu, ngấm ngầm phá hoại) vs. Understate (nói giảm, nói bớt đi)' },
  'bolster': { pairWith: 'bluster', distinction: 'Bolster (ủng hộ, củng cố, tiếp sức) vs. Bluster (tiếng gió gầm rít / nói khoác lác)' },
  'superfluous': { pairWith: 'superlative', distinction: 'Superfluous (thừa thãi, không cần thiết) vs. Superlative (bậc cao nhất, xuất sắc nhất)' },
  'skeptical': { pairWith: 'cynical', distinction: 'Skeptical (hoài nghi khoa học, cần thêm bằng chứng) vs. Cynical (hoài nghi nhân sinh, nghĩ ai cũng vụ lợi)' }
};

function findConfusablePair(word: string): ConfusablePair | null {
  const lower = word.toLowerCase().trim();
  if (CONFUSABLE_PAIRS[lower]) return CONFUSABLE_PAIRS[lower];
  for (const [key, val] of Object.entries(CONFUSABLE_PAIRS)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return null;
}

// ==========================================
// POINT 22: CẨM NANG GỐC TỪ SAT (ROOTS, PREFIXES, SUFFIXES)
// ==========================================
export interface SatRoot {
  root: string;
  type: 'prefix' | 'root' | 'suffix';
  typeLabel: string;
  meaning: string;
  vietnameseMeaning: string;
  examples: string[];
}

const SAT_ROOTS: SatRoot[] = [
  { root: 'bene', type: 'prefix', typeLabel: 'Tiền tố (Prefix)', meaning: 'good, well', vietnameseMeaning: 'Tốt, lành, thuận lợi, phúc đức', examples: ['beneficial', 'benevolent', 'benign', 'benefactor'] },
  { root: 'mal', type: 'prefix', typeLabel: 'Tiền tố (Prefix)', meaning: 'bad, evil, ill', vietnameseMeaning: 'Xấu, độc hại, sai trái', examples: ['malevolent', 'malicious', 'malign', 'malnutrition'] },
  { root: 'circum', type: 'prefix', typeLabel: 'Tiền tố (Prefix)', meaning: 'around, round', vietnameseMeaning: 'Vòng quanh, chu vi, né tránh', examples: ['circumspect', 'circumvent', 'circumference', 'circumlocution'] },
  { root: 'spec', type: 'root', typeLabel: 'Gốc từ (Root)', meaning: 'look, see', vietnameseMeaning: 'Nhìn, quan sát, xem xét', examples: ['spectator', 'introspective', 'conspicuous', 'scrutinize'] },
  { root: 'dict', type: 'root', typeLabel: 'Gốc từ (Root)', meaning: 'say, speak', vietnameseMeaning: 'Nói, tuyên bố, phán quyết', examples: ['predict', 'contradict', 'dictate', 'vindicate'] },
  { root: 'cred', type: 'root', typeLabel: 'Gốc từ (Root)', meaning: 'believe, trust', vietnameseMeaning: 'Tin tưởng, uy tín, tín nhiệm', examples: ['credible', 'incredulous', 'credence', 'credential'] },
  { root: 'chron', type: 'root', typeLabel: 'Gốc từ (Root)', meaning: 'time', vietnameseMeaning: 'Thời gian, niên đại, trường kỳ', examples: ['chronological', 'synchronous', 'anachronism', 'chronic'] },
  { root: 'morph', type: 'root', typeLabel: 'Gốc từ (Root)', meaning: 'shape, form', vietnameseMeaning: 'Hình dạng, cấu trúc, biến hóa', examples: ['amorphous', 'metamorphosis', 'morphology', 'anthropomorphic'] },
  { root: 'path', type: 'root', typeLabel: 'Gốc từ (Root)', meaning: 'feeling, suffering', vietnameseMeaning: 'Cảm xúc, đau khổ, đồng cảm', examples: ['empathy', 'antipathy', 'apathy', 'pathetic', 'pathology'] },
  { root: 'anti', type: 'prefix', typeLabel: 'Tiền tố (Prefix)', meaning: 'against, opposite', vietnameseMeaning: 'Chống lại, đối lập, kháng cự', examples: ['antipathy', 'antithesis', 'antidote', 'antagonist'] },
  { root: 'contra', type: 'prefix', typeLabel: 'Tiền tố (Prefix)', meaning: 'against, opposite', vietnameseMeaning: 'Chống lại, trái ngược, nghịch lý', examples: ['contradict', 'contrary', 'controversy', 'contrast'] },
  { root: 'ology', type: 'suffix', typeLabel: 'Hậu tố (Suffix)', meaning: 'study of, science', vietnameseMeaning: 'Ngành học, lĩnh vực nghiên cứu', examples: ['biology', 'chronology', 'methodology', 'archaeology'] },
  { root: 'uous', type: 'suffix', typeLabel: 'Hậu tố (Suffix)', meaning: 'characterized by, full of', vietnameseMeaning: 'Đặc tính, kéo dài, chứa đầy', examples: ['tenuous', 'ambiguous', 'arduous', 'continuous'] }
];

function findMatchingRoots(word: string): SatRoot[] {
  const lower = word.toLowerCase();
  return SAT_ROOTS.filter(r => lower.includes(r.root.toLowerCase()));
}

// ==========================================
// POINT 25: GÓI TỪ VỰNG KHỞI ĐẦU 1-CLICK (STARTER VOCAB PACKS)
// ==========================================
const PACK_TOP15_ACADEMIC: Omit<VocabWord, 'id' | 'box'>[] = [
  { word: 'ubiquitous', meaning: 'Có mặt ở khắp mọi nơi, phổ biến rộng rãi', example: 'Smartphones and wireless networks have become ubiquitous in urban society.' },
  { word: 'mitigate', meaning: 'Làm dịu bớt, giảm nhẹ mức độ nghiêm trọng', example: 'Wetland restoration helped mitigate catastrophic flood risks during the storm.' },
  { word: 'ephemeral', meaning: 'Phù du, chóng tàn, ngắn ngủi', example: 'Viral internet fame is often ephemeral, fading within a few weeks.' },
  { word: 'pragmatic', meaning: 'Thực tế, thực dụng, trọng hiệu quả hành động', example: 'The committee adopted a pragmatic fiscal roadmap rather than idealistic theories.' },
  { word: 'ambivalent', meaning: 'Có tâm trạng mâu thuẫn giằng xé, vừa thích vừa ghét', example: 'Scientists felt ambivalent about deploying unverified geoengineering methods.' },
  { word: 'corroborate', meaning: 'Chứng thực, củng cố bằng bằng chứng mới', example: 'Satellite imagery corroborated the climatologist’s initial glacier retreat measurements.' },
  { word: 'bolster', meaning: 'Nâng đỡ, gia cố, tăng cường sức mạnh', example: 'Strong labor statistics bolstered consumer confidence in the quarterly forecast.' },
  { word: 'undermine', meaning: 'Làm suy yếu, ngầm phá hoại dần dần', example: 'Flawed experimental assumptions threatened to undermine the validity of the study.' },
  { word: 'ostensible', meaning: 'Bề ngoài, có vẻ như vậy (nhưng bản chất thực có thể khác)', example: 'The ostensible purpose of the summit was trade, but security took center stage.' },
  { word: 'plausible', meaning: 'Hợp lý, đáng tin cậy, có khả năng cao là đúng', example: 'Biologists proposed a plausible mechanism explaining avian navigational accuracy.' },
  { word: 'tenuous', meaning: 'Mong manh, yếu ớt, ít cơ sở chứng minh', example: 'The historical connection between the two remote civilisations remains tenuous.' },
  { word: 'scrutinize', meaning: 'Xem xét kỹ lưỡng, soi xét cẩn trọng từng chi tiết', example: 'Regulatory panels scrutinized the pharmaceutical trials before granting approval.' },
  { word: 'ameliorate', meaning: 'Cải thiện, làm cho tốt hơn, cứu vãn tình thế', example: 'New agricultural irrigation techniques helped ameliorate the effects of the severe drought.' },
  { word: 'recalcitrant', meaning: 'Bướng bỉnh, ngoan cố, bất phục tùng', example: 'The recalcitrant delegates initially refused to sign the revised carbon accords.' },
  { word: 'superfluous', meaning: 'Thừa thãi, không cần thiết, vượt quá mức đòi hỏi', example: 'The editor excised superfluous adjectives to sharpen the prose style.' }
];

const PACK_TOP12_TRANSITIONS: Omit<VocabWord, 'id' | 'box'>[] = [
  { word: 'nevertheless', meaning: 'Tuy nhiên, dẫu vậy (Nhóm Tương phản)', example: 'The winter terrain was perilous; nevertheless, the rescue team forged ahead.' },
  { word: 'consequently', meaning: 'Do đó, kết quả là (Nhóm Nguyên nhân - Kết quả)', example: 'Funding was doubled; consequently, lab researchers accelerated clinical trials.' },
  { word: 'furthermore', meaning: 'Hơn nữa, ngoài ra (Nhóm Bổ sung cùng chiều)', example: 'The turbine design reduces drag; furthermore, it generates thirty percent more power.' },
  { word: 'conversely', meaning: 'Ngược lại hoàn toàn (Nhóm Tương phản đối xứng)', example: 'Cold water retains more dissolved oxygen; conversely, warm currents carry significantly less.' },
  { word: 'subsequently', meaning: 'Sau đó, về sau (Chỉ trình tự thời gian)', example: 'The bill passed the senate and subsequently received executive approval.' },
  { word: 'notwithstanding', meaning: 'Mặc dù, bất chấp điều gì', example: 'Notwithstanding early mechanical setbacks, the prototype achieved orbit safely.' },
  { word: 'accordingly', meaning: 'Phù hợp với điều đó, theo đó mà xử sự', example: 'The laboratory protocol changed, and technicians adjusted procedures accordingly.' },
  { word: 'exemplify', meaning: 'Minh họa điển hình cho, là tấm gương mẫu mực', example: 'Her decisive and selfless actions exemplify the finest traditions of civic duty.' },
  { word: 'hitherto', meaning: 'Cho đến tận thời điểm này', example: 'The deep-sea trench expedition uncovered hitherto undiscovered bioluminescent species.' },
  { word: 'albeit', meaning: 'Mặc dù, dẫu cho (chỉ sự nhượng bộ ngắn)', example: 'The economy registered positive growth, albeit at a noticeably decelerated tempo.' },
  { word: 'mirrors', meaning: 'Phản chiếu giống hệt, tương đồng với', example: 'The protagonist’s gradual disillusionment mirrors the author’s own wartime trauma.' },
  { word: 'contends', meaning: 'Lập luận, quả quyết rằng', example: 'The anthropologist contends that cave drawings served ritualistic purposes.' }
];

const PACK_TOP12_TONE: Omit<VocabWord, 'id' | 'box'>[] = [
  { word: 'skeptical', meaning: 'Hoài nghi, dè dặt, không vội tin', example: 'The lead chemist remained skeptical of the startling room-temperature superconductor claim.' },
  { word: 'optimistic', meaning: 'Lạc quan, tràn đầy hy vọng tích cực', example: 'Conservationists took an optimistic view following the recovery of humpback whales.' },
  { word: 'ambivalent', meaning: 'Lưỡng lự, mâu thuẫn cảm xúc hai chiều', example: 'The essay adopts an ambivalent posture regarding automated machine decision-making.' },
  { word: 'indifferent', meaning: 'Thờ ơ, bàng quan, không đoái hoài', example: 'Nature remains utterly indifferent to humanity’s artistic and technological feats.' },
  { word: 'reverent', meaning: 'Tôn kính, sùng kính sâu sắc', example: 'The poet composed reverent verses honoring the quiet dignity of rural laborers.' },
  { word: 'cynical', meaning: 'Hoài nghi tiêu cực, cho rằng ai cũng vụ lợi', example: 'The commentary took a cynical view of corporate pledges regarding zero deforestation.' },
  { word: 'objective', meaning: 'Khách quan, vô tư, căn cứ trên sự kiện thực', example: 'The investigative report provided an objective accounting of archaeological discrepancies.' },
  { word: 'dismissive', meaning: 'Coi thường, gạt phắt đi, xem nhẹ không đáng kể', example: 'The panel was dismissive of speculative hypotheses unsupported by empirical trials.' },
  { word: 'pragmatic', meaning: 'Thực tiễn, chú trọng kết quả khả thi', example: 'The author advocates a pragmatic resolution rather than dogmatic ideological posturing.' },
  { word: 'nostalgic', meaning: 'Hoài niệm, bồi hồi nhớ nhung quá khứ', example: 'The memoirs strike a nostalgic tone recalling steam locomotive journeys in the 1950s.' },
  { word: 'vindictive', meaning: 'Hận thù, có ý định trả đũa cay độc', example: 'The deposed minister penned vindictive pamphlets targeting his political rivals.' },
  { word: 'contemplative', meaning: 'Trầm ngâm, suy tư sâu sắc, trầm mặc', example: 'The final chapter strikes a contemplative mood on the ephemeral nature of empires.' }
];

// Fallback pool nếu học sinh chưa có đủ từ cho Quiz
const QUIZ_FALLBACK_POOL = [
  ...PACK_TOP15_ACADEMIC,
  ...PACK_TOP12_TRANSITIONS,
  ...PACK_TOP12_TONE
];

export default function VocabPage() {
  const { syncServerEconomy, updateQuestProgress } = useGamification();
  const [words, setWords] = useState<VocabWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Tab mode
  // 'flashcard': Lật thẻ Leitner truyền thống & FSRS
  // 'quiz': Point 24 - Trắc nghiệm 4 Đáp án
  // 'blitz': Point 50 - Thử thách Phản xạ 60 Giây (Blitz Mode)
  // 'list': Point 28 - Danh sách từ & Lọc Leitner Box 1-5 + Tìm kiếm
  // 'roots': Point 22 - Cẩm nang gốc từ SAT
  const [viewMode, setViewMode] = useState<'flashcard' | 'quiz' | 'blitz' | 'list' | 'roots'>('flashcard');

  // Point 28 & #C047/#C048: Search & Leitner Box Filter & Quick Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBoxFilter, setSelectedBoxFilter] = useState<number | 'all'>('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'due' | 'top200' | 'pinned' | 'leech'>('all');

  // #C042: Chế độ Điền từ Ngữ cảnh SAT (Words-in-Context Cloze Mode)
  const [clozeMode, setClozeMode] = useState(false);

  // #C045 & #C049: Ghim từ cá nhân (Starred) & Từ hay quên (Leech Words)
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [leechCounts, setLeechCounts] = useState<Record<string, number>>({});

  // #C050: Thử thách Phản xạ 60 Giây (Blitz Mode)
  const [blitzActive, setBlitzActive] = useState(false);
  const [blitzTimeLeft, setBlitzTimeLeft] = useState(60);
  const [blitzScore, setBlitzScore] = useState(0);
  const [blitzStreak, setBlitzStreak] = useState(0);
  const [blitzHighScore, setBlitzHighScore] = useState(0);
  const [blitzIndex, setBlitzIndex] = useState(0);
  const [blitzSelectedOption, setBlitzSelectedOption] = useState<number | null>(null);
  const [blitzFeedback, setBlitzFeedback] = useState<'correct' | 'wrong' | null>(null);
  const blitzTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Point 24: Mini-Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Toast / Status notification
  const [packFeedback, setPackFeedback] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showPackToast = (msg: string) => {
    setPackFeedback(msg);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setPackFeedback(null);
    }, 3500);
  };

  // Toggle Pin Word (#C045)
  const togglePinWord = (wordId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPinnedIds(prev => {
      const next = prev.includes(wordId) ? prev.filter(id => id !== wordId) : [...prev, wordId];
      try {
        localStorage.setItem('sat_vocab_pinned_ids', JSON.stringify(next));
      } catch (err) {
        console.warn(err);
      }
      return next;
    });
  };

  // Toggle Cloze Mode (#C042)
  const toggleClozeMode = () => {
    setClozeMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sat_vocab_cloze_mode', String(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  };

  // Helper render câu ngữ cảnh Cloze Mode (#C042)
  const renderClozeSentence = (sentence: string, targetWord: string, showWord: boolean) => {
    if (!sentence) return null;
    const cleanWord = targetWord.trim();
    if (!cleanWord) return <span>&quot;{sentence}&quot;</span>;

    const regex = new RegExp(`(${cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-zA-Z]*)`, 'gi');
    const parts = sentence.split(regex);

    if (showWord) {
      return (
        <span>
          &quot;
          {parts.map((part, idx) => 
            regex.test(part) ? (
              <span key={idx} className="bg-purple-500/30 text-purple-200 font-bold px-1.5 py-0.5 rounded border border-purple-400/40">
                {part}
              </span>
            ) : (
              part
            )
          )}
          &quot;
        </span>
      );
    }

    return (
      <span>
        &quot;
        {parts.map((part, idx) => 
          regex.test(part) ? (
            <span key={idx} className="bg-amber-400/20 text-amber-300 font-mono font-black px-2 py-0.5 rounded border border-dashed border-amber-400 inline-block">
              [ _______ ]
            </span>
          ) : (
            part
          )
        )}
        &quot;
      </span>
    );
  };

  // ==========================================
  // POINT 26: PHÁT ÂM AUDIO CHUẨN MỸ (en-US)
  // ==========================================
  const speakWord = (word: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Speech error:", err);
    }
  };

  // Fetch dữ liệu gốc từ API
  const runFetch = () => {
    fetch('/api/vocab')
      .then(res => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json();
      })
      .then(data => {
        let initialWords: VocabWord[] = [];
        if (data.words && Array.isArray(data.words)) {
          initialWords = data.words;
        }

        // Tải thêm từ đã lưu vào localStorage nếu có
        try {
          const cached = localStorage.getItem('sat_user_custom_vocab_v1');
          if (cached) {
            const parsed: VocabWord[] = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              const existingIds = new Set(initialWords.map(w => w.id));
              const nonDupes = parsed.filter(p => !existingIds.has(p.id));
              initialWords = [...initialWords, ...nonDupes];
            }
          }
        } catch (e) {
          console.warn("Could not read custom vocab cache:", e);
        }

        setWords(initialWords);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoadError(true);
        setIsLoading(false);
      });
  };

  const retry = () => {
    setIsLoading(true);
    setLoadError(false);
    runFetch();
  };

  useEffect(() => {
    runFetch();
    try {
      const savedHigh = localStorage.getItem('sat_vocab_blitz_highscore');
      if (savedHigh) setBlitzHighScore(parseInt(savedHigh, 10) || 0);
      const savedPinned = localStorage.getItem('sat_vocab_pinned_ids');
      if (savedPinned) setPinnedIds(JSON.parse(savedPinned));
      const savedLeech = localStorage.getItem('sat_vocab_leech_counts');
      if (savedLeech) setLeechCounts(JSON.parse(savedLeech));
      const savedCloze = localStorage.getItem('sat_vocab_cloze_mode');
      if (savedCloze) setClozeMode(savedCloze === 'true');
    } catch (e) {
      console.warn("Storage load error:", e);
    }
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  // #C050: Countdown timer cho Blitz Mode 60 giây
  useEffect(() => {
    if (blitzActive && blitzTimeLeft > 0) {
      blitzTimerRef.current = setTimeout(() => {
        setBlitzTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (blitzActive && blitzTimeLeft === 0) {
      setBlitzActive(false);
      setBlitzScore(currentScore => {
        if (currentScore > blitzHighScore) {
          setBlitzHighScore(currentScore);
          try {
            localStorage.setItem('sat_vocab_blitz_highscore', String(currentScore));
          } catch (e) {
            console.warn(e);
          }
        }
        return currentScore;
      });
    }
    return () => {
      if (blitzTimerRef.current) clearTimeout(blitzTimerRef.current);
    };
  }, [blitzActive, blitzTimeLeft, blitzHighScore]);

  // ==========================================
  // POINT 25: NẠP GÓI TỪ VỰNG KHỞI ĐẦU 1-CLICK
  // ==========================================
  const handleLoadStarterPack = (packName: string, packData: Omit<VocabWord, 'id' | 'box'>[]) => {
    const existingWordsLower = new Set(words.map(w => w.word.toLowerCase().trim()));
    const newItems: VocabWord[] = [];

    packData.forEach((item, idx) => {
      if (!existingWordsLower.has(item.word.toLowerCase().trim())) {
        newItems.push({
          id: `starter-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          box: 1, // Bắt đầu ở Hộp 1
          word: item.word,
          meaning: item.meaning,
          example: item.example
        });
      }
    });

    if (newItems.length === 0) {
      showPackToast(`ℹ️ Toàn bộ từ trong gói "${packName}" đã có sẵn trong sổ từ của bạn!`);
      return;
    }

    const updated = [...words, ...newItems];
    setWords(updated);

    // Lưu vào localStorage
    try {
      localStorage.setItem('sat_user_custom_vocab_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    showPackToast(`🎉 Đã nạp thành công +${newItems.length} từ vào Hộp 1 từ "${packName}"!`);
  };

  // #C041: ĐÁNH GIÁ 4 MỨC ĐỘ NHỚ CHUẨN FSRS (Again / Hard / Good / Easy)
  const handleFsrsReview = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (words.length === 0 || currentIndex >= words.length) return;
    const currentWord = words[currentIndex];
    
    let newBox = currentWord.box;
    const isRemembered = rating !== 'again';
    
    if (rating === 'again') {
      newBox = 1;
      // #C049: Tăng leech count khi Quên (Leech word)
      setLeechCounts(prev => {
        const next = { ...prev, [currentWord.id]: (prev[currentWord.id] || 0) + 1 };
        try {
          localStorage.setItem('sat_vocab_leech_counts', JSON.stringify(next));
        } catch (e) {
          console.warn(e);
        }
        return next;
      });
    } else if (rating === 'hard') {
      newBox = Math.max(1, currentWord.box); // Giữ nguyên mức
    } else if (rating === 'good') {
      newBox = Math.min(5, currentWord.box + 1); // Lên 1 bậc
    } else if (rating === 'easy') {
      newBox = Math.min(5, currentWord.box + 2); // Nhảy vọt 2 bậc
    }

    // Ghi nhận đánh giá FSRS vào localStorage
    try {
      const existingRatings = JSON.parse(localStorage.getItem('sat_vocab_fsrs_ratings') || '{}');
      existingRatings[currentWord.id] = {
        rating,
        reviewedAt: new Date().toISOString(),
        box: newBox
      };
      localStorage.setItem('sat_vocab_fsrs_ratings', JSON.stringify(existingRatings));
    } catch (e) {
      console.warn("FSRS storage error:", e);
    }

    const updatedWords = [...words];
    updatedWords[currentIndex] = { ...currentWord, box: newBox };
    setWords(updatedWords);
    try {
      localStorage.setItem('sat_user_custom_vocab_v1', JSON.stringify(updatedWords));
    } catch (e) {
      console.warn(e);
    }

    try {
      const res = await fetch('/api/vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordId: currentWord.id,
          isRemembered,
          rating,
          word: currentWord.word,
          meaning: currentWord.meaning,
          example: currentWord.example
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.economy) syncServerEconomy(data.economy);
      }
      updateQuestProgress('vocab', 1);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFlipped(false);
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Review trong Flashcard Leitner (Tương thích ngược gọi FSRS)
  const handleReview = async (isRemembered: boolean) => {
    await handleFsrsReview(isRemembered ? 'good' : 'again');
  };

  // ==========================================
  // POINT 28 & #C047/#C048/#C049: LỌC TỪ, TÌM KIẾM & BỘ LỌC NHANH
  // ==========================================
  const filteredWords = useMemo(() => {
    return words.filter(w => {
      const matchesSearch = !searchQuery.trim() || 
        w.word.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        w.meaning.toLowerCase().includes(searchQuery.toLowerCase().trim());
      
      const matchesBox = selectedBoxFilter === 'all' || w.box === selectedBoxFilter;
      
      let matchesQuick = true;
      if (quickFilter === 'due') {
        matchesQuick = w.box <= 2; // Hộp 1 & 2 cần ôn luyện gấp hôm nay
      } else if (quickFilter === 'top200') {
        const topWords = new Set([
          ...PACK_TOP15_ACADEMIC.map(p => p.word.toLowerCase()),
          ...PACK_TOP12_TRANSITIONS.map(p => p.word.toLowerCase()),
          ...PACK_TOP12_TONE.map(p => p.word.toLowerCase())
        ]);
        matchesQuick = topWords.has(w.word.toLowerCase());
      } else if (quickFilter === 'pinned') {
        matchesQuick = pinnedIds.includes(w.id);
      } else if (quickFilter === 'leech') {
        matchesQuick = (leechCounts[w.id] || 0) >= 1 || w.box === 1;
      }

      return matchesSearch && matchesBox && matchesQuick;
    });
  }, [words, searchQuery, selectedBoxFilter, quickFilter, pinnedIds, leechCounts]);

  // ==========================================
  // POINT 24: MINI-QUIZ ENGINE
  // ==========================================
  // Tạo bộ câu hỏi trắc nghiệm 4 lựa chọn
  const quizPool = words.length >= 4 ? words : QUIZ_FALLBACK_POOL.map((item, idx) => ({
    id: `fb-${idx}`,
    box: 1,
    word: item.word,
    meaning: item.meaning,
    example: item.example
  }));

  const currentQuizItem = quizPool[quizIndex % quizPool.length] || QUIZ_FALLBACK_POOL[0];

  const currentQuizOptions = useMemo(() => {
    if (!currentQuizItem) return [];
    const correctMeaning = currentQuizItem.meaning;
    
    // Chọn 3 distractors không trùng
    const otherMeanings = quizPool
      .filter(w => w.word !== currentQuizItem.word)
      .map(w => w.meaning);

    // Shuffle distractors
    const shuffledOthers = [...otherMeanings].sort(() => 0.5 - Math.random());
    const distractors = shuffledOthers.slice(0, 3);

    // Ghép và xáo trộn 4 đáp án
    const allOptions = [correctMeaning, ...distractors];
    // Seeded shuffle dựa trên word + quizIndex để ổn định trong cùng turn
    return allOptions.sort((a, b) => (a.charCodeAt(0) + a.length) - (b.charCodeAt(0) + b.length));
  }, [currentQuizItem?.word, quizIndex, quizPool.length]);

  const handleAnswerQuiz = (optionIdx: number) => {
    if (quizSubmitted) return;
    setQuizSelectedOption(optionIdx);
    setQuizSubmitted(true);

    const isCorrect = currentQuizOptions[optionIdx] === currentQuizItem.meaning;
    if (isCorrect) {
      setQuizScore(prev => prev + 10);
      setQuizStreak(prev => prev + 1);
      updateQuestProgress('vocab', 1);
    } else {
      setQuizStreak(0);
    }
  };

  const handleNextQuiz = () => {
    setQuizSubmitted(false);
    setQuizSelectedOption(null);
    setQuizIndex(prev => prev + 1);
  };

  // ==========================================
  // #C050: 60-SECOND BLITZ MODE ENGINE
  // ==========================================
  const blitzPool = words.length >= 4 ? words : QUIZ_FALLBACK_POOL.map((item, idx) => ({
    id: `blitz-fb-${idx}`,
    box: 1,
    word: item.word,
    meaning: item.meaning,
    example: item.example
  }));

  const currentBlitzItem = blitzPool[blitzIndex % blitzPool.length] || blitzPool[0];

  const currentBlitzOptions = useMemo(() => {
    if (!currentBlitzItem) return [];
    const correctMeaning = currentBlitzItem.meaning;
    const otherMeanings = blitzPool
      .filter(w => w.word !== currentBlitzItem.word)
      .map(w => w.meaning);
    const shuffledOthers = [...otherMeanings].sort(() => 0.5 - Math.random());
    const distractors = shuffledOthers.slice(0, 3);
    const allOptions = [correctMeaning, ...distractors];
    return allOptions.sort((a, b) => (a.charCodeAt(0) + a.length) - (b.charCodeAt(0) + b.length));
  }, [currentBlitzItem?.word, blitzIndex, blitzPool.length]);

  const startBlitz = () => {
    setBlitzScore(0);
    setBlitzStreak(0);
    setBlitzIndex(0);
    setBlitzTimeLeft(60);
    setBlitzSelectedOption(null);
    setBlitzFeedback(null);
    setBlitzActive(true);
  };

  const handleAnswerBlitz = (optionIdx: number) => {
    if (!blitzActive || blitzFeedback !== null) return;
    setBlitzSelectedOption(optionIdx);
    const isCorrect = currentBlitzOptions[optionIdx] === currentBlitzItem.meaning;
    if (isCorrect) {
      setBlitzFeedback('correct');
      const bonus = blitzStreak >= 3 ? 15 : 10;
      setBlitzScore(prev => prev + bonus);
      setBlitzStreak(prev => prev + 1);
      updateQuestProgress('vocab', 1);
    } else {
      setBlitzFeedback('wrong');
      setBlitzStreak(0);
    }

    setTimeout(() => {
      setBlitzFeedback(null);
      setBlitzSelectedOption(null);
      setBlitzIndex(prev => prev + 1);
    }, 350);
  };

  // Keyboard shortcut listener cho Flashcard FSRS & Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'flashcard' || words.length === 0 || currentIndex >= words.length) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (isFlipped) {
        if (e.key === '1') {
          e.preventDefault();
          handleFsrsReview('again');
        } else if (e.key === '2') {
          e.preventDefault();
          handleFsrsReview('hard');
        } else if (e.key === '3') {
          e.preventDefault();
          handleFsrsReview('good');
        } else if (e.key === '4') {
          e.preventDefault();
          handleFsrsReview('easy');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, isFlipped, words, currentIndex]);

  if (isLoading) {
    return <div className="text-center p-12 text-white">Đang tải hộp từ vựng Leitner...</div>;
  }

  if (loadError) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-[#1b2533] p-8 rounded-xl border border-[#ef4444]/40 text-center space-y-4">
        <div className="text-5xl">📡</div>
        <p className="text-gray-300">Không tải được hộp từ vựng. Kiểm tra kết nối rồi thử lại.</p>
        <button
          onClick={retry}
          className="text-sm font-bold bg-gradient-to-r from-yellow-300 to-amber-500 text-[#78350f] px-5 py-2 rounded-lg hover:from-yellow-200 hover:to-amber-400"
        >
          🔄 Thử lại
        </button>
      </div>
    );
  }

  const isEmpty = words.length === 0;
  const isFinished = !isEmpty && currentIndex >= words.length;
  const currentCardWord = words[currentIndex];
  const currentCardRoots = currentCardWord ? findMatchingRoots(currentCardWord.word) : [];
  const currentCardConfusable = currentCardWord ? findConfusablePair(currentCardWord.word) : null;
  const isCurrentCardPinned = currentCardWord ? pinnedIds.includes(currentCardWord.id) : false;
  const currentCardLeechCount = currentCardWord ? (leechCounts[currentCardWord.id] || 0) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* 🧭 THANH ĐIỀU HƯỚNG LIÊN THÔNG READING & VOCAB */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-[#0e1117] border border-[#262730] rounded-2xl shadow-sm">
        <Link
          href="/vocab"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30"
        >
          <span>🗂️</span> Sổ Từ Leitner SRS
        </Link>
        <Link
          href="/vocabulary"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#1b2533] text-gray-300 hover:text-white hover:bg-[#26354a] transition-all border border-transparent hover:border-teal-500/30"
        >
          <span>🔗</span> Từ Nối & Ngữ Cảnh
        </Link>
        <Link
          href="/reading"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#1b2533] text-gray-300 hover:text-white hover:bg-[#26354a] transition-all border border-transparent hover:border-amber-500/30"
        >
          <span>📖</span> Trung Tâm Đọc Hiểu (730+)
        </Link>
      </div>

      {/* Header */}
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">📚</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #c084fc, #a855f7)", WebkitBackgroundClip: "text" }}>
              LÀM CHỦ TỪ VỰNG SAT
            </h1>
            <p className="math-subtitle text-purple-200">
              Hệ thống Leitner Box 5 tầng, Gốc từ Latin/Hy Lạp & Trắc nghiệm phản xạ 4 đáp án.
            </p>
          </div>
        </div>
      </div>

      {/* Floating feedback alert */}
      {packFeedback && (
        <div className="p-4 rounded-xl bg-purple-950/90 border-2 border-purple-400 text-purple-200 text-sm font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
          <span>{packFeedback}</span>
          <button onClick={() => setPackFeedback(null)} className="text-gray-400 hover:text-white ml-3">✕</button>
        </div>
      )}

      {/* ========================================== */}
      {/* POINT 25: GÓI TỪ VỰNG KHỞI ĐẦU 1-CLICK (STARTER PACKS) */}
      {/* ========================================== */}
      <div className="bg-[#1b2533] border border-[#a855f7]/40 rounded-2xl p-5 shadow-[0_0_20px_rgba(168,85,247,0.12)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base font-black text-[#c084fc] flex items-center gap-2">
              <span>⚡</span> Nạp Gói Từ Vựng Khởi Đầu 1-Click (Point 25)
            </h3>
            <p className="text-xs text-gray-300 mt-0.5">
              Tự động thêm vào Sổ từ & Hộp Leitner 1 nếu chưa có — không trùng lặp, học ngay lập tức:
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-[#a855f7]/20 text-purple-300 border border-[#a855f7]/30 self-start md:self-auto">
            Tổng từ trong sổ: {words.length} từ
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => handleLoadStarterPack("Top 15 Từ Học Thuật", PACK_TOP15_ACADEMIC)}
            className="p-3.5 rounded-xl bg-[#0e1117] border border-[#262730] hover:border-purple-400 hover:bg-purple-950/30 text-left transition-all group shadow-sm"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">📦</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                15 từ
              </span>
            </div>
            <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
              Top 15 Từ Học Thuật
            </h4>
            <p className="text-[11px] text-gray-400 mt-0.5">
              ubiquitous, mitigate, ephemeral, pragmatic, bolster...
            </p>
          </button>

          <button
            onClick={() => handleLoadStarterPack("Top 12 Từ Nối Logic", PACK_TOP12_TRANSITIONS)}
            className="p-3.5 rounded-xl bg-[#0e1117] border border-[#262730] hover:border-teal-400 hover:bg-teal-950/30 text-left transition-all group shadow-sm"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">🔗</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300">
                12 từ
              </span>
            </div>
            <h4 className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">
              Top 12 Từ Nối Logic SAT
            </h4>
            <p className="text-[11px] text-gray-400 mt-0.5">
              nevertheless, consequently, conversely, albeit, hitherto...
            </p>
          </button>

          <button
            onClick={() => handleLoadStarterPack("Top 12 Từ Thái Độ", PACK_TOP12_TONE)}
            className="p-3.5 rounded-xl bg-[#0e1117] border border-[#262730] hover:border-amber-400 hover:bg-amber-950/30 text-left transition-all group shadow-sm"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">🎭</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                12 từ
              </span>
            </div>
            <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
              Top 12 Từ Chỉ Thái Độ (Tone)
            </h4>
            <p className="text-[11px] text-gray-400 mt-0.5">
              skeptical, optimistic, ambivalent, cynical, contemplative...
            </p>
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* MODE NAVIGATION TABS */}
      {/* ========================================== */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#0e1117] border border-[#262730] rounded-2xl">
        <button
          onClick={() => setViewMode('flashcard')}
          className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            viewMode === 'flashcard'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-[#1b2533]'
          }`}
        >
          <span>🃏</span> Lật Thẻ Flashcard Leitner
        </button>
        <button
          onClick={() => setViewMode('quiz')}
          className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            viewMode === 'quiz'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-[#1b2533]'
          }`}
        >
          <span>🎯</span> Trắc Nghiệm 4 Đáp Án (Point 24)
        </button>
        <button
          onClick={() => setViewMode('blitz')}
          className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            viewMode === 'blitz'
              ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-lg shadow-amber-500/30'
              : 'text-gray-400 hover:text-white hover:bg-[#1b2533]'
          }`}
        >
          <span>⚡</span> Phản Xạ 60s (Point 50)
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            viewMode === 'list'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-[#1b2533]'
          }`}
        >
          <span>📋</span> Tra Cứu & Hộp Leitner (Point 28)
        </button>
        <button
          onClick={() => setViewMode('roots')}
          className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            viewMode === 'roots'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-[#1b2533]'
          }`}
        >
          <span>🧬</span> Cẩm Nang Gốc Từ SAT (Point 22)
        </button>
      </div>

      {/* ========================================== */}
      {/* VIEW 1: FLASHCARD LEITNER BOX & FSRS */}
      {/* ========================================== */}
      {viewMode === 'flashcard' && (
        <div className="space-y-6">
          {isEmpty ? (
            <div className="bg-[#1b2533] p-12 rounded-xl border border-[#262730] text-center space-y-4">
              <div className="text-6xl mb-2">📭</div>
              <h2 className="text-2xl font-black text-white">Chưa có từ nào trong Hộp ôn tập</h2>
              <p className="text-gray-400 text-sm max-w-md mx-auto">
                Nhấn một trong 3 gói từ vựng khởi đầu phía trên để nạp ngay 15 từ học thuật hay thi nhất vào Hộp 1!
              </p>
              <button
                onClick={() => handleLoadStarterPack("Top 15 Từ Học Thuật", PACK_TOP15_ACADEMIC)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm shadow-lg hover:scale-105 transition-transform"
              >
                📦 Nạp Top 15 Từ Học Thuật Ngay
              </button>
            </div>
          ) : !isFinished ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 text-gray-400 text-sm px-2">
                <div className="flex items-center gap-3">
                  <span>Tiến độ ôn tập hôm nay: <strong className="text-purple-300 font-mono">{currentIndex + 1} / {words.length}</strong> từ</span>
                  <button
                    onClick={() => { setCurrentIndex(0); setIsFlipped(false); }}
                    className="text-xs text-gray-400 hover:text-white underline"
                  >
                    Bắt đầu lại
                  </button>
                </div>

                {/* #C042: Toggle Chế độ Điền từ Ngữ cảnh (Cloze Mode) */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleClozeMode}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      clozeMode
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                        : 'bg-[#0e1117] text-gray-400 hover:text-white border-[#262730]'
                    }`}
                    title="Chế độ điền từ ngữ cảnh SAT: Ẩn từ khóa trong câu ví dụ để tự đoán nghĩa trước khi lật thẻ"
                  >
                    <span>🧩</span> Điền từ Ngữ cảnh (Cloze): <strong>{clozeMode ? 'BẬT' : 'TẮT'}</strong>
                  </button>
                </div>
              </div>

              {/* Thẻ Flashcard chính */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                role="button"
                tabIndex={0}
                aria-label="Thẻ từ vựng — nhấn để lật"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsFlipped(!isFlipped); } }}
                className="bg-[#1b2533] p-8 rounded-2xl border border-[#262730] flex flex-col items-center justify-center min-h-[340px] shadow-[0_0_25px_rgba(168,85,247,0.18)] relative overflow-hidden cursor-pointer transition-all hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#a855f7]/10 to-transparent pointer-events-none" />
                
                {/* Top Controls on Flashcard */}
                <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
                  {/* Point 26 & #C046: Audio Button trên thẻ Flashcard */}
                  <button
                    onClick={(e) => speakWord(currentCardWord.word, e)}
                    title="Nghe phát âm chuẩn Mỹ (en-US)"
                    className="p-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 border border-purple-500/30 transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm"
                  >
                    <span>🔊</span>
                    <span className="hidden sm:inline">Phát âm</span>
                  </button>

                  {/* #C049: Leech Word Badge */}
                  {currentCardLeechCount >= 1 && (
                    <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 shadow-sm">
                      <span>🔥</span> Hay quên ({currentCardLeechCount}x)
                    </span>
                  )}
                </div>

                <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                  {/* #C045: Nút Ghim từ cá nhân (Star/Pin) */}
                  <button
                    onClick={(e) => togglePinWord(currentCardWord.id, e)}
                    title={isCurrentCardPinned ? "Bỏ ghim khỏi Sổ từ khó" : "Ghim vào Sổ từ khó cá nhân"}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                      isCurrentCardPinned
                        ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                        : 'bg-[#0e1117]/80 text-gray-400 hover:text-amber-300 border-[#262730]'
                    }`}
                  >
                    <span>{isCurrentCardPinned ? '⭐ Đã ghim' : '☆ Ghim'}</span>
                  </button>

                  {/* Leitner Box Badge */}
                  <div className="bg-gradient-to-r from-[#a855f7] to-purple-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-md">
                    Leitner Hộp {currentCardWord.box} / 5
                  </div>
                </div>

                {!isFlipped ? (
                  <div className="text-center space-y-4 my-auto w-full max-w-xl">
                    <div className="text-gray-400 text-xs tracking-wider uppercase animate-pulse">
                      Click thẻ hoặc bấm phím Space để lật
                    </div>
                    <h2 className="text-5xl font-black text-white tracking-tight">{currentCardWord.word}</h2>
                    
                    {/* #C042: Khi bật Cloze Mode, hiện câu ví dụ che từ bằng [ _______ ] */}
                    {clozeMode && currentCardWord.example && (
                      <div className="p-4 rounded-xl bg-[#0e1117] border border-amber-500/30 text-amber-100 text-sm leading-relaxed text-center shadow-inner">
                        <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1.5">
                          🧩 Thử thách Điền từ vào ngữ cảnh SAT (Cloze Mode):
                        </span>
                        {renderClozeSentence(currentCardWord.example, currentCardWord.word, false)}
                      </div>
                    )}

                    {/* Point 22: Gốc từ preview nếu tìm thấy */}
                    {currentCardRoots.length > 0 && (
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        {currentCardRoots.map((r, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-950/80 text-purple-300 border border-purple-700/50"
                          >
                            🧬 Gốc &quot;{r.root}&quot; ({r.vietnameseMeaning})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="animate-in zoom-in-95 duration-300 text-center space-y-3.5 my-auto max-w-xl w-full">
                    <div className="flex items-center justify-center gap-3">
                      <h2 className="text-3xl font-black text-[#c084fc]">{currentCardWord.word}</h2>
                      <button
                        onClick={(e) => speakWord(currentCardWord.word, e)}
                        className="text-lg hover:scale-125 transition-transform"
                        title="Nghe phát âm chuẩn Mỹ"
                      >
                        🔊
                      </button>
                    </div>

                    <p className="text-[#a855f7] font-bold text-xl leading-relaxed">
                      {currentCardWord.meaning}
                    </p>

                    {/* #C042: Ngữ cảnh có highlight từ */}
                    <div className="p-3.5 rounded-xl bg-[#0e1117] border border-[#262730] text-gray-200 text-sm leading-relaxed text-left">
                      <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
                        📖 Ngữ cảnh đề thi SAT:
                      </span>
                      {renderClozeSentence(currentCardWord.example, currentCardWord.word, true)}
                    </div>

                    {/* #C044: Cặp từ dễ nhầm lẫn trong Digital SAT */}
                    {currentCardConfusable && (
                      <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-left text-xs space-y-1">
                        <span className="font-bold text-amber-300 flex items-center gap-1.5">
                          <span>⚠️</span> Cặp từ dễ nhầm lẫn trong Digital SAT (#C044):
                        </span>
                        <p className="text-amber-100 font-medium leading-relaxed">
                          {currentCardConfusable.distinction}
                        </p>
                      </div>
                    )}

                    {/* #C043: Chi tiết gốc từ, tiền tố, hậu tố */}
                    {currentCardRoots.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-left text-xs space-y-1">
                        <span className="font-bold text-purple-300 flex items-center gap-1.5">
                          <span>🔍</span> Phân tích Gốc từ (Root / Prefix / Suffix - #C043):
                        </span>
                        {currentCardRoots.map((r, i) => (
                          <p key={i} className="text-gray-300">
                            • <strong className="text-white font-mono">{r.root}</strong> ({r.typeLabel}): {r.vietnameseMeaning} — <em>(VD: {r.examples.join(', ')})</em>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* #C041: 4 Mức độ nhớ chuẩn FSRS (Again / Hard / Good / Easy) */}
              <div className={`space-y-2 transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                  <button
                    onClick={() => handleFsrsReview('again')}
                    className="p-3.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition-all hover:scale-105 border border-rose-400/40 flex flex-col items-center gap-1"
                  >
                    <span className="text-sm">❌ Quên (Again)</span>
                    <span className="text-[10px] text-rose-200 font-normal">Về Hộp 1 • Ôn ngay [1]</span>
                  </button>

                  <button
                    onClick={() => handleFsrsReview('hard')}
                    className="p-3.5 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition-all hover:scale-105 border border-amber-400/40 flex flex-col items-center gap-1"
                  >
                    <span className="text-sm">⚠️ Khó (Hard)</span>
                    <span className="text-[10px] text-amber-200 font-normal">Giữ Hộp {currentCardWord.box} • Ôn 1 ngày [2]</span>
                  </button>

                  <button
                    onClick={() => handleFsrsReview('good')}
                    className="p-3.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all hover:scale-105 border border-emerald-400/40 flex flex-col items-center gap-1"
                  >
                    <span className="text-sm">✅ Đã nhớ (Good)</span>
                    <span className="text-[10px] text-emerald-200 font-normal">Lên Hộp {Math.min(5, currentCardWord.box + 1)} • Ôn 3 ngày [3]</span>
                  </button>

                  <button
                    onClick={() => handleFsrsReview('easy')}
                    className="p-3.5 rounded-xl bg-sky-600/90 hover:bg-sky-500 text-white font-bold text-xs shadow-lg transition-all hover:scale-105 border border-sky-400/40 flex flex-col items-center gap-1"
                  >
                    <span className="text-sm">⚡ Quá dễ (Easy)</span>
                    <span className="text-[10px] text-sky-200 font-normal">Nhảy Hộp {Math.min(5, currentCardWord.box + 2)} • Ôn 7 ngày [4]</span>
                  </button>
                </div>
                <div className="text-center text-[11px] text-gray-400">
                  Phím tắt: Bấm <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-gray-600 text-white font-mono text-[10px]">Space</kbd> để lật thẻ • Bấm <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-gray-600 text-white font-mono text-[10px]">1</kbd>–<kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-gray-600 text-white font-mono text-[10px]">4</kbd> để đánh giá FSRS
                </div>
              </div>
            </>
          ) : (
            <div className="bg-[#1b2533] p-12 rounded-2xl border border-[#a855f7] text-center shadow-[0_0_30px_rgba(168,85,247,0.2)] space-y-4">
              <div className="text-6xl mb-2">🏆</div>
              <h2 className="text-3xl font-black text-white">HOÀN THÀNH MỤC TIÊU HÔM NAY!</h2>
              <p className="text-[#c084fc] text-base">Bạn đã ôn tập xong toàn bộ {words.length} từ trong đợt Leitner này.</p>
              <div className="flex justify-center gap-3 pt-4">
                <button
                  onClick={() => { setCurrentIndex(0); setIsFlipped(false); }}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                >
                  🔄 Ôn lại vòng nữa
                </button>
                <button
                  onClick={() => setViewMode('quiz')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  🎯 Thử thách Trắc nghiệm 4 Đáp án
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW 2: POINT 24 - TRẮC NGHIỆM 4 ĐÁP ÁN (MINI-QUIZ) */}
      {/* ========================================== */}
      {viewMode === 'quiz' && (
        <div className="space-y-6">
          {/* Score & Streak Header */}
          <div className="bg-[#1b2533] p-5 rounded-2xl border border-purple-500/40 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <span>🎯</span> Mini-Quiz Phản Xạ 4 Đáp Án (Point 24)
              </h3>
              <p className="text-xs text-gray-300 mt-0.5">
                Rèn luyện khả năng nhận diện nghĩa và phản xạ từ vựng SAT trong vòng 5 giây:
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="px-3.5 py-1.5 rounded-xl bg-[#0e1117] border border-[#262730] flex items-center gap-2">
                <span className="text-base">🔥</span>
                <span className="text-xs text-gray-400">Chuỗi đúng:</span>
                <span className="text-amber-400 font-black font-mono">{quizStreak}</span>
              </div>
              <div className="px-3.5 py-1.5 rounded-xl bg-purple-950/50 border border-purple-500/40 flex items-center gap-2">
                <span className="text-base">⭐</span>
                <span className="text-xs text-gray-300">Điểm:</span>
                <span className="text-purple-300 font-black font-mono">{quizScore} pts</span>
              </div>
            </div>
          </div>

          {/* Quiz Card */}
          <div className="bg-[#1b2533] p-8 rounded-2xl border border-[#262730] shadow-xl space-y-6">
            <div className="text-center space-y-3 pb-4 border-b border-[#262730]">
              <span className="text-xs text-purple-400 uppercase tracking-wider font-bold">
                Câu hỏi số #{quizIndex + 1}
              </span>
              
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-4xl font-black text-white">{currentQuizItem.word}</h2>
                {/* Point 26: Audio Button trong Mini-Quiz */}
                <button
                  onClick={() => speakWord(currentQuizItem.word)}
                  title="Nghe phát âm chuẩn Mỹ (en-US)"
                  className="p-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 border border-purple-500/30 transition-all text-sm font-bold"
                >
                  🔊
                </button>
              </div>

              <p className="text-xs text-gray-400">
                Hãy chọn định nghĩa tiếng Việt chính xác nhất cho từ vựng trên:
              </p>
            </div>

            {/* 4 Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {currentQuizOptions.map((opt, idx) => {
                const isSelected = quizSelectedOption === idx;
                const isCorrect = opt === currentQuizItem.meaning;
                let btnStyle = "bg-[#0e1117] border-[#262730] text-gray-200 hover:border-purple-400 hover:bg-purple-950/20";

                if (quizSubmitted) {
                  if (isCorrect) {
                    btnStyle = "bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]";
                  } else if (isSelected && !isCorrect) {
                    btnStyle = "bg-rose-950/60 border-rose-500 text-rose-200 font-bold";
                  } else {
                    btnStyle = "bg-[#0e1117]/60 border-[#262730] text-gray-500 opacity-60";
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={quizSubmitted}
                    onClick={() => handleAnswerQuiz(idx)}
                    className={`p-4 rounded-xl border text-left text-sm transition-all flex items-start gap-3 ${btnStyle}`}
                  >
                    <span className="w-6 h-6 rounded-md bg-[#1b2533] border border-[#262730] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="leading-snug">{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Feedback & Next Button */}
            {quizSubmitted && (
              <div className="pt-4 border-t border-[#262730] flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-300">
                <div className="text-sm">
                  {quizSelectedOption !== null && currentQuizOptions[quizSelectedOption] === currentQuizItem.meaning ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <span>✅</span> Chính xác tuyệt đối! (+10 điểm)
                    </span>
                  ) : (
                    <span className="text-rose-400 font-bold flex items-center gap-1.5">
                      <span>❌</span> Chưa chính xác. Hãy ghi nhớ nghĩa đúng màu xanh!
                    </span>
                  )}
                  <p className="text-xs text-gray-400 italic mt-1">
                    &quot;{currentQuizItem.example}&quot;
                  </p>
                </div>

                <button
                  onClick={handleNextQuiz}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm shadow-md hover:scale-105 transition-transform"
                >
                  Câu tiếp theo ➔
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW: #C050 - THỬ THÁCH PHẢN XẠ 60 GIÂY (BLITZ MODE) */}
      {/* ========================================== */}
      {viewMode === 'blitz' && (
        <div className="space-y-6">
          {/* Blitz Stats & Timer Header */}
          <div className="bg-[#1b2533] p-5 rounded-2xl border border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)] flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <span>⚡</span> Thử Thách Phản Xạ 60 Giây (Blitz Mode - #C050)
              </h3>
              <p className="text-xs text-gray-300 mt-0.5">
                Chạy đua với đồng hồ: Trả lời càng nhiều từ vựng SAT đúng càng tốt trong 60 giây!
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 font-mono font-black text-lg transition-all ${
                blitzTimeLeft <= 10 && blitzActive
                  ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
                  : 'bg-[#0e1117] border-amber-500/40 text-amber-300'
              }`}>
                <span>⏱️</span>
                <span>{blitzTimeLeft}s</span>
              </div>

              <div className="px-3.5 py-1.5 rounded-xl bg-[#0e1117] border border-[#262730] flex items-center gap-2">
                <span className="text-base">🔥</span>
                <span className="text-xs text-gray-400">Combo:</span>
                <span className="text-amber-400 font-black font-mono">{blitzStreak}</span>
              </div>

              <div className="px-3.5 py-1.5 rounded-xl bg-purple-950/50 border border-purple-500/40 flex items-center gap-2">
                <span className="text-base">⭐</span>
                <span className="text-xs text-gray-300">Điểm:</span>
                <span className="text-purple-300 font-black font-mono">{blitzScore}</span>
              </div>

              <div className="px-3.5 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-center gap-2">
                <span className="text-base">🏆</span>
                <span className="text-xs text-amber-400">Kỷ lục:</span>
                <span className="text-amber-300 font-black font-mono">{blitzHighScore}</span>
              </div>
            </div>
          </div>

          {/* Animated Countdown Progress Bar */}
          {blitzActive && (
            <div className="w-full bg-[#0e1117] h-2 rounded-full overflow-hidden border border-[#262730]">
              <div
                className={`h-full transition-all duration-1000 ease-linear ${
                  blitzTimeLeft <= 10 ? 'bg-rose-500' : 'bg-gradient-to-r from-amber-400 to-rose-500'
                }`}
                style={{ width: `${(blitzTimeLeft / 60) * 100}%` }}
              />
            </div>
          )}

          {/* Blitz Content: Not started vs Active vs Game Over */}
          {!blitzActive && blitzTimeLeft === 60 ? (
            <div className="bg-[#1b2533] p-12 rounded-2xl border border-amber-500/40 text-center space-y-5 shadow-xl">
              <div className="text-6xl animate-bounce">⚡</div>
              <h2 className="text-3xl font-black text-white">SẴN SÀNG CHO 60 GIÂY BÙNG NỔ?</h2>
              <p className="text-gray-300 text-sm max-w-lg mx-auto leading-relaxed">
                Mỗi câu trả lời đúng cộng 10 điểm (combo từ 3 câu trở lên cộng 15 điểm). Trả lời sai chuỗi combo trở về 0. Luyện phản xạ nhận diện tức thì trong đề thi Digital SAT!
              </p>
              <button
                onClick={startBlitz}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-base shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:scale-105 transition-all"
              >
                🚀 BẮT ĐẦU NGAY (60 GIÂY)
              </button>
            </div>
          ) : !blitzActive && blitzTimeLeft === 0 ? (
            <div className="bg-[#1b2533] p-12 rounded-2xl border border-purple-500 text-center space-y-5 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
              <div className="text-6xl">🏁</div>
              <h2 className="text-3xl font-black text-white">HẾT GIỜ! HOÀN THÀNH BLITZ</h2>
              <div className="flex justify-center items-center gap-6 py-3">
                <div className="text-center">
                  <div className="text-xs text-gray-400 uppercase tracking-wider">Tổng điểm</div>
                  <div className="text-4xl font-black text-amber-400 font-mono">{blitzScore} pts</div>
                </div>
                <div className="h-10 w-px bg-gray-700" />
                <div className="text-center">
                  <div className="text-xs text-gray-400 uppercase tracking-wider">Kỷ lục cao nhất</div>
                  <div className="text-4xl font-black text-purple-300 font-mono">{blitzHighScore} pts</div>
                </div>
              </div>
              {blitzScore >= blitzHighScore && blitzScore > 0 && (
                <div className="text-emerald-400 font-bold text-sm bg-emerald-950/40 border border-emerald-500/40 p-2.5 rounded-xl max-w-md mx-auto">
                  🎉 Chúc mừng! Bạn vừa thiết lập kỷ lục phản xạ cá nhân mới!
                </div>
              )}
              <div className="pt-2">
                <button
                  onClick={startBlitz}
                  className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-sm shadow-lg hover:scale-105 transition-transform"
                >
                  🔄 Thử Thách Lại (60s)
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#1b2533] p-8 rounded-2xl border border-[#262730] shadow-xl space-y-6">
              <div className="text-center space-y-3 pb-4 border-b border-[#262730]">
                <span className="text-xs text-amber-400 uppercase tracking-wider font-bold">
                  Từ vựng #{blitzIndex + 1}
                </span>

                <div className="flex items-center justify-center gap-3">
                  <h2 className="text-4xl font-black text-white">{currentBlitzItem.word}</h2>
                  <button
                    onClick={() => speakWord(currentBlitzItem.word)}
                    title="Nghe phát âm chuẩn Mỹ (en-US)"
                    className="p-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 border border-purple-500/30 transition-all text-sm font-bold"
                  >
                    🔊
                  </button>
                </div>

                <p className="text-xs text-gray-400">
                  Chọn thật nhanh định nghĩa chính xác nhất:
                </p>
              </div>

              {/* 4 Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {currentBlitzOptions.map((opt, idx) => {
                  const isSelected = blitzSelectedOption === idx;
                  const isCorrect = opt === currentBlitzItem.meaning;
                  let btnStyle = "bg-[#0e1117] border-[#262730] text-gray-200 hover:border-amber-400 hover:bg-amber-950/20";

                  if (blitzFeedback !== null) {
                    if (isCorrect) {
                      btnStyle = "bg-emerald-950/80 border-emerald-500 text-emerald-200 font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)]";
                    } else if (isSelected && !isCorrect) {
                      btnStyle = "bg-rose-950/80 border-rose-500 text-rose-200 font-bold";
                    } else {
                      btnStyle = "bg-[#0e1117]/60 border-[#262730] text-gray-500 opacity-60";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={blitzFeedback !== null}
                      onClick={() => handleAnswerBlitz(idx)}
                      className={`p-4 rounded-xl border text-left text-sm transition-all flex items-start gap-3 ${btnStyle}`}
                    >
                      <span className="w-6 h-6 rounded-md bg-[#1b2533] border border-[#262730] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="leading-snug">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW 3: POINT 28 - TRA CỨU & BỘ LỌC LEITNER BOX 1-5 */}
      {/* ========================================== */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          <div className="bg-[#1b2533] p-6 rounded-2xl border border-purple-500/30 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <span>📋</span> Tra Cứu Từ Vựng & Hộp Leitner Box 1–5 (Point 28)
                </h3>
                <p className="text-xs text-gray-300 mt-0.5">
                  Lọc theo 5 tầng ghi nhớ ngắt quãng của Hermann Ebbinghaus & tìm nhanh theo từ vựng hoặc nghĩa tiếng Việt:
                </p>
              </div>

              {/* Ô tìm kiếm từ vựng */}
              <div className="w-full md:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Tìm từ tiếng Anh hoặc nghĩa..."
                  className="w-full px-4 py-2 rounded-xl bg-[#0e1117] border border-[#262730] text-sm text-white focus:outline-none focus:border-purple-400 placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Nút lọc theo từng Hộp Leitner Box 1-5 */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#262730]">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Hộp Leitner:</span>
              <button
                onClick={() => setSelectedBoxFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedBoxFilter === 'all'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-[#0e1117] text-gray-300 hover:text-white border border-[#262730]'
                }`}
              >
                Tất cả ({words.length})
              </button>
              {[1, 2, 3, 4, 5].map(b => {
                const count = words.filter(w => w.box === b).length;
                const label = b === 1 ? 'Mới' : b === 5 ? 'Thuộc lòng' : `Cấp ${b}`;
                return (
                  <button
                    key={b}
                    onClick={() => setSelectedBoxFilter(b)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedBoxFilter === b
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-[#0e1117] text-gray-300 hover:text-white border border-[#262730]'
                    }`}
                  >
                    Hộp {b} ({label}: {count})
                  </button>
                );
              })}
            </div>

            {/* #C047, #C048, #C049: Thanh Bộ Lọc Nhanh Thông Minh */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#262730]">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Bộ lọc thông minh:</span>
              <button
                onClick={() => setQuickFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  quickFilter === 'all'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-[#0e1117] text-gray-300 hover:text-white border border-[#262730]'
                }`}
              >
                <span>🌐</span> Tất cả ({words.length})
              </button>
              <button
                onClick={() => setQuickFilter('due')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  quickFilter === 'due'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-[#0e1117] text-gray-300 hover:text-white border border-[#262730]'
                }`}
              >
                <span>⏰</span> Đến hạn ôn (Hộp 1-2: {words.filter(w => w.box <= 2).length})
              </button>
              <button
                onClick={() => setQuickFilter('top200')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  quickFilter === 'top200'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-[#0e1117] text-gray-300 hover:text-white border border-[#262730]'
                }`}
              >
                <span>🎯</span> Top Sát Thi (Core 39)
              </button>
              <button
                onClick={() => setQuickFilter('pinned')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  quickFilter === 'pinned'
                    ? 'bg-amber-500 text-gray-950 font-black shadow-md'
                    : 'bg-[#0e1117] text-amber-300 hover:text-white border border-amber-500/30'
                }`}
              >
                <span>⭐</span> Đã ghim ({pinnedIds.length})
              </button>
              <button
                onClick={() => setQuickFilter('leech')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  quickFilter === 'leech'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'bg-[#0e1117] text-rose-300 hover:text-white border border-rose-500/30'
                }`}
              >
                <span>🔥</span> Hay quên (Leech: {Object.values(leechCounts).filter(c => c >= 2).length})
              </button>
            </div>
          </div>

          {/* Grid danh sách từ */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWords.map(w => {
              const matchingRoots = findMatchingRoots(w.word);
              const confusable = findConfusablePair(w.word);
              const isPinned = pinnedIds.includes(w.id);
              const leechCount = leechCounts[w.id] || 0;

              return (
                <div
                  key={w.id}
                  className="bg-[#1b2533] p-5 rounded-2xl border border-[#262730] hover:border-purple-500/40 transition-all flex flex-col justify-between shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-md ${
                          w.box === 5 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                          w.box >= 3 ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                          'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          Hộp {w.box} / 5
                        </span>
                        {leechCount >= 1 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                            🔥 {leechCount}x
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* #C045: Pin button */}
                        <button
                          onClick={(e) => togglePinWord(w.id, e)}
                          title={isPinned ? "Bỏ ghim" : "Ghim vào Sổ từ khó cá nhân (#C045)"}
                          className={`p-1.5 rounded-lg border text-xs transition-colors ${
                            isPinned
                              ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                              : 'bg-[#0e1117] text-gray-500 hover:text-amber-300 border-[#262730]'
                          }`}
                        >
                          {isPinned ? '⭐' : '☆'}
                        </button>

                        {/* Point 26 & #C046: Audio Button trên từng mục danh sách */}
                        <button
                          onClick={(e) => speakWord(w.word, e)}
                          title="Nghe phát âm chuẩn Mỹ (en-US)"
                          className="p-1.5 rounded-lg bg-[#0e1117] hover:bg-purple-950/60 text-purple-300 border border-[#262730] text-xs transition-colors flex items-center gap-1"
                        >
                          🔊
                        </button>
                      </div>
                    </div>

                    <h4 className="text-xl font-black text-white mb-1.5">{w.word}</h4>
                    <p className="text-sm text-purple-200 font-semibold mb-3">{w.meaning}</p>
                    
                    <p className="text-xs text-gray-400 italic bg-[#0e1117] p-2.5 rounded-lg border border-[#262730] mb-3 leading-relaxed">
                      &quot;{w.example}&quot;
                    </p>

                    {/* #C044: Cặp từ dễ nhầm lẫn trong Digital SAT */}
                    {confusable && (
                      <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200 mb-3 leading-relaxed">
                        <strong className="text-amber-300 flex items-center gap-1 mb-0.5">
                          <span>⚠️</span> Cặp từ dễ nhầm với &quot;{confusable.pairWith}&quot;:
                        </strong>
                        {confusable.distinction}
                      </div>
                    )}
                  </div>

                  {/* Point 22 & #C043: Root tags */}
                  {matchingRoots.length > 0 && (
                    <div className="pt-2 border-t border-[#262730] flex flex-wrap gap-1.5">
                      {matchingRoots.map((r, i) => (
                        <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
                          🧬 {r.root}- ({r.vietnameseMeaning})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredWords.length === 0 && (
              <div className="col-span-full p-10 text-center text-gray-400 bg-[#1b2533] rounded-2xl border border-[#262730]">
                Không tìm thấy từ vựng nào khớp với điều kiện lọc hiện tại.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW 4: POINT 22 - CẨM NANG GỐC TỪ SAT (ROOTS & AFFIXES) */}
      {/* ========================================== */}
      {viewMode === 'roots' && (
        <div className="space-y-6">
          <div className="bg-[#1b2533] p-6 rounded-2xl border border-purple-500/30">
            <h3 className="text-xl font-black text-[#c084fc] flex items-center gap-2">
              <span>🧬</span> Cẩm Nang Gốc Từ Latin & Hy Lạp Hay Thi Nhất (Point 22)
            </h3>
            <p className="text-xs text-gray-300 mt-1">
              Hơn 60% từ vựng khó trong Digital SAT được tạo thành từ các gốc từ, tiền tố và hậu tố sau. Nắm vững gốc từ giúp bạn đoán chuẩn xác 90% từ lạ gặp lần đầu trong đề thi:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SAT_ROOTS.map((rootItem, idx) => (
              <div
                key={idx}
                className="bg-[#1b2533] border border-[#262730] hover:border-purple-500/40 rounded-2xl p-5 transition-all flex flex-col justify-between shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-black font-mono text-purple-300">
                      {rootItem.root}-
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      rootItem.type === 'prefix' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
                      rootItem.type === 'root' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                      'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {rootItem.typeLabel}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-white mb-1">
                    Nghĩa: {rootItem.vietnameseMeaning}
                  </p>
                  <p className="text-xs text-gray-400 font-mono mb-4">
                    Gốc chuẩn: &quot;{rootItem.meaning}&quot;
                  </p>
                </div>

                <div className="pt-3 border-t border-[#262730]">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1.5">
                    Các từ vựng tiêu biểu trong SAT:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {rootItem.examples.map((ex, i) => (
                      <span
                        key={i}
                        onClick={() => speakWord(ex)}
                        title="Click để nghe phát âm"
                        className="px-2 py-0.5 rounded-md text-xs font-mono bg-[#0e1117] text-purple-200 border border-[#262730] hover:border-purple-400 cursor-pointer transition-colors"
                      >
                        {ex} 🔊
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
