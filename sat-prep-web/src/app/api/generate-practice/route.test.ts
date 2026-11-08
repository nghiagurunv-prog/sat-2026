import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canGeneratePracticeForTier } from '../../../lib/skill-tree.ts';
import { parseSprInput, validateSprInput } from '../../../lib/sat-tactical-helpers.ts';

// Free chỉ được đi qua các skill thuộc 2 domain mở sẵn.
test('canGeneratePracticeForTier: free chỉ được skill trong FREE_DOMAINS', () => {
  assert.equal(canGeneratePracticeForTier('free', 'algebra.linear_eq'), true);
  assert.equal(canGeneratePracticeForTier('free', 'rw.vocab'), true);
  assert.equal(canGeneratePracticeForTier('free', 'advanced.quadratic'), false);
  assert.equal(canGeneratePracticeForTier('free', 'geo.trig'), false);
});

test('canGeneratePracticeForTier: paid tiers không bị chặn', () => {
  assert.equal(canGeneratePracticeForTier('premium', 'advanced.quadratic'), true);
  assert.equal(canGeneratePracticeForTier('ultimate', 'geo.trig'), true);
  assert.equal(canGeneratePracticeForTier('premium', undefined), true);
});

// Kiểm tra biên Tier Gate cho Free và Unknown tiers
test('canGeneratePracticeForTier: tier gate edge cases', () => {
  assert.equal(canGeneratePracticeForTier('free', undefined), false);
  assert.equal(canGeneratePracticeForTier('free', ''), false);
  assert.equal(canGeneratePracticeForTier('pro', 'advanced.quadratic'), true);
  assert.equal(canGeneratePracticeForTier('pro', 'geo.trig'), true);
});

// Kiểm tra pure functions parseSprInput & validateSprInput theo quy chuẩn Bluebook SAT
test('parseSprInput & validateSprInput: hợp lệ cho số nguyên, số thập phân và phân số tối giản', () => {
  const integerRes = validateSprInput('42');
  assert.equal(integerRes.valid, true);
  assert.equal(integerRes.value, 42);

  const decimalRes = validateSprInput('3.14');
  assert.equal(decimalRes.valid, true);
  assert.equal(decimalRes.value, 3.14);

  const fractionRes = validateSprInput('7/2');
  assert.equal(fractionRes.valid, true);
  assert.equal(fractionRes.value, 3.5);

  const negativeFractionRes = validateSprInput('-3/4');
  assert.equal(negativeFractionRes.valid, true);
  assert.equal(negativeFractionRes.value, -0.75);
});

test('parseSprInput & validateSprInput: từ chối hỗn số, mẫu số âm, mẫu số 0 và chuỗi rỗng', () => {
  // Chuỗi rỗng
  const emptyRes = validateSprInput('');
  assert.equal(emptyRes.valid, false);

  // Hỗn số bị Bluebook cấm tuyệt đối (sẽ bị đọc nhầm là 31/2)
  const mixedRes = validateSprInput('3 1/2');
  assert.equal(mixedRes.valid, false);
  assert.match(mixedRes.error ?? '', /hỗn số/i);

  // Mẫu số âm
  const negDenomRes = validateSprInput('3/-5');
  assert.equal(negDenomRes.valid, false);
  assert.match(negDenomRes.error ?? '', /dưới mẫu số|mẫu số âm/i);

  // Mẫu số bằng 0
  const zeroDenomRes = validateSprInput('5/0');
  assert.equal(zeroDenomRes.valid, false);
  assert.match(zeroDenomRes.error ?? '', /mẫu số bằng 0/i);
});

test('parseSprInput: cảnh báo độ dài ký tự và số thập phân lặp chưa đủ độ dài', () => {
  // Quá 5 ký tự dương
  const longRes = parseSprInput('123456');
  assert.equal(longRes.isValid, false);
  assert.match(longRes.warning ?? '', /vượt quá giới hạn ký tự/i);

  // Số thập phân lặp .66 chưa đủ chính xác
  const repeatRes = parseSprInput('.66');
  assert.match(repeatRes.warning ?? '', /vô hạn tuần hoàn/i);
});
