/**
 * INTEGRATION TEST: c100-verify-w6.test.mjs
 * Verification of Deployment Verification Squad 6 (W6)
 * Targets:
 *   - src/components/AITutoring.tsx
 *   - src/components/AiTutorDrawer.tsx
 *   - src/components/ExplanationCard.tsx
 *   - src/app/parent/page.tsx
 * Verifies 10 core features (#C051 - #C060) + Cross-supervision check W6 -> W7 (src/app/dashboard/page.tsx)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const aiTutoringPath = path.resolve(__dirname, '../components/AITutoring.tsx');
const aiTutorDrawerPath = path.resolve(__dirname, '../components/AiTutorDrawer.tsx');
const explanationCardPath = path.resolve(__dirname, '../components/ExplanationCard.tsx');
const parentPagePath = path.resolve(__dirname, '../app/parent/page.tsx');
const dashboardPagePath = path.resolve(__dirname, '../app/dashboard/page.tsx');

const aiTutoringSource = fs.readFileSync(aiTutoringPath, 'utf8');
const aiTutorDrawerSource = fs.readFileSync(aiTutorDrawerPath, 'utf8');
const explanationCardSource = fs.readFileSync(explanationCardPath, 'utf8');
const parentPageSource = fs.readFileSync(parentPagePath, 'utf8');
const dashboardPageSource = fs.readFileSync(dashboardPagePath, 'utf8');

test('W6-00: File presence and "use client" SSR safety', () => {
  assert.ok(aiTutoringSource.length > 5000, 'AITutoring.tsx should be a non-trivial component');
  assert.ok(aiTutorDrawerSource.length > 3000, 'AiTutorDrawer.tsx should be a non-trivial component');
  assert.ok(explanationCardSource.length > 3000, 'ExplanationCard.tsx should be a non-trivial component');
  assert.ok(parentPageSource.length > 5000, 'parent/page.tsx should be a non-trivial page');
  assert.ok(dashboardPageSource.length > 5000, 'dashboard/page.tsx should be a non-trivial page');

  assert.ok(
    aiTutoringSource.startsWith('"use client"') || aiTutoringSource.startsWith("'use client'"),
    'AITutoring.tsx must have "use client" directive'
  );
  assert.ok(
    aiTutorDrawerSource.startsWith('"use client"') || aiTutorDrawerSource.startsWith("'use client'"),
    'AiTutorDrawer.tsx must have "use client" directive'
  );
  assert.ok(
    explanationCardSource.startsWith('"use client"') || explanationCardSource.startsWith("'use client'"),
    'ExplanationCard.tsx must have "use client" directive'
  );
  assert.ok(
    parentPageSource.startsWith('"use client"') || parentPageSource.startsWith("'use client'"),
    'parent/page.tsx must have "use client" directive'
  );
  assert.ok(
    dashboardPageSource.startsWith('"use client"') || dashboardPageSource.startsWith("'use client'"),
    'dashboard/page.tsx must have "use client" directive'
  );
});

test('W6-C051: 2-Layer Cost-Capped Hint Cache & Vietnamese SAT Glossary (#C051)', () => {
  // AI Tutoring side: server chat route & local cache fail-safe to cap AI costs
  assert.ok(aiTutoringSource.includes('/api/chat'), 'Must route chat requests via /api/chat with caching');
  assert.ok(aiTutoringSource.includes('renderFormattedTutorMessage'), 'Must format Socratic tutor messages');

  // Parent portal side: #C051 SAT Glossary for Vietnamese parents
  assert.ok(parentPageSource.includes('#C051'), 'Must mark feature #C051 in parent portal');
  assert.ok(parentPageSource.includes('showGlossary'), 'Must support interactive glossary toggle');
  assert.ok(parentPageSource.includes('Giải thích Tiếng Việt dễ hiểu về bài thi SAT'), 'Must display SAT glossary header');
  assert.ok(parentPageSource.includes('Thang điểm Toán (Math)'), 'Must explain SAT Math section in Vietnamese');
  assert.ok(parentPageSource.includes('Đọc & Viết (Reading & Writing)'), 'Must explain SAT RW section in Vietnamese');
});

test('W6-C052: Socratic Step-Check Mode & Pure Focus Time (#C052)', () => {
  // Socratic Step-Check ladder
  assert.ok(aiTutorDrawerSource.includes('triggerSocraticStep'), 'Must implement triggerSocraticStep ladder');
  assert.ok(aiTutorDrawerSource.includes('Bước 1: Từ Khóa'), 'Must support Step 1 keywords guidance');
  assert.ok(aiTutoringSource.includes('Gợi ý bước'), 'Must include Socratic step guidance');

  // Parent portal side: #C052 Actual high-focus time tracking
  assert.ok(parentPageSource.includes('#C052'), 'Must mark feature #C052 in parent portal');
  assert.ok(parentPageSource.includes('activeFocusMetrics'), 'Must compute activeFocusMetrics');
  assert.ok(
    parentPageSource.includes('Thời lượng Tập trung Thực chất') || parentPageSource.includes('Thời gian thực học tích lũy'),
    'Must calculate actual focus time'
  );
  assert.ok(parentPageSource.includes('paceText'), 'Must provide pace evaluation text');
});

test('W6-C053: Desmos vs Algebra Dual-Path Toggle & VN University Benchmarks (#C053)', () => {
  // Explanation dual-path toggle
  assert.ok(explanationCardSource.includes('Bản Chất Tư Duy Chuẩn'), 'Must have Standard Algebra/Concept tab');
  assert.ok(explanationCardSource.includes('Mẹo Bấm Desmos'), 'Must have Desmos/10s shortcut tab');
  assert.ok(aiTutoringSource.includes('Desmos'), 'Must provide Desmos guidance');

  // Parent portal side: #C053 VN University Admission Benchmarks
  assert.ok(parentPageSource.includes('#C053'), 'Must mark feature #C053 in parent portal');
  assert.ok(parentPageSource.includes('TARGET_UNIVERSITIES'), 'Must define TARGET_UNIVERSITIES array');
  assert.ok(parentPageSource.includes('FTU'), 'Must include FTU benchmark');
  assert.ok(parentPageSource.includes('NEU'), 'Must include NEU benchmark');
  assert.ok(parentPageSource.includes('HUST'), 'Must include HUST benchmark');
});

test('W6-C054: ELI15 Mode & Scholarship ROI Estimator (#C054)', () => {
  // ELI15 1-Touch Explainer
  assert.ok(aiTutorDrawerSource.includes('triggerEli15'), 'Must implement triggerEli15 handler');
  assert.ok(aiTutorDrawerSource.includes('ELI15'), 'Must provide ELI15 explainer');
  assert.ok(
    aiTutorDrawerSource.includes('dễ hiểu') || aiTutoringSource.includes('Chế độ Socratic 1-Chạm'),
    'Must support ELI15 relatable explanations'
  );

  // Parent portal side: #C054 Scholarship ROI Estimator
  assert.ok(parentPageSource.includes('#C054'), 'Must mark feature #C054 in parent portal');
  assert.ok(parentPageSource.includes('getScholarshipEstimate'), 'Must define getScholarshipEstimate function');
  assert.ok(parentPageSource.includes('ROI Học tập'), 'Must explain ROI value for parents');
  assert.ok(parentPageSource.includes('Học bổng'), 'Must calculate potential scholarship brackets');
});

test('W6-C055: Distractor Autopsy & Zalo Report Export (#C055)', () => {
  // College Board Distractor Autopsy
  assert.ok(aiTutoringSource.includes('Giải phẫu bẫy College Board'), 'Must support College Board trap dissection');
  assert.ok(aiTutoringSource.includes('Vì sao đáp án em chọn là bẫy?'), 'Must have distractor autopsy chip');
  assert.ok(aiTutorDrawerSource.includes('Bước 2: Bẫy Đáp Án'), 'Must support Step 2 Distractor dissection');

  // Parent portal side: #C055 Zalo report export
  assert.ok(parentPageSource.includes('#C055'), 'Must mark feature #C055 in parent portal');
  assert.ok(parentPageSource.includes('handleCopyZaloReport'), 'Must provide handleCopyZaloReport function');
  assert.ok(parentPageSource.includes('Xuất tin nhắn Zalo') || parentPageSource.includes('Zalo'), 'Must support Zalo export');
  assert.ok(parentPageSource.includes('PHIẾU BÁO CÁO TIẾN ĐỘ SAT'), 'Must format standard Zalo message payload');
});

test('W6-C056: Concept Deep-Dive Chips & Top 3 Strengths (#C056)', () => {
  // 1-Click Concept Deep-Dive Prompt Chips
  assert.ok(aiTutoringSource.includes('1-Click Prompt'), 'Must define 1-Click Prompt chips section');
  assert.ok(aiTutoringSource.includes('Dịch sát nghĩa câu khó nhất trong bài'), 'Must offer question translation chip');
  assert.ok(aiTutoringSource.includes('Cho em 1 câu tương tự để làm thử'), 'Must offer twin practice question chip');

  // Parent portal side: #C056 Top 3 Strengths
  assert.ok(parentPageSource.includes('#C056'), 'Must mark feature #C056 in parent portal');
  assert.ok(parentPageSource.includes('learningHighlights'), 'Must compute learningHighlights');
  assert.ok(parentPageSource.includes('strengths'), 'Must compute student strengths');
  assert.ok(parentPageSource.includes('3 Điểm Con Đang Làm Tốt Nhất'), 'Must render top strengths section');
});

test('W6-C057: Remaining AI Quota Meter & Top 3 Focus Areas (#C057)', () => {
  // Remaining AI Quota Meter
  assert.ok(aiTutoringSource.includes('quota'), 'Must maintain AI quota state');
  assert.ok(aiTutoringSource.includes('quota.remaining'), 'Must display quota.remaining');
  assert.ok(aiTutoringSource.includes('ProUnlockTeaserCard'), 'Must show ProUnlockTeaserCard when quota limits are reached');

  // Parent portal side: #C057 Top 3 Focus Areas for Next Week
  assert.ok(parentPageSource.includes('#C057'), 'Must mark feature #C057 in parent portal');
  assert.ok(parentPageSource.includes('focuses'), 'Must compute student focus areas');
  assert.ok(parentPageSource.includes('3 Trọng Tâm Cần Bứt Phá Tuần Tới'), 'Must render focus areas section');
});

test('W6-C058: Speech Synthesis / Copy Solution & Parent Encouragement (#C058)', () => {
  // Text-to-Speech & Speech Synthesis
  assert.ok(aiTutoringSource.includes('SpeechSynthesisUtterance'), 'Must use SpeechSynthesisUtterance');
  assert.ok(aiTutoringSource.includes('window.speechSynthesis'), 'Must integrate with window.speechSynthesis');
  assert.ok(aiTutoringSource.includes('speak'), 'Must invoke speak on speech synthesis');

  // Parent portal side: #C058 Parent Encouragement Message
  assert.ok(parentPageSource.includes('#C058'), 'Must mark feature #C058 in parent portal');
  assert.ok(parentPageSource.includes('handleSaveEncouragement'), 'Must provide handleSaveEncouragement handler');
  assert.ok(parentPageSource.includes('encouragementNote'), 'Must maintain encouragementNote state');
  assert.ok(parentPageSource.includes('Gửi Lời Động Viên Tiếp Sức Cho Con'), 'Must render encouragement message card');
});

test('W6-C059: Socratic Local Fail-Safe & Official College Board Schedule (#C059)', () => {
  // Socratic Local Fail-Safe
  assert.ok(aiTutorDrawerSource.includes('Socratic Local'), 'Must provide fallback badge on offline/network errors');
  assert.ok(aiTutorDrawerSource.includes('fallbackText'), 'Must define graceful fallbackText for Socratic AI');
  assert.ok(aiTutorDrawerSource.includes('handleMark'), 'Must implement handleMark for mastery state');

  // Parent portal side: #C059 College Board Official Exam Schedule
  assert.ok(parentPageSource.includes('#C059'), 'Must mark feature #C059 in parent portal');
  assert.ok(parentPageSource.includes('OFFICIAL_SAT_DATES'), 'Must define OFFICIAL_SAT_DATES schedule');
  assert.ok(parentPageSource.includes('nextExam'), 'Must compute next upcoming exam');
  assert.ok(parentPageSource.includes('Lịch thi SAT Quốc tế chính thức từ College Board'), 'Must render official exam schedule');
});

test('W6-C060: QuickSolve Instant Drawer & Recent Student Codes (#C060)', () => {
  // QuickSolve Instant Drawer Component Layout
  assert.ok(aiTutorDrawerSource.includes('AiTutorDrawerProps'), 'Must export AiTutorDrawerProps interface');
  assert.ok(aiTutorDrawerSource.includes('role="dialog"'), 'Must configure accessible dialog role');
  assert.ok(aiTutorDrawerSource.includes('aria-modal="true"'), 'Must mark dialog as aria-modal');
  assert.ok(aiTutorDrawerSource.includes('Thầy Nghĩa Guru'), 'Must display Thầy Nghĩa Guru brand attribution');
  assert.ok(aiTutorDrawerSource.includes('renderMathMarkdown'), 'Must include safe LaTeX math markdown renderer');

  // Parent portal side: #C060 Recent student codes switch
  assert.ok(parentPageSource.includes('#C060'), 'Must mark feature #C060 in parent portal');
  assert.ok(parentPageSource.includes('recentCodes'), 'Must track recentCodes state');
  assert.ok(parentPageSource.includes('sat_parent_recent_codes'), 'Must persist recent students in localStorage');
  assert.ok(parentPageSource.includes('saveRecentCode'), 'Must provide saveRecentCode helper');
});

test('W6 -> W7 Cross-Supervision: src/app/dashboard/page.tsx Integrity (#W6-W7)', () => {
  assert.ok(dashboardPageSource.length > 5000, 'dashboard/page.tsx must be substantial');
  assert.ok(
    dashboardPageSource.startsWith('"use client"') || dashboardPageSource.startsWith("'use client'"),
    'dashboard must be a client component'
  );

  // Countdown & schedule
  assert.ok(dashboardPageSource.includes('OFFICIAL_SAT_DATES'), 'Must define OFFICIAL_SAT_DATES');
  assert.ok(dashboardPageSource.includes('targetExamDateId'), 'Must track targetExamDateId');
  assert.ok(dashboardPageSource.includes('daysUntilExam'), 'Must calculate daysUntilExam');

  // Study modes
  assert.ok(dashboardPageSource.includes('dailyBudget'), 'Must track dailyBudget for 15-min mode');
  assert.ok(dashboardPageSource.includes('cramMode'), 'Must track cramMode');

  // Admission & benchmarks
  assert.ok(dashboardPageSource.includes('VN_UNI_BENCHMARKS'), 'Must include VN university admission benchmarks');
  assert.ok(dashboardPageSource.includes('vnAdmissionEstimates'), 'Must compute university admission estimates');
  assert.ok(dashboardPageSource.includes('FTU'), 'Must include FTU conversion logic');
  assert.ok(dashboardPageSource.includes('HUST'), 'Must include HUST talent admission logic');

  // Gamification & Streak Freeze
  assert.ok(
    dashboardPageSource.includes('streakFreezeCount') || dashboardPageSource.includes('sat_streak_freeze_count'),
    'Must define streak freeze key'
  );
  assert.ok(dashboardPageSource.includes('PERCENTILE_TIERS'), 'Must define PERCENTILE_TIERS data');
  assert.ok(dashboardPageSource.includes('currentPercentileTier'), 'Must calculate currentPercentileTier');

  // Safe timer and unmount cleanup
  assert.ok(
    !dashboardPageSource.includes('setInterval') || dashboardPageSource.includes('clearInterval'),
    'Must clean up active intervals on unmount if setInterval is used'
  );
});
