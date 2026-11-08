/**
 * ============================================================================
 *  ECONOMY CORE (server-authoritative) — implementation_plan.md §9.1, task #2
 * ============================================================================
 *  🔴 ĐÂY LÀ LÕI CHỐNG GIAN LẬN. Nguyên tắc: client gửi HÀNH ĐỘNG ("trả lời
 *  đúng", "mua", "quay"), SERVER quyết phần thưởng. Số xu/XP thưởng lấy từ
 *  REWARD SCHEDULE cố định ở server — client KHÔNG được gửi số tiền tùy ý.
 *
 *  Vì sao trọng yếu: xu đổi được quà THẬT (§9.6). Trước đây mọi tính toán nằm
 *  ở client (GamificationContext) và server ký HMAC lên bất kỳ số nào client
 *  gửi → ai cũng tự cộng xu. Module này đảo ngược điều đó.
 *
 *  QUYẾT ĐỊNH ĐÃ CHỐT (§10):
 *    • KHÔNG còn Level phẳng — tiến trình do Skill Tree (task #17). Economy chỉ
 *      giữ xu (tiền tệ) + XP (điểm tích lũy) + túi đồ ảo.
 *    • Vòng quay CHỈ trao đồ ẢO (skin/đá cường hóa/xu) — KHÔNG quà thật qua
 *      cơ chế ngẫu nhiên (tránh loot box). Quà thật đổi bằng xu theo cách xác định.
 *
 *  ⚠️ THUẦN (pure) — không I/O. Random + "hôm nay" được TIÊM vào (dependency
 *  injection) để unit-test xác định được. Tầng I/O + HMAC nằm ở economy-store.ts.
 * ============================================================================
 */

import { QUEST_REWARD_MAP } from './quests';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface EconomyState {
  coins: number;
  xp: number;
  inventory: string[];   // id vật phẩm ẢO đã sở hữu
  lastSpinDate: string | null;
}

export const DEFAULT_ECONOMY: EconomyState = {
  coins: 100,
  xp: 0,
  inventory: [],
  lastSpinDate: null,
};

/**
 * Lấy ngày hôm nay theo múi giờ Việt Nam (UTC+7, YYYY-MM-DD).
 * Fix #025: Dùng cho mọi mốc reset hằng ngày (streak, spin, quest, pvp).
 */
