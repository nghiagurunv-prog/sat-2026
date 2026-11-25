import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_VN_UNIVERSITIES, type VnUniversityProfile } from '@/lib/uni-benchmarks';

/**
 * DYNAMIC UNIVERSITY BENCHMARKS & SCHOLARSHIP CONFIG API (W3 #40).
 * GET  → Trả cấu hình điểm chuẩn ĐH VN & học bổng hiện hành (Supabase app_dynamic_config → fallback mặc định).
 * POST → Admin cập nhật động điểm chuẩn từng trường (fail-closed 403 qua verifyAdmin), 0 cần redeploy.
 */

const CONFIG_KEY = 'vn_uni_benchmarks_v1';

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('app_dynamic_config')
      .select('payload, updated_at')
      .eq('key', CONFIG_KEY)
      .maybeSingle();

    if (!error && Array.isArray(data?.payload) && data.payload.length > 0) {
      return NextResponse.json({
        universities: data.payload,
        source: 'database',
        updatedAt: data.updated_at,
      });
    }
  } catch {
    // Fallback êm ái về constant mặc định nếu bảng chưa migrate
  }
  return NextResponse.json({
    universities: DEFAULT_VN_UNIVERSITIES,
    source: 'default',
    updatedAt: null,
  });
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json().catch(() => ({}));
  const universities = body?.universities;
  if (!Array.isArray(universities) || universities.length === 0 || universities.length > 50) {
    return NextResponse.json({ error: 'Danh sách universities phải là mảng 1–50 trường hợp lệ.' }, { status: 400 });
  }

  const sanitized: VnUniversityProfile[] = [];
  for (const item of universities) {
    if (!item || typeof item !== 'object') continue;
    const u = item as Record<string, unknown>;
    const slug = typeof u.slug === 'string' ? u.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) : '';
    const name = typeof u.name === 'string' ? u.name.trim().slice(0, 120) : '';
    const minSat = Math.min(1600, Math.max(400, Number(u.minSat) || 1200));
    const safeSat = Math.min(1600, Math.max(minSat, Number(u.safeSat) || 1380));
    const topMajorSat = Math.min(1600, Math.max(safeSat, Number(u.topMajorSat) || 1460));
    if (!slug || !name) continue;
    sanitized.push({
      slug,
      code: (typeof u.code === 'string' ? u.code.trim().toUpperCase() : slug.toUpperCase()).slice(0, 16),
      name,
      shortName: (typeof u.shortName === 'string' ? u.shortName.trim() : name).slice(0, 60),
      city: (typeof u.city === 'string' ? u.city.trim() : 'Việt Nam').slice(0, 60),
      minSat,
      safeSat,
      topMajorSat,
      conversionScale: Number(u.conversionScale) === 100 ? 100 : 30,
      conversionFormulaVi: String(u.conversionFormulaVi ?? '').slice(0, 300),
      hotMajors: Array.isArray(u.hotMajors) ? u.hotMajors.map((x) => String(x).slice(0, 80)).slice(0, 8) : [],
      scholarshipNote: String(u.scholarshipNote ?? '').slice(0, 400),
      overviewVi: String(u.overviewVi ?? '').slice(0, 600),
      tipsVi: Array.isArray(u.tipsVi) ? u.tipsVi.map((x) => String(x).slice(0, 200)).slice(0, 5) : [],
    });
  }

  if (sanitized.length === 0) {
    return NextResponse.json({ error: 'Không có bản ghi trường đại học hợp lệ.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const updatedAt = new Date().toISOString();
    const { error } = await admin.from('app_dynamic_config').upsert(
      { key: CONFIG_KEY, payload: sanitized, updated_by: 'admin', updated_at: updatedAt },
      { onConflict: 'key' }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, count: sanitized.length, updatedAt });
  } catch (err) {
    console.error('POST /api/admin/benchmarks:', err);
    return NextResponse.json({ error: 'Lỗi lưu cấu hình điểm chuẩn ĐH.' }, { status: 500 });
  }
}
