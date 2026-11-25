# SỔ CÁI BỘ NHỚ NGOÀI BẤT TỬ V30 — SAT_WEB 2026
*Đường dẫn:* `F:\SAT_Web\PROJECT_STATE.md`  
*Trạng thái:* **ACTIVE — PERSISTENT MEMORY LEDGER (< 5 KB)** | *Cập nhật:* 2026-11-25  
*Dự án:* SAT_Web (Nền tảng Luyện thi Digital SAT Mô Phỏng Bluebook & Socratic AI)

---

## I. ĐỊNH DANH DỰ ÁN ĐỘC LẬP (SAT.GURU)
- **Thương hiệu độc lập:** **SAT.Guru / SAT Nghĩa Guru** — Nền tảng EdTech Luyện thi Digital SAT *(tách biệt hoàn toàn, không liên quan đến Nội thất Phú Gia / PG Home Luxury)*.
- **Phụ trách học thuật:** Thầy Nghĩa Guru (Nguyễn Viết Nghĩa).
- **Hotline / Zalo tư vấn học thuật:** **0986.722.324**.
- **Quy chế kỹ thuật áp dụng:** 10 Chốt Giám sát Sản phẩm Digital SAT (`#G1`–`#G10`).

---

## II. MỤC TIÊU CỐT LÕI
- Đào tạo & luyện thi Digital SAT điểm cao (1300–1550+) cho học sinh THPT Việt Nam xét tuyển ĐH Top đầu (FTU, NEU, HUST, VNU, VinUni, Fulbright) và săn học bổng du học Mỹ/Quốc tế.
- Phục vụ 3 tệp khách hàng trọng tâm: Học sinh THPT, Phụ huynh (VietQR/Zalo), Giáo viên & Trung tâm luyện thi (B2B2C).

---

## III. HIỆN TRẠNG KỸ THUẬT & NGHIỆM THU TRÊN ĐĨA CỨNG
- **Kiến trúc:** Next.js 16.2.9 (App Router, Webpack build), React 19.2.4, TypeScript, Tailwind CSS v4, Supabase SSR, Lucide Icons, KaTeX Math.
- **Quy mô ứng dụng:** `126 / 126` Routes & Static/ISR Pages hoàn chỉnh (`ƒ Proxy Middleware`), bao gồm Hub SEO `/uni-predict/[slug]` (7 ĐH Top VN), `/join`, `/api/og/diagnostic`, `/api/subscription/freeze`, `/api/referral/claim`, `/api/analytics/traps`, `/api/questions/report`, `/api/activity/verified`, `/api/b2b/trial`, `/api/admin/benchmarks`, `/api/cron/abandoned-checkout`.
- **Ngân hàng đề thi Digital SAT (`src/data/mock_exams.json` + pool Supabase):** 15/15 bộ đề chuẩn Bluebook (537 câu hỏi song ngữ `explanation_vi`, 4 module RW1/RW2/MATH1/MATH2, IRT 2PL `(a, b)`, cơ chế `mergeSupabaseQuestionPool` hướng tới 98 câu không trùng).
- **Tính năng cốt lõi đã kiểm chứng (hoàn tất Đợt 17 — Wave 0 đến Wave 3):**
  - Phòng thi mô phỏng Bluebook chuẩn quốc tế (Split-Pane `50/50`), Desmos `?embed` + nạp 1-chạm + kéo thả Pointer Events trên iPad, kiểm lỗi SPR realtime, Scratchpad theo câu + Mark for Review.
  - Gợi ý Socratic 3 tầng (`/api/hint`, không lộ đáp án) + AI Router dự phòng + Bẫy từ vựng Toán SAT + Tiêm từ vựng Leitner Box 1 + Blind Revenge xáo trộn đáp án.
  - 100% thanh toán PayOS động (Standard, Sprint Packs, Study Squad, Parent Sponsor 1-chạm qua `parentShareCode`, Native SVG QR đếm ngược 15 phút, 0 STK tĩnh giả), Bảo lưu VIP 7–14 ngày, Cam kết đầu ra Score Assurance, B2B Dùng thử 14 ngày & Lớp học thật Supabase.
- **Chỉ số kiểm định Zero-Trust (25/11/2026 — Hậu kiểm 5/5 cổng):**
  - Cổng nghiệm thu `pg_gate.py`: **`PASS` (`0 defects` / `393` files)**.
  - TypeScript (`npx tsc --noEmit`): **`0 errors`**.
  - Kiểm thử tích hợp (`npm test`): **`816 / 816 PASS`** (`25` suites, `0 fail`).
  - ESLint (`npm run lint`): **`0 errors`** (`306` warnings).
  - Production Build (`npm run build:webpack`): **`Exit 0` (`126 / 126` routes + `ƒ Proxy`)**.

---

## IV. RÀNG BUỘC KỸ THUẬT BẤT KHẢ XÂM PHẠM
1. **Zero-UI-Regression:** Bất khả xâm phạm bố cục Split-Pane 50/50 Bluebook. Component mới phải Additive-Only, bọc `ErrorBoundary`.
2. **KaTeX & Data Integrity:** Giữ nguyên cú pháp KaTeX, không lộ `correctIndex`/`correctAnswer` ra client trước khi submit.
3. **Security Fail-Closed:** Khóa cứng `403` khi thiếu quyền admin, tuyệt đối không lộ `SUPABASE_SERVICE_ROLE_KEY` ra frontend.
4. **V30 Fast-Path:** Tác vụ nhỏ (<= 3 files) Tổng Chỉ Huy sửa trực tiếp trong 1-5 bước (< 30s).

---

## V. VIỆC CẦN LÀM TIẾP THEO
1. Chạy migration `supabase/migrations/20261125_wave14_growth_b2b_and_ops.sql` trên Supabase Production và đẩy nhánh lên `github-live` để triển khai Vercel.
2. Duy trì ổn định `126` routes và kiểm tra build định kỳ.
3. Mở rộng ngân hàng đề thi độc bản tiến tới `98` câu/đề khi có đợt cập nhật định dạng Digital SAT mới từ College Board.