export function getTodayVN(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

export const todayVN = getTodayVN;

/**
 * BẢNG THƯỞNG CỐ ĐỊNH Ở SERVER cho mỗi câu trả lời đúng, theo độ khó.
 * Client KHÔNG được phép gửi số thưởng — chỉ gửi "đúng/sai" + độ khó.
 */
export const ANSWER_REWARD: Record<Difficulty, { coins: number; xp: number }> = {
  Easy: { coins: 5, xp: 20 },
  Medium: { coins: 10, xp: 50 },
  Hard: { coins: 20, xp: 100 },
};

/**
 * Hệ số combo theo chuỗi câu ĐÚNG liên tiếp (server tự tính từ streak, client
 * không gửi số tiền). BẬC THANG (thay ngưỡng nhị phân cũ ×1.0/×1.5):
 *   <5 → ×1.0 · 5–9 → ×1.25 · 10–14 → ×1.5 · 15+ → ×1.75
 * Trần ×1.75 chỉ đạt khi đúng LIÊN TIẾP 15+ câu (hiếm, đòi năng lực thật) → là
 * phần thưởng kỹ năng, không lạm phát đại trà. Combo chỉ nhân khi câu THẬT đúng
 * (CAS answered ở /api/grade) nên không phải vector faucet.
 */
export function comboMultiplier(streak: number): number {
  if (streak >= 15) return 1.75;
  if (streak >= 10) return 1.5;
  if (streak >= 5) return 1.25;
  return 1.0;
}

export interface RewardResult {
  state: EconomyState;
  granted: { coins: number; xp: number };
}

/**
 * Áp phần thưởng cho 1 câu trả lời. Server quyết số xu/XP từ ANSWER_REWARD.
 * streak dùng để tính combo (cũng do server giữ, không tin client).
 */
export function applyAnswerReward(
  state: EconomyState,
  isCorrect: boolean,
  difficulty: Difficulty,
  streak = 0,
  coinMultiplier = 1
): RewardResult {
  if (!isCorrect) return { state, granted: { coins: 0, xp: 0 } };

  const base = ANSWER_REWARD[difficulty];
  const mult = comboMultiplier(streak);
  // Hệ số gói (TIER_COIN_MULTIPLIER) CHỈ nhân xu, KHÔNG nhân XP (xem subscription.ts).
  const coins = Math.floor(base.coins * mult * coinMultiplier);
  const xp = Math.floor(base.xp * mult);

  return {
    state: { ...state, coins: state.coins + coins, xp: state.xp + xp },
    granted: { coins, xp },
  };
}

/**
 * Trần số câu hợp lệ cho 1 bài thi. Đề SAT thật dài nhất ~98 câu (RW 54 + Math 44);
 * 200 rộng hơn mọi đề thật nhưng chặn bơm coin phi lý (audit 2026-07-03). Server
 * chấm SERVER-SIDE (applyExamRewardFromDifficulties) nên đây chỉ là lưới KẸP độ dài
 * danh sách độ khó (chống mảng phi lý), không còn tin correctCount client gửi.
 */
export const MAX_EXAM_QUESTIONS = 200;

/**
 * Phần thưởng cho 1 BÀI THI chấm SERVER-SIDE (ROOT A follow-up đường thi): thay
 * vì tin `correctCount` client gửi, server chấm từng câu với đáp án lưu ở
 * mock_exams.json rồi truyền vào đây DANH SÁCH độ khó của các câu ĐÚNG. Mỗi câu
 * đúng cộng đơn giá theo ĐỘ KHÓ THẬT của câu đó (từ đề), không phải 1 độ khó
 * client tự chọn. Danh sách bị KẸP về MAX_EXAM_QUESTIONS (chống mảng phi lý).
 */
export function applyExamRewardFromDifficulties(
  state: EconomyState,
  correctDifficulties: Difficulty[],
  coinMultiplier = 1
): RewardResult {
  const list = Array.isArray(correctDifficulties)
    ? correctDifficulties.slice(0, MAX_EXAM_QUESTIONS)
    : [];

  let coins = 0;
  let xp = 0;
  for (const d of list) {
    const rate = ANSWER_REWARD[d] ?? ANSWER_REWARD.Medium;
    coins += rate.coins;
    xp += rate.xp;
  }
  // Hệ số gói CHỈ nhân xu (áp sau khi cộng dồn để tránh sai số làm tròn từng câu).
  coins = Math.floor(coins * coinMultiplier);

  if (coins === 0 && xp === 0) return { state, granted: { coins: 0, xp: 0 } };

  return {
    state: { ...state, coins: state.coins + coins, xp: state.xp + xp },
    granted: { coins, xp },
  };
}

/**
 * BẢNG THƯỞNG NHIỆM VỤ CỐ ĐỊNH Ở SERVER, keyed theo questId.
 * Client chỉ gửi questId — KHÔNG gửi số xu/XP. Server tra bảng này → đóng vector
 * cheat (§9.1). DẪN XUẤT từ QUEST_POOL (quests.ts) → mọi biến thể quest xoay vòng
 * đều có reward, không cần bảng tay (đóng drift-risk khi thêm quest mà quên thưởng).
 * q1/q2/q3 (biến thể đầu mỗi track) vẫn có mặt → tương thích ngược.
 */
export const QUEST_REWARD: Record<string, { coins: number; xp: number }> = QUEST_REWARD_MAP;

/**
 * Phần thưởng khi NHẬN nhiệm vụ (claim quest). Server tra QUEST_REWARD theo
 * questId; questId lạ → không thưởng. Việc kiểm "đã hoàn thành/đã nhận chưa"
 * vẫn ở client (quests chưa migrate sang server) — nhưng SỐ TIỀN do server quyết.
 */
export function applyQuestReward(state: EconomyState, questId: string, coinMultiplier = 1): RewardResult {
  const reward = QUEST_REWARD[questId];
  if (!reward) return { state, granted: { coins: 0, xp: 0 } };

  const coins = Math.floor(reward.coins * coinMultiplier); // hệ số gói CHỈ nhân xu
  return {
    state: { ...state, coins: state.coins + coins, xp: state.xp + reward.xp },
    granted: { coins, xp: reward.xp },
  };
}

export interface SpendResult {
  ok: boolean;
  state: EconomyState;
  error?: string;
}

/** Gói dùng cho gate spend (free < premium < ultimate). */
export type SpendTier = 'free' | 'premium' | 'ultimate';

/** Thông tin catalog của 1 item MUA được (server tra để gate). */
export interface SpendItemInfo {
  /** Giá NIÊM YẾT ở server — client amount PHẢI khớp (chống gửi amount rẻ). */
  price: number;
  /** Gói tối thiểu để mua (nếu có). Vắng = ai cũng mua được. */
  requiredTier?: 'premium' | 'ultimate';
}

/**
 * MIRROR SERVER-SIDE giá + gate tier của item MUA ĐƯỢC trong ITEM_CATALOG
 * (GamificationContext.tsx — file 'use client', KHÔNG import được vào route server).
 * 🔴 CHỐT BẢO MẬT: client gửi {action:'spend', amount, itemId}; server tra bảng này
 * (+ COSMETIC_CATALOG cho cosmetic mua được) để kiểm giá + tier — KHÔNG tin amount
 * client gửi. Cùng triết lý rewards.ts (bản sao server của reward item). ⚠️ NẾU đổi
 * price/requiredTier trong ITEM_CATALOG, PHẢI đồng bộ ở đây (drift = giá lệch/gate hở).
 * KHÔNG chứa reward (rw_*) — quà thật đi qua /api/redeem (tạo phiếu), không qua spend.
 */
export const SPENDABLE_ITEMS: Record<string, SpendItemInfo> = {
  skin_1: { price: 1500 },
  skin_2: { price: 1800 },
  skin_3: { price: 3000, requiredTier: 'ultimate' },
  title_gold: { price: 3500, requiredTier: 'ultimate' },
  theme_fire: { price: 4000, requiredTier: 'ultimate' },
  eq_epic_1: { price: 800 },
  eq_epic_2: { price: 850 },
  eq_leg_1: { price: 5000 },
  eq_leg_2: { price: 6000 },
  shield_1: { price: 50 },
  mana_1: { price: 30 },
  exp_1: { price: 200 },
  sinh_menh_dan: { price: 100 },
  ve_skip_cau: { price: 150 },
};

function spendTierRank(t: SpendTier | undefined): number {
  if (t === 'ultimate') return 2;
  if (t === 'premium') return 1;
  return 0;
}

/**
 * Trừ xu (mua hàng). Server kiểm tra số dư — client không tự trừ.
 *
 * 🔴 GATE BẢO MẬT (khi caller truyền `opts` — route economy PHẢI truyền để gate có
 * hiệu lực): với itemId có mặt, kiểm (a) item có trong catalog, (b) amount KHỚP giá
 * niêm yết, (c) đủ tier nếu item.requiredTier. Caller CŨ/test KHÔNG truyền opts →
 * giữ hành vi legacy (chỉ trừ xu + thêm túi) để 0 regression.
 */
export function applySpend(
  state: EconomyState,
  amount: number,
  itemId?: string,
  opts?: { userTier?: SpendTier; item?: SpendItemInfo | null; itemKnown?: boolean }
): SpendResult {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, state, error: 'Số xu không hợp lệ' };
  }

  // Cổng item CHỈ chạy khi caller cung cấp opts (route economy). Bỏ qua nếu không có
  // itemId (spend chung: rèn/skip câu... trừ xu thuần) hoặc caller legacy không gate.
  if (opts && itemId) {
    if (!opts.itemKnown || !opts.item) {
      return { ok: false, state, error: 'Vật phẩm không tồn tại trong cửa hàng.' };
    }
    if (opts.item.price !== amount) {
      return { ok: false, state, error: 'Số xu không khớp giá niêm yết của vật phẩm.' };
    }
    if (opts.item.requiredTier && spendTierRank(opts.userTier) < spendTierRank(opts.item.requiredTier)) {
      const label = opts.item.requiredTier === 'ultimate' ? 'Ultimate' : 'Premium';
      return {
        ok: false,
        state,
        error: `Vật phẩm này chỉ dành cho gói ${label}. Hãy nâng cấp gói để mở khóa.`,
      };
    }
  }

  if (state.coins < amount) {
    return { ok: false, state, error: 'Không đủ xu' };
  }
  const next: EconomyState = { ...state, coins: state.coins - amount };
  if (itemId) next.inventory = [...state.inventory, itemId];
  return { ok: true, state: next };
}

