/**
 * INTEGRATION & QUALITY GATE — Wave P0–P2 Security, Anti-Cheat, IRT & Bilingual Data Gate
 * Xác minh toàn bộ các lỗ hổng P0–P2 đã được đóng kín vĩnh viễn:
 *  1. Chặn backdoor item.correctAns tại /api/exams/grade
 *  2. Strip triệt để explanation_vi & đáp án tại /api/exams/start (#G7)
 *  3. Cấm import mock_exams.json / correctIndex trong client page /exams/[id] (#G7)
 *  4. Chặn guest local-default-user dùng chung bucket rate-limit (DoS chéo)
 *  5. Khóa bảo vệ /api/ai-tutor chống AI wallet drain (#G9)
 *  6. Cron /api/cron mở trên middleware PUBLIC_PREFIXES & so sánh CRON_SECRET timing-safe (#G6)
 *  7. Admin orders chống Double-Approve (CAS) & chống PostgREST filter injection
 *  8. Đóng khe hở khoảng điểm SAT 1241-1249 trong /api/scholarship-match
 *  9. Cầu nối IRT 2PL calibrateQuestionIrt + Data Quality Gate 100% explanation_vi & KaTeX cân bằng
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetDb, setCurrentUser, seed, getRows, postJson, readRes } from './harness.mjs';
import { POST as gradeExam } from '@/app/api/exams/grade/route';
import { POST as startExam } from '@/app/api/exams/start/route';
import { GET as scholarshipGet } from '@/app/api/scholarship-match/route';
import { getRateLimitKey } from '@/lib/rate-limit';
import { calibrateQuestionIrt, estimateThetaEAP } from '@/lib/irt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

function readText(relPath) {
  return fs.readFileSync(path.join(projectRoot, relPath), 'utf8');
}

describe('Wave P0 Security — Anti-Cheat & Answer Leak Prevention (#G7)', () => {
  test('exams/grade: CHẶN backdoor client tự gửi item.correctAns === answer', async () => {
    resetDb();
    setCurrentUser({ id: 'u-anticheat' });
    seed('user_economy', { user_id: 'u-anticheat', coins: 100, xp: 0, inventory: [], last_spin_date: null });
    seed('issued_questions', {
      id: 'q-real',
      user_id: 'u-anticheat',
      correct_choice: 'C',
      skill_id: null,
      difficulty: 'Hard',
      answered: false,
      was_correct: null,
      context: null,
    });

    // Kẻ tấn công chọn đáp án SAI 'A' nhưng nhồi thêm correctAns: 'A'
    const { status, body } = await readRes(
      await gradeExam(
        postJson({
          answers: [{ questionId: 'q-real', answer: 'A', userAns: 'A', correctAns: 'A' }],
        })
      )
    );
    assert.equal(status, 200);
    assert.equal(body.graded, 1);
    assert.equal(body.correct, 0, 'KHÔNG được tin item.correctAns từ client');
    assert.deepEqual(body.granted, { coins: 0, xp: 0 });
    assert.equal(getRows('user_economy')[0].coins, 100);
  });

  test('exams/start: strip 100% correct_choice, explanation và explanation_vi trước khi thi', async () => {
    resetDb();
    setCurrentUser({ id: 'u-start-strip' });
    const { status, body } = await readRes(
      await startExam(postJson({ examId: 'mock_sat_1', mode: 'mock' }))
    );
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.modules) && body.modules.length > 0);
    for (const mod of body.modules) {
      for (const q of mod.questions) {
        assert.equal(q.correct_choice, undefined, 'Cấm lộ correct_choice');
        assert.equal(q.correctAnswer, undefined, 'Cấm lộ correctAnswer');
        assert.equal(q.correctIndex, undefined, 'Cấm lộ correctIndex');
        assert.equal(q.explanation, undefined, 'Cấm lộ explanation');
        assert.equal(q.explanation_vi, undefined, 'Cấm lộ explanation_vi (#G7)');
        assert.equal(q.choice_analysis, undefined, 'Cấm lộ choice_analysis');
      }
    }
  });

  test('exams/[id]/page.tsx: KHÔNG import mock_exams.json (1.1MB) hay chứa correctIndex ở client', () => {
    const content = readText('src/app/exams/[id]/page.tsx');
    assert.ok(!/from\s+['"][^'"]*mock_exams\.json['"]/.test(content), 'Client page không được import mock_exams.json');
    assert.ok(!/from\s+['"][^'"]*diagnostic_questions\.json['"]/.test(content), 'Client page không được import diagnostic_questions.json');
    assert.ok(!/correctIndex/.test(content), 'Client page không được chứa correctIndex');
    assert.match(content, /\/api\/exams\/start/, 'Phải nạp đề bảo mật qua /api/exams/start');
    assert.match(content, /\/api\/exams\/grade/, 'Phải chấm bài server-side qua /api/exams/grade');
  });
});

describe('Wave P1 Security — Rate Limit, AI Wallet Guard, Cron, Admin & XSS', () => {
  test('rate-limit: local-default-user phải định tuyến sang IP thay vì bucket chung', () => {
    const req1 = new Request('http://test/api/chat', { headers: { 'x-real-ip': '10.0.0.1' } });
    const req2 = new Request('http://test/api/chat', { headers: { 'x-real-ip': '10.0.0.2' } });
    const k1 = getRateLimitKey(req1, 'ai-chat', 'local-default-user');
    const k2 = getRateLimitKey(req2, 'ai-chat', 'local-default-user');
    assert.equal(k1, 'ai-chat:ip:10.0.0.1');
    assert.equal(k2, 'ai-chat:ip:10.0.0.2');
    assert.notEqual(k1, k2, '2 khách vãng lai khác IP không được khóa lẫn nhau');

    const kAuth = getRateLimitKey(req1, 'ai-chat', 'user-uuid-123');
    assert.equal(kAuth, 'ai-chat:u:user-uuid-123');
  });

  test('ai-tutor/route.ts: có đủ chốt Auth + RateLimit + Cache + Budget + Quota (#G9)', () => {
    const content = readText('src/app/api/ai-tutor/route.ts');
    assert.match(content, /getCurrentUser/);
    assert.match(content, /rateLimit\(/);
    assert.match(content, /getCachedReply/);
    assert.match(content, /checkBudget/);
    assert.match(content, /reserveQuota/);
    assert.match(content, /ai-tutor-guest-daily/);
  });

  test('middleware & cron: /api/cron có trong PUBLIC_PREFIXES và dùng safeEqual timing-safe (#G6)', () => {
    const mw = readText('src/lib/supabase/middleware.ts');
    const cron = readText('src/app/api/cron/settle-speed-quiz/route.ts');
    assert.match(mw, /'\/api\/cron'/);
    assert.match(cron, /safeEqual\(/);
    assert.ok(!/auth\s*!==\s*`Bearer/.test(cron), 'Cấm so sánh chuỗi thô CRON_SECRET');
  });

  test('admin/orders: có chốt chống Double-Approve (CAS) & validate orderId chống injection', () => {
    const orders = readText('src/app/api/admin/orders/route.ts');
    assert.match(orders, /order\.status === 'paid'/);
    assert.match(orders, /\.neq\('status', 'paid'\)/);
    assert.match(orders, /safeIdPattern/);
  });

  test('mistakes/page.tsx: KaTeX fallback không đưa chuỗi thô vào dangerouslySetInnerHTML (chống XSS)', () => {
    const mistakes = readText('src/app/mistakes/page.tsx');
    assert.match(mistakes, /trust:\s*false/);
    assert.ok(!/catch\s*\{\s*return\s+math;\s*\}/.test(mistakes), 'Cấm trả chuỗi raw math vào dangerouslySetInnerHTML');
  });
});

describe('Wave P2 — Scholarship Gap, IRT 2PL Bridge & Bilingual Data Quality Gate (#G7)', () => {
  test('scholarship-match: điểm SAT 1245 không bị rơi khe hở giữa 1240 và 1250', async () => {
    const res = await scholarshipGet(new Request('http://test/api/scholarship-match?sat=1245&gpa=8.8'));
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.usScholarship.currentTier.id, 'us_foundation');
    assert.equal(data.usScholarship.currentTier.matched, true);
  });

  test('irt: calibrateQuestionIrt ánh xạ Easy/Medium/Hard sang (a, b) và chạy EAP hợp lệ', () => {
    const easy = calibrateQuestionIrt('Easy');
    const med = calibrateQuestionIrt('Medium');
    const hard = calibrateQuestionIrt('Hard');
    assert.ok(easy.b < med.b && med.b < hard.b, 'Độ khó b phải tăng dần Easy < Medium < Hard');
    const eap = estimateThetaEAP([
      { ...easy, correct: true },
      { ...med, correct: true },
      { ...hard, correct: true },
    ]);
    assert.ok(eap.satScaledScore >= 600 && eap.satScaledScore <= 800);
  });

  test('Data Quality Gate: 100% câu hỏi có explanation_vi, không lẻ dấu $ KaTeX, SPR chuẩn type', () => {
    const me = JSON.parse(readText('src/data/mock_exams.json'));
    const diag = JSON.parse(readText('src/data/diagnostic_questions.json'));
    const gh = JSON.parse(readText('src/data/golden_hour_questions.json'));

    const allQuestions = [
      ...me.exams.flatMap((ex) => ex.modules.flatMap((m) => m.questions.map((q) => ({ q, requireIrt: true, src: ex.id })))),
      ...diag.map((q) => ({ q, requireIrt: true, src: 'diagnostic' })),
      ...gh.map((q) => ({ q, requireIrt: false, src: 'golden_hour' })),
    ];

    assert.ok(allQuestions.length >= 559, 'Phải giữ nguyên đủ bộ 559 câu hỏi');

    for (const { q, requireIrt, src } of allQuestions) {
      assert.ok(
        typeof q.explanation_vi === 'string' && q.explanation_vi.trim().length > 0,
        `Thiếu explanation_vi tại ${src}/${q.id}`
      );
      if (Array.isArray(q.choices)) {
        if (q.choices.length === 0) {
          assert.equal(q.type, 'spr', `Câu tự điền ${src}/${q.id} phải có type='spr'`);
        } else {
          assert.equal(q.choices.length, 4, `Câu MCQ ${src}/${q.id} phải có đúng 4 phương án`);
        }
      }
      if (requireIrt) {
        assert.ok(q.irt && typeof q.irt.a === 'number' && typeof q.irt.b === 'number', `Thiếu IRT (a,b) tại ${src}/${q.id}`);
      }
      for (const field of ['practice_question', 'question', 'prompt', 'full_passage', 'passage', 'explanation', 'explanation_vi']) {
        const val = q[field];
        if (typeof val === 'string') {
          const dollarCount = (val.match(/(?<!\\)\$/g) || []).length;
          assert.equal(dollarCount % 2, 0, `Lẻ dấu $ KaTeX tại ${src}/${q.id}.${field}`);
        }
      }
    }
  });
});
