import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * VERIFIED ACTIVITY TICKER API (W3 #27 — Social Proof ẩn danh từ sự kiện THẬT).
 * Truy vấn trực tiếp `payment_transactions` (status='paid') & `user_progress` mới nhất.
 * TUYỆT ĐỐI không bịa hay hardcode tên/số liệu giả: nếu chưa có giao dịch thật trả `events: []`.
 */

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data: txns } = await admin
      .from('payment_transactions')
      .select('tier, period, paid_at, created_at')
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(8);

    const events = (txns ?? []).map((row: Record<string, unknown>, idx: number) => {
      const tier = String(row.tier || 'premium') === 'ultimate' ? 'Thủ Khoa Ultimate' : 'Chiến Binh Premium';
      const ts = String(row.paid_at || row.created_at || new Date().toISOString());
      return {
        id: `tx-${idx}-${ts}`,
        label: `1 học viên vừa kích hoạt thành công gói ${tier} qua VietQR`,
        timestamp: ts,
        verified: true,
      };
    });

    return NextResponse.json(
      { events, count: events.length, verifiedFromDb: true },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
    );
  } catch {
    return NextResponse.json({ events: [], count: 0, verifiedFromDb: false });
  }
}
