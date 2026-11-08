import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { MasteryStore, SkillMastery } from './mastery';

/**
 * ============================================================================
 *  MASTERY STORE (Supabase Postgres) — Phase 1.5 / Nhóm 1.1
 * ============================================================================
 *  Đọc/ghi MasteryStore của user từ bảng `user_mastery`. Thay cho file
 *  `mastery.json` cũ (mất dữ liệu trên serverless). Theo đúng mẫu economy-store.
 *  Bảo mật bằng RLS của Supabase (auth.uid() = user_id).
 * ============================================================================
 */

/**
 * Hàng đợi khóa tuần tự hóa theo từng user trong bộ nhớ (Fix #019).
 * Chống Lost Update / Race Condition khi user trả lời hoặc chấm điểm song song nhiều câu liên tiếp.
 * Sử dụng AsyncLocalStorage để chống deadlock khi gọi lồng nhau (re-entrant) trên cùng userId.
 */
const userUpdateQueues = new Map<string, Promise<unknown>>();
const activeUserQueueContext = new AsyncLocalStorage<Set<string>>();

/**
 * Đẩy một tác vụ cập nhật vào hàng đợi của userId để thực thi tuần tự.
 */
export async function enqueueUserMasteryUpdate<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const activeSet = activeUserQueueContext.getStore();
  if (activeSet?.has(userId)) {
    return task();
  }

  const previous = userUpdateQueues.get(userId) ?? Promise.resolve();
  let resultPromise!: Promise<T>;

  const current = previous
    .catch(() => {}) // Lỗi của tác vụ trước không làm gián đoạn tác vụ tiếp theo
    .then(() => {
      const nextSet = new Set(activeSet);
      nextSet.add(userId);
      resultPromise = activeUserQueueContext.run(nextSet, task);
      return resultPromise;
    });

  userUpdateQueues.set(userId, current);

  try {
    return await current;
  } finally {
    if (userUpdateQueues.get(userId) === current) {
      userUpdateQueues.delete(userId);
    }
  }
}

export async function loadMastery(userId: string): Promise<MasteryStore> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_mastery')
    .select('skills')
    .eq('user_id', userId)
    .single();

  if (error || !data) return { skills: {} };
  return { skills: data.skills ?? {} };
}

/**
 * Lưu toàn bộ MasteryStore của user với cơ chế serialize + merge state mới nhất (Fix #019).
 */
export async function saveMastery(userId: string, store: MasteryStore): Promise<void> {
  return enqueueUserMasteryUpdate(userId, async () => {
    // Đọc lại state mới nhất từ Supabase ngay trước khi ghi
    const latest = await loadMastery(userId);
    const mergedSkills = {
      ...(latest.skills ?? {}),
      ...(store.skills ?? {}),
    };
    store.skills = mergedSkills;

    const admin = createAdminClient();
    const { error } = await admin
      .from('user_mastery')
      .upsert(
        { user_id: userId, skills: mergedSkills, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Lỗi khi lưu mastery lên Supabase:', error);
      throw new Error('Không thể lưu mastery. Vui lòng thử lại.');
    }
  });
}

/**
 * Ghi nhận cập nhật attempt/kết quả cho một hoặc nhiều skill vào DB theo cơ chế serialize + merge (Fix #019).
 */
export async function recordMasteryAttemptInDb(
  userId: string,
  updater:
    | Record<string, SkillMastery>
    | ((current: MasteryStore) => void | MasteryStore | Promise<void | MasteryStore>)
): Promise<MasteryStore> {
  return enqueueUserMasteryUpdate(userId, async () => {
    const latest = await loadMastery(userId);
    if (!latest.skills) latest.skills = {};

    if (typeof updater === 'function') {
      const result = await updater(latest);
      if (result && result.skills) {
        latest.skills = { ...latest.skills, ...result.skills };
      }
    } else {
      latest.skills = {
        ...latest.skills,
        ...updater,
      };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('user_mastery')
      .upsert(
        { user_id: userId, skills: latest.skills, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Lỗi khi lưu mastery lên Supabase (recordMasteryAttemptInDb):', error);
      throw new Error('Không thể lưu mastery. Vui lòng thử lại.');
    }

    return latest;
  });
}