/** Phần thưởng ẢO của vòng quay (KHÔNG có quà thật — §9.6). */
export const SPIN_VIRTUAL_ITEMS = ['skin_1', 'skin_2', 'skin_3', 'eq_epic_1', 'eq_epic_2'];

export interface SpinResult {
  ok: boolean;
  state: EconomyState;
  result: {
    type: 'coins' | 'item' | 'epic' | 'none';
    message: string;
    coins?: number;
    itemId?: string;
  };
}

/**
 * Vòng quay may mắn — CHẠY Ở SERVER. rng() trả [0,1). Chỉ trao đồ ẢO.
 * Giới hạn 1 lượt/ngày (so theo `today` server cấp, không tin client).
 */
export function applySpin(state: EconomyState, today: string, rng: () => number): SpinResult {
  if (state.lastSpinDate === today) {
    return {
      ok: false,
      state,
      result: { type: 'none', message: 'Hôm nay bạn đã quay rồi. Quay lại vào ngày mai nhé!' },
    };
  }

  const spun: EconomyState = { ...state, lastSpinDate: today };
  const roll = rng() * 100;

  if (roll < 80) {
    const coins = Math.floor(rng() * 151) + 50; // 50..200
    return {
      ok: true,
      state: { ...spun, coins: spun.coins + coins },
      result: { type: 'coins', coins, message: `Thần tài gõ cửa! Nhận ${coins} Xu!` },
    };
  } else if (roll < 95) {
    return {
      ok: true,
      state: { ...spun, inventory: [...spun.inventory, 'da_cuong_hoa'] },
      result: { type: 'item', itemId: 'da_cuong_hoa', message: 'Nhận được 1 Đá Cường Hóa Lò Rèn!' },
    };
  } else {
    const idx = Math.floor(rng() * SPIN_VIRTUAL_ITEMS.length);
    const itemId = SPIN_VIRTUAL_ITEMS[idx];
    return {
      ok: true,
      state: { ...spun, inventory: [...spun.inventory, itemId] },
      result: { type: 'epic', itemId, message: `BÙNG NỔ! Trúng cực phẩm: ${itemId}!` },
    };
  }
}

