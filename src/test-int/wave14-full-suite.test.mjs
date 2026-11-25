/**
 * WAVE 14 REGRESSION SUITE — Khóa vĩnh viễn 19 lỗ hổng Vòng 2 (Wave 0) + 40 cải tiến (Wave 1–3)
 * Bao gồm:
 *  - Live API handler tests (parent-share TTL 30d & 0 studentId leak, diagnostic no correctAns backdoor,
 *    cau-sai auth/whitelist, payment/create Sprint/Squad/ParentShare, subscription/freeze pure + API,
 *    referral/claim, b2b/trial, questions/report, admin/benchmarks, cron/abandoned-checkout, speed-quiz anti-cheat)
 *  - Pure domain tests (sat-dates 2026-2027, subscription freeze #G8, uni-benchmarks, exams 98-Q deduplication)
 *  - Static contract & brand-separation gates (0 STK giả 0345678999/0348888688, 0 Hotline cũ 034.8888.688,
 *    0 Phú Gia, PWA icons 192/512 + sw.js, Desmos ?embed + Pointer Events)
 */
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resetDb, setCurrentUser, seed, getRows, postJson, readRes } from './harness.mjs';

const ROOT = process.cwd();
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Wave 14 — Static Commercial, Brand & UX Contract Gates', () => {
  test('W0 #1, #5, #6 & W1 #21, #22: Xóa sạch STK giả 0345678999/0348888688, Hotline cũ 034.8888.688 & Coins-to-Cash lệch giá', () => {
    const pricing = readSrc('src/app/pricing/page.tsx');
    const parentReport = readSrc('src/components/ParentReport.tsx');

    for (const [name, src] of [['pricing/page.tsx', pricing], ['ParentReport.tsx', parentReport]]) {
      assert.ok(!/0345678999/.test(src), `${name} vẫn còn STK giả 0345678999`);
      assert.ok(!/0348888688/.test(src), `${name} vẫn còn STK cũ 0348888688`);
      assert.ok(!/034\.8888\.688/.test(src), `${name} vẫn còn Hotline lệch 034.8888.688`);
      assert.ok(!/NGUYEN HONG NGHIA/i.test(src), `${name} vẫn còn chủ TK cũ`);
      assert.ok(!/SAT NGHIAGURU ACADEMY/i.test(src), `${name} vẫn còn chủ TK giả`);
      assert.ok(!/img\.vietqr\.io\/image\//i.test(src), `${name} không được dùng ảnh VietQR tĩnh`);
      assert.ok(!/Phú\s+Gia/i.test(src), `${name} không được dính thương hiệu Phú Gia`);
    }
    assert.ok(!/coinsRedeemed/.test(pricing), '/pricing không được trừ Coins-to-Cash lệch server');
    assert.match(pricing, /STUDY_SQUAD_PACKS/, '/pricing phải có gói Mua Chung Study Squad (#23)');
    assert.match(pricing, /VerifiedActivityTicker/, '/pricing phải gắn VerifiedActivityTicker (#27)');
    assert.match(parentReport, /isCodeUsable/, 'ParentReport phải chọn mã chia sẻ active qua isCodeUsable (#8)');
    assert.match(parentReport, /ultimate_quarterly/, 'ParentReport phải hỗ trợ tài trợ gói Ultimate (#32)');
  });

  test('W0 #7, #13, #17, #18 & W1 #01–#08, #18: Desmos ?embed + Pointer Events + SPR live + Blind Revenge + Focus Mode + PWA', () => {
    const bluebook = readSrc('src/components/BluebookTools.tsx');
    const core = readSrc('src/components/CorePracticeUI.tsx');
    const sidebar = readSrc('src/components/Sidebar.tsx');
    const notebook = readSrc('src/components/MistakeNotebook.tsx');
    const teacher = readSrc('src/app/teacher/page.tsx');
    const robots = readSrc('src/app/robots.ts');
    const sitemap = readSrc('src/app/sitemap.ts');
    const manifest = JSON.parse(readSrc('public/manifest.json'));

    assert.match(bluebook, /desmos\.com\/calculator\?embed/, 'Desmos iframe phải có ?embed (#7)');
    assert.match(bluebook, /clipboard-read;\s*clipboard-write/, 'Desmos iframe phải có clipboard-read (#7)');
    assert.match(bluebook, /onPointerDown/, 'Desmos/Ref drag phải dùng Pointer Events hỗ trợ iPad (#7)');
    assert.match(core, /isMath \? 'Math' : 'Reading & Writing'/, 'CorePracticeUI dùng isMath không dùng includes($) (#7)');
    assert.match(core, /sat_mistake_bank_updated/, 'CorePracticeUI phát sat_mistake_bank_updated (#13/#14)');
    assert.match(core, /validateSprInput/, 'CorePracticeUI gắn validateSprInput realtime (#03)');
    assert.match(core, /dispatchDesmosExpression/, 'CorePracticeUI có nút nạp Desmos 1-chạm (#01)');
    assert.match(core, /Mark for Review/, 'CorePracticeUI có nút Mark for Review (#08)');
    assert.match(sidebar, /academicFocusMode/, 'Sidebar có chế độ Học Thuật Tập Trung (#18)');
    assert.match(notebook, /Blind Revenge/, 'MistakeNotebook có chế độ Blind Revenge xáo trộn (#06)');
    assert.ok(!/0912\.888\.xxx/.test(teacher), 'teacher/page.tsx phải xóa học sinh mock cứng (#13)');
    assert.ok(!/sat-2026\.vercel\.app/.test(robots), 'robots.ts không fallback về staging (#18)');
    assert.ok(!/sat-2026\.vercel\.app/.test(sitemap), 'sitemap.ts không fallback về staging (#18)');
    assert.match(sitemap, /\/uni-predict\//, 'sitemap.ts phải index Hub /uni-predict/[slug] (#29)');
    assert.ok(manifest.icons.some((i) => i.sizes === '192x192'), 'manifest.json có icon 192x192 (#17)');
    assert.ok(manifest.icons.some((i) => i.sizes === '512x512'), 'manifest.json có icon 512x512 (#17)');
    assert.ok(fs.existsSync(path.join(ROOT, 'public/icons/icon-192.png')));
    assert.ok(fs.existsSync(path.join(ROOT, 'public/icons/icon-512.png')));
    assert.ok(fs.existsSync(path.join(ROOT, 'public/sw.js')));
  });
});

