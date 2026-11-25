/**
 * ============================================================================
 *  ĐIỂM CHUẨN SAT & QUY ĐỔI ĐẠI HỌC VIỆT NAM 2026 (W2 #29 & W3 #40)
 * ============================================================================
 *  Nguồn dữ liệu mặc định cho Hub SEO SSG/ISR (/uni-predict/[slug]),
 *  /api/uni-predict và /api/admin/config (cho phép Admin cập nhật động qua DB).
 */

export interface VnUniversityProfile {
  slug: string;
  code: string;
  name: string;
  shortName: string;
  city: string;
  minSat: number;
  safeSat: number;
  topMajorSat: number;
  minGpa?: number;
  conversionScale: number; // VD: 30 hoặc 100
  conversionFormulaVi: string;
  hotMajors: string[];
  scholarshipNote: string;
  overviewVi: string;
  tipsVi: string[];
}

export const DEFAULT_VN_UNIVERSITIES: readonly VnUniversityProfile[] = [
  {
    slug: 'ftu',
    code: 'FTU',
    name: 'Đại học Ngoại thương (FTU)',
    shortName: 'Ngoại thương FTU',
    city: 'Hà Nội & TP.HCM',
    minSat: 1260,
    safeSat: 1400,
    topMajorSat: 1480,
    conversionScale: 30,
    conversionFormulaVi: 'Điểm quy đổi thang 30 ≈ (SAT / 1600) × 30 kết hợp chứng chỉ Tiếng Anh IELTS >= 6.5',
    hotMajors: ['Kinh tế đối ngoại', 'Kinh doanh quốc tế', 'Tài chính quốc tế', 'Logistics & Chuỗi cung ứng', 'Khoa học máy tính & Dữ liệu'],
    scholarshipNote: 'Học bổng khuyến khích học tập 100% học phí kỳ đầu cho tân sinh viên thủ khoa phương thức kết hợp SAT.',
    overviewVi: 'ĐH Ngoại thương (FTU) là điểm đến hàng đầu của học sinh trường chuyên xét tuyển chứng chỉ SAT. Mức điểm từ 1400+ mở rộng cơ hội vào hầu hết chương trình Chất lượng cao & Tiên tiến; 1480+ tạo lợi thế áp đảo ngành Kinh tế đối ngoại.',
    tipsVi: [
      'Ưu tiên tối đa hóa điểm Math >= 760 bằng chiến thuật Desmos để bù biên độ Reading.',
      'Chốt chứng chỉ SAT sớm vào đợt Tháng 3 hoặc Tháng 5 lớp 11/12 để kịp nộp hồ sơ xét tuyển sớm.',
    ],
  },
  {
    slug: 'neu',
    code: 'NEU',
    name: 'Đại học Kinh tế Quốc dân (NEU)',
    shortName: 'Kinh tế Quốc dân NEU',
    city: 'Hà Nội',
    minSat: 1200,
    safeSat: 1360,
    topMajorSat: 1450,
    conversionScale: 30,
    conversionFormulaVi: 'Điểm quy đổi thang 30 = (SAT / 1600) × 30 (chấp nhận từ 1200/1600 trở lên)',
    hotMajors: ['Logistics & Quản lý chuỗi cung ứng', 'Marketing', 'Phân tích kinh doanh (BA)', 'Tài chính doanh nghiệp', 'Kiểm toán tích hợp ICAEW'],
    scholarshipNote: 'Ưu tiên tuyển thẳng diện kết hợp chứng chỉ quốc tế, miễn áp lực điểm thi tốt nghiệp THPT cho nhóm ngành hot.',
    overviewVi: 'ĐH Kinh tế Quốc dân (NEU) dành chỉ tiêu lớn cho thí sinh có chứng chỉ SAT từ 1200+. Các ngành siêu hot như Logistics, Marketing, Kiểm toán và Tài chính thường có mức an toàn từ 1380–1450+.',
    tipsVi: [
      'Tập trung tuyệt đối nhóm kỹ năng Boundaries & Transitions (chiếm ~28% R&W) để kéo tổng điểm vượt 1400.',
      'Luyện ít nhất 4 đề Full Adaptive chuẩn Bluebook để làm quen áp lực Module 2 Hard.',
    ],
  },
  {
    slug: 'hust',
    code: 'HUST',
    name: 'Đại học Bách khoa Hà Nội (HUST)',
    shortName: 'Bách khoa Hà Nội HUST',
    city: 'Hà Nội',
    minSat: 1250,
    safeSat: 1420,
    topMajorSat: 1500,
    conversionScale: 100,
    conversionFormulaVi: 'Xét tuyển tài năng diện 1.2: Quy đổi SAT thang 100 = (SAT / 1600) × 100 (IT1/IT2 ưu tiên Math >= 750)',
    hotMajors: ['Khoa học Máy tính (IT1)', 'Kỹ thuật Máy tính (IT2)', 'Khoa học dữ liệu & AI (IT-E10)', 'Kỹ thuật Vi mạch bán dẫn', 'Điều khiển & Tự động hóa'],
    scholarshipNote: 'Học bổng tài năng Trần Đại Nghĩa và các suất học bổng doanh nghiệp công nghệ dành cho sinh viên đạt SAT 1450+.',
    overviewVi: 'ĐH Bách khoa Hà Nội (HUST) sử dụng chứng chỉ SAT trong phương thức Xét tuyển tài năng (XTTN). Với khối ngành CNTT (IT1, IT2, AI) và Vi mạch bán dẫn, ngưỡng cạnh tranh thực tế nằm ở 1440–1500+ với điểm Toán sát 780–800.',
    tipsVi: [
      'Mục tiêu Math 780–800/800 là bắt buộc để dẫn đầu hồ sơ XTTN IT1/IT2.',
      'Luyện kỹ dạng tự điền số SPR (Grid-in) và hệ phương trình tham số trên Desmos.',
    ],
  },
  {
    slug: 'vnu',
    code: 'VNU',
    name: 'Đại học Quốc gia Hà Nội & TP.HCM (VNU)',
    shortName: 'ĐH Quốc gia VNU',
    city: 'Hà Nội & TP.HCM',
    minSat: 1100,
    safeSat: 1340,
    topMajorSat: 1430,
    conversionScale: 30,
    conversionFormulaVi: 'Ngưỡng nhận hồ sơ từ 1100–1200+ tùy trường thành viên (UET, UEB, ULIS, HCMUT, UIT)',
    hotMajors: ['Công nghệ thông tin (UET / UIT)', 'Kinh tế quốc tế (UEB)', 'Khoa học dữ liệu', 'Ngôn ngữ Anh (ULIS)', 'Kỹ thuật phần mềm'],
    scholarshipNote: 'Học bổng ươm tạo nhà khoa học trẻ và miễn giảm học phí tại các trường thành viên cho tân sinh viên SAT 1400+.',
    overviewVi: 'Hệ thống ĐH Quốc gia Hà Nội (UET, UEB, ULIS, VNU-IS) và ĐHQG TP.HCM (Bách khoa HCMUT, ĐH CNTT UIT, ĐH Kinh tế - Luật) đều công nhận SAT trong phương thức xét tuyển kết hợp với ngưỡng an toàn 1340–1430+.',
    tipsVi: [
      'Kết hợp SAT 1380+ cùng học bạ THPT >= 8.5 giúp đảm bảo chắc suất vào UET/UEB.',
      'Ôn chắc Words in Context để tránh mất điểm oan ở 8 câu từ vựng mỗi đề.',
    ],
  },
  {
    slug: 'vinuni',
    code: 'VINUNI',
    name: 'Đại học VinUni',
    shortName: 'VinUni',
    city: 'Hà Nội',
    minSat: 1350,
    safeSat: 1460,
    topMajorSat: 1530,
    conversionScale: 100,
    conversionFormulaVi: 'Đánh giá toàn diện (Holistic Review): SAT là trụ cột chứng minh năng lực học thuật (Academic Excellence) để xét học bổng 50%–100%',
    hotMajors: ['Khoa học Máy tính (CECS)', 'Quản trị Kinh doanh (CBM)', 'Bác sĩ Y khoa (CHS)', 'Kỹ thuật Cơ khí & Robotics', 'Kinh tế học'],
    scholarshipNote: 'Học bổng Tài năng 50%–100% học phí (~400 triệu – 3.2 tỷ VNĐ/khóa) cho hồ sơ có SAT 1480–1550+ nổi bật.',
    overviewVi: 'VinUni áp dụng chuẩn tuyển sinh theo mô hình Ivy League (hợp tác cùng Cornell & UPenn). Điểm SAT 1460–1530+ là đòn bẩy quan trọng nhất để nâng bậc Học bổng Tài năng lên 70%–100%.',
    tipsVi: [
      'Nên đạt tối thiểu 1480+ (cân bằng cả RW >= 700 và Math >= 780) để tranh suất học bổng cao.',
      'Hoàn tất SAT trước đợt Early Admission để tối ưu quỹ học bổng.',
    ],
  },
  {
    slug: 'fulbright',
    code: 'FULBRIGHT',
    name: 'Đại học Fulbright Việt Nam',
    shortName: 'Fulbright VN',
    city: 'TP. Hồ Chí Minh',
    minSat: 1320,
    safeSat: 1430,
    topMajorSat: 1500,
    conversionScale: 100,
    conversionFormulaVi: 'Tuyển sinh toàn diện chuẩn Giáo dục Khai phóng Hoa Kỳ; SAT giúp củng cố hồ sơ học thuật & gói Hỗ trợ tài chính',
    hotMajors: ['Khoa học Máy tính', 'Kinh tế học', 'Toán ứng dụng', 'Nghiên cứu Xã hội & Truyền thông', 'Tâm lý học'],
    scholarshipNote: 'Hỗ trợ tài chính dựa trên nhu cầu (Need-based Financial Aid) và Học bổng Tài năng lên tới 100% học phí.',
    overviewVi: 'Đại học Fulbright Việt Nam đề cao tư duy phản biện, đọc hiểu học thuật sâu và năng lực phân tích định lượng. Điểm SAT Reading & Writing cao (>= 700) là điểm cộng cực lớn khi nộp hồ sơ.',
    tipsVi: [
      'Đầu tư sâu vào dạng bài Command of Evidence & Cross-Text Connections trong phần Đọc Hiểu.',
      'Dùng Gia sư AI Socratic luyện phản xạ giải thích lập luận thay vì học mẹo máy móc.',
    ],
  },
  {
    slug: 'rmit',
    code: 'RMIT',
    name: 'Đại học RMIT Việt Nam',
    shortName: 'RMIT Việt Nam',
    city: 'TP. Hồ Chí Minh & Hà Nội',
    minSat: 1250,
    safeSat: 1380,
    topMajorSat: 1480,
    conversionScale: 100,
    conversionFormulaVi: 'Điểm SAT 1380–1500+ tạo lợi thế lớn khi cạnh tranh Học bổng Thành tích Học tập (Academic Achievement) & Học bổng Toàn phần',
    hotMajors: ['Kinh doanh Quốc tế', 'Digital Marketing', 'Kỹ thuật Phần mềm', 'Tài chính', 'Truyền thông Chuyên nghiệp'],
    scholarshipNote: 'Học bổng 25%, 50% đến 100% học phí (giá trị 300 triệu – hơn 1 tỷ VNĐ) cho ứng viên có thành tích quốc tế xuất sắc.',
    overviewVi: 'RMIT Việt Nam là môi trường quốc tế chuẩn Úc với mức học phí cao; một bảng điểm SAT 1450+ kết hợp IELTS 7.5+ giúp gia đình tiết kiệm từ hàng trăm triệu tới hơn 1 tỷ đồng tiền học bổng.',
    tipsVi: [
      'Đặt mục tiêu 1450+ để nộp nhóm Học bổng Thành tích cao nhất.',
      'Ôn luyện đều 25–30 câu/ngày để ổn định phong độ trước hạn nộp học bổng thường niên.',
    ],
  },
];

