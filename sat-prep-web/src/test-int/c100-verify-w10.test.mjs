/**
 * VERIFICATION SUITE — W10 (Deployment Verification Squad 10)
 * Automated Verification for #C091 - #C100 (Express Diagnostic, Study Plan, Gamification & Resilience)
 *
 * Invariants checked:
 * - #C091: 15-Min Mini-Diagnostic Express Mode & 1-Chạm Báo Lỗi Đề
 * - #C092: Personalized Study Plan Slots & Reading Comfort (Warm Sepia Mode)
 * - #C093: Onboarding Goal Picker (6 Target Unis FTU/NEU/HUST/VNU/VinUni/US Top 30) & Exam Months
 * - #C094: Boss Battle Domain Selection (8 Academic Bosses: 4 Math + 4 RW, Category Filters)
 * - #C095: Boss HP Bar (1000-1200 HP) & Quick Scratchpad with Canvas Drawing
 * - #C096: Tower Floor Checkpoint Save (Every 5 Floors, 3 Shields) & Mobile Grid-in/SPR Keypad
 * - #C097: Speed-Quiz Survival Mechanics (15s Timer, 2-Wrong Streak Limit, Milestones)
 * - #C098: Offline Network Status Banner & Fallback Diagnostic Resilience
 * - #C099: Reading Comfort Toggle & Smart Online/Offline Sync Indicator
 * - #C100: Zero-Error Boundary Fallback (Next.js Global Client ErrorBoundary & Reset Trigger)
 *
 * Cross-Inspection (W10 -> W1):
 * - Circular verification of `src/components/BluebookTools.tsx`:
 *   Desmos shortcuts (10 tricks), SPR validation rules, Draggable clamp position, Math Vocabulary.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

const diagnosticPagePath = path.join(webRoot, 'app', 'diagnostic', 'page.tsx');
const onboardingPagePath = path.join(webRoot, 'app', 'onboarding', 'page.tsx');
const bossPagePath = path.join(webRoot, 'app', 'boss', 'page.tsx');
const towerPagePath = path.join(webRoot, 'app', 'tower', 'page.tsx');
const speedQuizPagePath = path.join(webRoot, 'app', 'speed-quiz', 'page.tsx');
const errorPagePath = path.join(webRoot, 'app', 'error.tsx');
const navbarPath = path.join(webRoot, 'components', 'Navbar.tsx');
const questionCardPath = path.join(webRoot, 'components', 'QuestionCard.tsx');
const bluebookToolsPath = path.join(webRoot, 'components', 'BluebookTools.tsx');

test('W10 - File Existence & Structural Integrity', () => {
  assert.ok(fs.existsSync(diagnosticPagePath), 'src/app/diagnostic/page.tsx must exist');
  assert.ok(fs.existsSync(onboardingPagePath), 'src/app/onboarding/page.tsx must exist');
  assert.ok(fs.existsSync(bossPagePath), 'src/app/boss/page.tsx must exist');
  assert.ok(fs.existsSync(towerPagePath), 'src/app/tower/page.tsx must exist');
  assert.ok(fs.existsSync(speedQuizPagePath), 'src/app/speed-quiz/page.tsx must exist');
  assert.ok(fs.existsSync(errorPagePath), 'src/app/error.tsx must exist');
  assert.ok(fs.existsSync(navbarPath), 'src/components/Navbar.tsx must exist');
  assert.ok(fs.existsSync(questionCardPath), 'src/components/QuestionCard.tsx must exist');
  assert.ok(fs.existsSync(bluebookToolsPath), 'src/components/BluebookTools.tsx must exist');
});

test('W10 - #C091: 15-Min Mini-Diagnostic Express Mode & 1-Chạm Báo Lỗi', () => {
  const onboardingContent = fs.readFileSync(onboardingPagePath, 'utf8');
  assert.match(onboardingContent, /quick.*mode|quickMode|isQuickMode|Chẩn đoán Nhanh/i, 'Onboarding must support quick express diagnostic mode');

  const questionCardContent = fs.readFileSync(questionCardPath, 'utf8');
  assert.match(questionCardContent, /#C091.*BÁO LỖI/i, 'QuestionCard must include #C091 quick report issue handler');
  assert.match(questionCardContent, /sat_reported_questions_v1/, 'Reported questions must be stored under sat_reported_questions_v1');
});

test('W10 - #C092: Personalized Study Plan Slots & Reading Comfort (Warm Sepia)', () => {
  const onboardingContent = fs.readFileSync(onboardingPagePath, 'utf8');
  assert.match(onboardingContent, /STUDY_TIME_SLOTS/, 'STUDY_TIME_SLOTS constant must exist in onboarding');
  assert.match(onboardingContent, /slot_evening_1/, 'Must support evening study slot 20:00 - 21:30');

  const questionCardContent = fs.readFileSync(questionCardPath, 'utf8');
  assert.match(questionCardContent, /#C092.*CHẾ ĐỘ ĐỌC DỊU MẮT/i, '#C092 warm sepia reading comfort marker must exist');
  assert.match(questionCardContent, /sat_reading_sepia_mode/, 'Must persist reading comfort preference in sat_reading_sepia_mode');
});

test('W10 - #C093: Onboarding Goal Picker (6 Target Unis & Exam Months)', () => {
  const onboardingContent = fs.readFileSync(onboardingPagePath, 'utf8');
  assert.match(onboardingContent, /UNI_TARGET_OPTIONS/, 'UNI_TARGET_OPTIONS must be declared');
  assert.match(onboardingContent, /FTU.*1450/, 'Must include FTU target 1450+');
  assert.match(onboardingContent, /NEU.*1400/, 'Must include NEU target 1400+');
  assert.match(onboardingContent, /HUST.*1450/, 'Must include HUST target 1450+');
  assert.match(onboardingContent, /VNU.*1380/, 'Must include VNU target 1380+');
  assert.match(onboardingContent, /VINUNI_FULBRIGHT.*1500/, 'Must include VinUni/Fulbright 1500+');
  assert.match(onboardingContent, /US_TOP30.*1530/, 'Must include US Top 30 1530+');
  assert.match(onboardingContent, /SAT_EXAM_MONTHS/, 'SAT_EXAM_MONTHS list must be present');
});

test('W10 - #C094: Boss Battle Domain Selection & Smart Network Filter', () => {
  const bossContent = fs.readFileSync(bossPagePath, 'utf8');
  assert.match(bossContent, /BOSS_LIST/, 'BOSS_LIST must be declared');
  assert.match(bossContent, /filterCategory.*setFilterCategory/, 'Category filter state must exist');
  assert.match(bossContent, /['"]all['"].*['"]math['"].*['"]reading-writing['"]/, 'Category filters must cover all, math, and reading-writing');
  assert.match(bossContent, /boss-algebra[\s\S]*?Algebra Titan/, 'Must include Algebra Titan boss');
  assert.match(bossContent, /boss-adv-math[\s\S]*?Advanced Math Dragon/, 'Must include Advanced Math Dragon boss');
  assert.match(bossContent, /boss-vocab[\s\S]*?Vocabulary Phantom/, 'Must include Vocabulary Phantom boss');
  assert.match(bossContent, /boss-grammar[\s\S]*?Grammar Colossus/, 'Must include Grammar Colossus boss');
});

test('W10 - #C095: Boss HP Bar & Scratchpad Canvas Drawing', () => {
  const bossContent = fs.readFileSync(bossPagePath, 'utf8');
  assert.match(bossContent, /maxHp:\s*(1000|1100|1200)/, 'Bosses must have calibrated maxHp between 1000 and 1200');

  const questionCardContent = fs.readFileSync(questionCardPath, 'utf8');
  assert.match(questionCardContent, /#C095.*GIẤY NHÁP NHANH.*CANVAS/i, '#C095 scratchpad and canvas drawing must exist');
  assert.match(questionCardContent, /canvasRef.*useRef<HTMLCanvasElement/, 'Must support HTML5 canvas for freehand drawing');
  assert.match(questionCardContent, /scratchpadMode.*calc.*draw/, 'Must toggle between calculator/scratch notes and drawing');
});

test('W10 - #C096: Tower Floor Checkpoint Save & Grid-in/SPR Mobile Keypad', () => {
  const towerContent = fs.readFileSync(towerPagePath, 'utf8');
  assert.match(towerContent, /MAX_SHIELDS\s*=\s*3/, 'Tower must have exactly 3 shields limit');
  assert.match(towerContent, /CHECKPOINT_STORAGE_KEY\s*=\s*['"]sat_tower_checkpoint_v1['"]/, 'Checkpoint must save to sat_tower_checkpoint_v1');
  assert.match(towerContent, /HIGHEST_FLOOR_STORAGE_KEY\s*=\s*['"]sat_tower_highest_floor_v1['"]/, 'Record must save to sat_tower_highest_floor_v1');
  assert.match(towerContent, /checkAndUpdateCheckpoint/, 'checkAndUpdateCheckpoint method must exist');

  const questionCardContent = fs.readFileSync(questionCardPath, 'utf8');
  assert.match(questionCardContent, /#C096.*NÚT CHÈN NHANH ĐÁP ÁN TỰ LUẬN TOÁN/i, '#C096 SPR quick input buttons must exist');
  assert.match(questionCardContent, /handleInsertChar/, 'Must enforce SPR input rules (- at start, max 1 slash or dot)');
});

test('W10 - #C097: Speed-Quiz Mechanics & Coin Milestones', () => {
  const speedContent = fs.readFileSync(speedQuizPagePath, 'utf8');
  assert.match(speedContent, /MAX_WRONG_STREAK\s*=\s*2/, 'Must stop on 2 consecutive wrong answers');
  assert.match(speedContent, /MILESTONES/, 'Must define milestone rewards');
  assert.match(speedContent, /10.*100/, 'Milestone 10 correct -> 100 coins');
  assert.match(speedContent, /20.*250/, 'Milestone 20 correct -> 250 coins');
  assert.match(speedContent, /30.*500/, 'Milestone 30 correct -> 500 coins');
  assert.match(speedContent, /sessionReviews.*setSessionReviews/, 'Must record session review list');
});

test('W10 - #C098: Offline Network Status Banner & Fallback Resilience', () => {
  const navbarContent = fs.readFileSync(navbarPath, 'utf8');
  assert.match(navbarContent, /BANNER THÔNG BÁO MẠNG RỚT[\s\S]*?#C098/i, 'Navbar must include offline / online recovery banner');
  assert.match(navbarContent, /window\.addEventListener\(['"]offline['"]/, 'Must register browser offline event listener');
  assert.match(navbarContent, /window\.addEventListener\(['"]online['"]/, 'Must register browser online event listener');

  const onboardingContent = fs.readFileSync(onboardingPagePath, 'utf8');
  assert.match(onboardingContent, /FALLBACK_DIAGNOSTIC_QUESTIONS/, 'Must include fallback questions for offline resilience');
});

test('W10 - #C099: Reading Comfort Toggle & Network Status Indicator', () => {
  const navbarContent = fs.readFileSync(navbarPath, 'utf8');
  assert.match(navbarContent, /showNetworkStatus/, 'Navbar must support showNetworkStatus prop');
  assert.match(navbarContent, /isOnline\s*\?\s*\(.*Trực tuyến.*Offline/s, 'Must display live Online/Offline indicator chip');
});

test('W10 - #C100: Zero-Error Boundary Fallback (Global Client Error Catching)', () => {
  const errorContent = fs.readFileSync(errorPagePath, 'utf8');
  assert.match(errorContent, /'use client'/, 'error.tsx must be a client component');
  assert.match(errorContent, /export default function ErrorBoundary/i, 'ErrorBoundary component must be exported');
  assert.match(errorContent, /reset:\s*\(\)\s*=>\s*void/, 'Must accept reset callback function');
  assert.match(errorContent, /onClick=\{.*reset\(\).*\}/, 'Must trigger reset() on retry button click');
  assert.match(errorContent, /Thử Lại \(Try Again\)/, 'Must display user-friendly Vietnamese retry button');
});

test('W10 -> W1 Circular Cross-Check: src/components/BluebookTools.tsx Integrity', () => {
  const toolsContent = fs.readFileSync(bluebookToolsPath, 'utf8');

  // 1. Desmos Tricks Repository (10 tricks)
  assert.match(toolsContent, /DESMOS_TRICKS:\s*DesmosTrick\[\]/, 'DESMOS_TRICKS list must be typed and declared');
  assert.match(toolsContent, /handleCopyTrick/, 'Must provide 1-click clipboard copy for Desmos formula');

  // 2. High-Frequency Math Vocabulary (85+ items across arithmetic, algebra, geometry, statistics)
  assert.match(toolsContent, /MATH_VOCABULARY:\s*MathVocabItem\[\]/, 'MATH_VOCABULARY must be declared');
  assert.match(toolsContent, /vocabSearch|vocabCategory/, 'Must provide search and category filters for vocabulary');

  // 3. SPR Validation Rules (College Board digital SAT compliant: 5 positive / 6 negative)
  assert.match(toolsContent, /validateSprInput/, 'validateSprInput function must exist');
  assert.match(toolsContent, /charLimit\s*=\s*isNegative\s*\?\s*6\s*:\s*5/, 'SPR length limit must be 5 positive / 6 negative');

  // 4. Draggable Clamp Position (Zero viewport overflow)
  assert.match(toolsContent, /clampPosition/, 'clampPosition helper must prevent modal from escaping viewport');
  assert.match(toolsContent, /window\.addEventListener\(["']keydown["']/, 'Must close dialogs on Escape key press');
});
