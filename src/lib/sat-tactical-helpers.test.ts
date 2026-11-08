import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSprInput,
  extractTargetExpressionTrap,
  detectUnitConversionTrap,
  formatLeitnerNextReview,
  calculateDailyStudyTarget,
} from './sat-tactical-helpers';

describe('Point 100: SAT Tactical Helpers Unit Tests', () => {
  describe('parseSprInput (Bluebook Grid-in Validator)', () => {
    it('parses valid fractions and computes decimal preview', () => {
      const res = parseSprInput('15/4');
      assert.equal(res.isValid, true);
      assert.equal(res.numericValue, 3.75);
      assert.equal(res.formattedPreview, '≈ 3.75');
    });

    it('rejects mixed numbers like "3 1/2" per College Board SPR rules', () => {
      const res = parseSprInput('3 1/2');
      assert.equal(res.isValid, false);
      assert.ok(res.warning?.includes('Bluebook KHÔNG chấp nhận hỗn số'));
    });

    it('warns when positive input exceeds 5 characters', () => {
      const res = parseSprInput('3.14159');
      assert.equal(res.isValid, false);
      assert.ok(res.warning?.includes('Vượt quá giới hạn ký tự Bluebook'));
    });

    it('allows 6 characters when negative sign is present', () => {
      const res = parseSprInput('-15/4');
      assert.equal(res.isValid, true);
      assert.equal(res.numericValue, -3.75);
    });
  });

  describe('extractTargetExpressionTrap (Math Final Question Highlighter)', () => {
    it('extracts compound target expressions like 2x + 5', () => {
      const stem = 'If 3(2x + 5) = 27, what is the value of 2x + 5?';
      assert.equal(extractTargetExpressionTrap(stem), '2x + 5');
    });

    it('returns null when asking for a single variable like x', () => {
      const stem = 'If 3x + 5 = 20, what is the value of x?';
      assert.equal(extractTargetExpressionTrap(stem), null);
    });
  });

  describe('detectUnitConversionTrap (Math Unit Mismatch Detector)', () => {
    it('detects hours vs minutes mismatch', () => {
      const stem = 'A car travels at 60 miles per hour. How many miles does it travel in 45 minutes?';
      const traps = detectUnitConversionTrap(stem);
      assert.deepEqual(traps, ['hours ↔ minutes (×60)']);
    });

    it('returns empty array when units are consistent', () => {
      const stem = 'A rectangle has length 10 meters and width 4 meters.';
      assert.deepEqual(detectUnitConversionTrap(stem), []);
    });
  });

  describe('formatLeitnerNextReview (SRS Human-Readable Countdown)', () => {
    it('identifies due items when timestamp is in the past', () => {
      const now = 1_700_000_000_000;
      const res = formatLeitnerNextReview(now - 60_000, now);
      assert.equal(res.isDue, true);
      assert.equal(res.label, 'Cần ôn ngay hôm nay');
    });

    it('formats multi-day future reviews cleanly', () => {
      const now = 1_700_000_000_000;
      const threeDaysLater = now + 3 * 24 * 60 * 60 * 1000;
      const res = formatLeitnerNextReview(threeDaysLater, now);
      assert.equal(res.isDue, false);
      assert.equal(res.label, 'Ôn sau 3 ngày');
    });
  });

  describe('calculateDailyStudyTarget (Goal Gap Projector)', () => {
    it('computes daily question quota and sprint intensity for large score gap', () => {
      const plan = calculateDailyStudyTarget(1200, 1500, 20);
      assert.equal(plan.scoreGap, 300);
      assert.equal(plan.dailyQuestions, 53);
      assert.equal(plan.intensityLabel, 'Nước rút');
      assert.equal(plan.weeklyMockExams, 3);
    });

    it('returns maintenance quota when target is already reached', () => {
      const plan = calculateDailyStudyTarget(1520, 1500, 30);
      assert.equal(plan.scoreGap, 0);
      assert.equal(plan.dailyQuestions, 10);
      assert.equal(plan.intensityLabel, 'Nhẹ nhàng');
    });
  });
});

