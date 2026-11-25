'use client';

import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_VN_UNIVERSITIES, type VnUniversityProfile } from '@/lib/uni-benchmarks';

interface QuestionReportRow {
  id: string;
  question_id: string;
  skill_id?: string | null;
  subject?: string;
  stem_preview?: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  admin_note?: string;
  created_at: string;
}

/**
 * ADMIN OPS EXTENSIONS (W3 #10 & #40):
 * 1. Hàng đợi Báo lỗi câu hỏi từ học sinh (/api/questions/report)
 * 2. Quản trị động Điểm chuẩn ĐH VN & Học bổng (/api/admin/benchmarks) không cần redeploy
 */
export function AdminOpsExtensions({ adminSecret }: { adminSecret?: string }) {
  const [reports, setReports] = useState<QuestionReportRow[]>([]);
  const [unis, setUnis] = useState<VnUniversityProfile[]>([...DEFAULT_VN_UNIVERSITIES]);
  const [savingUnis, setSavingUnis] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminSecret && adminSecret.trim()) {
      h['x-admin-secret'] = adminSecret.trim();
    }
    return h;
  }, [adminSecret]);

  useEffect(() => {
    fetch('/api/questions/report', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.reports)) setReports(d.reports);
      })
      .catch(() => {});

    fetch('/api/admin/benchmarks')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.universities) && d.universities.length > 0) {
          setUnis(d.universities);
        }
      })
      .catch(() => {});
  }, [authHeaders]);

  const handleResolveReport = async (id: string, status: 'resolved' | 'dismissed') => {
    const res = await fetch('/api/questions/report', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      setStatusMsg(`✅ Đã chuyển trạng thái báo lỗi sang "${status}".`);
    }
  };

  const handleSaveBenchmarks = async () => {
    setSavingUnis(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/admin/benchmarks', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ universities: unis }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setStatusMsg(`✅ Đã lưu cấu hình điểm chuẩn ${data.count} trường ĐH lên Supabase!`);
      } else {
        setStatusMsg(`⚠️ ${data?.error || 'Cần quyền Admin để lưu cấu hình điểm chuẩn.'}`);
      }
    } catch {
      setStatusMsg('⚠️ Lỗi kết nối khi lưu cấu hình.');
    } finally {
      setSavingUnis(false);
    }
  };

  return (
    <div className="space-y-6 mt-8">
      {statusMsg && (
        <div className="rounded-xl bg-slate-900 border border-amber-500/40 px-4 py-2.5 text-xs text-amber-200 font-semibold">
          {statusMsg}
        </div>
      )}

      {/* 1. Hàng đợi Báo lỗi câu hỏi (#10) */}
      <div className="rounded-2xl bg-[#111927] border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-white">🚩 Hàng Đợi Báo Lỗi Câu Hỏi Từ Học Sinh</h3>
            <p className="text-xs text-slate-400">
              Tiếp nhận phản hồi công thức/đáp án 1-chạm từ phòng luyện tập &amp; phòng thi.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
            {reports.filter((r) => r.status === 'open').length} đang mở
          </span>
        </div>

        {reports.length === 0 ? (
          <div className="text-xs text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            Chưa có báo lỗi câu hỏi nào trong hàng đợi.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto">
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-300 font-bold">{rep.question_id}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                      {rep.subject || 'SAT'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rep.status === 'open'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {rep.status}
                    </span>
                  </div>
                  <p className="text-slate-300 truncate">{rep.stem_preview || rep.reason}</p>
                </div>
                {rep.status === 'open' && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleResolveReport(rep.id, 'resolved')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    >
                      ✓ Đã sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveReport(rep.id, 'dismissed')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                    >
                      Bỏ qua
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Quản trị động Điểm chuẩn ĐH VN & Học bổng (#40) */}
      <div className="rounded-2xl bg-[#111927] border border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white">🏛️ Quản Trị Động Điểm Chuẩn ĐH VN &amp; Học Bổng</h3>
            <p className="text-xs text-slate-400">
              Cập nhật ngưỡng sàn / an toàn / ngành Top 1 cho mùa tuyển sinh mới trực tiếp không cần redeploy.
            </p>
          </div>
          <button
            type="button"
            disabled={savingUnis}
            onClick={handleSaveBenchmarks}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow disabled:opacity-60"
          >
            {savingUnis ? '⏳ Đang lưu...' : '💾 Lưu Cấu Hình Điểm Chuẩn'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-3">Trường ĐH</th>
                <th className="py-2 px-2">Sàn SAT</th>
                <th className="py-2 px-2">An toàn</th>
                <th className="py-2 px-2">Ngành Top</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {unis.map((u, idx) => (
                <tr key={u.slug}>
                  <td className="py-2 pr-3 font-bold text-white">{u.shortName}</td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={800}
                      max={1600}
                      step={10}
                      value={u.minSat}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setUnis((prev) => prev.map((x, i) => (i === idx ? { ...x, minSat: v } : x)));
                      }}
                      className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={800}
                      max={1600}
                      step={10}
                      value={u.safeSat}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setUnis((prev) => prev.map((x, i) => (i === idx ? { ...x, safeSat: v } : x)));
                      }}
                      className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-emerald-300 font-mono"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={800}
                      max={1600}
                      step={10}
                      value={u.topMajorSat}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setUnis((prev) => prev.map((x, i) => (i === idx ? { ...x, topMajorSat: v } : x)));
                      }}
                      className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-amber-300 font-mono"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
