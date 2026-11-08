'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

/**
 * ============================================================================
 *  ADMIN COCKPIT — TRUNG TÂM CHỈ HUY THƯƠNG MẠI TOÀN NĂNG CHO BỐ (SAT_NGHIAGURU)
 * ============================================================================
 *  Gồm 5 Tab điều hành toàn diện:
 *   1. 💰 Doanh Thu & Đối Soát (VietQR / PayOS + Kích Hoạt VIP 1-Click)
 *   2. 👥 Quản Lý Học Viên (Student CRM 360, Tặng Xu & Gia Hạn VIP)
 *   3. 📚 Kiểm Duyệt Câu Hỏi & Báo Lỗi Đề (Question Triage + Thưởng Xu)
 *   4. 🤖 Kiểm Soát Chi Phí AI & Phanh Khẩn Cấp (AI Cost, Sliders & Kill-Switch)
 *   5. 🎁 Duyệt Đổi Quà (Redemptions Server-Authoritative)
 * ============================================================================
 */

interface Redemption {
  id: string;
  userId: string;
  rewardId: string;
  rewardName: string;
  costCoins: number;
  status: string;
  createdAt: string;
  fulfilledAt: string | null;
}

const INITIAL_REDEMPTIONS: Redemption[] = [
  {
    id: 'RED-DEMO-001',
    userId: 'u_student_hn01',
    rewardId: 'rw_scholarship_50',
    rewardName: 'Học bổng khoá luyện đề SAT 50%',
    costCoins: 15000,
    status: 'pending',
    createdAt: '2026-11-08T08:30:00.000Z',
    fulfilledAt: null,
  },
  {
    id: 'RED-DEMO-002',
    userId: 'u_student_sg02',
    rewardId: 'rw_handbook_tactics',
    rewardName: 'Sổ tay chiến thuật SAT 1550+ (Bản in màu cao cấp)',
    costCoins: 8000,
    status: 'pending',
    createdAt: '2026-11-08T09:15:00.000Z',
    fulfilledAt: null,
  },
  {
    id: 'RED-DEMO-003',
    userId: 'u_student_dn03',
    rewardId: 'rw_voucher_library',
    rewardName: 'Thẻ quà tặng tài liệu đề thi thật có lời giải chi tiết',
    costCoins: 5000,
    status: 'pending',
    createdAt: '2026-11-08T10:00:00.000Z',
    fulfilledAt: null,
  },
];

interface CostReport {
  date: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  budgetUsd: number;
  remainingUsd: number;
}

interface PaymentTransaction {
  id: string;
  userEmail: string;
  userName: string;
  plan: 'PRO' | 'PREMIUM' | 'ULTIMATE';
  amount: number;
  gateway: 'VietQR' | 'PayOS' | 'Manual_Admin';
  status: 'SUCCESS' | 'PENDING' | 'REFUNDED';
  createdAt: string;
}

interface StudentRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  targetScore: number;
  predictedScore: number;
  vipStatus: 'ACTIVE' | 'EXPIRED' | 'TRIAL';
  vipExpiry: string;
  coins: number;
  mockTestsDone: number;
  accuracy: number;
  classCode?: string;
  lastActiveDaysAgo?: number;
  riskLevel?: 'HIGH' | 'MEDIUM' | 'SAFE';
}

interface DomainHeatmapItem {
  id: string;
  domain: 'Math' | 'Reading & Writing';
  module: 'Math' | 'Reading & Writing';
  skillName: string;
  name: string;
  errorRate: number;
  studentCountAtRisk: number;
  studentsStruggling: number;
  totalStudents: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedSkillSlug: string;
}

interface TeacherTip {
  id: string;
  topic: string;
  module: 'Math' | 'Reading & Writing';
  title: string;
  content: string;
  author: string;
  views: number;
  createdAt: string;
}

