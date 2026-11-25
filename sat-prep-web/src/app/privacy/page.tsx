import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật dữ liệu cá nhân',
  description: 'Chính sách thu thập, lưu trữ và bảo vệ dữ liệu cá nhân người dùng SAT.Guru tuân thủ Nghị định 13/2023/NĐ-CP.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6 text-slate-200 pb-20">
      <div className="space-y-2 border-b border-slate-800 pb-5">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Nghị định 13/2023/NĐ-CP</span>
        <h1 className="text-2xl md:text-3xl font-black text-white">Chính Sách Bảo Mật Dữ Liệu Cá Nhân — SAT.Guru</h1>
        <p className="text-xs text-slate-400">Cập nhật lần cuối: 22/11/2026 • Cam kết bảo vệ dữ liệu học sinh & phụ huynh</p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-white">1. Dữ liệu chúng tôi thu thập</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
          <li><strong>Thông tin tài khoản</strong>: Email đăng nhập, tên hiển thị, trường học (tùy chọn), mục tiêu điểm SAT.</li>
          <li><strong>Dữ liệu học tập</strong>: Lịch sử làm bài, độ thành thạo từng kỹ năng (Mastery), sổ tay câu sai, tiến độ từ vựng SRS.</li>
          <li><strong>Thông tin giao dịch</strong>: Mã đơn hàng, gói dịch vụ, thời điểm xác nhận từ cổng thanh toán. <strong>SAT.Guru KHÔNG lưu trữ số thẻ ngân hàng hay mã CVV/mật khẩu ngân hàng của người dùng.</strong></li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-white">2. Mục đích xử lý dữ liệu</h2>
        <p>
          Dữ liệu chỉ được dùng để cá nhân hóa lộ trình luyện thi SAT thích ứng, chấm điểm, đồng bộ tiến độ giữa các thiết bị, cung cấp báo cáo tiến độ cho Phụ huynh khi học sinh chủ động tạo mã chia sẻ, và hỗ trợ đối soát giao dịch thanh toán. Chúng tôi tuyệt đối <strong>không bán hoặc chia sẻ dữ liệu cá nhân</strong> cho bên thứ ba phục vụ quảng cáo.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-white">3. Biện pháp bảo vệ & Lưu trữ an toàn</h2>
        <p>
          Mọi kết nối đều mã hóa HTTPS/TLS (HSTS). Cơ sở dữ liệu Supabase áp dụng phân quyền cấp dòng (Row-Level Security) đảm bảo mỗi học sinh chỉ truy cập được dữ liệu học tập của chính mình. Các câu hỏi gửi tới mô hình AI được lọc bỏ thông tin định danh cá nhân trước khi xử lý.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-white">4. Quyền của chủ thể dữ liệu</h2>
        <p>
          Học sinh và Phụ huynh có quyền yêu cầu tra cứu, chỉnh sửa hoặc xóa toàn bộ tài khoản và dữ liệu học tập bất cứ lúc nào bằng cách liên hệ Hotline/Zalo{' '}
          <strong className="text-amber-300">0986.722.324</strong>. Yêu cầu xóa dữ liệu được xử lý trong vòng 07 ngày làm việc.
        </p>
      </section>

      <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-4 text-xs text-slate-400">
        <Link href="/terms" className="hover:text-white underline">Điều khoản sử dụng</Link>
        <Link href="/refund" className="hover:text-white underline">Chính sách Hoàn tiền</Link>
        <Link href="/contact" className="hover:text-white underline">Liên hệ hỗ trợ</Link>
      </div>
    </div>
  );
}
