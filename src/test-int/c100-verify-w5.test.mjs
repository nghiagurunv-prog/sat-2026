/**
 * INTEGRATION TEST: c100-verify-w5.test.mjs
 * Verification of Deployment Verification Squad 5 (W5)
 * Targets:
 *   - src/components/MistakeNotebook.tsx
 *   - src/app/review/page.tsx
 * Verifies 10 core features (#C041 - #C050) + Cross-supervision check for W6 (src/components/AITutoring.tsx)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mistakeNotebookPath = path.resolve(__dirname, '../components/MistakeNotebook.tsx');
const reviewPagePath = path.resolve(__dirname, '../app/review/page.tsx');
const aiTutoringPath = path.resolve(__dirname, '../components/AITutoring.tsx');

const mistakeNotebookSource = fs.readFileSync(mistakeNotebookPath, 'utf8');
const reviewPageSource = fs.readFileSync(reviewPagePath, 'utf8');
const aiTutoringSource = fs.readFileSync(aiTutoringPath, 'utf8');

test('W5-00: File presence and "use client" SSR safety', () => {
  assert.ok(mistakeNotebookSource.length > 5000, 'MistakeNotebook.tsx should be a non-trivial component');
  assert.ok(reviewPageSource.length > 3000, 'review/page.tsx should be a non-trivial page');
  assert.ok(
    mistakeNotebookSource.startsWith('"use client"') || mistakeNotebookSource.startsWith("'use client'"),
    'MistakeNotebook.tsx must have "use client" directive'
  );
  assert.ok(
    reviewPageSource.startsWith('"use client"') || reviewPageSource.startsWith("'use client'"),
    'review/page.tsx must have "use client" directive'
  );

  // Safe window/localStorage guards
  assert.ok(mistakeNotebookSource.includes('localStorage.getItem'), 'Must safely read from localStorage');
  assert.ok(mistakeNotebookSource.includes('localStorage.setItem'), 'Must safely write to localStorage');
  assert.ok(reviewPageSource.includes('localStorage.getItem'), 'review/page.tsx must safely read localStorage');
});

test('W5-C041: 3-Clear Graduation Rule & Leitner Box Progression (#C041)', () => {
  // MistakeNotebook graduation progress (Box 4-5 Mastered, Box 3 learning, Box 1-2 danger)
  assert.ok(mistakeNotebookSource.includes('masteryStats'), 'Must compute masteryStats for graduation tracking');
  assert.ok(mistakeNotebookSource.includes('masteredPercent'), 'Must calculate percentage of mastered/graduated mistakes');
  assert.ok(mistakeNotebookSource.includes('TIẾN ĐỘ TỐT NGHIỆP SỔ TAY'), 'Must display Mastered Graduation Progress Bar');
  assert.ok(mistakeNotebookSource.includes('Đã làm chủ (Box 4–5)'), 'Must define graduation threshold at Box 4-5');
  assert.ok(mistakeNotebookSource.includes('đẩy câu sai lên hộp Leitner cao hơn'), 'Must promote mistake box on remembered answers');

  // ReviewPage graduation / box progression
  assert.ok(reviewPageSource.includes('Hộp 4 (Hạn 14 ngày - Mastered)'), 'Must identify Box 4 as Mastered graduation stage');
  assert.ok(reviewPageSource.includes('Math.min(4, (item.box || 1) + 1)'), 'Must advance box level up to 4 upon successful revenge');
});

test('W5-C042: Root-Cause Pie Chart & Breakdown Analysis (#C042)', () => {
  // MistakeNotebook 5 root causes catalog and dynamic breakdown
  assert.ok(mistakeNotebookSource.includes('ROOT_CAUSES'), 'Must define ROOT_CAUSES catalog');
  assert.ok(mistakeNotebookSource.includes('rootCauseStats'), 'Must compute rootCauseStats distribution');
  assert.ok(mistakeNotebookSource.includes('barColor'), 'Must assign colors for distribution bars');
  assert.ok(mistakeNotebookSource.includes('Bản đồ nguyên nhân mất điểm'), 'Must render root cause breakdown chart');
  assert.ok(mistakeNotebookSource.includes('getTacticalAdvice'), 'Must provide automated tactical advice based on highest root cause');

  // ReviewPage 5-D Error Taxonomy
  assert.ok(reviewPageSource.includes('ERROR_TAXONOMY_5D'), 'Must define ERROR_TAXONOMY_5D constant');
  assert.ok(reviewPageSource.includes('Bản Đồ Bóc Tách 5 Nguyên Nhân Sai Cốt Tử'), 'Must render 5-D taxonomy map');
  assert.ok(reviewPageSource.includes('errorStats'), 'Must calculate errorStats for 5-D breakdown');
});

test('W5-C043: Redo Clean Mode & Blind Retry Active Recall (#C043)', () => {
  // Blind retry mode in MistakeNotebook
  assert.ok(mistakeNotebookSource.includes('blindRetryMode'), 'Must manage blindRetryMode state');
  assert.ok(mistakeNotebookSource.includes('toggleBlindRetryMode'), 'Must provide handler to toggle blind retry mode');
  assert.ok(mistakeNotebookSource.includes('Che đáp án để tự nhẩm'), 'Must render Blind Retry switch in UI');
  assert.ok(mistakeNotebookSource.includes('Thang Gợi Ý 3 Cấp Độ'), 'Must implement 3-Step Socratic Hint Ladder');
  assert.ok(mistakeNotebookSource.includes('hintStep'), 'Must manage progressive hint step revealing');
});

test('W5-C044: Print-Ready PDF Worksheet & Cram Sheet (#C044)', () => {
  // Cram sheet / printable worksheet
  assert.ok(mistakeNotebookSource.includes("mode === 'cram'"), 'Must support cram/print mode');
  assert.ok(mistakeNotebookSource.includes('window.print()'), 'Must trigger native print dialog');
  assert.ok(mistakeNotebookSource.includes('SAT CRAM SHEET — TỔNG HỢP LỖI SAI'), 'Must render standard Cram Sheet header');
  assert.ok(mistakeNotebookSource.includes('print:hidden'), 'Must hide controls when printing');
  assert.ok(mistakeNotebookSource.includes('print:bg-white') || mistakeNotebookSource.includes('print:text-black'), 'Must apply print-ready CSS styles');
  assert.ok(mistakeNotebookSource.includes('break-inside-avoid'), 'Must prevent page-break cuts on question cards');
});

test('W5-C045: Spaced Retry Queue Badge & Leitner Intervals (#C045)', () => {
  // Next review scheduling and badges
  assert.ok(mistakeNotebookSource.includes('getNextReviewInfo'), 'Must implement getNextReviewInfo helper');
  assert.ok(mistakeNotebookSource.includes('🔥 Đến hạn hôm nay'), 'Must display urgent due badge');
  assert.ok(mistakeNotebookSource.includes('dueCount'), 'Must track number of items due today');
  assert.ok(mistakeNotebookSource.includes('next_review'), 'Must read next_review timestamp');

  // ReviewPage spaced retry filter tabs
  assert.ok(reviewPageSource.includes('selectedCycleFilter'), 'Must filter by cycle intervals');
  assert.ok(reviewPageSource.includes('Đến Hạn Hôm Nay'), 'Must render due filter tab with badge');
  assert.ok(reviewPageSource.includes('Hộp 1 (Hạn 1 ngày)'), 'Must support Box 1 interval');
  assert.ok(reviewPageSource.includes('Hộp 2 (Hạn 3 ngày)'), 'Must support Box 2 interval');
  assert.ok(reviewPageSource.includes('Hộp 3 (Hạn 7 ngày)'), 'Must support Box 3 interval');
});

test('W5-C046: Custom Tags & Error Taxonomy Tagging (#C046)', () => {
  // Tag persistence and handlers in MistakeNotebook
  assert.ok(mistakeNotebookSource.includes('sat_mistake_root_causes_v1'), 'Must persist root cause tags in localStorage');
  assert.ok(mistakeNotebookSource.includes('handleSetRootCause'), 'Must provide handler to assign root cause tags');

  // Tag persistence in ReviewPage
  assert.ok(reviewPageSource.includes('sat_error_tags_v1'), 'Must persist error tags with key sat_error_tags_v1');
  assert.ok(reviewPageSource.includes('handleSetErrorTag'), 'Must provide handler to assign error tag');
  assert.ok(reviewPageSource.includes('selectedTagFilter'), 'Must allow filtering by custom 5D error tags');
});

test('W5-C047: AI Similar Twin Question Generator (#C047)', () => {
  // Variant twin question generation via API in MistakeNotebook
  assert.ok(mistakeNotebookSource.includes('handlePracticeVariant'), 'Must implement handlePracticeVariant generator');
  assert.ok(mistakeNotebookSource.includes('/api/cau-sai/variant'), 'Must query /api/cau-sai/variant endpoint');
  assert.ok(mistakeNotebookSource.includes('variantQ'), 'Must hold generated variant PracticeQuestion');
  assert.ok(mistakeNotebookSource.includes('handleVariantAnswer'), 'Must process answer for variant question');
  assert.ok(mistakeNotebookSource.includes('Hạ gục câu biến thể tương đương'), 'Must reward mastery shards for solving variant');
});

test('W5-C048: Before/After Note Comparison & Personal Notes (#C048)', () => {
  // Personal lessons learned in MistakeNotebook
  assert.ok(mistakeNotebookSource.includes('sat_mistake_notes_v1'), 'Must persist personal notes in localStorage');
  assert.ok(mistakeNotebookSource.includes('handleSaveNote'), 'Must provide handleSaveNote function');
  assert.ok(mistakeNotebookSource.includes('Bài học xương máu cá nhân'), 'Must render personal notes section');
  assert.ok(mistakeNotebookSource.includes('BÀI HỌC XƯƠNG MÁU'), 'Must present lessons learned on cram print sheets');
  assert.ok(mistakeNotebookSource.includes('m.user_choice') && mistakeNotebookSource.includes('m.correct_choice'), 'Must contrast user choice with correct choice');
});

test('W5-C049: Domain Filter Pills & Multi-Dimensional Search (#C049)', () => {
  // Filtering in MistakeNotebook
  assert.ok(mistakeNotebookSource.includes('filterSubject'), 'Must support filtering by Subject');
  assert.ok(mistakeNotebookSource.includes('filterBox'), 'Must support filtering by Leitner Box');
  assert.ok(mistakeNotebookSource.includes('filterRootCause'), 'Must support filtering by Root Cause');
  assert.ok(mistakeNotebookSource.includes('filterArchive'), 'Must support filtering active vs archived');
  assert.ok(mistakeNotebookSource.includes('searchQuery'), 'Must provide search query state');

  // Filtering in ReviewPage
  assert.ok(reviewPageSource.includes('filteredMistakes'), 'Must compute filteredMistakes list');
  assert.ok(reviewPageSource.includes('selectedTagFilter'), 'Must support tag filtering');
});

test('W5-C050: Weekly Mistake Digest, Sprint & Shard Tracking (#C050)', () => {
  // Mistake sprint mode
  assert.ok(mistakeNotebookSource.includes("mode === 'sprint'"), 'Must support sprint mode');
  assert.ok(mistakeNotebookSource.includes('sprintQuestions'), 'Must select 5 questions for rapid sprint');
  assert.ok(mistakeNotebookSource.includes('sprintTimeLeft'), 'Must track 3-minute sprint countdown timer');
  assert.ok(mistakeNotebookSource.includes('sat_mastery_shards_v1'), 'Must persist Mastery Shards key');
  assert.ok(mistakeNotebookSource.includes('awardMasteryShard'), 'Must reward mastery shards on successful review');
  assert.ok(mistakeNotebookSource.includes('Lò Rèn'), 'Must link to Forge (/forge) for spending shards');
});

test('W5 -> W6 Cross-Supervision: AITutoring.tsx Integrity (#W5-W6)', () => {
  // Verify AITutoring component integrity for W6
  assert.ok(aiTutoringSource.length > 5000, 'AITutoring.tsx should be robust');
  assert.ok(
    aiTutoringSource.startsWith('"use client"') || aiTutoringSource.startsWith("'use client'"),
    'AITutoring.tsx must have "use client" directive'
  );
  assert.ok(aiTutoringSource.includes('renderFormattedTutorMessage'), 'Must export renderFormattedTutorMessage helper');
  assert.ok(aiTutoringSource.includes('💡 Điểm mấu chốt'), 'Must support Socratic key point styling');
  assert.ok(aiTutoringSource.includes('🪤 Giải phẫu bẫy'), 'Must support College Board trap dissection styling');
  assert.ok(aiTutoringSource.includes('⚡ Bí kíp thực chiến'), 'Must support 15s / Desmos tip styling');
  assert.ok(aiTutoringSource.includes('ProUnlockTeaserCard'), 'Must define ProUnlockTeaserCard for quota limits');
  assert.ok(aiTutoringSource.includes('/api/grade'), 'Must use server-authoritative /api/grade');
  assert.ok(aiTutoringSource.includes('registerGradedResult'), 'Must synchronize gamification results');
  assert.ok(aiTutoringSource.includes('AbortController'), 'Must manage request cancellation with AbortController');
});
