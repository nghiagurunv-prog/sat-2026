"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface BluebookToolsProps {
  compact?: boolean;
}

type DesmosSizeMode = "normal" | "large" | "split";
type ReferenceTab = "bluebook" | "must_know" | "dictionary" | "rw_stats";
type VocabCategory = "all" | "arithmetic" | "algebra" | "geometry" | "statistics";

const SCRATCHPAD_STORAGE_KEY = "sat_bluebook_scratchpad_v1";
const DESMOS_SIZE_STORAGE_KEY = "sat_desmos_size_mode_v1";

// Quick math symbols for scratchpad
const SCRATCHPAD_SYMBOLS = ["x²", "x³", "√", "π", "⇒", "≠", "≤", "≥", "±", "°", "θ", "½", "Δ", "·", "≈"];

// 10 Desmos Battle-Tested Tricks (Items 32 & 33)
interface DesmosTrick {
  id: number;
  title: string;
  code: string;
  desc: string;
  tag: string;
}

const DESMOS_TRICKS: DesmosTrick[] = [
  {
    id: 1,
    title: "1. Hồi quy tuyến tính từ bảng 2 điểm",
    code: "y_1 ~ m x_1 + b",
    desc: "Bấm '+' chọn 'table', nhập tọa độ các điểm vào cột (x1, y1), dòng dưới gõ 'y_1 ~ m x_1 + b'. Desmos tính ngay hệ số góc m và tung độ gốc b.",
    tag: "Đại số",
  },
  {
    id: 2,
    title: "2. Hồi quy Parabol bậc 2 từ 3 điểm",
    code: "y_1 ~ a x_1^2 + b x_1 + c",
    desc: "Nhập 3 điểm vào bảng, gõ 'y_1 ~ a x_1^2 + b x_1 + c'. Desmos cho ngay phương trình Parabol chính xác 100%.",
    tag: "Bậc hai",
  },
  {
    id: 3,
    title: "3. Hồi quy Hàm mũ tăng trưởng / phân rã",
    code: "y_1 ~ a b^{x_1}",
    desc: "Dùng cho bài toán lãi suất kép, vi khuẩn tăng trưởng, hoặc giá trị khấu hao giảm dần theo thời gian.",
    tag: "Hàm mũ",
  },
  {
    id: 4,
    title: "4. Giải phương trình / hệ phương trình bằng giao điểm",
    code: "y = 3x^2 - 5x + 1\ny = 2x + 4",
    desc: "Nhập vế trái dòng 1, vế phải dòng 2 (hoặc 2 PT). Desmos tự đánh dấu chấm xám tại các giao điểm. Click vào chấm xám là hiện ngay nghiệm x và y.",
    tag: "Hệ PT",
  },
  {
    id: 5,
    title: "5. Tính Trung bình & Trung vị danh sách số",
    code: "mean([12, 15, 18, 22, 90])\nmedian([12, 15, 18, 22, 90])",
    desc: "Đưa các số vào ngoặc vuông [ ]. Desmos tính ngay Mean và Median siêu tốc, nhanh hơn bấm máy cầm tay gấp 5 lần.",
    tag: "Thống kê",
  },
  {
    id: 6,
    title: "6. Độ lệch chuẩn mẫu thống kê (Standard Deviation)",
    code: "stdev([10, 12, 14, 16, 18])",
    desc: "Gõ 'stdev(...)' cho mẫu số liệu (sample). Gõ 'stdevp(...)' cho quần thể (population).",
    tag: "Thống kê",
  },
  {
    id: 7,
    title: "7. Vẽ đường tròn tìm Tâm & Bán kính",
    code: "(x - 3)^2 + (y + 2)^2 = 25",
    desc: "Desmos vẽ được cả dạng khai triển x² + y² - 6x + 4y - 12 = 0. Bạn thấy ngay tâm và bán kính mà không cần hoàn thành bình phương!",
    tag: "Hình học",
  },
  {
    id: 8,
    title: "8. Tìm cực trị / Đỉnh Parabol nhanh",
    code: "f(x) = -2x^2 + 8x + 5",
    desc: "Gõ f(x), sau đó click trực tiếp vào đỉnh cao nhất hoặc thấp nhất trên đồ thị, Desmos hiện ngay tọa độ đỉnh (h, k) màu xám.",
    tag: "Bậc hai",
  },
  {
    id: 9,
    title: "9. Giải tham số k bằng thanh trượt (Slider)",
    code: "2x + k = 10",
    desc: "Nhập biểu thức chứa tham số, bấm 'add slider: k'. Kéo thanh trượt k để quan sát số nghiệm thay đổi trực quan.",
    tag: "Tham số",
  },
  {
    id: 10,
    title: "10. Đổi số thập phân sang Phân số tối giản",
    code: "15 / 7",
    desc: "Gõ phép chia hoặc số thập phân (vd: 0.428571), bấm vào biểu tượng hình chữ nhật chia đôi a/b ở bên trái kết quả để chuyển thành phân số tối giản.",
    tag: "Bấm máy",
  },
];

// 85+ High-Frequency SAT Math Vocabulary Terms (Item 31)
interface MathVocabItem {
  term: string;
  pron?: string;
  vi: string;
  cat: "arithmetic" | "algebra" | "geometry" | "statistics";
  trap: string;
}

