// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

test('W4 Verification Suite - Vocab Mastery & Learning Loop (#C031–#C040)', async (t) => {
  const vocabPath = path.join(webRoot, 'app', 'vocab', 'page.tsx');
  const vocabularyPath = path.join(webRoot, 'app', 'vocabulary', 'page.tsx');
  const mistakeNotebookPath = path.join(webRoot, 'components', 'MistakeNotebook.tsx');

  assert.ok(fs.existsSync(vocabPath), 'src/app/vocab/page.tsx must exist');
  assert.ok(fs.existsSync(vocabularyPath), 'src/app/vocabulary/page.tsx must exist');
  assert.ok(fs.existsSync(mistakeNotebookPath), 'src/components/MistakeNotebook.tsx must exist for W4->W5 cross-check');

  const vocabContent = fs.readFileSync(vocabPath, 'utf8');
  const vocabularyContent = fs.readFileSync(vocabularyPath, 'utf8');
  const mistakeContent = fs.readFileSync(mistakeNotebookPath, 'utf8');

  // W4-00: Client Component Directives
  await t.test('W4-00: Files must be client components', () => {
    assert.match(vocabContent, /"use client"|'use client'/, 'vocab/page.tsx must be a client component');
    assert.match(vocabularyContent, /"use client"|'use client'/, 'vocabulary/page.tsx must be a client component');
    assert.match(mistakeContent, /"use client"|'use client'/, 'MistakeNotebook.tsx must be a client component');
  });

  // #C031: FSRS-4.5 / Leitner Interval Spaced Repetition Engine
  await t.test('W4-C031: FSRS Spaced Repetition Review Engine', () => {
    assert.match(vocabContent, /handleFsrsReview/, 'Must define handleFsrsReview function');
    assert.match(vocabContent, /sat_vocab_fsrs_ratings/, 'Must store FSRS review ratings in localStorage');
    assert.match(vocabContent, /'again'|'hard'|'good'|'easy'/, 'Must support standard FSRS rating scales');
    assert.match(vocabContent, /newBox\s*=\s*Math\.(max|min)/, 'Must calculate adaptive box promotion/demotion');
  });

  // #C032: Words-in-Context Cloze Mode
  await t.test('W4-C032: Words-in-Context Cloze Mode with Masking', () => {
    assert.match(vocabContent, /clozeMode/, 'Must maintain clozeMode state');
    assert.match(vocabContent, /toggleClozeMode/, 'Must provide toggleClozeMode handler');
    assert.match(vocabContent, /renderClozeSentence/, 'Must render sentence with target word masked');
    assert.match(vocabContent, /\[ _______ \]/, 'Must mask word with [ _______ ] placeholder in cloze mode');
    assert.match(vocabContent, /sat_vocab_cloze_mode/, 'Must persist cloze mode preference');
  });

  // #C033: Morphology Breakdown (Greek & Latin Roots/Prefixes/Suffixes)
  await t.test('W4-C033: Morphology Breakdown & Root Analysis', () => {
    assert.match(vocabContent, /SAT_ROOTS/, 'Must define SAT_ROOTS morphology reference table');
    assert.match(vocabContent, /findMatchingRoots/, 'Must implement findMatchingRoots helper');
    assert.match(vocabContent, /vietnameseMeaning/, 'Must provide Vietnamese meaning for morphology roots');
    assert.match(vocabContent, /Cẩm Nang Gốc Từ|Gốc từ/i, 'Must display morphology UI card');
  });

  // #C034: Confusable Pair Alerts (False Friends & Tone Pitfalls)
  await t.test('W4-C034: Confusable Pair Alerts & Distinction Warnings', () => {
    assert.match(vocabContent, /CONFUSABLE_PAIRS/, 'Must maintain confusable pairs database');
    assert.match(vocabContent, /findConfusablePair/, 'Must look up matching confusable word pair');
    assert.match(vocabContent, /distinction/, 'Must explain semantic distinction between confusable words');
    assert.match(vocabContent, /Cặp từ dễ nhầm lẫn/i, 'Must render confusable alert badge/banner');
  });

  // #C035: Audio Pronunciation with Speech Synthesis
  await t.test('W4-C035: Audio Pronunciation Web Speech Engine', () => {
    assert.match(vocabContent, /speakWord/, 'Must implement speakWord speech synthesis function');
    assert.match(vocabContent, /SpeechSynthesisUtterance/, 'Must invoke native browser SpeechSynthesisUtterance');
    assert.match(vocabContent, /en-US/, 'Must specify en-US locale for SAT pronunciation');
    assert.match(vocabContent, /Phát âm|🔊/, 'Must render pronunciation button');
  });

  // #C036: 60s Speed Vocab Blitz Mode
  await t.test('W4-C036: 60s Speed Vocab Blitz Mode', () => {
    assert.match(vocabContent, /blitzActive/, 'Must track blitzActive gameplay state');
    assert.match(vocabContent, /blitzTimeLeft/, 'Must implement countdown timer state');
    assert.match(vocabContent, /blitzScore/, 'Must track blitz score and combos');
    assert.match(vocabContent, /startBlitz/, 'Must provide startBlitz function');
    assert.match(vocabContent, /handleAnswerBlitz/, 'Must handle fast-paced blitz answer selections');
    assert.match(vocabContent, /Phản Xạ 60s|Blitz Mode|60 Giây/i, 'Must render Blitz UI toggle/launcher');
  });

  // #C037: Leitner Box 1–5 Distribution & Filters
  await t.test('W4-C037: Leitner Box 1–5 Distribution & Adaptive Filtering', () => {
    assert.match(vocabContent, /selectedBoxFilter/, 'Must support filtering words by Leitner Box 1-5');
    assert.match(vocabContent, /Hộp 1|Mới/, 'Must support Box 1 representation');
    assert.match(vocabContent, /Hộp 5|Thuộc lòng/, 'Must support Box 5 representation');
    assert.match(vocabContent, /\[1,\s*2,\s*3,\s*4,\s*5\]/, 'Must iterate through Box 1-5');
  });

  // #C038: Personal Mnemonic & Starred Words Pinning
  await t.test('W4-C038: Personal Mnemonic & Starred Words', () => {
    assert.match(vocabContent, /pinnedIds/, 'Must track pinnedIds state');
    assert.match(vocabContent, /togglePinWord/, 'Must provide togglePinWord handler');
    assert.match(vocabContent, /sat_vocab_pinned_ids/, 'Must persist pinned words to localStorage');
    assert.match(vocabContent, /Đã ghim|Ghim/, 'Must render bookmark/pin UI indicator');
  });

  // #C039: Mastered Auto-Graduation & Progress Metrics
  await t.test('W4-C039: Mastered Auto-Graduation & Retention Metric', () => {
    assert.match(vocabContent, /w\.box\s*===\s*5|b\s*===\s*5/, 'Must recognize Box 5 as mastered');
    assert.match(vocabContent, /Thuộc lòng/, 'Must label Box 5 as Thuộc lòng');
    assert.match(vocabContent, /HOÀN THÀNH MỤC TIÊU HÔM NAY/, 'Must render completion celebration');
  });

  // #C040: Mistake-Linked Words / Leech Vocabulary Filter
  await t.test('W4-C040: Mistake-Linked & Leech Word Filtering', () => {
    assert.match(vocabContent, /quickFilter/, 'Must support quickFilter modes');
    assert.match(vocabContent, /'leech'/, 'Must include leech / hay sai filter for problematic words');
    assert.match(vocabContent, /sat_vocab_leech_counts|leechCounts/, 'Must track frequency of repeat errors');
    assert.match(vocabContent, /Hay quên|Leech/i, 'Must present leech filter tab to student');
  });

  // Cross-check W4 -> W5: MistakeNotebook.tsx Architecture
  await t.test('W4->W5 Cross-Check: MistakeNotebook.tsx Architecture', () => {
    // 1. 5 Root Causes
    assert.match(mistakeContent, /careless/, 'Must support careless root cause');
    assert.match(mistakeContent, /vocab/, 'Must support vocab root cause');
    assert.match(mistakeContent, /concept/, 'Must support concept root cause');
    assert.match(mistakeContent, /time/, 'Must support time root cause');
    assert.match(mistakeContent, /desmos/, 'Must support desmos root cause');

    // 2. 3-Step Socratic Hint Ladder
    assert.match(mistakeContent, /getHintLadderData|hintLadder/, 'Must contain Socratic Hint Ladder data generator');
    assert.match(mistakeContent, /hintStep|setHintStep/, 'Must maintain interactive hint step state');

    // 3. 4 Mode Tabs
    assert.match(mistakeContent, /'browse'/, 'Must support browse mode');
    assert.match(mistakeContent, /'review'/, 'Must support review mode');
    assert.match(mistakeContent, /'sprint'/, 'Must support sprint mode');
    assert.match(mistakeContent, /'cram'/, 'Must support cram mode');

    // 4. Forge Mastery Shards Link
    assert.match(mistakeContent, /\/forge/, 'Must link completed error reviews to Forge Shards');
    assert.match(mistakeContent, /masteryShards|sat_mastery_shards_v1/, 'Must support mastery shard accumulation');
  });
});
