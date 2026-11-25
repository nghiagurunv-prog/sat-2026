# SOP ĐẶC THÙ DỰ ÁN (DELTA V36.4) — `f:\SAT_Web`
> **Kế thừa Toàn cục**: Áp dụng 100% **6 Kỷ luật Thép Phú Gia V36.4** từ `C:\Users\Admin\.gemini\GEMINI.md`.
> **Cổng Nghiệm thu 1 Chạm (`Exit=0`)**: `python "d:\Cài đặt các phần mềm\pg_gate.py" "f:\SAT_Web"`

---

## 0. FAST-PATH TÁC VỤ NHỎ & KIỂM ĐỊNH SIÊU TỐC (`<= 2 BƯỚC | < 15 GIÂY`)
- **Tra cứu / sửa nhanh (`<= 3 files`)**: Chỉ huy làm trực tiếp tại `f:\SAT_Web` (`0` Sub-Agent); nối lệnh PowerShell 5.1 bằng `;` thay vì `&&`.
- **Kiểm tra nhanh khi sửa cục bộ**: Chạy test tích hợp mục tiêu `< 1.5s` (`node --import ./src/test-int/loader-register.mjs --test <file-test>`) hoặc `python "d:\Cài đặt các phần mềm\pg_gate.py" "f:\SAT_Web" --fast`. Chốt phiên chạy `npx tsc --noEmit` (`0 errors`).

---

## 1. 10 CHỐT KỸ THUẬT DIGITAL SAT (`#G1` – `#G10`)
1. **`#G1` Persona (`PIS >= 4.0`)**: Học sinh THPT Việt Nam (SAT 1300–1550+), Phụ huynh (VietQR/Zalo, ROI), Giáo viên/Trung tâm.
2. **`#G2` Zero-UI-Regression**: Bảo toàn Split-Pane `50/50` Bluebook; thiết kế Additive-Only (prop optional + `ErrorBoundary`).
3. **`#G3` Topological Wave (`>= 4 files`)**: Wave A (DB/Lib) $\rightarrow$ Wave B (API) $\rightarrow$ Wave C (Context/Component) $\rightarrow$ Wave D (Page/UI) với `pg-worker` (`Model="flash"`).
4. **`#G4` Re-Entrant Queue Safety**: Dùng `AsyncLocalStorage` cho hàng đợi mastery chống deadlock.
5. **`#G5` & `#G6` Security Fail-Closed (`403`)**: Kiểm tra `x-admin-secret` trước khi tăng rate-limit; cấm lộ `SUPABASE_SERVICE_ROLE_KEY` ra client.
6. **`#G7` Content & KaTeX Integrity**: Đủ `explanation_vi` song ngữ, KaTeX `throwOnError: false`, cấm lộ `correctIndex`/`correctAnswer` trước khi submit.
7. **`#G8`–`#G10` Domain, Webhook & Cache**: `isActive` thuần khiết (`gracePeriodMs = 0`), Webhook PayOS/Stripe idempotent trả HTTP `200`, ưu tiên Static Hints + `ai_response_cache` trước khi gọi LLM.
