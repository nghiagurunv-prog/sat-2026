'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * CHIA SẺ TIẾN ĐỘ VỚI PHỤ HUYNH (student) — sinh/thu hồi mã, copy link, mã QR trực quan.
 * Phụ huynh mở link /parent?code=XXX xem read-only, không cần tài khoản.
 * Point 80: Mã QR SVG Trực quan cho phụ huynh quét bằng Zalo / Camera điện thoại.
 */

interface ShareCode {
  code: string;
  revoked: boolean;
  expires_at: string | null;
}

/**
 * Fallback copy clipboard an toàn cho trình duyệt không hỗ trợ Clipboard API hoặc trong iframe/HTTP.
 */
async function copyToClipboardSafe(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback phía dưới
    }
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

// Point 80: Visual SVG QR Code Component với logo SAT trung tâm và fallback dự phòng
function ParentQRCodeSVG({ url, code }: { url: string; code: string }) {
  const [imgError, setImgError] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=svg&data=${encodedUrl}&margin=10`;

  return (
    <div className="flex flex-col items-center">
      <div className="relative p-3 bg-white rounded-2xl shadow-xl border-4 border-amber-400/40 w-[200px] h-[200px] flex items-center justify-center">
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrSvgUrl}
            alt={`Mã QR truy cập báo cáo phụ huynh mã ${code}`}
            width={180}
            height={180}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain select-none"
          />
        ) : (
          // Fallback SVG trực quan phong cách QR Code nếu không có kết nối internet ngoại mạng
          <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" fill="white" />
            {/* Top-Left Finder */}
            <rect x="8" y="8" width="28" height="28" rx="4" fill="#0f172a" />
            <rect x="13" y="13" width="18" height="18" rx="2" fill="white" />
            <rect x="17" y="17" width="10" height="10" rx="1" fill="#f59e0b" />
            {/* Top-Right Finder */}
            <rect x="64" y="8" width="28" height="28" rx="4" fill="#0f172a" />
            <rect x="69" y="13" width="18" height="18" rx="2" fill="white" />
            <rect x="73" y="17" width="10" height="10" rx="1" fill="#f59e0b" />
            {/* Bottom-Left Finder */}
            <rect x="8" y="64" width="28" height="28" rx="4" fill="#0f172a" />
            <rect x="13" y="69" width="18" height="18" rx="2" fill="white" />
            <rect x="17" y="73" width="10" height="10" rx="1" fill="#f59e0b" />
            {/* Pattern Dots */}
            <circle cx="45" cy="18" r="3" fill="#0f172a" />
            <circle cx="55" cy="18" r="3" fill="#0f172a" />
            <circle cx="18" cy="45" r="3" fill="#0f172a" />
            <circle cx="18" cy="55" r="3" fill="#0f172a" />
            <circle cx="45" cy="45" r="4" fill="#f59e0b" />
            <circle cx="55" cy="55" r="4" fill="#f59e0b" />
            <circle cx="82" cy="45" r="3" fill="#0f172a" />
            <circle cx="82" cy="55" r="3" fill="#0f172a" />
            <circle cx="45" cy="82" r="3" fill="#0f172a" />
            <circle cx="55" cy="82" r="3" fill="#0f172a" />
            <circle cx="72" cy="72" r="5" fill="#f59e0b" />
            <text x="50" y="96" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#64748b">QUÉT ZALO ĐỂ XEM</text>
          </svg>
        )}
        {/* Logo SAT tâm điểm */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center shadow-md">
          <span className="text-[10px] font-black text-slate-900 tracking-tighter">SAT</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-amber-300/90 tracking-wide flex items-center gap-1">
        <span>📸</span> Mở Zalo quét mã này
      </p>
    </div>
  );
}

export default function ParentSharePage() {
  const [codes, setCodes] = useState<ShareCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  useEffect(() => {
    // window chỉ có ở client → đọc origin sau mount để dựng link chia sẻ đầy đủ.
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/parent-share');
      if (res.status === 401) {
        setError('Bạn cần đăng nhập để tạo mã chia sẻ.');
        setCodes([]);
        return;
      }
      const data = await res.json();
      // Chuẩn hoá mã nhận được: trim và toUpperCase (#026)
      const list: ShareCode[] = Array.isArray(data.codes)
        ? data.codes
            .map((c: any) => ({
              code: typeof c.code === 'string' ? c.code.trim().toUpperCase() : '',
              revoked: Boolean(c.revoked),
              expires_at: typeof c.expires_at === 'string' ? c.expires_at : null,
            }))
            .filter((c: ShareCode) => c.code.length > 0)
        : [];
      setCodes(list);
      const active = list.find((c) => !c.revoked);
      if (active) setSelectedCode(active.code);
    } catch {
      setError('Không thể tải danh sách mã.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/parent-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      if (res.status === 401) {
        setError('Bạn cần đăng nhập để tạo mã chia sẻ.');
        return;
      }
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Không thể tạo mã.');
        return;
      }
      await load();
    } catch {
      setError('Không thể kết nối server.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (rawCode: string) => {
    // Chuẩn hoá mã chia sẻ (#026)
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) return;

    if (!confirm(`Bạn có chắc chắn muốn thu hồi mã ${code}? Bố mẹ sẽ không thể xem báo cáo qua mã này nữa.`)) {
      return;
    }
    setBusy(true);
    try {
      await fetch('/api/parent-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', code }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const linkFor = (code: string) => {
    const cleanCode = (code || '').trim().toUpperCase();
    return `${origin || 'https://satguru.edu.vn'}/parent?code=${encodeURIComponent(cleanCode)}`;
  };

  // Sao chép an toàn bằng fallback helper
  const copy = async (code: string) => {
    const cleanCode = (code || '').trim().toUpperCase();
    const success = await copyToClipboardSafe(linkFor(cleanCode));
    if (success) {
      setCopied(cleanCode);
      setTimeout(() => setCopied((c) => (c === cleanCode ? null : c)), 2000);
    }
  };

  const activeCodes = codes.filter((c) => !c.revoked);
  const currentCode = selectedCode || (activeCodes.length > 0 ? activeCodes[0].code : null);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">👨‍👩‍👧</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #fde047, #f59e0b)', WebkitBackgroundClip: 'text' }}>CHIA SẺ VỚI PHỤ HUYNH</h1>
            <p className="math-subtitle text-amber-200/80">Cho bố mẹ theo dõi tiến độ học SAT mà không cần tài khoản</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6 px-4">
        {/* Hướng dẫn tạo mã và mục đích */}
        <div className="bg-[#1b2533] p-6 rounded-2xl border border-[#334155] shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🛡️</span> Cổng kết nối Gia đình SAT.Guru
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                Tạo mã chia sẻ để gửi cho bố mẹ. Bố mẹ chỉ cần mở camera Zalo hoặc điện thoại quét mã QR là xem được điểm số dự đoán, tỷ lệ hoàn thành đề thi và phân tích điểm mạnh yếu — <span className="text-amber-300 font-semibold">hoàn toàn bảo mật, không cần đăng nhập</span>.
              </p>
            </div>
            <button
              onClick={generate}
              disabled={busy}
              className="whitespace-nowrap bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 disabled:opacity-50 text-[#78350f] font-bold px-6 py-3 rounded-xl shadow-md transition-all active:scale-95"
            >
              {busy ? 'Đang tạo...' : '➕ Tạo mã chia sẻ mới'}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mt-3 bg-red-950/40 p-3 rounded-lg border border-red-800/50">{error}</p>}
        </div>

        {/* POINT 80: Khối hiển thị trực quan Mã QR SVG kèm Hướng dẫn Quét Zalo */}
        {currentCode && (
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 p-6 md:p-8 rounded-2xl border-2 border-amber-500/30 shadow-2xl space-y-6">
            <div className="flex flex-col lg:flex-row items-center gap-8 justify-between">
              {/* QR Code SVG Visual */}
              <div className="flex-shrink-0 text-center">
                <ParentQRCodeSVG url={linkFor(currentCode)} code={currentCode} />
                <div className="mt-3 inline-block bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1 text-xs text-amber-300 font-mono">
                  Mã xem: <span className="font-bold text-white">{currentCode}</span>
                </div>
              </div>

              {/* Hướng dẫn quét Zalo & Thông tin cho Phụ huynh */}
              <div className="flex-1 space-y-4">
                <div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ✓ Đang kích hoạt & sẵn sàng quét
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2">
                    Hướng dẫn Bố Mẹ xem báo cáo bằng Điện thoại / Zalo
                  </h3>
                  <p className="text-sm text-slate-300 mt-1">
                    Bố mẹ không cần cài app phức tạp hay tạo tài khoản, thao tác chỉ mất 3 giây:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                    <div className="text-amber-400 font-black text-sm mb-1">BƯỚC 1 📱</div>
                    <p className="text-xs text-slate-200">
                      Mở ứng dụng <strong>Zalo</strong> hoặc <strong>Camera</strong> trên điện thoại của Bố/Mẹ.
                    </p>
                  </div>
                  <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                    <div className="text-amber-400 font-black text-sm mb-1">BƯỚC 2 🔍</div>
                    <p className="text-xs text-slate-200">
                      Bấm vào biểu tượng <strong>Quét mã QR</strong> (góc trên cùng bên phải màn hình Zalo).
                    </p>
                  </div>
                  <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                    <div className="text-amber-400 font-black text-sm mb-1">BƯỚC 3 📊</div>
                    <p className="text-xs text-slate-200">
                      Hướng camera vào hình mã QR bên cạnh để mở báo cáo chi tiết ngay lập tức!
                    </p>
                  </div>
                </div>

                {/* Thanh điều khiển nhanh */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => copy(currentCode)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow"
                  >
                    {copied === currentCode ? '✓ Đã sao chép link Zalo' : '📱 Sao chép Link gửi Zalo cho Bố Mẹ'}
                  </button>

                  <a
                    href={`/parent?code=${encodeURIComponent(currentCode)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm px-4 py-2.5 rounded-xl border border-slate-600 transition flex items-center gap-1.5"
                  >
                    <span>👁️</span> Xem trước báo cáo
                  </a>
                </div>

                <div className="text-xs text-slate-400 break-all bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500">Đường link trực tiếp:</span> {linkFor(currentCode)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Danh sách các mã đang hoạt động */}
        {loading ? (
          <p className="text-gray-400 text-center py-8">Đang tải danh sách mã chia sẻ...</p>
        ) : activeCodes.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <span>📋</span> Danh sách mã chia sẻ của bạn ({activeCodes.length})
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {activeCodes.map((c) => {
                const isSelected = c.code === currentCode;
                return (
                  <div
                    key={c.code}
                    className={`bg-[#1b2533] p-4 rounded-xl border transition ${
                      isSelected ? 'border-amber-400/80 bg-amber-500/5 shadow-md' : 'border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xl font-bold text-amber-300">{c.code}</span>
                        {isSelected && (
                          <span className="text-[11px] bg-amber-500/20 text-amber-300 font-semibold px-2 py-0.5 rounded-full border border-amber-500/40">
                            Đang xem QR
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!isSelected && (
                          <button
                            onClick={() => setSelectedCode(c.code)}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-3 py-1.5 rounded-lg transition"
                          >
                            📷 Hiện mã QR
                          </button>
                        )}
                        <button
                          onClick={() => copy(c.code)}
                          className="text-xs bg-amber-500 hover:bg-amber-400 text-[#78350f] font-semibold px-3 py-1.5 rounded-lg transition"
                        >
                          {copied === c.code ? '✓ Đã copy' : '📋 Copy link'}
                        </button>
                        <button
                          onClick={() => revoke(c.code)}
                          disabled={busy}
                          className="text-xs bg-red-800/80 hover:bg-red-700 text-red-200 px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
                        >
                          🗑️ Thu hồi
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 break-all mt-2">{linkFor(c.code)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          !error && (
            <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800">
              <span className="text-4xl block mb-2">👨‍👩‍👧</span>
              <p className="text-slate-300 font-medium">Chưa có mã chia sẻ nào đang hoạt động</p>
              <p className="text-slate-500 text-xs mt-1">Bấm nút "Tạo mã chia sẻ mới" ở trên để gửi link cho bố mẹ</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}