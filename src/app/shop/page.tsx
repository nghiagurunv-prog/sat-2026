'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useGamification, ITEM_CATALOG } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import type { RedemptionRecord, RedemptionStatus } from '@/lib/rewards';

// Nhãn + màu cho trạng thái phiếu đổi quà (khớp bảng màu toast/banner của app).
const STATUS_META: Record<RedemptionStatus, { label: string; cls: string }> = {
  pending: { label: '⏳ Đang xử lý', cls: 'bg-[#1e293b] border-[#3b82f6] text-[#93c5fd]' },
  fulfilled: { label: '✅ Đã giao', cls: 'bg-[#064e3b] border-[#10b981] text-[#34d399]' },
  cancelled: { label: '✖ Đã hủy', cls: 'bg-[#450a0a] border-[#ef4444] text-[#fca5a5]' },
};

// Thứ hạng gói để so điều kiện gate hiển thị (free < premium < ultimate).
const TIER_RANK: Record<string, number> = { free: 0, premium: 1, ultimate: 2 };

// #C073: Danh mục kho học liệu độc quyền (tải tức thì 0s)
const STUDY_MATERIALS = [
  {
    id: 'mat-desmos-handbook',
    name: 'Sổ tay Bí kíp Bấm Máy Desmos 800/800 Math',
    desc: 'Tổng hợp 40 tuyệt chiêu đồ thị, hệ phương trình, hồi quy & tối ưu thời gian làm bài Math.',
    cost: 150,
    tag: 'Math 800 🔥',
    icon: '📐',
  },
  {
    id: 'mat-idioms-200',
    name: 'Bộ 200 Idioms & Từ Vựng Cốt Lõi RW 750+',
    desc: 'Danh mục từ vựng học thuật tần suất cao nhất trong bài thi Digital SAT kèm ngữ cảnh bẫy.',
    cost: 120,
    tag: 'RW 750+ 📖',
    icon: '📚',
  },
  {
    id: 'mat-evidence-50',
    name: 'Tuyển Tập 50 Bẫy Câu Hỏi Dẫn Chứng Evidence',
    desc: 'Bóc tách các bẫy suy diễn sai lệch, dẫn chứng thiếu sót trong Module 2 RW Hard.',
    cost: 180,
    tag: 'Chinh phục 1500+ 🎯',
    icon: '🔍',
  },
];

