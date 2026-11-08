'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

export interface ScoreForecastData {
  total: number;
  math?: number | null;
  reading?: number | null;
  confidence?: 'low' | 'medium' | 'high' | string;
  totalAttempts?: number;
  targetScore?: number | null;
  pointsToTarget?: number | null;
  focusSkills?: Array<{ id: string; label: string; score: number; subject: string }>;
  detailLocked?: boolean;
  irtMargin?: number;
  lastDiagnosticDate?: string;
}

export interface ScoreForecastCardProps {
  score?: ScoreForecastData | null;
  targetScore?: number | null;
  targetUni?: string | null;
  examMonth?: string | null;
  examDate?: string | null;
  className?: string;
  onRetestClick?: () => void;
  showBreakdown?: boolean;
  compact?: boolean;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'Tham khảo (làm thêm câu hỏi)',
  medium: 'Khá tin cậy',
  high: 'Rất tin cậy (Chuẩn IRT)',
};

// Lịch thi SAT dự kiến 2026 (College Board International)
const SAT_EXAM_DATES_2026: Record<string, string> = {
  'Tháng 3': '2026-03-14',
  'Tháng 5': '2026-05-02',
  'Tháng 6': '2026-06-06',
  'Tháng 8': '2026-08-22',
  'Tháng 10': '2026-10-03',
  'Tháng 12': '2026-12-05',
};

