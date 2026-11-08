'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LoadingState } from '@/components/LoadingState';

/**
 * JOURNEY PAGE (Cụm A2 — LỘ TRÌNH CÁ NHÂN)
 *
 * Đọc /api/journey → lộ trình luyện theo tuần dựng từ mastery thật + điểm mục
 * tiêu. Mỗi tuần liệt kê kỹ năng yếu cần củng cố + mastery hiện tại + số buổi
 * gợi ý + nút "Luyện ngay" deep-link sang trang luyện tương ứng.
 *
 * PHÂN TẦNG: quyền lợi ULTIMATE. Free/Premium → server trả { plan:null,
 * locked:true } → hiện upsell + link /upgrade (mẫu skill-tree "Luyện Mục Tiêu").
 *
 * POINT 65: Bản xem trước Lộ trình Tuần 1–4 ngay cả khi chưa làm Diagnostic đầu vào
 * ("Preview Lộ trình Chuẩn 1400+ / 1500+") kèm CTA làm Diagnostic để cá nhân hóa.
 */

interface PlanFocusSkill {
  skillId: string;
  label: string;
  moduleType: string;
  masteryScore: number;
  targetSessions: number;
}
interface PlanWeek {
  weekIndex: number;
  focusSkills: PlanFocusSkill[];
  rationale: string;
}
interface WeeklyPlan {
  generatedAt: string;
  targetScore: number | null;
  pointsToTarget?: number;
  weeks: PlanWeek[];
}

/** Dữ liệu lộ trình chuẩn mẫu 4 tuần cho Point 65 */
const SAMPLE_4_WEEK_CURRICULUM = [
  {
    weekIndex: 1,
    title: 'Tuần 1: Xây Nền Vững Chắc & Kéo Điểm Dễ Nhất (+40~60đ)',
    badge: '💎 ROI Cao Nhất',
    rationale: 'Tập trung triệt để vào các chủ đề dễ ăn điểm tuyệt đối: Phương trình bậc nhất, Dấu câu & Cấu trúc câu ghép, và 100 từ vựng cốt lõi.',
    skills: [
      { id: 'math-linear', label: 'Linear Equations in 1 & 2 Variables', type: 'math', sessions: '4 buổi', target: 'Mastery 90%+' },
      { id: 'rw-boundaries', label: 'Boundaries & Punctuation Rules (Dấu chấm phẩy, phẩy, hai chấm)', type: 'literature', sessions: '3 buổi', target: 'Mastery 95%+' },
      { id: 'vocab-foundation', label: '100 Từ vựng Học thuật Tần suất Cao', type: 'vocab', sessions: 'Mỗi ngày 15p', target: 'Nhớ 100 từ' }
    ]
  },
  {
    weekIndex: 2,
    title: 'Tuần 2: Hệ Phương Trình, Bậc Hai & Kỹ Thuật Đọc Liên Kết (+30~50đ)',
    badge: '⚡ Tăng Tốc Kỹ Năng',
    rationale: 'Làm chủ các dạng bài phân loại trung cấp trong Math và các câu hỏi Transitions & Rhetorical Synthesis trong Reading & Writing.',
    skills: [
      { id: 'math-systems', label: 'Systems of Two Linear Equations & Quadratics', type: 'math', sessions: '4 buổi', target: 'Mastery 85%+' },
      { id: 'rw-transitions', label: 'Transitions & Logical Connectors (However, Moreover...)', type: 'literature', sessions: '3 buổi', target: 'Mastery 90%+' },
      { id: 'rw-synthesis', label: 'Rhetorical Synthesis (Ghi chú & Tổng hợp mục đích)', type: 'literature', sessions: '2 buổi', target: 'Mastery 90%+' }
    ]
  },
  {
    weekIndex: 3,
    title: 'Tuần 3: Đồ Thị Nâng Cao, Desmos Siêu Tốc & Đọc Hiểu Sâu (+30~40đ)',
    badge: '🚀 Đột Phá Điểm Số',
    rationale: 'Sử dụng Desmos xử lý 80% câu hỏi Math phức tạp chỉ trong 30 giây, kết hợp phân tích biểu đồ Khoa học & Xã hội.',
    skills: [
      { id: 'desmos-advanced', label: 'Desmos Regression, Table & Slider Shortcuts', type: 'desmos', sessions: '3 buổi', target: 'Thao tác <30s/câu' },
      { id: 'math-nonlinear', label: 'Nonlinear Functions, Circles & Angles', type: 'math', sessions: '3 buổi', target: 'Mastery 80%+' },
      { id: 'rw-data-graphs', label: 'Quantitative Information in Reading Passages', type: 'literature', sessions: '3 buổi', target: 'Mastery 85%+' }
    ]
  },
  {
    weekIndex: 4,
    title: 'Tuần 4: Thi Thử Full-Length, Xử Lý Lỗi Sai & Siêu Nước Rút (+20~40đ)',
    badge: '🏆 Về Đích 1450~1550',
    rationale: 'Mô phỏng áp lực phòng thi thật với đề Adaptive Bluebook, tổng ôn Sổ tay lỗi sai và cân bằng nhịp sinh học chuẩn bị thi.',
    skills: [
      { id: 'full-mock', label: 'Làm 2 Đề Mock Full-Length Chuẩn Adaptive 2026', type: 'math', sessions: '2 đề full', target: 'Điểm ổn định 1450+' },
      { id: 'mistake-notebook', label: 'Ôn tập 100% Sổ tay lỗi sai (Error Log Review)', type: 'vocab', sessions: 'Hàng ngày', target: '0% lặp lại lỗi cũ' },
      { id: 'cram-formula', label: 'Tổng duyệt 20 Công thức Toán cốt lõi & Mẹo thi', type: 'desmos', sessions: '2 buổi', target: 'Thuộc lòng 100%' }
    ]
  }
];

