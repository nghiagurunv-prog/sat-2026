/**
 * ============================================================================
 *  OFFICIAL COLLEGE BOARD DIGITAL SAT DATES (2026–2027)
 * ============================================================================
 *  Nguồn dữ liệu tập trung duy nhất cho Trang chủ, Dashboard và Cổng Phụ Huynh.
 *  Bao gồm ngày thi chính thức, hạn đăng ký chuẩn (Registration Deadline)
 *  và hạn đăng ký muộn (+34 USD Late Fee) của College Board quốc tế.
 */

export interface OfficialSatDate {
  id: string;
  dateStr: string; // YYYY-MM-DD
  name: string;
  regDeadlineIso: string; // YYYY-MM-DD
  regDeadlineDisplay: string; // DD/MM/YYYY
  lateDeadlineDisplay: string; // DD/MM/YYYY
}

export const OFFICIAL_SAT_DATES: readonly OfficialSatDate[] = [
  {
    id: 'sat-2026-03',
    dateStr: '2026-03-14',
    name: 'Đợt thi SAT Tháng 3/2026',
    regDeadlineIso: '2026-02-27',
    regDeadlineDisplay: '27/02/2026',
    lateDeadlineDisplay: '03/03/2026',
  },
  {
    id: 'sat-2026-05',
    dateStr: '2026-05-02',
    name: 'Đợt thi SAT Tháng 5/2026',
    regDeadlineIso: '2026-04-17',
    regDeadlineDisplay: '17/04/2026',
    lateDeadlineDisplay: '21/04/2026',
  },
  {
    id: 'sat-2026-06',
    dateStr: '2026-06-06',
    name: 'Đợt thi SAT Tháng 6/2026',
    regDeadlineIso: '2026-05-22',
    regDeadlineDisplay: '22/05/2026',
    lateDeadlineDisplay: '26/05/2026',
  },
  {
    id: 'sat-2026-08',
    dateStr: '2026-08-22',
    name: 'Đợt thi SAT Tháng 8/2026',
    regDeadlineIso: '2026-08-07',
    regDeadlineDisplay: '07/08/2026',
    lateDeadlineDisplay: '11/08/2026',
  },
  {
    id: 'sat-2026-09',
    dateStr: '2026-09-12',
    name: 'Đợt thi SAT Tháng 9/2026',
    regDeadlineIso: '2026-08-28',
    regDeadlineDisplay: '28/08/2026',
    lateDeadlineDisplay: '01/09/2026',
  },
  {
    id: 'sat-2026-10',
    dateStr: '2026-10-03',
    name: 'Đợt thi SAT Tháng 10/2026',
    regDeadlineIso: '2026-09-18',
    regDeadlineDisplay: '18/09/2026',
    lateDeadlineDisplay: '22/09/2026',
  },
  {
    id: 'sat-2026-11',
    dateStr: '2026-11-07',
    name: 'Đợt thi SAT Tháng 11/2026',
    regDeadlineIso: '2026-10-23',
    regDeadlineDisplay: '23/10/2026',
    lateDeadlineDisplay: '27/10/2026',
  },
  {
    id: 'sat-2026-12',
    dateStr: '2026-12-05',
    name: 'Đợt thi SAT Tháng 12/2026',
    regDeadlineIso: '2026-11-20',
    regDeadlineDisplay: '20/11/2026',
    lateDeadlineDisplay: '24/11/2026',
  },
  {
    id: 'sat-2027-03',
    dateStr: '2027-03-13',
    name: 'Đợt thi SAT Tháng 3/2027',
    regDeadlineIso: '2027-02-26',
    regDeadlineDisplay: '26/02/2027',
    lateDeadlineDisplay: '02/03/2027',
  },
  {
    id: 'sat-2027-05',
    dateStr: '2027-05-01',
    name: 'Đợt thi SAT Tháng 5/2027',
    regDeadlineIso: '2027-04-16',
    regDeadlineDisplay: '16/04/2027',
    lateDeadlineDisplay: '20/04/2027',
  },
  {
    id: 'sat-2027-06',
    dateStr: '2027-06-05',
    name: 'Đợt thi SAT Tháng 6/2027',
    regDeadlineIso: '2027-05-21',
    regDeadlineDisplay: '21/05/2027',
    lateDeadlineDisplay: '25/05/2027',
  },
  {
    id: 'sat-2027-08',
    dateStr: '2027-08-28',
    name: 'Đợt thi SAT Tháng 8/2027',
    regDeadlineIso: '2027-08-13',
    regDeadlineDisplay: '13/08/2027',
    lateDeadlineDisplay: '17/08/2027',
  },
  {
    id: 'sat-2027-10',
    dateStr: '2027-10-02',
    name: 'Đợt thi SAT Tháng 10/2027',
    regDeadlineIso: '2027-09-17',
    regDeadlineDisplay: '17/09/2027',
    lateDeadlineDisplay: '21/09/2027',
  },
  {
    id: 'sat-2027-12',
    dateStr: '2027-12-04',
    name: 'Đợt thi SAT Tháng 12/2027',
    regDeadlineIso: '2027-11-19',
    regDeadlineDisplay: '19/11/2027',
    lateDeadlineDisplay: '23/11/2027',
  },
];