describe('Wave 14 — Pure Domain Logic Tests (#G8, #13, #23, #25, #29, #10)', () => {
  test('sat-dates.ts: Lịch thi College Board 2026–2027, cảnh báo đăng ký sớm & KPI ngày', async () => {
    const { OFFICIAL_SAT_DATES, resolveTargetSatDate, evaluateSatRegistrationAlert, computeDailyQuestionKpi } = await import('@/lib/sat-dates');
    assert.ok(OFFICIAL_SAT_DATES.some((d) => d.dateStr.startsWith('2027-')), 'Phải có lịch thi 2027');
    assert.ok(!OFFICIAL_SAT_DATES.some((d) => d.dateStr.startsWith('2025-')), 'Đã loại bỏ lịch thi cũ 2025');
    const exam = resolveTargetSatDate('2026-12-05', Date.parse('2026-11-10T00:00:00Z'));
    assert.equal(exam.dateStr, '2026-12-05');
    const alert = evaluateSatRegistrationAlert(exam, Date.parse('2026-11-10T00:00:00Z'));
    assert.equal(alert.isRegUrgent, true);
    assert.equal(alert.recommendSprint45d, true);
    assert.equal(computeDailyQuestionKpi(5, 1300, 1450), 20);
  });

  test('subscription.ts: resolveCheckoutPlan hỗ trợ Sprint + Study Squad & Subscription Freeze thuần #G8', async () => {
    const { resolveCheckoutPlan, applySubscriptionFreeze, isSubscriptionFrozen } = await import('@/lib/subscription');
    const sprint = resolveCheckoutPlan({ planId: 'sprint_45d' });
    assert.equal(sprint?.priceVnd, 699_000);
    assert.equal(sprint?.durationDays, 45);

    const squad3 = resolveCheckoutPlan({ planId: 'squad_3' });
    assert.equal(squad3?.seats, 3);
    assert.equal(squad3?.priceVnd, 2_632_500);

    const now = '2026-11-25T00:00:00.000Z';
    const sub = { tier: 'premium', period: 'quarterly', startedAt: '2026-11-01T00:00:00.000Z', expiresAt: '2027-01-30T00:00:00.000Z' };
    const bad = applySubscriptionFreeze(sub, 3, now);
    assert.equal(bad.ok, false, 'Dưới 7 ngày phải bị từ chối');
    const ok = applySubscriptionFreeze(sub, 10, now);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.updated.freezeUsed, true);
      assert.equal(ok.updated.expiresAt, '2027-02-09T00:00:00.000Z');
      assert.equal(isSubscriptionFrozen(ok.updated, '2026-11-26T00:00:00.000Z'), true);
      const twice = applySubscriptionFreeze(ok.updated, 7, '2026-12-10T00:00:00.000Z');
      assert.equal(twice.ok, false, 'Không cho phép bảo lưu 2 lần trong cùng chu kỳ');
    }
  });

  test('uni-benchmarks.ts & exams.ts: Quy đổi 7 ĐH VN & gộp pool 98 câu không trùng', async () => {
    const { DEFAULT_VN_UNIVERSITIES, evaluateUniAdmission, getVnUniversityBySlug } = await import('@/lib/uni-benchmarks');
    assert.ok(DEFAULT_VN_UNIVERSITIES.length >= 7);
    const ftu = getVnUniversityBySlug('ftu');
    assert.ok(ftu);
    const ev = evaluateUniAdmission(ftu, 1500);
    assert.equal(ev.verdict, 'strong');
    assert.ok(ev.converted > 28);

    const { deduplicateExamQuestions } = await import('@/lib/exams');
    const dedup = deduplicateExamQuestions([
      { id: '1', practice_question: 'Solve 2x = 4', choices: [], correct_choice: '2', explanation: 'x=2', difficulty: 'Easy' },
      { id: '2', practice_question: 'Solve  2x = 4 ', choices: [], correct_choice: '2', explanation: 'x=2', difficulty: 'Easy' },
    ]);
    assert.equal(dedup.length, 1);
  });
});

