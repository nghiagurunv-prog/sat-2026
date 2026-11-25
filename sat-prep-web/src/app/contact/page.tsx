import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Liên hệ & Hỗ trợ khách hàng',
  description: 'Kênh hỗ trợ học thuật, kỹ thuật và đối soát thanh toán chính thức của SAT.Guru.',
};

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6 text-slate-200 pb-20">
      <div className="space-y-2 border-b border-slate-800 pb-5">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Hỗ trợ học sinh & Phụ huynh</span>
        <h1 className="text-2xl md:text-3xl font-black text-white">Liên Hệ & Chăm Sóc Khách Hàng — SAT.Guru</h1>
        <p className="text-xs text-slate-400">Đội ngũ học thuật & kỹ thuật trực hỗ trợ 08:00 – 22:00 hàng ngày (kể cả Thứ 7, Chủ nhật)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1b2533] border border-slate-700/80 rounded-2xl p-5 space-y-2">
          <div className="text-xs font-bold uppercase text-amber-400">Hotline / Zalo CSKH Duy Nhất</div>
          <a href="tel:0986722324" className="text-2xl font-black text-white hover:text-amber-300 block">
            0986.722.324
          </a>
          <p className="text-xs text-slate-400">
            Hỗ trợ tư vấn lộ trình điểm SAT 1300–1550+, đối soát đơn hàng payOS/Stripe và kích hoạt tài khoản khẩn cấp.
          </p>
        </div>

        <div className="bg-[#1b2533] border border-slate-700/80 rounded-2xl p-5 space-y-2">
          <div className="text-xs font-bold uppercase text-sky-400">Cố vấn học thuật & Vận hành</div>
          <div className="text-lg font-black text-white">SAT.Guru — Thầy Nghĩa Guru</div>
          <p className="text-xs text-slate-400">
            Nền tảng luyện thi Digital SAT thích ứng AI dành cho học sinh THPT Việt Nam và các lớp/trung tâm đối tác.
          </p>
          <div className="text-xs text-slate-300 pt-1">
            Zalo CSKH chính thức: <span className="font-mono text-sky-300">0986.722.324</span> (phản hồi trong 15 phút)
          </div>
        </div>
      </div>

      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-2 text-sm text-slate-300">
        <h2 className="font-bold text-white">Cần hỗ trợ nhanh về giao dịch?</h2>
        <p className="text-xs leading-relaxed text-slate-400">
          Nếu bạn đã chuyển khoản qua payOS/Stripe nhưng sau 03 phút tài khoản chưa cập nhật gói VIP, vui lòng gửi ảnh chụp biên lai kèm <strong>Email đăng nhập</strong> và <strong>Mã đơn hàng</strong> qua Zalo <strong>0986.722.324</strong> để Admin đối soát và kích hoạt ngay lập tức.
        </p>
      </div>

      <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-4 text-xs text-slate-400">
        <Link href="/terms" className="hover:text-white underline">Điều khoản sử dụng</Link>
        <Link href="/privacy" className="hover:text-white underline">Chính sách Bảo mật</Link>
        <Link href="/refund" className="hover:text-white underline">Chính sách Hoàn tiền</Link>
        <Link href="/pricing" className="hover:text-amber-300 underline">Xem Bảng giá</Link>
      </div>
    </div>
  );
}
