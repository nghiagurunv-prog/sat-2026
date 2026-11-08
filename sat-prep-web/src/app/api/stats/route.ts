import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { loadEconomy } from '@/lib/economy-store';
import { computeStats } from '@/lib/stats';

/**
 * CHARACTER STATS API (implementation_plan.md §10.B.2, task #18)
 *
 * GET → chỉ số nhân vật sinh từ hiệu suất học thật (Trí Tuệ/Chính Xác/Độ Phủ →
 *       Lực Chiến nền) + bonus trang bị (từ túi đồ ảo) → Lực Chiến tổng.
 *
 * Trang bị CHỈ cộng thêm — Lực Chiến nền hoàn toàn từ năng lực SAT thật.
 */

/** Bonus Lực Chiến mỗi món trang bị ảo trong túi (cosmetic-ish, nhỏ). */
const EQUIP_BONUS_PER_ITEM = 5;

/** Khử giá trị NaN/Infinity tránh chia cho 0 khi user mới tạo chưa có bài làm (#026) */
function sanitizeNumbers<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (typeof val === 'number') {
    return (Number.isNaN(val) || !Number.isFinite(val) ? 0 : val) as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeNumbers) as unknown as T;
  }
  if (typeof val === 'object') {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = sanitizeNumbers(v);
    }
    return res as T;
  }
  return val;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    const summary = await getMasterySummary(user.id);
    const economy = await loadEconomy(user.id);

    // Bonus trang bị = số món trong túi × hệ số nhỏ (chỉ là phụ trợ, không thay
    // thế năng lực thật). Đây là dữ liệu server-authoritative từ economy.
    const inventoryCount = Array.isArray(economy?.inventory) ? economy.inventory.length : 0;
    const equipmentBonus = inventoryCount * EQUIP_BONUS_PER_ITEM;

    const stats = computeStats(summary, equipmentBonus);
    return NextResponse.json(sanitizeNumbers(stats));
  } catch (error) {
    console.error('Lỗi tính chỉ số nhân vật:', error);
    return NextResponse.json({ error: 'Failed to compute stats' }, { status: 500 });
  }
}
