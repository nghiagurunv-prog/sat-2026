'use client';

import React, { useState, useMemo, type ReactNode } from 'react';

/**
 * ============================================================================
 *  EXPLANATION CARD - THẺ LỜI GIẢI GIẢI PHẪU BẪY CHUẨN COLLEGE BOARD
 *  (SQUAD 4 - #W031 - #W040)
 * ============================================================================
 *  Tính năng cốt lõi:
 *    • #C032: Thanh "Từ điển Thuật ngữ SAT Anh-Việt nhanh" (tự động nhận diện từ vựng học thuật)
 *    • #C033: Hộp lưu ý "Khác biệt Tư duy IELTS vs. Digital SAT" (trực tiếp evidence, không suy diễn)
 *    • #C034: 2 tab chuyển đổi phương pháp ("Bản chất Tư duy Chuẩn" vs. "Mẹo Bấm Desmos / Loại Trừ 10s")
 *    • #C035: Nhãn phân loại bẫy đáp án College Board kinh điển
 *    • #C037, #C038: Sơ đồ 3 bước kiểm tra nhanh Ngữ pháp / Đại số
 * ============================================================================
 */

export interface ExplanationCardProps {
  explanation?: string;
  explanationVi?: string;
  question?: string;
  passage?: string;
  choices?: string[];
  correctChoice?: string;
  userChoice?: string | null;
  domain?: string;
  skillId?: string;
  difficulty?: string;
  choiceAnalysis?: { choice_letter: string; is_correct: boolean; analysis: string }[];
  className?: string;
  isSpr?: boolean;
  onOpenTutor?: () => void;
}

/**
 * Danh mục từ điển thuật ngữ SAT Anh-Việt học thuật tích hợp sẵn (#C032)
 */
const SAT_GLOSSARY: Record<string, { vi: string; pos: string; example: string }> = {
  substantiate: { vi: 'Chứng minh bằng chứng cứ xác thực', pos: 'v.', example: 'Evidence needed to substantiate the claim' },
  undermine: { vi: 'Làm suy yếu, phản bác luận điểm', pos: 'v.', example: 'New data undermines the previous hypothesis' },
  dichotomy: { vi: 'Sự phân đôi, hai mặt đối lập hoàn toàn', pos: 'n.', example: 'A false dichotomy between art and science' },
  juxtapose: { vi: 'Đặt cạnh nhau để làm nổi bật tương phản', pos: 'v.', example: 'Juxtaposing traditional and modern values' },
  concession: { vi: 'Sự thừa nhận / nhượng bộ một phần luận điểm', pos: 'n.', example: 'Making a concession before counterarguing' },
  empirical: { vi: 'Dựa trên thực nghiệm, số liệu quan sát thực tế', pos: 'adj.', example: 'Empirical research and statistical data' },
  paradox: { vi: 'Nghịch lý bề ngoài nhưng có căn cứ', pos: 'n.', example: 'A fascinating biological paradox' },
  tangent: { vi: 'Tiếp tuyến (đường thẳng chỉ tiếp xúc tại 1 điểm)', pos: 'n./adj.', example: 'Line tangent to the circle at point P' },
  asymptote: { vi: 'Đường tiệm cận mà đồ thị tiến gần nhưng không cắt', pos: 'n.', example: 'Horizontal asymptote at y = 0' },
  quadratic: { vi: 'Phương trình / hàm số bậc hai (dạng ax² + bx + c)', pos: 'adj.', example: 'Quadratic function with maximum vertex' },
  hypotenuse: { vi: 'Cạnh huyền (cạnh đối diện góc 90° tam giác vuông)', pos: 'n.', example: 'In right triangle, a² + b² = c²' },
  perpendicular: { vi: 'Vuông góc (tích hai hệ số góc m1 * m2 = -1)', pos: 'adj.', example: 'Perpendicular lines have negative reciprocal slopes' },
  vertex: { vi: 'Đỉnh parabol (tọa độ (-b/2a, f(-b/2a)))', pos: 'n.', example: 'Vertex form: y = a(x - h)² + k' },
  inferred: { vi: 'Được suy luận ra từ căn cứ gián tiếp', pos: 'adj.', example: 'It can be inferred from lines 10-15' },
  modifier: { vi: 'Cụm từ bổ nghĩa (phải đứng sát danh từ được bổ nghĩa)', pos: 'n.', example: 'Dangling modifier error' },
  extrapolate: { vi: 'Ngoại suy (dự đoán xu hướng ngoài vùng dữ liệu)', pos: 'v.', example: 'Cannot extrapolate beyond tested temperatures' },
  pragmatic: { vi: 'Thực dụng, chú trọng tính hiệu quả thực tế', pos: 'adj.', example: 'A pragmatic compromise' },
  ambivalent: { vi: 'Lưỡng lự, có hai luồng cảm xúc trái chiều', pos: 'adj.', example: 'Author remains ambivalent about the outcome' },
  congruent: { vi: 'Bằng nhau / đồng dạng tuyệt đối về kích thước & góc', pos: 'adj.', example: 'Congruent triangles have identical sides' },
  semicolon: { vi: 'Dấu chấm phẩy (dùng nối 2 mệnh đề độc lập không cần FANBOYS)', pos: 'n.', example: 'Independent clause; independent clause' }
};