const MATH_VOCABULARY: MathVocabItem[] = [
  // --- ARITHMETIC ---
  { term: "Integer", pron: "/ˈɪntɪdʒər/", vi: "Số nguyên (... -2, -1, 0, 1, 2...)", cat: "arithmetic", trap: "0 là số nguyên chẵn nhưng KHÔNG âm cũng KHÔNG dương." },
  { term: "Positive integer", pron: "", vi: "Số nguyên dương (1, 2, 3...)", cat: "arithmetic", trap: "Số 0 KHÔNG phải số nguyên dương!" },
  { term: "Negative integer", pron: "", vi: "Số nguyên âm (-1, -2, -3...)", cat: "arithmetic", trap: "Lưu ý dấu '-' khi bình phương: (-3)² = 9, nhưng -3² = -9." },
  { term: "Consecutive integers", pron: "", vi: "Các số nguyên liên tiếp (n, n+1, n+2...)", cat: "arithmetic", trap: "Nếu đề bảo 'consecutive even/odd' thì khoảng cách là 2: n, n+2, n+4." },
  { term: "Even / Odd number", pron: "", vi: "Số chẵn / Số lẻ", cat: "arithmetic", trap: "0 là số chẵn. Chẵn × Lẻ = Chẵn; Lẻ × Lẻ = Lẻ; Chẵn + Lẻ = Lẻ." },
  { term: "Prime number", pron: "", vi: "Số nguyên tố (2, 3, 5, 7, 11, 13...)", cat: "arithmetic", trap: "2 là số nguyên tố chẵn DUY NHẤT. Số 1 KHÔNG phải số nguyên tố!" },
  { term: "Factor / Divisor", pron: "", vi: "Ước số (chia hết)", cat: "arithmetic", trap: "Ví dụ các ước nguyên dương của 12 là 1, 2, 3, 4, 6, 12." },
  { term: "Multiple", pron: "", vi: "Bội số", cat: "arithmetic", trap: "Bội số của 5 là 5, 10, 15, 20... Khác với Factor!" },
  { term: "Remainder", pron: "", vi: "Số dư phép chia", cat: "arithmetic", trap: "Số dư luôn ≥ 0 và luôn nhỏ hơn số chia." },
  { term: "Reciprocal", pron: "", vi: "Số nghịch đảo (1/x)", cat: "arithmetic", trap: "Tích của 1 số và nghịch đảo của nó luôn bằng 1. Số 0 không có nghịch đảo." },
  { term: "Absolute value", pron: "", vi: "Giá trị tuyệt đối |x|", cat: "arithmetic", trap: "Luôn ≥ 0. |x - a| là khoảng cách giữa x và a trên trục số." },
  { term: "Distinct", pron: "", vi: "Khác nhau, phân biệt", cat: "arithmetic", trap: "'Three distinct integers' nghĩa là 3 số phải hoàn toàn khác nhau." },
  { term: "At least", pron: "", vi: "Ít nhất, tối thiểu (≥)", cat: "arithmetic", trap: "Bao gồm cả dấu bằng (≥), không được nhầm thành >." },
  { term: "At most", pron: "", vi: "Nhiều nhất, tối đa (≤)", cat: "arithmetic", trap: "Bao gồm cả dấu bằng (≤), không được nhầm thành <." },
  { term: "Exceeds", pron: "", vi: "Vượt quá, lớn hơn", cat: "arithmetic", trap: "'A exceeds B by 7' dịch thành phương trình: A - B = 7 (hoặc A = B + 7)." },
  { term: "Sum / Difference", pron: "", vi: "Tổng (+) / Hiệu (-)", cat: "arithmetic", trap: "'Difference between A and B' thường hiểu là |A - B| nếu đề không chỉ rõ thứ tự." },
  { term: "Product / Quotient", pron: "", vi: "Tích (×) / Thương (÷)", cat: "arithmetic", trap: "Quotient of a and b là a / b." },
  { term: "Numerator / Denominator", pron: "", vi: "Tử số / Mẫu số", cat: "arithmetic", trap: "Mẫu số (Denominator) luôn phải khác 0." },
  { term: "Ratio / Proportion", pron: "", vi: "Tỷ lệ (a:b) / Tỷ lệ thức (a/b = c/d)", cat: "arithmetic", trap: "Tỷ lệ a:b tổng a+b phần. Tỉ số phần của A là a/(a+b)." },
  { term: "Directly proportional", pron: "", vi: "Tỷ lệ thuận (y = kx)", cat: "arithmetic", trap: "Tỉ số y/x luôn là hằng số k." },
  { term: "Inversely proportional", pron: "", vi: "Tỷ lệ nghịch (y = k/x hoặc xy = k)", cat: "arithmetic", trap: "Tích x·y luôn là hằng số k." },
  { term: "Percent increase / decrease", pron: "", vi: "Phần trăm tăng / giảm", cat: "arithmetic", trap: "Luôn chia cho giá trị BAN ĐẦU: (Mới - Cũ) / Cũ × 100%." },

  // --- ALGEBRA ---
  { term: "Linear equation", pron: "", vi: "Phương trình bậc nhất (y = mx + b)", cat: "algebra", trap: "Đồ thị là đường thẳng. m là hệ số góc, b là tung độ gốc." },
  { term: "Slope", pron: "", vi: "Hệ số góc m = (y2 - y1) / (x2 - x1)", cat: "algebra", trap: "Đường thẳng nằm ngang có slope = 0. Đường thẳng đứng slope không xác định (undefined)." },
  { term: "y-intercept", pron: "", vi: "Tung độ gốc (giao trục Oy tại x = 0)", cat: "algebra", trap: "Tọa độ giao điểm luôn có dạng (0, b)." },
  { term: "x-intercept / Zero / Root", pron: "", vi: "Hoành độ gốc / Nghiệm (giao trục Ox)", cat: "algebra", trap: "Tọa độ giao điểm luôn có dạng (x, 0). Cho y = 0 để tìm x." },
  { term: "Parallel lines", pron: "", vi: "Hai đường thẳng song song", cat: "algebra", trap: "Hệ số góc bằng nhau (m1 = m2), tung độ gốc khác nhau (b1 ≠ b2)." },
  { term: "Perpendicular lines", pron: "", vi: "Hai đường thẳng vuông góc", cat: "algebra", trap: "Tích 2 hệ số góc bằng -1 (m1 · m2 = -1, tức m2 = -1/m1)." },
  { term: "System of equations", pron: "", vi: "Hệ phương trình", cat: "algebra", trap: "Nghiệm của hệ chính là tọa độ giao điểm của các đồ thị." },
  { term: "No solution", pron: "", vi: "Vô nghiệm (2 đường song song)", cat: "algebra", trap: "Tỉ lệ hệ số x và y bằng nhau nhưng khác hệ số tự do: a1/a2 = b1/b2 ≠ c1/c2." },
  { term: "Infinitely many solutions", pron: "", vi: "Vô số nghiệm (2 đường trùng nhau)", cat: "algebra", trap: "Mọi hệ số đều cùng tỷ lệ: a1/a2 = b1/b2 = c1/c2." },
  { term: "Quadratic function", pron: "", vi: "Hàm số bậc hai (y = ax² + bx + c)", cat: "algebra", trap: "Đồ thị là parabol. a > 0 ngửa lên (đỉnh cực tiểu), a < 0 úp xuống (đỉnh cực đại)." },
  { term: "Vertex", pron: "", vi: "Đỉnh Parabol (h, k)", cat: "algebra", trap: "Hoành độ đỉnh h = -b / (2a). Tung độ k là giá trị Min (khi a>0) hoặc Max (khi a<0)." },
  { term: "Axis of symmetry", pron: "", vi: "Trục đối xứng của Parabol", cat: "algebra", trap: "Phương trình đường thẳng đứng: x = -b / (2a)." },
  { term: "Discriminant (Delta)", pron: "", vi: "Biệt thức Δ = b² - 4ac", cat: "algebra", trap: "Δ > 0: 2 nghiệm thực; Δ = 0: 1 nghiệm kép (tiếp xúc Ox); Δ < 0: vô nghiệm thực." },
  { term: "Vertex form", pron: "", vi: "Dạng đỉnh: y = a(x - h)² + k", cat: "algebra", trap: "Đỉnh là (h, k). CHÚ Ý dấu trừ trong ngoặc: (x - 3)² nghĩa là h = +3." },
  { term: "Factored form", pron: "", vi: "Dạng nghiệm: y = a(x - x1)(x - x2)", cat: "algebra", trap: "Cắt trục Ox tại x1 và x2. Hoành độ đỉnh nằm chính giữa: h = (x1 + x2) / 2." },
  { term: "Exponential growth", pron: "", vi: "Hàm mũ tăng trưởng y = a(1 + r)ᵗ", cat: "algebra", trap: "Cơ số b = 1 + r > 1. a là giá trị ban đầu tại t = 0." },
  { term: "Exponential decay", pron: "", vi: "Hàm mũ suy giảm y = a(1 - r)ᵗ", cat: "algebra", trap: "Cơ số b = 1 - r nằm giữa 0 và 1." },
  { term: "Initial value", pron: "", vi: "Giá trị ban đầu (tại x = 0 hoặc t = 0)", cat: "algebra", trap: "Chính là tung độ gốc (y-intercept) của hàm số." },
  { term: "Constant", pron: "", vi: "Hằng số (giá trị không đổi)", cat: "algebra", trap: "Ví dụ trong 3x + k = 10 thì k và 10 là hằng số." },
  { term: "Coefficient", pron: "", vi: "Hệ số (số nhân trước biến)", cat: "algebra", trap: "Trong biểu thức -7x³, hệ số của x³ là -7 (tính cả dấu âm)." },
  { term: "Domain / Range", pron: "", vi: "Tập xác định (x) / Tập giá trị (y)", cat: "algebra", trap: "Domain là các giá trị hợp lệ của x. Range là tất cả các giá trị có thể đạt được của y." },
  { term: "Inequality", pron: "", vi: "Bất phương trình (<, ≤, >, ≥)", cat: "algebra", trap: "Nhân hoặc chia cả 2 vế cho số ÂM BẮT BUỘC PHẢI ĐỔI CHIỀU bất đẳng thức!" },

  // --- GEOMETRY ---
  { term: "Hypotenuse", pron: "", vi: "Cạnh huyền (tam giác vuông)", cat: "geometry", trap: "Cạnh đối diện góc 90°, luôn là cạnh dài nhất trong tam giác vuông." },
  { term: "Leg", pron: "", vi: "Cạnh góc vuông", cat: "geometry", trap: "Hai cạnh kề góc 90°. Định lý Pytago: leg₁² + leg₂² = hypotenuse²." },
  { term: "Isosceles triangle", pron: "", vi: "Tam giác cân (2 cạnh bằng nhau)", cat: "geometry", trap: "2 góc đáy đối diện 2 cạnh bằng nhau cũng bằng nhau." },
  { term: "Equilateral triangle", pron: "", vi: "Tam giác đều (3 cạnh bằng nhau)", cat: "geometry", trap: "3 góc đều bằng 60°. Chiều cao h = (s√3)/2, Diện tích A = (s²√3)/4." },
  { term: "Congruent", pron: "", vi: "Bằng nhau, trùng khít (≅)", cat: "geometry", trap: "Cùng hình dạng và cùng kích thước tuyệt đối." },
  { term: "Similar triangles", pron: "", vi: "Tam giác đồng dạng (~)", cat: "geometry", trap: "Các góc bằng nhau, tỉ số cạnh tương ứng bằng k. Tỉ số diện tích là k²!" },
  { term: "Perimeter", pron: "", vi: "Chu vi (tổng độ dài các cạnh)", cat: "geometry", trap: "Hình khép kín có chu vi là tổng đường bao bên ngoài." },
  { term: "Circumference", pron: "", vi: "Chu vi đường tròn C = 2πr = πd", cat: "geometry", trap: "Đừng nhầm với diện tích A = πr²." },
  { term: "Radius / Diameter", pron: "", vi: "Bán kính (r) / Đường kính (d = 2r)", cat: "geometry", trap: "Đề bài hay cho đường kính nhưng công thức tính cần bán kính: nhớ chia đôi!" },
  { term: "Chord", pron: "", vi: "Dây cung", cat: "geometry", trap: "Đoạn thẳng nối 2 điểm trên đường tròn. Đường kính là dây cung dài nhất." },
  { term: "Tangent line", pron: "", vi: "Tiếp tuyến đường tròn", cat: "geometry", trap: "Tiếp tuyến luôn VUÔNG GÓC với bán kính tại tiếp điểm." },
  { term: "Inscribed angle", pron: "", vi: "Góc nội tiếp (đỉnh trên đường tròn)", cat: "geometry", trap: "Số đo góc nội tiếp bằng 1/2 số đo góc ở tâm chắn cùng cung đó." },
  { term: "Central angle", pron: "", vi: "Góc ở tâm (đỉnh tại tâm đường tròn)", cat: "geometry", trap: "Số đo góc ở tâm bằng đúng số đo cung bị chắn." },
  { term: "Arc length", pron: "", vi: "Độ dài cung tròn: s = rθ (θ radian)", cat: "geometry", trap: "Nếu góc cho bằng độ: s = (n° / 360°) × 2πr." },
  { term: "Sector area", pron: "", vi: "Diện tích hình quạt: A = 0.5r²θ (θ rad)", cat: "geometry", trap: "Nếu góc cho bằng độ: A = (n° / 360°) × πr²." },
  { term: "Regular polygon", pron: "", vi: "Đa giác đều (cạnh & góc đều bằng nhau)", cat: "geometry", trap: "Tổng các góc trong đa giác n cạnh là (n - 2) × 180°." },
  { term: "Quadrilateral", pron: "", vi: "Tứ giác (hình 4 cạnh)", cat: "geometry", trap: "Tổng 4 góc trong của bất kỳ tứ giác nào luôn bằng 360°." },
  { term: "Parallelogram / Trapezoid", pron: "", vi: "Hình bình hành / Hình thang", cat: "geometry", trap: "Diện tích hình thang: A = ((đáy lớn + đáy nhỏ) / 2) × chiều cao." },
  { term: "Surface area", pron: "", vi: "Diện tích toàn phần bề mặt khối 3D", cat: "geometry", trap: "Tổng diện tích của tất cả các mặt bên ngoài." },
  { term: "Volume", pron: "", vi: "Thể tích khối 3D", cat: "geometry", trap: "Khối lăng trụ/trụ: V = Đáy × Cao. Khối chóp/nón: V = 1/3 × Đáy × Cao." },
  { term: "Cylinder", pron: "", vi: "Hình trụ tròn: V = πr²h", cat: "geometry", trap: "Diện tích xung quanh là 2πrh." },
  { term: "Cone", pron: "", vi: "Hình nón tròn: V = (1/3)πr²h", cat: "geometry", trap: "Chú ý phân biệt chiều cao đứng h và đường sinh nghiêng l: l² = r² + h²." },
  { term: "Sphere", pron: "", vi: "Hình cầu: V = (4/3)πr³, S = 4πr²", cat: "geometry", trap: "Để ý số mũ: Thể tích là r³, Diện tích mặt cầu là r²." },

  // --- STATISTICS ---
  { term: "Mean / Average", pron: "", vi: "Trung bình cộng = Tổng / Số lượng", cat: "statistics", trap: "Rất nhạy cảm với Outlier (ngoại lai). Một giá trị cực lớn sẽ kéo Mean tăng vọt." },
  { term: "Median", pron: "", vi: "Trung vị (số chính giữa khi đã sắp xếp)", cat: "statistics", trap: "RẤT BỀN VỮNG: Outlier hầu như không làm thay đổi Median." },
  { term: "Mode", pron: "", vi: "Mốt (giá trị xuất hiện nhiều lần nhất)", cat: "statistics", trap: "Một tập dữ liệu có thể có 1 mốt, nhiều mốt hoặc không có mốt nào." },
  { term: "Range", pron: "", vi: "Khoảng biến thiên = Max - Min", cat: "statistics", trap: "Chỉ phụ thuộc vào 2 giá trị cực đoan nhất, không phản ánh các giá trị ở giữa." },
  { term: "Standard deviation", pron: "", vi: "Độ lệch chuẩn (đo độ phân tán)", cat: "statistics", trap: "Dữ liệu càng chụm gần mean thì SD càng bé. Cộng/trừ mọi số với hằng số k thì SD KHÔNG ĐỔI!" },
  { term: "Margin of error", pron: "", vi: "Biên độ sai số khảo sát", cat: "statistics", trap: "Tỷ lệ nghịch với căn cỡ mẫu: Cỡ mẫu n càng lớn thì Margin of Error càng NHỎ!" },
  { term: "Random sample", pron: "", vi: "Mẫu ngẫu nhiên", cat: "statistics", trap: "Chỉ suy rộng kết quả cho đúng quần thể (target population) mà mẫu được lấy ra." },
  { term: "Population", pron: "", vi: "Quần thể mục tiêu nghiên cứu", cat: "statistics", trap: "Khảo sát học sinh trường A thì kết luận CHỈ áp dụng cho trường A, không áp dụng cho cả nước." },
  { term: "Outlier", pron: "", vi: "Giá trị ngoại lai (đột biến bất thường)", cat: "statistics", trap: "Outlier ảnh hưởng mạnh đến Mean và Range, nhưng KHÔNG ảnh hưởng Median." },
  { term: "Scatterplot", pron: "", vi: "Biểu đồ phân tán điểm (x, y)", cat: "statistics", trap: "Dùng để đánh giá mối tương quan giữa 2 biến liên tục." },
  { term: "Line of best fit", pron: "", vi: "Đường xu hướng hồi quy", cat: "statistics", trap: "Đường thẳng đại diện cho xu hướng chung, không nhất thiết đi qua các điểm dữ liệu." },
  { term: "Correlation vs Causation", pron: "", vi: "Tương quan vs Nhân quả", cat: "statistics", trap: "CHỈ có thí nghiệm phân bổ ngẫu nhiên (Randomized Experiment) mới chứng minh được Nhân quả!" },
];