export const EXAM_DATE_STORAGE_KEY = 'sat_target_exam_date_v1';
export const EXAM_DATE_UPDATED_EVENT = 'sat_exam_date_updated';

const DAY_MS = 86_400_000;

/** Số ngày còn lại tính từ `nowMs` tới mốc ISO YYYY-MM-DD (luôn >= 0). */
export function getDaysUntilIso(isoDate: string, nowMs: number = Date.now()): number {
  const targetMs = Date.parse(`${isoDate}T08:00:00+07:00`);
  if (Number.isNaN(targetMs)) return 0;
  return Math.max(0, Math.ceil((targetMs - nowMs) / DAY_MS));
}

/** Danh sách các đợt thi SAT sắp diễn ra kể từ `nowMs`. */
export function getUpcomingSatDates(nowMs: number = Date.now()): OfficialSatDate[] {
  return OFFICIAL_SAT_DATES.filter((d) => Date.parse(`${d.dateStr}T23:59:59+07:00`) >= nowMs);
}

/** Đợt thi SAT gần nhất sắp tới (ưu tiên `preferredDateStr` nếu vẫn còn trong tương lai). */
export function resolveTargetSatDate(
  preferredDateStr?: string | null,
  nowMs: number = Date.now()
): OfficialSatDate {
  const upcoming = getUpcomingSatDates(nowMs);
  if (preferredDateStr) {
    const matched = upcoming.find((d) => d.dateStr === preferredDateStr);
    if (matched) return matched;
  }
  return upcoming[0] ?? OFFICIAL_SAT_DATES[OFFICIAL_SAT_DATES.length - 1];
}

/**
 * Đánh giá hạn đăng ký sớm College Board (tránh phí muộn $34 USD & hết chỗ thi tại VN).
 */
export interface RegistrationAlertInfo {
  daysUntilExam: number;
  daysUntilRegDeadline: number;
  regClosed: boolean;
  isRegUrgent: boolean; // <= 14 ngày tới hạn đăng ký sớm
  recommendSprint45d: boolean; // <= 60 ngày tới ngày thi
  isFinal7DayCram: boolean; // <= 7 ngày tới ngày thi
}

export function evaluateSatRegistrationAlert(
  exam: OfficialSatDate,
  nowMs: number = Date.now()
): RegistrationAlertInfo {
  const daysUntilExam = getDaysUntilIso(exam.dateStr, nowMs);
  const regMs = Date.parse(`${exam.regDeadlineIso}T23:59:59+07:00`);
  const rawRegDays = Number.isNaN(regMs) ? 0 : Math.ceil((regMs - nowMs) / DAY_MS);
  const regClosed = rawRegDays <= 0;
  const daysUntilRegDeadline = Math.max(0, rawRegDays);
  return {
    daysUntilExam,
    daysUntilRegDeadline,
    regClosed,
    isRegUrgent: !regClosed && daysUntilRegDeadline <= 14,
    recommendSprint45d: daysUntilExam > 0 && daysUntilExam <= 60,
    isFinal7DayCram: daysUntilExam > 0 && daysUntilExam <= 7,
  };
}

/**
 * KPI số câu cần luyện hôm nay theo khoảng cách tới ngày thi và gap điểm mục tiêu.
 */
export function computeDailyQuestionKpi(
  daysUntilExam: number,
  currentScore = 1250,
  targetScore = 1450
): number {
  const gap = Math.max(0, targetScore - currentScore);
  if (daysUntilExam <= 7) {
    // 7 ngày cuối: ưu tiên micro-drills gọn, giữ tâm lý vững (20 câu tinh chọn)
    return 20;
  }
  if (daysUntilExam <= 30) {
    return gap >= 150 ? 40 : 30;
  }
  if (daysUntilExam <= 60) {
    return gap >= 150 ? 30 : 25;
  }
  return gap >= 200 ? 25 : 15;
}
