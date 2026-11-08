'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';
import { GATE_QUESTIONS, GATE_PASS_THRESHOLD, RETRY_CORRECT_NEEDED } from '@/lib/gate-exam';
import Link from 'next/link';

/**
 * GATE EXAM (BOSS ASSESSMENT)
 *
 * Đánh giá năng lực vượt cổng chuyên đề SAT.
 *
 * POINT 71: Danh sách kiểm tra 5 kiến thức/công thức cốt lõi trước khi thi Gate Exam
 * POINT 88: Chứng nhận Vượt Cửa Ải (Domain Mastery Certificate) đẹp mắt kèm nút In / Lưu PDF.
 */

type Phase = 'loading' | 'not_eligible' | 'intro' | 'countdown' | 'fighting' | 'result';

interface GateProgress {
  passed: boolean;
  lastAttempt: string;
  score: number;
  correctSinceFail: number;
}

/** 5 kiến thức trọng tâm theo từng Domain (Point 71) */
const DOMAIN_CORE_CHECKLIST: Record<string, { domainTitle: string; items: string[] }> = {
  algebra: {
    domainTitle: 'Đại Số & Hàm Số Tuyến Tính (Algebra)',
    items: [
      'Phương trình bậc nhất y = mx + b: Hệ số góc m = (y2 - y1)/(x2 - x1), b là tung độ gốc (initial value / y-intercept).',
      'Hệ phương trình 2 ẩn: Vô số nghiệm khi 2 đường trùng nhau; Vô nghiệm khi song song (m1 = m2 nhưng b1 ≠ b2).',
      'Bất phương trình: Nhớ đảo chiều dấu bất đẳng thức ngay lập tức khi nhân hoặc chia hai vế với số âm.',
      'Ý nghĩa thực tế: Hệ số góc m là tốc độ thay đổi (rate of change/per unit), hằng số b là phí cố định (flat fee/base).',
      'Desmos siêu tốc: Nhập trực tiếp hai phương trình vào Desmos để đọc tọa độ giao điểm trong 3 giây.'
    ]
  },
  advanced_math: {
    domainTitle: 'Toán Cao Cấp & Đa Thức (Advanced Math)',
    items: [
      'Parabol y = ax² + bx + c: Đỉnh (h, k) với h = -b/(2a), k = f(h). Nếu a > 0 bề lõm quay lên (minimum), a < 0 quay xuống (maximum).',
      'Biệt thức Δ = b² - 4ac: Δ > 0 (2 nghiệm), Δ = 0 (1 nghiệm kép), Δ < 0 (không có nghiệm thực).',
      'Hàm số mũ y = a(1 ± r)ᵗ: a là lượng khởi đầu, r là tỉ lệ phần trăm tăng/giảm, (1 ± r) là hệ số nhân.',
      'Phân thức & Căn thức: Luôn thế lại nghiệm vào phương trình gốc để loại bỏ nghiệm ngoại lai (extraneous solutions).',
      'Desmos mẹo: Dùng cú pháp y1 ~ ax1² + bx1 + c hoặc slider để khớp hệ số cực kỳ chính xác.'
    ]
  },
  problem_solving: {
    domainTitle: 'Giải Quyết Vấn Đề & Phân Tích Dữ Liệu (Data Analysis)',
    items: [
      'Tỉ lệ thức & Đơn vị: Sử dụng phân tích thứ nguyên (unit conversion) gạch chéo đơn vị để không bị đảo ngược mẫu/tử.',
      'Xác suất có điều kiện: Chú ý mẫu số của câu hỏi ("Given that...", "Of the students who...") để thu hẹp đúng nhóm mẫu.',
      'Mean vs Median: Giá trị ngoại lai cực lớn/cực nhỏ (outliers) kéo lệch Mean rất mạnh nhưng hầu như không ảnh hưởng Median.',
      'Sai số biên & Khoảng tin cậy: Kích thước mẫu khảo sát càng lớn (larger sample size) thì Margin of Error càng hẹp.',
      'Đồ thị phân tán (Scatterplot): Phân biệt rõ tương quan (correlation) và quan hệ nhân quả (causation).'
    ]
  },
  geometry: {
    domainTitle: 'Hình Học & Lượng Giác (Geometry & Trigonometry)',
    items: [
      'Tam giác vuông đặc biệt: 30°-60°-90° (tỉ lệ 1 : √3 : 2) và 45°-45°-90° (tỉ lệ 1 : 1 : √2).',
      'Lượng giác bù nhau: sin(x) = cos(90° - x); sin²(x) + cos²(x) = 1; SOH CAH TOA.',
      'Phương trình đường tròn: (x - h)² + (y - k)² = r² với tâm I(h, k) và bán kính r. Chú ý hoàn thành bình phương.',
      'Độ dài cung & Diện tích quạt: s = rθ và A = ½r²θ (khi góc θ được tính bằng đơn vị Radian).',
      'Tỉ số đồng dạng: Cạnh tỉ lệ k → Diện tích tỉ lệ k² → Thể tích tỉ lệ k³.'
    ]
  },
  reading_writing: {
    domainTitle: 'Đọc Hiểu & Ngữ Pháp Tiếng Anh (Reading & Writing)',
    items: [
      'Boundaries: Dấu chấm phẩy (;) và phẩy kèm FANBOYS chỉ dùng để nối 2 mệnh đề độc lập (Independent Clauses).',
      'Dấu hai chấm (:) và Gạch ngang đơn (—): Bắt buộc phía trước phải là một câu hoàn chỉnh độc lập.',
      'Transitions (Từ nối): Xác định chính xác mối quan hệ giữa câu 1 và câu 2 (Đối lập, Bổ sung hay Kết quả).',
      'Rhetorical Synthesis: Đọc thẳng câu lệnh ở cuối ("The student wants to...") để chọn đáp án trúng mục tiêu.',
      'Words in Context: Dựa vào từ đối lập/đồng nghĩa trong ngữ cảnh, không dịch nghĩa đơn lẻ ngoài đời.'
    ]
  }
};