// Helper to validate SPR inputs (Item 14)
interface SprValidationResult {
  isValid: boolean;
  message: string;
  type: "success" | "warning" | "error";
}

function validateSprInput(val: string): SprValidationResult {
  const trimmed = val.trim();
  if (!trimmed) {
    return { isValid: false, message: "Nhập thử đáp án để kiểm tra tính hợp lệ quy chuẩn SPR", type: "warning" };
  }
  if (val.includes(" ")) {
    return {
      isValid: false,
      message: "CẢNH BÁO: Không được chứa dấu cách! Nếu nhập hỗn số (vd '2 1/7'), máy quét Bluebook sẽ tự hiểu là '21/7' (= 3). Hãy đổi sang phân số '15/7' hoặc số thập phân '2.143'.",
      type: "error",
    };
  }
  if (val.includes(",")) {
    return {
      isValid: false,
      message: "CẢNH BÁO: Không dùng dấu phẩy ','. Bluebook chỉ chấp nhận dấu chấm '.' cho số thập phân (vd: 3.14).",
      type: "error",
    };
  }
  if (/[%a-zA-Z]/.test(val)) {
    return {
      isValid: false,
      message: "CẢNH BÁO: Không nhập chữ cái, ký hiệu % hoặc đơn vị đo (cm, kg, $). Chỉ nhập số nguyên, phân số hoặc số thập phân.",
      type: "error",
    };
  }
  const isNegative = trimmed.startsWith("-");
  const charLimit = isNegative ? 6 : 5;
  if (trimmed.length > charLimit) {
    return {
      isValid: false,
      message: `Quá dài (${trimmed.length} ký tự)! College Board quy định tối đa ${charLimit} ký tự đối với số ${isNegative ? "âm" : "dương"}.`,
      type: "error",
    };
  }
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (
      parts.length !== 2 ||
      !parts[0] ||
      !parts[1] ||
      parts[0].includes(".") ||
      parts[1].includes(".") ||
      parts[1].startsWith("-") ||
      Number(parts[1]) === 0 ||
      isNaN(Number(parts[0])) ||
      isNaN(Number(parts[1]))
    ) {
      return {
        isValid: false,
        message: "CẢNH BÁO (#040): Phân số SPR không hợp lệ! Tử và mẫu phải là số nguyên (không chứa dấu chấm thập phân, mẫu số phải dương và khác 0).",
        type: "error",
      };
    }
  }
  if (/^-?0?\.(66|67|33)$/.test(trimmed)) {
    return {
      isValid: true,
      message: `LƯU Ý (#040): Số thập phân vô hạn tuần hoàn phải điền kín toàn bộ ${charLimit} ký tự (vd: .6666, .6667 hoặc 2/3) thay vì viết ngắn '${trimmed}'!`,
      type: "warning",
    };
  }
  return {
    isValid: true,
    message: `HỢP LỆ! Độ dài: ${trimmed.length}/${charLimit} ký tự. Thỏa mãn hoàn toàn tiêu chuẩn điền đáp án tự luận Bluebook.`,
    type: "success",
  };
}