/**
 * Phân tích bẫy đáp án kinh điển (#C035)
 */
const TRAP_TYPES = [
  {
    id: 'too-broad',
    name: 'Quá Rộng / Quá Hẹp (Too Broad / Narrow)',
    color: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    icon: '🔴',
    desc: 'Bao quát vượt ra ngoài phạm vi đoạn văn hoặc chỉ chọn chi tiết nhỏ không đại diện cho luận điểm chính.'
  },
  {
    id: 'extreme',
    name: 'Ngôn Từ Cực Đoan (Extreme Language)',
    color: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    icon: '🟠',
    desc: 'Chứa các từ tuyệt đối hóa như ALWAYS, NEVER, SOLELY, COMPLETELY, PROVE 100% mà bài viết không hề khẳng định.'
  },
  {
    id: 'opposite',
    name: 'Ngược Chiều Logic / Ngược Dấu (Opposite / Sign)',
    color: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
    icon: '🟣',
    desc: 'Lấy đúng mối quan hệ nhưng đảo ngược nguyên nhân - kết quả, hoặc quên đổi dấu khi nhân chia số âm.'
  },
  {
    id: 'word-matching',
    name: 'Đúng Từ Khóa Nhưng Sai Bản Chất (Word-matching)',
    color: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
    icon: '🔵',
    desc: 'Chép y hệt 3-4 từ ngữ trong đoạn văn nhằm đánh lừa học sinh đọc lướt, nhưng thực tế ý nghĩa bị bóp méo.'
  }
];

function renderSimpleMath(text: string): ReactNode {
  if (!text) return null;
  return <span>{text}</span>;
}

