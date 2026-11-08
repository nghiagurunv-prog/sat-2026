/**
 * ============================================================================
 *  ANSWER MATCH (pure) — so khớp đáp án học sinh với đáp án đúng lưu server
 * ============================================================================
 *  🔴 SỬA LỖI CRITICAL (2026-07-09, ROOT A): trước đây MỌI nơi chấm chỉ so KÝ TỰ
 *  ĐẦU: `userAnswer.trim()[0] === correct.trim()[0]`. Đúng cho câu trắc nghiệm CÓ
 *  NHÃN ("A) ...", "B) ..." — client gửi cả chuỗi có nhãn), NHƯNG ngân hàng câu AI
 *  (question_bank.json) lưu correct_choice dạng THÔ KHÔNG nhãn: "x = 2", "(1, 0)",
 *  "49π", "$\\frac{4}{5}$", "tranquility". Khi đó mọi lựa chọn "x = 1/2/3/4" đều
 *  cùng ký tự đầu 'x' → CHỌN SAI VẪN CHẤM ĐÚNG → (1) faucet xu (/api/grade cộng
 *  thưởng theo kết quả), (2) mastery bẩn (recordAnswer bơm sai), (3) điểm thi ảo.
 *  Xác minh dữ liệu thật: 14/24 câu bank ở dạng thô, 10/24 có lựa chọn sai lọt qua.
 *
 *  Cách so ĐÚNG, giữ 0 regression cho câu có nhãn:
 *    • correct_choice có nhãn /^[A-E][).]/ → so KÝ TỰ ĐẦU (như cũ; câu trắc nghiệm
 *      có nhãn, client gửi chuỗi bắt đầu bằng cùng chữ cái).
 *    • còn lại (đáp án thô)                → so KHỚP TOÀN CHUỖI đã chuẩn hoá
 *      (trim + gom khoảng trắng). Học sinh chọn nguyên văn 1 lựa chọn nên so
 *      chuỗi khớp chính xác, không tạo dương-tính-giả (faucet) lẫn âm-tính-giả.
 *  Rỗng ↔ rỗng KHÔNG BAO GIỜ khớp (đóng luôn lỗ answer=""/correct_choice="").
 * ============================================================================
 */

/** Chuẩn hoá: bỏ khoảng trắng đầu/cuối + gom khoảng trắng liên tiếp về 1 dấu cách. */
export function normalizeAnswer(s: string | null | undefined): string {
  return String(s ?? '').trim().replace(/\s+/g, ' ');
}

/** Đáp án dạng trắc nghiệm CÓ NHÃN: bắt đầu bằng A–E + ')' hoặc '.'. */
const LABELED = /^[A-E][).]/;

/**
 * Phân tích chuỗi đáp án thành số học (hỗ trợ số nguyên, số thập phân, phân số,
 * bỏ dấu $ hoặc %, bỏ dấu phẩy ngăn cách hàng nghìn).
 * Trả về number hữu hạn hoặc null nếu không phải định dạng số hợp lệ.
 */
export function parseNumericAnswer(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let str = String(raw).trim();
  if (!str) return null;

  // Trim khoảng trắng, bỏ ký hiệu $ hoặc % ở đầu/cuối nếu có
  str = str.replace(/^\$/, '').replace(/%$/, '').trim();
  // Bỏ dấu phẩy ngăn cách hàng nghìn (ví dụ 1,200 -> 1200)
  str = str.replace(/,/g, '');

  // Nếu khớp phân số /^[+-]?\d+(?:\.\d+)?\s*\/\s*[+-]?\d+(?:\.\d+)?$/: tách tử số num và mẫu số den
  const fracMatch = str.match(/^([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)$/);
  if (fracMatch) {
    const num = Number(fracMatch[1]);
    const den = Number(fracMatch[2]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    const val = num / den;
    return Number.isFinite(val) ? val : null;
  }

  // Nếu khớp số thập phân/số nguyên /^[+-]?(?:\d+\.?\d*|\.\d+)$/: trả về Number(str)
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(str)) {
    const val = Number(str);
    return Number.isFinite(val) ? val : null;
  }

  return null;
}

/**
 * Chấm 1 đáp án: userAnswer (client gửi, nguyên văn lựa chọn đã chọn) so với
 * correctChoice (đáp án đúng lưu server). Thuần — không I/O, unit-test được.
 */
export function matchesAnswer(
  userAnswer: string | null | undefined,
  correctChoice: string | string[] | null | undefined
): boolean {
  // Khớp mảng string[] nếu correctChoice là mảng
  if (Array.isArray(correctChoice)) {
    return correctChoice.some((c) => matchesAnswer(userAnswer, c));
  }

  const u = normalizeAnswer(userAnswer);
  const c = normalizeAnswer(correctChoice);
  if (!u || !c) return false; // rỗng không bao giờ khớp (chống undefined===undefined)

  // Câu trắc nghiệm CÓ NHÃN → so ký tự đầu (giữ đúng hành vi cũ, 0 regression).
  if (LABELED.test(c)) {
    return u[0].toUpperCase() === c[0].toUpperCase();
  }

  // Khớp chữ cái lựa chọn (A, B, C, D) hoặc dạng có nhãn "A) ..."
  if (LABELED.test(u) && /^[A-E]$/i.test(c)) {
    return u[0].toUpperCase() === c.toUpperCase();
  }
  if (/^[A-E]$/i.test(u) && /^[A-E]$/i.test(c)) {
    return u.toUpperCase() === c.toUpperCase();
  }

  // Đáp án THÔ → so khớp toàn chuỗi đã chuẩn hoá.
  if (u === c) {
    return true;
  }

  // Xử lý câu tự luận Toán (SPR / Grid-in):
  // Nếu typeof correct === 'string' và chưa khớp chuỗi trực tiếp:
  // Hỗ trợ tách các phương án đúng phân cách bởi ; hoặc | hoặc or (nếu chuỗi ngắn <= 30 ký tự dạng SPR).
  const candidates =
    c.length <= 30
      ? c.split(/;\s*|\s*\|\s*|\s+or\s+/i).map((s) => s.trim()).filter(Boolean)
      : [c];

  const uVal = parseNumericAnswer(u);

  for (const candidate of candidates) {
    if (u === candidate || u.toLowerCase() === candidate.toLowerCase()) {
      return true;
    }

    // So sánh giá trị số học qua parseNumericAnswer (chuẩn College Board SPR)
    if (uVal !== null && Number.isFinite(uVal)) {
      const cVal = parseNumericAnswer(candidate);
      if (cVal !== null && Number.isFinite(cVal) && Math.abs(uVal - cVal) <= 1e-3) {
        return true;
      }
    }
  }

  return false;
}
