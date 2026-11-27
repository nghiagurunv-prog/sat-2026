import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimitDistributed, getRateLimitKey } from '@/lib/rate-limit';
import { getWalletCatalogItem } from '@/lib/wallet-catalog';
import { purchaseCatalogWithWalletAtomic, getWalletSummary } from '@/lib/wallet-store';
import { emitMetric } from '@/lib/telemetry';

/**
 * POST /api/wallet/purchase
 * Body: { itemId: string }
 * - Client CHỈ gửi `itemId`; server tự tra giá VNĐ từ WALLET_CATALOG (chống sửa giá).
 * - Trừ Ví + mở khóa gói 4 app (và user_subscriptions cho SAT) NGUYÊN TỬ qua FOR UPDATE.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Bạn cần đăng nhập để mua gói bằng số dư Ví.' },
        { status: 401 }
      );
    }

    const rlKey = getRateLimitKey(req, 'wallet-purchase', user.id);
    const rl = await rateLimitDistributed(rlKey, 15, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít giây.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    let body: { itemId?: unknown } = {};
    try {
      body = (await req.json()) ?? {};
    } catch {
      return NextResponse.json({ success: false, error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
    }

    const item = getWalletCatalogItem(body.itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Gói học không tồn tại trong danh mục.' }, { status: 400 });
    }

    const result = await purchaseCatalogWithWalletAtomic(user.id, item);
    if (!result.ok) {
      if (result.reason === 'insufficient_balance') {
        return NextResponse.json(
          {
            success: false,
            code: 'INSUFFICIENT_BALANCE',
            error: `Số dư Ví chưa đủ. Cần thêm ${(result.shortfallVnd ?? item.priceVnd).toLocaleString('vi-VN')}₫ để mua ${item.name}.`,
            balanceVnd: result.balanceVnd ?? 0,
            requiredVnd: result.requiredVnd ?? item.priceVnd,
            shortfallVnd: result.shortfallVnd ?? item.priceVnd,
          },
          { status: 402 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Hệ thống Ví tạm bận, chưa trừ tiền. Vui lòng thử lại sau.' },
        { status: 503 }
      );
    }

    emitMetric('wallet_purchase_success', item.priceVnd, {
      itemId: item.id,
      category: item.category,
    });

    const summary = await getWalletSummary(user.id);
    return NextResponse.json({
      success: true,
      item: {
        id: item.id,
        name: item.name,
        appCodes: item.appCodes,
        priceVnd: item.priceVnd,
        durationDays: item.durationDays,
      },
      balanceVnd: result.balanceVnd,
      expiresAt: result.expiresAt,
      wallet: summary.wallet,
      entitlements: summary.entitlements,
      ledger: summary.ledger,
    });
  } catch (err) {
    console.error('Lỗi POST /api/wallet/purchase:', err);
    return NextResponse.json({ success: false, error: 'Lỗi máy chủ khi xử lý mua gói.' }, { status: 500 });
  }
}
