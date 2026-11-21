/**
 * INTEGRATION & UNIT VERIFICATION — 30 CẢI TIẾN MỚI VÒNG 2 (SAT.Guru)
 * Khóa vĩnh viễn các chốt bảo mật P0, thanh toán, IRT 2PL, Leitner/Trap Variant,
 * Bluebook helpers, Native SVG QR, Domain Clustering, B2B Center Plans & Content Gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resetDb, setCurrentUser, postJson, readRes } from './harness.mjs';

import { POST as speedQuizEndPost } from '@/app/api/speed-quiz/end/route';
import { POST as libraryPost } from '@/app/api/library/route';
import { GET as cleanupCronGet } from '@/app/api/cron/cleanup-issued/route';
import { GET as parentDigestCronGet } from '@/app/api/cron/parent-weekly-digest/route';
import { computeExamScore } from '@/lib/exam-scoring';
import { calibrateDifficultyByLeitner, buildVariantRequest } from '@/lib/mistake-variant';
import { recommendNext } from '@/lib/adaptive';
import {
  evaluateInExamPacing,
  computeHighlightOffsets,
  slicePassageByHighlights,
  inspectReviewQuestionStatus,
  classifyRootCause,
} from '@/lib/exam-runner-helpers';
import { encodeQrMatrix, qrMatrixToSvgPath } from '@/lib/qr-svg';
import { CENTER_BULK_PLANS, SCORE_GUARANTEE_POLICY } from '@/lib/subscription';
import { checkWebhookTimestampAnomaly } from '@/lib/telemetry';
import { isPublicPath } from '@/lib/supabase/middleware';

test('V2 #1 [P0]: speed-quiz/end CHẶN client-answer spoofing 100%', async () => {
  resetDb();
  setCurrentUser({ id: 'sq-cheat-user' });
  const src = fs.readFileSync(path.join(process.cwd(), 'src/app/api/speed-quiz/end/route.ts'), 'utf8');
  assert.ok(!src.includes('verifiedAnswersCount'), 'Đã xóa nhánh verifiedAnswersCount từ client');
  assert.ok(!src.includes('matchesAnswer('), 'Không còn tự khớp đáp án từ body client');
  const res = await speedQuizEndPost(
    postJson({
      sessionId: 'non-existent-session',
      answers: Array.from({ length: 20 }, () => ({ userAnswer: 'A', correctAnswer: 'A' })),
    })
  );
  const { body } = await readRes(res);
  assert.equal(body.correctCount, 0, 'Payload spoofing từ client không được cộng câu đúng');
  assert.equal(body.rewardCoins, 0, 'Không thưởng xu khi server không xác nhận');
});

test('V2 #2 [P0]: admin/orders dùng nguồn sự thật duy nhất payment_transactions', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/app/api/admin/orders/route.ts'), 'utf8');
  assert.ok(src.includes("from('payment_transactions')"), 'Admin orders truy vấn payment_transactions');
  assert.ok(src.includes('confirmPaymentAtomic'), 'Admin approve đi qua confirmPaymentAtomic nguyên tử');
  assert.ok(!src.includes("from('payment_orders')"), 'Không còn truy vấn lệch bảng payment_orders');
});

test('V2 #3 [P0]: POST /api/library chặn Guest (401) và chặn Free user mở đề Pro (403)', async () => {
  resetDb();
  setCurrentUser(null);
  const rGuest = await readRes(await libraryPost(postJson({ id: 'mock_sat_1::q1' })));
  assert.equal(rGuest.status, 401, 'Guest chưa đăng nhập bị chặn 401');

  setCurrentUser({ id: 'free-user-tier-check' });
  const rPro = await readRes(await libraryPost(postJson({ id: 'mock_sat_2::q1' })));
  assert.equal(rPro.status, 403, 'Free user mở đề Pro mock_sat_2 bị chặn 403');
  assert.equal(rPro.body.code, 'PRO_EXAM_REQUIRED');
});

test('V2 #4 & #25: Cron cleanup-issued & parent-weekly-digest fail-closed khi sai CRON_SECRET', async () => {
  const prev = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-secret-v2-strong';
  try {
    const reqBad = new Request('http://localhost/api/cron/cleanup-issued', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const r1 = await cleanupCronGet(reqBad);
    assert.equal(r1.status, 401);

    const reqBad2 = new Request('http://localhost/api/cron/parent-weekly-digest', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const r2 = await parentDigestCronGet(reqBad2);
    assert.equal(r2.status, 401);
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }
});

test('V2 #6 & #7: Middleware tách Exact vs Prefix (/teacher/* khóa) & next.config.ts có CSP', () => {
  assert.equal(isPublicPath('/teacher'), true, '/teacher landing vẫn mở');
  assert.equal(isPublicPath('/teacher/classes'), false, '/teacher/classes phải đăng nhập');
  assert.equal(isPublicPath('/api/teacher/classrooms'), false, '/api/teacher/* phải đăng nhập');

  const cfg = fs.readFileSync(path.join(process.cwd(), 'next.config.ts'), 'utf8');
  assert.ok(cfg.includes('Content-Security-Policy'), 'Có header CSP trong next.config.ts');
  assert.ok(cfg.includes('https://www.desmos.com'), 'CSP whitelist Desmos');
});

test('V2 #8: Webhook timestamp anomaly phát hiện lệch >24h mà không throw', () => {
  assert.equal(checkWebhookTimestampAnomaly('vnpay', 'ORD-OLD', '20200101120000'), true);
  assert.equal(checkWebhookTimestampAnomaly('payos', 'ORD-NOW', new Date().toISOString()), false);
});

test('V2 #10: computeExamScore nối IRT 2PL EAP — làm đúng câu Hard điểm cao hơn câu Easy', () => {
  const diffs = { q1: 'Easy', q2: 'Easy', q3: 'Hard', q4: 'Hard' };
  const correct = { q1: 'A', q2: 'A', q3: 'A', q4: 'A' };
  const scoreHardRight = computeExamScore(
    { answers: { q1: 'B', q2: 'B', q3: 'A', q4: 'A' }, correctAnswers: correct, difficulties: diffs },
    { answers: {}, correctAnswers: {} },
    { answers: { q1: 'A' }, correctAnswers: { q1: 'A' }, difficulties: { q1: 'Hard' } },
    { answers: {}, correctAnswers: {} },
    'hard',
    'hard'
  );
  const scoreEasyRight = computeExamScore(
    { answers: { q1: 'A', q2: 'A', q3: 'B', q4: 'B' }, correctAnswers: correct, difficulties: diffs },
    { answers: {}, correctAnswers: {} },
    { answers: { q1: 'A' }, correctAnswers: { q1: 'A' }, difficulties: { q1: 'Hard' } },
    { answers: {}, correctAnswers: {} },
    'hard',
    'hard'
  );
  assert.equal(scoreHardRight.rw.scoringMethod, 'irt-2pl');
  assert.ok(scoreHardRight.rw.scaled >= scoreEasyRight.rw.scaled, 'Đúng câu Hard phải có điểm IRT >= đúng câu Easy');
});

test('V2 #12, #13, #15, #16: Bluebook Pacing, RootCause, Highlight Offset & SPR Review', () => {
  assert.equal(evaluateInExamPacing(50, 'rw').level, 'normal');
  assert.equal(evaluateInExamPacing(80, 'rw').level, 'nudge');
  assert.equal(evaluateInExamPacing(120, 'rw').level, 'trap');

  assert.equal(classifyRootCause(15), 'Careless / Rushed');
  assert.equal(classifyRootCause(110), 'Trap / Time-Trap');
  assert.equal(classifyRootCause(55), 'Conceptual Gap');

  const passage = 'The cat sat on the mat. The cat ran.';
  const r1 = computeHighlightOffsets(passage, 'The cat', []);
  assert.deepEqual(r1, { startOffset: 0, endOffset: 7 });
  const r2 = computeHighlightOffsets(passage, 'The cat', [{ id: '1', text: 'The cat', color: 'yellow', ...r1 }]);
  assert.deepEqual(r2, { startOffset: 24, endOffset: 31 });
  const slices = slicePassageByHighlights(passage, [{ id: '2', text: 'The cat', color: 'green', ...r2 }]);
  assert.equal(slices.length, 3);
  assert.equal(slices[1].text, 'The cat');

  const sprBad = inspectReviewQuestionStatus('1/0', true, () => ({ isValid: false, errorMessage: 'Mẫu số bằng 0' }));
  assert.equal(sprBad.isSpr, true);
  assert.equal(sprBad.hasSprSyntaxError, true);
});

test('V2 #14: Leitner-Aware & Trap-Replication Variant Engine', () => {
  assert.equal(calibrateDifficultyByLeitner('Hard', 1), 'Medium');
  assert.equal(calibrateDifficultyByLeitner('Easy', 5), 'Hard');

  const req = buildVariantRequest(
    { id: 'algebra.linear_eq', moduleType: 'math', label: 'Linear Equations' },
    'Easy',
    { leitnerBox: 4, targetTrapType: 'sign-error', userWrongChoice: '-5' }
  );
  assert.ok(req);
  assert.equal(req.difficulty, 'Hard');
  assert.equal(req.targetTrapType, 'sign-error');
  assert.ok(req.trapPromptHint?.includes('-5'));
});

test('V2 #17: Domain-Clustered Adaptive Path ưu tiên gom cụm domain tránh nhảy ngữ cảnh', () => {
  const summary = {
    overall: 40,
    bySubject: { math: 40, reading: 40 },
    domains: [],
    skills: [
      { id: 's1', label: 'Reading Main Idea', subject: 'reading', moduleType: 'literature', score: 30, attempts: 2, mastered: false },
      { id: 's2', label: 'Algebra Linear', subject: 'math', moduleType: 'math', score: 38, attempts: 2, mastered: false },
    ],
  };
  const clustered = recommendNext(summary, { currentDomainFocus: 'math' });
  assert.equal(clustered?.skillId, 's2', 'Ưu tiên giữ mạch trong cụm domain math (38 - 18 = 20 < 30)');
});

test('V2 #20: Native ISO SVG QR Code chuẩn MSB-first (0x77C4), 0 phụ thuộc api.qrserver.com', () => {
  const matrix = encodeQrMatrix('https://satguru.edu.vn/parent?code=SAT2026');
  const n = matrix.length;
  assert.ok(n >= 25, 'Ma trận QR Version >= 2');
  // Kiểm tra bit Format Info MSB-first cho EC=L (01), Mask=0 → 0x77C4 = 111011111000100
  assert.equal(matrix[8][0], true, 'Format bit 14 (MSB) tại (8,0) phải = 1');
  assert.equal(matrix[8][3], false, 'Format bit 11 tại (8,3) phải = 0');
  assert.equal(matrix[n - 8][8], true, 'Dark module tại (n-8,8) phải = 1');
  assert.equal(matrix[8][n - 8], matrix[8][8], 'Format bit 7 tại (8,n-8) khớp bản sao (8,8)');
  const { viewBox, path: d } = qrMatrixToSvgPath(matrix);
  assert.equal(viewBox, n + 8, 'Quiet zone chuẩn ISO = 4 mỗi cạnh');
  assert.ok(d.length > 200);

  const sharePage = fs.readFileSync(path.join(process.cwd(), 'src/app/parent-share/page.tsx'), 'utf8');
  assert.ok(!sharePage.includes('https://api.qrserver.com'), 'Đã loại bỏ hoàn toàn URL gọi api.qrserver.com');
});

test('V2 #22 & #23: Teacher Assignments Route & RLS SECURITY DEFINER không đệ quy', () => {
  assert.ok(
    fs.existsSync(path.join(process.cwd(), 'src/app/api/teacher/assignments/route.ts')),
    'File src/app/api/teacher/assignments/route.ts phải tồn tại'
  );
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20261121_v2_classrooms_and_cleanup.sql'),
    'utf8'
  );
  assert.ok(sql.includes('SECURITY DEFINER'), 'RLS dùng SECURITY DEFINER chống đệ quy 42P17');
  assert.ok(sql.includes('is_classroom_teacher') && sql.includes('is_classroom_member'));
});

test('V2 #25 & #29: B2B Center Bulk Plans, Score Guarantee & PWA Manifest tồn tại', () => {
  assert.equal(CENTER_BULK_PLANS.length, 3);
  assert.equal(SCORE_GUARANTEE_POLICY.minGainPoints, 100);
  const manifestPath = path.join(process.cwd(), 'public/manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'Có public/manifest.json chuẩn PWA');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.display, 'standalone');
});
