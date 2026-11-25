import { NextRequest } from 'next/server';

/**
 * DIAGNOSTIC RESULT OG SHARE CARD (W2 #20 — Thẻ ảnh chia sẻ Zalo/Facebook).
 * Trả SVG chuẩn 1200×630 sắc nét (hỗ trợ cả tải về & preview OpenGraph trực tiếp,
 * 0 phụ thuộc font ngoài, an toàn tuyệt đối chống XSS nhờ XML escaping).
 */

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clampScore(raw: string | null, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const total = clampScore(sp.get('total'), 400, 1600, 1420);
  const math = clampScore(sp.get('math'), 200, 800, Math.round(total / 2));
  const rw = clampScore(sp.get('rw'), 200, 800, Math.max(200, total - math));
  const target = clampScore(sp.get('target'), 400, 1600, 1500);
  const studentName = escapeXml((sp.get('name') || 'Chiến Binh SAT.Guru').trim().slice(0, 36));
  const weakRaw = (sp.get('weak') || 'Linear Equations|Boundaries|Words in Context')
    .split('|')
    .map((s) => escapeXml(s.trim().slice(0, 32)))
    .filter(Boolean)
    .slice(0, 3);

  const tierLabel =
    total >= 1500
      ? 'TOP 1% TOÀN CẦU • IVY LEAGUE READY'
      : total >= 1400
      ? 'XUẤT SẮC • TUYỂN THẲNG FTU / HUST / NEU'
      : total >= 1300
      ? 'TIỀM NĂNG CAO • SẴN SÀNG BỨT PHÁ 1450+'
      : 'ĐÃ XÁC ĐỊNH LỘ TRÌNH TĂNG +200 ĐIỂM';

  const weakChips = weakRaw
    .map(
      (label, i) => `
      <g transform="translate(${70 + i * 355}, 468)">
        <rect width="335" height="54" rx="14" fill="#1e293b" stroke="#f59e0b" stroke-opacity="0.45" stroke-width="1.5"/>
        <text x="18" y="33" fill="#fde68a" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">#${i + 1} ${label}</text>
      </g>`
    )
    .join('');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0b1120"/>
      <stop offset="55%" stop-color="#111c36"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1060" cy="110" r="190" fill="#f59e0b" fill-opacity="0.09"/>
  <circle cx="140" cy="560" r="220" fill="#3b82f6" fill-opacity="0.09"/>
  <rect x="34" y="34" width="1132" height="562" rx="28" fill="#0f172a" fill-opacity="0.72" stroke="#334155" stroke-width="2"/>

  <rect x="70" y="68" width="285" height="38" rx="19" fill="#f59e0b" fill-opacity="0.16" stroke="#f59e0b" stroke-opacity="0.5"/>
  <text x="92" y="93" fill="#fcd34d" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="800">SAT.GURU • DIGITAL SAT AI</text>
  <text x="1130" y="93" text-anchor="end" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="600">satguru.edu.vn</text>

  <text x="70" y="156" fill="#e2e8f0" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700">KẾT QUẢ TEST XẾP LỚP DIGITAL SAT — ${studentName}</text>
  <text x="70" y="192" fill="#34d399" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="800">${escapeXml(tierLabel)}</text>

  <rect x="70" y="220" width="440" height="170" rx="24" fill="#131e36" stroke="#f59e0b" stroke-width="2.5"/>
  <text x="104" y="264" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">ĐIỂM DỰ ĐOÁN HIỆN TẠI</text>
  <text x="104" y="346" fill="url(#gold)" font-family="Segoe UI, Arial, sans-serif" font-size="84" font-weight="900">${total}</text>
  <text x="315" y="346" fill="#64748b" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700">/ 1600</text>
  <text x="104" y="376" fill="#cbd5e1" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600">Mục tiêu cá nhân: ${target}+ SAT</text>

  <rect x="538" y="220" width="280" height="170" rx="24" fill="#131e36" stroke="#3b82f6" stroke-opacity="0.6" stroke-width="2"/>
  <text x="568" y="268" fill="#93c5fd" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">📐 MATH (TOÁN)</text>
  <text x="568" y="342" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="68" font-weight="900">${math}</text>
  <text x="712" y="342" fill="#64748b" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700">/800</text>

  <rect x="846" y="220" width="284" height="170" rx="24" fill="#131e36" stroke="#a855f7" stroke-opacity="0.6" stroke-width="2"/>
  <text x="876" y="268" fill="#d8b4fe" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">📖 READING &amp; WRITING</text>
  <text x="876" y="342" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="68" font-weight="900">${rw}</text>
  <text x="1020" y="342" fill="#64748b" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700">/800</text>

  <text x="70" y="446" fill="#cbd5e1" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800">🎯 TOP 3 KỸ NĂNG CẦN TẬP TRUNG ĐỂ BỨT PHÁ:</text>
  ${weakChips}

  <text x="70" y="564" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600">Luyện đề chuẩn Bluebook Adaptive • Máy tính Desmos • Gia sư AI Socratic • Hotline 0986.722.324</text>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