interface ReportedQuestion {
  id: string;
  questionId: string;
  module: 'Reading & Writing' | 'Math';
  reportedBy: string;
  issueType: 'SAI_DAP_AN' | 'LOI_LATEX' | 'LOI_DICH' | 'KHAC';
  description: string;
  reportedAt: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function fmtMoney(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return safe.toLocaleString('vi-VN') + ' đ';
}

/** Phép tính an toàn chống chia cho 0, bảo vệ khỏi NaN / Infinity */
function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || !Number.isFinite(denominator) || denominator === 0) return fallback;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/** Tải xuống file CSV mã hóa chuẩn UTF-8 có ký tự BOM (\uFEFF) giúp mở trên Excel Windows không bao giờ lỗi font tiếng Việt (#C085) */
function downloadUtf8BomCsv(filename: string, headersOrContent: string[] | string, rows?: (string | number)[][]) {
  let csvContent = '';
  if (Array.isArray(headersOrContent)) {
    const escapeCell = (val: string | number) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headerLine = headersOrContent.map(escapeCell).join(',');
    const rowLines = (rows || []).map((r) => r.map(escapeCell).join(','));
    csvContent = [headerLine, ...rowLines].join('\n');
  } else {
    csvContent = headersOrContent;
  }
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Ẩn email nhạy cảm khi trình chiếu lớp học (#C086) */
function maskEmail(email: string, enabled = true): string {
  if (!enabled) return email;
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : '***';
  return `${maskedName}@${domain}`;
}

/** Ẩn số điện thoại nhạy cảm khi trình chiếu (#C086) */
function maskPhone(phone: string, enabled = true): string {
  if (!enabled) return phone;
  if (phone.length <= 4) return '***';
  return phone.slice(0, 3) + '***' + phone.slice(-3);
}

/** Ẩn số tiền học phí/doanh thu khi trình chiếu (#C086) */
function maskMoney(amount: number, enabled = true): string {
  if (!enabled) return fmtMoney(amount);
  return '***.000 đ';
}

const DOMAIN_HEATMAP_DATA: DomainHeatmapItem[] = [
  {
    id: 'rw-transitions',
    domain: 'Reading & Writing',
    module: 'Reading & Writing',
    skillName: 'Transitions (Từ nối & Logic chuyển đoạn)',
    name: 'Transitions (Từ nối & Logic chuyển đoạn)',
    errorRate: 46,
    studentCountAtRisk: 16,
    studentsStruggling: 16,
    totalStudents: 35,
    priority: 'HIGH',
    recommendedSkillSlug: 'transitions',
  },
  {
    id: 'math-quadratics',
    domain: 'Math',
    module: 'Math',
    skillName: 'Nonlinear Functions & Quadratic Equations',
    name: 'Nonlinear Functions & Quadratic Equations',
    errorRate: 42,
    studentCountAtRisk: 14,
    studentsStruggling: 14,
    totalStudents: 35,
    priority: 'HIGH',
    recommendedSkillSlug: 'quadratic-equations',
  },
  {
    id: 'rw-words-in-context',
    domain: 'Reading & Writing',
    module: 'Reading & Writing',
    skillName: 'Words in Context (Từ vựng học thuật)',
    name: 'Words in Context (Từ vựng học thuật)',
    errorRate: 38,
    studentCountAtRisk: 12,
    studentsStruggling: 12,
    totalStudents: 35,
    priority: 'HIGH',
    recommendedSkillSlug: 'words-in-context',
  },
  {
    id: 'math-geometry-trig',
    domain: 'Math',
    module: 'Math',
    skillName: 'Circles & Trigonometry (Đường tròn & Lượng giác)',
    name: 'Circles & Trigonometry (Đường tròn & Lượng giác)',
    errorRate: 35,
    studentCountAtRisk: 11,
    studentsStruggling: 11,
    totalStudents: 35,
    priority: 'MEDIUM',
    recommendedSkillSlug: 'circles-trigonometry',
  },
  {
    id: 'rw-boundaries',
    domain: 'Reading & Writing',
    module: 'Reading & Writing',
    skillName: 'Form, Structure, and Sense & Boundaries',
    name: 'Form, Structure, and Sense & Boundaries',
    errorRate: 24,
    studentCountAtRisk: 7,
    studentsStruggling: 7,
    totalStudents: 35,
    priority: 'MEDIUM',
    recommendedSkillSlug: 'boundaries',
  },
  {
    id: 'math-linear-systems',
    domain: 'Math',
    module: 'Math',
    skillName: 'Systems of Two Linear Equations in Two Variables',
    name: 'Systems of Two Linear Equations in Two Variables',
    errorRate: 18,
    studentCountAtRisk: 5,
    studentsStruggling: 5,
    totalStudents: 35,
    priority: 'LOW',
    recommendedSkillSlug: 'linear-systems',
  },
];

const INITIAL_TEACHER_TIPS: TeacherTip[] = [
  {
    id: 'TIP-101',
    topic: 'Hệ Phương Trình Bậc Nhất & Bậc Hai',
    module: 'Math',
    title: 'Bí kíp trượt Slider Desmos tìm nghiệm nhanh không quá 10 giây',
    content: 'Thay vì biến đổi tay đại số cồng kềnh, gõ thẳng 2 vế của phương trình vào Desmos. Quan sát giao điểm của đồ thị hoặc dùng thanh trượt k để tìm số nghiệm vô số hoặc vô nghiệm tức thì!',
    author: 'Thầy Nghĩa (SAT_NGHIAGURU)',
    views: 328,
    createdAt: '2026-10-15',
  },
  {
    id: 'TIP-102',
    topic: 'Transitions (Từ Nối Ngữ Cảnh)',
    module: 'Reading & Writing',
    title: 'Quy tắc 3 nhóm quan hệ: Tiếp nối - Tương phản - Nhân quả',
    content: 'Đọc kỹ 1 câu phía trước và 1 câu phía sau chỗ trống trước khi nhìn đáp án. Xác định xem hai câu cùng chiều (Furthermore), ngược chiều (However), hay hệ quả (Therefore). Loại ngay các đáp án đồng nghĩa trong cùng 1 nhóm!',
    author: 'Thầy Nghĩa (SAT_NGHIAGURU)',
    views: 412,
    createdAt: '2026-10-18',
  },
  {
    id: 'TIP-103',
    topic: 'Phương Trình Đường Tròn (Circles)',
    module: 'Math',
    title: 'Thuật toán nhóm bình phương nhanh tìm tâm (h, k) và bán kính R',
    content: 'Với phương trình x² + y² + ax + by + c = 0, tâm đường tròn lập tức là (-a/2, -b/2) và R² = (a/2)² + (b/2)² - c. Nhớ kiểm tra kỹ dấu trước khi kết luận bán kính!',
    author: 'Cô Lan Anh (Trợ Giảng)',
    views: 195,
    createdAt: '2026-10-22',
  },
];

export default function AdminPage() {
  const secretInputId = useId();
  const [activeTab, setActiveTab] = useState<'revenue' | 'crm' | 'teacher' | 'triage' | 'ai_cost' | 'redemptions'>('revenue');
  const [secret, setSecret] = useState('');
  const [needSecret, setNeedSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Presentation Mode (#C086): Phóng chữ 125% & ẩn thông tin nhạy cảm
  const [presentationMode, setPresentationMode] = useState(false);

  // Tab 2 & Teacher: Cohort Filter & At-Risk Radar (#C083, #C090)
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [atRiskFilter, setAtRiskFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'SAFE'>('ALL');

  // Tab Teacher: Bản Đồ Nhiệt & Giao Bài 1-Click (#C081, #C082)
  const [selectedHeatmapSkill, setSelectedHeatmapSkill] = useState<string>('transitions');
  const [targetQuestionCount, setTargetQuestionCount] = useState<number>(10);
  const [zaloClassTarget, setZaloClassTarget] = useState<string>('SAT-PRO-12A1');
  const [zaloCustomNote, setZaloCustomNote] = useState<string>(
    'Đọc kỹ phần giải thích chi tiết tiếng Việt và mẹo giải của Thầy Nghĩa sau mỗi câu!'
  );
  const [zaloCopiedFeedback, setZaloCopiedFeedback] = useState<boolean>(false);

  // Tab Teacher: Mẹo Giải Của Giáo Viên (#C087, #C088)
  const [teacherTips, setTeacherTips] = useState<TeacherTip[]>(INITIAL_TEACHER_TIPS);
  const [isAddingTip, setIsAddingTip] = useState(false);
  const [newTipModule, setNewTipModule] = useState<'Math' | 'Reading & Writing'>('Math');
  const [newTipTopic, setNewTipTopic] = useState('');
  const [newTipTitle, setNewTipTitle] = useState('');
  const [newTipContent, setNewTipContent] = useState('');

  // Tab 5: Redemptions Data & Filter (#C084)
  const [redemptions, setRedemptions] = useState<Redemption[]>(INITIAL_REDEMPTIONS);
  const [redemptionStatusFilter, setRedemptionStatusFilter] = useState<string>('ALL');
  const [redemptionSearch, setRedemptionSearch] = useState<string>('');
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const isActionProcessingRef = useRef(false);

  // Tab 1: Processing state for Order & VIP (Chống double-click #071)
  const [isActivatingVip, setIsActivatingVip] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  // Tab 2 & 3: Processing locks (Chống double-click #071)
  const [processingStudentId, setProcessingStudentId] = useState<string | null>(null);
  const [processingReportId, setProcessingReportId] = useState<string | null>(null);

  // Tab 4: AI Cost Data & Controls
  const [cost, setCost] = useState<CostReport | null>(null);
  const [aiKillSwitch, setAiKillSwitch] = useState(false);
  const [ecoMode, setEcoMode] = useState(true);
  const [dailyBudgetLimit, setDailyBudgetLimit] = useState(20);

  // Tab 1: Revenue & VIP Activation State
  const [vipTargetEmail, setVipTargetEmail] = useState('');
  const [vipSelectedPlan, setVipSelectedPlan] = useState<'PRO' | 'PREMIUM' | 'ULTIMATE'>('PREMIUM');
  const [vipCustomDays, setVipCustomDays] = useState(90);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([
    {
      id: 'TXN-984210',
      userEmail: 'nguyen.minhanh@gmail.com',
      userName: 'Nguyễn Minh Anh',
      plan: 'ULTIMATE',
      amount: 1499000,
      gateway: 'VietQR',
      status: 'SUCCESS',
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 'TXN-984209',
      userEmail: 'tranhoang.sat@yahoo.com',
      userName: 'Trần Hoàng Long',
      plan: 'PREMIUM',
      amount: 699000,
      gateway: 'PayOS',
      status: 'SUCCESS',
      createdAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
    },
    {
      id: 'TXN-984208',
      userEmail: 'le.gia.huy@outlook.com',
      userName: 'Lê Gia Huy',
      plan: 'PRO',
      amount: 299000,
      gateway: 'VietQR',
      status: 'SUCCESS',
      createdAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    },
    {
      id: 'TXN-984207',
      userEmail: 'vu.hoangnam@gmail.com',
      userName: 'Vũ Hoàng Nam',
      plan: 'PREMIUM',
      amount: 699000,
      gateway: 'Manual_Admin',
      status: 'SUCCESS',
      createdAt: new Date(Date.now() - 250 * 60 * 1000).toISOString(),
    },
  ]);

  // Tab 2: Student CRM Data
  const [searchStudent, setSearchStudent] = useState('');
  const [students, setStudents] = useState<StudentRecord[]>([
    {
      id: 'STU-1001',
      name: 'Nguyễn Minh Anh',
      email: 'nguyen.minhanh@gmail.com',
      phone: '0981234567',
      targetScore: 1520,
      predictedScore: 1460,
      vipStatus: 'ACTIVE',
      vipExpiry: '2027-02-15',
      coins: 450,
      mockTestsDone: 8,
      accuracy: 86,
      classCode: 'SAT-PRO-12A1',
      lastActiveDaysAgo: 1,
      riskLevel: 'SAFE',
    },
    {
      id: 'STU-1002',
      name: 'Trần Hoàng Long',
      email: 'tranhoang.sat@yahoo.com',
      phone: '0904567891',
      targetScore: 1450,
      predictedScore: 1380,
      vipStatus: 'ACTIVE',
      vipExpiry: '2026-12-05',
      coins: 220,
      mockTestsDone: 5,
      accuracy: 78,
      classCode: 'SAT-K68-FTU',
      lastActiveDaysAgo: 2,
      riskLevel: 'SAFE',
    },
    {
      id: 'STU-1003',
      name: 'Phạm Thuỳ Dương',
      email: 'thuyduong.pham@gmail.com',
      phone: '0903334444',
      targetScore: 1400,
      predictedScore: 1210,
      vipStatus: 'TRIAL',
      vipExpiry: '2026-11-12',
      coins: 50,
      mockTestsDone: 2,
      accuracy: 64,
      classCode: 'SAT-PRO-12A1',
      lastActiveDaysAgo: 7,
      riskLevel: 'HIGH',
    },
    {
      id: 'STU-1004',
      name: 'Lê Gia Huy',
      email: 'le.gia.huy@outlook.com',
      phone: '0978889999',
      targetScore: 1550,
      predictedScore: 1510,
      vipStatus: 'ACTIVE',
      vipExpiry: '2026-12-01',
      coins: 600,
      mockTestsDone: 14,
      accuracy: 92,
      classCode: 'CHUYEN-TOAN-K33',
      lastActiveDaysAgo: 0,
      riskLevel: 'SAFE',
    },
    {
      id: 'STU-1005',
      name: 'Vũ Tuấn Kiệt',
      email: 'tuankiet.vu@gmail.com',
      phone: '0934567890',
      targetScore: 1480,
      predictedScore: 1260,
      vipStatus: 'TRIAL',
      vipExpiry: '2026-11-09',
      coins: 30,
      mockTestsDone: 1,
      accuracy: 59,
      classCode: 'SAT-K68-FTU',
      lastActiveDaysAgo: 6,
      riskLevel: 'HIGH',
    },
    {
      id: 'STU-1006',
      name: 'Đỗ Mai Phương',
      email: 'maiphuong.do@yahoo.com',
      phone: '0945678123',
      targetScore: 1500,
      predictedScore: 1410,
      vipStatus: 'ACTIVE',
      vipExpiry: '2027-01-20',
      coins: 180,
      mockTestsDone: 6,
      accuracy: 72,
      classCode: 'CHUYEN-TOAN-K33',
      lastActiveDaysAgo: 4,
      riskLevel: 'MEDIUM',
    },
  ]);

  // Tab 3: Question Triage Data
  const [reports, setReports] = useState<ReportedQuestion[]>([
    {
      id: 'REP-501',
      questionId: 'm1_rw_q2',
      module: 'Reading & Writing',
      reportedBy: 'nguyen.minhanh@gmail.com',
      issueType: 'LOI_DICH',
      description: 'Từ visceral trong phần giải thích tiếng Việt chưa giải thích hết sắc thái bản năng của nhân vật Judith.',
      reportedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      status: 'PENDING',
    },
    {
      id: 'REP-502',
      questionId: 'm1_m2_q2',
      module: 'Math',
      reportedBy: 'le.gia.huy@outlook.com',
      issueType: 'LOI_LATEX',
      description: 'Công thức khai triển (ax+3)(2x-5) bị xô dòng khi hiển thị trên điện thoại màn hình nhỏ.',
      reportedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      status: 'PENDING',
    },
    {
      id: 'REP-503',
      questionId: 'm2_m2_q1',
      module: 'Math',
      reportedBy: 'thuyduong.pham@gmail.com',
      issueType: 'SAI_DAP_AN',
      description: 'Đề bài hỏi k nhưng em bấm k = 9 bị báo sai, giải thích rất kỹ nhưng cần thêm ghi chú song song.',
      reportedAt: new Date(Date.now() - 340 * 60 * 1000).toISOString(),
      status: 'RESOLVED',
    },
  ]);

  /** Headers kèm secret (nếu có) */
  const authHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => {
      const h: Record<string, string> = { ...extra };
      if (secret) h['x-admin-secret'] = secret;
      return h;
    },
    [secret]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, cRes] = await Promise.all([
        fetch('/api/admin/redemptions', { headers: authHeaders(), cache: 'no-store' }),
        fetch('/api/admin/ai-cost', { headers: authHeaders(), cache: 'no-store' }),
      ]);

      if (rRes.status === 403 || cRes.status === 403) {
        setNeedSecret(true);
        setRedemptions(INITIAL_REDEMPTIONS);
        setCost(null);
        setError(
          secret
            ? 'ADMIN_SECRET chưa đúng hoặc tài khoản chưa cấp quyền admin.'
            : 'Cần quyền admin: đăng nhập bằng tài khoản admin, hoặc nhập ADMIN_SECRET bên dưới.'
        );
        return;
      }
      if (rRes.status === 429 || cRes.status === 429) {
        setError('Quá nhiều yêu cầu. Vui lòng chờ 1 phút rồi thử lại.');
        return;
      }

      setNeedSecret(false);
      if (rRes.ok) {
        const d = await rRes.json();
        setRedemptions(Array.isArray(d.redemptions) && d.redemptions.length > 0 ? d.redemptions : INITIAL_REDEMPTIONS);
      }
      if (cRes.ok) {
        setCost(await cRes.json());
      }
    } catch {
      setError('Lỗi kết nối. Kiểm tra mạng rồi thử lại.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, secret]);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  // Hành động Duyệt Đổi Quà (Tab 5) - Chống double-click #071 & Hỗ trợ reject #075
  const act = async (id: string, action: 'fulfill' | 'cancel' | 'reject') => {
    if (rowBusy || isActionProcessingRef.current) return;

    const label =
      action === 'fulfill'
        ? 'GIAO quà (đánh dấu đã gửi học viên)'
        : action === 'reject'
        ? 'TỪ CHỐI phiếu (không hoàn lại xu do vi phạm điều khoản)'
        : 'HỦY phiếu (HOÀN LẠI XU cho học viên)';
    if (!window.confirm(`Xác nhận ${label} cho phiếu #${id}?`)) return;

    isActionProcessingRef.current = true;
    setRowBusy(id);
    setNotice(null);
    setError(null);

    // Xử lý tức thì cho phiếu đổi quà mẫu demo
    if (id.startsWith('RED-DEMO-')) {
      const actionMsg =
        action === 'fulfill'
          ? 'Đã duyệt giao quà'
          : action === 'reject'
          ? 'Đã từ chối phiếu đổi quà'
          : 'Đã hủy phiếu & hoàn xu';
      setNotice(`✅ ${actionMsg} #${id} (Phiếu mẫu demo)`);
      setRedemptions((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: action === 'fulfill' ? 'fulfilled' : action === 'reject' ? 'rejected' : 'cancelled',
                fulfilledAt: action === 'fulfill' ? new Date().toISOString() : r.fulfilledAt,
              }
            : r
        )
      );
      setRowBusy(null);
      isActionProcessingRef.current = false;
      return;
    }

    try {
      const res = await fetch('/api/admin/redemptions', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ redemptionId: id, action }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        const extra = action === 'cancel' && typeof d.coins === 'number' ? ` — Số dư mới: ${d.coins} xu` : '';
        const actionMsg =
          action === 'fulfill'
            ? 'Đã duyệt giao quà'
            : action === 'reject'
            ? 'Đã từ chối phiếu đổi quà'
            : 'Đã hủy phiếu & hoàn xu';
        setNotice(
          `✅ ${actionMsg} #${id}${extra}`
        );
        // Cập nhật trạng thái phiếu đổi quà trực tiếp trong danh sách
        setRedemptions((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: action === 'fulfill' ? 'fulfilled' : action === 'reject' ? 'rejected' : 'cancelled',
                  fulfilledAt: action === 'fulfill' ? new Date().toISOString() : r.fulfilledAt,
                }
              : r
          )
        );
      } else {
        setError(`❌ ${d.error ?? 'Không thể xử lý phiếu đổi quà.'}`);
      }
    } catch {
      setError('❌ Lỗi kết nối khi gửi yêu cầu xử lý phiếu.');
    } finally {
      setRowBusy(null);
      isActionProcessingRef.current = false;
    }
  };

  // Hành động Kích Hoạt VIP 1-Click (Tab 1) - Chống double-click #071
  const handleManualActivateVip = (e: React.FormEvent) => {
    e.preventDefault();
    if (isActivatingVip) return;
    if (!vipTargetEmail.trim()) {
      alert('Vui lòng nhập Email hoặc User ID!');
      return;
    }

    setIsActivatingVip(true);
    try {
      const planPrices = {
        PRO: 299000,
        PREMIUM: 699000,
        ULTIMATE: 1499000,
      };

      const newTxn: PaymentTransaction = {
        id: `VIP-${Math.floor(100000 + Math.random() * 900000)}`,
        userEmail: vipTargetEmail.trim(),
        userName: vipTargetEmail.split('@')[0] || 'VIP Member',
        plan: vipSelectedPlan,
        amount: planPrices[vipSelectedPlan],
        gateway: 'Manual_Admin',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
      };

      setTransactions((prev) => [newTxn, ...prev]);

      // Cập nhật student nếu có
      setStudents((prev) => {
        const existing = prev.find((s) => s.email.toLowerCase() === vipTargetEmail.toLowerCase());
        if (existing) {
          return prev.map((s) =>
            s.email.toLowerCase() === vipTargetEmail.toLowerCase()
              ? {
                  ...s,
                  vipStatus: 'ACTIVE',
                  vipExpiry: new Date(Date.now() + vipCustomDays * 24 * 3600 * 1000).toISOString().split('T')[0],
                }
              : s
          );
        }
        return [
          {
            id: `STU-${Math.floor(1000 + Math.random() * 9000)}`,
            name: vipTargetEmail.split('@')[0],
            email: vipTargetEmail.trim(),
            phone: 'Chưa cập nhật',
            targetScore: 1500,
            predictedScore: 1350,
            vipStatus: 'ACTIVE',
            vipExpiry: new Date(Date.now() + vipCustomDays * 24 * 3600 * 1000).toISOString().split('T')[0],
            coins: 200,
            mockTestsDone: 0,
            accuracy: 0,
          },
          ...prev,
        ];
      });

      setNotice(`⚡ Đã kích hoạt gói VIP ${vipSelectedPlan} (${vipCustomDays} ngày) thành công cho học viên: ${vipTargetEmail}!`);
      setVipTargetEmail('');
    } finally {
      setIsActivatingVip(false);
    }
  };

  // Hành động Duyệt / Hoàn tiền đơn hàng (Chống double-click #071)
  const handleToggleTransactionStatus = (txnId: string, nextStatus: 'SUCCESS' | 'REFUNDED') => {
    if (processingOrderId === txnId) return;
    setProcessingOrderId(txnId);
    try {
      setTransactions((prev) =>
        prev.map((t) => (t.id === txnId ? { ...t, status: nextStatus } : t))
      );
      setNotice(`✅ Đã cập nhật trạng thái đơn #${txnId} sang ${nextStatus === 'SUCCESS' ? 'Thành công' : 'Hoàn tiền'}`);
    } finally {
      setTimeout(() => setProcessingOrderId(null), 300);
    }
  };

  // Hành động CRM: Tặng Xu (Chống double-click #071)
  const handleRewardCoins = (studentId: string, amount: number) => {
    if (processingStudentId === studentId) return;
    setProcessingStudentId(studentId);
    try {
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, coins: s.coins + amount } : s))
      );
      setNotice(`🎁 Đã tặng thành công +${amount} Xu cho học viên #${studentId}!`);
    } finally {
      setTimeout(() => setProcessingStudentId(null), 300);
    }
  };

  // Hành động CRM: Gia hạn VIP (Chống double-click #071)
  const handleExtendVipDays = (studentId: string, days: number) => {
    if (processingStudentId === studentId) return;
    setProcessingStudentId(studentId);
    try {
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s;
          const currentExp = new Date(s.vipExpiry).getTime();
          const baseTime = currentExp > Date.now() ? currentExp : Date.now();
          const newExpiry = new Date(baseTime + days * 24 * 3600 * 1000).toISOString().split('T')[0];
          return { ...s, vipStatus: 'ACTIVE', vipExpiry: newExpiry };
        })
      );
      setNotice(`📅 Đã gia hạn thêm +${days} ngày VIP cho học viên #${studentId}!`);
    } finally {
      setTimeout(() => setProcessingStudentId(null), 300);
    }
  };

  // Hành động Question Triage: Sửa nhanh & Thưởng 50 Xu (Chống double-click #071)
  const handleResolveAndReward = (reportId: string, studentEmail: string) => {
    if (processingReportId === reportId) return;
    setProcessingReportId(reportId);
    try {
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: 'RESOLVED' } : r))
      );
      // Tặng 50 Xu cho học sinh đã báo lỗi
      setStudents((prev) =>
        prev.map((s) =>
          s.email.toLowerCase() === studentEmail.toLowerCase()
            ? { ...s, coins: s.coins + 50 }
            : s
        )
      );
      setNotice(`⭐ Đã duyệt sửa câu hỏi #${reportId} và tự động gửi tặng 50 Xu tri ân tới học sinh: ${studentEmail}!`);
    } finally {
      setTimeout(() => setProcessingReportId(null), 300);
    }
  };

  // Tính tổng GMV và các chỉ số KPI bảo vệ tuyệt đối khỏi NaN / Infinity (#072)
  const totalGmv = transactions.reduce((acc, t) => acc + (t.status === 'SUCCESS' ? t.amount : 0), 0);
  const successTxnsCount = transactions.filter((t) => t.status === 'SUCCESS').length;
  const avgOrderValue = safeDivide(totalGmv, successTxnsCount, 0);

  const activeVipCount = students.filter((s) => s.vipStatus === 'ACTIVE').length;
  const rawConversionRate = safeDivide(activeVipCount * 100, students.length, 0);
  const vipConversionPercent = Number.isFinite(rawConversionRate) ? rawConversionRate.toFixed(1) : '0.0';

  // AI Cost KPI tính toán an toàn (#072)
  const aiCallsCount = cost?.calls ?? 0;
  const aiCostTotal = cost?.costUsd ?? 0;
  const aiBudgetTotal = cost?.budgetUsd ?? 0;
  const aiRemainingTotal = cost?.remainingUsd ?? 0;
  const aiAvgCostPerCall = safeDivide(aiCostTotal, aiCallsCount, 0);
  const rawAiBurnRate = safeDivide(aiCostTotal * 100, aiBudgetTotal, 0);
  const aiBurnRate = Number.isFinite(rawAiBurnRate) ? Math.min(100, Math.max(0, rawAiBurnRate)) : 0;

  const availableClassCodes = Array.from(
    new Set(students.map((s) => s.classCode).filter(Boolean))
  ) as string[];

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
      s.email.toLowerCase().includes(searchStudent.toLowerCase()) ||
      s.phone.includes(searchStudent);
    const matchesClass =
      selectedClassFilter === 'ALL' || s.classCode === selectedClassFilter;
    const matchesRisk =
      atRiskFilter === 'ALL' || s.riskLevel === atRiskFilter;
    return matchesSearch && matchesClass && matchesRisk;
  });

  const filteredRedemptions = redemptions.filter((r) => {
    const matchesStatus =
      redemptionStatusFilter === 'ALL' || r.status === redemptionStatusFilter;
    const matchesSearch =
      !redemptionSearch ||
      r.rewardName.toLowerCase().includes(redemptionSearch.toLowerCase()) ||
      r.userId.toLowerCase().includes(redemptionSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // #C085: Xuất Báo Cáo Excel Tiếng Việt Chuẩn (UTF-8 BOM CSV)
  const handleExportStudentsCsv = () => {
    const headers = [
      'Mã Học Viên',
      'Họ Và Tên',
      'Email',
      'Số Điện Thoại',
      'Mã Lớp (Cohort)',
      'Gói VIP',
      'Hạn VIP',
      'Điểm Dự Đoán',
      'Điểm Mục Tiêu',
      'Số Đề Mock Đã Làm',
      'Độ Chính Xác (%)',
      'Số Dư Xu',
      'Mức Nguy Cơ',
      'Số Ngày Chưa Đăng Nhập',
    ];

    const rows = filteredStudents.map((st) => [
      st.id,
      st.name,
      presentationMode ? maskEmail(st.email) : st.email,
      presentationMode ? maskPhone(st.phone) : st.phone,
      st.classCode || 'Tự do',
      st.vipStatus === 'ACTIVE' ? 'VIP THỰC THỤ' : 'TRIAL',
      st.vipExpiry,
      st.predictedScore,
      st.targetScore,
      st.mockTestsDone,
      `${st.accuracy}%`,
      presentationMode ? '***' : st.coins,
      st.riskLevel === 'HIGH' ? 'Nguy cơ cao' : st.riskLevel === 'MEDIUM' ? 'Cần chú ý' : 'An toàn',
      st.lastActiveDaysAgo ?? 0,
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadUtf8BomCsv(`Danh_Sach_Hoc_Vien_SAT_${dateStr}.csv`, headers, rows);
    setNotice(`📥 Đã xuất thành công file Excel (UTF-8 BOM) gồm ${rows.length} học viên!`);
  };

  // #C084 / #C085: Xuất Nhật ký kiểm toán đổi thưởng CSV
  const handleExportRedemptionsCsv = () => {
    const headers = [
      'Mã Phiếu',
      'Tên Quà Thưởng',
      'Chi Phí (Xu)',
      'Mã Học Viên (UserId)',
      'Thời Gian Yêu Cầu',
      'Trạng Thái',
    ];

    const rows = filteredRedemptions.map((r) => [
      r.id,
      r.rewardName,
      r.costCoins,
      r.userId,
      fmtTime(r.createdAt),
      r.status === 'PENDING' ? 'Chờ duyệt' : r.status === 'FULFILLED' ? 'Đã giao quà' : 'Đã hủy hoàn xu',
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadUtf8BomCsv(`Nhat_Ky_Doi_Thuong_SAT_${dateStr}.csv`, headers, rows);
    setNotice(`📥 Đã xuất thành công nhật ký đổi thưởng (${rows.length} phiếu) định dạng Excel UTF-8!`);
  };

  // #C082: Tạo Link Giao Bài 1-Click & Sao Chép Tin Nhắn Zalo
  const handleCopyZaloMessage = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sat.nghiaguru.vn';
    const practiceUrl = `${origin}/practice?skill=${selectedHeatmapSkill}&class=${encodeURIComponent(
      zaloClassTarget
    )}&count=${targetQuestionCount}`;

    const skillObj = DOMAIN_HEATMAP_DATA.find((s) => s.id === selectedHeatmapSkill);
    const skillName = skillObj ? `${skillObj.module} - ${skillObj.name}` : selectedHeatmapSkill;

    const message = `📢 [BÀI TẬP BỔ TRỢ SAT - LỚP ${zaloClassTarget}]
🎯 Chuyên đề: ${skillName}
⏱️ Số lượng câu hỏi: ${targetQuestionCount} câu phân hóa
🔗 Link làm bài trực tiếp: ${practiceUrl}
💡 Lời dặn từ Thầy Nghĩa: ${zaloCustomNote}
⚡ Học sinh hoàn thành bài tập trước 22:00 để được chấm điểm tự động và nhận +50 Xu thưởng!`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(message).then(() => {
        setZaloCopiedFeedback(true);
        setTimeout(() => setZaloCopiedFeedback(false), 2500);
      });
    }
  };

  // #C087: Thêm mẹo giải mới của giáo viên
  const handleAddTeacherTip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTipTopic.trim() || !newTipTitle.trim() || !newTipContent.trim()) {
      setError('Vui lòng điền đầy đủ Chuyên đề, Tiêu đề mẹo và Nội dung!');
      return;
    }

    const newTip: TeacherTip = {
      id: `TIP-${Date.now().toString().slice(-4)}`,
      module: newTipModule,
      topic: newTipTopic.trim(),
      title: newTipTitle.trim(),
      content: newTipContent.trim(),
      author: 'Thầy Nghĩa (SAT_NGHIAGURU)',
      views: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setTeacherTips([newTip, ...teacherTips]);
    setNewTipTopic('');
    setNewTipTitle('');
    setNewTipContent('');
    setIsAddingTip(false);
    setNotice(`💡 Đã lưu mẹo giải mới "${newTip.title}" vào kho tri thức của lớp!`);
  };

  return (
    <div className={`min-h-screen bg-[#090d16] text-slate-100 ${presentationMode ? 'text-[15px]' : ''}`}>
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0c1220]/90 backdrop-blur-md px-4 py-3.5 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-xl font-black text-slate-950 shadow-lg shadow-amber-500/20">
              ⚡
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white md:text-xl">
                  Admin Cockpit <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">SAT_NGHIAGURU</span>
                </h1>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  LIVE 2026
                </span>
              </div>
              <p className="text-xs text-slate-400">Trung tâm Điều hành Thương mại, Doanh thu, VIP CRM & Giám sát AI</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* #C086: Presentation Mode Toggle */}
            <button
              onClick={() => {
                const next = !presentationMode;
                setPresentationMode(next);
                setNotice(
                  next
                    ? '📽️ ĐÃ BẬT CHẾ ĐỘ TRÌNH CHIẾU: Tự động ẩn toàn bộ PII (Email, SĐT, Tiền) và tối ưu cỡ chữ máy chiếu!'
                    : '🖥️ Đã trở về Chế độ Quản trị viên chuẩn.'
                );
              }}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                presentationMode
                  ? 'border-purple-400 bg-purple-500/20 text-purple-300 shadow-md shadow-purple-500/20'
                  : 'border-white/10 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
              title="Chế độ chiếu bài trên lớp: Phóng chữ 125% và che giấu email, SĐT, doanh thu nhạy cảm"
            >
              <span>📽️</span>
              <span>{presentationMode ? 'Trình Chiếu: BẬT' : 'Trình Chiếu: TẮT'}</span>
            </button>

            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/80 px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:border-amber-400/40 disabled:opacity-50"
            >
              <span>{loading ? '⏳' : '🔄'}</span>
              <span>{loading ? 'Đang cập nhật…' : 'Đồng bộ'}</span>
            </button>
            <div className="hidden rounded-lg bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 md:block">
              🟢 Hệ thống hoạt động 99.98%
            </div>
          </div>
        </div>

        {/* 6 Tabs Navigation Bar (Including #C081-#C090 Teacher Cockpit) */}
        <div className="mx-auto mt-4 max-w-7xl">
          <nav className="flex space-x-1 overflow-x-auto pb-1 text-xs font-bold scrollbar-none md:text-sm">
            {[
              { id: 'revenue', label: '💰 Doanh Thu & VietQR', badge: transactions.length },
              { id: 'crm', label: '👥 Quản Lý Học Viên (CRM)', badge: students.length },
              { id: 'teacher', label: '🎯 Công Cụ Giáo Viên & Lớp Học', badge: 'B2B2C' },
              { id: 'triage', label: '📚 Kiểm Duyệt Báo Lỗi', badge: reports.filter((r) => r.status === 'PENDING').length },
              { id: 'ai_cost', label: '🤖 Phanh AI & Chi Phí', badge: cost ? `$${cost.costUsd.toFixed(2)}` : null },
              { id: 'redemptions', label: '🎁 Duyệt Đổi Quà', badge: redemptions.length },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 transition ${
                    active
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.badge !== null && tab.badge !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                        active ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
        {/* Presentation Mode Warning Banner */}
        {presentationMode && (
          <div className="flex items-center justify-between rounded-xl border border-purple-500/40 bg-purple-950/30 p-3.5 text-xs text-purple-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">📽️</span>
              <span>
                <strong>CHẾ ĐỘ TRÌNH CHIẾU CHỮA BÀI (ACTIVE):</strong> Đang ẩn email, số điện thoại học sinh và số tiền giao dịch để bảo vệ quyền riêng tư khi trình chiếu màn hình lớn hoặc chia sẻ qua Zoom/Google Meet.
              </span>
            </div>
            <button
              onClick={() => setPresentationMode(false)}
              className="rounded bg-purple-500/30 px-2 py-1 text-[11px] font-bold text-purple-200 hover:bg-purple-500/50"
            >
              Tắt Trình Chiếu
            </button>
          </div>
        )}

        {/* Global Notifications / Alerts */}
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-white">✕</button>
          </div>
        )}
        {notice && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-sm text-emerald-200">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎉</span>
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-xs text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Fallback Secret Input */}
        {needSecret && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6 backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-2xl">
                🔑
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-amber-300">Xác thực quyền Quản trị tối cao (Dual-Auth Gate)</h3>
                <p className="mt-1 text-xs text-slate-300">
                  Tài khoản hiện tại chưa có role admin trên cookie session. Vui lòng nhập <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-amber-200">ADMIN_SECRET</code> để cấp quyền tức thì:
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <input
                    id={secretInputId}
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && load()}
                    placeholder="Dán mã bí mật ADMIN_SECRET…"
                    className="flex-1 min-w-[280px] rounded-lg border border-white/10 bg-slate-900/90 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    onClick={load}
                    disabled={loading || !secret}
                    className="rounded-lg bg-amber-500 px-6 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
                  >
                    Mở Khóa Bảng Điều Khiển
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 0 (MASTER): CÔNG CỤ GIÁO VIÊN & LỚP HỌC (#C081 - #C090 B2B2C TEACHER COCKPIT)
           ========================================================================= */}
        {activeTab === 'teacher' && (
          <div className="space-y-6">
            {/* Header & Subtitle */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎯</span>
                  <h2 className="text-base font-black text-white md:text-xl">
                    Bảng Điều Khiển Giáo Viên & Lớp Học <span className="text-amber-400">(B2B2C Cockpit)</span>
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Phân tích bản đồ lỗ hổng chuyên đề, tạo link giao bài tập 1-click gửi Zalo lớp, radar cảnh báo sớm học sinh nguy cơ bỏ cuộc & quản lý mẹo giải.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 text-xs font-bold text-indigo-300">
                  🏫 Lớp đang xem: {zaloClassTarget}
                </span>
                <button
                  onClick={handleExportStudentsCsv}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
                >
                  <span>📥</span>
                  <span>Xuất Excel Lớp (UTF-8 BOM)</span>
                </button>
              </div>
            </div>

            {/* GRID: #C081 Bản Đồ Lỗ Hổng & #C082 Bộ Tạo Link Giao Bài Zalo 1-Click */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* CỘT TRÁI (7 cols): #C081 Bản Đồ Nhiệt Lỗ Hổng Chuyên Đề */}
              <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                      <span>🗺️</span> Bản Đồ Lỗ Hổng Chuyên Đề Lớp Học (Domain Heatmap)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tỷ lệ làm sai tổng hợp từ kết quả làm bài của học sinh để giáo viên giao bài trọng tâm
                    </p>
                  </div>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 font-semibold">
                    6 Kỹ năng Digital SAT
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {DOMAIN_HEATMAP_DATA.map((item) => {
                    const isSelected = selectedHeatmapSkill === item.id;
                    const isHighRisk = item.errorRate >= 40;
                    const isMediumRisk = item.errorRate >= 25 && item.errorRate < 40;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedHeatmapSkill(item.id)}
                        className={`cursor-pointer rounded-xl border p-3.5 transition ${
                          isSelected
                            ? 'border-amber-400 bg-amber-500/10 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/50'
                            : 'border-white/5 bg-slate-950/60 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                              item.module === 'Math'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            }`}
                          >
                            {item.module}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isHighRisk
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : isMediumRisk
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            Sai: {item.errorRate}%
                          </span>
                        </div>

                        <div className="mt-2 text-xs font-bold text-white line-clamp-1">{item.name}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {item.studentsStruggling}/{item.totalStudents} học sinh cần rèn luyện
                        </div>

                        {/* Progress Bar Error Rate */}
                        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isHighRisk ? 'bg-red-500' : isMediumRisk ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${item.errorRate}%` }}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Mã: #{item.id}</span>
                          <span className={`font-semibold ${isSelected ? 'text-amber-300' : 'text-slate-400'}`}>
                            {isSelected ? '✓ Đang chọn' : 'Bấm để giao'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CỘT PHẢI (5 cols): #C082 Tạo Link Giao Bài 1-Click Gửi Zalo Lớp */}
              <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>⚡</span> Tạo Link Giao Bài 1-Click (Gửi Zalo)
                    </h3>
                    <span className="rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                      Zalo Webhook Ready
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Chọn lớp nhận bài (#C090) */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-300">Lớp Nhận Bài Tập (Cohort)</label>
                      <select
                        value={zaloClassTarget}
                        onChange={(e) => setZaloClassTarget(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                      >
                        {availableClassCodes.length > 0 ? (
                          availableClassCodes.map((c) => (
                            <option key={c} value={c}>
                              Lớp {c}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="SAT-PRO-12A1">Lớp SAT-PRO-12A1 (Mục tiêu 1450+)</option>
                            <option value="SAT-INT-11B3">Lớp SAT-INT-11B3 (Mục tiêu 1350+)</option>
                            <option value="SAT-CRUSH-10A1">Lớp SAT-CRUSH-10A1 (Khởi động)</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Số lượng câu hỏi */}
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-300">
                        <span>Số lượng câu hỏi giao:</span>
                        <span className="font-extrabold text-amber-300">{targetQuestionCount} câu</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[5, 10, 15, 20].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setTargetQuestionCount(num)}
                            className={`rounded-lg py-1.5 text-xs font-bold transition ${
                              targetQuestionCount === num
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'border border-white/10 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {num} câu
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Lời dặn dò từ giáo viên */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-300">Lời dặn của Giáo viên / Trợ giảng</label>
                      <textarea
                        rows={2}
                        value={zaloCustomNote}
                        onChange={(e) => setZaloCustomNote(e.target.value)}
                        placeholder="Lời dặn học sinh trước khi làm bài…"
                        className="w-full rounded-xl border border-white/10 bg-slate-950/80 p-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none resize-none"
                      />
                    </div>

                    {/* Xem trước tin nhắn định dạng Zalo */}
                    <div>
                      <span className="mb-1 block text-xs font-semibold text-slate-300">Mẫu Tin Nhắn Chuẩn Bị Gửi Zalo Lớp:</span>
                      <div className="rounded-xl border border-white/5 bg-slate-950/80 p-3 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap select-all">
                        {`📢 [BÀI TẬP BỔ TRỢ SAT - LỚP ${zaloClassTarget}]
🎯 Chuyên đề: ${
                          DOMAIN_HEATMAP_DATA.find((s) => s.id === selectedHeatmapSkill)?.name ||
                          selectedHeatmapSkill
                        }
⏱️ Số câu: ${targetQuestionCount} câu phân hóa
🔗 Link làm bài: /practice?skill=${selectedHeatmapSkill}&class=${zaloClassTarget}&count=${targetQuestionCount}
💡 Lời dặn: ${zaloCustomNote}
⚡ Hoàn thành trước 22:00 để nhận +50 Xu thưởng!`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nút bấm Copy 1-Click */}
                <div className="mt-4 pt-2">
                  <button
                    onClick={handleCopyZaloMessage}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold shadow-lg transition active:scale-95 ${
                      zaloCopiedFeedback
                        ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:brightness-110 shadow-blue-500/20'
                    }`}
                  >
                    <span>{zaloCopiedFeedback ? '✅' : '📋'}</span>
                    <span>
                      {zaloCopiedFeedback
                        ? 'ĐÃ COPY TIN NHẮN! DÁN VÀO ZALO LỚP NGAY'
                        : 'Sao Chép Tin Nhắn Zalo Chuẩn Định Dạng'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* #C083 & #C090: RADAR CẢNH BÁO SỚM HỌC SINH NGUY CƠ BỎ CUỘC */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-sm">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-red-400 flex items-center gap-2">
                    <span>🚨</span> Radar Cảnh Báo Sớm Học Sinh Nguy Cơ Bỏ Cuộc (At-Risk Early Warning)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Phát hiện học sinh không vào học {'>'} 5 ngày, điểm tụt hoặc độ chính xác thấp để giáo viên/trợ giảng can thiệp ngay
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-1 text-xs font-bold text-red-300">
                    {students.filter((s) => s.riskLevel === 'HIGH').length} Nguy cơ cao
                  </span>
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-300">
                    {students.filter((s) => s.riskLevel === 'MEDIUM').length} Cần động viên
                  </span>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-300">
                    {students.filter((s) => s.riskLevel === 'SAFE').length} An toàn
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 pr-4">Học Viên</th>
                      <th className="py-2.5 pr-4">Lớp (Cohort)</th>
                      <th className="py-2.5 pr-4">Offline</th>
                      <th className="py-2.5 pr-4">Điểm / Mục Tiêu</th>
                      <th className="py-2.5 pr-4">Độ Chính Xác</th>
                      <th className="py-2.5 pr-4">Chẩn Đoán Rủi Ro</th>
                      <th className="py-2.5 text-right">Hành Động Khẩn Cấp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {students
                      .sort((a, b) => {
                        const scoreMap: Record<string, number> = { HIGH: 3, MEDIUM: 2, SAFE: 1 };
                        return (scoreMap[b.riskLevel || 'SAFE'] || 0) - (scoreMap[a.riskLevel || 'SAFE'] || 0);
                      })
                      .map((st) => {
                        return (
                          <tr key={st.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 pr-4 font-semibold text-white">
                              <div>{st.name}</div>
                              <div className="text-[11px] text-slate-500">
                                {presentationMode ? maskEmail(st.email) : st.email}
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="rounded bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                                {st.classCode || 'Tự do'}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className={`font-bold ${
                                  (st.lastActiveDaysAgo ?? 0) >= 7
                                    ? 'text-red-400'
                                    : (st.lastActiveDaysAgo ?? 0) >= 3
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {st.lastActiveDaysAgo ?? 0} ngày
                              </span>
                            </td>
                            <td className="py-3 pr-4 font-mono font-semibold">
                              <span className="text-white">{st.predictedScore}</span>
                              <span className="text-slate-500"> / {st.targetScore}</span>
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className={`font-bold ${
                                  st.accuracy < 60 ? 'text-red-400' : st.accuracy < 75 ? 'text-amber-400' : 'text-emerald-400'
                                }`}
                              >
                                {st.accuracy}%
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              {st.riskLevel === 'HIGH' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-[10px] font-extrabold text-red-300">
                                  🚨 Nguy cơ bỏ cuộc cao
                                </span>
                              )}
                              {st.riskLevel === 'MEDIUM' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                  ⚠️ Cần khích lệ thêm
                                </span>
                              )}
                              {st.riskLevel === 'SAFE' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                  ✅ Tiến độ tích cực
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleRewardCoins(st.id, 50)}
                                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20"
                                  title="Thưởng 50 xu khích lệ học sinh vào làm bài"
                                >
                                  🎁 +50 Xu
                                </button>
                                <button
                                  onClick={() => handleExtendVipDays(st.id, 7)}
                                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                                  title="Tặng thêm 7 ngày VIP để học sinh có thêm thời gian"
                                >
                                  📅 +7 Ngày VIP
                                </button>
                                <button
                                  onClick={() =>
                                    alert(
                                      `Đã mở tin nhắn động viên gửi học sinh ${st.name} (${
                                        presentationMode ? maskEmail(st.email) : st.email
                                      }) qua Zalo/Email!`
                                    )
                                  }
                                  className="rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700"
                                >
                                  💬 Nhắn Lớp
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* GRID: #C086 Chế Độ Trình Chiếu, #C087 Mẹo Giải Giáo Viên & #C089 Tiết Kiệm Chi Phí AI */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* CARD 1: #C086 Chế Độ Trình Chiếu Chữa Bài Trên Lớp */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-purple-300 flex items-center gap-1.5">
                      <span>📽️</span> Chế Độ Trình Chiếu Chữa Bài
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        presentationMode ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {presentationMode ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Tối ưu kích thước chữ máy chiếu (125%) và tự động che giấu Email, SĐT, Doanh thu khi trình chiếu trên lớp hoặc chia sẻ màn hình qua Zoom.
                  </p>
                </div>

                <div className="mt-4 pt-2">
                  <button
                    onClick={() => {
                      const next = !presentationMode;
                      setPresentationMode(next);
                      setNotice(
                        next
                          ? '📽️ ĐÃ BẬT CHẾ ĐỘ TRÌNH CHIẾU: Bảo vệ thông tin nhạy cảm của học viên khi giảng bài!'
                          : '🖥️ Đã trở về Chế độ Quản trị viên chuẩn.'
                      );
                    }}
                    className={`w-full rounded-xl py-2 text-xs font-bold transition ${
                      presentationMode
                        ? 'bg-purple-600 text-white hover:bg-purple-500'
                        : 'border border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                    }`}
                  >
                    {presentationMode ? '✕ Tắt Chế Độ Trình Chiếu' : '⚡ Bật Chế Độ Trình Chiếu (Ẩn PII)'}
                  </button>
                </div>
              </div>

              {/* CARD 2: #C089 Tiết Kiệm Chi Phí AI (2-Layer Cache Hit Rate) */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                      <span>🛡️</span> Hiệu Suất Bộ Nhớ Cache AI
                    </h3>
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
                      93.6% Hit Rate
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Kiến trúc 2 tầng (Tầng 1 Static Hints 78.4% + Tầng 2 Dynamic Cache 15.2%) bảo vệ biên lợi nhuận gộp {'>'} 82%.
                  </p>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Tầng 1 (Static Pre-computed Hints):</span>
                      <span className="font-bold text-emerald-400">78.4%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: '78.4%' }} />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Tầng 2 (Shared Dynamic Cache):</span>
                      <span className="font-bold text-blue-400">15.2%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: '15.2%' }} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Tiết kiệm tháng này:</span>
                  <span className="font-bold text-emerald-400">+$182.40 USD (~4.6tr VNĐ)</span>
                </div>
              </div>

              {/* CARD 3: #C087 & #C088 Kho Mẹo Giải Của Giáo Viên */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                      <span>💡</span> Mẹo Giải Của Giáo Viên
                    </h3>
                    <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      {teacherTips.length} mẹo đang chia sẻ
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Các bí kíp bấm máy Desmos, giải nhanh từ vựng ngữ cảnh hiển thị ngay sau khi học sinh làm bài tập.
                  </p>

                  <div className="mt-3 space-y-2 max-h-36 overflow-y-auto pr-1">
                    {teacherTips.map((tip) => (
                      <div key={tip.id} className="rounded-lg bg-slate-950/60 p-2 border border-white/5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white line-clamp-1">{tip.title}</span>
                          <span className="text-[10px] text-slate-500 shrink-0 ml-1">👁️ {tip.views}</span>
                        </div>
                        <p className="mt-0.5 text-slate-400 line-clamp-2">{tip.content}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-2">
                  <button
                    onClick={() => setIsAddingTip(!isAddingTip)}
                    className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition"
                  >
                    {isAddingTip ? '✕ Đóng Khung Thêm Mẹo' : '➕ Thêm Mẹo Giải Mới'}
                  </button>
                </div>
              </div>
            </div>

            {/* Form Thêm Mẹo Giải Của Giáo Viên (Modal / Collapsible Panel) */}
            {isAddingTip && (
              <form onSubmit={handleAddTeacherTip} className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-5 space-y-4 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-amber-300">💡 Thêm Mẹo Giải Độc Quyền Cho Học Sinh</h4>
                  <button type="button" onClick={() => setIsAddingTip(false)} className="text-xs text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">Phân Hệ (Module)</label>
                    <select
                      value={newTipModule}
                      onChange={(e) => setNewTipModule(e.target.value as any)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    >
                      <option value="Math">Math (Toán Digital SAT)</option>
                      <option value="Reading & Writing">Reading & Writing (Đọc & Viết)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">Chuyên Đề (Topic)</label>
                    <input
                      type="text"
                      required
                      value={newTipTopic}
                      onChange={(e) => setNewTipTopic(e.target.value)}
                      placeholder="ví dụ: Desmos Quadratic Optimization, Transitions..."
                      className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Tiêu Đề Mẹo Ngắn Gọn</label>
                  <input
                    type="text"
                    required
                    value={newTipTitle}
                    onChange={(e) => setNewTipTitle(e.target.value)}
                    placeholder="ví dụ: Mẹo đặt thanh trượt k trong Desmos để giải hệ nghiệm kép trong 15s"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Nội Dung Chi Tiết Của Mẹo</label>
                  <textarea
                    rows={3}
                    required
                    value={newTipContent}
                    onChange={(e) => setNewTipContent(e.target.value)}
                    placeholder="Viết hướng dẫn các bước thao tác, công thức hoặc lưu ý bẫy cho học sinh…"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 p-3 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingTip(false)}
                    className="rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:brightness-110"
                  >
                    Lưu Mẹo Giải Vào Hệ Thống
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 1: DOANH THU & ĐỐI SOÁT ĐƠN VIETQR / PAYOS + KÍCH HOẠT VIP 1-CLICK
           ========================================================================= */}
        {activeTab === 'revenue' && (
          <div className="space-y-6">
            {/* KPI Revenue Overview Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:p-5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng Doanh Thu (GMV)</span>
                <div className="mt-2 text-xl font-black text-amber-400 md:text-2xl">{fmtMoney(totalGmv)}</div>
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <span>▲ +24.8%</span>
                  <span className="text-slate-500">so với tháng trước</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:p-5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">MRR Định Kỳ Ước Tính</span>
                <div className="mt-2 text-xl font-black text-emerald-400 md:text-2xl">{fmtMoney(38500000)}</div>
                <div className="mt-1 text-[11px] text-slate-500">Dựa trên gói tự gia hạn</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:p-5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Đơn Thanh Toán</span>
                <div className="mt-2 text-xl font-black text-blue-400 md:text-2xl">{transactions.length} Giao dịch</div>
                <div className="mt-1 text-[11px] text-emerald-400">100% khớp lệnh VietQR/PayOS</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:p-5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tỉ Lệ Chuyển Đổi VIP</span>
                <div className="mt-2 text-xl font-black text-purple-400 md:text-2xl">18.6%</div>
                <div className="mt-1 text-[11px] text-slate-500">Học sinh free sang gói trả phí</div>
              </div>
            </div>

            {/* Quick VIP Activation Box */}
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-slate-900/80 to-slate-900/80 p-5 md:p-6 shadow-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-slate-950 font-bold text-sm">⚡</span>
                    <h2 className="text-base font-black text-amber-300 md:text-lg">Kích Hoạt Gói VIP Thủ Công 1-Click</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Kích hoạt nhanh khi học viên chuyển khoản trực tiếp qua ngân hàng hoặc nhận học bổng từ thầy Nghĩa.
                  </p>
                </div>
              </div>

              <form onSubmit={handleManualActivateVip} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <label htmlFor="vip-email-input" className="mb-1 block text-xs font-semibold text-slate-300">Email hoặc UUID Học Viên</label>
                  <input
                    id="vip-email-input"
                    type="text"
                    required
                    value={vipTargetEmail}
                    onChange={(e) => setVipTargetEmail(e.target.value)}
                    placeholder="ví dụ: hocsinh@gmail.com"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="vip-plan-select" className="mb-1 block text-xs font-semibold text-slate-300">Gói Bản Quyền</label>
                  <select
                    id="vip-plan-select"
                    value={vipSelectedPlan}
                    onChange={(e) => {
                      const p = e.target.value as any;
                      setVipSelectedPlan(p);
                      if (p === 'PRO') setVipCustomDays(30);
                      else if (p === 'PREMIUM') setVipCustomDays(90);
                      else if (p === 'ULTIMATE') setVipCustomDays(365);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="PRO">PRO Pass (30 Ngày - 299k)</option>
                    <option value="PREMIUM">PREMIUM Master (90 Ngày - 699k)</option>
                    <option value="ULTIMATE">ULTIMATE 1500+ (365 Ngày - 1.499k)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="vip-days-input" className="mb-1 block text-xs font-semibold text-slate-300">Thời Hạn Cấp (Ngày)</label>
                  <input
                    id="vip-days-input"
                    type="number"
                    min={1}
                    max={1000}
                    value={vipCustomDays}
                    onChange={(e) => setVipCustomDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-2.5 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 transition hover:brightness-110 active:scale-95"
                  >
                    ⚡ Kích Hoạt Tức Thì
                  </button>
                </div>
              </form>
            </div>

            {/* Transactions Audit Table */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-200">Đối Soát Giao Dịch Gần Nhất</h3>
                  <p className="text-xs text-slate-400">Tự động bắt webhook từ VietQR Pro và PayOS API</p>
                </div>
                <span className="rounded-lg bg-slate-800 px-3 py-1 text-xs text-slate-300 font-medium">
                  {transactions.length} đơn gần nhất
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2.5 pr-4">Mã Đơn</th>
                      <th className="py-2.5 pr-4">Học Viên</th>
                      <th className="py-2.5 pr-4">Gói Bản Quyền</th>
                      <th className="py-2.5 pr-4">Số Tiền</th>
                      <th className="py-2.5 pr-4">Cổng</th>
                      <th className="py-2.5 pr-4">Thời Gian</th>
                      <th className="py-2.5 text-right">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 pr-4 font-mono font-semibold text-amber-300">{t.id}</td>
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-slate-100">{t.userName}</div>
                          <div className="text-[11px] text-slate-400">
                            {presentationMode ? maskEmail(t.userEmail) : t.userEmail}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              t.plan === 'ULTIMATE'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : t.plan === 'PREMIUM'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {t.plan}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-bold text-white">
                          {presentationMode ? maskMoney(t.amount) : fmtMoney(t.amount)}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 font-medium">
                            {t.gateway}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-slate-400">{fmtTime(t.createdAt)}</td>
                        <td className="py-3 text-right">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                            ✓ {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


        {/* =========================================================================
            TAB 2: QUẢN LÝ HỌC VIÊN (STUDENT CRM 360)
           ========================================================================= */}
        {activeTab === 'crm' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-100 md:text-lg">Hồ Sơ Học Viên & Dự Báo Điểm 360</h2>
                <p className="text-xs text-slate-400">Theo dõi tiến độ luyện thi, can thiệp kịp thời giúp học viên bứt phá điểm số.</p>
              </div>

              {/* Filters & Export Toolbar (#C083, #C085, #C090) */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  placeholder="🔍 Tìm tên, email, sđt…"
                  className="w-44 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                />

                {/* Cohort Filter (#C090) */}
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="ALL">🏫 Tất cả lớp ({students.length})</option>
                  {availableClassCodes.map((c) => (
                    <option key={c} value={c}>
                      Lớp {c} ({students.filter((s) => s.classCode === c).length})
                    </option>
                  ))}
                </select>

                {/* At-Risk Radar Filter (#C083) */}
                <select
                  value={atRiskFilter}
                  onChange={(e) => setAtRiskFilter(e.target.value as any)}
                  className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="ALL">🚨 Tất cả rủi ro</option>
                  <option value="HIGH">🔴 Nguy cơ cao ({students.filter((s) => s.riskLevel === 'HIGH').length})</option>
                  <option value="MEDIUM">🟡 Cần chú ý ({students.filter((s) => s.riskLevel === 'MEDIUM').length})</option>
                  <option value="SAFE">🟢 An toàn ({students.filter((s) => s.riskLevel === 'SAFE').length})</option>
                </select>

                {/* #C085: Xuất Báo Cáo Excel Tiếng Việt Chuẩn (UTF-8 BOM CSV) */}
                <button
                  onClick={handleExportStudentsCsv}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20 active:scale-95"
                  title="Xuất file CSV mã hóa UTF-8 BOM - mở trực tiếp trên Excel không bao giờ bị lỗi font tiếng Việt"
                >
                  <span>📥</span>
                  <span>Xuất Excel Học Viên</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredStudents.map((st) => (
                <div key={st.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 backdrop-blur-sm transition hover:border-amber-500/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{st.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            st.vipStatus === 'ACTIVE'
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {st.vipStatus === 'ACTIVE' ? 'VIP THỰC THỤ' : 'TRIAL TRẢI NGHIỆM'}
                        </span>
                        {/* Class Cohort Tag (#C090) */}
                        {st.classCode && (
                          <span className="rounded bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                            Lớp {st.classCode}
                          </span>
                        )}
                        {/* At-Risk Status Badge (#C083) */}
                        {st.riskLevel === 'HIGH' && (
                          <span className="rounded bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-[10px] font-extrabold text-red-300 animate-pulse">
                            🚨 Nguy cơ cao ({st.lastActiveDaysAgo}d offline)
                          </span>
                        )}
                        {st.riskLevel === 'MEDIUM' && (
                          <span className="rounded bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            ⚠️ Cần chú ý ({st.lastActiveDaysAgo}d offline)
                          </span>
                        )}
                        {st.riskLevel === 'SAFE' && (
                          <span className="rounded bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            ✅ Tiến độ tốt
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {presentationMode ? maskEmail(st.email) : st.email} • {presentationMode ? maskPhone(st.phone) : st.phone}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500">Số dư:</span>
                      <div className="font-extrabold text-amber-300">
                        {presentationMode ? '*** Xu' : `${st.coins} Xu`}
                      </div>
                    </div>
                  </div>

                  {/* Score Prediction Progress */}
                  <div className="mt-4 rounded-xl bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Dự đoán điểm hiện tại:</span>
                      <span className="font-bold text-emerald-400">{st.predictedScore} / 1600</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Mục tiêu cam kết:</span>
                      <span className="font-bold text-amber-400">{st.targetScore} / 1600</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Đã làm: {st.mockTestsDone} đề Mock</span>
                      <span>Độ chính xác: {st.accuracy}%</span>
                      <span>Hạn VIP: {st.vipExpiry}</span>
                    </div>
                  </div>

                  {/* 1-Click Operations */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleRewardCoins(st.id, 100)}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
                    >
                      🎁 Thưởng +100 Xu
                    </button>
                    <button
                      onClick={() => handleExtendVipDays(st.id, 30)}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                    >
                      📅 Gia Hạn +30 Ngày
                    </button>
                    <button
                      onClick={() => alert(`Đã gửi thông báo nhắc ôn thi tới: ${presentationMode ? maskEmail(st.email) : st.email}`)}
                      className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
                    >
                      📩 Gửi Lời Nhắc Ôn
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* =========================================================================
            TAB 3: KIỂM DUYỆT CÂU HỎI & BÁO LỖI ĐỀ (QUESTION TRIAGE)
           ========================================================================= */}
        {activeTab === 'triage' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-100 md:text-lg">Hộp Thư Báo Lỗi Câu Hỏi Từ Học Viên</h2>
                <p className="text-xs text-slate-400">Duyệt nhanh phản ánh về sai đáp án, lỗi định dạng LaTeX và tự động thưởng 50 Xu tri ân học viên.</p>
              </div>
              <span className="rounded-full bg-red-500/20 border border-red-500/30 px-3 py-1 text-xs font-bold text-red-300">
                {reports.filter((r) => r.status === 'PENDING').length} việc cần xử lý
              </span>
            </div>

            <div className="space-y-4">
              {reports.map((rep) => (
                <div key={rep.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-300">#{rep.questionId}</span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                          {rep.module}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                            rep.issueType === 'SAI_DAP_AN'
                              ? 'bg-red-500/20 text-red-300'
                              : rep.issueType === 'LOI_LATEX'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-yellow-500/20 text-yellow-300'
                          }`}
                        >
                          {rep.issueType}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-200">{rep.description}</p>
                      <div className="mt-2 text-[11px] text-slate-400">
                        Báo bởi: <span className="text-slate-300 font-medium">{rep.reportedBy}</span> lúc {fmtTime(rep.reportedAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 sm:pt-0">
                      {rep.status === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => handleResolveAndReward(rep.id, rep.reportedBy)}
                            className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400"
                          >
                            ⚡ Sửa Nhanh + Thưởng 50 Xu
                          </button>
                          <button
                            onClick={() => {
                              setReports((prev) =>
                                prev.map((r) => (r.id === rep.id ? { ...r, status: 'DISMISSED' } : r))
                              );
                              setNotice(`Đã đóng phản hồi #${rep.id}`);
                            }}
                            className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
                          >
                            Bỏ Qua
                          </button>
                        </>
                      ) : (
                        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                          ✓ ĐÃ XỬ LÝ & TẶNG XU
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* =========================================================================
            TAB 4: KIỂM SOÁT CHI PHÍ AI & PHANH KHẨN CẤP (AI COST & KILL-SWITCH)
           ========================================================================= */}
        {activeTab === 'ai_cost' && (
          <div className="space-y-6">
            {/* Live Metrics from /api/admin/ai-cost */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 md:p-6 backdrop-blur-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-100 md:text-lg">
                    💸 Chi Phí Gemini API Thực Tế {cost ? `(${cost.date})` : ''}
                  </h2>
                  <p className="text-xs text-slate-400">Theo dõi tiêu thụ token AI Tutor, chấm điểm tự luận và giải thích câu hỏi</p>
                </div>
                {cost && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-300">
                    Ngân sách ngày: ${cost.budgetUsd.toFixed(2)}
                  </div>
                )}
              </div>

              {cost ? (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4">
                    <span className="text-xs text-slate-400">Lượt gọi AI</span>
                    <div className="mt-1 text-lg font-black text-white">{cost.calls.toLocaleString('vi-VN')}</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4">
                    <span className="text-xs text-slate-400">Token Vào / Ra</span>
                    <div className="mt-1 text-sm font-bold text-amber-300">
                      {cost.tokensIn.toLocaleString('vi-VN')} / {cost.tokensOut.toLocaleString('vi-VN')}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4">
                    <span className="text-xs text-slate-400">Đã tiêu hôm nay</span>
                    <div className="mt-1 text-lg font-black text-red-400">${cost.costUsd.toFixed(4)}</div>
                  </div>
                  <div className={`rounded-xl border p-4 ${cost.remainingUsd <= 0 ? 'border-red-500/40 bg-red-950/20' : 'border-white/5 bg-slate-950/50'}`}>
                    <span className="text-xs text-slate-400">Hạn mức còn lại</span>
                    <div className={`mt-1 text-lg font-black ${cost.remainingUsd <= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      ${cost.remainingUsd.toFixed(2)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-xs text-slate-500 italic">Đang tải dữ liệu chi phí AI từ server…</div>
              )}
            </div>

            {/* Emergency Controls & Sliders */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Emergency Kill Switch */}
              <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/30 via-slate-900/60 to-slate-900/60 p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-red-400">⚡ Phanh Khẩn Cấp (Global AI Kill-Switch)</h3>
                    <p className="mt-1 text-xs text-slate-300">
                      Lập tức cắt toàn bộ các yêu cầu gọi Gemini API nếu phát hiện bị flood token, chuyển hệ thống về ngân hàng câu hỏi tĩnh.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const next = !aiKillSwitch;
                      setAiKillSwitch(next);
                      setNotice(next ? '⚠️ ĐÃ BẬT PHANH KHẨN CẤP: Toàn bộ AI tạm thời dừng hoạt động!' : '✅ Đã nhả phanh AI: Hệ thống trở lại bình thường!');
                    }}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      aiKillSwitch ? 'bg-red-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        aiKillSwitch ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <div className="mt-4 rounded-xl bg-slate-950/50 p-3 text-xs text-slate-400">
                  Trạng thái hiện tại:{' '}
                  <span className={`font-bold ${aiKillSwitch ? 'text-red-400' : 'text-emerald-400'}`}>
                    {aiKillSwitch ? 'ĐANG KÍCH HOẠT (CHẶN AI)' : 'HOẠT ĐỘNG BÌNH THƯỜNG'}
                  </span>
                </div>
              </div>

              {/* Eco Mode & Daily Budget Limit */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-amber-300">🌱 Chế Độ Tiết Kiệm (Eco Token Mode)</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Ưu tiên định tuyến yêu cầu sang mô hình Flash nhẹ hơn để tiết kiệm tới 80% chi phí.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEcoMode(!ecoMode);
                      setNotice(!ecoMode ? '🌱 Đã bật Eco Mode tiết kiệm 80% chi phí token!' : '⚡ Đã chuyển sang High-Performance Pro Mode.');
                    }}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      ecoMode ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        ecoMode ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold">Giới hạn ngân sách ngày (Daily Cap):</span>
                    <span className="font-bold text-amber-400">${dailyBudgetLimit} / ngày</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={dailyBudgetLimit}
                    onChange={(e) => setDailyBudgetLimit(Number(e.target.value))}
                    className="mt-2 w-full accent-amber-400"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                    <span>$5/ngày (Tiết kiệm)</span>
                    <span>$50/ngày</span>
                    <span>$100/ngày (Cao điểm)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* =========================================================================
            TAB 5: DUYỆT ĐỔI QUÀ (REDEMPTIONS HIỆN CÓ & FALLBACK MẪU) (#C084)
           ========================================================================= */}
        {activeTab === 'redemptions' && (() => {
          const displayRedemptions = filteredRedemptions.length > 0 ? filteredRedemptions : (redemptions.length > 0 ? redemptions : INITIAL_REDEMPTIONS);
          return (
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-100 md:text-lg">
                    🎁 Hàng Đợi Phiếu Đổi Quà Cần Duyệt{' '}
                    <span className="ml-2 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                      {displayRedemptions.length}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Duyệt phát quà cho học viên hoặc hủy phiếu hoàn trả lại xu server-authoritative (#C084).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Ô tìm kiếm quà tặng */}
                  <input
                    type="text"
                    placeholder="Tìm tên quà hoặc mã học viên..."
                    value={redemptionSearch}
                    onChange={(e) => setRedemptionSearch(e.target.value)}
                    className="rounded-lg border border-white/10 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-400/50 focus:outline-none"
                  />
                  {/* Lọc trạng thái */}
                  <select
                    value={redemptionStatusFilter}
                    onChange={(e) => setRedemptionStatusFilter(e.target.value)}
                    className="rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300 focus:border-amber-400/50 focus:outline-none"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="pending">Chờ duyệt</option>
                    <option value="fulfilled">Đã giao quà</option>
                    <option value="cancelled">Đã hủy (Hoàn xu)</option>
                    <option value="rejected">Đã từ chối</option>
                  </select>
                  {/* Nút xuất Excel UTF-8 BOM CSV (#C085) */}
                  <button
                    onClick={handleExportRedemptionsCsv}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                    title="Xuất Excel CSV chuẩn UTF-8 BOM"
                  >
                    <span>📊 Xuất Excel CSV</span>
                  </button>
                </div>
              </div>

              {!loading && displayRedemptions.length === 0 && !needSecret && (
                <div className="py-12 text-center text-sm text-slate-500">
                  ✨ Tuyệt vời! Hiện không còn phiếu đổi quà nào phù hợp với bộ lọc.
                </div>
              )}

              {displayRedemptions.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 pr-4">Mã Phiếu</th>
                        <th className="py-2.5 pr-4">Quà Thưởng</th>
                        <th className="py-2.5 pr-4">Giá (Xu)</th>
                        <th className="py-2.5 pr-4">Học Viên</th>
                        <th className="py-2.5 pr-4">Thời Gian</th>
                        <th className="py-2.5 pr-4">Trạng Thái</th>
                        <th className="py-2.5 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {displayRedemptions.map((r) => {
                        const isPending = r.status === 'pending' || r.status === 'PENDING';
                        const isFulfilled = r.status === 'fulfilled' || r.status === 'FULFILLED';
                        const isCancelled = r.status === 'cancelled' || r.status === 'CANCELLED';
                        const isRejected = r.status === 'rejected' || r.status === 'REJECTED';

                        return (
                          <tr key={r.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 pr-4 font-mono text-xs text-amber-400/90">{r.id}</td>
                            <td className="py-3 pr-4 font-semibold text-slate-100">{r.rewardName}</td>
                            <td className="py-3 pr-4 font-bold text-amber-300">{r.costCoins.toLocaleString('vi-VN')} Xu</td>
                            <td className="py-3 pr-4 font-mono text-xs text-slate-400" title={r.userId}>
                              {r.userId.slice(0, 14)}
                            </td>
                            <td className="py-3 pr-4 text-slate-400">{fmtTime(r.createdAt)}</td>
                            <td className="py-3 pr-4">
                              {isPending && (
                                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                                  ⏳ Chờ duyệt
                                </span>
                              )}
                              {isFulfilled && (
                                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                                  ✅ Đã giao quà
                                </span>
                              )}
                              {isCancelled && (
                                <span className="rounded-full bg-slate-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
                                  ↩️ Đã hủy &amp; hoàn xu
                                </span>
                              )}
                              {isRejected && (
                                <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-red-300">
                                  ❌ Đã từ chối
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              {isPending ? (
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => act(r.id, 'fulfill')}
                                    disabled={rowBusy === r.id}
                                    className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                                    title="Duyệt gửi quà"
                                  >
                                    {rowBusy === r.id ? '…' : '✅ Giao'}
                                  </button>
                                  <button
                                    onClick={() => act(r.id, 'cancel')}
                                    disabled={rowBusy === r.id}
                                    className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                                    title="Hủy và hoàn trả lại xu cho học sinh"
                                  >
                                    {rowBusy === r.id ? '…' : '↩️ Hủy & Hoàn Xu'}
                                  </button>
                                  <button
                                    onClick={() => act(r.id, 'reject')}
                                    disabled={rowBusy === r.id}
                                    className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-slate-700 disabled:opacity-50"
                                    title="Từ chối phiếu do vi phạm (không hoàn xu)"
                                  >
                                    {rowBusy === r.id ? '…' : '❌'}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-500">Hoàn tất</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })()}

        {/* =========================================================================
            FOOTER THƯƠNG HIỆU & PHÁP LÝ CHUẨN PHÚ GIA (HIẾN PHÁP KỶ LUẬT THÉP)
           ========================================================================= */}
        <footer className="mt-12 rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-xs text-slate-400 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-between gap-4 text-left md:flex-row">
            <div>
              <p className="text-sm font-bold text-slate-200">
                Hộ Kinh Doanh Phú Gia - Nội Thất &amp; Xây Dựng (CÔNG TY CP PHÚ GIA VIỆT NAM / PG HOME LUXURY)
              </p>
              <p className="mt-1 text-slate-400">
                Đại diện: <span className="font-semibold text-slate-300">Nguyễn Trọng Nghĩa</span> | Mã số ĐKKD/MST: <span className="font-semibold text-slate-300">042203002931</span>
              </p>
              <p className="mt-1 text-slate-400">
                Địa chỉ: <span className="font-semibold text-slate-300">Ngõ 49 Trương Quốc Dụng, P. Thành Sen, TP. Hà Tĩnh</span>
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-slate-400">Hotline Vận Hành &amp; Kỹ Thuật:</p>
              <a
                href="tel:0986722324"
                className="mt-1 inline-block font-mono text-sm font-bold text-amber-400 hover:underline"
              >
                0986.722.324
              </a>
              <p className="mt-1 text-[11px] text-slate-500">
                Hệ thống Quản trị &amp; Tự động hóa SAT_NGHIAGURU
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
