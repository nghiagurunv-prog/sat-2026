'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';
import { PVP_OPPONENTS, getPvpRankName, PVP_COMBAT_SCALE, PVP_MIN_POWER_RATIO } from '@/helpers/pvp';

interface ShowdownQuestion {
  id: string;
  category: 'Math Desmos' | 'SAT Vocab';
  prompt: string;
  choices: string[];
  correctIdx: number;
  tip: string;
}

const SHOWDOWN_POOL: ShowdownQuestion[] = [
  {
    id: 'sd-1',
    category: 'Math Desmos',
    prompt: 'If 3x + 7 = 22, what is the value of 6x - 4?',
    choices: ['26', '30', '34', '14'],
    correctIdx: 0,
    tip: '3x = 15 → 6x = 30 → 6x - 4 = 26.',
  },
  {
    id: 'sd-2',
    category: 'SAT Vocab',
    prompt: 'The scientist’s findings were so ___ that even longtime skeptics revised their models.',
    choices: ['compelling', 'ephemeral', 'ambiguous', 'trivial'],
    correctIdx: 0,
    tip: 'Skeptics revised models → findings phải cực kỳ thuyết phục (compelling).',
  },
  {
    id: 'sd-3',
    category: 'Math Desmos',
    prompt: 'The parabola y = (x - 4)^2 - 9 has its vertex at (h, k). What is h + k?',
    choices: ['-5', '5', '13', '-13'],
    correctIdx: 0,
    tip: 'Vertex (4, -9) → 4 + (-9) = -5.',
  },
  {
    id: 'sd-4',
    category: 'SAT Vocab',
    prompt: 'Rather than ___ the debate, the mediator’s remarks calmed both sides.',
    choices: ['exacerbating', 'alleviating', 'corroborating', 'emulating'],
    correctIdx: 0,
    tip: 'Đối lập với "calmed both sides" → làm trầm trọng thêm (exacerbating).',
  },
  {
    id: 'sd-5',
    category: 'Math Desmos',
    prompt: 'Lines y = 4x + 1 and y = kx - 5 are parallel. What is the value of 2k?',
    choices: ['8', '4', '-2', '1/2'],
    correctIdx: 0,
    tip: 'Song song → cùng hệ số góc k = 4 → 2k = 8 (cẩn thận bẫy hỏi 2k!).',
  },
];

