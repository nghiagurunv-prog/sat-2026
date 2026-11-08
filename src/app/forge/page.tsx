'use client';

import { useState, useEffect, useRef } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { getForgeCost, type Equipment } from '@/helpers/forge';
import MistakeNotebook from '@/components/MistakeNotebook';

export default function ForgePage() {
  const { inventory, upgradeItem, shields } = useGamification();
  const [activeTab, setActiveTab] = useState<'mistakes' | 'forge'>('mistakes');
  const [log, setLog] = useState<{ message: string; success: boolean } | null>(null);
  // Bùa Bảo Hộ: dùng Khiên Bảo Vệ Streak (mua ở shop) để chặn rớt cấp khi fail.
  const [useBua, setUseBua] = useState(false);
  // Tinh Thể Khắc Phục Lỗi (Mastery Shard): kiếm được từ việc sửa câu sai
  const [masteryShards, setMasteryShards] = useState<number>(0);
  const [useShardBoost, setUseShardBoost] = useState<boolean>(false);
  const forgingRef = useRef(false);
  const logTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => {
      if (logTimerRef.current) clearTimeout(logTimerRef.current);
    };
  }, []);

  // Đọc số Tinh Thể Khắc Phục Lỗi từ localStorage & đồng bộ
  useEffect(() => {
    const syncShards = () => {
      try {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('sat_mastery_shards_v1');
          setMasteryShards(saved ? parseInt(saved, 10) || 0 : 0);
        }
      } catch {}
    };

    syncShards();
    window.addEventListener('storage', syncShards);
    window.addEventListener('sat_mastery_shards_changed', syncShards);

    return () => {
      window.removeEventListener('storage', syncShards);
      window.removeEventListener('sat_mastery_shards_changed', syncShards);
    };
  }, []);

  const equipmentList = inventory.filter(
    (item): item is Equipment => typeof item === 'object' && 'instanceId' in item
  );

  const handleUpgrade = (instanceId: string) => {
    if (forgingRef.current) return;
    forgingRef.current = true;
    try {
      const isUsingShard = useShardBoost && masteryShards > 0;

      // Trừ 1 Tinh Thể nếu người chơi kích hoạt Shard Boost
      if (isUsingShard) {
        const newCount = Math.max(0, masteryShards - 1);
        setMasteryShards(newCount);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('sat_mastery_shards_v1', String(newCount));
            window.dispatchEvent(new Event('sat_mastery_shards_changed'));
          }
        } catch {}
      }

      // Khi dùng Tinh Thể: kích hoạt bảo hộ tuyệt đối không rớt cấp
      const result = upgradeItem(instanceId, (useBua && shields > 0) || isUsingShard);

      if (isUsingShard) {
        if (result.success) {
          setLog({
            success: true,
            message: `💎 [TINH THỂ PHỤC THÙ] Uy lực tối thượng! ${result.message} (Đã kích hoạt +100% tỉ lệ & Giảm 50% chi phí!)`,
          });
        } else {
          setLog({
            success: true,
            message: `💎 [TINH THỂ PHỤC THÙ BẢO HỘ] Trang bị đã được bảo toàn nguyên vẹn 100% không suy giảm cấp độ!`,
          });
        }
      } else {
        setLog(result);
      }

      if (logTimerRef.current) clearTimeout(logTimerRef.current);
      logTimerRef.current = setTimeout(() => setLog(null), 3500);
    } finally {
      setTimeout(() => {
        forgingRef.current = false;
      }, 400);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header Lò Rèn */}
      <div
        className="math-academy-header epic-shake-active"
        style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)' }}
      >
        <div className="math-title-container">
          <div className="math-icon">⚒️</div>
          <div>
            <h1
              className="math-title"
              style={{
                background: 'linear-gradient(to right, #fca5a5, #ef4444)',
                WebkitBackgroundClip: 'text',
              }}
            >
              LÒ RÈN CHIẾN BINH &amp; PHỤC THÙ ĐIỂM SỐ
            </h1>
            <p className="math-subtitle text-red-200">
              Đúc kết kinh nghiệm từ câu sai thành sức mạnh hủy diệt SAT!
            </p>
          </div>
        </div>
      </div>

      {/* Tabs chuyển đổi giữa Sổ Tay Câu Sai và Rèn Thần Khí */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111827] p-2 rounded-2xl border border-[#262730]">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('mistakes')}
            className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${
              activeTab === 'mistakes'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                : 'bg-[#1b2533] text-gray-300 hover:text-white hover:bg-[#253246]'
            }`}
          >
            <span>📕</span>
            <span>Tab 1: Lò Rèn Câu Sai &amp; Phục Thù Điểm Số</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('forge')}
            className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${
              activeTab === 'forge'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                : 'bg-[#1b2533] text-gray-300 hover:text-white hover:bg-[#253246]'
            }`}
          >
            <span>⚒️</span>
            <span>Tab 2: Rèn Thần Khí Chiến Binh</span>
          </button>
        </div>

        {/* Badge Tinh Thể Khắc Phục Lỗi */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-950/80 to-purple-950/80 border border-indigo-500/40 text-xs">
          <span className="text-base">💎</span>
          <span className="text-gray-300 font-medium">Tinh Thể Khắc Phục:</span>
          <strong className="text-amber-300 font-black text-sm">{masteryShards}</strong>
          <span className="text-gray-400">viên</span>
        </div>
      </div>

      {/* NỘI DUNG TAB 1: LÒ RÈN CÂU SAI & PHỤC THÙ ĐIỂM SỐ */}
      {activeTab === 'mistakes' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-rose-950/40 via-red-950/20 to-slate-900 border border-red-500/30 p-4 rounded-xl text-xs text-rose-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔥</span>
              <span>
                <strong>Lò Rèn Câu Sai:</strong> Biến mỗi sai lầm phòng thi thành vũ khí sắc bén. Mỗi câu khắc phục thành công thưởng <strong>+1 đến +2 Tinh Thể Khắc Phục Lỗi</strong> để mang sang Tab 2 đập đồ thần khí!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('forge')}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold whitespace-nowrap transition-colors"
            >
              Sang Rèn Trang Bị →
            </button>
          </div>

          <MistakeNotebook />
        </div>
      )}

      {/* NỘI DUNG TAB 2: RÈN THẦN KHÍ CHIẾN BINH */}
      {activeTab === 'forge' && (
        <div className="space-y-6">
          {log && (
            <div
              className={`p-4 rounded-xl text-center font-bold shadow-lg ${
                log.success
                  ? 'bg-green-950 text-green-300 border-green-500/80'
                  : 'bg-red-950 text-red-300 border-red-500/80'
              } border animate-bounce`}
            >
              {log.message}
            </div>
          )}

          {/* Card: Dùng Tinh Thể Khắc Phục Lỗi (Mastery Shard Boost) */}
          <div className="bg-gradient-to-r from-[#172554] via-[#1e1b4b] to-[#172554] p-5 rounded-2xl border border-indigo-500/40 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1">
              <div className="font-extrabold text-white flex items-center gap-2 text-base">
                <span>💎 Tinh Thể Khắc Phục Lỗi (Mastery Shard)</span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-2.5 py-0.5 rounded-full font-black">
                  Hiện có: {masteryShards} viên
                </span>
              </div>
              <p className="text-xs text-indigo-200/90 leading-relaxed max-w-xl">
                Tích lũy từ việc giải đúng câu sai trong <strong>Sổ Tay Câu Sai</strong>. Kích hoạt để <strong>Tăng 100% tỷ lệ rèn thành công</strong> và <strong>Giảm 50% chi phí Vàng</strong> cho mỗi lần đập đồ!
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUseShardBoost(v => !v)}
              disabled={masteryShards === 0}
              className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all shrink-0 flex items-center gap-2 shadow-md ${
                masteryShards === 0
                  ? 'bg-[#1e293b] text-gray-500 border border-gray-700 cursor-not-allowed'
                  : useShardBoost
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_0_16px_rgba(245,158,11,0.5)] scale-105'
                  : 'bg-[#1e293b] text-indigo-300 hover:bg-[#2d3748] border border-indigo-500/30'
              }`}
            >
              <span>⚡</span>
              {masteryShards === 0
                ? 'Hết Tinh Thể (Hãy sửa câu sai)'
                : useShardBoost
                ? '✓ ĐANG BẬT (+100% TỈ LỆ & -50% VÀNG)'
                : 'KÍCH HOẠT TINH THỂ PHỤC THÙ'}
            </button>
          </div>

          {/* Bùa Bảo Hộ — dùng Khiên Bảo Vệ Streak để chặn rớt cấp khi cường hóa fail */}
          <div className="bg-[#1b2533] p-5 rounded-xl border border-[#334155] flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-white flex items-center gap-2">🛡️ Bùa Bảo Hộ</div>
              <p className="text-sm text-gray-400">
                Bật để dùng 1 Khiên Bảo Vệ mỗi lần cường hóa thất bại — giữ nguyên cấp, không rớt. Hiện có:{' '}
                <span className="font-bold text-[#fbbf24]">{shields}</span> khiên.
              </p>
            </div>
            <button
              onClick={() => setUseBua(v => !v)}
              disabled={shields === 0}
              className={`px-5 py-2 rounded-full font-bold text-sm transition-colors shrink-0 ${
                shields === 0
                  ? 'bg-[#1e293b] text-gray-500 cursor-not-allowed'
                  : useBua
                  ? 'bg-[#10b981] text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                  : 'bg-[#334155] text-gray-300 hover:bg-[#475569]'
              }`}
            >
              {shields === 0 ? 'Hết khiên' : useBua ? 'ĐANG BẬT' : 'ĐANG TẮT'}
            </button>
          </div>

          {/* Danh Sách Trang Bị Của Bạn */}
          <div className="bg-[#1b2533] p-8 rounded-xl border border-[#ef4444] shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Trang Bị Của Bạn</h2>

            {equipmentList.length === 0 ? (
              <p className="text-gray-400 text-center">Bạn chưa có trang bị nào để cường hóa.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {equipmentList.map(item => {
                  const { coins } = getForgeCost(item.tier, item.level);
                  const effectiveCoins =
                    useShardBoost && masteryShards > 0 ? Math.floor(coins / 2) : coins;

                  // CSS Glow Effect for high level Forge items
                  let glowClass = '';
                  if (item.level >= 10) glowClass = 'shadow-[0_0_30px_#facc15] border-[#facc15] animate-pulse';
                  else if (item.level >= 5) glowClass = 'shadow-[0_0_15px_#3b82f6] border-[#3b82f6]';

                  return (
                    <div
                      key={item.instanceId}
                      className={`bg-[#0e1117] border-[#334155] border p-4 rounded flex justify-between items-center transition-all ${glowClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{item.icon}</div>
                        <div>
                          <div className="font-bold text-white">
                            {item.name} <span className="text-red-400">+{item.level}</span>
                          </div>
                          <div className="text-sm text-gray-400">
                            Hạng: {item.tier} | Cần:{' '}
                            {useShardBoost && masteryShards > 0 ? (
                              <span className="text-emerald-400 font-bold">
                                💰 <span className="line-through text-gray-500 mr-1">{coins}</span>
                                {effectiveCoins} Xu (-50%)
                              </span>
                            ) : (
                              <span>💰 {coins} Xu</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUpgrade(item.instanceId)}
                        className={`px-4 py-2 rounded font-bold transition-all shadow-md ${
                          useShardBoost && masteryShards > 0
                            ? 'bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-white shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                            : 'bg-[#ef4444] hover:bg-[#dc2626] text-white'
                        }`}
                      >
                        {useShardBoost && masteryShards > 0 ? '⚡ Rèn Thần Khí' : 'Đập Đồ'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
