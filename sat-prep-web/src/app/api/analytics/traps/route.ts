import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { loadMistakes } from '@/lib/mistakes-store';

/**
 * COGNITIVE TRAP ANALYTICS API (W2 #11 — Phân tích mẫu bẫy tư duy hằng tuần).
 * Gom trap_type, root_cause, subject & hộp Leitner từ user_mistakes để phân biệt rõ
 * mất điểm do cẩu thả (careless), bẫy thời gian (time-trap), hay hổng kiến thức (conceptual).
 */

export interface TrapBreakdownItem {
  key: string;
  label: string;
  count: number;
  percent: number;
  adviceVi: string;
}

const ROOT_CAUSE_META: Record<string, { label: string; adviceVi: string }> = {
  conceptual: {
    label: 'Hổng kiến thức cốt lõi',
    adviceVi: 'Quay lại Cây Kỹ Năng ôn đúng chủ điểm yếu trước khi cày đề mới.',
  },
  careless: {
    label: 'Sai cẩu thả / Đọc lướt',
    adviceVi: 'Gạch chân cụm hỏi cuối (2x, đường kính, NOT/EXCEPT) và soát lại 5 giây trước khi chốt.',
  },
  time_trap: {
    label: 'Bẫy thời gian (>95s)',
    adviceVi: 'Nếu quá 85s chưa ra hướng, hãy cắm cờ Flag và chuyển câu để không hụt giờ cuối module.',
  },
  vocab: {
    label: 'Thiếu từ vựng / Thuật ngữ Toán Anh',
    adviceVi: 'Ôn 10 phút từ vựng Hộp 1 Leitner và mở Từ điển 85+ thuật ngữ Toán SAT.',
  },
  trap_choice: {
    label: 'Sập bẫy đáp án nhiễu College Board',
    adviceVi: 'Dùng nút gạch loại trừ 2 đáp án sai rõ nhất trước khi so sánh 2 phương án còn lại.',
  },
};

function classifyMistakeCause(m: Record<string, unknown>): string {
  const raw = `${m.root_cause ?? ''} ${m.trap_type ?? ''}`.toLowerCase();
  if (/careless|cẩu thả|ẩu|lướt|rushed|dấu/.test(raw)) return 'careless';
  if (/time|thời gian|chậm/.test(raw)) return 'time_trap';
  if (/vocab|từ vựng|meaning|thuật ngữ/.test(raw)) return 'vocab';
  if (/trap|bẫy|distractor|nhiễu/.test(raw)) return 'trap_choice';
  return 'conceptual';
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Cần đăng nhập để xem phân tích bẫy tư duy.' }, { status: 401 });
  }

  try {
    const mistakes = await loadMistakes(user.id);
    const total = mistakes.length;
    const causeCounts: Record<string, number> = {};
    const leitnerBuckets: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const trapFreq: Record<string, number> = {};

    for (const m of mistakes) {
      const rec = m as unknown as Record<string, unknown>;
      const cause = classifyMistakeCause(rec);
      causeCounts[cause] = (causeCounts[cause] || 0) + 1;
      const box = Math.min(5, Math.max(1, Number(m.box ?? 1)));
      leitnerBuckets[box] = (leitnerBuckets[box] || 0) + 1;
      const trapLabel =
        (typeof rec.trap_type === 'string' && rec.trap_type.trim()) ||
        (typeof m.skill_id === 'string' && m.skill_id.trim()) ||
        'Bẫy chung Digital SAT';
      trapFreq[trapLabel] = (trapFreq[trapLabel] || 0) + 1;
    }

    const breakdown: TrapBreakdownItem[] = Object.entries(ROOT_CAUSE_META)
      .map(([key, meta]) => {
        const count = causeCounts[key] || 0;
        return {
          key,
          label: meta.label,
          count,
          percent: total > 0 ? Math.round((count / total) * 100) : 0,
          adviceVi: meta.adviceVi,
        };
      })
      .sort((a, b) => b.count - a.count);

    const topTraps = Object.entries(trapFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([trap, count]) => ({ trap, count }));

    return NextResponse.json({
      totalMistakes: total,
      box1UrgentCount: leitnerBuckets[1],
      leitnerDistribution: leitnerBuckets,
      breakdown,
      topTraps,
      weeklySummaryVi:
        total === 0
          ? 'Chưa ghi nhận câu sai nào trong sổ tay. Hãy làm bài luyện tập để AI phân tích mẫu bẫy tư duy!'
          : `Nguyên nhân mất điểm lớn nhất tuần này: ${breakdown[0].label} (${breakdown[0].percent}%). Khuyến nghị: ${breakdown[0].adviceVi}`,
    });
  } catch (err) {
    console.error('GET /api/analytics/traps:', err);
    return NextResponse.json({ error: 'Không thể tải dữ liệu phân tích bẫy tư duy.' }, { status: 500 });
  }
}
