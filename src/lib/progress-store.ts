import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

/**
 * ============================================================================
 *  USER PROGRESS STORE (Supabase) — streak/inventory/quests (§4.1 / task 4.1)
 * ============================================================================
 *  Sổ tiến trình "nền" của mỗi user: streak, shield, inventory, quests,
 *  practice-history, pet... — TẤT CẢ số liệu KHÔNG-đổi-ra-tiền-thật (coins/xp/
 *  level đã chuyển sang server-authoritative `/api/economy` + `/api/skill-tree`
 *  từ T7). Thay cho file `data/users/<id>/streak_data.json` (fs → reset mỗi
 *  cold-start serverless → mất streak/inventory sau mỗi deploy trên Vercel).
 *
 *  🔐 HMAC GIỮ NGUYÊN BYTE-CHO-BYTE: route save-data KÝ blob (HMAC-SHA256) rồi
 *  đưa NGUYÊN CHUỖI JSON đã ký xuống đây; load-data đọc lại CHUỖI ĐÓ rồi verify.
 *  ⚠️ VÌ SAO cột `text` chứ KHÔNG `jsonb`: jsonb chuẩn hóa lại số/thứ tự key →
 *  chuỗi đọc ra KHÁC chuỗi đã ký → HMAC lệch → bị coi là "gian lận" → XÓA sạch
 *  tiến trình mỗi lần reload. Lưu raw string → store chỉ là I/O thuần, HMAC ở
 *  route KHÔNG đổi 1 dòng.
 *
 *  🔓 FAIL-SAFE (memory 2026-07-02, task rủi ro CAO nên bảo thủ): bảng CHƯA có /
 *  user KHÔNG phải uuid (local-default-user) / lỗi → trả null (load) hoặc false
 *  (save) → route FALLBACK về đọc/ghi FILE như cũ → 0 regression pre-migration.
 *  Sau khi user chạy `user_progress.sql` → tiến trình bền vững qua deploy.
 *
 *  Đây là bảng THEO USER (khác questions/ai_chat_cache/ai_cost_ledger dùng
 *  chung) → RLS `auth.uid()=user_id` giống 4 bảng user_* của Nhóm 1.
 * ============================================================================
 */

// Hàm sắp xếp key của Object để tính HMAC đồng bộ với save-data & load-data
function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  const sortedKeys = Object.keys(obj).sort();
  const result: { [key: string]: unknown } = {};
  for (const key of sortedKeys) {
    result[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return result;
}

/**
 * Prune unbounded arrays in progress object (Fix #022 - Prune Unbounded JSONB Arrays).
 * Giới hạn mảng lịch sử (history, recentScores, sessions, wrong_answers, etc.)
 * tối đa 200 phần tử gần nhất (.slice(-200)) để tránh phình to dữ liệu qua nhiều năm học.
 */
export function pruneProgressArrays<T>(obj: T, maxLimit: number = 200): { pruned: T; changed: boolean } {
  if (!obj || typeof obj !== 'object') return { pruned: obj, changed: false };
  if (Array.isArray(obj)) return { pruned: obj, changed: false };

  let hasChanged = false;
  const result: Record<string, unknown> = { ...(obj as Record<string, unknown>) };

  for (const key of Object.keys(result)) {
    const val = result[key];
    const isTargetArrayKey =
      key === 'history' ||
      key === 'recentScores' ||
      key === 'sessions' ||
      key === 'wrong_answers' ||
      /history|sessions|recentscores/i.test(key);

    if (Array.isArray(val) && isTargetArrayKey) {
      if (val.length > maxLimit) {
        result[key] = val.slice(-maxLimit);
        hasChanged = true;
      }
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      const nested = pruneProgressArrays(val, maxLimit);
      if (nested.changed) {
        result[key] = nested.pruned;
        hasChanged = true;
      }
    }
  }

  return { pruned: result as T, changed: hasChanged };
}

/**
 * Đọc CHUỖI JSON tiến trình đã ký của user. null nếu chưa có / lỗi / bảng
 * chưa tồn tại → caller fallback về file.
 */
export async function loadProgressRaw(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_progress')
      .select('data_json')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return typeof data.data_json === 'string' ? data.data_json : null;
  } catch (e) {
    console.error('Lỗi đọc user_progress:', e);
    return null;
  }
}

