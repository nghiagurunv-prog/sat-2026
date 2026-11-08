/**
 * c100-verify-w3.test.mjs
 * Verification Test Suite for Deployment Verification Squad 3 (W3)
 * Covers Features #C021 - #C030:
 * - #C021: Ngưỡng mở khóa Hard Module 2 (65% Threshold)
 * - #C022: Zero-Reload Transition & State Reset
 * - #C023: 3-Tier Hint Ladder (Free Hint, 20-Coin Elimination, Post-Submit Breakdown)
 * - #C024: Chế độ Trộn Kỹ Năng Thực Chiến (Interleaved Sprint)
 * - #C025: Khung Giờ Vàng Ôn Tập (20:00-22:00) & #C026: Chu kỳ Ebbinghaus
 * - #C027: Huy hiệu tăng trưởng Mastery & Micro-Celebrations
 * - #C028 & #C029: Hàng đợi phục thù - Luyện ngay 1 câu tương tự
 * - #C030: Ghim 3 Kỹ Năng Trọng Tâm Tuần (Pinned Weekly Skills)
 * - Inline Trap Analysis (4 Bẫy kinh điển) & Root-Cause Reflection Tags (Confidence & Lucky Guess)
 * - 1-Click Vocab Harvest & Time-Spent Pacing Badge & Smart Bookmarking
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

const corePracticePath = path.join(webRoot, 'components', 'CorePracticeUI.tsx');
const practicePagePath = path.join(webRoot, 'app', 'practice', 'page.tsx');
const vocabPagePath = path.join(webRoot, 'app', 'vocab', 'page.tsx');

test('W3 Verification - Files exist and are readable', () => {
  assert.ok(fs.existsSync(corePracticePath), 'CorePracticeUI.tsx must exist');
  assert.ok(fs.existsSync(practicePagePath), 'src/app/practice/page.tsx must exist');
  assert.ok(fs.existsSync(vocabPagePath), 'src/app/vocab/page.tsx must exist');
});

test('W3 Verification #C021 - Hard Module 2 Threshold (>= 65% accuracy)', () => {
  const practiceContent = fs.readFileSync(practicePagePath, 'utf-8');
  assert.match(practiceContent, /accuracyRate\s*>=\s*65/i, 'Must check 65% accuracy threshold');
  assert.match(practiceContent, /Hard Module 2/i, 'Must reference Hard Module 2');
  assert.match(practiceContent, /Mốc 65%/i, 'Must render visual 65% threshold indicator');
  assert.match(practiceContent, /left:\s*'65%'/i, 'Must have visual marker line at 65%');
});

test('W3 Verification #C022 - Zero-Reload Transition & State Reset', () => {
  const coreContent = fs.readFileSync(corePracticePath, 'utf-8');
  assert.match(coreContent, /questionKey\s*=\s*questionData\?\.questionId/i, 'Must construct questionKey for smooth transition');
  assert.match(coreContent, /setSelectedAnswer\(null\)/, 'Must reset selectedAnswer on next question');
  assert.match(coreContent, /setIsSubmitted\(false\)/, 'Must reset isSubmitted');
  assert.match(coreContent, /setTimeElapsed\(0\)/, 'Must reset timeElapsed');
  assert.match(coreContent, /setHintsRevealed\(0\)/, 'Must reset hintsRevealed');
});

test('W3 Verification #C023 - 3-Tier Hint Ladder & Post-Submit Breakdown', () => {
  const coreContent = fs.readFileSync(corePracticePath, 'utf-8');
  // Tier 1: Free
  assert.match(coreContent, /hintsRevealed\s*===\s*0/i, 'Tier 1 hint trigger');
  assert.match(coreContent, /Miễn phí/i, 'Tier 1 is free');
  // Tier 2: 20 Coins
  assert.match(coreContent, /spendCoins\(20\)/i, 'Tier 2 consumes 20 coins');
  assert.match(coreContent, /\/api\/hint/i, 'Tier 2 requests trap hint from api');
  // Tier 3 / Post-Submit
  assert.match(coreContent, /revealedExplanation/i, 'Provides detailed explanation after submit');
  assert.match(coreContent, /revealedAnalysis/i, 'Provides option-by-option analysis');
});

test('W3 Verification #C024 - Interleaved Sprint Mode', () => {
  const practiceContent = fs.readFileSync(practicePagePath, 'utf-8');
  assert.match(practiceContent, /isInterleaved/i, 'Must maintain isInterleaved state');
  assert.match(practiceContent, /sat_interleaved_sprint_v1/i, 'Must persist interleaved preference in localStorage');
  assert.match(practiceContent, /Trộn Kỹ Năng/i, 'Must provide Interleaved toggle button in UI');
});

test('W3 Verification #C025 & #C026 - Golden Hour (20:00-22:00) & Ebbinghaus Cycle', () => {
  const practiceContent = fs.readFileSync(practicePagePath, 'utf-8');
  assert.match(practiceContent, /isGoldenHour/i, 'Must calculate golden hour status');
  assert.match(practiceContent, /hour\s*>=\s*20\s*&&\s*hour\s*<\s*22/i, 'Golden hour must be between 20:00 and 22:00');
  assert.match(practiceContent, /Ebbinghaus/i, 'Must reference Ebbinghaus memory cycle');
  assert.match(practiceContent, /\+50%\s*Mastery\s*EXP/i, 'Must offer bonus Mastery EXP during golden hour');
});

test('W3 Verification #C027 - Mastery Growth Badge & Micro-Celebrations', () => {
  const practiceContent = fs.readFileSync(practicePagePath, 'utf-8');
  const coreContent = fs.readFileSync(corePracticePath, 'utf-8');
  assert.match(practiceContent, /recentMasteryGain/i, 'Must track recent mastery gain');
  assert.match(practiceContent, /EXP MASTERY KỸ NĂNG!/i, 'Must render mastery gain banner');
  assert.match(coreContent, /CHÍNH XÁC TUYỆT ĐỐI!/i, 'Must render celebration message');
  assert.match(coreContent, /COMBO x/i, 'Must display combo multiplier celebration');
});

test('W3 Verification #C028 & #C029 - Revenge Queue & Similar Question Drill', () => {
  const practiceContent = fs.readFileSync(practicePagePath, 'utf-8');
  assert.match(practiceContent, /handleDrillSimilar/i, 'Must provide handleDrillSimilar callback');
  assert.match(practiceContent, /KÍCH HOẠT HÀNG ĐỢI PHỤC THÙ/i, 'Must show revenge queue alert on mistake');
  assert.match(practiceContent, /Luyện Ngay 1 Câu Tương Tự/i, 'Must offer button to drill similar question immediately');
});

test('W3 Verification #C030 - Pinned 3 Weekly Focus Skills', () => {
  const practiceContent = fs.readFileSync(practicePagePath, 'utf-8');
  assert.match(practiceContent, /sat_pinned_skills_v1/i, 'Must persist pinned skills in localStorage');
  assert.match(practiceContent, /pinnedSkillIds\.length\s*>=\s*3/i, 'Must enforce maximum 3 pinned skills');
  assert.match(practiceContent, /3 Kỹ Năng Trọng Tâm Cần Đột Phá Tuần Này/i, 'Must render pinned skills dashboard');
  assert.match(practiceContent, /MỤC TIÊU #/i, 'Must display numbered targets');
});

test('W3 Verification - Inline Trap Analysis & 4 Classic Traps', () => {
  const coreContent = fs.readFileSync(corePracticePath, 'utf-8');
  assert.match(coreContent, /getTrapBadge/i, 'Must have getTrapBadge parser');
  assert.match(coreContent, /Bẫy Quá Cực Đoan/i, 'Must detect Too Extreme trap');
  assert.match(coreContent, /Bẫy Ngoài Phạm Vi/i, 'Must detect Out of Scope trap');
  assert.match(coreContent, /Bẫy Đúng Nửa Đầu - Sai Nửa Sau/i, 'Must detect Half-Right Half-Wrong trap');
  assert.match(coreContent, /Bẫy Ngược Quan Hệ Nhân Quả/i, 'Must detect Opposite/Reversed Causality trap');
});

test('W3 Verification - Root-Cause Reflection Tags & Lucky Guess Detection', () => {
  const coreContent = fs.readFileSync(corePracticePath, 'utf-8');
  assert.match(coreContent, /confidence/i, 'Must track confidence level');
  assert.match(coreContent, /Chắc chắn 100%/i, 'Must offer 100% confident option');
  assert.match(coreContent, /Phân vân 50\/50/i, 'Must offer 50/50 guessing option');
  assert.match(coreContent, /LUCKY GUESS/i, 'Must identify and guide user on lucky guess');
});

test('W3 Verification - 1-Click Vocab Harvest, Pacing Badge, Smart Bookmarking', () => {
  const coreContent = fs.readFileSync(corePracticePath, 'utf-8');
  // 1-Click Vocab
  assert.match(coreContent, /handleSaveVocab/i, 'Must have handleSaveVocab function');
  assert.match(coreContent, /sat_vocab_vault/i, 'Must persist vocab to local vault');
  assert.match(coreContent, /\+ Lưu từ/i, 'Must have 1-Click save button');
  // Pacing Indicator
  assert.match(coreContent, /pacingTargetSec/i, 'Must compute pacing target seconds');
  assert.match(coreContent, /isOverPacing/i, 'Must flag over-pacing');
  // Smart Bookmarking
  assert.match(coreContent, /toggleBookmark/i, 'Must have bookmark toggle');
  assert.match(coreContent, /Lưu Câu Này/i, 'Must have bookmark button');
});

test('W3 -> W4 Cross-Supervision - src/app/vocab/page.tsx Integrity', () => {
  const vocabContent = fs.readFileSync(vocabPagePath, 'utf-8');
  assert.ok(vocabContent.length > 500, 'Vocab page must have substantial content');
  assert.match(vocabContent, /CONFUSABLE_PAIRS/i, 'Must include confusable word pairs');
  assert.match(vocabContent, /SAT_ROOTS/i, 'Must include SAT roots guide');
  assert.match(vocabContent, /clozeMode/i, 'Must include Cloze context mode (#C042)');
  assert.match(vocabContent, /speakWord/i, 'Must support audio pronunciation');
  assert.match(vocabContent, /sat_vocab_pinned_ids/i, 'Must support starring/pinning words (#C045)');
});
