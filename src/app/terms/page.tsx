import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng dịch vụ',
  description: 'Điều khoản sử dụng nền tảng luyện thi Digital SAT AI SAT.Guru dành cho học sinh, phụ huynh và giáo viên.',
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6 text-slate-200 pb-20">
      <div className="space-y-2 border-b border-slate-800 pb-5">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Pháp lý & Minh bạch</span>
        <h1 className="text-2xl md:text-3xl font-black text-white">Điều Khoản Sử Dụng Dịch Vụ — SAT.Guru</h1>
        <p className="text-xs text-slate-400">Cập nhật lần cuối: 22/11/2026 • Áp dụng cho toàn bộ người dùng nền tảng SAT.Guru</p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-white">1. Giới thiệu dịch vụ & Phạm vi áp dụng</h2>
        <p>
          <strong>SAT.Guru</strong> (Học viện Luyện thi Digital SAT — Cố vấn học thuật: <strong>Thầy Nghĩa Guru</strong>) cung cấp nền tảng học tập và luyện thi trực tuyến Digital SAT thích ứng, bao gồm ngân hàng câu hỏi, đề thi thử mô phỏng Bluebook, Gia sư AI Socratic và Cổng theo dõi tiến độ cho Phụ huynh/Giáo viên.
        </p>
        <p>
          SAT® là nhãn hiệu đã đăng ký thuộc sở hữu của College Board. SAT.Guru là nền tảng giáo dục độc lập hỗ trợ ôn luyện và không liên kết hay đại diện chính thức cho College Board.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-white">2. Tài khoản người dùng & Quy tắc sử dụng công bằng</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
          <li>Mỗi tài khoản chỉ phục vụ cho 01 học sinh sử dụng cá nhân; nghiêm cấm chia sẻ tài khoản công khai hoặc dùng công cụ tự động (bot/crawler) thu thập kho đề hay rút cạn hạn mức Gia sư AI.</li>
          <li>Đối với gói <strong>Ultimate</strong>, hệ thống áp dụng chính sách sử dụng hợp lý (Fair-Use) cho mô hình AI suy luận chuyên sâu theo ngày; khi vượt ngưỡng, hệ thống tự động chuyển mượt sang mô hình AI tiêu chuẩn để học sinh tiếp tục học tập không gián đoạn.</li>
          <li>Học sinh dưới 16 tuổi cần có sự đồng ý và giám sát của Phụ huynh khi đăng ký gói trả phí.</li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-white">3. Gói cước, Thanh toán & Kích hoạt tự động</h2>
        <p>
          Giá các gói Premium và Ultimate được niêm yết công khai bằng Đồng Việt Nam (VNĐ) tại trang{' '}
          <Link href="/pricing" className="text-sky-400 underline">Bảng giá</Link> và{' '}
          <Link href="/upgrade" className="text-sky-400 underline">Nâng cấp</Link>. Mọi giao dịch được xử lý qua cổng thanh toán chính thức (payOS VietQR hoặc Stripe) và tự động kích hoạt sau khi cổng xác nhận thành công.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-white">4. Quyền sở hữu trí tuệ</h2>
        <p>
          Toàn bộ lời giải thích song ngữ tiếng Việt, hệ thống phân loại bẫy khảo thí, mã nguồn và tài liệu sư phạm trên SAT.Guru thuộc bản quyền của SAT.Guru. Nghiêm cấm sao chép, phân phối lại vì mục đích thương mại khi chưa có văn bản chấp thuận.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-white">5. Liên hệ giải quyết khiếu nại</h2>
        <p>
          Mọi thắc mắc về tài khoản, kỹ thuật hoặc thanh toán xin liên hệ trực tiếp Hotline/Zalo:{' '}
          <strong className="text-amber-300">0986.722.324</strong> hoặc xem trang{' '}
          <Link href="/contact" className="text-sky-400 underline">Liên hệ CSKH</Link>.
        </p>
      </section>

      <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-4 text-xs text-slate-400">
        <Link href="/privacy" className="hover:text-white underline">Chính sách Bảo mật</Link>
        <Link href="/refund" className="hover:text-white underline">Chính sách Hoàn tiền</Link>
        <Link href="/contact" className="hover:text-white underline">Liên hệ hỗ trợ</Link>
        <Link href="/upgrade" className="hover:text-amber-300 underline">Quay lại trang Nâng cấp</Link>
      </div>
    </div>
  );
}
