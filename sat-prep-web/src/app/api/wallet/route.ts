import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ECOSYSTEM_APPS, WALLET_CATALOG, TOPUP_PRESETS_VND, MIN_TOPUP_VND, MAX_TOPUP_VND } from '@/lib/wallet-catalog';
import { getWalletSummary } from '@/lib/wallet-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/wallet
 * - Khách chưa đăng nhập: trả `authenticated: false` + danh mục gói 4 app công khai (0 PII).
 * - User đã đăng nhập: trả số dư Ví VNĐ, quyền 4 app đang sở hữu, lịch sử nạp & sao kê ví.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user.isAuthenticated) {
      return NextResponse.json(
        {
          authenticated: false,
          user: null,
          wallet: { balanceVnd: 0, totalDepositedVnd: 0, totalSpentVnd: 0, updatedAt: null },
          entitlements: [],
          ledger: [],
          topups: [],
          apps: ECOSYSTEM_APPS,
          catalog: WALLET_CATALOG,
          topupConfig: {
            minVnd: MIN_TOPUP_VND,
            maxVnd: MAX_TOPUP_VND,
            presetsVnd: TOPUP_PRESETS_VND,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let userEmail: string | null = null;
    try {
      const supabase = await createClient();
      const { data: authData } = await supabase.auth.getUser();
      userEmail = authData?.user?.email ?? null;
    } catch {
      userEmail = null;
    }

    const summary = await getWalletSummary(user.id);
    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: user.id,
          email: userEmail,
        },
        ...summary,
        apps: ECOSYSTEM_APPS,
        catalog: WALLET_CATALOG,
        topupConfig: {
          minVnd: MIN_TOPUP_VND,
          maxVnd: MAX_TOPUP_VND,
          presetsVnd: TOPUP_PRESETS_VND,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi tải thông tin Ví.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