/**
 * ============================================================================
 *  PvP COMBAT (server-authoritative) — nợ kỹ thuật T7, làm 2026-07-01
 * ============================================================================
 *  Nguyên tắc giống mọi action economy: client gửi HÀNH ĐỘNG (thách đấu rank X),
 *  SERVER quyết thắng/thua + phần thưởng. Hai khác biệt cốt lõi so với bản cũ
 *  (client-side, gameable):
 *
 *    1. LỰC CHIẾN = NĂNG LỰC HỌC THẬT. combatPower = basePower (computeStats,
 *       từ mastery 0..100) × PVP_COMBAT_SCALE → đưa về cùng thang với luc_chien
 *       của đối thủ (120..4000). Trang bị KHÔNG bơm được lực PvP (chống pay/grind
 *       -to-win) — chỉ học thật mới lên power.
 *
 *    2. CỔNG NĂNG LỰC khoá phần thưởng cao theo học thật: chỉ đủ điều kiện đánh
 *       khi combatPower >= luc_chien × PVP_MIN_POWER_RATIO. Muốn ăn thưởng rank
 *       cao (tới 15000 xu) buộc phải có mastery cao → không thể "nhảy rank" ăn xu.
 *
 *  rng() được TIÊM để unit-test xác định (như applySpin).
 * ============================================================================
 */

/** Hệ số quy đổi basePower (0..100) → thang lực chiến đối thủ (120..4000). */
export const PVP_COMBAT_SCALE = 40;

/** Tỉ lệ lực tối thiểu (so với đối thủ) để được phép thách đấu. */
export const PVP_MIN_POWER_RATIO = 0.5;

export interface PvpOpponentInput {
  /** basePower của người chơi (0..100) từ computeStats — server tính, không tin client. */
  basePower: number;
  /** Lực chiến đối thủ (luc_chien trong PVP_OPPONENTS). */
  opponentPower: number;
  /** Phần thưởng nếu thắng (reward_coins / reward_xp của đối thủ). */
  rewardCoins: number;
  rewardXp: number;
}

export interface PvpFightResult {
  /** Có đủ điều kiện thách đấu không (qua cổng năng lực). */
  eligible: boolean;
  /** Thắng hay thua (chỉ có nghĩa khi eligible). */
  won: boolean;
  /** Lực chiến quy đổi của người chơi (để client hiển thị). */
  combatPower: number;
  state: EconomyState;
  granted: { coins: number; xp: number };
  /** Thông điệp khi KHÔNG đủ điều kiện (eligible=false). */
  reason?: string;
}

/**
 * Giải 1 trận PvP. Server quyết tất cả: cổng năng lực, RNG thắng/thua, phần thưởng.
 * Chỉ cộng xu/XP khi ĐỦ ĐIỀU KIỆN và THẮNG. Thua / không đủ điều kiện → state
 * không đổi (không trao thưởng, không trừ gì — PvP không mất phí lượt ở bản này).
 */
export function resolvePvpFight(
  state: EconomyState,
  input: PvpOpponentInput,
  rng: () => number,
  coinMultiplier = 1
): PvpFightResult {
  const basePower = Math.max(0, Math.floor(input.basePower));
  const combatPower = basePower * PVP_COMBAT_SCALE;
  const opp = Math.max(0, Math.floor(input.opponentPower));

  // Cổng năng lực: phải đủ mạnh (từ học thật) mới được thách đấu rank này.
  if (combatPower < opp * PVP_MIN_POWER_RATIO) {
    return {
      eligible: false,
      won: false,
      combatPower,
      state,
      granted: { coins: 0, xp: 0 },
      reason:
        'Lực chiến chưa đủ để thách đấu đối thủ này. Hãy luyện thêm để nâng năng lực thật (mastery) rồi quay lại!',
    };
  }

  // Xác suất thắng tỉ lệ theo tương quan lực — học càng giỏi, thắng càng chắc.
  const total = combatPower + opp;
  const winProb = total > 0 ? combatPower / total : 0;
  const won = rng() < winProb;

  if (!won) {
    return { eligible: true, won: false, combatPower, state, granted: { coins: 0, xp: 0 } };
  }

  const coins = Math.max(0, Math.floor(input.rewardCoins * coinMultiplier)); // hệ số gói CHỈ nhân xu
  const xp = Math.max(0, Math.floor(input.rewardXp));
  return {
    eligible: true,
    won: true,
    combatPower,
    state: { ...state, coins: state.coins + coins, xp: state.xp + xp },
    granted: { coins, xp },
  };
}

/**
 * ============================================================================
 *  PvP ANTI-FAUCET — rank server-authoritative + cap trận/ngày
 * ============================================================================
 *  Lỗ hổng đã biết (review 2026-07-01): rank chỉ ở client → server không kiểm
 *  được targetRank hợp lệ; không cooldown → account giỏi script ăn jackpot 15000
 *  xu vô hạn. Hai chốt (THUẦN, ráp vào route sau khi DB có cột):
 *    1. RANK VALIDITY: chỉ cho đánh ĐÚNG đối thủ kế trên (targetRank === rank-1).
 *       → phải leo 11→10→…→1 tuần tự, KHÔNG nhảy thẳng rank 1; thắng mới lên hạng,
 *         không re-farm hạng đã qua.
 *    2. CAP/NGÀY: tối đa PVP_MAX_FIGHTS_PER_DAY trận-tính-điểm/ngày (reset sang
 *       ngày mới theo `today` server cấp — cùng mẫu user_ai_usage.date).
 *  Rank: 11 = Tân Binh (mặc định), càng NHỎ càng cao, 1 = đỉnh (hết đối thủ).
 * ============================================================================
 */