export function ScoreForecastCard({
  score,
  targetScore: propTargetScore,
  targetUni: propTargetUni,
  examMonth: propExamMonth,
  examDate: propExamDate,
  className = '',
  onRetestClick,
  showBreakdown = true,
  compact = false,
}: ScoreForecastCardProps) {
  const [mounted, setMounted] = useState(false);
  const [storedUni, setStoredUni] = useState<string | null>(null);
  const [storedExamMonth, setStoredExamMonth] = useState<string | null>(null);
  const [storedTargetScore, setStoredTargetScore] = useState<number | null>(null);
  const [lastTestedDate, setLastTestedDate] = useState<string | null>(null);

  // #C003 & #C006: Đọc dữ liệu từ localStorage an toàn phía client (tránh SSR mismatch)
  useEffect(() => {
    setMounted(true);
    try {
      const rawUni = localStorage.getItem('sat_target_uni');
      if (rawUni) {
        try {
          const parsed = JSON.parse(rawUni);
          setStoredUni(parsed.name || parsed.code || rawUni);
          if (parsed.targetScore && !propTargetScore) {
            setStoredTargetScore(Number(parsed.targetScore));
          }
        } catch {
          setStoredUni(rawUni);
        }
      }

      const rawMonth = localStorage.getItem('sat_target_exam_month');
      if (rawMonth) setStoredExamMonth(rawMonth);

      const rawLastDate = localStorage.getItem('sat_diagnostic_last_date');
      if (rawLastDate) setLastTestedDate(rawLastDate);
    } catch {
      // bỏ qua lỗi đọc storage
    }
  }, [propTargetScore]);

  const activeTargetScore = propTargetScore ?? storedTargetScore ?? score?.targetScore ?? 1450;
  const activeUni = propTargetUni ?? storedUni;
  const activeExamMonth = propExamMonth ?? storedExamMonth ?? 'Tháng 10';

  // #C006: Tính toán dải tin cậy IRT (Item Response Theory Confidence Band)
  const irtMargin = useMemo(() => {
    if (score?.irtMargin && Number.isFinite(score.irtMargin)) {
      return score.irtMargin;
    }
    const conf = score?.confidence;
    if (conf === 'high') return 30; // Chuẩn IRT ±30đ
    if (conf === 'medium') return 45;
    return 60; // Sơ bộ
  }, [score?.confidence, score?.irtMargin]);

  const totalScore = score?.total ?? 1050;
  const lowerBound = Math.max(400, totalScore - irtMargin);
  const upperBound = Math.min(1600, totalScore + irtMargin);

  // #C003: Đếm ngược kỳ thi SAT mục tiêu
  const countdownDays = useMemo(() => {
    if (!mounted) return null;
    const targetDateStr = propExamDate || SAT_EXAM_DATES_2026[activeExamMonth];
    if (!targetDateStr) return null;

    try {
      const now = new Date();
      const examDate = new Date(targetDateStr);
      const diffTime = examDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : null;
    } catch {
      return null;
    }
  }, [mounted, propExamDate, activeExamMonth]);

  // #C010: Trạng thái chu kỳ tái chẩn đoán định kỳ 14 ngày
  const nextDiagnosticDays = useMemo(() => {
    if (!mounted) return 14;
    try {
      const baseDateStr = score?.lastDiagnosticDate || lastTestedDate;
      if (!baseDateStr) return 14;
      const lastDate = new Date(baseDateStr);
      const now = new Date();
      const passedDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      const remaining = 14 - passedDays;
      return remaining > 0 ? remaining : 0;
    } catch {
      return 14;
    }
  }, [mounted, score?.lastDiagnosticDate, lastTestedDate]);

  const progressPercent = Math.min(100, Math.max(0, Math.round(((totalScore - 400) / (activeTargetScore - 400)) * 100)));
  const pointsRemaining = Math.max(0, activeTargetScore - totalScore);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#131d2e] via-[#162235] to-[#0d1522] border border-[#2b3a52] p-5 sm:p-6 text-white shadow-xl transition-all duration-300 hover:border-indigo-500/40 ${className}`}
    >
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-emerald-600/10 blur-3xl" />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#24334a] pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 text-lg">
            🎯
          </span>
          <div>
            <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
              Dự Đoán Điểm SAT (IRT Engine)
            </h3>
            <p className="text-xs text-slate-400">
              Định cỡ năng lực 2-PL thích ứng chuẩn Digital SAT
            </p>
          </div>
        </div>

        {/* #C010: Nhãn tái chẩn đoán định kỳ 14 ngày */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full bg-cyan-950/70 border border-cyan-500/30 px-2.5 py-1 text-[11px] font-semibold text-cyan-300"
            title="Định kỳ 14 ngày hệ thống đề xuất tái chẩn đoán để cập nhật hàm năng lực IRT"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Tái chẩn đoán định kỳ 14 ngày
            {mounted && nextDiagnosticDays === 0 && (
              <span className="ml-1 rounded bg-amber-500/20 px-1 text-[10px] text-amber-300 font-bold">
                (Đã đến hạn)
              </span>
            )}
          </span>

          {onRetestClick ? (
            <button
              onClick={onRetestClick}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
            >
              Đo lại
            </button>
          ) : (
            <Link
              href="/diagnostic"
              className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
            >
              Đo lại
            </Link>
          )}
        </div>
      </div>

      {/* Main Score & IRT Range Grid */}
      <div className="my-5 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        {/* Điểm dự đoán chính */}
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            Điểm Dự Đoán Hiện Tại
          </span>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
              {totalScore}
            </span>
            <span className="text-sm font-semibold text-slate-400">/ 1600</span>
          </div>

          {/* #C006: Dải tin cậy IRT */}
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-950/80 border border-indigo-500/30 px-2 py-0.5 font-medium text-indigo-300">
              <span className="font-bold">Độ tin cậy IRT:</span> ±{irtMargin}đ
            </span>
            <span className="text-slate-400">
              Dải điểm: <strong className="text-slate-200">{lowerBound} – {upperBound}</strong>
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Trạng thái: {CONFIDENCE_LABEL[score?.confidence ?? 'medium'] ?? 'Khá tin cậy'}
          </p>
        </div>

        {/* Mục tiêu Đại học & Đếm ngược */}
        <div className="flex flex-col justify-center rounded-xl bg-[#0c1421]/70 border border-[#202d42] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">🎯 Mục tiêu:</span>
            <span className="font-bold text-amber-300">
              {activeTargetScore} điểm {activeUni ? `(${activeUni})` : ''}
            </span>
          </div>

          {/* Progress bar to target */}
          <div className="w-full">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Tiến độ tới mục tiêu</span>
              <span className="font-semibold text-emerald-400">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-1 text-right text-[10px] text-slate-400">
              {pointsRemaining === 0 ? (
                <span className="text-emerald-400 font-bold">✨ Đã cán đích mục tiêu!</span>
              ) : (
                <span>Còn thiếu <strong className="text-amber-300">+{pointsRemaining}đ</strong></span>
              )}
            </div>
          </div>

          {/* #C003: Đếm ngược kỳ thi SAT mục tiêu */}
          <div className="flex items-center justify-between border-t border-[#1e2a3c] pt-2 text-[11px]">
            <span className="text-slate-400 flex items-center gap-1">
              <span>📅</span> Kỳ thi mục tiêu:
            </span>
            <div className="text-right">
              <span className="font-bold text-blue-300">{activeExamMonth}</span>
              {mounted && countdownDays !== null && (
                <span className="ml-1.5 rounded-full bg-blue-950/80 border border-blue-500/30 px-1.5 py-0.2 text-[10px] font-semibold text-blue-200">
                  ⏳ Còn {countdownDays} ngày
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown 2 Môn (Math & Reading) */}
      {showBreakdown && !compact && (
        <div className="mt-4 pt-4 border-t border-[#24334a] grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#0f1726] border border-[#223046] p-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-blue-400 flex items-center gap-1">
                📐 Math (Toán)
              </span>
              <span className="font-black text-white text-base">
                {score?.math ?? Math.round(totalScore * 0.52)}
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${Math.min(100, Math.round(((score?.math ?? Math.round(totalScore * 0.52)) / 800) * 100))}%`,
                }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-500 text-right">Thang điểm 200–800</div>
          </div>

          <div className="rounded-xl bg-[#0f1726] border border-[#223046] p-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-purple-400 flex items-center gap-1">
                📖 Reading & Writing
              </span>
              <span className="font-black text-white text-base">
                {score?.reading ?? Math.round(totalScore * 0.48)}
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{
                  width: `${Math.min(100, Math.round(((score?.reading ?? Math.round(totalScore * 0.48)) / 800) * 100))}%`,
                }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-500 text-right">Thang điểm 200–800</div>
          </div>
        </div>
      )}

      {/* Footer quick action */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#24334a]/60 text-xs text-slate-400">
        <span>Khung giờ học cam kết: <strong className="text-slate-300">20:00 - 21:30</strong></span>
        <Link
          href="/practice"
          className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
        >
          ⚡ Gỡ điểm ngay (+20đ) →
        </Link>
      </div>
    </div>
  );
}

export default ScoreForecastCard;
