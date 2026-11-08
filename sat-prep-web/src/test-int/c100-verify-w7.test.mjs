/**
 * INTEGRATION TEST: c100-verify-w7.test.mjs
 * Verification of Deployment Verification Squad 7 (W7)
 * Targets: src/app/dashboard/page.tsx, src/components/DailyQuestsWidget.tsx, src/app/parent/page.tsx
 * Verifies 10 core features (#C061 - #C070) + Cross-check W7 -> W8 (src/app/parent/page.tsx)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dashboardPath = path.resolve(__dirname, '../app/dashboard/page.tsx');
const dailyQuestsPath = path.resolve(__dirname, '../components/DailyQuestsWidget.tsx');
const parentPath = path.resolve(__dirname, '../app/parent/page.tsx');

const dashboardSource = fs.readFileSync(dashboardPath, 'utf8');
const dailyQuestsSource = fs.readFileSync(dailyQuestsPath, 'utf8');
const parentSource = fs.readFileSync(parentPath, 'utf8');

test('W7-00: File presence and client-component integrity', () => {
  assert.ok(dashboardSource.length > 5000, 'dashboard/page.tsx should be substantial');
  assert.ok(dailyQuestsSource.length > 2000, 'DailyQuestsWidget.tsx should be substantial');
  assert.ok(parentSource.length > 4000, 'parent/page.tsx should be substantial');

  assert.ok(
    dashboardSource.startsWith("'use client'") || dashboardSource.startsWith('"use client"'),
    'dashboard must be client component'
  );
  assert.ok(
    dailyQuestsSource.startsWith("'use client'") || dailyQuestsSource.startsWith('"use client"'),
    'DailyQuestsWidget must be client component'
  );
  assert.ok(
    parentSource.startsWith("'use client'") || parentSource.startsWith('"use client"'),
    'parent/page must be client component'
  );
});

test('W7-C061: Adaptive Study Countdown (#C061)', () => {
  assert.ok(dashboardSource.includes('OFFICIAL_SAT_DATES'), 'Must define OFFICIAL_SAT_DATES');
  assert.ok(dashboardSource.includes('targetExamDateId'), 'Must maintain target exam date state');
  assert.ok(dashboardSource.includes('daysUntilExam'), 'Must compute countdown days until exam');
  assert.ok(dashboardSource.includes('regDeadline'), 'Must show registration deadline');
  assert.ok(dashboardSource.includes('Đếm Ngược Kỳ Thi SAT Quốc Tế'), 'Must render exam countdown heading');
});

test('W7-C062: 15-Min Busy-Student Mode (#C062)', () => {
  assert.ok(dashboardSource.includes('dailyBudget'), 'Must track dailyBudget state');
  assert.ok(dashboardSource.includes('15 Phút') || dashboardSource.includes('{ min: 15'), 'Must provide 15-minute quick study mode');
  assert.ok(dashboardSource.includes('Quỹ Thời Gian Học Mỗi Ngày'), 'Must render daily time budget section');
  assert.ok(dashboardSource.includes('handleSetDailyBudget'), 'Must provide handler to set study budget');
});

test('W7-C063: Cram Mode & Micro-practice trigger (#C063)', () => {
  assert.ok(dashboardSource.includes('cramMode'), 'Must track cram mode state');
  assert.ok(dashboardSource.includes('handleToggleCramMode'), 'Must provide toggle cram mode handler');
  assert.ok(
    dashboardSource.includes('Chế Độ Nước Rút 7 Ngày Cuối') || dashboardSource.includes('Bật Nước Rút 7 Ngày'),
    'Must render cram mode banner'
  );
});

test('W7-C064: VN University Admission Matrix 2026 (#C064)', () => {
  // Check target universities across dashboard and parent page
  const uniListDashboard = ['FTU', 'HUST', 'NEU', 'VNU'];
  for (const uni of uniListDashboard) {
    assert.ok(dashboardSource.includes(uni), `Dashboard must benchmark ${uni}`);
  }
  const uniListParent = ['FTU', 'NEU', 'HUST', 'VNU', 'VinUni', 'Fulbright'];
  for (const uni of uniListParent) {
    assert.ok(parentSource.includes(uni), `Parent portal must include key target university ${uni}`);
  }
  assert.ok(dashboardSource.includes('VN_UNI_BENCHMARKS'), 'Must expose VN_UNI_BENCHMARKS table');
  assert.ok(dashboardSource.includes('safeScore') && dashboardSource.includes('minScore'), 'Must support safe & min cutoffs');
});

test('W7-C065: Scholarship ROI Estimator (#C065)', () => {
  assert.ok(dashboardSource.includes('HIGH_ROI_SKILLS'), 'Must expose HIGH_ROI_SKILLS with point boosts');
  assert.ok(dashboardSource.includes('roi:'), 'Must list ROI points for key skills');
  assert.ok(dashboardSource.includes('PERCENTILE_TIERS'), 'Must provide scholarship tiers in dashboard');
  assert.ok(parentSource.includes('getScholarshipEstimate'), 'Parent portal must include getScholarshipEstimate');
  assert.ok(parentSource.includes('Tỷ VNĐ') || parentSource.includes('Triệu VNĐ'), 'Must quote scholarship value in VNĐ');
});

test('W7-C066: Weakest-3-Skills Card (#C066)', () => {
  assert.ok(dashboardSource.includes('weakestSkill'), 'Must detect weakest skill');
  assert.ok(dashboardSource.includes('score?.focusSkills') || dashboardSource.includes('focusSkills'), 'Must reference focus skills list');
  assert.ok(dashboardSource.includes('Kỹ Năng Cần Khắc Phục Gấp'), 'Must display urgent remediation card');
  assert.ok(dashboardSource.includes('/grind'), 'Must offer 1-click drill link to weakest skill');
});

test('W7-C067: Score Trajectory Chart & 5-Axis Radar (#C067)', () => {
  assert.ok(dashboardSource.includes('WeeklyTrendPanel'), 'Must embed WeeklyTrendPanel');
  assert.ok(dashboardSource.includes('RADAR_AXES'), 'Must define RADAR_AXES for 5-axis domain chart');
  assert.ok(dashboardSource.includes('Biểu Đồ Năng Lực SAT (5 Trục)'), 'Must render 5-axis capability radar chart');
});

test('W7-C068: Streak Freeze Shield (#C068)', () => {
  assert.ok(
    dailyQuestsSource.includes('STREAK_SHIELD_KEY') || dailyQuestsSource.includes('sat_exam_streak_shield_v1'),
    'Must define STREAK_SHIELD_KEY in DailyQuestsWidget'
  );
  assert.ok(dailyQuestsSource.includes('handleToggleShield'), 'Must provide handleToggleShield');
  assert.ok(dailyQuestsSource.includes('Khiên Bảo Vệ Streak Mùa Thi'), 'Must render Streak Freeze Shield card');
  assert.ok(dashboardSource.includes('streakFreezeCount') || dashboardSource.includes('sat_streak_freeze_count'), 'Dashboard must monitor streak freeze');
});

test('W7-C069: Daily Quest XP Multiplier & Intensity Mode (#C069)', () => {
  assert.ok(dailyQuestsSource.includes('IntensityMode'), 'Must define IntensityMode type');
  assert.ok(dailyQuestsSource.includes('warmup') && dailyQuestsSource.includes('standard') && dailyQuestsSource.includes('deep'), 'Must support warmup, standard, deep modes');
  assert.ok(dailyQuestsSource.includes('handleSelectIntensity'), 'Must handle intensity selection');
  assert.ok(dailyQuestsSource.includes('claimQuest'), 'Must support quest reward claim');
});

test('W7-C070: Peer Percentile Badge & Quick-Resume Banner (#C070)', () => {
  assert.ok(dashboardSource.includes('PERCENTILE_TIERS'), 'Must provide percentiles');
  assert.ok(dashboardSource.includes('currentPercentileTier'), 'Must compute current percentile tier');
  assert.ok(dashboardSource.includes('Percentile'), 'Must render percentile badge in UI');
  assert.ok(dashboardSource.includes('Vào Lò Luyện') || dashboardSource.includes('/forge'), 'Must have quick-resume action to forge');
  assert.ok(dashboardSource.includes('Cày Kỹ Năng') || dashboardSource.includes('/grind'), 'Must have quick-resume action to grind');
});

test('W7-CROSS-W8: Cross-supervision on src/app/parent/page.tsx (W7 -> W8)', () => {
  assert.ok(parentSource.includes('TARGET_UNIVERSITIES'), 'W8 Parent page must include TARGET_UNIVERSITIES');
  assert.ok(parentSource.includes('getScholarshipEstimate'), 'W8 Parent page must include getScholarshipEstimate');
  assert.ok(parentSource.includes('handleCopyZaloReport'), 'W8 Parent page must support Zalo sharing');
  assert.ok(parentSource.includes('sat_parent_recent_codes'), 'W8 Parent page must support recent codes storage');
  assert.ok(parentSource.includes('copyToClipboardSafe'), 'W8 Parent page must include copyToClipboardSafe helper');
});
