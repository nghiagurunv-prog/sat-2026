'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * UNIFIED STUDY HUB SWITCHER (Mục #28):
 * Liên thông 1-chạm giữa các chuyên đề Học tập phân mảnh (/vocab ↔ /vocabulary và /reading ↔ /literature)
 * mà vẫn bảo toàn 100% đường dẫn cũ & tương thích ngược mọi bookmark/test.
 */
export function UnifiedStudyHubTabs({ hub }: { hub: 'vocab' | 'reading' }) {
  const pathname = usePathname();
  const tabs =
    hub === 'vocab'
      ? [
          { href: '/vocab', label: '📖 Sổ Từ Vựng Leitner & Gốc Từ', desc: 'Flashcards SRS 5 hộp + Roots' },
          { href: '/vocabulary', label: '✍️ Words in Context & Từ Nối', desc: 'Luyện câu hỏi SAT + Transitions' },
        ]
      : [
          { href: '/reading', label: '🔍 Đọc Hiểu Chuyên Sâu & Syntax X-Ray', desc: 'Cross-Text & Bóc tách cú pháp 730+' },
          { href: '/literature', label: '📚 Văn Học Cổ, Thơ & Khoa Học', desc: 'Đa thể loại College Board' },
        ];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 p-2 rounded-xl bg-[#111927] border border-[#24344d]">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">
        {hub === 'vocab' ? 'Unified Vocab Hub:' : 'Reading Master Hub:'}
      </span>
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              active
                ? 'bg-amber-500/20 border border-amber-400/60 text-amber-200 shadow-sm'
                : 'bg-[#172234] border border-transparent text-slate-300 hover:border-slate-600 hover:text-white'
            }`}
          >
            <span>{t.label}</span>
            <span className="hidden sm:inline text-[10px] font-normal opacity-75">· {t.desc}</span>
          </Link>
        );
      })}
    </div>
  );
}
