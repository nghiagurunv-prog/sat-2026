import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import type { VnUniversityProfile } from '@/lib/uni-benchmarks';

export interface UniPredictInput {
  sat: number;
  gpa: number;
  ielts?: number;
}

export interface UniversityAdmissionResult {
  id: string;
  name: string;
  shortName: string;
  category: string;
  method: string;
  programs: string;
  convertedScore?: number;
  maxScale?: number;
  scaleUnit?: string;
  floorRequirement: string;
  safeRequirement: string;
  status: 'SAFE' | 'ELIGIBLE' | 'BELOW_FLOOR';
  badgeColor: string;
  statusMessage: string;
  actionAdvice: string;
  details: Record<string, unknown>;
}

/**
 * Đánh giá chi tiết 7 trường đại học hàng đầu Việt Nam tuyển sinh bằng Digital SAT (2026).
 * Quy tắc: FTU, NEU, HUST, VNU, VinUni, Fulbright, RMIT.
 */
function evaluateVietnameseUniversities(
  sat: number,
  gpa: number,
  ielts: number = 7.5
): UniversityAdmissionResult[] {
  // 1. FTU (Ngoại Thương): Thang 30 = (SAT/1600)*30. Sàn >= 1300 + GPA >= 8.5. An toàn >= 1420
  const ftuScore = Number(((sat / 1600) * 30).toFixed(2));
  const ftuEligible = sat >= 1300 && gpa >= 8.5;
  const ftuSafe = sat >= 1420 && gpa >= 8.8;

  // 2. NEU (Kinh Tế Quốc Dân): Môn SAT quy đổi thang 10 = (SAT/1600)*10. Sàn >= 1200. An toàn >= 1380
  const neuScore = Number(((sat / 1600) * 10).toFixed(2));
  const neuEligible = sat >= 1200;
  const neuSafe = sat >= 1380;

  // 3. HUST (Bách Khoa Hà Nội): Xét tuyển tài năng thang 100 = (SAT/1600)*100. IT1/IT2 an toàn >= 1450. Kỹ thuật an toàn >= 1350
  const hustScore = Number(((sat / 1600) * 100).toFixed(2));
  const hustEligible = sat >= 1300;
  const hustSafeIT = sat >= 1450;
  const hustSafeEng = sat >= 1350;

  // 4. VNU (ĐHQG Hà Nội & TP.HCM: UET, HCMUT, UEB): Sàn >= 1100. CNTT & Kinh tế an toàn >= 1340
  const vnuEligible = sat >= 1100;
  const vnuSafe = sat >= 1340;

  // 5. VinUni: Xét tuyển toàn diện. Sàn >= 1350. Học bổng 50-80% >= 1450. Toàn phần 90-100% >= 1520
  const vinEligible = sat >= 1350;
  const vinScholarship = sat >= 1450;
  const vinFullRide = sat >= 1520;

  // 6. Fulbright University Vietnam: Sàn nhận hồ sơ >= 1350 & GPA >= 8.5. Học bổng/Hỗ trợ tài chính >= 1420 & GPA >= 8.8. Toàn phần >= 1500 & GPA >= 9.0
  const fulbrightEligible = sat >= 1350 && gpa >= 8.5;
  const fulbrightAid = sat >= 1420 && gpa >= 8.8;
  const fulbrightFullRide = sat >= 1500 && gpa >= 9.0;

  // 7. RMIT Việt Nam: Tuyển thẳng Kinh doanh >= 1190, Công nghệ >= 1240. Học bổng Hiệu trưởng >= 1400
  const rmitDirect = sat >= 1240;
  const rmitScholarship = sat >= 1400;

  return [
    {
      id: 'ftu',
      name: 'Trường Đại học Ngoại Thương',
      shortName: 'FTU',
      category: 'Kinh tế & Ngoại thương công lập Top 1',
      method: 'Phương thức 2 - Xét tuyển kết hợp chứng chỉ quốc tế',
      programs: 'Kinh tế đối ngoại, Kinh doanh quốc tế, Tài chính quốc tế, Logistics',
      convertedScore: ftuScore,
      maxScale: 30,
      scaleUnit: 'điểm',
      floorRequirement: 'SAT ≥ 1300 & GPA ≥ 8.5',
      safeRequirement: 'SAT ≥ 1420 & GPA ≥ 8.8',
      status: ftuSafe ? 'SAFE' : ftuEligible ? 'ELIGIBLE' : 'BELOW_FLOOR',
      badgeColor: ftuSafe ? 'emerald' : ftuEligible ? 'amber' : 'rose',
      statusMessage: ftuSafe
        ? '✅ Rất an toàn mọi ngành hot (≥ 1420)'
        : ftuEligible
        ? `⚡ Đủ điều kiện nộp hồ sơ (Cần +${Math.max(0, 1420 - sat)}đ để đạt ngưỡng an toàn)`
        : '⚠️ Chưa đạt ngưỡng sàn SAT ≥ 1300 hoặc GPA ≥ 8.5',
      actionAdvice: ftuSafe
        ? 'Ưu tiên đặt Nguyện vọng 1 ngành Kinh tế đối ngoại / Logistics.'
        : 'Cần củng cố thêm R&W và Math để đạt mốc 1420 an toàn tuyệt đối.',
      details: { convertedScore: ftuScore, eligible: ftuEligible, safe: ftuSafe },
    },
    {
      id: 'neu',
      name: 'Đại học Kinh Tế Quốc Dân',
      shortName: 'NEU',
      category: 'Kinh tế & Quản trị công lập trọng điểm',
      method: 'Phương thức kết hợp chứng chỉ SAT',
      programs: 'Kiểm toán, Phân tích kinh doanh, Marketing số, Tài chính - Ngân hàng',
      convertedScore: neuScore,
      maxScale: 10,
      scaleUnit: 'điểm',
      floorRequirement: 'SAT ≥ 1200',
      safeRequirement: 'SAT ≥ 1380',
      status: neuSafe ? 'SAFE' : neuEligible ? 'ELIGIBLE' : 'BELOW_FLOOR',
      badgeColor: neuSafe ? 'emerald' : neuEligible ? 'amber' : 'rose',
      statusMessage: neuSafe
        ? '✅ Rất an toàn các ngành Top 1 (≥ 1380)'
        : neuEligible
        ? `⚡ Cơ hội tốt ngành chuẩn (Cần +${Math.max(0, 1380 - sat)}đ để an toàn ngành hot)`
        : '⚠️ Chưa đạt điểm sàn nhận hồ sơ SAT 1200',
      actionAdvice: neuSafe
        ? 'Điểm quy đổi SAT đạt mức cao, an toàn trúng tuyển các ngành chất lượng cao.'
        : 'Cần nâng thêm điểm Math để bứt phá lên 1380+.',
      details: { convertedScore: neuScore, eligible: neuEligible, safe: neuSafe },
    },
    {
      id: 'hust',
      name: 'Đại học Bách Khoa Hà Nội',
      shortName: 'HUST',
      category: 'Kỹ thuật & Công nghệ hàng đầu Việt Nam',
      method: 'Phương thức 1 - Xét tuyển tài năng (SAT)',
      programs: 'Khoa học Máy tính (IT1), Kỹ thuật Máy tính (IT2), Vi mạch, Tự động hóa',
      convertedScore: hustScore,
      maxScale: 100,
      scaleUnit: 'điểm tài năng',
      floorRequirement: 'SAT ≥ 1300',
      safeRequirement: 'IT1/IT2 ≥ 1450 | Kỹ thuật khác ≥ 1350',
      status: hustSafeIT || hustSafeEng ? 'SAFE' : hustEligible ? 'ELIGIBLE' : 'BELOW_FLOOR',
      badgeColor: hustSafeIT ? 'emerald' : hustSafeEng ? 'cyan' : hustEligible ? 'amber' : 'rose',
      statusMessage: hustSafeIT
        ? '✅ Cơ hội rất cao trúng IT1 / IT2 (≥ 1450)'
        : hustSafeEng
        ? '⚡ Rất an toàn các ngành Kỹ thuật / Điện tử / Cơ điện tử (≥ 1350)'
        : hustEligible
        ? '⚡ Đủ điều kiện nộp hồ sơ xét tuyển tài năng'
        : '⚠️ Cần nâng SAT ≥ 1300 để nộp hồ sơ',
      actionAdvice: hustSafeIT
        ? 'Tự tin ứng tuyển nhóm ngành Công nghệ thông tin IT1 & IT2.'
        : 'Điểm phù hợp ứng tuyển nhóm ngành Cơ điện tử, Vật liệu tiên tiến hoặc Vi mạch.',
      details: { scoreThang100: hustScore, eligible: hustEligible, safeIT: hustSafeIT, safeEng: hustSafeEng },
    },
    {
      id: 'vnu',
      name: 'Đại học Quốc Gia (Hà Nội & TP.HCM)',
      shortName: 'VNU',
      category: 'Đại học nghiên cứu đa ngành quốc gia',
      method: 'Xét tuyển chứng chỉ chuẩn hóa quốc tế',
      programs: 'Công nghệ thông tin (UET/HCMUT), Kinh tế (UEB), Khoa học Dữ liệu, Trí tuệ Nhân tạo',
      floorRequirement: 'SAT ≥ 1100',
      safeRequirement: 'CNTT & Ngành Hot ≥ 1340',
      status: vnuSafe ? 'SAFE' : vnuEligible ? 'ELIGIBLE' : 'BELOW_FLOOR',
      badgeColor: vnuSafe ? 'emerald' : vnuEligible ? 'amber' : 'rose',
      statusMessage: vnuSafe
        ? '✅ An toàn tuyệt đối mọi phân viện & ngành hot (≥ 1340)'
        : vnuEligible
        ? '⚡ Đủ điều kiện trúng tuyển hầu hết các chương trình đào tạo chuẩn'
        : '⚠️ Chưa đạt ngưỡng sàn tối thiểu 1100',
      actionAdvice: vnuSafe
        ? 'Hồ sơ đạt ngưỡng an toàn cao cho UET và HCMUT.'
        : 'Tập trung luyện thêm chuyên đề yếu để bứt lên 1340+.',
      details: { eligible: vnuEligible, safe: vnuSafe },
    },
    {
      id: 'vinuni',
      name: 'Trường Đại học VinUni',
      shortName: 'VinUni',
      category: 'Đại học tư thục tinh hoa chuẩn quốc tế',
      method: 'Xét tuyển toàn diện chuẩn Ivy League (AACC)',
      programs: 'Khoa học Máy tính, Kỹ thuật Cơ khí, Bác sĩ Y khoa, Quản trị Kinh doanh',
      floorRequirement: 'SAT ≥ 1350',
      safeRequirement: 'Học bổng 50-80% ≥ 1450 | Toàn phần ≥ 1520',
      status: vinFullRide || vinScholarship ? 'SAFE' : vinEligible ? 'ELIGIBLE' : 'BELOW_FLOOR',
      badgeColor: vinFullRide ? 'yellow' : vinScholarship ? 'emerald' : vinEligible ? 'amber' : 'rose',
      statusMessage: vinFullRide
        ? '💎 Ứng viên Học bổng 90% – 100% Toàn phần (≥ 1520)'
        : vinScholarship
        ? '✅ Cơ hội cao nhận Học bổng 50% – 80% học phí (≥ 1450)'
        : vinEligible
        ? '⚡ Đạt chuẩn vào vòng phỏng vấn cá nhân & xét hồ sơ toàn diện'
        : '⚠️ Khuyến nghị nâng SAT ≥ 1350 để đạt chuẩn sơ tuyển',
      actionAdvice: vinFullRide || vinScholarship
        ? 'Chuẩn bị bài luận cá nhân và phỏng vấn với hội đồng tuyển sinh.'
        : 'Điểm SAT đạt điều kiện sơ tuyển, cần hoàn thiện hồ sơ hoạt động ngoại khóa.',
      details: { eligible: vinEligible, scholarship: vinScholarship, fullRide: vinFullRide },
    },
    {
      id: 'fulbright',
      name: 'Đại học Fulbright Việt Nam',
      shortName: 'Fulbright',
      category: 'Đại học Khai phóng độc lập theo chuẩn Hoa Kỳ',
      method: 'Tuyển sinh toàn diện mô hình Giáo dục Khai phóng (Liberal Arts)',
      programs: 'Khoa học Máy tính, Kinh tế học, Tâm lý học, Khoa học Tích hợp, Nghệ thuật & Truyền thông',
      floorRequirement: 'SAT ≥ 1350 & GPA ≥ 8.5',
      safeRequirement: 'Hỗ trợ tài chính/Học bổng ≥ 1420 & GPA ≥ 8.8 | Toàn phần ≥ 1500 & GPA ≥ 9.0',
      status: fulbrightFullRide || fulbrightAid ? 'SAFE' : fulbrightEligible ? 'ELIGIBLE' : 'BELOW_FLOOR',
      badgeColor: fulbrightFullRide ? 'yellow' : fulbrightAid ? 'emerald' : fulbrightEligible ? 'amber' : 'rose',
      statusMessage: fulbrightFullRide
        ? '💎 Ứng viên Học bổng Toàn phần & Hỗ trợ tài chính 100% (SAT ≥ 1500 & GPA ≥ 9.0)'
        : fulbrightAid
        ? '✅ Cơ hội cao nhận Học bổng / Hỗ trợ tài chính theo nhu cầu (SAT ≥ 1420 & GPA ≥ 8.8)'
        : fulbrightEligible
        ? '⚡ Đạt chuẩn sàn nộp hồ sơ & xét tuyển toàn diện (SAT ≥ 1350 & GPA ≥ 8.5)'
        : '⚠️ Chưa đạt sàn xét tuyển SAT ≥ 1350 hoặc GPA THPT ≥ 8.5',
      actionAdvice: fulbrightFullRide || fulbrightAid
        ? 'Điểm số rất mạnh. Hoàn thiện bài luận sáng tạo và chuẩn bị hồ sơ Financial Aid.'
        : 'Đạt ngưỡng sơ khảo. Cần bổ sung bài luận và hoạt động cộng đồng nổi bật.',
      details: { eligible: fulbrightEligible, aid: fulbrightAid, fullRide: fulbrightFullRide },
    },
    {
      id: 'rmit',
      name: 'RMIT University Vietnam',
      shortName: 'RMIT',
      category: 'Đại học quốc tế Úc tại Việt Nam',
      method: 'Tuyển thẳng & Học bổng quốc tế Úc',
      programs: 'Kinh doanh quốc tế, Truyền thông số, CNTT & Kỹ thuật Phần mềm',
      floorRequirement: 'SAT ≥ 1190 (Kinh doanh) | SAT ≥ 1240 (CNTT)',
      safeRequirement: 'Tuyển thẳng ≥ 1240 | Học bổng Hiệu trưởng ≥ 1400',
      status: rmitScholarship ? 'SAFE' : rmitDirect ? 'ELIGIBLE' : 'BELOW_FLOOR',
      badgeColor: rmitScholarship ? 'emerald' : rmitDirect ? 'blue' : 'slate',
      statusMessage: rmitScholarship
        ? '✅ Đủ tiêu chuẩn ứng tuyển Học bổng Hiệu trưởng 50% – 100% (≥ 1400)'
        : rmitDirect
        ? '⚡ Tuyển thẳng 100% tất cả các chương trình đào tạo (≥ 1240)'
        : '⚠️ Cần nâng SAT ≥ 1190 để đủ điều kiện tuyển thẳng',
      actionAdvice: rmitScholarship
        ? 'Ứng tuyển học bổng Hiệu trưởng danh giá dành cho học sinh xuất sắc.'
        : 'Tuyển thẳng hoàn toàn không cần thi đầu vào môn chuyên ngành.',
      details: { direct: rmitDirect, scholarship: rmitScholarship },
    },
  ];
}

