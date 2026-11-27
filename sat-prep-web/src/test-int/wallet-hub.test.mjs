/**
 * Unified Wallet Hub Regression & Money-Path Integration Suite (/wallet)
 * Khóa chặt dòng tiền thật:
 *  - Validation số tiền nạp (>= 10.000đ, bội số 1.000đ)
 *  - Fail-closed 401 khi chưa đăng nhập cho POST /api/wallet/topup & /api/wallet/purchase
 *  - Nạp Ví qua PayOS Webhook (ký HMAC thật) -> cộng số dư chính xác, idempotent khi retry, chặn amount_mismatch (#G8)
 *  - Mua gói SAT từ Ví -> trừ số dư chính xác, đồng bộ cả user_app_entitlements('sat') & user_subscriptions('premium')
 *  - Mua Combo 4 App -> mở khóa đồng thời cả 4 app ('sat', 'ielts', 'thcs', 'thpt')
 *  - Chống âm tiền: thiếu số dư trả HTTP 402 INSUFFICIENT_BALANCE
 *  - Brand isolation: 0 rò rỉ Phú Gia / nội thất / STK giả 0345678999
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetDb, setCurrentUser, seed, getRows } from './harness.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

function jsonReq(url, body, headers = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function signPayosData(data, checksumKey) {
  const sorted = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k] ?? ''}`)
    .join('&');
  return crypto.createHmac('sha256', checksumKey).update(sorted).digest('hex');
}

describe('Unified Wallet Hub (aionthi.com 4-App) — End-to-End Money-Path', () => {
  beforeEach(() => {
    resetDb();
    process.env.PAYOS_CHECKSUM_KEY = 'wallet-test-payos-checksum-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://sat.aionthi.com';
  });

  test('Fail-closed 401 khi chưa đăng nhập gọi /api/wallet/topup và /api/wallet/purchase', async () => {
    setCurrentUser(null);
    const { POST: topupPost } = await import('../app/api/wallet/topup/route.ts');
    const { POST: purchasePost } = await import('../app/api/wallet/purchase/route.ts');

    const r1 = await topupPost(jsonReq('http://localhost/api/wallet/topup', { gateway: 'payos', amountVnd: 100000 }));
    assert.equal(r1.status, 401);

    const r2 = await purchasePost(jsonReq('http://localhost/api/wallet/purchase', { itemId: 'sat_premium_monthly' }));
    assert.equal(r2.status, 401);
  });

  test('validateTopupAmount chấp nhận 10.000đ (test thật) và chặn < 10.000đ hoặc số lẻ', async () => {
    const { validateTopupAmount } = await import('../lib/wallet-catalog.ts');
    assert.equal(validateTopupAmount(10000).ok, true);
    assert.equal(validateTopupAmount(500000).ok, true);
    assert.equal(validateTopupAmount(5000).ok, false);
    assert.equal(validateTopupAmount(10500).ok, false);
    assert.equal(validateTopupAmount(-100000).ok, false);
  });

  test('PayOS Webhook nạp Ví: cộng đúng số dư, idempotent khi retry & chặn lệch tiền (#G8)', async () => {
    const uid = '33333333-3333-4333-8333-333333333333';
    seed('wallet_topups', {
      order_id: '880012345',
      user_id: uid,
      gateway: 'payos',
      amount_vnd: 500000,
      status: 'pending',
    });

    const { POST: payosWebhook } = await import('../app/api/payment/payos-webhook/route.ts');

    // 1. Lệch tiền (chỉ chuyển 100k thay vì 500k) -> 200 ack, KHÔNG cộng ví
    const badData = { orderCode: 880012345, amount: 100000, reference: 'FT-MISMATCH-1' };
    const badRes = await payosWebhook(
      jsonReq('http://localhost/api/payment/payos-webhook', {
        code: '00',
        success: true,
        data: badData,
        signature: signPayosData(badData, process.env.PAYOS_CHECKSUM_KEY),
      })
    );
    assert.equal(badRes.status, 200);
    assert.equal(getRows('user_wallets').length, 0, 'Lệch tiền tuyệt đối KHÔNG được cộng Ví');

    // 2. Đúng tiền 500.000đ -> cộng Ví 500.000đ + ghi ledger
    const okData = { orderCode: 880012345, amount: 500000, reference: 'FT-OK-1' };
    const okPayload = {
      code: '00',
      success: true,
      data: okData,
      signature: signPayosData(okData, process.env.PAYOS_CHECKSUM_KEY),
    };
    const res1 = await payosWebhook(jsonReq('http://localhost/api/payment/payos-webhook', okPayload));
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.walletTopup, true);
    assert.equal(getRows('user_wallets')[0].balance_vnd, 500000);
    assert.equal(getRows('wallet_ledger').length, 1);

    // 3. Replay webhook lần 2 -> idempotent, số dư vẫn đúng 500.000đ (KHÔNG nhân đôi)
    const res2 = await payosWebhook(jsonReq('http://localhost/api/payment/payos-webhook', okPayload));
    assert.equal(res2.status, 200);
    assert.equal(getRows('user_wallets')[0].balance_vnd, 500000);
  });

  test('Mua gói SAT & Combo 4 App từ Ví: trừ đúng tiền, đồng bộ 4 app và chặn 402 khi thiếu số dư', async () => {
    const uid = '44444444-4444-4444-8444-444444444444';
    setCurrentUser({ id: uid, email: 'hocsinh@aionthi.com' });
    seed('user_wallets', {
      user_id: uid,
      balance_vnd: 500000,
      total_deposited_vnd: 500000,
      total_spent_vnd: 0,
    });

    const { POST: purchasePost } = await import('../app/api/wallet/purchase/route.ts');

    // 1. Mua SAT Premium 1 Tháng (499.000đ) -> Ví còn 1.000đ + mở SAT trên cả 2 bảng
    const satRes = await purchasePost(
      jsonReq('http://localhost/api/wallet/purchase', { itemId: 'sat_premium_monthly' })
    );
    assert.equal(satRes.status, 200);
    const satBody = await satRes.json();
    assert.equal(satBody.success, true);
    assert.equal(satBody.balanceVnd, 1000);

    const ents1 = getRows('user_app_entitlements');
    assert.ok(ents1.some((e) => e.user_id === uid && e.app_code === 'sat'));
    const subs1 = getRows('user_subscriptions');
    assert.ok(subs1.some((s) => s.user_id === uid && s.tier === 'premium'));

    // 2. Ví chỉ còn 1.000đ -> mua tiếp Cấp II (199.000đ) bị chặn 402 INSUFFICIENT_BALANCE (không âm tiền!)
    const failRes = await purchasePost(
      jsonReq('http://localhost/api/wallet/purchase', { itemId: 'thcs_pro_monthly' })
    );
    assert.equal(failRes.status, 402);
    const failBody = await failRes.json();
    assert.equal(failBody.code, 'INSUFFICIENT_BALANCE');
    assert.equal(failBody.shortfallVnd, 198000);
    assert.equal(getRows('user_wallets')[0].balance_vnd, 1000);

    // 3. Nạp thêm đủ tiền mua Combo 4 App (1.990.000đ) -> mở khóa cả 4 app sat/ielts/thcs/thpt
    resetDb();
    setCurrentUser({ id: uid, email: 'hocsinh@aionthi.com' });
    seed('user_wallets', {
      user_id: uid,
      balance_vnd: 2500000,
      total_deposited_vnd: 2500000,
      total_spent_vnd: 0,
    });
    const comboRes = await purchasePost(
      jsonReq('http://localhost/api/wallet/purchase', { itemId: 'combo_all_quarterly' })
    );
    assert.equal(comboRes.status, 200);
    const comboBody = await comboRes.json();
    assert.equal(comboBody.balanceVnd, 510000);
    const appCodes = getRows('user_app_entitlements').map((r) => r.app_code).sort();
    assert.deepEqual(appCodes, ['ielts', 'sat', 'thcs', 'thpt']);
  });

  test('Static & Brand Hygiene: /wallet & migration SQL sạch 100% thương hiệu aionthi.com / SAT.Guru', () => {
    const walletPage = fs.readFileSync(path.join(projectRoot, 'src/app/wallet/page.tsx'), 'utf8');
    const migrationSql = fs.readFileSync(
      path.join(projectRoot, 'supabase/migrations/20261128_unified_wallet_and_entitlements.sql'),
      'utf8'
    );
    assert.match(walletPage, /aionthi\.com/);
    assert.ok(!/0345678999/.test(walletPage), 'KHÔNG được có STK giả trong /wallet');
    for (const re of [/Phú\s+Gia/i, /PG\s+HOME/i, /Nội\s+[Tt]hất/i, /042203002931/]) {
      assert.ok(!re.test(walletPage), `Phát hiện rò rỉ thương hiệu trong /wallet (${re})`);
    }
    assert.match(migrationSql, /FOR UPDATE/);
    assert.match(migrationSql, /CHECK \(balance_vnd >= 0\)/);
  });
});