/** Trần số trận PvP tính-điểm mỗi ngày (chống farm xu lặp). */
export const PVP_MAX_FIGHTS_PER_DAY = 10;

export interface PvpAttemptCheck {
  allowed: boolean;
  reason?: string;
  /** Số trận còn lại trong ngày SAU khi đã reset theo ngày (chưa trừ trận này). */
  fightsRemaining: number;
}

/** Số trận đã đánh HÔM NAY, có reset nếu lastFightDate khác today. */
function fightsTodayEffective(fightsToday: number, lastFightDate: string, today: string): number {
  if (lastFightDate !== today) return 0;
  return Number.isInteger(fightsToday) && fightsToday > 0 ? fightsToday : 0;
}

/**
 * Kiểm tra 1 lượt thách đấu có hợp lệ không (TRƯỚC khi xét cổng năng lực).
 * Thuần — nhận state PvP server qua tham số, không I/O.
 */
export function checkPvpAttempt(
  currentRank: number,
  targetRank: number,
  fightsToday: number,
  lastFightDate: string,
  today: string,
  maxFights: number = PVP_MAX_FIGHTS_PER_DAY
): PvpAttemptCheck {
  // Cap hiệu lực = MIN(cap tuyệt đối, cap theo gói route truyền vào). Kẹp về [0, max]
  // để không bao giờ nới rộng quá trần tuyệt đối dù caller truyền số lớn.
  const cap = Math.max(0, Math.min(PVP_MAX_FIGHTS_PER_DAY, Math.floor(maxFights)));
  const used = fightsTodayEffective(fightsToday, lastFightDate, today);
  const remaining = Math.max(0, cap - used);

  // Chỉ được đánh đối thủ KẾ TRÊN. targetRank phải >= 1 (rank 0 không có đối thủ).
  if (!Number.isInteger(targetRank) || targetRank < 1 || targetRank !== currentRank - 1) {
    return {
      allowed: false,
      reason: 'Chỉ được thách đấu đối thủ kế tiếp trong bảng xếp hạng. Hãy leo tuần tự!',
      fightsRemaining: remaining,
    };
  }

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `Hôm nay bạn đã đấu đủ ${cap} trận. Quay lại vào ngày mai nhé!`,
      fightsRemaining: 0,
    };
  }

  return { allowed: true, fightsRemaining: remaining };
}

export interface PvpCounter {
  fightsToday: number;
  lastFightDate: string;
}

/**
 * Bộ đếm trận MỚI sau khi đánh 1 trận tính-điểm (đã qua checkPvpAttempt + cổng
 * năng lực). Reset về ngày mới nếu cần rồi +1. Gọi cho CẢ thắng lẫn thua (mỗi
 * lượt resolve đều tính vào cap).
 */
export function bumpPvpCounter(fightsToday: number, lastFightDate: string, today: string): PvpCounter {
  const used = fightsTodayEffective(fightsToday, lastFightDate, today);
  return { fightsToday: used + 1, lastFightDate: today };
}

/** Hạng MỚI sau 1 trận: thắng → leo 1 bậc (rank giảm, sàn 1); thua → giữ nguyên. */
export function nextPvpRank(currentRank: number, won: boolean): number {
  if (!won) return currentRank;
  return Math.max(1, currentRank - 1);
}

/**
 * ============================================================================
 *  ATOMIC ECONOMY OPERATIONS & CONCURRENCY CONTROLS (Fix #010, #011, #029)
 * ============================================================================
 *  Chống Race Condition Double-Spend khi mua đồ / quay thưởng / đổi quà:
 *    • spendCoins / buyShopItem: Optimistic Concurrency Control (OCC) với
 *      .eq('user_id', userId).gte('coins', cost).eq('coins', currentCoins)
 *    • spinLuckyWheel / spin: Khóa điều kiện 1 lượt/ngày chống spam song song
 *    • createRedemption: Trừ xu atomic trước khi tạo phiếu đổi quà
 *    • rejectRedemption: Đánh dấu từ chối phiếu gian lận, TUYỆT ĐỐI KHÔNG hoàn xu
 *    • cancelRedemption: Hủy phiếu và hoàn lại xu cho học sinh
 *    • fulfillRedemption: Xác nhận giao quà thành công
 * ============================================================================
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAdminClient(): Promise<any> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  return createAdminClient();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureUserEconomy(admin: any, userId: string): Promise<void> {
  await admin
    .from('user_economy')
    .upsert(
      {
        user_id: userId,
        coins: DEFAULT_ECONOMY.coins,
        xp: DEFAULT_ECONOMY.xp,
        inventory: DEFAULT_ECONOMY.inventory,
      },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );
}

/**
 * Trừ xu mua vật phẩm với khóa lạc quan (Optimistic Concurrency Control — Fix #010).
 * Nếu 2 request song song cùng đọc `coins`, chỉ 1 request trừ tiền thành công,
 * request kia nhận lỗi 'Insufficient coins or concurrent transaction detected'.
 */
