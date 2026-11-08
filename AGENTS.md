<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# KỶ LUẬT TỔ CHỨC ĐỘI QUÂN SUB-AGENT & GIÁM SÁT CHÉO (5–10 CÔNG NHÂN + 1 GIÁM SÁT + 1 GIÁM SÁT TRƯỞNG)

- **Đánh giá tác vụ & Huy động tối đa Sub-Agent (`Model="flash"`)**: Tùy vào quy mô tác vụ, đánh giá và sử dụng đội quân Sub-Agent (`Model="flash"`) **càng nhiều càng tốt** chạy song song trong cùng 1 lượt (từ 1 cụm tiêu chuẩn đến nhiều cụm 15–55 Sub-Agent cho chiến dịch lớn). Nghiêm cấm làm tuần tự từng file hoặc chỉ gọi 1–2 công nhân.
- **Biên chế Chuẩn cho Mỗi Cụm Tác Vụ (5–10 Công Nhân + 1 Giám Sát + 1 Giám Sát Trưởng)**:
  1. **`5 – 10` Công Nhân Thực Thi (`Worker Sub-Agents`, `Model="flash"`)**: Khoanh vùng độc lập (`1 Công nhân = 1 File/Thư mục riêng`), cấm tuyệt đối 2 công nhân chạm chung 1 file.
  2. **`01` Giám Sát Viên Cụm (`Squad Supervisor`, `TypeName="research"`, `Model="flash"`)**: Kiểm tra trực tiếp kết quả thực tế trên ổ cứng của 5–10 công nhân trong cụm.
  3. **`01` Giám Sát Trưởng (`Chief Supervisor`, `TypeName="research"`, `Model="flash"`)**: Giám sát chéo lại kết quả của Giám Sát Viên và toàn bộ 5–10 Công Nhân, đảm bảo 0% báo cáo láo trước khi trình Tổng Chỉ Huy.
- **Cơ chế Giám Sát Chéo Lẫn Nhau (`Mutual Cross-Supervision`)**:
  - Công nhân kiểm tra chéo đầu ra liền kề (`W1 -> W2 -> ... -> Wn -> W1`); Giám sát viên kiểm tra công nhân; Giám sát trưởng kiểm toán độc lập cả Giám sát viên lẫn công nhân để tránh sai sót.
- **Cấm Tranh Chấp Tài Nguyên Sống & Dọn Dẹp Quân (`Auto-Reap`)**:
  - Không cho 2 công nhân cùng ghi chung 1 DB SQLite, không cùng chạy build/chiếm cổng server, tuyệt đối không làm nháy cửa sổ Chrome/Zalo của Bố.
  - Xong mỗi đợt (Wave), dùng ngay `manage_subagents(Action="kill")` hoặc `Action="kill_all"` để thu hồi công nhân cũ.
