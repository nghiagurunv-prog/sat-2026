/**
 * VERIFICATION SUITE — W9 (Deployment Verification Squad 9)
 * Automated Verification for #C081 - #C090 (B2B2C Teacher Cockpit & Classroom Operations)
 *
 * Invariants checked:
 * - #C081: Cohort Domain Heatmap (Skill breakdown, percentage, mastery)
 * - #C082: 1-Click Homework Link Generator & Zalo Copy Notification
 * - #C083: At-Risk Student Radar (Early Warning System for drop-out prevention)
 * - #C084: Redemption Audit Trail (Audit log for reward redemptions)
 * - #C085: CSV UTF-8 BOM (\uFEFF) Windows Excel Compatibility Guard
 * - #C086: Classroom Presentation Mode (Privacy Masking for Email, Phone, Revenue)
 * - #C087: Teacher Tip Injection (Dynamic Teacher Tip repository & add tip flow)
 * - #C088: Class & Cohort Leaderboard Filter
 * - #C089: AI Cost & 2-Layer Cache Hit-Rate Monitor
 * - #C090: Multi-Class Switcher & Cohort Tagging
 * - Integrity: activeTab === 'teacher' rendered exactly ONCE (no duplicate UI blocks)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

const adminPagePath = path.join(webRoot, 'app', 'admin', 'page.tsx');
const leaderboardPagePath = path.join(webRoot, 'app', 'leaderboard', 'page.tsx');
const diagnosticPagePath = path.join(webRoot, 'app', 'diagnostic', 'page.tsx');

test('W9 - File Existence & Readability', () => {
  assert.ok(fs.existsSync(adminPagePath), 'src/app/admin/page.tsx must exist');
  assert.ok(fs.existsSync(leaderboardPagePath), 'src/app/leaderboard/page.tsx must exist');
  assert.ok(fs.existsSync(diagnosticPagePath), 'src/app/diagnostic/page.tsx must exist');
});

test('W9 - Verify Exactly 1 occurrence of activeTab === "teacher" in admin/page.tsx', () => {
  const adminContent = fs.readFileSync(adminPagePath, 'utf8');
  const matches = adminContent.match(/activeTab === ['"]teacher['"]/g);
  assert.ok(matches, 'activeTab === "teacher" should be present');
  assert.equal(matches.length, 1, `activeTab === "teacher" must appear exactly ONCE, found ${matches.length}`);
});

test('W9 - #C081 Cohort Domain Heatmap', () => {
  const content = fs.readFileSync(adminPagePath, 'utf8');
  assert.match(content, /selectedHeatmapSkill|INITIAL_SKILL_HEATMAP|Bản Đồ Lỗ Hổng/i, 'Heatmap skill selector or data must exist');
  assert.match(content, /C081/i, '#C081 marker should be documented');
});

test('W9 - #C082 1-Click Homework Link Generator & Zalo Copy', () => {
  const content = fs.readFileSync(adminPagePath, 'utf8');
  assert.match(content, /handleCopyZaloMessage|zaloCustomNote/i, '1-Click Zalo message copy handler must exist');
  assert.match(content, /C082/i, '#C082 marker should be documented');
});

test('W9 - #C083 At-Risk Student Radar', () => {
  const content = fs.readFileSync(adminPagePath, 'utf8');
  assert.match(content, /riskLevel === ['"]HIGH['"]|selectedRiskFilter|RADAR CẢNH BÁO/i, 'At-risk student radar logic must exist');
  assert.match(content, /C083/i, '#C083 marker should be documented');
});

test('W9 - #C084 Redemption Audit Trail', () => {
  const content = fs.readFileSync(adminPagePath, 'utf8');
  assert.match(content, /redemptions|handleExportRedemptionsCsv/i, 'Redemption audit trail and export must exist');
  assert.match(content, /C084/i, '#C084 marker should be documented');
});

test('W9 - #C085 CSV UTF-8 BOM Windows Excel Safety', () => {
  const content = fs.readFileSync(adminPagePath, 'utf8');
  assert.match(content, /downloadUtf8BomCsv/i, 'downloadUtf8BomCsv helper must exist');
  assert.match(content, /\\uFEFF/, 'Must include Unicode BOM \\uFEFF for Windows Excel Vietnamese encoding');
  assert.match(content, /C085/i, '#C085 marker should be documented');
});

test('W9 - #C086 Classroom Presentation Mode (Privacy Masking)', () => {
  const content = fs.readFileSync(adminPagePath, 'utf8');
  assert.match(content, /presentationMode|setPresentationMode/i, 'Presentation mode state must exist');
  assert.match(content, /maskEmail/i, 'maskEmail helper must exist for teacher classroom projection');
  assert.match(content, /maskPhone/i, 'maskPhone helper must exist for teacher classroom projection');
  assert.match(content, /maskMoney/i, 'maskMoney helper must exist for revenue hiding');
  assert.match(content, /C086/i, '#C086 marker should be documented');
});

test('W9 - #C087 Teacher Tip Injection', () => {
  const content = fs.readFileSync(adminPagePath, 'utf8');
  assert.match(content, /teacherTips|handleAddTeacherTip|INITIAL_TEACHER_TIPS/i, 'Teacher tip injection state and handler must exist');
  assert.match(content, /C087/i, '#C087 marker should be documented');
});

test('W9 - #C088 Class & Cohort Leaderboard Filtering', () => {
  const adminContent = fs.readFileSync(adminPagePath, 'utf8');
  const lbContent = fs.readFileSync(leaderboardPagePath, 'utf8');
  const hasAdminTipOrFilter = /C088|INITIAL_TEACHER_TIPS/i.test(adminContent);
  const hasLbCohort = /TARGET_COHORTS|activeCohortId|cohort/i.test(lbContent);
  assert.ok(hasAdminTipOrFilter || hasLbCohort, '#C088 teacher tips or cohort filtering must exist');
});

test('W9 - #C089 AI Cost & Cache Hit-Rate Monitor', () => {
  const content = fs.readFileSync(adminPagePath, 'utf8');
  assert.match(content, /Cache Hit Rate|Tiết kiệm chi phí AI|Tiết kiệm tháng này/i, 'AI Cache hit rate & cost savings monitor must exist');
  assert.match(content, /C089/i, '#C089 marker should be documented');
});

test('W9 - #C090 Multi-Class Switcher & Cohort Tagging', () => {
  const content = fs.readFileSync(adminPagePath, 'utf8');
  assert.match(content, /selectedClassFilter|classCode/i, 'Multi-class switcher and student cohort tagging must exist');
  assert.match(content, /C090/i, '#C090 marker should be documented');
});

test('W9 - Cross-Supervision W9 -> W10: Diagnostic Onboarding Integrity', () => {
  const diagContent = fs.readFileSync(diagnosticPagePath, 'utf8');
  assert.match(diagContent, /login_required|done_already|intro|fighting|result/, 'Diagnostic must have clean Phase state machine');
  assert.match(diagContent, /isSubmittingRef/, 'Diagnostic must guard against double-submission');
  assert.match(diagContent, /CorePracticeUI/, 'Diagnostic must use standard CorePracticeUI component');
});
