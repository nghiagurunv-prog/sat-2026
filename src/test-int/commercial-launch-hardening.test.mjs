/**
 * Commercial Launch Hardening Regression Suite (Đợt A — 7 Chốt chặn P0/P1)
 * Khóa vĩnh viễn:
 *  - P0-1: Không còn STK giả 0345678999, không còn Silent Fallback ở /upgrade
 *  - P0-2: Giá UI không lệch Coins-to-Cash so với /api/payment/create
 *  - P0-3: /admin nối API thật (/api/admin/students + refund thu hồi VIP), 0 mock GMV
 *  - P0-4: Migration baseline 20261120 + guard to_regclass trong 20261121
 *  - P0-5: Đầy đủ 4 trang pháp lý (/terms, /privacy, /refund, /contact) + SEO (robots, sitemap, lang="vi", OG)
 *  - P1: /api/health, rateLimitDistributed ở payment/create, maxDuration + batch cron digest, fair-use gpt-4o
 *  - Brand Hygiene: 0 rò rỉ thương hiệu Phú Gia / nội thất
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetDb, setCurrentUser, seed, getRows } from './harness.mjs';

function jsonReq(url, body, opts = {}) {
  return new Request(url, {
    method: opts.method || 'POST',
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    body: JSON.stringify(body),
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

function readFile(relPath) {
  const full = path.join(projectRoot, relPath);
  assert.ok(fs.existsSync(full), `Missing required file: ${relPath}`);
  return fs.readFileSync(full, 'utf8');
}

describe('Commercial Launch Hardening — P0/P1 Static & Contract Gates', () => {
  test('P0-1 & P0-2: /upgrade xóa sạch STK giả 0345678999, tắt silent fallback và không trừ Coins-to-Cash lệch server', () => {
    const upgrade = readFile('src/app/upgrade/page.tsx');
    assert.ok(!/0345678999/.test(upgrade), 'PHẢI xóa sạch STK mẫu 0345678999 khỏi upgrade/page.tsx');
    assert.ok(!/SAT NGHIAGURU ACADEMY/i.test(upgrade), 'PHẢI xóa sạch tên TK mẫu khỏi upgrade/page.tsx');
    assert.ok(!/img\.vietqr\.io\/image\/MB-/i.test(upgrade), 'KHÔNG được dùng ảnh VietQR tĩnh không có orderId');
    assert.ok(!/coinsRedeemed/.test(upgrade), 'Launch v1 không được gửi/hiển thị lệch Coins-to-Cash');
    assert.match(upgrade, /openParentPayosModal/, 'Luồng nhờ phụ huynh phải tạo đơn PayOS thật');
    assert.match(upgrade, /res\.status === 401/, 'Phải xử lý tường minh lỗi 401 chưa đăng nhập, không nuốt lỗi');
  });

  test('P0-3: /admin không khởi tạo mock TXN-9842/STU-100 và gọi thật /api/admin/students + refund', () => {
    const admin = readFile('src/app/admin/page.tsx');
    assert.ok(!/TXN-984210/.test(admin), 'KHÔNG được trộn mock transaction TXN-984210 vào KPI GMV thật');
    assert.ok(!/STU-1001/.test(admin), 'KHÔNG được trộn mock student STU-1001 vào CRM thật');
    assert.match(admin, /\/api\/admin\/students/, 'Admin phải gọi thật /api/admin/students');
    assert.match(admin, /action:\s*'manual_vip'/, 'Manual VIP phải gọi backend action manual_vip');
    assert.match(admin, /action:\s*'reward_coins'/, 'Reward coins phải gọi backend action reward_coins');
    assert.match(admin, /action:\s*'extend_vip'/, 'Extend VIP phải gọi backend action extend_vip');
    assert.match(admin, /'refund'/, 'Admin phải hỗ trợ gửi action refund cho đơn đã thanh toán');
  });

  test('P0-4: Migration baseline đủ bảng lõi & file 20261121 có guard to_regclass chống crash 42P01', () => {
    const baseline = readFile('supabase/migrations/20261120_000_baseline_schema.sql');
    for (const tbl of [
      'public.user_economy',
      'public.user_progress',
      'public.user_mastery',
      'public.user_goals',
      'public.user_ai_usage',
      'public.ai_cost_ledger',
      'public.ai_chat_cache',
      'public.issued_questions',
      'public.payment_transactions',
      'public.user_subscriptions',
    ]) {
      assert.ok(baseline.includes(tbl), `Baseline migration thiếu bảng ${tbl}`);
    }
    const hardening = readFile('supabase/migrations/20261121_security_and_atomic_hardening.sql');
    assert.match(hardening, /to_regclass/, 'Migration 20261121 phải bọc guard to_regclass chống lỗi 42P01');
  });

  test('P0-5: Đầy đủ 4 trang pháp lý, Footer links, SEO robots/sitemap/OG/lang=vi và 0 rò rỉ Phú Gia', () => {
    const terms = readFile('src/app/terms/page.tsx');
    const privacy = readFile('src/app/privacy/page.tsx');
    const refund = readFile('src/app/refund/page.tsx');
    const contact = readFile('src/app/contact/page.tsx');
    const layout = readFile('src/app/layout.tsx');
    const robots = readFile('src/app/robots.ts');
    const sitemap = readFile('src/app/sitemap.ts');
    const home = readFile('src/app/page.tsx');

    assert.match(privacy, /13\/2023\/NĐ-CP/, 'Privacy policy phải dẫn chiếu NĐ 13/2023/NĐ-CP');
    assert.match(refund, /0986\.722\.324/, 'Refund policy phải có Hotline CSKH chuẩn');
    assert.match(contact, /0986\.722\.324/, 'Contact page phải có Hotline CSKH chuẩn');
    assert.match(layout, /lang="vi"/, 'RootLayout phải đặt lang="vi"');
    assert.match(layout, /metadataBase/, 'RootLayout phải khai báo metadataBase');
    assert.match(layout, /openGraph/, 'RootLayout phải khai báo OpenGraph');
    assert.match(robots, /sitemap\.xml/, 'robots.ts phải khai báo sitemap');
    assert.match(sitemap, /\/terms/, 'sitemap.ts phải index trang pháp lý');
    assert.match(home, /href="\/terms"/, 'Trang chủ phải có link chân trang tới /terms');

    const forbidden = [/Phú\s+Gia/i, /PG\s+HOME/i, /Nội\s+[Tt]hất/i, /042203002931/, /Trương\s+Quốc\s+Dụng/i];
    for (const content of [terms, privacy, refund, contact]) {
      for (const re of forbidden) {
        assert.ok(!re.test(content), `Phát hiện rò rỉ thương hiệu ngoài SAT.Guru (${re})`);
      }
    }
  });

  test('P1 Infra: vercel.json maxDuration, .env.example đầy đủ, payment/create dùng rateLimitDistributed & cron batch', () => {
    const vercelCfg = JSON.parse(readFile('vercel.json'));
    assert.ok(vercelCfg.functions && vercelCfg.functions['src/app/api/chat/route.ts']?.maxDuration >= 60);
    const envEx = readFile('.env.example');
    for (const key of ['CRON_SECRET', 'PAYOS_CLIENT_ID', 'GEMINI_API_KEY', 'UPSTASH_REDIS_REST_URL', 'ALERT_WEBHOOK_URL']) {
      assert.ok(envEx.includes(key), `.env.example thiếu biến ${key}`);
    }
    const payCreate = readFile('src/app/api/payment/create/route.ts');
    assert.match(payCreate, /rateLimitDistributed/, 'payment/create phải dùng rateLimitDistributed');
    const digest = readFile('src/app/api/cron/parent-weekly-digest/route.ts');
    assert.match(digest, /Promise\.allSettled/, 'parent-weekly-digest phải xử lý batch song song');
    assert.match(digest, /maxDuration\s*=\s*60/, 'parent-weekly-digest phải khai báo maxDuration = 60');
  });
});

describe('Commercial Launch Hardening — Live API Handler Integration Tests', () => {
  beforeEach(() => {
    resetDb();
    process.env.ADMIN_SECRET = 'test-commercial-admin-secret-999';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-key';
  });

  test('GET /api/health trả 200 ok + boolean checks và KHÔNG lộ secret', async () => {
    const { GET } = await import('../app/api/health/route.ts');
    const res = await GET();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, 'sat-guru-web');
    assert.equal(typeof body.checks.paymentPayosConfigured, 'boolean');
    assert.ok(!JSON.stringify(body).includes('test-commercial-admin-secret-999'), 'KHÔNG được lộ secret trong /api/health');
  });

  test('POST /api/admin/students: Fail-closed 403 khi thiếu quyền; manual_vip & reward_coins ghi thật DB', async () => {
    setCurrentUser(null);
    const { POST } = await import('../app/api/admin/students/route.ts');

    // 1. Fail-closed khi thiếu admin secret
    const denied = await POST(jsonReq('http://localhost/api/admin/students', {
      action: 'reward_coins',
      userId: '11111111-1111-4111-8111-111111111111',
      amount: 100,
    }));
    assert.equal(denied.status, 403);

    // 2. Có x-admin-secret hợp lệ -> reward_coins ghi thật vào user_economy
    const uid = '11111111-1111-4111-8111-111111111111';
    seed('user_economy', { user_id: uid, coins: 250, xp: 10 });
    const okCoins = await POST(jsonReq(
      'http://localhost/api/admin/students',
      { action: 'reward_coins', userId: uid, amount: 50 },
      { headers: { 'x-admin-secret': process.env.ADMIN_SECRET } }
    ));
    assert.equal(okCoins.status, 200);
    const coinsBody = await okCoins.json();
    assert.equal(coinsBody.success, true);
    assert.equal(coinsBody.coins, 300);

    // 3. manual_vip ghi thật vào user_subscriptions
    const okVip = await POST(jsonReq(
      'http://localhost/api/admin/students',
      { action: 'manual_vip', userId: uid, plan: 'ULTIMATE', days: 30 },
      { headers: { 'x-admin-secret': process.env.ADMIN_SECRET } }
    ));
    assert.equal(okVip.status, 200);
    const vipBody = await okVip.json();
    assert.equal(vipBody.success, true);
    assert.equal(vipBody.tier, 'ultimate');
    const subs = getRows('user_subscriptions');
    assert.ok(subs.some((s) => s.user_id === uid && s.tier === 'ultimate'), 'Phải ghi gói ultimate vào user_subscriptions');
  });

  test('POST /api/admin/orders action=refund đánh dấu refunded & thu hồi ngay quyền VIP trong user_subscriptions', async () => {
    setCurrentUser(null);
    const uid = '22222222-2222-4222-8222-222222222222';
    const futureIso = new Date(Date.now() + 30 * 86_400_000).toISOString();
    seed('payment_transactions', {
      id: 'tx-row-1',
      order_id: 'PAYOS-REFUND-001',
      user_id: uid,
      gateway: 'payos',
      tier: 'premium',
      period: 'monthly',
      amount_vnd: 499000,
      duration_days: 30,
      status: 'paid',
    });
    seed('user_subscriptions', {
      user_id: uid,
      tier: 'premium',
      period: 'monthly',
      started_at: new Date().toISOString(),
      expires_at: futureIso,
    });

    const { POST } = await import('../app/api/admin/orders/route.ts');
    const res = await POST(jsonReq(
      'http://localhost/api/admin/orders',
      { orderId: 'PAYOS-REFUND-001', action: 'refund' },
      { headers: { 'x-admin-secret': process.env.ADMIN_SECRET } }
    ));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.subscriptionRevoked, true);

    const subs = getRows('user_subscriptions');
    assert.ok(new Date(subs[0].expires_at).getTime() < Date.now(), 'Quyền VIP phải bị thu hồi về quá khứ ngay lập tức');
  });

  test('resolveEffectiveAiTier tự hạ mềm Ultimate vượt 60 lượt/ngày xuống premium bảo vệ biên lợi nhuận', async () => {
    const { resolveEffectiveAiTier, ULTIMATE_GPT4O_DAILY_CAP } = await import('../lib/ai-cost.ts');
    assert.equal(resolveEffectiveAiTier('ultimate', ULTIMATE_GPT4O_DAILY_CAP), 'ultimate');
    assert.equal(resolveEffectiveAiTier('ultimate', ULTIMATE_GPT4O_DAILY_CAP + 1), 'premium');
    assert.equal(resolveEffectiveAiTier('free', 100), 'free');
  });
});