/**
 * Ghi tiến trình vào Supabase với tính năng Prune Unbounded Arrays (Fix #022).
 * Giới hạn mảng lịch sử tối đa 200 phần tử gần nhất trước khi upsert vào DB.
 */
export async function saveProgressToDb(
  userId: string,
  progressData: Record<string, unknown> | string
): Promise<boolean> {
  try {
    let finalJson: string;

    if (typeof progressData === 'string') {
      try {
        const parsed = JSON.parse(progressData);
        if (parsed && typeof parsed === 'object') {
          const { pruned, changed } = pruneProgressArrays(parsed, 200);
          if (changed) {
            // Nếu có HMAC signature và secret key, tính toán lại chữ ký để load-data không bị lệch HMAC
            const secret = process.env.SAT_PREP_SECRET;
            if (typeof (pruned as Record<string, unknown>).signature === 'string' && secret) {
              const toSign = { ...(pruned as Record<string, unknown>) };
              delete toSign.signature;
              const sorted = sortKeys(toSign);
              const dataStr = JSON.stringify(sorted);
              (pruned as Record<string, unknown>).signature = crypto
                .createHmac('sha256', secret)
                .update(dataStr, 'utf-8')
                .digest('hex');
            }
            finalJson = JSON.stringify(pruned, null, 2);
          } else {
            finalJson = progressData;
          }
        } else {
          finalJson = progressData;
        }
      } catch {
        finalJson = progressData;
      }
    } else {
      const { pruned } = pruneProgressArrays(progressData, 200);
      finalJson = JSON.stringify(pruned, null, 2);
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('user_progress')
      .upsert(
        { user_id: userId, data_json: finalJson, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Lỗi ghi user_progress:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Lỗi ghi user_progress:', e);
    return false;
  }
}

/**
 * Ghi CHUỖI JSON tiến trình đã ký (upsert theo user_id). Trả về true nếu ghi
 * không lỗi; false nếu lỗi / bảng chưa có → caller fallback về ghi file.
 * Gọi saveProgressToDb để đảm bảo prune unbounded arrays (Fix #022).
 */
export async function saveProgressRaw(userId: string, dataJson: string): Promise<boolean> {
  return saveProgressToDb(userId, dataJson);
}

/**
 * Đọc tiến trình dưới dạng Object từ DB (phục vụ kiểm tra Empty-State Wipe #020 & Merge #022).
 */
export async function getProgressFromDb(userId: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await loadProgressRaw(userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Hợp nhất tiến trình đa tab / đa thiết bị (Fix #020 & #022):
 * Giữ giá trị lớn hơn cho XP/streak, hợp nhất (Set union) danh sách câu đã làm và lịch sử.
 */
export function mergeProgress(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  if (!existing || typeof existing !== 'object') return incoming;
  if (!incoming || typeof incoming !== 'object') return existing;

  const merged: Record<string, unknown> = { ...existing, ...incoming };

  if (typeof existing.totalXP === 'number' || typeof incoming.totalXP === 'number') {
    merged.totalXP = Math.max(
      typeof existing.totalXP === 'number' ? existing.totalXP : 0,
      typeof incoming.totalXP === 'number' ? incoming.totalXP : 0
    );
  }

  const exStats = existing.user_stats as Record<string, unknown> | undefined;
  const inStats = incoming.user_stats as Record<string, unknown> | undefined;
  if (exStats && inStats && typeof exStats === 'object' && typeof inStats === 'object') {
    merged.user_stats = {
      ...exStats,
      ...inStats,
      xp: Math.max(Number(exStats.xp) || 0, Number(inStats.xp) || 0),
      level: Math.max(Number(exStats.level) || 1, Number(inStats.level) || 1),
      streak: Math.max(Number(exStats.streak) || 0, Number(inStats.streak) || 0),
    };
  }

  if (Array.isArray(existing.completedPracticeIds) || Array.isArray(incoming.completedPracticeIds)) {
    const set = new Set<string>([
      ...(Array.isArray(existing.completedPracticeIds) ? (existing.completedPracticeIds as string[]) : []),
      ...(Array.isArray(incoming.completedPracticeIds) ? (incoming.completedPracticeIds as string[]) : []),
    ]);
    merged.completedPracticeIds = Array.from(set).slice(-2000);
  }

  const { pruned } = pruneProgressArrays(merged, 200);
  return pruned;
}