export default function GateExamPage() {
  const params = useParams();
  const domain = params.domain as string;

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  /** Kết quả đúng/sai từng câu (index theo thứ tự thi) — để tô chấm tiến trình ĐÚNG câu nào. */
  const [answerLog, setAnswerLog] = useState<boolean[]>([]);
  const [gateProgress, setGateProgress] = useState<GateProgress | null>(null);
  const [domainAvg, setDomainAvg] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [resultData, setResultData] = useState<{ passed: boolean; nearMiss: boolean; score: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chống double-submit & dọn dẹp timer
  const isSubmittingRef = useRef(false);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // POINT 71: Checklist tương tác trước giờ thi
  const [checkedList, setCheckedList] = useState<Record<number, boolean>>({});

  const domainKey = domain?.toLowerCase() || 'algebra';
  const checklistData = DOMAIN_CORE_CHECKLIST[domainKey] || DOMAIN_CORE_CHECKLIST['algebra'];

  const toggleCheck = (idx: number) => {
    setCheckedList(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const checkedCount = Object.values(checkedList).filter(Boolean).length;

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/gate-exam?domain=${encodeURIComponent(domain)}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? 'Lỗi tải đề thi cổng');
          setPhase('not_eligible');
          return;
        }
        const data = await res.json();
        setDomainAvg(data.domainAvg ?? 0);
        setGateProgress(data.gateProgress);

        if (!data.eligible) {
          setPhase('not_eligible');
          return;
        }

        setQuestions(data.questions);
        setPhase('intro');
      } catch {
        setError('Không thể kết nối server');
        setPhase('not_eligible');
      }
    }
    load();
  }, [domain]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      // Cho "GO!" hiện rõ ~0.7s trước khi vào câu hỏi (nếu không sẽ chỉ chớp 1 frame).
      countdownTimerRef.current = setTimeout(() => setPhase('fighting'), 700);
      return () => {
        if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      };
    }
    countdownTimerRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, [phase, countdown]);

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, []);

  const handleAnswer = useCallback((isCorrect: boolean) => {
    if (isCorrect) setCorrectCount((c) => c + 1);
    setAnswerLog((log) => [...log, isCorrect]);
  }, []);

  const handleNext = useCallback(async () => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= GATE_QUESTIONS) {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      try {
        const questionIds = questions.map((q) => (q as unknown as Record<string, unknown>).questionId).filter(Boolean);
        const res = await fetch('/api/gate-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain, questionIds, correctCount }),
        });
        if (res.ok) {
          const data = await res.json();
          setResultData(data.result);
          setGateProgress(data.gateProgress);
        } else {
          setResultData({ passed: false, nearMiss: false, score: correctCount });
        }
      } catch {
        setResultData({ passed: false, nearMiss: false, score: correctCount });
      } finally {
        isSubmittingRef.current = false;
      }
      setPhase('result');
    } else {
      setCurrentIdx(nextIdx);
    }
  }, [currentIdx, correctCount, domain, questions]);

  const startCountdown = () => {
    if (isSubmittingRef.current) return;
    setCountdown(3);
    setCurrentIdx(0);
    setCorrectCount(0);
    setAnswerLog([]);
    setResultData(null);
    setPhase('countdown');
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0e1117]">
        <div className="text-5xl animate-spin mb-4">⚙️</div>
        <p className="text-white font-bold text-xl">Đang chuẩn bị Đề Thi Cổng...</p>
        <p className="text-gray-400 text-sm mt-2">Hệ thống đang sinh {GATE_QUESTIONS} câu hỏi đánh giá năng lực</p>
      </div>
    );
  }

  if (phase === 'not_eligible') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        <div className="math-academy-header" style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #1e1b4b 100%)' }}>
          <div className="math-title-container">
            <div className="math-icon">🚫</div>
            <div>
              <h1 className="math-title" style={{ background: 'linear-gradient(to right, #fca5a5, #c084fc)', WebkitBackgroundClip: 'text' }}>CHƯA ĐỦ ĐIỀU KIỆN</h1>
              <p className="math-subtitle text-red-200">Bạn chưa thể vào Cổng Khảo Thí lúc này</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1b2533] p-8 rounded-xl border border-[#334155] max-w-lg mx-auto text-center">
          {error && <p className="text-red-400 mb-4">{error}</p>}
          {gateProgress && !gateProgress.passed && (
            <div className="mb-4">
              <p className="text-gray-300">Lần thi trước: {gateProgress.score}/{GATE_QUESTIONS}</p>
              <p className="text-amber-400 font-bold mt-2">
                Cần luyện thêm {Math.max(0, RETRY_CORRECT_NEEDED - gateProgress.correctSinceFail)} câu đúng trước khi thi lại
              </p>
            </div>
          )}
          <p className="text-gray-400 text-sm mb-6">
            Mastery trung bình chương: {domainAvg}/100 (cần ≥ 40)
          </p>
          <Link href="/skill-tree" className="bg-[#1b2533] border border-amber-400/40 hover:bg-[#26344a] text-amber-300 font-bold px-6 py-3 rounded-xl inline-block transition-colors">
            ← Quay lại Cây Năng Lực
          </Link>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        <div className="math-academy-header epic-shake-active" style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #0f172a 100%)' }}>
          <div className="math-title-container">
            <div className="math-icon text-6xl">⚔️</div>
            <div>
              <h1 className="math-title" style={{ background: 'linear-gradient(to right, #f87171, #fbbf24)', WebkitBackgroundClip: 'text' }}>CỔNG KHẢO THÍ</h1>
              <p className="math-subtitle text-red-200">Boss Assessment — Chứng minh năng lực để mở chương mới</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Thông tin bài thi */}
          <div className="bg-[#1b2533] p-6 md:p-8 rounded-xl border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)] text-center">
            <div className="text-6xl mb-3 animate-pulse">🏯</div>
            <h2 className="text-2xl font-black text-white mb-3">BOSS XUẤT HIỆN!</h2>
            <div className="grid grid-cols-2 gap-3 text-left bg-[#0e1117] p-4 rounded-lg border border-[#334155] mb-6">
              <p className="text-sm text-gray-300"><span className="text-red-400 font-bold">⚔️ Đề thi:</span> {GATE_QUESTIONS} câu tổng hợp</p>
              <p className="text-sm text-gray-300"><span className="text-green-400 font-bold">✅ Đạt chuẩn:</span> Đúng ≥ {GATE_PASS_THRESHOLD}/{GATE_QUESTIONS}</p>
              <p className="text-sm text-gray-300"><span className="text-amber-400 font-bold">⚠️ Trượt sát:</span> {GATE_PASS_THRESHOLD - 1}/{GATE_QUESTIONS}</p>
              <p className="text-sm text-gray-300"><span className="text-purple-400 font-bold">🔄 Cần cày lại:</span> {RETRY_CORRECT_NEEDED} câu đúng</p>
            </div>

            {/* =========================================================================
                POINT 71: CHECKLIST 5 KIẾN THỨC CỐT LÕI TRƯỚC KHI BẮT ĐẦU THI
                ========================================================================= */}
            <div className="text-left bg-[#131b26] border border-amber-500/40 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                    Ôn Nhanh 30s: 5 Kiến Thức Trọng Tâm {checklistData.domainTitle}
                  </h3>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-700">
                  {checkedCount}/{checklistData.items.length || 5} đã nhẩm ({checklistData.items.length > 0 ? Math.round((checkedCount / checklistData.items.length) * 100) : 0}%)
                </span>
              </div>

              <div className="space-y-2.5">
                {checklistData.items.map((item, idx) => {
                  const isChecked = !!checkedList[idx];
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleCheck(idx)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                        isChecked
                          ? 'bg-emerald-950/30 border-emerald-500/50 text-gray-200'
                          : 'bg-[#0d141f] border-gray-800 hover:border-gray-700 text-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-1 h-4 w-4 rounded border-gray-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className={`text-xs leading-relaxed ${isChecked ? 'line-through text-gray-400 font-normal' : 'font-medium'}`}>
                        {item}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-2 text-center">
                💡 Tích nhẩm 5 mục trên để não bộ chuẩn bị phản xạ chính xác nhất trước khi đếm ngược.
              </p>
            </div>

            <button
              onClick={startCountdown}
              disabled={isSubmittingRef.current}
              className="bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 disabled:opacity-50 text-white font-black text-xl px-12 py-4 rounded-full shadow-[0_0_25px_rgba(239,68,68,0.4)] transition-transform hover:scale-105"
            >
              ⚔️ BẮT ĐẦU THI NGAY
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'countdown') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4 font-bold uppercase tracking-widest">Chuẩn bị...</p>
          <div className="text-[120px] font-black text-red-500 animate-ping" key={countdown}>
            {countdown > 0 ? countdown : 'GO!'}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'fighting') {
    const currentQ = questions[currentIdx];
    const totalQ = GATE_QUESTIONS > 0 ? GATE_QUESTIONS : 1;
    const progressPercent = totalQ > 0 ? Math.min(100, Math.round(((currentIdx + 1) / totalQ) * 100)) : 0;
    const safeProgress = Number.isFinite(progressPercent) ? progressPercent : 0;
    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        <div className="flex justify-between items-center bg-[#1b2533] p-4 rounded-xl border border-red-500/30">
          <div>
            <span className="text-gray-400 text-sm">Cổng Khảo Thí</span>
            <h2 className="text-xl font-black text-red-400">
              Câu {currentIdx + 1} / {GATE_QUESTIONS}
              {GATE_QUESTIONS > 0 && <span className="text-xs font-normal text-gray-400 ml-2">({safeProgress}%)</span>}
            </h2>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: GATE_QUESTIONS }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 ${
                  i < answerLog.length
                    ? answerLog[i]
                      ? 'bg-green-500 border-green-500'
                      : 'bg-red-500 border-red-500'
                    : i === currentIdx
                    ? 'bg-amber-400 border-amber-400 animate-pulse'
                    : 'bg-transparent border-gray-600'
                }`}
              />
            ))}
          </div>
        </div>

        {currentQ && (
          <CorePracticeUI
            key={`gate-q-${currentIdx}`}
            questionData={currentQ}
            isLoading={false}
            onAnswer={handleAnswer}
            onNext={handleNext}
            hideNextUntilSubmitted
          />
        )}
      </div>
    );
  }

  if (phase === 'result' && resultData) {
    const totalQuestions = GATE_QUESTIONS > 0 ? GATE_QUESTIONS : 1;
    const scorePercent = totalQuestions > 0 ? Math.round(((resultData.score ?? 0) / totalQuestions) * 100) : 0;
    const safeScorePercent = Number.isFinite(scorePercent) ? scorePercent : 0;
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        {resultData.passed ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-gradient-to-br from-[#052e23] to-[#0f172a] p-8 md:p-10 rounded-2xl border-2 border-green-500 shadow-[0_0_40px_rgba(16,185,129,0.3)] text-center">
              <div className="text-6xl mb-3">🏆</div>
              <h2 className="text-3xl font-black text-green-400 mb-2">CỔNG ĐÃ MỞ!</h2>
              <p className="text-xl text-white mb-2">Kết quả: {resultData.score}/{GATE_QUESTIONS} câu đúng ({safeScorePercent}%)</p>
              <p className="text-gray-300 mb-6">Chương mới đã được mở khóa hoàn toàn trong Cây Năng Lực!</p>

              {/* =========================================================================
                  POINT 88: CHỨNG NHẬN VƯỢT CỬA ẢI (DOMAIN MASTERY CERTIFICATE)
                  ========================================================================= */}
              <div
                id="mastery-certificate"
                className="bg-gradient-to-b from-[#0a1b14] via-[#0b1f18] to-[#091510] border-4 border-double border-amber-400/80 rounded-2xl p-6 md:p-8 text-center relative shadow-2xl my-6 text-gray-100 overflow-hidden"
              >
                {/* Góc trang trí hoàng gia */}
                <div className="absolute top-2 left-2 text-amber-400 text-lg">❖</div>
                <div className="absolute top-2 right-2 text-amber-400 text-lg">❖</div>
                <div className="absolute bottom-2 left-2 text-amber-400 text-lg">❖</div>
                <div className="absolute bottom-2 right-2 text-amber-400 text-lg">❖</div>

                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-400/40 rounded-full text-amber-300 text-xs font-bold uppercase tracking-widest mb-3">
                  SAT GURU ACADEMY • OFFICIAL BADGE OF MASTERY
                </div>

                <h3 className="text-2xl md:text-3xl font-serif font-bold text-amber-300 tracking-wide mb-1 uppercase">
                  Chứng Nhận Tinh Thông Chuyên Đề
                </h3>
                <p className="text-xs text-gray-400 italic mb-4 font-serif">Certificate of Domain Mastery & Competency</p>

                <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto mb-4" />

                <p className="text-xs text-gray-300 uppercase tracking-wider mb-1">Trao tặng học viên đã chinh phục thành công</p>
                <div className="text-xl md:text-2xl font-black text-emerald-400 mb-2">
                  CHUYÊN ĐỀ {checklistData.domainTitle.toUpperCase()}
                </div>

                <p className="text-xs text-gray-300 max-w-lg mx-auto leading-relaxed mb-5">
                  Đã xuất sắc vượt qua Kỳ Thi Boss Khảo Thí với kết quả <strong className="text-amber-300 font-bold">{resultData.score}/{GATE_QUESTIONS} ({safeScorePercent}%)</strong> câu đúng, đủ điều kiện mở khóa toàn bộ các tầng năng lực tiếp theo trên bản đồ College Board.
                </p>

                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto pt-4 border-t border-amber-500/30 text-xs text-gray-400 mb-2">
                  <div>
                    <span className="block text-[11px] text-gray-500">NGÀY XÁC THỰC</span>
                    <strong className="text-gray-200">{new Date().toLocaleDateString('vi-VN')}</strong>
                  </div>
                  <div>
                    <span className="block text-[11px] text-gray-500">MÃ CHỨNG NHẬN</span>
                    <strong className="text-amber-400 font-mono">SAT-BOSS-{domain.toUpperCase()}-{Date.now().toString().slice(-6)}</strong>
                  </div>
                </div>

                <div className="mt-4 inline-flex items-center gap-2 text-xs text-emerald-400 font-semibold bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-600/40">
                  <span>🛡️</span>
                  <span>Đã ghi nhận vĩnh viễn vào hồ sơ năng lực</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => window.print()}
                  className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-amber-950 font-black px-6 py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <span>🖨️</span>
                  <span>In / Lưu Chứng Nhận (PDF)</span>
                </button>
                <Link
                  href="/skill-tree"
                  className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold px-8 py-3.5 rounded-xl inline-block shadow-lg"
                >
                  🌳 Xem Cây Năng Lực
                </Link>
              </div>
            </div>
          </div>
        ) : resultData.nearMiss ? (
          <div className="max-w-lg mx-auto text-center space-y-6">
            <div className="bg-gradient-to-br from-[#451a03] to-[#0f172a] p-10 rounded-xl border-2 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
              <div className="text-7xl mb-4">😤</div>
              <h2 className="text-3xl font-black text-amber-400 mb-2">CHỈ THIẾU 1 CÂU!</h2>
              <p className="text-xl text-white mb-2">Kết quả: {resultData.score}/{GATE_QUESTIONS} câu đúng ({safeScorePercent}%)</p>
              <p className="text-amber-200 mb-4">Bạn gần lắm rồi! Luyện thêm {RETRY_CORRECT_NEEDED} câu đúng trong chương này rồi thử lại.</p>
              <div className="mt-6 flex flex-col gap-3 items-center">
                <Link href="/skill-tree" className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-3 rounded-xl inline-block">
                  🎯 Về luyện tiếp
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-lg mx-auto text-center space-y-6">
            <div className="bg-gradient-to-br from-[#450a0a] to-[#0f172a] p-10 rounded-xl border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <div className="text-7xl mb-4">💀</div>
              <h2 className="text-3xl font-black text-red-400 mb-2">CHƯA QUA CỔNG</h2>
              <p className="text-xl text-white mb-2">Kết quả: {resultData.score}/{GATE_QUESTIONS} câu đúng ({safeScorePercent}%)</p>
              <p className="text-red-200 mb-4">Hãy quay lại luyện kỹ năng yếu. Luyện thêm {RETRY_CORRECT_NEEDED} câu đúng trong chương này trước khi thi lại.</p>
              <div className="mt-6 flex flex-col gap-3 items-center">
                <Link href="/skill-tree" className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-6 py-3 rounded-xl inline-block">
                  🌳 Về Cây Năng Lực
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
