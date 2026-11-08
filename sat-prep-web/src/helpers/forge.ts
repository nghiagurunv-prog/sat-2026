export type Tier = 'Đồng' | 'Bạc' | 'Vàng' | 'Kim Cương';

export interface Equipment {
  instanceId: string;
  itemId: string;
  name: string;
  tier: Tier;
  level: number;
  icon: string;
  isBound: boolean;
}

export const getForgeCost = (tier: Tier, level: number): { coins: number; stones: number } => {
  const safeLevel = Math.max(0, Math.min(20, Math.floor(Number(level) || 0)));
  if (tier === 'Đồng') return { coins: safeLevel * 150, stones: safeLevel };
  if (tier === 'Bạc') return { coins: safeLevel * 250, stones: safeLevel };
  if (tier === 'Vàng') return { coins: safeLevel * 400, stones: safeLevel };
  if (tier === 'Kim Cương') {
    if (safeLevel < 5) return { coins: safeLevel * 1000, stones: safeLevel };
    return { coins: safeLevel * 2000, stones: safeLevel * 2 };
  }
  return { coins: safeLevel * 150, stones: safeLevel };
};

export const getMaxLevel = (tier: Tier): number => {
  if (tier === 'Kim Cương') return 10;
  return 5;
};

export const getSuccessRate = (tier: Tier, level: number): number => {
  const safeLevel = Math.max(0, Math.min(20, Math.floor(Number(level) || 0)));
  if (tier === 'Đồng') return 100;
  if (tier === 'Bạc' || tier === 'Vàng') {
    const rates: Record<number, number> = { 1: 100, 2: 90, 3: 75, 4: 50 };
    return rates[safeLevel] || 50;
  }
  if (tier === 'Kim Cương') {
    const rates: Record<number, number> = { 1: 100, 2: 90, 3: 80, 4: 65, 5: 50, 6: 40, 7: 30, 8: 20, 9: 10 };
    return rates[safeLevel] || 10;
  }
  return 100;
};

export interface UpgradeResult {
  success: boolean;
  message: string;
  newLevel: number;
  /** true nếu Bùa Bảo Hộ đã được TIÊU để chặn rớt cấp (chỉ khi fail + useBua + có bùa). */
  buaUsed: boolean;
}

/**
 * Thử cường hóa 1 trang bị (thuần). `useBua` = người chơi bật "Bùa Bảo Hộ" (tái
 * dùng Khiên Bảo Vệ Streak): khi cường hóa THẤT BẠI, nếu có bùa thì GIỮ nguyên
 * cấp (không rớt) và tiêu 1 bùa. `hasBua` cho helper biết còn bùa để tiêu không —
 * caller (context) chịu trách nhiệm trừ shield khi buaUsed=true.
 */
export const attemptUpgrade = (
  tier: Tier,
  level: number,
  useBua: boolean = false,
  hasBua: boolean = false
): UpgradeResult => {
  const safeLevel = Math.max(0, Math.min(20, Math.floor(Number(level) || 0)));
  const maxLvl = getMaxLevel(tier);
  if (safeLevel >= maxLvl) return { success: false, message: `Trang bị đã đạt cấp tối đa (+${maxLvl})!`, newLevel: safeLevel, buaUsed: false };

  const rate = getSuccessRate(tier, safeLevel);
  const roll = Math.floor(Math.random() * 100) + 1; // 1 to 100

  if (roll <= rate) {
    return { success: true, message: `Cường hóa thành công! Trang bị đạt cấp +${safeLevel + 1} 🎉`, newLevel: safeLevel + 1, buaUsed: false };
  }

  // Thất bại + BẬT bùa + còn bùa → GIỮ nguyên cấp, tiêu 1 bùa (chống rớt/vỡ).
  if (useBua && hasBua) {
    return { success: false, message: `Cường hóa thất bại nhưng 🛡️ Bùa Bảo Hộ đã giữ nguyên cấp +${safeLevel}!`, newLevel: safeLevel, buaUsed: true };
  }

  // Thất bại thường: rớt 1 cấp (nếu >1), hoặc vỡ đá giữ nguyên cấp 1.
  if (safeLevel > 1) {
    return { success: false, message: `CƯỜNG HÓA THẤT BẠI! Trang bị của bạn đã bị rớt xuống cấp +${safeLevel - 1} 😭`, newLevel: safeLevel - 1, buaUsed: false };
  }
  return { success: false, message: "Cường hóa thất bại! Đá cường hóa đã bị vỡ vụn... ⚡", newLevel: safeLevel, buaUsed: false };
};
