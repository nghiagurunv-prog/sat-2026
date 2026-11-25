import type { Metadata } from 'next';
import Link from 'next/link';
import { DEFAULT_VN_UNIVERSITIES } from '@/lib/uni-benchmarks';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Điểm Chuẩn SAT & Quy Đổi Xét Tuyển 7 Đại Học Top Đầu Việt Nam 2026 | SAT.Guru',
  description:
    'Tra cứu điểm chuẩn SAT 2026 và công thức quy đổi xét tuyển thẳng vào FTU, NEU, HUST, VNU, VinUni, Fulbright và RMIT Việt Nam.',
};

export default function UniPredictHubPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8 text-slate-100">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/30 p-8 space-y-3">
        <span className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300">
          🎓 Hub Tuyển Sinh Digital SAT Việt Nam 2026
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-white">
          Quy Đổi Điểm SAT &amp; Điểm Chuẩn 7 Đại Học Top Đầu Việt Nam
        </h1>
        <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
          Chọn trường mục tiêu để tra cứu công thức quy đổi SAT mới nhất, mức điểm an toàn cho các ngành hot và thử thanh trượt dự đoán xác suất trúng tuyển.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {DEFAULT_VN_UNIVERSITIES.map((uni) => (
          <Link
            key={uni.slug}
            href={`/uni-predict/${uni.slug}`}
            className="rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-400/50 p-5 space-y-3 transition shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {uni.code}
                </span>
                <span className="text-[11px] text-slate-400">{uni.city}</span>
              </div>
              <h2 className="text-lg font-extrabold text-white">{uni.name}</h2>
              <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{uni.overviewVi}</p>
            </div>
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span>
                Sàn: <strong className="text-amber-300">{uni.minSat}</strong> • An toàn:{' '}
                <strong className="text-emerald-400">{uni.safeSat}+</strong>
              </span>
              <span className="text-sky-400 font-bold">Xem chi tiết →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