export function getVnUniversityBySlug(slug: string): VnUniversityProfile | undefined {
  const clean = (slug || '').trim().toLowerCase();
  return DEFAULT_VN_UNIVERSITIES.find((u) => u.slug === clean || u.code.toLowerCase() === clean);
}

/** Tính điểm quy đổi tương tác thang 30 / thang 100 + xếp loại xác suất trúng tuyển. */
export function evaluateUniAdmission(uni: VnUniversityProfile, satScore: number) {
  const clamped = Math.min(1600, Math.max(400, Math.round(satScore / 10) * 10));
  const converted = Number(((clamped / 1600) * uni.conversionScale).toFixed(2));
  let verdict: 'strong' | 'safe' | 'borderline' | 'below' = 'below';
  let verdictVi = 'Cần tăng thêm điểm để chạm ngưỡng nhận hồ sơ';
  if (clamped >= uni.topMajorSat) {
    verdict = 'strong';
    verdictVi = 'Vượt trội — Sẵn sàng ngành Top 1 & săn Học bổng cao nhất';
  } else if (clamped >= uni.safeSat) {
    verdict = 'safe';
    verdictVi = 'An toàn cao — Cạnh tranh tốt vào nhóm ngành trọng điểm';
  } else if (clamped >= uni.minSat) {
    verdict = 'borderline';
    verdictVi = 'Đạt ngưỡng nộp hồ sơ — Nên nâng thêm để vào ngành hot';
  }
  return {
    satScore: clamped,
    converted,
    scale: uni.conversionScale,
    gapToSafe: Math.max(0, uni.safeSat - clamped),
    gapToTop: Math.max(0, uni.topMajorSat - clamped),
    verdict,
    verdictVi,
  };
}