export async function spendCoins(
  userId: string,
  cost: number,
  itemId?: string,
  opts?: { userTier?: SpendTier; item?: SpendItemInfo | null; itemKnown?: boolean }
): Promise<{ ok: boolean; coins?: number; inventory?: string[]; error?: string }> {
  if (!Number.isInteger(cost) || cost <= 0) {
    return { ok: false, error: 'Số xu không hợp lệ' };
  }

  // Gate item validation nếu có opts
  if (opts && itemId) {
    if (!opts.itemKnown || !opts.item) {
      return { ok: false, error: 'Vật phẩm không tồn tại trong cửa hàng.' };
    }
    if (opts.item.price !== cost) {
      return { ok: false, error: 'Số xu không khớp giá niêm yết của vật phẩm.' };
    }
    if (opts.item.requiredTier && spendTierRank(opts.userTier) < spendTierRank(opts.item.requiredTier)) {
      const label = opts.item.requiredTier === 'ultimate' ? 'Ultimate' : 'Premium';
      return {
        ok: false,
        error: `Vật phẩm này chỉ dành cho gói ${label}. Hãy nâng cấp gói để mở khóa.`,
      };
    }
  }

  const admin = await getAdminClient();
  await ensureUserEconomy(admin, userId);

  const { data: row, error: fetchErr } = await admin
    .from('user_economy')
    .select('coins, inventory')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, error: 'Không tìm thấy thông tin tài khoản hoặc lỗi kết nối.' };
  }

  const currentCoins = Number(row.coins) || 0;
  if (currentCoins < cost) {
    return { ok: false, error: 'Không đủ xu' };
  }

  const currentInventory: string[] = Array.isArray(row.inventory) ? row.inventory : [];
  const nextInventory = itemId ? [...currentInventory, itemId] : currentInventory;
  const nextCoins = currentCoins - cost;

  // Optimistic concurrency control (OCC):
  // Cập nhật với điều kiện .eq('user_id', userId).gte('coins', cost).eq('coins', currentCoins)
  // Nếu có request đồng thời trừ trước, .eq('coins', currentCoins) sẽ không match và trả về 0 rows.
  const { data: updated, error: updateErr } = await admin
    .from('user_economy')
    .update({
      coins: nextCoins,
      inventory: nextInventory,
    })
    .eq('user_id', userId)
    .gte('coins', cost)
    .eq('coins', currentCoins)
    .select('coins, inventory')
    .maybeSingle();

  if (updateErr) {
    console.error('spendCoins update error:', updateErr.message);
    return { ok: false, error: 'Lỗi giao dịch trừ xu.' };
  }

  if (!updated) {
    return { ok: false, error: 'Insufficient coins or concurrent transaction detected' };
  }

  return { ok: true, coins: updated.coins, inventory: updated.inventory };
}

export const buyShopItem = spendCoins;

/**
 * Quay Vòng Quay May Mắn với khóa chống spam song song (Fix #011).
 * Kiểm tra và cập nhật last_spin_date và coins với điều kiện OCC để chặn 10 request
 * song song nhận 10 lượt quay miễn phí.
 */
export async function spinLuckyWheel(
  userId: string,
  today: string = getTodayVN(),
  rng: () => number = Math.random
): Promise<{
  ok: boolean;
  result?: SpinResult['result'];
  state?: EconomyState;
  error?: string;
}> {
  const admin = await getAdminClient();
  await ensureUserEconomy(admin, userId);

  const { data: row, error: fetchErr } = await admin
    .from('user_economy')
    .select('coins, xp, inventory, last_spin_date')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, error: 'Không tìm thấy thông tin tài khoản.' };
  }

  const currentCoins = Number(row.coins) || 0;
  const currentXp = Number(row.xp) || 0;
  const currentInventory: string[] = Array.isArray(row.inventory) ? row.inventory : [];
  const lastSpinDate = (row.last_spin_date as string | null) ?? null;

  if (lastSpinDate === today) {
    return {
      ok: false,
      result: { type: 'none', message: 'Hôm nay bạn đã quay rồi. Quay lại vào ngày mai nhé!' },
      error: 'Hôm nay bạn đã quay rồi. Quay lại vào ngày mai nhé!',
    };
  }

  const currState: EconomyState = {
    coins: currentCoins,
    xp: currentXp,
    inventory: currentInventory,
    lastSpinDate,
  };

  const spinRes = applySpin(currState, today, rng);
  if (!spinRes.ok) {
    return { ok: false, result: spinRes.result, error: spinRes.result.message };
  }

  // OCC update:
  // Cập nhật với điều kiện last_spin_date khác today (hoặc null) VÀ coins == currentCoins
  const { data: updated, error: updateErr } = await admin
    .from('user_economy')
    .update({
      coins: spinRes.state.coins,
      inventory: spinRes.state.inventory,
      last_spin_date: today,
    })
    .eq('user_id', userId)
    .or(`last_spin_date.neq.${today},last_spin_date.is.null`)
    .eq('coins', currentCoins)
    .select('coins, xp, inventory, last_spin_date')
    .maybeSingle();

  if (updateErr) {
    console.error('spinLuckyWheel update error:', updateErr.message);
    return { ok: false, error: 'Lỗi giao dịch vòng quay.' };
  }

  if (!updated) {
    return {
      ok: false,
      error: 'Insufficient coins or concurrent transaction detected',
    };
  }

  return {
    ok: true,
    result: spinRes.result,
    state: {
      coins: updated.coins,
      xp: updated.xp,
      inventory: updated.inventory || [],
      lastSpinDate: updated.last_spin_date,
    },
  };
}