export function ExplanationCard({
  explanation = '',
  explanationVi = '',
  question = '',
  passage = '',
  choices = [],
  correctChoice = '',
  userChoice = null,
  domain = '',
  skillId = '',
  difficulty = 'Medium',
  choiceAnalysis = [],
  className = '',
  isSpr = false,
  onOpenTutor,
}: ExplanationCardProps) {
  // #C034: 2 Tab góc nhìn phương pháp
  const [activeTab, setActiveTab] = useState<'standard' | 'fast_hack'>('standard');
  const [selectedGlossaryWord, setSelectedGlossaryWord] = useState<string | null>(null);

  // Xác định câu hỏi thuộc môn Math hay RW
  const isMathQuestion = useMemo(() => {
    const text = `${domain || ''} ${skillId || ''} ${question || ''} ${explanation || ''}`.toLowerCase();
    return (
      text.includes('math') ||
      text.includes('algebra') ||
      text.includes('geometry') ||
      text.includes('equation') ||
      text.includes('function') ||
      text.includes('x^') ||
      text.includes('parabola') ||
      isSpr
    );
  }, [domain, skillId, question, explanation, isSpr]);

  // #C032: Quét từ vựng xuất hiện trong câu hỏi / lời giải
  const matchedGlossary = useMemo(() => {
    const corpus = `${question} ${passage} ${explanation} ${explanationVi}`.toLowerCase();
    return Object.entries(SAT_GLOSSARY).filter(([key]) => corpus.includes(key.toLowerCase()));
  }, [question, passage, explanation, explanationVi]);

  // Sinh nội dung cho Mẹo Desmos / Loại Trừ 10s (#C034)
  const fastHackContent = useMemo(() => {
    if (isMathQuestion) {
      return {
        badge: '⚡ Mẹo Bấm Desmos Thần Tốc (5-10 Giây)',
        steps: [
          '1. Gõ nguyên vẹn hai vế của phương trình vào Desmos: Dòng 1: y = Vế Trái, Dòng 2: y = Vế Phải.',
          '2. Click chuột trực tiếp vào điểm giao nhau của 2 đồ thị -> Tọa độ x chính là nghiệm cần tìm!',
          '3. Nếu là bài tìm hằng số k để có 1 nghiệm duy nhất: Thêm thanh trượt (slider) cho k, kéo chuột xem khi nào đỉnh parabol chạm đúng trục hoành.'
        ],
        caution: '💡 Luôn kiểm tra điều kiện xác định (mẫu khác 0, biểu thức trong căn ≥ 0) để không dính nghiệm ngoại lai (extraneous solution).'
      };
    }

    return {
      badge: '⚡ Chiến Thuật Loại Trừ 10 Giây (Bluebook Fast-Elimination)',
      steps: [
        '1. Đọc lướt 4 lựa chọn, gạch ngay đáp án chứa từ tuyệt đối: always, completely, impossible, entirely.',
        '2. Với câu hỏi Transitions (Liên từ): Nhìn lướt nếu có 2 đáp án mang cùng nghĩa (ví dụ: furthermore và in addition) -> Loại CẢ HAI ngay lập tức vì không thể có 2 đáp án đúng!',
        '3. Với câu hỏi Boundaries (Dấu câu): Nhìn ngay sau chỗ trống xem có động từ chính hay không để tránh bẫy câu què (fragment).'
      ],
      caution: '💡 Tuyệt đối không chọn đáp án chỉ vì "nghe xuôi tai". Mọi đáp án đúng đều phải có bằng chứng chữ-với-chữ (direct evidence).'
    };
  }, [isMathQuestion]);

  return (
    <div className={`rounded-2xl border border-slate-700/80 bg-slate-900/95 p-5 text-slate-100 shadow-xl ${className}`}>
      
      {/* 1. Header: Tiêu đề + Độ khó + Domain */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-lg">
            💡
          </span>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <span>Giải Phẫu Lời Giải &amp; Phân Tích Bẫy Chi Tiết</span>
              {isSpr && (
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded font-mono">
                  SPR Tự Luận
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {domain ? `Chủ đề: ${domain}` : 'Chuẩn khảo thí College Board Digital SAT'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {difficulty && (
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                difficulty.toLowerCase() === 'hard'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                  : difficulty.toLowerCase() === 'easy'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              }`}
            >
              Độ khó: {difficulty}
            </span>
          )}

          {onOpenTutor && (
            <button
              type="button"
              onClick={onOpenTutor}
              className="text-xs font-bold px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all transform hover:-translate-y-0.5"
            >
              <span>🎓 Hỏi Thầy Nghĩa</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. #C034: 2 Tab Chuyển Đổi Góc Nhìn Phương Pháp */}
      <div className="mt-4 flex rounded-xl bg-slate-950 p-1 border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('standard')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'standard'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📐 Bản Chất Tư Duy Chuẩn</span>
          <span className="text-[10px] opacity-80">(Formal Logic)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fast_hack')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'fast_hack'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>⚡ {isMathQuestion ? 'Mẹo Bấm Desmos Thần Tốc' : 'Mẹo Loại Trừ 10 Giây'}</span>
          <span className="text-[10px] opacity-80">(Fast-Hack 10s)</span>
        </button>
      </div>

      {/* 3. Nội dung chính theo Tab */}
      <div className="mt-4 space-y-4">
        {activeTab === 'standard' ? (
          <div className="space-y-3.5">
            {/* Lời giải tiếng Việt hoặc tiếng Anh */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 text-sm leading-relaxed">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
                Dẫn Luận Chi Tiết:
              </h4>
              <p className="text-slate-200 whitespace-pre-wrap">
                {explanationVi || explanation || 'Đang cập nhật diễn giải chi tiết cho câu hỏi này.'}
              </p>
            </div>

            {/* Phân tích từng lựa chọn A, B, C, D (nếu có) */}
            {choiceAnalysis && choiceAnalysis.length > 0 && (
              <div className="space-y-2 mt-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Giải Phẫu Từng Lựa Chọn:
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {choiceAnalysis.map((ca, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs leading-relaxed ${
                        ca.is_correct
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold mb-1">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                            ca.is_correct ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {ca.choice_letter}
                        </span>
                        <span>{ca.is_correct ? '✓ Đáp án chính xác' : '✗ Phương án nhiễu'}</span>
                      </div>
                      <p className="pl-7">{ca.analysis}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Tab Fast Hack 10s */
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <span>{fastHackContent.badge}</span>
            </div>

            <div className="space-y-2 text-xs text-slate-200">
              {fastHackContent.steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-amber-400 font-extrabold shrink-0">●</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 font-medium">
              {fastHackContent.caution}
            </div>
          </div>
        )}

        {/* 4. #C037 & #C038: Sơ Đồ 3 Bước Kiểm Tra Nhanh */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🧭</span>
              {isMathQuestion
                ? 'Sơ đồ 3 Bước Phản Xạ Đại Số / Hình Học (#C038)'
                : 'Sơ đồ 3 Bước Phản Xạ Ngữ Pháp & Đọc Hiểu (#C037)'}
            </h4>
            <span className="text-[10px] text-cyan-400 font-mono">Quy chuẩn Thầy Nghĩa Guru</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {isMathQuestion ? (
              <>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/80">
                  <div className="text-[10px] font-bold text-cyan-400 uppercase mb-1">Bước 1: Cấu Trúc</div>
                  <p className="text-slate-300 text-[11px] leading-snug">
                    Nhận diện dạng hàm: Bậc nhất (slope m), Bậc hai (parabol vertex), hay Hệ đối xứng.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/80">
                  <div className="text-[10px] font-bold text-amber-400 uppercase mb-1">Bước 2: Mở Desmos</div>
                  <p className="text-slate-300 text-[11px] leading-snug">
                    Vẽ đồ thị tìm giao điểm / cực trị, hoặc lập bảng giá trị (table x, y) trong 5 giây.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/80">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Bước 3: Thế Ngược</div>
                  <p className="text-slate-300 text-[11px] leading-snug">
                    Thế nghiệm ngược vào phương trình gốc (Back-substitution) để loại bỏ nghiệm ngoại lai.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/80">
                  <div className="text-[10px] font-bold text-cyan-400 uppercase mb-1">Bước 1: Tách Chủ-Vị</div>
                  <p className="text-slate-300 text-[11px] leading-snug">
                    Khoanh vùng Chủ ngữ chính (Subject) và Động từ chính (Verb). Cắt bỏ mọi thành phần phụ kẹp giữa hai dấu phẩy.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/80">
                  <div className="text-[10px] font-bold text-rose-400 uppercase mb-1">Bước 2: Soi Dấu Câu</div>
                  <p className="text-slate-300 text-[11px] leading-snug">
                    Kiểm tra 2 vế: Mệnh đề độc lập (IC) hay phụ thuộc (DC). Không bao giờ dùng dấu phẩy đơn lẻ nối 2 IC.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/80">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Bước 3: Rà Bổ Nghĩa</div>
                  <p className="text-slate-300 text-[11px] leading-snug">
                    Cụm phân từ mở đầu (V-ing / V-ed) bắt buộc phải bổ nghĩa trực tiếp cho danh từ đứng ngay sau dấu phẩy.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 5. #C033: Hộp Lưu Ý Khác Biệt Tư Duy IELTS vs. Digital SAT */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-950/30 via-slate-900 to-amber-950/30 border border-rose-500/40">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-base">⚠️</span>
            <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wide">
              Khác Biệt Tư Duy Cốt Lõi: IELTS vs. Digital SAT (#C033)
            </h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Trong bài thi IELTS, thí sinh có thể dùng tư duy liên hệ thực tế rộng rãi. Nhưng ở <strong>Digital SAT</strong>,{' '}
            <span className="text-amber-300 font-bold">CẤM TUYỆT ĐỐI SUY DIỄN NGOÀI VĂN BẢN</span>. Bất kỳ đáp án nào nghe
            &quot;rất đúng ngoài đời thật&quot; nhưng không có <strong>chữ-với-chữ chứng minh trực tiếp</strong> trong đoạn văn
            đều là bẫy loại trừ 100%!
          </p>
        </div>

        {/* 6. #C035: Nhãn Phân Loại 4 Bẫy Đáp Án Kinh Điển */}
        <div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>4 Bẫy Đáp Án College Board Kinh Điển (#C035)</span>
            <span className="text-[10px] text-slate-500">nhận diện để né bẫy</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TRAP_TYPES.map((trap) => (
              <div key={trap.id} className={`p-2.5 rounded-xl border ${trap.color} text-xs leading-snug`}>
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <span>{trap.icon}</span>
                  <span>{trap.name}</span>
                </div>
                <p className="text-[11px] opacity-90 pl-5">{trap.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 7. #C032: Thanh Từ Điển Thuật Ngữ SAT Anh-Việt Nhanh */}
        {matchedGlossary.length > 0 && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <span>📖</span> Từ Điển Thuật Ngữ Học Thuật Nhanh (#C032)
              </span>
              <span className="text-[10px] text-slate-400">chạm vào để tra nghĩa</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {matchedGlossary.map(([word, info]) => {
                const isSelected = selectedGlossaryWord === word;
                return (
                  <button
                    key={word}
                    type="button"
                    onClick={() => setSelectedGlossaryWord(isSelected ? null : word)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-slate-700'
                    }`}
                  >
                    <span>{word}</span>
                    <span className="text-[10px] opacity-75 font-mono">({info.pos})</span>
                  </button>
                );
              })}
            </div>

            {/* Chi tiết từ đang chọn */}
            {selectedGlossaryWord && SAT_GLOSSARY[selectedGlossaryWord] && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-slate-900 border border-cyan-500/40 text-xs animate-in fade-in duration-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-white uppercase">{selectedGlossaryWord}</span>
                  <span className="text-cyan-400 font-mono text-[10px]">
                    {SAT_GLOSSARY[selectedGlossaryWord].pos}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-cyan-200 font-semibold">
                    {SAT_GLOSSARY[selectedGlossaryWord].vi}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 italic">
                  &quot;{SAT_GLOSSARY[selectedGlossaryWord].example}&quot;
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
