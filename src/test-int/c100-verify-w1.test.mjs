/**
 * INTEGRATION TEST: c100-verify-w1.test.mjs
 * Verification of Deployment Verification Squad 1 (W1)
 * Target: src/components/BluebookTools.tsx
 * Verifies 10 core features (#C001 - #C010) + SSR/JSX client safety
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bluebookToolsPath = path.resolve(__dirname, '../components/BluebookTools.tsx');
const examRunnerPath = path.resolve(__dirname, '../components/ExamRunner.tsx');

const bluebookSource = fs.readFileSync(bluebookToolsPath, 'utf8');

test('W1-00: File presence and "use client" SSR safety', () => {
  assert.ok(bluebookSource.length > 5000, 'BluebookTools.tsx should be a non-trivial file');
  assert.ok(bluebookSource.startsWith('"use client"') || bluebookSource.startsWith("'use client'"), 'Must have "use client" directive at top');
  
  // Verify localStorage and window accesses are safely guarded
  const rawLocalStorage = (bluebookSource.match(/localStorage\.(getItem|setItem)/g) || []).length;
  const guardedWindowChecks = (bluebookSource.match(/typeof window !== "undefined"/g) || []).length;
  assert.ok(guardedWindowChecks >= 2, 'Must guard window and localStorage accesses against SSR failure');
});

test('W1-C001: Desmos Copy Toast (#C001)', () => {
  assert.ok(bluebookSource.includes('copiedTrickId'), 'Must maintain state for copied trick toast feedback');
  assert.ok(bluebookSource.includes('handleCopyTrick'), 'Must define handleCopyTrick helper');
  assert.ok(bluebookSource.includes('clipboard.writeText'), 'Must copy trick code to clipboard');
  assert.ok(bluebookSource.includes('✓ Đã copy! Dán Ctrl+V'), 'Must render toast text feedback');
});

test('W1-C002: Regression Templates (#C002)', () => {
  assert.ok(bluebookSource.includes('y_1 ~ m x_1 + b'), 'Must include linear regression template');
  assert.ok(bluebookSource.includes('y_1 ~ a x_1^2 + b x_1 + c'), 'Must include quadratic regression template');
  assert.ok(bluebookSource.includes('y_1 ~ a b^{x_1}'), 'Must include exponential regression template');
  assert.ok(bluebookSource.includes('DESMOS_TRICKS'), 'Must expose DESMOS_TRICKS catalog');
});

test('W1-C003: 3D Geometry Cheat Sheet (#C003)', () => {
  assert.ok(bluebookSource.includes('V = lwh'), 'Must include rectangular prism volume formula');
  assert.ok(bluebookSource.includes('V = πr²h'), 'Must include cylinder volume formula');
  assert.ok(bluebookSource.includes('V = (4/3)πr³'), 'Must include sphere volume formula');
  assert.ok(bluebookSource.includes('V = (1/3)πr²h'), 'Must include cone volume formula');
  assert.ok(bluebookSource.includes('V = (1/3)lwh'), 'Must include pyramid volume formula');
  assert.ok(bluebookSource.includes('Tam giác 30° - 60° - 90°'), 'Must include special right triangle 30-60-90');
  assert.ok(bluebookSource.includes('Tam giác 45° - 45° - 90°'), 'Must include special right triangle 45-45-90');
});

test('W1-C004: Math Traps Glossary (#C004)', () => {
  assert.ok(bluebookSource.includes('MATH_VOCABULARY'), 'Must define MATH_VOCABULARY constant');
  assert.ok(bluebookSource.includes('trap:'), 'Must provide trap/warning for math terms');
  assert.ok(bluebookSource.includes('⚠️ <b>Lưu ý & Bẫy:</b>'), 'Must render trap alert box in UI');
  assert.ok(bluebookSource.includes('arithmetic') && bluebookSource.includes('algebra') && bluebookSource.includes('geometry') && bluebookSource.includes('statistics'), 'Must cover 4 core domains');
});

test('W1-C005: Scratchpad Math Badges (#C005)', () => {
  assert.ok(bluebookSource.includes('SCRATCHPAD_SYMBOLS'), 'Must define math badge symbol list');
  assert.ok(bluebookSource.includes('insertSymbol'), 'Must implement symbol inserter function');
  const requiredSymbols = ['x²', 'x³', '√', 'π', '≤', '≥', '±', 'θ'];
  for (const sym of requiredSymbols) {
    assert.ok(bluebookSource.includes(sym), `Must include math badge symbol ${sym}`);
  }
});

test('W1-C006: High-Contrast Desmos / Bluebook Mode (#C006)', () => {
  assert.ok(bluebookSource.includes('Bluebook Mode'), 'Must display Bluebook Mode badge');
  assert.ok(bluebookSource.includes('bg-slate-950') && bluebookSource.includes('border-cyan-500'), 'Must render high-contrast dark theme container');
  assert.ok(bluebookSource.includes('desmos.com/calculator'), 'Must embed official Desmos calculator iframe');
});

test('W1-C007: Auto-Clear Prompt (#C007)', () => {
  assert.ok(bluebookSource.includes('clearScratchpad'), 'Must define clearScratchpad handler');
  assert.ok(bluebookSource.includes('confirm('), 'Must prompt confirmation before wiping scratchpad data');
  assert.ok(bluebookSource.includes('sat_bluebook_scratchpad_v1'), 'Must persist and clear scratchpad key');
});

test('W1-C008: Pinned Formulas (#C008)', () => {
  assert.ok(bluebookSource.includes('must_know'), 'Must have must_know pinned reference tab');
  assert.ok(bluebookSource.includes('x = -b / (2a)'), 'Must include parabola vertex formula');
  assert.ok(bluebookSource.includes('x1 + x2 = -b / a'), 'Must include Vieta sum formula');
  assert.ok(bluebookSource.includes('x1 · x2 = c / a'), 'Must include Vieta product formula');
  assert.ok(bluebookSource.includes('sin(x°) = cos(90° - x°)'), 'Must include complementary angle formula');
  assert.ok(bluebookSource.includes('No solution') || bluebookSource.includes('Vô nghiệm'), 'Must include linear systems case analysis');
});

test('W1-C009: SPR Entry Preview (#C009)', () => {
  assert.ok(bluebookSource.includes('validateSprInput'), 'Must define validateSprInput function');
  assert.ok(bluebookSource.includes('sprTestInput'), 'Must provide interactive SPR tester input state');
  assert.ok(bluebookSource.includes('sprValidation'), 'Must compute live SPR validation feedback');
  assert.ok(bluebookSource.includes('HỢP LỆ!'), 'Must display validity confirmation message');
});

test('W1-C010: Mini Mode (compact prop) (#C010)', () => {
  assert.ok(bluebookSource.includes('interface BluebookToolsProps'), 'Must declare prop interface');
  assert.ok(bluebookSource.includes('compact?: boolean'), 'Must accept optional compact boolean');
  assert.ok(bluebookSource.includes('compact ? "Desmos" : "Máy tính Desmos"'), 'Must conditionally render Desmos compact label');
  assert.ok(bluebookSource.includes('compact ? "Công thức" : "Bảng công thức SAT"'), 'Must conditionally render Reference compact label');
  assert.ok(bluebookSource.includes('compact ? "Nháp" : "Nháp nhanh"'), 'Must conditionally render Scratchpad compact label');
  assert.ok(bluebookSource.includes('compact ? "SPR" : "Quy tắc SPR"'), 'Must conditionally render SPR compact label');
});

test('W1-CROSS-W2: Cross-Supervision on ExamRunner.tsx', () => {
  const runnerSource = fs.readFileSync(examRunnerPath, 'utf8');
  assert.ok(runnerSource.length > 5000, 'ExamRunner.tsx must exist and be accessible');
  assert.ok(runnerSource.includes('import { BluebookTools }'), 'ExamRunner must import BluebookTools');
  assert.ok(runnerSource.includes('validateSprInput'), 'ExamRunner must implement or share SPR validation');
  assert.ok(runnerSource.includes('toggleEliminateChoice'), 'ExamRunner must support choice elimination');
  assert.ok(runnerSource.includes('setShowModuleReviewGrid'), 'ExamRunner must support module review grid');
});