// Helper to clamp draggable window coordinates inside viewport (#063)
function clampPosition(pos: { x: number; y: number }): { x: number; y: number } {
  if (typeof window === "undefined") return pos;
  const minX = 0;
  const maxX = Math.max(0, window.innerWidth - 120);
  const minY = 0;
  const maxY = Math.max(0, window.innerHeight - 80);

  return {
    x: Math.min(Math.max(minX, pos.x), maxX),
    y: Math.min(Math.max(minY, pos.y), maxY),
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BluebookTools({ compact = false }: BluebookToolsProps) {
  // Modal toggles
  const [showDesmos, setShowDesmos] = useState(false);
  const [desmosSize, setDesmosSize] = useState<DesmosSizeMode>("normal");
  const [showDesmosCheats, setShowDesmosCheats] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [activeRefTab, setActiveRefTab] = useState<ReferenceTab>("bluebook");
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [showSprRules, setShowSprRules] = useState(false);

  // Desmos draggable state (#063)
  const [desmosPos, setDesmosPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingDesmos, setIsDraggingDesmos] = useState(false);
  const desmosDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reference Sheet draggable state (#063)
  const [refPos, setRefPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingRef, setIsDraggingRef] = useState(false);
  const refDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Desmos CDN / iframe retry state (#062) & persistent mount (#039)
  const [desmosError, setDesmosError] = useState(false);
  const [desmosRetryKey, setDesmosRetryKey] = useState(0);
  const hasOpenedDesmosRef = useRef(false);
  if (showDesmos) {
    hasOpenedDesmosRef.current = true;
  }

  const retryLoadDesmos = useCallback(() => {
    setDesmosError(false);
    setDesmosRetryKey((k) => k + 1);
  }, []);

  // Escape key handler to close active modals/drawers (#066)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowDesmos(false);
        setShowReference(false);
        setShowScratchpad(false);
        setShowSprRules(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Viewport resize listener: re-clamp draggable windows (#063)
  useEffect(() => {
    const handleResize = () => {
      setDesmosPos((prev) => (prev ? clampPosition(prev) : null));
      setRefPos((prev) => (prev ? clampPosition(prev) : null));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mouse drag listeners for Desmos
  useEffect(() => {
    if (!isDraggingDesmos) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rawX = e.clientX - desmosDragOffsetRef.current.x;
      const rawY = e.clientY - desmosDragOffsetRef.current.y;
      setDesmosPos(clampPosition({ x: rawX, y: rawY }));
    };

    const handleMouseUp = () => {
      setIsDraggingDesmos(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingDesmos]);

  // Mouse drag listeners for Reference Sheet
  useEffect(() => {
    if (!isDraggingRef) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rawX = e.clientX - refDragOffsetRef.current.x;
      const rawY = e.clientY - refDragOffsetRef.current.y;
      setRefPos(clampPosition({ x: rawX, y: rawY }));
    };

    const handleMouseUp = () => {
      setIsDraggingRef(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingRef]);

  const handleDesmosDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, input, select, textarea, a")) {
      return;
    }
    if (desmosSize !== "normal") return;

    const rect = (e.currentTarget.parentElement as HTMLElement)?.getBoundingClientRect();
    if (!rect) return;

    desmosDragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    if (!desmosPos) {
      setDesmosPos({ x: rect.left, y: rect.top });
    }
    setIsDraggingDesmos(true);
  };

  const handleRefDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, input, select, textarea, a")) {
      return;
    }
    const rect = (e.currentTarget.parentElement as HTMLElement)?.getBoundingClientRect();
    if (!rect) return;

    refDragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    if (!refPos) {
      setRefPos({ x: rect.left, y: rect.top });
    }
    setIsDraggingRef(true);
  };

  // Scratchpad state (Item 13)
  const [scratchText, setScratchText] = useState("");

  // Desmos copy toast feedback
  const [copiedTrickId, setCopiedTrickId] = useState<number | null>(null);

  // Vocabulary search & filter (Item 31)
  const [vocabSearch, setVocabSearch] = useState("");
  const [vocabCategory, setVocabCategory] = useState<VocabCategory>("all");

  // SPR interactive tester (Item 14)
  const [sprTestInput, setSprTestInput] = useState("");

  // Safe localStorage initialization
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedScratch = localStorage.getItem(SCRATCHPAD_STORAGE_KEY);
        if (savedScratch !== null) setScratchText(savedScratch);

        const savedSize = localStorage.getItem(DESMOS_SIZE_STORAGE_KEY) as DesmosSizeMode | null;
        if (savedSize === "normal" || savedSize === "large" || savedSize === "split") {
          setDesmosSize(savedSize);
        }
      } catch {
        // Ignore localStorage access errors
      }
    }
  }, []);

  // Update Scratchpad & localStorage
  const handleScratchChange = (text: string) => {
    setScratchText(text);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(SCRATCHPAD_STORAGE_KEY, text);
      } catch {
        // Ignore
      }
    }
  };

  const insertSymbol = (sym: string) => {
    handleScratchChange(scratchText + sym);
  };

  const clearScratchpad = () => {
    if (confirm("Bạn có chắc chắn muốn xóa sạch bảng nháp này không?")) {
      handleScratchChange("");
    }
  };

  // Change Desmos size mode & persist
  const handleSetDesmosSize = (size: DesmosSizeMode) => {
    setDesmosSize(size);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(DESMOS_SIZE_STORAGE_KEY, size);
      } catch {
        // Ignore
      }
    }
  };

  // 1-Click Copy Desmos formula (Item 32 & 33)
  const handleCopyTrick = (trick: DesmosTrick) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(trick.code).then(() => {
        setCopiedTrickId(trick.id);
        setTimeout(() => setCopiedTrickId(null), 2400);
      });
    }
  };

  // Filtered Vocabulary (Item 31)
  const filteredVocab = useMemo(() => {
    const q = vocabSearch.trim().toLowerCase();
    return MATH_VOCABULARY.filter((item) => {
      const matchCat = vocabCategory === "all" || item.cat === vocabCategory;
      const matchQuery =
        !q ||
        item.term.toLowerCase().includes(q) ||
        item.vi.toLowerCase().includes(q) ||
        item.trap.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [vocabSearch, vocabCategory]);

  // SPR validation result
  const sprValidation = useMemo(() => validateSprInput(sprTestInput), [sprTestInput]);

  return (
    <>
      {/* ==================================================================== */}
      {/* TOOLBAR BUTTONS */}
      {/* ==================================================================== */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Desmos Graphing Calculator */}
        <button
          type="button"
          onClick={() => setShowDesmos((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition shadow-xs ${showDesmos
              ? "border-cyan-400 bg-cyan-500/25 text-cyan-200 ring-2 ring-cyan-500/40"
              : "border-slate-700 bg-slate-900/90 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200"
            }`}
          title="Bật/Tắt Máy tính đồ thị Desmos chuẩn Digital SAT Bluebook"
        >
          <span>🧮</span>
          <span>{compact ? "Desmos" : "Máy tính Desmos"}</span>
        </button>

        {/* SAT Multi-Tab Reference Sheet */}
        <button
          type="button"
          onClick={() => setShowReference((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition shadow-xs ${showReference
              ? "border-amber-400 bg-amber-500/25 text-amber-200 ring-2 ring-amber-500/40"
              : "border-slate-700 bg-slate-900/90 text-slate-300 hover:border-amber-500/50 hover:text-amber-200"
            }`}
          title="Xem Bảng công thức, Tuyệt chiêu toán học, Từ điển và Quy tắc dấu câu"
        >
          <span>📐</span>
          <span>{compact ? "Công thức" : "Bảng công thức SAT"}</span>
        </button>

        {/* Scratchpad Overlay (Item 13) */}
        <button
          type="button"
          onClick={() => setShowScratchpad((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition shadow-xs ${showScratchpad
              ? "border-emerald-400 bg-emerald-500/25 text-emerald-200 ring-2 ring-emerald-500/40"
              : "border-slate-700 bg-slate-900/90 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-200"
            }`}
          title="Bật/Tắt Bảng nháp điện tử tự động lưu vào bộ nhớ"
        >
          <span>📝</span>
          <span>{compact ? "Nháp" : "Nháp nhanh"}</span>
          {scratchText.trim().length > 0 && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        {/* SPR Directions (Item 14) */}
        <button
          type="button"
          onClick={() => setShowSprRules((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition shadow-xs ${showSprRules
              ? "border-purple-400 bg-purple-500/25 text-purple-200 ring-2 ring-purple-500/40"
              : "border-slate-700 bg-slate-900/90 text-slate-300 hover:border-purple-500/50 hover:text-purple-200"
            }`}
          title="Quy định và cách điền đáp án tự luận Student-Produced Response chuẩn College Board"
        >
          <span>📋</span>
          <span>{compact ? "SPR" : "Quy tắc SPR"}</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 1. SCRATCHPAD OVERLAY (Item 13) */}
      {/* ==================================================================== */}
      {showScratchpad && (
        <div className="fixed bottom-4 left-4 z-50 flex w-[95vw] max-w-[440px] flex-col overflow-hidden rounded-2xl border-2 border-emerald-500/70 bg-slate-950 shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">📝</span>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  Bảng Nháp Nhanh (Scratchpad)
                </div>
                <div className="text-[10px] text-slate-400">
                  Tự động lưu • {scratchText.length} ký tự
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={clearScratchpad}
                className="rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20"
                title="Xóa trắng bảng nháp"
              >
                🗑️ Xóa
              </button>
              <button
                type="button"
                onClick={() => setShowScratchpad(false)}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700"
              >
                ✕ Đóng
              </button>
            </div>
          </div>

          {/* Quick symbol insertion bar */}
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-800/80 bg-slate-900/40 px-3 py-1.5">
            <span className="text-[10px] font-bold text-slate-400">Chèn:</span>
            {SCRATCHPAD_SYMBOLS.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => insertSymbol(sym)}
                className="rounded border border-slate-800 bg-slate-800/80 px-1.5 py-0.5 text-xs font-mono font-bold text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40"
              >
                {sym}
              </button>
            ))}
          </div>

          {/* Text Area */}
          <div className="p-2.5">
            <textarea
              value={scratchText}
              onChange={(e) => handleScratchChange(e.target.value)}
              placeholder="Gõ nháp tính toán, ghi chú công thức, lưu phương án loại trừ... Nội dung luôn được giữ nguyên khi chuyển câu hỏi."
              rows={8}
              className="w-full resize-y rounded-xl border border-slate-800 bg-slate-900/90 p-3 font-mono text-xs text-slate-100 placeholder-slate-500 outline-hidden focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
              <span>Được lưu an toàn vào máy (`sat_bluebook_scratchpad_v1`)</span>
              <span>{scratchText.trim() ? scratchText.trim().split(/\s+/).length : 0} từ</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. SPR DIRECTIONS POPOVER / MODAL (Item 14) */}
      {/* ==================================================================== */}
      {showSprRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border-2 border-purple-500/50 bg-slate-950 p-5 text-slate-100 shadow-2xl">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-purple-400">
                  College Board Official Guidelines
                </div>
                <h3 className="text-lg font-black text-white">
                  📋 Quy Định Điền Đáp Án Tự Luận (SPR - Student-Produced Response)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSprRules(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
              >
                ✕ Đóng
              </button>
            </div>

            {/* 4 Core Rules */}
            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5">
                <div className="mb-1 text-xs font-black uppercase text-purple-300">
                  1. Giới hạn ký tự tối đa (Character Limits)
                </div>
                <p className="leading-relaxed">
                  • <b>Số dương:</b> Tối đa <b>5 ký tự</b> (bao gồm cả dấu chấm <code className="text-purple-300">.</code> hoặc gạch phân số <code className="text-purple-300">/</code>). Ví dụ: <code className="text-purple-200">12345</code>, <code className="text-purple-200">1.234</code>, <code className="text-purple-200">12/35</code>.
                  <br />
                  • <b>Số âm:</b> Tối đa <b>6 ký tự</b> (dấu âm <code className="text-purple-300">-</code> không tính vào 5 ký tự số). Ví dụ: <code className="text-purple-200">-1234</code>, <code className="text-purple-200">-1.23</code>, <code className="text-purple-200">-3/16</code>.
                </p>
              </div>

              <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5">
                <div className="mb-1 text-xs font-black uppercase text-rose-300">
                  2. CẤM NHẬP HỖN SỐ (No Mixed Numbers) ⚠️
                </div>
                <p className="leading-relaxed">
                  • <b>Cực kỳ nguy hiểm:</b> Nếu bạn nhập hỗn số <code className="text-rose-300">2 1/7</code> hoặc <code className="text-rose-300">2 1/2</code>, hệ thống chấm Bluebook sẽ tự động hiểu là <code className="text-rose-200">21/7</code> (= 3) hoặc <code className="text-rose-200">21/2</code> (= 10.5) dẫn đến <b>BỊ CHẤM SAI HOÀN TOÀN!</b>
                  <br />
                  • <b>Cách xử lý:</b> Luôn đổi hỗn số thành <b>phân số tối giản</b> (<code className="text-emerald-300">15/7</code>) hoặc <b>số thập phân</b> (<code className="text-emerald-300">2.143</code>).
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5">
                <div className="mb-1 text-xs font-black uppercase text-amber-300">
                  3. Số thập phân vô hạn tuần hoàn (Repeating Decimals)
                </div>
                <p className="leading-relaxed">
                  • Nếu đáp án là số thập phân vô hạn tuần hoàn, bạn <b>BẮT BUỘC phải điền kín toàn bộ các ô ký tự</b> hoặc làm tròn chính xác ở ký tự cuối cùng.
                  <br />
                  • Ví dụ với <code className="text-amber-300">2/3</code>:
                  <br />
                  &nbsp;&nbsp;✓ <b>HỢP LỆ:</b> <code className="text-emerald-300">.666</code>, <code className="text-emerald-300">.667</code>, <code className="text-emerald-300">0.666</code>, <code className="text-emerald-300">0.667</code>.
                  <br />
                  &nbsp;&nbsp;✗ <b>SAI:</b> <code className="text-rose-300">.66</code> hoặc <code className="text-rose-300">0.66</code> hoặc <code className="text-rose-300">0.67</code> (vì còn chỗ trống nhưng không điền hết độ chính xác).
                </p>
              </div>

              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5">
                <div className="mb-1 text-xs font-black uppercase text-cyan-300">
                  4. Nhiều nghiệm & Lưu ý dấu
                </div>
                <p className="leading-relaxed">
                  • <b>Nhiều đáp án đúng:</b> Nếu phương trình có 2 nghiệm (hoặc khoảng nghiệm <code className="text-cyan-200">1 &lt; x &lt; 4</code>), bạn <b>chỉ cần điền 1 đáp án duy nhất</b> (ví dụ điền <code className="text-cyan-300">2</code> hoặc <code className="text-cyan-300">3.5</code>).
                  <br />
                  • <b>Ký hiệu cấm:</b> Không nhập dấu phẩy <code className="text-rose-300">,</code> (phải dùng dấu chấm <code className="text-emerald-300">.</code>), không gõ ký hiệu <code className="text-rose-300">%</code>, <code className="text-rose-300">$</code> hay đơn vị đo.
                  <br />
                  • <b>Số 0:</b> Chỉ điền là <code className="text-cyan-300">0</code>, không điền <code className="text-rose-300">-0</code>.
                </p>
              </div>

              {/* Interactive Tester Box */}
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-3.5">
                <div className="mb-2 text-xs font-bold text-slate-200">
                  🧪 Kiểm Tra Nhanh Đáp Án Của Bạn Theo Quy Chuẩn Bluebook:
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sprTestInput}
                    onChange={(e) => setSprTestInput(e.target.value)}
                    placeholder="Gõ thử đáp án: vd '15/7', '-2.35', '2 1/7'..."
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-white placeholder-slate-500 outline-hidden focus:border-purple-400"
                  />
                  <button
                    type="button"
                    onClick={() => setSprTestInput("")}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    Xóa
                  </button>
                </div>
                {sprTestInput && (
                  <div
                    className={`mt-2 rounded-lg p-2.5 text-xs font-medium ${sprValidation.type === "success"
                        ? "border border-emerald-500/40 bg-emerald-950/40 text-emerald-200"
                        : sprValidation.type === "error"
                          ? "border border-rose-500/40 bg-rose-950/40 text-rose-200"
                          : "border border-amber-500/40 bg-amber-950/40 text-amber-200"
                      }`}
                  >
                    {sprValidation.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. DESMOS GRAPHING CALCULATOR (Items 32, 33, 45, #039) */}
      {/* ==================================================================== */}
      {(showDesmos || hasOpenedDesmosRef.current) && (
        <div
          aria-hidden={!showDesmos}
          style={
            desmosSize === "normal" && desmosPos
              ? { left: `${desmosPos.x}px`, top: `${desmosPos.y}px`, bottom: "auto", right: "auto" }
              : undefined
          }
          className={`fixed z-50 ${showDesmos ? "flex" : "hidden pointer-events-none"} flex-col overflow-hidden bg-slate-950 shadow-2xl ${isDraggingDesmos ? "" : "transition-all duration-200"
            } ${desmosSize === "large"
              ? "inset-3 md:inset-6 rounded-2xl border-2 border-cyan-500/70"
              : desmosSize === "split"
                ? "top-0 right-0 bottom-0 w-full sm:w-[50vw] h-full rounded-none border-l-2 border-cyan-500/70"
                : desmosPos
                  ? "h-[490px] w-[95vw] max-w-[560px] md:h-[540px] rounded-2xl border-2 border-cyan-500/70"
                  : "bottom-4 right-4 h-[490px] w-[95vw] max-w-[560px] md:h-[540px] rounded-2xl border-2 border-cyan-500/70"
            }`}
        >
          {/* Desmos Window Header */}
          <div
            onMouseDown={handleDesmosDragStart}
            className={`flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2 gap-2 ${desmosSize === "normal" ? "cursor-move select-none" : ""
              }`}
            title={desmosSize === "normal" ? "Kéo thả thanh tiêu đề để di chuyển máy tính" : undefined}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🧮</span>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                  Desmos Graphing Calculator
                </span>
                <span className="hidden sm:inline-block ml-2 rounded bg-cyan-950 px-1.5 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-800">
                  Bluebook Mode
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5">
              {/* Toggle 10 Tricks Button (Items 32 & 33) */}
              <button
                type="button"
                onClick={() => setShowDesmosCheats((v) => !v)}
                className={`rounded border px-2 py-1 text-[11px] font-bold transition ${showDesmosCheats
                    ? "border-amber-400 bg-amber-500/25 text-amber-200"
                    : "border-slate-700 bg-slate-800 text-amber-300 hover:bg-slate-700"
                  }`}
                title="Bật/Tắt 10 tuyệt chiêu bấm Desmos thực chiến 1-Click Copy"
              >
                🔥 10 Mẹo Desmos
              </button>

              {/* Size mode switchers (Item 45) */}
              <div className="flex items-center rounded border border-slate-700 bg-slate-800/80 p-0.5 text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => handleSetDesmosSize("normal")}
                  className={`rounded px-1.5 py-0.5 transition ${desmosSize === "normal"
                      ? "bg-cyan-500 text-black font-bold"
                      : "text-slate-300 hover:text-white"
                    }`}
                  title="Kích thước vừa phải ở góc phải"
                >
                  Thu gọn
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDesmosSize("large")}
                  className={`rounded px-1.5 py-0.5 transition ${desmosSize === "large"
                      ? "bg-cyan-500 text-black font-bold"
                      : "text-slate-300 hover:text-white"
                    }`}
                  title="Phóng to gần toàn màn hình"
                >
                  Mở rộng
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDesmosSize("split")}
                  className={`rounded px-1.5 py-0.5 transition ${desmosSize === "split"
                      ? "bg-cyan-500 text-black font-bold"
                      : "text-slate-300 hover:text-white"
                    }`}
                  title="Chia đôi 50% màn hình bên phải"
                >
                  Chia đôi 50%
                </button>
              </div>

              {/* Retry / Reload Desmos Button (#062) */}
              <button
                type="button"
                onClick={retryLoadDesmos}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-bold text-cyan-300 hover:bg-slate-700 hover:text-white"
                title="Tải lại máy tính Desmos"
              >
                🔄 Tải lại
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowDesmos(false)}
                className="rounded border border-rose-500/40 bg-rose-500/20 px-2 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/30"
              >
                ✕ Đóng
              </button>
            </div>
          </div>

          {/* Collapsible 10 Tricks Drawer (Items 32 & 33) */}
          {showDesmosCheats && (
            <div className="border-b border-amber-500/30 bg-slate-900/95 p-3 max-h-56 overflow-y-auto">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-black uppercase text-amber-300">
                  🔥 10 Tuyệt Chiêu Bấm Desmos Thực Chiến (1-Click Copy Mẫu)
                </div>
                <span className="text-[10px] text-slate-400">
                  Click '📋 Copy mẫu' rồi dán (Ctrl+V) vào Desmos
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {DESMOS_TRICKS.map((trick) => (
                  <div
                    key={trick.id}
                    className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-200">{trick.title}</span>
                        <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] font-semibold text-cyan-400">
                          {trick.tag}
                        </span>
                      </div>
                      <div className="mb-1 rounded bg-slate-900 px-2 py-1 font-mono text-[11px] text-amber-300 whitespace-pre-line">
                        {trick.code}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">{trick.desc}</p>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopyTrick(trick)}
                        className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${copiedTrickId === trick.id
                            ? "bg-emerald-500 text-black"
                            : "border border-amber-500/40 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                          }`}
                      >
                        {copiedTrickId === trick.id ? "✓ Đã copy! Dán Ctrl+V" : "📋 Copy mẫu"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Iframe or Error fallback (#062) */}
          <div className="relative flex-1 bg-white">
            {desmosError ? (
              <div className="flex h-full w-full flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-200">
                <div className="mb-3 text-4xl">⚠️</div>
                <h4 className="text-sm font-bold text-rose-400">Không thể tải máy tính Desmos</h4>
                <p className="mt-1 text-xs text-slate-400 max-w-sm">
                  Đã xảy ra lỗi kết nối mạng hoặc không thể tải từ máy chủ Desmos CDN. Vui lòng kiểm tra lại đường truyền internet.
                </p>
                <button
                  type="button"
                  onClick={retryLoadDesmos}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-cyan-500 transition"
                >
                  <span>🔄</span> Thử tải lại (Retry)
                </button>
              </div>
            ) : (
              <iframe
                key={desmosRetryKey}
                src="https://www.desmos.com/calculator"
                title="Desmos Graphing Calculator"
                className="h-full w-full border-0"
                allow="clipboard-write"
                onError={() => setDesmosError(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. MULTI-TAB SAT REFERENCE MODAL (Items 17, 31, 35, 40, 43, 44) */}
      {/* ==================================================================== */}
      {showReference && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-xs">
          <div
            style={
              refPos
                ? {
                  position: "fixed",
                  left: `${refPos.x}px`,
                  top: `${refPos.y}px`,
                  margin: 0,
                }
                : undefined
            }
            className={`flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-slate-950 text-slate-100 shadow-2xl ${isDraggingRef ? "" : "transition-all duration-200"
              }`}
          >
            {/* Modal Header */}
            <div
              onMouseDown={handleRefDragStart}
              className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 gap-2 cursor-move select-none"
              title="Kéo thả thanh tiêu đề để di chuyển bảng tham khảo"
            >
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                  Digital SAT Prep Master Toolkit
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  📐 Bảng Tham Khảo Đa Năng Chuẩn SAT
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReference(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
              >
                ✕ Đóng
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-slate-800 bg-slate-900/60 px-3 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveRefTab("bluebook")}
                className={`border-b-2 px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition ${activeRefTab === "bluebook"
                    ? "border-amber-400 text-amber-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
              >
                📐 Chuẩn Bluebook
              </button>
              <button
                type="button"
                onClick={() => setActiveRefTab("must_know")}
                className={`border-b-2 px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition ${activeRefTab === "must_know"
                    ? "border-rose-400 text-rose-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
              >
                🔥 Phải Thuộc Lòng
              </button>
              <button
                type="button"
                onClick={() => setActiveRefTab("dictionary")}
                className={`border-b-2 px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition ${activeRefTab === "dictionary"
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
              >
                🇬🇧 Từ Điển Toán Anh-Việt ({MATH_VOCABULARY.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveRefTab("rw_stats")}
                className={`border-b-2 px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition ${activeRefTab === "rw_stats"
                    ? "border-purple-400 text-purple-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
              >
                ✍️ Dấu Câu R&W & Thống Kê
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* TAB 1: CHUẨN BLUEBOOK (Full Official Diagrams & Formulas) */}
              {activeRefTab === "bluebook" && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
                    💡 <b>Tờ Reference chính thức của College Board:</b> Được cung cấp sẵn trong phần thi Math của Bluebook.
                  </div>

                  {/* Geometric Shapes Grid with Clean SVGs */}
                  <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3">
                    {/* Circle */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-300">Hình tròn (Circle)</span>
                        <svg className="w-10 h-10 text-amber-400" viewBox="0 0 40 40" fill="none">
                          <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                          <line x1="20" y1="20" x2="36" y2="20" stroke="currentColor" strokeWidth="1.5" />
                          <circle cx="20" cy="20" r="1.5" fill="currentColor" />
                          <text x="26" y="16" fill="currentColor" fontSize="8" fontFamily="sans-serif">r</text>
                        </svg>
                      </div>
                      <div className="space-y-1 font-mono text-xs text-slate-200">
                        <div>A = πr²</div>
                        <div>C = 2πr</div>
                      </div>
                    </div>

                    {/* Rectangle */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-300">Hình chữ nhật (Rectangle)</span>
                        <svg className="w-12 h-8 text-amber-400" viewBox="0 0 48 32" fill="none">
                          <rect x="2" y="2" width="44" height="28" stroke="currentColor" strokeWidth="1.5" />
                          <text x="22" y="18" fill="currentColor" fontSize="8" fontFamily="sans-serif">l</text>
                          <text x="36" y="18" fill="currentColor" fontSize="8" fontFamily="sans-serif">w</text>
                        </svg>
                      </div>
                      <div className="space-y-1 font-mono text-xs text-slate-200">
                        <div>A = lw</div>
                      </div>
                    </div>

                    {/* Triangle */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-300">Tam giác (Triangle)</span>
                        <svg className="w-12 h-10 text-amber-400" viewBox="0 0 48 40" fill="none">
                          <polygon points="4,36 44,36 28,6" stroke="currentColor" strokeWidth="1.5" />
                          <line x1="28" y1="6" x2="28" y2="36" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                          <text x="22" y="24" fill="currentColor" fontSize="8" fontFamily="sans-serif">h</text>
                          <text x="18" y="34" fill="currentColor" fontSize="8" fontFamily="sans-serif">b</text>
                        </svg>
                      </div>
                      <div className="space-y-1 font-mono text-xs text-slate-200">
                        <div>A = ½bh</div>
                      </div>
                    </div>

                    {/* Pythagorean Theorem */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-300">Định lý Pytago</span>
                        <svg className="w-12 h-10 text-amber-400" viewBox="0 0 48 40" fill="none">
                          <polygon points="6,34 42,34 6,6" stroke="currentColor" strokeWidth="1.5" />
                          <rect x="6" y="28" width="6" height="6" stroke="currentColor" strokeWidth="1" />
                          <text x="2" y="22" fill="currentColor" fontSize="8" fontFamily="sans-serif">a</text>
                          <text x="24" y="38" fill="currentColor" fontSize="8" fontFamily="sans-serif">b</text>
                          <text x="26" y="18" fill="currentColor" fontSize="8" fontFamily="sans-serif">c</text>
                        </svg>
                      </div>
                      <div className="space-y-1 font-mono text-xs text-slate-200">
                        <div>c² = a² + b²</div>
                      </div>
                    </div>

                    {/* Special Triangle: 30-60-90 */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-cyan-300">Tam giác 30° - 60° - 90°</span>
                        <span className="text-[10px] text-slate-400">Tỉ lệ cạnh:</span>
                      </div>
                      <div className="rounded bg-slate-950 p-2 font-mono text-xs text-cyan-200">
                        x : x√3 : 2x
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-400 leading-tight">
                        Cạnh đối góc 30° là <code className="text-amber-300">x</code>, cạnh đối góc 60° là <code className="text-amber-300">x√3</code>, cạnh huyền là <code className="text-amber-300">2x</code>.
                      </p>
                    </div>

                    {/* Special Triangle: 45-45-90 */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-cyan-300">Tam giác 45° - 45° - 90°</span>
                        <span className="text-[10px] text-slate-400">Tỉ lệ cạnh:</span>
                      </div>
                      <div className="rounded bg-slate-950 p-2 font-mono text-xs text-cyan-200">
                        s : s : s√2
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-400 leading-tight">
                        Hai cạnh góc vuông bằng nhau là <code className="text-amber-300">s</code>, cạnh huyền là <code className="text-amber-300">s√2</code>.
                      </p>
                    </div>

                    {/* Rectangular Prism */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="text-xs font-bold text-amber-300 mb-1">Hình hộp chữ nhật</div>
                      <div className="font-mono text-xs text-slate-200">V = lwh</div>
                    </div>

                    {/* Cylinder */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="text-xs font-bold text-amber-300 mb-1">Hình trụ tròn (Cylinder)</div>
                      <div className="font-mono text-xs text-slate-200">V = πr²h</div>
                    </div>

                    {/* Sphere */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="text-xs font-bold text-amber-300 mb-1">Hình cầu (Sphere)</div>
                      <div className="font-mono text-xs text-slate-200">V = (4/3)πr³</div>
                    </div>

                    {/* Cone */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="text-xs font-bold text-amber-300 mb-1">Hình nón (Cone)</div>
                      <div className="font-mono text-xs text-slate-200">V = (1/3)πr²h</div>
                    </div>

                    {/* Pyramid */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="text-xs font-bold text-amber-300 mb-1">Hình chóp đáy CN (Pyramid)</div>
                      <div className="font-mono text-xs text-slate-200">V = (1/3)lwh</div>
                    </div>

                    {/* Circle & Triangle Core Laws */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="text-xs font-bold text-emerald-300 mb-1">3 Quy Luật Cốt Lõi</div>
                      <ul className="space-y-0.5 text-[11px] text-slate-300">
                        <li>• Đường tròn: <b>360°</b> = <b>2π radians</b></li>
                        <li>• Tổng 3 góc tam giác: <b>180°</b></li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PHẢI THUỘC LÒNG (Items 35, 43, 44) */}
              {activeRefTab === "must_know" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200">
                    🔥 <b>CÔNG THỨC KHÔNG CÓ TRONG TỜ REFERENCE NHƯNG RA THI 100%:</b> Bạn bắt buộc phải thuộc lòng để lấy điểm 700+ Math.
                  </div>

                  <div className="grid gap-3.5 sm:grid-cols-2">
                    {/* Parabola & Vertex */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
                      <div className="mb-2 text-xs font-black uppercase text-amber-300">
                        1. Đỉnh Parabol & Các Dạng Hàm Bậc Hai
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        <li>
                          • <b>Hoành độ đỉnh:</b> <code className="text-amber-300 font-bold">x = -b / (2a)</code>
                        </li>
                        <li>
                          • <b>Dạng đỉnh (Vertex Form):</b> <code className="text-amber-300">y = a(x - h)² + k</code>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            → Đỉnh là (h, k). Nếu a &gt; 0: cực tiểu k; nếu a &lt; 0: cực đại k.
                          </div>
                        </li>
                        <li>
                          • <b>Dạng nghiệm (Factored Form):</b> <code className="text-amber-300">y = a(x - x1)(x - x2)</code>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            → Hoành độ đỉnh nằm chính giữa: h = (x1 + x2) / 2.
                          </div>
                        </li>
                      </ul>
                    </div>

                    {/* Vieta & Delta */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
                      <div className="mb-2 text-xs font-black uppercase text-amber-300">
                        2. Định Lý Vi-ét & Biệt Thức Delta
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        <li>
                          • <b>Tổng nghiệm:</b> <code className="text-amber-300 font-bold">x1 + x2 = -b / a</code>
                        </li>
                        <li>
                          • <b>Tích nghiệm:</b> <code className="text-amber-300 font-bold">x1 · x2 = c / a</code>
                        </li>
                        <li>
                          • <b>Biệt thức Δ:</b> <code className="text-amber-300 font-bold">Δ = b² - 4ac</code>
                          <div className="text-[11px] text-slate-400 mt-0.5 space-y-0.5">
                            <div>• Δ &gt; 0: 2 nghiệm thực phân biệt (cắt Ox tại 2 điểm).</div>
                            <div>• Δ = 0: 1 nghiệm kép (tiếp xúc Ox / 1 giao điểm).</div>
                            <div>• Δ &lt; 0: Vô nghiệm thực (không chạm trục Ox).</div>
                          </div>
                        </li>
                      </ul>
                    </div>

                    {/* System of Linear Equations (Item 43) */}
                    <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5 sm:col-span-2">
                      <div className="mb-2 text-xs font-black uppercase text-cyan-300">
                        3. Biện Luận Số Nghiệm Hệ Phương Trình Tuyến Tính (Item 43)
                      </div>
                      <div className="text-xs text-slate-300 mb-2">
                        Cho hệ: <code className="text-cyan-200">a1·x + b1·y = c1</code> và <code className="text-cyan-200">a2·x + b2·y = c2</code>:
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3 text-xs">
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
                          <div className="font-bold text-rose-300 mb-1">Vô nghiệm (No solution)</div>
                          <div className="font-mono text-cyan-300 text-[11px] mb-1">a1/a2 = b1/b2 ≠ c1/c2</div>
                          <div className="text-[11px] text-slate-400">2 đường song song, không có giao điểm.</div>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
                          <div className="font-bold text-emerald-300 mb-1">Vô số nghiệm (Infinitely many)</div>
                          <div className="font-mono text-cyan-300 text-[11px] mb-1">a1/a2 = b1/b2 = c1/c2</div>
                          <div className="text-[11px] text-slate-400">2 đường trùng nhau, mọi điểm đều là nghiệm.</div>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
                          <div className="font-bold text-amber-300 mb-1">Đúng 1 nghiệm (One solution)</div>
                          <div className="font-mono text-cyan-300 text-[11px] mb-1">a1/a2 ≠ b1/b2</div>
                          <div className="text-[11px] text-slate-400">2 đường cắt nhau tại đúng 1 giao điểm.</div>
                        </div>
                      </div>
                    </div>

                    {/* Circle Equation & Completing the Square */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
                      <div className="mb-2 text-xs font-black uppercase text-amber-300">
                        4. Phương Trình Đường Tròn
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        <li>
                          • <b>Dạng chuẩn:</b> <code className="text-amber-300">(x - h)² + (y - k)² = r²</code>
                          <div className="text-[11px] text-slate-400 mt-0.5">Tâm I(h, k), bán kính r = √r².</div>
                        </li>
                        <li>
                          • <b>Mẹo hoàn thành bình phương nhanh:</b>
                          <div className="rounded bg-slate-950 p-2 mt-1 font-mono text-[11px] text-emerald-300">
                            x² + bx = (x + b/2)² - (b/2)²
                          </div>
                        </li>
                      </ul>
                    </div>

                    {/* Trigonometry & Complementary Angles (Item 44) */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
                      <div className="mb-2 text-xs font-black uppercase text-amber-300">
                        5. Lượng Giác & Góc Phụ Nhau (Item 44)
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        <li>
                          • <b>SOH - CAH - TOA:</b>
                          <div className="text-[11px] text-slate-300 mt-0.5 font-mono">
                            sin = Đối/Huyền | cos = Kề/Huyền | tan = Đối/Kề
                          </div>
                        </li>
                        <li>
                          • <b>Công thức vàng góc phụ nhau:</b>
                          <div className="rounded bg-slate-950 p-2 mt-1 font-mono text-[11px] text-rose-300">
                            sin(x°) = cos(90° - x°)
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Nếu A + B = 90° (hoặc π/2) thì sin(A) = cos(B).
                          </div>
                        </li>
                        <li>
                          • <b>Đồng nhất thức:</b> <code className="text-amber-300">sin²(x) + cos²(x) = 1</code>
                        </li>
                      </ul>
                    </div>

                    {/* Exponential & Compound Interest */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 sm:col-span-2">
                      <div className="mb-2 text-xs font-black uppercase text-amber-300">
                        6. Hàm Mũ, Lãi Suất Kép & Cung Tròn
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 text-xs text-slate-300">
                        <div>
                          • <b>Tăng / Giảm hàm mũ chu kỳ:</b>
                          <div className="font-mono text-amber-300 text-[11px] mt-0.5">y = P(1 ± r)^(t/k)</div>
                          <div className="text-[10px] text-slate-400">P: ban đầu, r: tỉ lệ %, k: thời gian chu kỳ.</div>
                        </div>
                        <div>
                          • <b>Độ dài cung & Diện tích quạt tròn:</b>
                          <div className="font-mono text-amber-300 text-[11px] mt-0.5">s = rθ &nbsp;|&nbsp; A = ½ r² θ</div>
                          <div className="text-[10px] text-slate-400">(θ BẮT BUỘC tính bằng radian)</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TỪ ĐIỂN TOÁN ANH - VIỆT (Item 31) */}
              {activeRefTab === "dictionary" && (
                <div className="space-y-4">
                  {/* Search & Category Filter */}
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={vocabSearch}
                        onChange={(e) => setVocabSearch(e.target.value)}
                        placeholder="Tìm thuật ngữ Toán Anh - Việt (vd: integer, slope, vertex, median)..."
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-slate-400 outline-hidden focus:border-cyan-400"
                      />
                      {vocabSearch && (
                        <button
                          type="button"
                          onClick={() => setVocabSearch("")}
                          className="absolute right-3 top-2 text-xs text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
                      {(
                        [
                          { id: "all", label: "Tất cả" },
                          { id: "arithmetic", label: "Số học" },
                          { id: "algebra", label: "Đại số" },
                          { id: "geometry", label: "Hình học" },
                          { id: "statistics", label: "Thống kê" },
                        ] as const
                      ).map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setVocabCategory(cat.id)}
                          className={`rounded-lg px-2.5 py-1.5 font-bold transition whitespace-nowrap ${vocabCategory === cat.id
                              ? "bg-cyan-500 text-black shadow-sm shadow-cyan-500/20"
                              : "border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                            }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-slate-400">
                    Hiển thị <b>{filteredVocab.length}</b> / {MATH_VOCABULARY.length} thuật ngữ Toán SAT
                  </div>

                  {/* Vocabulary Cards List */}
                  <div className="grid gap-2 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-1">
                    {filteredVocab.map((v, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs transition hover:border-cyan-500/40 hover:bg-slate-900"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-cyan-300">{v.term}</span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] uppercase font-bold text-slate-400">
                            {v.cat === "arithmetic"
                              ? "Số học"
                              : v.cat === "algebra"
                                ? "Đại số"
                                : v.cat === "geometry"
                                  ? "Hình học"
                                  : "Thống kê"}
                          </span>
                        </div>
                        <div className="text-slate-100 font-medium mb-1.5">{v.vi}</div>
                        <div className="rounded bg-slate-950/80 p-2 text-[11px] text-amber-200/90 leading-relaxed border border-slate-800/80">
                          ⚠️ <b>Lưu ý & Bẫy:</b> {v.trap}
                        </div>
                      </div>
                    ))}
                    {filteredVocab.length === 0 && (
                      <div className="col-span-2 py-8 text-center text-xs text-slate-400">
                        Không tìm thấy thuật ngữ nào khớp với từ khóa "{vocabSearch}".
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: MẸO DẤU CÂU R&W & THỐNG KÊ (Items 17, 40) */}
              {activeRefTab === "rw_stats" && (
                <div className="space-y-5">
                  {/* Part 1: Standard English Conventions (Item 17) */}
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-base">✍️</span>
                      <h4 className="text-sm font-black uppercase tracking-wider text-purple-300">
                        Phần 1: Bí Kíp Quy Tắc Dấu Câu R&W (Standard English Conventions - Item 17)
                      </h4>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 text-xs">
                      {/* Independent Clauses */}
                      <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5">
                        <div className="font-black text-purple-300 mb-1.5">
                          1. Ba Công Thức Nối Mệnh Đề Độc Lập (IC)
                        </div>
                        <p className="text-slate-300 leading-relaxed">
                          Ba cách sau là <b>hoàn toàn tương đương ngữ pháp 100%</b>:
                        </p>
                        <div className="space-y-1 font-mono text-purple-200 bg-slate-950 p-2 rounded-lg my-1.5 text-[11px]">
                          <div>• IC . IC (Dấu chấm)</div>
                          <div>• IC ; IC (Dấu chấm phẩy)</div>
                          <div>• IC , FANBOYS IC</div>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          (FANBOYS: For, And, Nor, But, Or, Yet, So). Nếu trong 4 đáp án có cả '.' và ';' ngăn giữa 2 IC thì thường gạch bỏ cả hai!
                        </p>
                      </div>

                      {/* Comma Splice */}
                      <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5">
                        <div className="font-black text-rose-300 mb-1.5">
                          2. Lỗi Comma Splice CẤM TUYỆT ĐỐI ⚠️
                        </div>
                        <div className="font-mono text-rose-200 bg-slate-950 p-2 rounded-lg my-1.5 text-[11px]">
                          ✗ IC , IC (SAI 100%)
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          Hai mệnh đề độc lập tuyệt đối không bao giờ được nối chỉ bằng một dấu phẩy đơn lẻ! Đáp án nào có dạng này gạch ngay lập tức.
                        </p>
                      </div>

                      {/* Colon Rules */}
                      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
                        <div className="font-black text-amber-300 mb-1.5">
                          3. Quy Tắc Dấu Hai Chấm ( : )
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          • Vế <b>TRƯỚC</b> dấu hai chấm <code className="text-amber-300">:</code> bắt buộc phải là một mệnh đề độc lập hoàn chỉnh (<code className="text-amber-300">IC</code>).
                          <br />
                          • Vế <b>SAU</b> dấu hai chấm dùng để giải thích chi tiết, liệt kê danh sách hoặc nhấn mạnh.
                          <br />
                          • <b>Bẫy SAT:</b> Không bao giờ đặt ':' ngay sau các từ như 'such as:', 'including:', 'is:'.
                        </p>
                      </div>

                      {/* Dashes & Non-essential clauses */}
                      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
                        <div className="font-black text-amber-300 mb-1.5">
                          4. Cặp Dấu Gạch Ngang ( — ... — ) & Phẩy ( , ... , )
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          • Dùng bọc thành phần phụ chú không bắt buộc (Non-essential clause).
                          <br />
                          • <b>Tính đồng nhất:</b> Đã mở bằng gạch ngang thì phải đóng bằng gạch ngang (<code className="text-amber-300">— ... —</code>); mở bằng phẩy thì đóng bằng phẩy (<code className="text-amber-300">, ... ,</code>). Cấm dùng lệch pha (<code className="text-rose-300">, ... —</code> là SAI)!
                        </p>
                      </div>

                      {/* Dangling Modifier */}
                      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
                        <div className="font-black text-cyan-300 mb-1.5">
                          5. Dangling Modifier (Mệnh Đề Phân Từ Lửng Lơ)
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          • Cụm <code className="text-cyan-200">V-ing / V-ed / Tính từ</code> đứng đầu câu sau dấu phẩy:
                          <br />
                          • <b>Quy tắc bất di bất dịch:</b> Danh từ đứng <b>ngay sau dấu phẩy</b> bắt buộc phải là <b>Chủ ngữ trực tiếp thực hiện hành động đó!</b>
                        </p>
                      </div>

                      {/* Apostrophes */}
                      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
                        <div className="font-black text-cyan-300 mb-1.5">
                          6. Sở Hữu Cách (Apostrophes) & Đại Từ
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          • <code className="text-cyan-200">its</code> = của nó (sở hữu, không phẩy) vs <code className="text-rose-300">it's</code> = it is.
                          <br />
                          • <code className="text-cyan-200">their</code> (của họ) vs <code className="text-rose-300">they're</code> = they are vs <code className="text-cyan-200">there</code> (ở đó).
                          <br />
                          • Số ít sở hữu: thêm <code className="text-cyan-200">'s</code> (vd: <code className="text-cyan-200">the student's book</code>).
                          <br />
                          • Số nhiều tận cùng 's': chỉ thêm dấu phẩy <code className="text-cyan-200">'</code> (vd: <code className="text-cyan-200">the students' books</code>).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Part 2: 3 Golden Rules of SAT Statistics (Item 40) */}
                  <div className="pt-2 border-t border-slate-800">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-base">📊</span>
                      <h4 className="text-sm font-black uppercase tracking-wider text-emerald-300">
                        Phần 2: 3 Quy Tắc Vàng Thống Kê SAT Không Cần Tính Toán (Item 40)
                      </h4>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 text-xs">
                      {/* Rule 1: SD */}
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
                        <div className="font-black text-emerald-300 mb-1">
                          1. Standard Deviation (Độ Lệch Chuẩn)
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          • Đo độ trải rộng / phân tán của dữ liệu quanh trung bình (mean).
                          <br />
                          • <b>Mẹo vàng:</b> Dữ liệu càng chụm sát mean → SD càng nhỏ.
                          <br />
                          • <b>Bẫy bất biến:</b> Cộng/trừ tất cả các số trong tập dữ liệu với cùng hằng số k thì <b>SD KHÔNG HỀ THAY ĐỔI</b>!
                        </p>
                      </div>

                      {/* Rule 2: Margin of Error */}
                      <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5">
                        <div className="font-black text-cyan-300 mb-1">
                          2. Margin of Error (Biên Độ Sai Số)
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          • Tỷ lệ nghịch với căn bậc hai cỡ mẫu:
                          <br />
                          <code className="text-cyan-200 font-bold">Sample size n ↑  ⇒  Margin of Error ↓</code>
                          <br />
                          • Tăng cỡ mẫu gấp 4 lần thì biên độ sai số giảm đi 1/2.
                          <br />
                          • Không phụ thuộc vào quy mô tổng thể quần thể.
                        </p>
                      </div>

                      {/* Rule 3: Survey Generalization & Causation */}
                      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5">
                        <div className="font-black text-amber-300 mb-1">
                          3. Suy Rộng Mẫu & Nhân Quả
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          • <b>Suy rộng kết luận:</b> Chỉ được suy rộng cho đúng <b>Target Population</b> mà mẫu được chọn ngẫu nhiên ra.
                          <br />
                          • <b>Quan hệ nhân quả (Causation):</b> CHỈ ĐƯỢC KẾT LUẬN khi có <b>Random Assignment</b> (phân bổ ngẫu nhiên vào nhóm thử nghiệm vs nhóm đối chứng). Quan sát thông thường chỉ là Tương quan (Correlation).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BluebookTools;
