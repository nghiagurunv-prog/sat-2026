import { redirect } from 'next/navigation';

/**
 * ⚠️ TRANG CŨ — đã gộp vào /admin (bảng điều khiển admin mới: session-admin +
 * ADMIN_SECRET dự phòng, gồm CẢ hàng đợi đổi quà LẪN báo cáo chi phí AI).
 * Giữ route này để link/bookmark cũ không vỡ → redirect sang /admin.
 */
export default function AdminRedemptionsRedirect() {
  redirect('/admin');
}