export interface UniBenchmarkConfig extends VnUniversityProfile {
  eliteSat: number;
  scaleLabel: string;
}

export function evaluateUniChance(uni: UniBenchmarkConfig, satScore: number) {
  const clamped = Math.min(1600, Math.max(400, Math.round(satScore / 10) * 10));
  const scale30 = Number(((clamped / 1600) * 30).toFixed(2));
  const scale100 = Number(((clamped / 1600) * 100).toFixed(1));
  const eliteSat = uni.eliteSat ?? uni.topMajorSat;
  let status: 'elite' | 'safe' | 'borderline' | 'below' = 'below';
  let chancePct = 20;
  let badge = '⚠️ Cần tăng thêm điểm để đạt ngưỡng nhận hồ sơ';

  if (clamped >= eliteSat) {
    status = 'elite';
    chancePct = Math.min(99, 90 + Math.round(((clamped - eliteSat) / Math.max(1, 1600 - eliteSat)) * 9));
    badge = '🏆 Vượt trội — Sẵn sàng ngành Top 1 & Học bổng cao nhất';
  } else if (clamped >= uni.safeSat) {
    status = 'safe';
    chancePct = 75 + Math.round(((clamped - uni.safeSat) / Math.max(1, eliteSat - uni.safeSat)) * 15);
    badge = '✅ An toàn cao — Tự tin nộp nhóm ngành trọng điểm';
  } else if (clamped >= uni.minSat) {
    status = 'borderline';
    chancePct = 45 + Math.round(((clamped - uni.minSat) / Math.max(1, uni.safeSat - uni.minSat)) * 28);
    badge = `⚡ Đạt ngưỡng sàn — Cần +${uni.safeSat - clamped} điểm để vào vùng an toàn`;
  } else {
    chancePct = Math.max(8, Math.round((clamped / Math.max(1, uni.minSat)) * 40));
    badge = `📈 Cần +${uni.minSat - clamped} điểm để chạm ngưỡng nhận hồ sơ`;
  }

  return { satScore: clamped, scale30, scale100, status, chancePct, badge };
}
