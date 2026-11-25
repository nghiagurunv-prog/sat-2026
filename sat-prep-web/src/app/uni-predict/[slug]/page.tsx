import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DEFAULT_VN_UNIVERSITIES, getVnUniversityBySlug } from '@/lib/uni-benchmarks';
import { OFFICIAL_SITE_URL } from '@/lib/subscription';
import { UniAdmissionSlider } from '@/components/UniAdmissionSlider';

export const revalidate = 3600;

export function generateStaticParams() {
  return DEFAULT_VN_UNIVERSITIES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const uni = getVnUniversityBySlug(slug);
  if (!uni) {
    return { title: 'Không tìm thấy trường đại học | SAT.Guru' };
  }
  return {
    title: `Điểm Chuẩn SAT ${uni.shortName} 2026 & Công Thức Quy Đổi | SAT.Guru`,
    description: `${uni.overviewVi} Ngưỡng sàn ${uni.minSat}+, an toàn ${uni.safeSat}+, ngành Top ${uni.topMajorSat}+.`,
    alternates: { canonical: `${OFFICIAL_SITE_URL}/uni-predict/${uni.slug}` },
  };
}

export default async function UniPredictDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const uni = getVnUniversityBySlug(slug);
  if (!uni) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOccupationalProgram',
    name: `Xét tuyển chứng chỉ Digital SAT vào ${uni.name} 2026`,
    provider: { '@type': 'Organization', name: 'SAT.Guru — Thầy Nghĩa Guru', url: OFFICIAL_SITE_URL },
    description: uni.overviewVi,
    educationalProgramMode: 'Online',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8 text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/" className="hover:text-white">Trang chủ</Link>
        <span>/</span>
        <Link href="/uni-predict" className="hover:text-white">Điểm chuẩn SAT Đại học VN</Link>
        <span>/</span>
        <span className="text-amber-300 font-bold">{uni.code}</span>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/30 p-7 sm:p-9 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400/15 text-amber-300 border border-amber-400/30">
            🎓 Tuyển Sinh 2026 • {uni.city}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            An toàn: {uni.safeSat}+ SAT
          </span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight">
          Điểm Chuẩn SAT {uni.name} 2026 &amp; Cách Quy Đổi Xét Tuyển
        </h1>
        <p className="text-sm text-slate-300 leading-relaxed">{uni.overviewVi}</p>
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs text-indigo-200">
          <strong className="text-amber-300">📐 Công thức tham khảo:</strong> {uni.conversionFormulaVi}
        </div>
      </div>

      <UniAdmissionSlider uni={uni} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-3">
          <h2 className="text-base font-black text-white">🔥 Nhóm Ngành Hot Xét Tuyển SAT</h2>
          <ul className="space-y-2 text-xs text-slate-300">
            {uni.hotMajors.map((m) => (
              <li key={m} className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
          <div className="pt-3 border-t border-slate-800 text-xs text-amber-200">
            <strong>💎 Học bổng &amp; Ưu đãi:</strong> {uni.scholarshipNote}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-3">
          <h2 className="text-base font-black text-white">🎯 Chiến Lược Chinh Phục {uni.code} Cùng SAT.Guru</h2>
          <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
            {uni.tipsVi.map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-400 font-black">{i + 1}.</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase">So sánh nhanh các trường Đại học khác:</div>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_VN_UNIVERSITIES.filter((u) => u.slug !== uni.slug).map((other) => (
            <Link
              key={other.slug}
              href={`/uni-predict/${other.slug}`}
              className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 transition"
            >
              {other.shortName} ({other.safeSat}+)
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
