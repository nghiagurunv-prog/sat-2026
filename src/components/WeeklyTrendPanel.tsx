'use client';

/**
 * WEEKLY TREND PANEL — mini-chart xu hướng điểm 7 ngày (dùng chung).
 * Dùng ở /dashboard (học sinh, tự fetch /api/progress/weekly) và trong
 * ParentReport (phụ huynh, nhận trend qua props từ /api/parent/report).
 */

export interface WeeklyTrend {
  latestTotal: number | null;
  weekAgoTotal: number | null;
  scoreDelta: number;
  attemptsThisWeek: number;
  series: Array<{ date: string; total: number }>;
  activeDays: number;
}

/**
 * Span TỐI THIỂU của trục Y (điểm SAT). Không auto-scale sát min/max — nếu để
 * range = max-min thì thay đổi +10 điểm (0.6% thang 1600) sẽ vẽ thành đường dốc
 * gần hết chiều cao, THỔI PHỒNG tiến bộ. Neo span ≥ 200 để delta nhỏ hiện đúng
 * tỉ lệ (10/200 = 5% cao), delta lớn vẫn lấp đầy biểu đồ.
 */
const MIN_TREND_SPAN = 200;

export function WeeklyTrendPanel({ trend }: { trend: WeeklyTrend }) {
  const series = Array.isArray(trend?.series) ? trend.series : [];
  const hasChart = series.length >= 2;
  const trendW = 280;
  const trendH = 80;

  // Min/max/range tính MỘT LẦN (dùng chung path + circle), span neo tối thiểu.
  const totals = series.map((s) => (Number.isFinite(s?.total) ? s.total : 0));
  const rawMin = totals.length ? Math.min(...totals) : 0;
  const rawMax = totals.length ? Math.max(...totals) : 0;
  const span = Math.max(rawMax - rawMin, MIN_TREND_SPAN) || 1;
  const mid = (rawMin + rawMax) / 2;
  const min = mid - span / 2;

  // Chống chia cho 0, NaN/Infinity hoặc chiều cao bar âm/vượt 100%
  const yOf = (total: number) => {
    const safeTotal = Number.isFinite(total) ? total : 0;
    const ratio = span > 0 ? (safeTotal - min) / span : 0;
    const clampedRatio = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
    return trendH - clampedRatio * (trendH - 10) - 5;
  };

  const trendPath = hasChart
    ? series
        .map((s, i) => {
          const divisor = Math.max(1, series.length - 1);
          const x = (i / divisor) * trendW;
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yOf(s.total).toFixed(1)}`;
        })
        .join(' ')
    : '';

  const scoreDelta = Number.isFinite(trend?.scoreDelta) ? trend.scoreDelta : 0;
  const activeDays = Math.max(0, trend?.activeDays ?? 0);
  const attemptsThisWeek = Math.max(0, trend?.attemptsThisWeek ?? 0);

  return (
    <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730]" role="region" aria-label="Biểu đồ xu hướng điểm 7 ngày">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-white">📊 Xu hướng 7 ngày</h3>
        {/* Badge delta chỉ hiện khi có ≥2 ngày — 1 snapshot thì delta luôn +0 (gây hiểu nhầm). */}
        {hasChart && (
          <span className={`text-sm font-bold ${scoreDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {scoreDelta >= 0 ? '⬆️ +' : '⬇️ '}{scoreDelta} điểm
          </span>
        )}
      </div>
      {hasChart ? (
        <>
          <svg width={trendW} height={trendH} className="w-full" aria-hidden="true">
            <path d={trendPath} fill="none" stroke="#34d399" strokeWidth="2" />
            {series.map((s, i) => {
              const divisor = Math.max(1, series.length - 1);
              const x = (i / divisor) * trendW;
              return <circle key={i} cx={x} cy={yOf(s.total)} r="3" fill="#34d399" />;
            })}
          </svg>
          <p className="text-xs text-gray-400 mt-1">{activeDays} ngày hoạt động · {attemptsThisWeek} câu luyện tuần này</p>
        </>
      ) : (
        <p className="text-gray-500 text-sm">Cần ít nhất 2 ngày học để hiện xu hướng. Hãy luyện đều mỗi ngày!</p>
      )}
    </div>
  );
}
