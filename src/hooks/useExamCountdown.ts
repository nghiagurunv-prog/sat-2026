'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  EXAM_DATE_STORAGE_KEY,
  EXAM_DATE_UPDATED_EVENT,
  getUpcomingSatDates,
  resolveTargetSatDate,
  evaluateSatRegistrationAlert,
  computeDailyQuestionKpi,
  type OfficialSatDate,
} from '@/lib/sat-dates';

export interface UseExamCountdownOptions {
  currentScore?: number;
  targetScore?: number;
}

export function useExamCountdown(options?: UseExamCountdownOptions) {
  const currentScore = options?.currentScore ?? 1250;
  const targetScore = options?.targetScore ?? 1450;

  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const stored = localStorage.getItem(EXAM_DATE_STORAGE_KEY);
        setSelectedDateStr(stored);
      } catch {
        // ignore storage errors
      }
      setNowMs(Date.now());
    };

    syncFromStorage();

    const handleCustom = () => syncFromStorage();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === EXAM_DATE_STORAGE_KEY) syncFromStorage();
    };
    window.addEventListener(EXAM_DATE_UPDATED_EVENT, handleCustom);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(EXAM_DATE_UPDATED_EVENT, handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const upcomingExams = useMemo(() => getUpcomingSatDates(nowMs), [nowMs]);
  const targetExam: OfficialSatDate = useMemo(
    () => resolveTargetSatDate(selectedDateStr, nowMs),
    [selectedDateStr, nowMs]
  );
  const alert = useMemo(() => evaluateSatRegistrationAlert(targetExam, nowMs), [targetExam, nowMs]);
  const dailyQuestionKpi = useMemo(
    () => computeDailyQuestionKpi(alert.daysUntilExam, currentScore, targetScore),
    [alert.daysUntilExam, currentScore, targetScore]
  );

  const selectExamDate = useCallback((dateStr: string) => {
    setSelectedDateStr(dateStr);
    try {
      localStorage.setItem(EXAM_DATE_STORAGE_KEY, dateStr);
      window.dispatchEvent(new CustomEvent(EXAM_DATE_UPDATED_EVENT, { detail: { dateStr } }));
    } catch {
      // ignore storage errors
    }
  }, []);

  return {
    targetExam,
    upcomingExams,
    daysUntilExam: alert.daysUntilExam,
    daysUntilRegDeadline: alert.daysUntilRegDeadline,
    regClosed: alert.regClosed,
    isRegUrgent: alert.isRegUrgent,
    recommendSprint45d: alert.recommendSprint45d,
    isFinal7DayCram: alert.isFinal7DayCram,
    dailyQuestionKpi,
    selectExamDate,
  };
}
