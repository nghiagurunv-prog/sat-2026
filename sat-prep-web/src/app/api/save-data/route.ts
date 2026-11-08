import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { getUserDataPath } from '@/lib/user-data';
import { saveProgressRaw, getProgressFromDb, saveProgressToDb, mergeProgress } from '@/lib/progress-store';
import fs from 'fs';

const SECRET_KEY: string = (() => {
  const s = process.env.SAT_PREP_SECRET;
  if (!s) {
    throw new Error(
      'SAT_PREP_SECRET chưa được set. Bắt buộc cấu hình biến môi trường này (không còn fallback mặc định yếu).'
    );
  }
  return s;
})();

// Hàm sắp xếp key của Object (để đảm bảo JSON stringify luôn ra cùng 1 chuỗi)
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

function generateSignature(data: Record<string, unknown>): string {
  const dataCopy = { ...data };
  delete dataCopy.signature; // Bỏ field signature khi tính toán

  const sortedData = sortKeys(dataCopy);
  const dataStr = JSON.stringify(sortedData);

  return crypto.createHmac('sha256', SECRET_KEY).update(dataStr, 'utf-8').digest('hex');
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const data = await req.json();

    // 🛡️ CHỐNG LỖI "EMPTY-STATE WIPE" (#020) & XUNG ĐỘT ĐA TAB (#022):
    // Khi học sinh đăng nhập trên thiết bị mới, state khởi tạo ban đầu có thể là rỗng (totalXP = 0).
    // Nếu client vô tình sync state rỗng này lên trước khi kịp load dữ liệu cũ về, toàn bộ
    // thành tích học tập sẽ bị xóa sạch nếu ghi đè thẳng tay.
    let finalData = { ...data };
    try {
      const existing = await getProgressFromDb(user.id);
      if (existing && !data.forceReset) {
        const incomingXP = typeof data.totalXP === 'number'
          ? data.totalXP
          : (typeof data.user_stats?.xp === 'number' ? data.user_stats.xp : 0);

        const incomingCompletedCount = Array.isArray(data.completedPracticeIds)
          ? data.completedPracticeIds.length
          : (Array.isArray(data.practice_question?.history) ? data.practice_question.history.length : 0);

        const existingXP = typeof existing.totalXP === 'number'
          ? existing.totalXP
          : (typeof (existing as any).user_stats?.xp === 'number' ? (existing as any).user_stats.xp : 0);

        const existingCompletedCount = Array.isArray(existing.completedPracticeIds)
          ? existing.completedPracticeIds.length
          : (Array.isArray((existing as any).practice_question?.history) ? (existing as any).practice_question.history.length : 0);

        const isIncomingEmpty = incomingXP === 0 && incomingCompletedCount === 0;
        const hasExistingData = existingXP > 0 || existingCompletedCount > 0;

        if (isIncomingEmpty && hasExistingData) {
          // TUYỆT ĐỐI KHÔNG ghi đè bằng state rỗng. Hợp nhất hoặc giữ nguyên existing
          try {
            finalData = mergeProgress(existing, data);
          } catch {
            finalData = {
              ...existing,
              ...data,
              totalXP: existingXP,
              completedPracticeIds: existing.completedPracticeIds || []
            };
          }
        } else {
          // Luôn ưu tiên dùng mergeProgress(existing, incoming) khi existing tồn tại để tránh mất XP/Streak giữa nhiều tab
          try {
            finalData = mergeProgress(existing, data);
          } catch {
            finalData = data;
          }
        }
      }
    } catch (checkErr) {
      console.warn("Lỗi khi kiểm tra dữ liệu hiện có trên DB:", checkErr);
    }

    // ⚠️ LƯU Ý ANTI-CHEAT (implementation_plan.md §9.1, task #2):
    // Chữ ký HMAC dưới đây CHỈ chống sửa file tay, KHÔNG xác thực tính hợp lệ
    // của số liệu client gửi lên. Việc chuyển kinh tế sang server-authoritative
    // được theo dõi ở task #2. Ở đây chỉ thêm scope theo user_id (task #1).
    const signature = generateSignature(finalData);
    const dataToSave = { ...finalData, signature };
    // CHUỖI JSON đã ký — ghi NGUYÊN chuỗi này (raw string) để HMAC verify khi
    // đọc lại khớp byte-cho-byte (xem progress-store.ts).
    const serialized = JSON.stringify(dataToSave, null, 2);

    // Đồng bộ structured progress vào DB (nếu có bảng/trường tương thích)
    try {
      await saveProgressToDb(user.id, finalData);
    } catch (dbErr) {
      console.warn("Lưu structured progress vào DB không thành công (tiếp tục lưu raw):", dbErr);
    }

    // Ưu tiên Supabase (bền vững qua deploy serverless). FAIL-SAFE: bảng chưa
    // có / user không phải uuid / lỗi → false → fallback ghi file như cũ.
    const savedToDb = await saveProgressRaw(user.id, serialized);
    if (!savedToDb) {
      const filePath = getUserDataPath(user.id, 'streak_data.json');
      fs.writeFileSync(filePath, serialized, 'utf-8');
    }

    return NextResponse.json({ success: true, message: "Data saved securely", data: finalData });
  } catch (error) {
    console.error("Lỗi khi ghi dữ liệu:", error);
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
  }
}