export const spin = spinLuckyWheel;

export interface RedemptionRewardInput {
  id: string;
  name: string;
  costCoins?: number;
  cost?: number;
}

/**
 * Đổi quà thật với trừ xu atomic và OCC lock (Fix #010).
 * Đảm bảo trừ xu atomic với .gte('coins', cost).eq('coins', currentCoins) trước khi tạo lệnh đổi quà.
 */
export async function createRedemption(
  userId: string,
  reward: RedemptionRewardInput | string,
  rewardName?: string,
  costCoins?: number
): Promise<{
  ok: boolean;
  redemptionId?: string;
  coins?: number;
  error?: string;
}> {
  let rId: string;
  let rName: string;
  let cost: number;

  if (typeof reward === 'object' && reward !== null) {
    rId = reward.id;
    rName = reward.name;
    cost = reward.costCoins ?? reward.cost ?? 0;
  } else if (typeof reward === 'string') {
    rId = reward;
    rName = rewardName || reward;
    cost = costCoins ?? 0;
  } else {
    return { ok: false, error: 'Thông tin phần thưởng hoặc số xu không hợp lệ' };
  }

  if (!rId || !Number.isInteger(cost) || cost <= 0) {
    return { ok: false, error: 'Thông tin phần thưởng hoặc số xu không hợp lệ' };
  }

  const admin = await getAdminClient();
  await ensureUserEconomy(admin, userId);

  const { data: eco, error: fetchErr } = await admin
    .from('user_economy')
    .select('coins')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr || !eco) {
    return { ok: false, error: 'Không tìm thấy thông tin tài khoản hoặc lỗi kết nối.' };
  }

  const currentCoins = Number(eco.coins) || 0;
  if (currentCoins < cost) {
    return { ok: false, error: 'Bạn không đủ xu để đổi phần thưởng này.' };
  }

  const nextCoins = currentCoins - cost;

  // Optimistic concurrency lock: trừ xu atomic với .gte('coins', cost).eq('coins', currentCoins)
  const { data: updated, error: deductErr } = await admin
    .from('user_economy')
    .update({ coins: nextCoins })
    .eq('user_id', userId)
    .gte('coins', cost)
    .eq('coins', currentCoins)
    .select('coins')
    .maybeSingle();

  if (deductErr || !updated) {
    return { ok: false, error: 'Insufficient coins or concurrent transaction detected' };
  }

  // Tạo lệnh đổi quà trong reward_redemptions
  const { data: inserted, error: insertErr } = await admin
    .from('reward_redemptions')
    .insert({
      user_id: userId,
      reward_id: rId,
      reward_name: rName,
      cost_coins: cost,
      status: 'pending',
    })
    .select('id')
    .maybeSingle();

  if (insertErr || !inserted) {
    console.error('createRedemption insert error, refunding coins:', insertErr?.message);
    // Compensation rollback nếu insert thất bại
    await admin
      .from('user_economy')
      .update({ coins: currentCoins })
      .eq('user_id', userId);
    return { ok: false, error: 'Không thể tạo đơn đổi quà. Xu đã được hoàn lại.' };
  }

  return {
    ok: true,
    redemptionId: inserted.id,
    coins: updated.coins,
  };
}

export interface RedemptionAdminResult {
  ok: boolean;
  status?: string;
  reason?: string;
  coins?: number;
  error?: string;
}

/**
 * Đánh dấu phiếu đổi quà đã hoàn thành (giao voucher/tài liệu cho học sinh).
 * Không hoàn xu.
 */
export async function fulfillRedemption(
  redemptionId: string,
  _adminNote?: string
): Promise<RedemptionAdminResult> {
  const admin = await getAdminClient();

  const { data: rpcData, error: rpcErr } = await admin.rpc('fulfill_redemption', {
    p_redemption_id: redemptionId,
  });

  if (!rpcErr && rpcData) {
    const res = rpcData as { ok?: boolean; reason?: string; status?: string };
    return { ok: !!res.ok, status: res.status || 'fulfilled', reason: res.reason };
  }

  const { data: row, error: fetchErr } = await admin
    .from('reward_redemptions')
    .select('id, status')
    .eq('id', redemptionId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, reason: 'not_found', error: 'Không tìm thấy phiếu đổi quà' };
  }

  if (row.status === 'fulfilled') {
    return { ok: true, status: 'fulfilled', reason: 'already' };
  }

  const { error: updateErr } = await admin
    .from('reward_redemptions')
    .update({
      status: 'fulfilled',
      fulfilled_at: new Date().toISOString(),
    })
    .eq('id', redemptionId);

  if (updateErr) {
    return { ok: false, reason: 'error', error: updateErr.message };
  }

  return { ok: true, status: 'fulfilled' };
}

