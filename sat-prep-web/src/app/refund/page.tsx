import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Chính sách thanh toán & hoàn tiền',
  description: 'Quy định rõ ràng về thanh toán payOS/Stripe, thời hạn kích hoạt và chính sách hoàn tiền tại SAT.Guru.',
};

export default function RefundPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6 text-slate-200 pb-20">
      <div className="space-y-2 border-b border-slate-800 pb-5">
        <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Minh bạch tài chính</span>
        <h1 className="text-2xl md:text-3xl font-black text-white">Chính Sách Thanh Toán & Hoàn Tiền — SAT.Guru</h1>
        <p className="text-xs text-slate-400">Cập nhật lần cuối: 22/11/2026 • Áp dụng cho mọi giao dịch payOS VietQR & Stripe</p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-white">1. Phương thức thanh toán & Thời gian kích hoạt</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
          <li><strong>Chuyển khoản QR tự động (payOS / VietQR)</strong>: Hệ thống tạo mã đơn hàng duy nhất và tự động kích hoạt gói học trong vòng 10–60 giây sau khi ngân hàng ghi có.</li>
          <li><strong>Thẻ quốc tế (Stripe — Visa/MasterCard)</strong>: Thanh toán trực tuyến an toàn bằng VNĐ, tự động kích hoạt ngay sau khi cổng xác nhận.</li>
          <li><strong>Thời gian ân hạn (Grace Period)</strong>: Khi gói đến hạn, hệ thống giữ thêm 12 giờ ân hạn để học sinh không bị gián đoạn giữa bài thi thử.</li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-white">2. Điều kiện hoàn tiền (100% trong 07 ngày)</h2>
        <p>Phụ huynh và Học sinh được hoàn tiền 100% trong vòng <strong>07 ngày</strong> kể từ thời điểm thanh toán nếu thuộc một trong các trường hợp sau:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
          <li>Giao dịch bị trừ tiền hai lần do lỗi đường truyền hoặc ngân hàng.</li>
          <li>Lỗi kỹ thuật nghiêm trọng từ hệ thống SAT.Guru khiến học sinh không thể sử dụng tính năng đã mua và đội ngũ kỹ thuật không khắc phục được trong 48 giờ.</li>
          <li>Học sinh chưa sử dụng quá 20% dung lượng bài thi thử / câu hỏi trả phí và có nhu cầu dừng dịch vụ trong 07 ngày đầu.</li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-white">3. Quy trình yêu cầu & Thời gian nhận lại tiền</h2>
        <p>
          Vui lòng gửi mã đơn hàng (Order ID) và email đăng nhập qua Hotline/Zalo{' '}
          <strong className="text-amber-300">0986.722.324</strong>. Sau khi xác minh, SAT.Guru thực hiện hoàn tiền về đúng tài khoản ngân hàng hoặc thẻ đã thanh toán trong vòng <strong>03–05 ngày làm việc</strong>, đồng thời thu hồi quyền truy cập gói trả phí tương ứng.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed rounded-2xl bg-indigo-950/30 border border-indigo-500/30 p-5">
        <h2 className="text-lg font-bold text-amber-300">4. Chính Sách Bảo Lãnh Tiến Bộ Điểm Số (Score Assurance)</h2>
        <p className="text-slate-300">
          Để phụ huynh an tâm tuyệt đối khi đầu tư luyện thi online cho con, SAT.Guru công khai minh bạch 03 tiêu chí đo lường tự động trong hệ thống:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
          <li>Hoàn thành tối thiểu <strong>80% Cây Kỹ Năng (Skill Tree)</strong> và sổ lỗi sai Leitner đến hạn.</li>
          <li>Duy trì chuỗi ngày học đều tối thiểu <strong>45 ngày</strong> trong chu kỳ gói (có hỗ trợ <strong>Bảo lưu 7–14 ngày</strong> mùa thi học kỳ THPT).</li>
          <li>Hoàn thành đủ tối thiểu <strong>04 đề thi thử Full-length Bluebook Adaptive</strong> trên hệ thống.</li>
        </ul>
        <p className="text-emerald-300 font-semibold">
          Cam kết: Nếu học viên đáp ứng đủ 3 tiêu chí trên mà điểm thi thật College Board tăng dưới +100 điểm so với bài Diagnostic đầu vào, SAT.Guru gia hạn miễn phí 60 ngày gói tương đương hoặc hoàn 100% học phí theo nguyện vọng gia đình.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed rounded-2xl bg-emerald-950/30 border border-emerald-500/30 p-5">
        <h2 className="text-lg font-bold text-emerald-300">4. Chính sách Bảo Lãnh Tiến Bộ Điểm Số (Score Assurance — W2 #28)</h2>
        <p className="text-slate-300">
          Để Phụ huynh hoàn toàn yên tâm khi đầu tư học trực tuyến, SAT.Guru công khai tiêu chí bảo lãnh tiến bộ điểm số hoàn toàn minh bạch:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
          <li><strong>Hoàn thành lộ trình:</strong> Đạt tối thiểu <strong>≥ 80% Cây Kỹ Năng (Skill Tree)</strong> và hoàn thành <strong>≥ 4 đề thi thử Full-length Adaptive Bluebook</strong>.</li>
          <li><strong>Tính kỷ luật:</strong> Duy trì chuỗi học đều tối thiểu <strong>45 ngày (Streak ≥ 45)</strong> trong thời gian sử dụng gói.</li>
          <li><strong>Quyền lợi bảo lãnh:</strong> Nếu điểm thi thật College Board tăng dưới <strong>+100 điểm</strong> so với điểm Diagnostic đầu vào, Phụ huynh được chọn <strong>gia hạn miễn phí 60 ngày</strong> gói tương đương hoặc <strong>hoàn 100% học phí</strong>.</li>
        </ul>
      </section>

      <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-4 text-xs text-slate-400">
        <Link href="/terms" className="hover:text-white underline">Điều khoản sử dụng</Link>
        <Link href="/privacy" className="hover:text-white underline">Chính sách Bảo mật</Link>
        <Link href="/contact" className="hover:text-white underline">Liên hệ CSKH</Link>
      </div>
    </div>
  );
}
