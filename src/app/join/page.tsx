'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

function JoinClassContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const initialCode = (params.get('code') || '').trim().toUpperCase();

  const [code, setCode] = useState(initialCode);
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<'idle' | 'joining' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [joinedName, setJoinedName] = useState('');

  useEffect(() => {
    if (initialCode) setCode(initialCode);
  }, [initialCode]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setStatus('error');
      setMessage('Vui lòng nhập mã lớp học từ Giáo viên (VD: SAT-AB12CD).');
      return;
    }
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(`/join?code=${cleanCode}`)}`);
      return;
    }

    setStatus('joining');
    setMessage('');
    try {
      const res = await fetch('/api/teacher/classrooms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, displayName: displayName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setMessage(data?.error || 'Không thể tham gia lớp học. Hãy kiểm tra lại mã lớp.');
        return;
      }
      setStatus('success');
      setJoinedName(data?.classroom?.name || cleanCode);
      setMessage(`Chúc mừng! Bạn đã vào lớp "${data?.classroom?.name || cleanCode}" thành công.`);
    } catch {
      setStatus('error');
      setMessage('Lỗi kết nối tới máy chủ. Vui lòng thử lại.');
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-indigo-500/40 p-7 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl">🏫</div>
          <h1 className="text-2xl font-black text-white">Tham Gia Lớp Học SAT.Guru</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Nhập mã lớp do Giáo viên hoặc Trung tâm gửi để nhận bài tập cá nhân hóa và bài thi thử Bluebook trực tiếp.
          </p>
        </div>

        {status === 'success' ? (
          <div className="space-y-4 text-center">
            <div className="rounded-2xl bg-emerald-950/50 border border-emerald-500/40 p-4 text-sm text-emerald-200 font-semibold">
              🎉 {message}
            </div>
            <div className="text-xs text-slate-400">
              Lớp học <strong className="text-white">{joinedName}</strong> đã được gắn vào Nhật ký học tập của bạn.
            </div>
            <Link
              href="/dashboard"
              className="block w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition"
            >
              Về Bảng Điều Khiển Học Tập →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">Mã Lớp Học (Class Code)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: SAT-AB12CD"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-base font-mono font-bold text-amber-300 placeholder-slate-500 focus:outline-none focus:border-indigo-400 uppercase tracking-widest"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">Họ và Tên hiển thị với Giáo viên</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="VD: Nguyễn Minh Anh — Lớp 11A1"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
              />
            </div>

            {status === 'error' && (
              <div className="rounded-xl bg-rose-950/50 border border-rose-500/40 px-3.5 py-2.5 text-xs text-rose-200">
                ⚠️ {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'joining' || isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white font-black text-sm shadow-lg transition disabled:opacity-60"
            >
              {!isAuthenticated && !isLoading
                ? '🔐 Đăng Nhập & Vào Lớp Ngay'
                : status === 'joining'
                ? '⏳ Đang tham gia lớp...'
                : '🚀 Tham Gia Lớp Học 1-Chạm'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function JoinClassroomPage() {
  return (
    <Suspense fallback={<div className="text-center text-slate-400 py-24">Đang mở cổng tham gia lớp học...</div>}>
      <JoinClassContent />
    </Suspense>
  );
}
