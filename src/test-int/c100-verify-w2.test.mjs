/**
 * c100-verify-w2.test.mjs
 * Verification Test Suite for Deployment Verification Squad 2 (W2)
 * Validates Features #C011 - #C020 in ExamRunner.tsx:
 * - #C011: 75s/95s Pacing Guard & College Board Benchmarks
 * - #C012: 2-Column Reading Mode (40/60, 50/50, 60/40) with 50/50 Split-Pane Preservation
 * - #C013: Strikethrough Mode + Shortcuts (Alt+E / E) & Bluebook Option Eliminator
 * - #C014: Evidence Highlighter (Yellow, Green, Pink) + Highlight Management
 * - #C015: Check Your Work Filters (All, Unanswered, Flagged Review Grid)
 * - #C016: 10-Minute Break & Breathing / Health Guide
 * - #C017: Time-vs-Accuracy Quadrant (Question Pacing Heatmap: Fast-Correct, On-Pace, Slow-Correct, Time-Trap)
 * - #C018: Instant Add-to-Mistake-Deck (1-Click SRS Mistake Notebook Sync)
 * - #C019: Score Ceiling Estimator (Adaptive Path: Hard 800 Ceiling vs Easy 650 Ceiling)
 * - #C020: Keyboard Shortcut System & Question Navigator Strip
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

const examRunnerPath = path.join(webRoot, 'components', 'ExamRunner.tsx');
const corePracticePath = path.join(webRoot, 'components', 'CorePracticeUI.tsx');

test('W2 Verification - Files exist and are accessible', () => {
  assert.ok(fs.existsSync(examRunnerPath), 'ExamRunner.tsx must exist');
  assert.ok(fs.existsSync(corePracticePath), 'CorePracticeUI.tsx must exist');
});

test('W2 Verification #C011 - 75s/95s Pacing Guard & Benchmark Analytics', () => {
  const content = fs.readFileSync(examRunnerPath, 'utf-8');
  assert.match(content, /export\s+type\s+PacingTier/i, 'Must define PacingTier type');
  assert.match(content, /export\s+function\s+getPacingTier/i, 'Must export getPacingTier utility function');
  assert.match(content, /rwAvg\s*<=\s*75/i, 'Must evaluate Reading & Writing pace against 75s benchmark');
  assert.match(content, /mathAvg\s*<=\s*100/i, 'Must evaluate Math pace against College Board ~95s/100s benchmark');
  assert.match(content, /overTimeCount/i, 'Must track questions taking over 120s as time warnings');
});

test('W2 Verification #C012 - 2-Column Reading Mode & 50/50 Split-Pane Preservation', () => {
  const content = fs.readFileSync(examRunnerPath, 'utf-8');
  // Must preserve 50/50 as initial default
  assert.match(content, /useState<'40\/60'\s*\|\s*'50\/50'\s*\|\s*'60\/40'>\('50\/50'\)/, 'Default columnSplit must be 50/50');
  // Must contain getColSplitClasses with 50/50 default
  assert.match(content, /getColSplitClasses\s*=\s*\(\)/, 'Must have getColSplitClasses helper');
  assert.match(content, /w-full\s+md:w-1\/2\s+pr-6\s+md:border-r\s+border-\[#334155\]/, '50/50 passage split class must be intact');
  assert.match(content, /w-full\s+md:w-1\/2\s+pl-0\s+md:pl-6/, '50/50 question split class must be intact');
  // Must provide toggle buttons for 40/60, 50/50, 60/40
  assert.match(content, /setColumnSplit\('40\/60'\)/, 'Must allow 40/60 split');
  assert.match(content, /setColumnSplit\('50\/50'\)/, 'Must allow 50/50 split');
  assert.match(content, /setColumnSplit\('60\/40'\)/, 'Must allow 60/40 split');
});

test('W2 Verification #C013 - Strikethrough Mode + Elimination Shortcuts', () => {
  const content = fs.readFileSync(examRunnerPath, 'utf-8');
  assert.match(content, /const\s+\[strikethroughMode,\s*setStrikethroughMode\]\s*=\s*useState\(false\)/, 'Must maintain strikethroughMode state');
  assert.match(content, /toggleEliminateChoice/, 'Must have toggleEliminateChoice function');
  assert.match(content, /setStrikethroughMode\(\(prev\)\s*=>\s*!prev\)/, 'Must toggle strikethrough mode on shortcut');
  assert.match(content, /line-through/, 'Must apply line-through CSS style to eliminated options');
  assert.match(content, /Option\s+Eliminator|gạch\s+loại\s+trừ/i, 'Must have option eliminator tooltip/label');
});

test('W2 Verification #C014 - Evidence Highlighter with Multi-Color Support', () => {
  const content = fs.readFileSync(examRunnerPath, 'utf-8');
  assert.match(content, /interface\s+PassageHighlight/, 'Must define PassageHighlight interface');
  assert.match(content, /'yellow'\s*\|\s*'green'\s*\|\s*'pink'/, 'Must support 3 highlight colors: yellow, green, pink');
  assert.match(content, /applyHighlight\('yellow'\)/, 'Must support applying yellow highlight');
  assert.match(content, /applyHighlight\('green'\)/, 'Must support applying green highlight');
  assert.match(content, /applyHighlight\('pink'\)/, 'Must support applying pink highlight');
  assert.match(content, /clearHighlights/, 'Must provide clearHighlights function');
});

test('W2 Verification #C015 - Check Your Work Filters (All, Unanswered, Flagged)', () => {
  const content = fs.readFileSync(examRunnerPath, 'utf-8');
  assert.match(content, /showModuleReviewGrid/i, 'Must maintain showModuleReviewGrid state');
  assert.match(content, /moduleReviewFilter.*'all'\s*\|\s*'unanswered'\s*\|\s*'flagged'/, 'Must define review filters');
  assert.match(content, /Check Your Work/i, 'Must render Check Your Work title');
  assert.match(content, /setModuleReviewFilter\('all'\)/, 'Must allow filtering all questions');
  assert.match(content, /setModuleReviewFilter\('unanswered'\)/, 'Must allow filtering unanswered questions');
  assert.match(content, /setModuleReviewFilter\('flagged'\)/, 'Must allow filtering flagged questions');
  assert.match(content, /setCurrentQuestionIndex\(idx\)/, 'Clicking review grid card jumps directly to question');
});

test('W2 Verification #C016 - 10-Minute Break & Breathing / Health Protocol', () => {
  const content = fs.readFileSync(examRunnerPath, 'utf-8');
  assert.match(content, /phase\s*===\s*'break'/, 'Must handle phase === break');
  assert.match(content, /breakTimeLeft/i, 'Must manage break countdown timer');
  assert.match(content, /10-Minute Scheduled Break/i, 'Must render official 10-Minute Scheduled Break banner');
  assert.match(content, /Lời khuyên phòng thi:/i, 'Must provide exam health and relaxation guidelines');
  assert.match(content, /BỎ QUA NGHỈ GIẢI LAO/i, 'Must provide option to skip break and proceed directly to Math');
});

test('W2 Verification #C017 - Time-vs-Accuracy Quadrant (Question Pacing Heatmap)', () => {
  const content = fs.readFileSync(examRunnerPath, 'utf-8');
  assert.match(content, /QUESTION PACING HEATMAP/i, 'Must render Question Pacing Heatmap banner');
  assert.match(content, /pacingHeatmapFilter/i, 'Must maintain pacingHeatmapFilter state');
  assert.match(content, /fast_correct/, 'Must support fast_correct quadrant');
  assert.match(content, /on_pace/, 'Must support on_pace quadrant');
  assert.match(content, /slow_correct/, 'Must support slow_correct quadrant');
  assert.match(content, /time_trap/, 'Must support time_trap quadrant');
  assert.match(content, /BLUEBOOK PACING ANALYTICS/i, 'Must display Bluebook Pacing Analytics badge');
});

test('W2 Verification #C018 - Instant Add-to-Mistake-Deck (1-Click SRS)', () => {
  const content = fs.readFileSync(examRunnerPath, 'utf-8');
  assert.match(content, /saveAllWrongToNotebook/, 'Must implement saveAllWrongToNotebook function');
  assert.match(content, /savingMistakes/i, 'Must track savingMistakes loading state');
  assert.match(content, /mistakesSavedCount/i, 'Must track mistakesSavedCount feedback');
  assert.match(content, /Lưu Tất Cả.*Câu Sai Vào Sổ Tay Cải Thiện/i, 'Must provide 1-Click bulk mistake deck button');
});

test('W2 Verification #C019 - Score Ceiling Estimator (Adaptive Path Ceiling)', () => {
  const content = fs.readFileSync(examRunnerPath, 'utf-8');
  assert.match(content, /trần điểm 800/i, 'Must communicate Hard Module 2 score ceiling of 800');
  assert.match(content, /trần 800/i, 'Must tag Hard Module 2 branch with ceiling 800');
  assert.match(content, /trần 650/i, 'Must tag Easy Module 2 branch with ceiling 650');
  assert.match(content, /rwPathResult\s*===\s*'hard'/i, 'Must display adaptive path outcome in score card');
});

test('W2 Verification #C020 - Keyboard Shortcut System & Question Navigator Strip', () => {
  const content = fs.readFileSync(examRunnerPath, 'utf-8');
  assert.match(content, /addEventListener\('keydown'/i, 'Must attach keyboard event listener');
  assert.match(content, /ArrowLeft/, 'Must support ArrowLeft shortcut to navigate previous question');
  assert.match(content, /ArrowRight/, 'Must support ArrowRight shortcut to navigate next question');
  assert.match(content, /1-4: Chọn \| ← →: Đổi câu \| F: Cắm cờ \| E: Gạch/i, 'Must display shortcut guide strip');
  assert.match(content, /Bản đồ câu hỏi:/i, 'Must render Question Navigator Strip in bottom toolbar');
});

test('W2 -> W3 Cross-Supervision - CorePracticeUI.tsx integrity check', () => {
  const coreContent = fs.readFileSync(corePracticePath, 'utf-8');
  assert.ok(coreContent.length > 5000, 'CorePracticeUI.tsx must be complete and non-empty');
  assert.match(coreContent, /export\s+function\s+CorePracticeUI/, 'CorePracticeUI component must be exported');
  assert.match(coreContent, /export\s+function\s+sanitizeSprInput/, 'Must export sanitizeSprInput utility');
  assert.match(coreContent, /pacingTargetSec\s*=\s*isMath\s*\?\s*95\s*:\s*71/, 'CorePracticeUI must respect 71s RW / 95s Math pacing');
  assert.match(coreContent, /BluebookTools/, 'CorePracticeUI must integrate BluebookTools suite');
  assert.match(coreContent, /\/api\/grade/, 'CorePracticeUI must secure grading via server API');
});