/**
 * Xử lý chung cho cả GET và POST để dự đoán cơ hội trúng tuyển ĐH Việt Nam.
 */
async function handlePrediction(req: Request, rawSat: unknown, rawGpa: unknown, rawIelts: unknown) {
  // Xác thực người dùng (an toàn cho cả Khách và Đã đăng nhập)
  const user = await getCurrentUser().catch(() => ({ id: 'local-default-user', isAuthenticated: false }));

  // Rate limit
  const rateLimitKey = getRateLimitKey(req, 'uni-predict', user.isAuthenticated ? user.id : null);
  const rl = rateLimit(rateLimitKey, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau giây lát.', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  // Sanitize numeric inputs bằng Number.isFinite
  const numSat = typeof rawSat === 'number' ? rawSat : parseFloat(String(rawSat ?? '1420'));
  const numGpa = typeof rawGpa === 'number' ? rawGpa : parseFloat(String(rawGpa ?? '8.8'));
  const numIelts = typeof rawIelts === 'number' ? rawIelts : parseFloat(String(rawIelts ?? '7.5'));

  const sat = Number.isFinite(numSat) ? Math.min(1600, Math.max(400, Math.round(numSat))) : 1420;
  const gpa = Number.isFinite(numGpa) ? Math.min(10.0, Math.max(0.0, Number(numGpa.toFixed(2)))) : 8.8;
  const ielts = Number.isFinite(numIelts) ? Math.min(9.0, Math.max(0.0, Number(numIelts.toFixed(1)))) : 7.5;

  let universities = evaluateVietnameseUniversities(sat, gpa, ielts);

  // W3 #40: Nếu Admin đã cấu hình động điểm chuẩn trên Supabase `app_dynamic_config`, áp dụng ngưỡng mới realtime
  let benchmarkSource: 'default' | 'supabase_dynamic' = 'default';
  try {
    const sb = createAdminClient();
    if (sb) {
      const { data } = await sb
        .from('app_dynamic_config')
        .select('value')
        .eq('key', 'vn_uni_benchmarks_2026')
        .maybeSingle();
      if (data && Array.isArray(data.value) && data.value.length > 0) {
        const dynamicMap = new Map<string, VnUniversityProfile>();
        for (const item of data.value as VnUniversityProfile[]) {
          if (item && typeof item.slug === 'string') {
            dynamicMap.set(item.slug.toLowerCase(), item);
          }
        }
        if (dynamicMap.size > 0) {
          benchmarkSource = 'supabase_dynamic';
          universities = universities.map((u) => {
            const ov = dynamicMap.get(u.id.toLowerCase());
            if (!ov) return u;
            const minSat = Number(ov.minSat) || 1200;
            const safeSat = Number(ov.safeSat) || 1400;
            const minGpa = Number(ov.minGpa) || 8.0;
            const isSafe = sat >= safeSat && gpa >= minGpa;
            const isEligible = sat >= minSat && gpa >= minGpa;
            return {
              ...u,
              floorRequirement: `SAT ≥ ${minSat}${minGpa > 0 ? ` & GPA ≥ ${minGpa}` : ''}`,
              safeRequirement: `SAT ≥ ${safeSat}`,
              status: isSafe ? 'SAFE' : isEligible ? 'ELIGIBLE' : 'BELOW_FLOOR',
              badgeColor: isSafe ? 'emerald' : isEligible ? 'amber' : 'rose',
              statusMessage: isSafe
                ? `✅ Rất an toàn theo ngưỡng chuẩn mới nhất (≥ ${safeSat})`
                : isEligible
                ? `⚡ Đủ điều kiện nộp hồ sơ (Cần +${Math.max(0, safeSat - sat)}đ để đạt mốc an toàn ${safeSat})`
                : `⚠️ Chưa đạt ngưỡng sàn cập nhật SAT ≥ ${minSat}`,
            };
          });
        }
      }
    }
  } catch {
    // Fallback an toàn về bảng chuẩn mặc định khi chưa có bảng/DB
  }

  const safeCount = universities.filter((u) => u.status === 'SAFE').length;
  const eligibleCount = universities.filter((u) => u.status === 'ELIGIBLE' || u.status === 'SAFE').length;

  return NextResponse.json({
    success: true,
    input: { sat, gpa, ielts },
    user: {
      id: user.id,
      isAuthenticated: user.isAuthenticated,
    },
    universities,
    summary: {
      totalEvaluated: universities.length,
      safeCount,
      eligibleCount,
      belowFloorCount: universities.length - eligibleCount,
      benchmarkYear: 2026,
      benchmarkSource,
    },
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawSat = url.searchParams.get('sat');
    const rawGpa = url.searchParams.get('gpa');
    const rawIelts = url.searchParams.get('ielts');

    return await handlePrediction(req, rawSat, rawGpa, rawIelts);
  } catch (error) {
    console.error('Lỗi API uni-predict GET:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi máy chủ khi dự đoán tuyển sinh' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawSat = body?.sat ?? body?.satScore;
    const rawGpa = body?.gpa;
    const rawIelts = body?.ielts;

    return await handlePrediction(req, rawSat, rawGpa, rawIelts);
  } catch (error) {
    console.error('Lỗi API uni-predict POST:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi máy chủ khi dự đoán tuyển sinh' }, { status: 500 });
  }
}