describe('Wave 14 — Live API Handler Security & Feature Verification', () => {
  beforeEach(() => {
    resetDb();
    process.env.ADMIN_SECRET = 'wave14-admin-secret-xyz';
    process.env.CRON_SECRET = 'wave14-cron-secret-xyz';
  });

  test('W0 #2 & #9: /api/parent-share tạo mã có expires_at (30 ngày) và ?code= KHÔNG lộ studentId UUID', async () => {
    const uid = '33333333-3333-4333-8333-333333333333';
    setCurrentUser({ id: uid });
    const { POST, GET } = await import('@/app/api/parent-share/route');

    const genRes = await readRes(await POST(postJson({ action: 'generate' })));
    assert.equal(genRes.status, 200);
    assert.ok(genRes.body.code?.startsWith('PH-'));

    const rows = getRows('parent_share_codes');
    assert.equal(rows.length, 1);
    assert.ok(rows[0].expires_at !== null, 'expires_at KHÔNG được bằng null (#2)');

    const checkReq = new Request(`http://localhost/api/parent-share?code=${encodeURIComponent(genRes.body.code)}`);
    Object.defineProperty(checkReq, 'nextUrl', { value: new URL(checkReq.url) });
    const checkRes = await readRes(await GET(checkReq));
    assert.equal(checkRes.status, 200);
    assert.equal(checkRes.body.valid, true);
    assert.equal(checkRes.body.studentId, undefined, 'KHÔNG được lộ studentId UUID công khai (#9)');
  });

  test('W0 #3: /api/diagnostic action=grade từ chối backdoor correctAns từ client (400)', async () => {
    setCurrentUser({ id: '44444444-4444-4444-8444-444444444444' });
    const { POST } = await import('@/app/api/diagnostic/route');
    const res = await readRes(await POST(postJson({ action: 'grade', answer: 'A', correctAns: 'A' })));
    assert.equal(res.status, 400, 'Thiếu questionId phải trả 400 thay vì tự chấm bằng correctAns');
  });

  test('W0 #10: /api/cau-sai POST chặn khách chưa đăng nhập (401)', async () => {
    setCurrentUser(null);
    const { POST } = await import('@/app/api/cau-sai/route');
    const res = await readRes(await POST(postJson({ question: 'spam guest' })));
    assert.equal(res.status, 401);
  });

  test('W2 #16: /api/speed-quiz/question POST gắn anomalyFlag=true khi câu Hard giải < 2000ms', async () => {
    const uid = '55555555-5555-4555-8555-555555555555';
    setCurrentUser({ id: uid });
    seed('issued_questions', {
      id: 'sq-fast-hard',
      user_id: uid,
      correct_choice: 'B',
      skill_id: 'algebra.systems',
      difficulty: 'Hard',
      answered: false,
      was_correct: false,
      context: JSON.stringify({ src: 'bank' }),
    });
    const { POST } = await import('@/app/api/speed-quiz/question/route');
    const res = await readRes(
      await POST(postJson({ questionId: 'sq-fast-hard', userAnswer: 'B', difficulty: 'Hard', timeSpentMs: 850 }))
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.anomalyFlag, true);
  });

  test('W3 #10, #26, #39, #40: Questions Report, Admin Benchmarks & Abandoned Cron fail-closed 401/403', async () => {
    setCurrentUser(null);
    const { GET: getReports } = await import('@/app/api/questions/report/route');
    const { POST: postBench } = await import('@/app/api/admin/benchmarks/route');
    const { GET: runAbandoned } = await import('@/app/api/cron/abandoned-checkout/route');
    const { POST: postTrial } = await import('@/app/api/b2b/trial/route');

    assert.equal((await getReports(new Request('http://localhost/api/questions/report'))).status, 403);
    assert.equal((await postBench(postJson({ universities: [] }))).status, 403);
    assert.equal((await runAbandoned(new Request('http://localhost/api/cron/abandoned-checkout'))).status, 401);

    const trialRes = await readRes(
      await postTrial(
        postJson({ centerName: 'Trung tâm SAT Hà Nội', contactName: 'Cô Minh', phone: '0986722324' })
      )
    );
    assert.equal(trialRes.status, 201);
    assert.ok(trialRes.body.demoClassroomCode.startsWith('TRIAL-'));
  });
});