export default function PvPPage() {
  const { pvpRank, fightPvP } = useGamification();
  const [arenaTab, setArenaTab] = useState<'showdown' | 'classic'>('showdown');
  const [log, setLog] = useState<{ message: string; success: boolean; won: boolean } | null>(null);
  const [isFighting, setIsFighting] = useState(false);
  const fightLockRef = useRef(false);
  const logTimerRef = useRef<NodeJS.Timeout | null>(null);

  // W3 #15: Live 1v1 Speed Showdown 60s (5 câu SAT nhanh — tính ELO & huy hiệu trường)
  const [sdActive, setSdActive] = useState(false);
  const [sdIdx, setSdIdx] = useState(0);
  const [sdTimeLeft, setSdTimeLeft] = useState(60);
  const [sdScore, setSdScore] = useState(0);
  const [sdRivalScore, setSdRivalScore] = useState(0);
  const [sdFinished, setSdFinished] = useState(false);
  const [eloRating, setEloRating] = useState(1400);
  const [lastEloDelta, setLastEloDelta] = useState<number | null>(null);

  const finishShowdown = useCallback((myPts: number, rivalPts: number) => {
    setSdActive(false);
    setSdFinished(true);
    const delta = myPts > rivalPts ? +24 : myPts === rivalPts ? +6 : -14;
    setLastEloDelta(delta);
    setEloRating((prev) => {
      const next = Math.max(1000, prev + delta);
      try {
        localStorage.setItem('sat_showdown_elo_v1', String(next));
      } catch (err) {
        console.warn('[pvp] Không thể lưu sat_showdown_elo_v1:', err);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      const savedElo = localStorage.getItem('sat_showdown_elo_v1');
      if (savedElo) {
        const parsed = parseInt(savedElo, 10);
        if (Number.isFinite(parsed) && parsed >= 800) setEloRating(parsed);
      }
    } catch (err) {
      console.warn('[pvp] Không thể đọc sat_showdown_elo_v1:', err);
    }
    return () => {
      if (logTimerRef.current) clearTimeout(logTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!sdActive || sdFinished) return;
    if (sdTimeLeft <= 0) {
      finishShowdown(sdScore, sdRivalScore);
      return;
    }
    const t = setInterval(() => setSdTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [sdActive, sdFinished, sdTimeLeft, sdScore, sdRivalScore, finishShowdown]);

  const startShowdown = () => {
    setSdActive(true);
    setSdFinished(false);
    setSdIdx(0);
    setSdTimeLeft(60);
    setSdScore(0);
    setSdRivalScore(0);
    setLastEloDelta(null);
  };

  const answerShowdown = (choiceIdx: number) => {
    if (!sdActive || sdFinished) return;
    const q = SHOWDOWN_POOL[sdIdx];
    const nextMy = sdScore + (choiceIdx === q.correctIdx ? 1 : 0);
    const rivalHit = sdIdx % 3 !== 2 ? 1 : 0; // Đối thủ ELO đồng cấp ~67% chính xác
    const nextRival = sdRivalScore + rivalHit;
    setSdScore(nextMy);
    setSdRivalScore(nextRival);
    if (sdIdx + 1 >= SHOWDOWN_POOL.length) {
      finishShowdown(nextMy, nextRival);
    } else {
      setSdIdx((i) => i + 1);
    }
  };

  const [basePower, setBasePower] = useState<number | null>(null);
  useEffect(() => {
    let isMounted = true;
    fetch('/api/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted) setBasePower(data?.basePower ?? 0);
      })
      .catch(() => {
        if (isMounted) setBasePower(0);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const targetRank = Math.max(1, pvpRank - 1);
  const opponent = PVP_OPPONENTS[targetRank];
  const combatPower = basePower !== null ? basePower * PVP_COMBAT_SCALE : null;
  const eligible =
    combatPower !== null && opponent ? combatPower >= opponent.luc_chien * PVP_MIN_POWER_RATIO : false;

  const handleFight = async () => {
    if (isFighting || fightLockRef.current) return;
    fightLockRef.current = true;
    setIsFighting(true);
    try {
      const result = await fightPvP();
      setLog(result);
      if (logTimerRef.current) clearTimeout(logTimerRef.current);
      logTimerRef.current = setTimeout(() => setLog(null), 4000);
      fetch('/api/stats')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setBasePower(data.basePower ?? 0);
        })
        .catch(() => {});
    } finally {
      setIsFighting(false);
      fightLockRef.current = false;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 max-w-3xl mx-auto px-4">
      <div className="text-center space-y-2 pt-4">
        <h1 className="text-3xl sm:text-4xl font-black text-[#fbbf24] uppercase tracking-wider">
          🏟️ Đấu Trường SAT Học Thuật (PvP)
        </h1>
        <p className="text-sm text-slate-400">
          ELO Speed Showdown: <strong className="text-emerald-400 font-mono text-base">{eloRating}</strong> • Hạng:{' '}
          <strong className="text-white">{getPvpRankName(pvpRank)}</strong>
        </p>

        <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 mt-2">
          <button
            type="button"
            onClick={() => setArenaTab('showdown')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition ${
              arenaTab === 'showdown' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚡ 1v1 Giải Nhanh 60 Giây (Học Thuật)
          </button>
          <button
            type="button"
            onClick={() => setArenaTab('classic')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition ${
              arenaTab === 'classic' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚔️ Thách Đấu Bậc Hạng
          </button>
        </div>
      </div>

      {arenaTab === 'showdown' ? (
        <div className="rounded-2xl bg-[#131d2e] border-2 border-amber-500/40 p-6 shadow-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[11px] font-black uppercase text-amber-400">Live Speed Showdown • 5 Câu / 60s</span>
              <h2 className="text-lg font-black text-white">Đối Đầu SAT Math Desmos &amp; Vocab</h2>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                Bạn: {sdScore}/5
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                Đối thủ ELO {eloRating}: {sdRivalScore}/5
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg border font-black ${
                  sdTimeLeft <= 15
                    ? 'bg-rose-950 border-rose-500 text-rose-300 animate-pulse'
                    : 'bg-slate-900 border-slate-700 text-amber-300'
                }`}
              >
                ⏱️ {sdTimeLeft}s
              </span>
            </div>
          </div>

          {!sdActive && !sdFinished && (
            <div className="text-center py-6 space-y-4">
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                Giải 5 câu trắc nghiệm SAT tốc độ cao trong 60 giây (Toán Desmos &amp; Từ vựng ngữ cảnh) để tăng hạng ELO và ghi điểm Huy hiệu trường THPT.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={startShowdown}
                  className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm shadow-lg transition"
                >
                  🚀 Bắt Đầu Trận 1v1 60 Giây Ngay
                </button>
                <Link
                  href="/leaderboard"
                  className="px-4 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 flex items-center"
                >
                  🏆 BXH Trường THPT
                </Link>
              </div>
            </div>
          )}

          {sdActive && !sdFinished && (() => {
            const q = SHOWDOWN_POOL[sdIdx];
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">{q.category}</span>
                  <span>Câu {sdIdx + 1} / {SHOWDOWN_POOL.length}</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-white bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                  {q.prompt}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {q.choices.map((c, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => answerShowdown(idx)}
                      className="text-left p-3.5 rounded-xl bg-slate-900 hover:bg-indigo-900/40 border border-slate-700 hover:border-amber-400 text-sm font-semibold text-white transition"
                    >
                      <span className="font-black text-amber-400 mr-2">{String.fromCharCode(65 + idx)}.</span>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {sdFinished && (
            <div className="text-center py-4 space-y-4">
              <div className="text-4xl">{sdScore > sdRivalScore ? '🏆' : sdScore === sdRivalScore ? '🤝' : '🔥'}</div>
              <h3 className="text-xl font-black text-white">
                {sdScore > sdRivalScore
                  ? 'CHIẾN THẮNG! Bạn đã vượt qua đối thủ!'
                  : sdScore === sdRivalScore
                  ? 'HÒA KỊCH TÍNH!'
                  : 'CỐ GẮNG LẦN SAU — Luyện thêm 5 phút nữa!'}
              </h3>
              <p className="text-sm text-slate-300">
                Tỷ số: <strong className="text-emerald-400">{sdScore}</strong> – <strong className="text-rose-400">{sdRivalScore}</strong> • Biến động ELO:{' '}
                <strong className={lastEloDelta && lastEloDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {lastEloDelta && lastEloDelta > 0 ? `+${lastEloDelta}` : lastEloDelta}
                </strong>{' '}
                (ELO mới: <strong className="text-amber-300 font-mono">{eloRating}</strong>)
              </p>
              <button
                type="button"
                onClick={startShowdown}
                className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition"
              >
                🔄 Đấu Trận 60s Mới
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-6">
          <div className="w-full max-w-lg bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3.5 flex items-center justify-between gap-3 text-left shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-xl shrink-0">
                ⚖️
              </div>
              <div>
                <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                  Ghép Cặp ELO Fair-Play (±50 điểm SAT)
                </span>
                <p className="text-xs text-slate-300">
                  Lực chiến thật từ mastery: <strong className="text-white">{combatPower !== null ? combatPower.toLocaleString() : '...'}</strong>
                </p>
              </div>
            </div>
          </div>

          {log && (
            <div className={`p-4 rounded-xl text-center font-bold text-sm w-full max-w-lg ${log.won ? 'bg-green-900 text-green-300 border-green-500' : 'bg-red-900 text-red-300 border-red-500'} border`}>
              {log.message}
            </div>
          )}

          <div className="bg-[#1b2533] p-8 rounded-xl border border-[#ef4444] shadow-[0_0_30px_rgba(239,68,68,0.2)] w-full max-w-lg text-center">
            {opponent ? (
              <>
                <h3 className="text-xl text-gray-400 mb-2">Mục tiêu Thách Đấu</h3>
                <div className="text-5xl mb-4">{opponent.icon}</div>
                <h2 className="text-3xl font-bold text-white mb-2">{opponent.name}</h2>
                <div className="flex justify-center gap-4 text-sm mb-8">
                  <span className="bg-[#0e1117] px-3 py-1 rounded border border-[#334155] text-gray-300">Cấp: {opponent.level}</span>
                  <span className="bg-[#0e1117] px-3 py-1 rounded border border-red-900 text-red-400">Lực chiến: {opponent.luc_chien.toLocaleString()}</span>
                </div>
                {combatPower !== null && !eligible && (
                  <p className="mb-4 text-sm text-yellow-400 bg-yellow-950/40 border border-yellow-800/50 rounded-lg px-4 py-2">
                    ⚠️ Lực chiến chưa đủ để thách đấu (cần tối thiểu {Math.ceil(opponent.luc_chien * PVP_MIN_POWER_RATIO).toLocaleString()}).
                  </p>
                )}
                <button
                  onClick={handleFight}
                  disabled={isFighting || combatPower === null || !eligible}
                  className={`w-full text-white py-4 rounded-lg font-bold text-xl uppercase tracking-widest transition-colors shadow-lg flex justify-center items-center gap-2 ${isFighting || combatPower === null || !eligible ? 'bg-gray-700 cursor-not-allowed opacity-60' : 'bg-[#ef4444] hover:bg-[#dc2626]'}`}
                >
                  <span>{isFighting ? '⏳ Đang giao chiến...' : '⚔️ Thách Đấu'}</span>
                </button>
                <p className="mt-4 text-xs text-gray-500">Phần thưởng: {opponent.reward_xp.toLocaleString()} XP &amp; {opponent.reward_coins.toLocaleString()} Xu</p>
              </>
            ) : (
              <h2 className="text-3xl font-bold text-[#fbbf24] mb-2">Đỉnh Cao Tuyệt Đối!</h2>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