/**
 * Hủy phiếu đổi quà 'pending' → 'cancelled' và HOÀN LẠI XU cho học sinh.
 * Dùng khi admin không giao được quà hợp lệ.
 */
export async function cancelRedemption(
  redemptionId: string,
  adminNote?: string
): Promise<RedemptionAdminResult> {
  const admin = await getAdminClient();

  const { data: rpcData, error: rpcErr } = await admin.rpc('cancel_redemption', {
    p_redemption_id: redemptionId,
  });

  if (!rpcErr && rpcData) {
    const res = rpcData as { ok?: boolean; reason?: string; status?: string; coins?: number };
    return { ok: !!res.ok, status: res.status || 'cancelled', reason: res.reason, coins: res.coins };
  }

  const { data: row, error: fetchErr } = await admin
    .from('reward_redemptions')
    .select('id, user_id, cost_coins, status')
    .eq('id', redemptionId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, reason: 'not_found', error: 'Không tìm thấy phiếu đổi quà' };
  }

  if (row.status === 'cancelled') {
    return { ok: true, status: 'cancelled', reason: 'already' };
  }
  if (row.status !== 'pending') {
    return { ok: false, reason: 'bad_status', error: `Phiếu ở trạng thái ${row.status}, không thể hủy.` };
  }

  // Đổi trạng thái phiếu
  const updatePayload: Record<string, unknown> = { status: 'cancelled' };
  if (adminNote) updatePayload.admin_note = adminNote;

  const { error: cancelErr } = await admin
    .from('reward_redemptions')
    .update(updatePayload)
    .eq('id', redemptionId)
    .eq('status', 'pending');

  if (cancelErr) {
    const { error: retryErr } = await admin
      .from('reward_redemptions')
      .update({ status: 'cancelled' })
      .eq('id', redemptionId)
      .eq('status', 'pending');
    if (retryErr) {
      return { ok: false, reason: 'error', error: retryErr.message };
    }
  }

  // Hoàn lại xu cho user
  const { data: eco } = await admin
    .from('user_economy')
    .select('coins')
    .eq('user_id', row.user_id)
    .maybeSingle();

  const currentCoins = Number(eco?.coins) || 0;
  const newCoins = currentCoins + Number(row.cost_coins || 0);

  const { data: refundedEco } = await admin
    .from('user_economy')
    .update({ coins: newCoins })
    .eq('user_id', row.user_id)
    .select('coins')
    .maybeSingle();

  return {
    ok: true,
    status: 'cancelled',
    coins: refundedEco?.coins ?? newCoins,
  };
}

/**
 * Tịch thu / Từ chối phiếu đổi quà (Fix #029):
 * Đánh dấu đơn là 'cancelled' (hoặc 'rejected') kèm admin_note: 'Rejected by admin (no refund)'
 * TUYỆT ĐỐI KHÔNG hoàn lại xu cho tài khoản gian lận.
 */
export async function rejectRedemption(
  redemptionId: string,
  adminNote?: string
): Promise<RedemptionAdminResult> {
  const admin = await getAdminClient();
  const note = adminNote || 'Rejected by admin (no refund)';

  const { data: row, error: fetchErr } = await admin
    .from('reward_redemptions')
    .select('id, user_id, status')
    .eq('id', redemptionId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, reason: 'not_found', error: 'Không tìm thấy phiếu đổi quà' };
  }

  if (row.status === 'cancelled' || row.status === 'rejected') {
    return { ok: true, status: row.status, reason: 'already' };
  }
  if (row.status !== 'pending') {
    return { ok: false, reason: 'bad_status', error: `Phiếu ở trạng thái ${row.status}, không thể từ chối.` };
  }

  // Thử cập nhật status = 'cancelled' (hoặc 'rejected') kèm admin_note
  // Chú ý: TUYỆT ĐỐI KHÔNG HOÀN LẠI XU vào user_economy
  const updatePayload: Record<string, unknown> = {
    status: 'cancelled',
    admin_note: note,
  };

  const { error: updateErr } = await admin
    .from('reward_redemptions')
    .update(updatePayload)
    .eq('id', redemptionId)
    .eq('status', 'pending');

  if (updateErr) {
    const { error: retryErr } = await admin
      .from('reward_redemptions')
      .update({ status: 'cancelled' })
      .eq('id', redemptionId)
      .eq('status', 'pending');

    if (retryErr) {
      return { ok: false, reason: 'error', error: retryErr.message };
    }
  }

  return {
    ok: true,
    status: 'cancelled',
    reason: 'rejected_no_refund',
  };
}

/**
 * Cập nhật trạng thái phiếu đổi quà tổng quát: 'fulfill' | 'cancel' | 'reject'
 */
export async function updateRedemptionStatus(
  redemptionId: string,
  action: 'fulfill' | 'cancel' | 'reject',
  adminNote?: string
): Promise<RedemptionAdminResult> {
  switch (action) {
    case 'fulfill':
      return fulfillRedemption(redemptionId);
    case 'cancel':
      return cancelRedemption(redemptionId, adminNote);
    case 'reject':
      return rejectRedemption(redemptionId, adminNote);
    default:
      return { ok: false, error: 'Hành động không hợp lệ' };
  }
}