export default function ShopPage() {
  const { coins, buyItem, redeemReward, tier } = useGamification();
  const { showToast } = useToast();

  // Quà THẬT cần xác nhận (đổi xong không hoàn) + tránh double-click khi đang gọi API.
  const [confirmReward, setConfirmReward] = useState<{ id: string; name: string; price: number } | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  // #C073: Quản lý học liệu đã mở khóa (lưu localStorage)
  const [unlockedMaterials, setUnlockedMaterials] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('sat_unlocked_materials_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleUnlockMaterial = (item: { id: string; name: string; cost: number }) => {
    if (unlockedMaterials.includes(item.id)) {
      showToast(`📥 Đang tải xuống tài liệu: ${item.name}`, 'info');
      return;
    }
    if (coins < item.cost) {
      showToast(`⚠️ Bạn cần ${item.cost} Xu để đổi (hiện có ${coins} Xu). Hãy luyện tập thêm!`, 'error');
      return;
    }
    const updated = [...unlockedMaterials, item.id];
    setUnlockedMaterials(updated);
    try {
      localStorage.setItem('sat_unlocked_materials_v1', JSON.stringify(updated));
    } catch {}
    showToast(`🎉 Mở khóa thành công "${item.name}"! Bạn có thể tải ngay.`, 'success');
  };

  // Lịch sử phiếu đổi quà của user (GET /api/redeem).
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);

  const loadRedemptions = async () => {
    try {
      const res = await fetch('/api/redeem');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.redemptions)) setRedemptions(data.redemptions);
      }
    } catch (e) {
      console.error('Failed to load redemptions', e);
    }
  };

  // Tải lịch sử phiếu 1 lần khi vào trang. Mẫu như GamificationContext: async
  // ĐỊNH NGHĨA TRONG effect (không gọi hàm component-scope) → setState post-await
  // hợp lệ với react-hooks/set-state-in-effect.
  useEffect(() => {
    async function initLoad() {
      try {
        const res = await fetch('/api/redeem');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.redemptions)) setRedemptions(data.redemptions);
        }
      } catch (e) {
        console.error('Failed to load redemptions', e);
      }
    }
    initLoad();
  }, []);

  const handleBuyItem = (price: number, name: string, id: string) => {
    const result = buyItem(id, price);
    if (result.success) {
      const powerMsg = result.maxPowerGained ? ` (+${result.maxPowerGained} Lực chiến)` : '';
      showToast(`🎉 Mua thành công: ${name}!${powerMsg}`, 'success');
    } else if (result.reason === 'already_owned') {
      showToast(`⚠️ Bạn đã sở hữu ${name} rồi. Trang bị chỉ cần mua một lần.`, 'error');
    } else if (result.reason === 'tier_locked') {
      showToast(`🔒 ${name} là vật phẩm độc quyền của gói cao hơn. Hãy nâng cấp để mở khóa!`, 'error');
    } else {
      showToast(`❌ Không đủ Xu để mua ${name}. Hãy cày cuốc thêm!`, 'error');
    }
  };

  const handleConfirmRedeem = async () => {
    if (!confirmReward || redeeming) return;
    setRedeeming(true);
    const result = await redeemReward(confirmReward.id);
    setRedeeming(false);
    setConfirmReward(null);
    showToast(result.success ? `🎟️ ${result.message}` : `❌ ${result.message}`, result.success ? 'success' : 'error');
    if (result.success) loadRedemptions(); // làm mới lịch sử sau khi đổi thành công
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 relative pb-20">

      {/* Header */}
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #14532d 0%, #064e3b 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">🛒</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #6ee7b7, #34d399)", WebkitBackgroundClip: "text" }}>CỬA HÀNG VẬT PHẨM</h1>
            <p className="math-subtitle text-green-200">Dùng Xu cày được để mua sắm vật phẩm hỗ trợ!</p>
          </div>
        </div>
        <div className="rpg-hud-container flex items-center justify-center">
          <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fbbf24" }}>
            Số dư hiện tại: 💰 {coins} Xu
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ITEM_CATALOG.map((item, idx) => {
          const isReward = item.type === 'reward';
          // Gate HIỂN THỊ: item có requiredTier mà gói user chưa đạt → khóa, hiện
          // nhãn gói + link /upgrade thay nút mua (chốt bảo mật thật ở server).
          const requiredTier = (item as { requiredTier?: 'premium' | 'ultimate' }).requiredTier;
          const tierLocked = !!requiredTier && TIER_RANK[tier] < TIER_RANK[requiredTier];
          const tierLabel = requiredTier === 'ultimate' ? 'Ultimate' : 'Premium';
          return (
            <div key={idx} className={`bg-[#1b2533] border border-[#262730] rounded-xl p-6 text-center hover:border-[#fbbf24] transition-all group ${tierLocked ? 'opacity-70' : ''} ${item.effectClass || ''}`}>
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">{tierLocked ? '🔒' : item.icon}</div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center justify-center gap-2">
                {item.name}
                {requiredTier && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {tierLabel}
                  </span>
                )}
              </h3>
              <p className="text-[#94a3b8] text-sm mb-6 h-10">
                {isReward ? '🎁 QUÀ THẬT — đổi bằng Xu (nhận sau khi duyệt)' : `Loại: ${item.type.toUpperCase()}`}
              </p>
              {tierLocked ? (
                <Link
                  href={`/upgrade?from=shop&unlock=${requiredTier}`}
                  className="w-full inline-flex justify-center items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-amber-950 font-bold py-2 rounded transition-colors"
                >
                  🔒 Mở khóa với {tierLabel}
                </Link>
              ) : isReward ? (
                <button
                  onClick={() => setConfirmReward({ id: item.id, name: item.name, price: item.price })}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold py-2 rounded transition-colors flex justify-center items-center gap-2"
                >
                  Đổi quà: {item.price} 💰
                </button>
              ) : (
                <button
                  onClick={() => handleBuyItem(item.price, item.name, item.id)}
                  className="w-full bg-[#fbbf24] hover:bg-[#f59e0b] text-[#78350f] font-bold py-2 rounded transition-colors flex justify-center items-center gap-2"
                >
                  Mua ngay: {item.price} 💰
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* #C073: Kho Học Liệu Độc Quyền (Đổi ngay 0s) */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-blue-950/60 border border-indigo-500/30 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-indigo-500/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <h2 className="text-xl font-black text-white">Kho Học Liệu Độc Quyền (Đổi Ngay 0s)</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Tải tức thì ⚡
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Dùng Xu tích lũy để mở khóa ngay tài liệu PDF tuyển chọn độc quyền từ Guru SAT, không cần chờ duyệt!
            </p>
          </div>
          <div className="text-xs font-semibold text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 self-start md:self-auto">
            Số dư khả dụng: <span className="text-amber-400 font-black">{coins}</span> 💰
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STUDY_MATERIALS.map((mat) => {
            const isUnlocked = unlockedMaterials.includes(mat.id);
            return (
              <div
                key={mat.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{mat.icon}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {mat.tag}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white leading-snug">{mat.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{mat.desc}</p>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-amber-400 font-black text-sm">{mat.cost} 💰</span>
                  <button
                    onClick={() => handleUnlockMaterial(mat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isUnlocked
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                        : coins >= mat.cost
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <span>{isUnlocked ? '📥' : '🔓'}</span>
                    <span>{isUnlocked ? 'Tải PDF Ngay' : 'Đổi Ngay'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* #C076: Hộp giải thích minh bạch điều kiện Tinh thông bền vững (Durable Mastered) */}
      <div className="bg-slate-900/60 border border-emerald-500/30 rounded-xl p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🛡️</span>
          <h3 className="text-base font-bold text-white">
            Chuẩn Tinh Thông Bền Vững (Durable Mastered) — Chống Pay-to-Win 100%
          </h3>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
            Học thuật thực chất
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Tại SAT Guru, vật phẩm trong Cửa Hàng và Xu chỉ hỗ trợ trải nghiệm thị giác và tài liệu tham khảo bổ trợ. 
          <strong className="text-white"> Cấp độ Tinh thông (Mastered)</strong> của mỗi chủ đề toán học và đọc hiểu KHÔNG THỂ mua bằng tiền hay xu, mà bắt buộc phải đạt đủ 3 tiêu chuẩn FSRS Spaced-Repetition:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-xs">
            <div className="text-emerald-400 font-bold mb-1">1. Tần suất ngắt quãng</div>
            <p className="text-slate-400 text-[11px]">Đúng tối thiểu 3 phiên làm bài ngắt quãng cách nhau ít nhất 24-48 giờ.</p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-xs">
            <div className="text-emerald-400 font-bold mb-1">2. Tỉ lệ chính xác cao</div>
            <p className="text-slate-400 text-[11px]">Độ chính xác duy trì ≥ 85% và không phạm quá 1 lỗi sai trong 7 ngày gần nhất.</p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-xs">
            <div className="text-emerald-400 font-bold mb-1">3. Kháng quên thực tế</div>
            <p className="text-slate-400 text-[11px]">Chỉ số Retrievability ≥ 0.90 trong thuật toán FSRS-4.5 của hệ thống.</p>
          </div>
        </div>
      </div>

      {/* Lịch sử đổi quà thật — user theo dõi trạng thái phiếu */}
      {redemptions.length > 0 && (
        <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-6">
          <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">🎟️ Lịch sử đổi quà</h2>
          <div className="space-y-3">
            {redemptions.map((r) => {
              const meta = STATUS_META[r.status] ?? STATUS_META.pending;
              return (
                <div key={r.id} className="flex items-center justify-between gap-4 bg-[#0f172a] border border-[#262730] rounded-lg px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-white font-bold truncate">{r.rewardName}</div>
                    <div className="text-[#94a3b8] text-xs">
                      {new Date(r.createdAt).toLocaleString('vi-VN')} · {r.costCoins} 💰
                    </div>
                  </div>
                  <span className={`shrink-0 px-3 py-1 rounded-full border text-xs font-bold ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Xác nhận đổi quà THẬT — hành động không hoàn lại */}
      {confirmReward && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1b2533] border-2 border-emerald-500 rounded-2xl p-8 max-w-md mx-4 shadow-[0_0_40px_#10b981]">
            <div className="text-4xl text-center mb-4">🎟️</div>
            <h3 className="text-xl font-black text-white text-center mb-2">Xác nhận đổi quà thật</h3>
            <p className="text-[#94a3b8] text-center mb-2">
              Đổi <span className="text-emerald-400 font-bold">{confirmReward.name}</span>
            </p>
            <p className="text-center mb-6">
              <span className="text-[#fbbf24] font-black text-lg">{confirmReward.price} 💰</span>
              <span className="text-[#94a3b8] text-sm block mt-1">
                Xu sẽ bị trừ ngay; phiếu đổi sẽ được đội ngũ xử lý thủ công. Hành động không thể hoàn lại.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReward(null)}
                disabled={redeeming}
                className="flex-1 bg-[#334155] hover:bg-[#475569] text-white font-bold py-2 rounded transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmRedeem}
                disabled={redeeming}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold py-2 rounded transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {redeeming ? 'Đang đổi...' : 'Xác nhận đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
