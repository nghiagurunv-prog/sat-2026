/**
 * INTEGRATION & CONTRACT TESTS — Round 3 Deep Audit Fixes (Wave V3-P0 → V3-P2)
 * Khóa chặt toàn bộ bất biến bảo mật, tài chính, IRT scoring & UI contract mới vá.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  resetDb,
  setCurrentUser,
  seed,
  getRows,
  postJson,
  readRes,
} from './harness.mjs';
import { POST as vocabPost } from '@/app/api/vocab/route';
import { POST as gatePost } from '@/app/api/gate-exam/route';
import { POST as aiCostPost } from '@/app/api/admin/ai-cost/route';
import { POST as hintPost } from '@/app/api/hint/route';
import { DELETE as sessionDelete } from '@/app/api/auth/session/route';
import { POST as speedQuizPost } from '@/app/api/speed-quiz/question/route';
import { POST as examSubmitPost } from '@/app/api/exam-session/submit/route';
import { POST as examGradePost } from '@/app/api/exams/grade/route';
import { POST as stripeWebhookPost } from '@/app/api/payment/stripe-webhook/route';
import { GET as paymentReturnGet } from '@/app/api/payment/return/route';
import { addMistake } from '@/lib/mistakes-store';
import { chatCacheHash } from '@/lib/chat-cache';

const ROOT = process.cwd();

test('V3-P0 #1: /api/vocab POST chặn guest chưa đăng nhập (401)', async () => {
  resetDb();
  setCurrentUser(null);
  const { status } = await readRes(
    await vocabPost(postJson({ wordId: 'custom-guest', word: 'ephemeral', isRemembered: true }))
  );
  assert.equal(status, 401);
});

test('V3-P0 #1: /api/vocab POST đóng faucet xu vô hạn khi tạo từ mới (isNewWord → 0 xu)', async () => {
  resetDb();
  setCurrentUser({ id: 'v3-faucet' });
  seed('user_economy', { user_id: 'v3-faucet', coins: 100, xp: 0, inventory: [], last_spin_date: null });
  seed('user_vocab_srs', { user_id: 'v3-faucet', words: [] });

  const { status, body } = await readRes(
    await vocabPost(
      postJson({
        wordId: 'custom-spam-1',
        word: 'ubiquitous',
        meaning: 'phổ biến khắp nơi',
        isRemembered: true,
      })
    )
  );
  assert.equal(status, 200);
  assert.deepEqual(body.granted, { coins: 0, xp: 0 }, 'tạo từ mới KHÔNG được cộng xu/XP');
  assert.equal(getRows('user_economy')[0].coins, 100, 'số dư không tăng khi auto-upsert');
});

test('V3-P0 #1: /api/vocab POST không tin correctAnswer giả mạo từ client', async () => {
  resetDb();
  setCurrentUser({ id: 'v3-spoof-ans' });
  seed('user_economy', { user_id: 'v3-spoof-ans', coins: 100, xp: 0, inventory: [], last_spin_date: null });
  seed('user_vocab_srs', {
    user_id: 'v3-spoof-ans',
    words: [{ id: 'w1', word: 'ubiquitous', meaning: 'khắp nơi', box: 1, next_review: '2020-01-01' }],
  });

  const { status, body } = await readRes(
    await vocabPost(
      postJson({
        wordId: 'w1',
        userAnswer: 'wrong-guess',
        correctAnswer: 'wrong-guess', // client tự bịa khớp nhau
      })
    )
  );
  assert.equal(status, 200);
  assert.deepEqual(body.granted, { coins: 0, xp: 0 }, 'đáp án sai so với server → không thưởng');
  assert.equal(body.word.box, 1, 'không được thăng box khi trả lời sai');
});

test('V3-P0 #2: /api/gate-exam POST bỏ qua correctAns client bịa trong body.answers', async () => {
  resetDb();
  setCurrentUser({ id: 'v3-gate' });
  seed('user_mastery', {
    user_id: 'v3-gate',
    skills: {
      'algebra.linear_eq': { score: 80, attempts: 10, correct: 8 },
      'algebra.linear_fn': { score: 80, attempts: 10, correct: 8 },
      'algebra.systems': { score: 80, attempts: 10, correct: 8 },
      'algebra.inequalities': { score: 80, attempts: 10, correct: 8 },
    },
  });
  const ids = ['g1', 'g2', 'g3', 'g4', 'g5'];
  for (const id of ids) {
    seed('issued_questions', {
      id,
      user_id: 'v3-gate',
      correct_choice: 'A',
      skill_id: 'algebra.linear_eq',
      difficulty: 'Hard',
      answered: false,
      was_correct: false,
      context: JSON.stringify({ src: 'gate' }),
    });
  }

  // Client gửi đáp án sai 'B' nhưng tự bịa correctAns='B' cho cả 5 câu
  const { status, body } = await readRes(
    await gatePost(
      postJson({
        domain: 'algebra',
        questionIds: ids,
        answers: ids.map((id) => ({ questionId: id, userAns: 'B', correctAns: 'B' })),
      })
    )
  );
  assert.equal(status, 200);
  assert.equal(body.result.score, 0, 'server chỉ chấm theo issued_questions (đáp án thật A)');
  assert.equal(body.result.passed, false);
});

test('V3-P0 #3: /api/admin/ai-cost POST rate-limit brute-force sau 10 lần sai (429)', async () => {
  resetDb();
  setCurrentUser({ id: 'not-admin' });
  const prevSecret = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = 'super-secret-v3-test';
  try {
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const req = new Request('http://localhost/api/admin/ai-cost', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.77',
          'x-admin-secret': `wrong-${i}`,
        },
        body: JSON.stringify({ action: 'reset' }),
      });
      const res = await aiCostPost(req);
      lastStatus = res.status;
    }
    assert.equal(lastStatus, 429, 'POST sai quá 10 lần/phút phải bị khóa 429');
  } finally {
    if (prevSecret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = prevSecret;
  }
});

test('V3-P1 #2: /api/hint POST gửi tier=3 vẫn xóa cụm lộ đáp án & không trả correct_choice', async () => {
  resetDb();
  setCurrentUser({ id: 'v3-hint' });
  seed('issued_questions', {
    id: 'hq-tier3',
    user_id: 'v3-hint',
    correct_choice: 'B',
    skill_id: 'algebra.linear_eq',
    difficulty: 'Hard',
    answered: false,
    was_correct: false,
    context: JSON.stringify({
      src: 'bank',
      ca: [
        { choice_letter: 'A', is_correct: false, analysis: 'Bẫy dấu âm. Đáp án đúng là B.' },
        { choice_letter: 'B', is_correct: true, analysis: 'Đúng hoàn toàn.' },
      ],
    }),
  });

  const { status, body } = await readRes(await hintPost(postJson({ questionId: 'hq-tier3', tier: 3 })));
  assert.equal(status, 200);
  assert.equal(body.correctAnswer, undefined);
  assert.equal(body.correct_choice, undefined);
  assert.ok(!String(body.analysis).includes('Đáp án đúng là B'), 'không được lộ đáp án trực tiếp dù gửi tier=3');
});

test('V3-P2 #2: /api/auth/session DELETE trả 404 ngoài chế độ E2E', async () => {
  const prev = process.env.E2E_TEST_MODE;
  delete process.env.E2E_TEST_MODE;
  try {
    const { status } = await readRes(await sessionDelete());
    assert.equal(status, 404);
  } finally {
    if (prev !== undefined) process.env.E2E_TEST_MODE = prev;
  }
});

test('V3-P2 #1: /api/speed-quiz/question POST chấm server-side, chặn giả mạo correctAnswer', async () => {
  resetDb();
  setCurrentUser({ id: 'v3-sq' });
  seed('issued_questions', {
    id: 'sq-1',
    user_id: 'v3-sq',
    correct_choice: 'C',
    skill_id: 'algebra.linear_eq',
    difficulty: 'Medium',
    answered: false,
    was_correct: false,
    context: JSON.stringify({ src: 'bank' }),
  });

  const { status, body } = await readRes(
    await speedQuizPost(postJson({ questionId: 'sq-1', userAnswer: 'A', correctAnswer: 'A' }))
  );
  assert.equal(status, 200);
  assert.equal(body.isCorrect, false, 'không tin correctAnswer từ client');
  assert.equal(body.correctChoice, 'C');
});

test('V3-P0 #4: /api/exams/grade & /api/exam-session/submit trả IRT 2PL scaledScore/theta/se', async () => {
  resetDb();
  setCurrentUser({ id: 'v3-irt' });
  seed('user_economy', { user_id: 'v3-irt', coins: 100, xp: 0, inventory: [], last_spin_date: null });

  seed('issued_questions', {
    id: 'irt-q1',
    user_id: 'v3-irt',
    correct_choice: 'A',
    skill_id: 'algebra.linear_eq',
    difficulty: 'Hard',
    answered: false,
    was_correct: false,
    context: JSON.stringify({ src: 'exam' }),
  });
  seed('issued_questions', {
    id: 'irt-q2',
    user_id: 'v3-irt',
    correct_choice: 'B',
    skill_id: 'algebra.linear_fn',
    difficulty: 'Easy',
    answered: false,
    was_correct: false,
    context: JSON.stringify({ src: 'exam' }),
  });

  const gradeRes = await readRes(
    await examGradePost(
      postJson({
        answers: [
          { questionId: 'irt-q1', answer: 'A' },
          { questionId: 'irt-q2', answer: 'C' },
        ],
      })
    )
  );
  assert.equal(gradeRes.status, 200);
  assert.equal(gradeRes.body.scoringMethod, 'irt-2pl');
  assert.equal(typeof gradeRes.body.scaledScore, 'number');
  assert.ok(gradeRes.body.scaledScore >= 200 && gradeRes.body.scaledScore <= 800);
  assert.equal(typeof gradeRes.body.theta, 'number');

  // Kiểm tra tương tự ở /api/exam-session/submit (Module 2)
  seed('issued_questions', {
    id: 'irt-m2-q1',
    user_id: 'v3-irt',
    correct_choice: 'D',
    skill_id: 'algebra.systems',
    difficulty: 'Hard',
    answered: false,
    was_correct: false,
    context: JSON.stringify({ src: 'exam' }),
  });
  const submitRes = await readRes(
    await examSubmitPost(
      postJson({
        section: 'math',
        moduleNum: 2,
        answers: [{ questionId: 'irt-m2-q1', answer: 'D' }],
      })
    )
  );
  assert.equal(submitRes.status, 200);
  assert.equal(submitRes.body.score?.scoringMethod, 'irt-2pl');
  assert.equal(typeof submitRes.body.moduleResult?.scaledScore, 'number');
});

test('V3-P1 #5: /api/payment/stripe-webhook chặn currency != vnd (HTTP 200, KHÔNG cấp gói)', async () => {
  resetDb();
  const prevSk = process.env.STRIPE_SECRET_KEY;
  const prevWh = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_v3_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_v3_test_secret';

  try {
    const payload = JSON.stringify({
      id: 'evt_test_usd',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_usd',
          payment_status: 'paid',
          currency: 'usd',
          amount_total: 100,
          metadata: { orderId: 'ORD-USD-01' },
          payment_intent: 'pi_test_usd',
        },
      },
    });
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto
      .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
      .update(`${ts}.${payload}`)
      .digest('hex');

    const req = new Request('http://localhost/api/payment/stripe-webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=${ts},v1=${sig}`,
      },
      body: payload,
    });
    const { status, body } = await readRes(await stripeWebhookPost(req));
    assert.equal(status, 200);
    assert.equal(body.reason, 'currency_mismatch');
  } finally {
    if (prevSk === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prevSk;
    if (prevWh === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = prevWh;
  }
});

test('V3-P1 #6: /api/payment/return nhận diện mã hủy/lỗi VNPay & MoMo', async () => {
  resetDb();
  const rVnpCancel = await paymentReturnGet(
    new Request('http://localhost:3000/api/payment/return?vnp_TxnRef=ORD123&vnp_ResponseCode=24')
  );
  assert.ok(rVnpCancel.headers.get('location')?.includes('status=cancelled'));

  const rVnpFail = await paymentReturnGet(
    new Request('http://localhost:3000/api/payment/return?vnp_TxnRef=ORD124&vnp_ResponseCode=51')
  );
  assert.ok(rVnpFail.headers.get('location')?.includes('status=failed'));

  const rMomoCancel = await paymentReturnGet(
    new Request('http://localhost:3000/api/payment/return?orderId=ORD125&resultCode=1006')
  );
  assert.ok(rMomoCancel.headers.get('location')?.includes('status=cancelled'));
});

test('V3-P1 #7: mistakes-store.addMistake xử lý an toàn non-UUID id & chống trùng theo question', async () => {
  resetDb();
  setCurrentUser({ id: 'v3-mistake-user' });
  const m1 = await addMistake('v3-mistake-user', {
    id: 'q-non-uuid-01',
    question: 'What is 2x + 3 = 7?',
    choices: ['1', '2', '3', '4'],
    correct_choice: '2',
    user_choice: '3',
  });
  assert.ok(m1, 'lưu câu sai lần 1 thành công');

  const m2 = await addMistake('v3-mistake-user', {
    id: 'q-non-uuid-02',
    question: 'What is 2x + 3 = 7?',
    choices: ['1', '2', '3', '4'],
    correct_choice: '2',
    user_choice: '3',
  });
  assert.ok(m2);
  assert.equal(getRows('user_mistakes').length, 1, 'không nhân bản câu trùng question khi id là non-UUID');
});

test('V3-P2 #10: chatCacheHash giữ tương thích ngược & tách khoang theo targetBand', () => {
  const base = {
    question: 'Solve x + 1 = 3',
    correctAnswer: '2',
    selectedAnswer: '1',
    userMessage: 'Giải thích giúp em',
    model: 'gpt-4o-mini',
  };
  assert.equal(chatCacheHash(base), chatCacheHash({ ...base, targetBand: '' }));
  assert.notEqual(
    chatCacheHash({ ...base, targetBand: 'sub1300' }),
    chatCacheHash({ ...base, targetBand: '1500+' })
  );
});

test('V3-P0 #6 & V3-P1 #9: Hợp đồng UI library, admin, dashboard và ExamRunner', () => {
  const librarySrc = fs.readFileSync(path.join(ROOT, 'src/app/library/page.tsx'), 'utf8');
  assert.ok(librarySrc.includes('PRO_EXAM_REQUIRED'), 'library xử lý mã khóa PRO_EXAM_REQUIRED');
  assert.ok(librarySrc.includes('isLocked'), 'library hiển thị trạng thái isLocked');
  assert.ok(librarySrc.includes('min-w-[44px] min-h-[44px]'), 'nút bookmark đạt chuẩn chạm WCAG 44x44');

  const adminSrc = fs.readFileSync(path.join(ROOT, 'src/app/admin/page.tsx'), 'utf8');
  assert.ok(adminSrc.includes('/api/admin/orders'), 'admin gọi thật /api/admin/orders');
  assert.ok(!adminSrc.includes('queueMicrotask(load)'), 'đã bỏ queueMicrotask(load) khỏi useEffect');
  assert.ok(!/createdAt:\s*new Date\(Date\.now\(\)/.test(adminSrc), 'không còn Date.now() trong initial transactions');
  assert.ok(!/reportedAt:\s*new Date\(Date\.now\(\)/.test(adminSrc), 'không còn Date.now() trong initial reports');

  const runnerSrc = fs.readFileSync(path.join(ROOT, 'src/components/ExamRunner.tsx'), 'utf8');
  assert.ok(runnerSrc.includes('interface PassageHighlight'), 'giữ nguyên interface PassageHighlight (#G2)');
  assert.ok(runnerSrc.includes('slicePassageByHighlights'), 'ExamRunner dùng slicePassageByHighlights cho highlight theo offset');

  const dashSrc = fs.readFileSync(path.join(ROOT, 'src/app/dashboard/page.tsx'), 'utf8');
  assert.ok(dashSrc.includes('new AbortController()'), 'dashboard dùng AbortController tránh race unmount');
  assert.ok(dashSrc.includes('/api/teacher/classrooms'), 'dashboard có luồng học sinh tham gia lớp học');
});

test('T2 Audit P0: /api/exam-session/submit fallback đề tĩnh tuyệt đối KHÔNG thưởng xu/XP (0 faucet)', async () => {
  resetDb();
  setCurrentUser({ id: 'v3-static-nofaucet' });
  seed('user_economy', { user_id: 'v3-static-nofaucet', coins: 100, xp: 0, inventory: [], last_spin_date: null });

  // Nộp questionId đề tĩnh chưa qua issueQuestion → vẫn chấm điểm local-first nhưng granted = { coins: 0, xp: 0 }
  const { status, body } = await readRes(
    await examSubmitPost(
      postJson({
        section: 'math',
        moduleNum: 2,
        examId: 'sat-mock-01',
        answers: [{ questionId: 'm1_m2_q1', answer: 'A' }],
      })
    )
  );
  assert.equal(status, 200);
  assert.deepEqual(body.granted, { coins: 0, xp: 0 }, 'fallback đề tĩnh không CAS → không cộng xu/XP');
  assert.equal(getRows('user_economy')[0].coins, 100);
});

test('T2 Audit P2: /api/gate-exam POST từ chối mảng questionIds trùng lặp (400)', async () => {
  resetDb();
  setCurrentUser({ id: 'v3-gate-dup' });
  const { status } = await readRes(
    await gatePost(
      postJson({
        domain: 'algebra',
        questionIds: ['g1', 'g1', 'g1', 'g1', 'g1'],
      })
    )
  );
  assert.equal(status, 400);
});