const MODULE_ROUTE: Record<string, string> = {
  math: '/math',
  literature: '/literature',
  vocab: '/vocabulary',
  desmos: '/desmos',
};

function practiceHref(skill: PlanFocusSkill): string {
  return `/grind?skillId=${encodeURIComponent(skill.skillId)}`;
}

export default function JourneyPage() {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/journey');
        if (res.ok) {
          const data = await res.json();
          if (data.locked) setLocked(true);
          else setPlan(data.plan);
        } else {
          setError(true);
        }
      } catch (e) {
        console.error('Lỗi tải lộ trình', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch('/api/journey', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.locked) setLocked(true);
        else setPlan(data.plan);
      }
    } catch (e) {
      console.error('Lỗi tạo lại lộ trình', e);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">🗺️</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #6ee7b7, #10b981)', WebkitBackgroundClip: 'text' }}>HÀNH TRÌNH CHINH PHỤC</h1>
            <p className="math-subtitle text-emerald-200">Lộ trình luyện cá nhân hóa theo điểm yếu và mục tiêu điểm của bạn.</p>
          </div>
        </div>
      </div>

      {loading && <LoadingState message="Đang dựng lộ trình cá nhân của bạn..." />}

      {/* Free/Premium → khóa: hiện upsell Ultimate */}
      {!loading && locked && (
        <div className="bg-gradient-to-br from-[#064e3b] to-[#0f172a] p-8 rounded-xl border border-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🔒</span>
                <h3 className="text-xl font-bold text-white">Lộ Trình Cá Nhân (Ultimate)</h3>
              </div>
              <p className="text-[#e2e8f0] font-medium">Kế hoạch luyện theo tuần, bám sát điểm yếu và mục tiêu điểm.</p>
              <p className="text-sm text-emerald-300 mt-2">Ultimate phân tích toàn bộ kỹ năng của bạn, sắp thứ tự luyện tối ưu theo tuần và gợi ý số buổi cho từng kỹ năng để lên điểm nhanh nhất.</p>
            </div>
            <Link
              href="/upgrade?from=journey&unlock=ultimate"
              className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-amber-950 font-bold px-6 py-3 rounded-xl transition-all text-center whitespace-nowrap shadow-lg"
            >
              💎 Mở khóa Ultimate
            </Link>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] p-6 rounded-xl">
          Không tải được lộ trình. Vui lòng đăng nhập và thử lại.
        </div>
      )}

      {!loading && !locked && plan && (
        <>
          {/* Tổng quan mục tiêu + nút tạo lại */}
          <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Kế Hoạch {plan.weeks.length} Tuần Cá Nhân Hóa</h3>
              {plan.targetScore !== null ? (
                <p className="text-sm text-gray-400">
                  Mục tiêu <span className="text-emerald-400 font-bold">{Number.isFinite(plan.targetScore) ? plan.targetScore : 0}</span>
                  {typeof plan.pointsToTarget === 'number' && Number.isFinite(plan.pointsToTarget) && plan.pointsToTarget > 0 && (
                    <> — còn cách <span className="text-amber-400 font-bold">{plan.pointsToTarget}</span> điểm.</>
                  )}
                  {typeof plan.pointsToTarget === 'number' && Number.isFinite(plan.pointsToTarget) && plan.pointsToTarget === 0 && (
                    <> — bạn đã chạm ước lượng mục tiêu! Giữ phong độ nhé.</>
                  )}
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  Chưa đặt điểm mục tiêu.{' '}
                  <Link href="/dashboard" className="text-emerald-400 underline">Đặt mục tiêu</Link> để lộ trình bám sát hơn.
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreviewModal(!showPreviewModal)}
                className="bg-[#1f2937] hover:bg-[#374151] border border-gray-600 text-gray-200 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
              >
                {showPreviewModal ? 'Ẩn Lộ Trình Mẫu' : '👀 Xem Lộ Trình Mẫu 1500+'}
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="bg-[#065f46] hover:bg-[#047857] disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
              >
                {regenerating ? 'Đang tạo lại...' : '🔄 Tạo lại lộ trình'}
              </button>
            </div>
          </div>

          {/* Lộ trình rỗng (đã tinh thông hết kỹ năng) */}
          {plan.weeks.length === 0 && (
            <div className="bg-[#052e23] border border-[#10b981] text-[#34d399] p-6 rounded-xl text-center">
              🎉 Bạn đã tinh thông toàn bộ kỹ năng trong lộ trình! Hãy thi thử full-length để giữ phong độ và kiểm chứng điểm số.
            </div>
          )}

          {/* Timeline các tuần cá nhân hóa */}
          {plan.weeks.length > 0 && (
            <div className="relative border-l-4 border-[#10b981] ml-6 space-y-10 pb-4">
              {plan.weeks.map((week) => (
                <div key={week.weekIndex} className="relative pl-8">
                  <div className="absolute -left-[14px] top-0 w-6 h-6 rounded-full border-4 border-[#0e1117] bg-[#10b981]" />
                  <div className="bg-[#1b2533] p-6 rounded-xl border border-[#334155]">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">Tuần {week.weekIndex}</h3>
                      <span className="text-xs bg-[#064e3b] text-[#34d399] border border-[#10b981] px-2 py-0.5 rounded">
                        {week.focusSkills.length} kỹ năng
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-5">{week.rationale}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {week.focusSkills.map((skill) => (
                        <div key={skill.skillId} className="bg-[#0e1117] border border-[#262730] p-4 rounded-xl">
                          <h4 className="text-sm font-bold text-gray-100 leading-snug mb-3">{skill.label}</h4>
                          <div className="w-full h-2 bg-[#1b2533] rounded-full overflow-hidden border border-[#334155] mb-1.5">
                            <div className="h-full bg-[#10b981] transition-all" style={{ width: `${Math.max(0, Math.min(100, Number.isFinite(skill.masteryScore) ? skill.masteryScore : 0))}%` }} />
                          </div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs text-gray-400">Mastery {Number.isFinite(skill.masteryScore) ? skill.masteryScore : 0}/100</span>
                            <span className="text-xs text-emerald-400 font-bold">{Number.isFinite(skill.targetSessions) ? skill.targetSessions : 0} buổi/tuần</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={practiceHref(skill)}
                              className="flex-1 text-center bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all"
                            >
                              ⚡ Luyện ngay
                            </Link>
                            {MODULE_ROUTE[skill.moduleType] && (
                              <Link
                                href={MODULE_ROUTE[skill.moduleType]}
                                className="text-center bg-[#1b2533] hover:bg-[#243040] text-gray-300 border border-[#334155] px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
                              >
                                Học lý thuyết
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          POINT 65: BẢN XEM TRƯỚC LỘ TRÌNH 4 TUẦN MẪU (PREVIEW LỘ TRÌNH CHUẨN 1400+ / 1500+)
          Hiển thị ngay cả khi chưa làm Diagnostic hoặc khi bấm xem lộ trình chuẩn
          ========================================================================= */}
      {(!loading && (!plan || locked || plan.weeks.length === 0 || showPreviewModal)) && (
        <section className="bg-gradient-to-b from-[#131b26] to-[#0d141f] rounded-2xl border-2 border-emerald-500/40 p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header Banner */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-800">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2 border border-emerald-500/30">
                ⭐ Preview Lộ Trình Mẫu Chuẩn College Board
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                Bản Xem Trước Lộ Trình 4 Tuần Đột Phá 1400+ / 1500+
              </h2>
              <p className="text-sm md:text-base text-gray-300 mt-1 max-w-2xl">
                Đây là khung lộ trình chuẩn hóa được thiết kế bởi các chuyên gia SAT 1580+.
                Khi làm bài chẩn đoán 5 phút, hệ thống sẽ tự động gọt giũa và sắp xếp các tuần phù hợp 100% với điểm yếu của bạn.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/diagnostic"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-extrabold shadow-lg shadow-emerald-900/40 transition-all transform hover:scale-[1.02] text-center"
              >
                <span>🚀 Làm Diagnostic 5 Phút</span>
                <span className="text-xs bg-emerald-700/60 px-2 py-0.5 rounded-full">Miễn phí</span>
              </Link>
              <Link
                href="/skill-tree"
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#1b2533] hover:bg-[#253245] border border-gray-700 text-gray-200 text-sm font-semibold transition-all text-center"
              >
                🌲 Cây kỹ năng SAT
              </Link>
            </div>
          </div>

          {/* 4 Tuần Preview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
            {SAMPLE_4_WEEK_CURRICULUM.map((week) => (
              <div
                key={week.weekIndex}
                className="bg-[#0b1017] rounded-xl border border-gray-800 p-5 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-600/30 px-2.5 py-1 rounded-md">
                      {week.badge}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">3 Kỹ năng trọng tâm</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{week.title}</h3>
                  <p className="text-xs text-gray-400 mb-4 leading-relaxed">{week.rationale}</p>

                  <div className="space-y-2 mb-4">
                    {week.skills.map((s, idx) => (
                      <div key={idx} className="bg-[#151d29] p-2.5 rounded-lg border border-gray-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400">✓</span>
                          <span className="text-gray-200 font-medium">{s.label}</span>
                        </div>
                        <div className="text-right whitespace-nowrap pl-2">
                          <span className="text-gray-400">{s.sessions}</span>
                          <span className="mx-1 text-gray-600">•</span>
                          <span className="text-amber-400 font-semibold">{s.target}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                  <span className="text-xs text-emerald-300 font-medium">
                    {week.weekIndex === 1 ? '👉 Đang mở khóa tuần 1' : `Khóa chờ hoàn thành Tuần ${week.weekIndex - 1}`}
                  </span>
                  <Link
                    href="/diagnostic"
                    className="text-xs text-emerald-400 hover:text-emerald-300 underline font-semibold"
                  >
                    Kích hoạt lộ trình này →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Banner nhắc nhở Diagnostic */}
          <div className="mt-6 bg-gradient-to-r from-amber-950/40 via-yellow-950/20 to-transparent border border-amber-600/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💡</span>
              <p className="text-xs sm:text-sm text-amber-200">
                <strong>Bạn muốn biết chính xác mình nên bắt đầu từ Tuần mấy?</strong> Chỉ cần 5 phút làm Diagnostic, AI sẽ tự động bỏ qua những chủ đề bạn đã giỏi và xếp lịch học tối ưu nhất.
              </p>
            </div>
            <Link
              href="/diagnostic"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs sm:text-sm rounded-lg whitespace-nowrap transition-colors"
            >
              Bắt đầu Diagnostic
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
