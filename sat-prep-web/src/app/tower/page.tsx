'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';

const MAX_SHIELDS = 3;
const CHECKPOINT_STORAGE_KEY = 'sat_tower_checkpoint_v1';
const HIGHEST_FLOOR_STORAGE_KEY = 'sat_tower_highest_floor_v1';

export default function TowerPage() {
  const { showToast } = useToast();
  const [currentFloor, setCurrentFloor] = useState(1);
  const [shields, setShields] = useState(MAX_SHIELDS);
  const [savedCheckpoint, setSavedCheckpoint] = useState(1);
  const [highestFloor, setHighestFloor] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [questionData, setQuestionData] = useState<PracticeQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [lastAnswerWasCorrect, setLastAnswerWasCorrect] = useState<boolean | null>(null);

  // Khôi phục Checkpoint và Kỷ lục từ localStorage khi mount
  useEffect(() => {
    try {
      const storedCheckpoint = localStorage.getItem(CHECKPOINT_STORAGE_KEY);
      if (storedCheckpoint) {
        const cp = parseInt(storedCheckpoint, 10);
        if (!isNaN(cp) && cp >= 1) {
          setSavedCheckpoint(cp);
        }
      }

      const storedHighest = localStorage.getItem(HIGHEST_FLOOR_STORAGE_KEY);
      if (storedHighest) {
        const hf = parseInt(storedHighest, 10);
        if (!isNaN(hf) && hf >= 1) {
          setHighestFloor(hf);
        }
      }
    } catch (e) {
      console.error('Error loading tower checkpoint:', e);
    }
  }, []);

  // Tính toán và cập nhật Checkpoint mỗi 5 tầng (5, 10, 15, 20, 25...)
  const checkAndUpdateCheckpoint = (floor: number) => {
    let unlockedCp = 1;
    if (floor >= 25) unlockedCp = 25;
    else if (floor >= 20) unlockedCp = 20;
    else if (floor >= 15) unlockedCp = 15;
    else if (floor >= 10) unlockedCp = 10;
    else if (floor >= 5) unlockedCp = 5;

    if (unlockedCp > savedCheckpoint) {
      setSavedCheckpoint(unlockedCp);
      try {
        localStorage.setItem(CHECKPOINT_STORAGE_KEY, unlockedCp.toString());
      } catch (e) {
        console.error(e);
      }
      showToast(`🚩 XUẤT SẮC! Mở khóa Mốc Lưu Tầng (Checkpoint) TẦNG ${unlockedCp}!`, 'success');
    }

    if (floor > highestFloor) {
      setHighestFloor(floor);
      try {
        localStorage.setItem(HIGHEST_FLOOR_STORAGE_KEY, floor.toString());
      } catch (e) {
        console.error(e);
      }
    }
  };

  const generateFloorQuestion = async (floor: number) => {
    setIsLoading(true);
    setQuestionData(null);
    setLastAnswerWasCorrect(null);
    try {
      // Server tự chọn skill + độ khó theo MASTERY thật của user (adaptive) và
      // sinh câu qua generate-practice. Câu trả về mang skillId thật → ghi mastery
      // đúng skill (xem /api/tower/question).
      const res = await fetch(`/api/tower/question?floor=${floor}`);

      if (res.ok) {
        const data = await res.json();
        setQuestionData(data);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err?.error ?? "Thất bại khi gọi quái vật (API Error).", 'error');
        setIsPlaying(false);
      }
    } catch (e) {
      console.error(e);
      showToast('Lỗi kết nối khi triệu hồi câu hỏi. Vui lòng thử lại.', 'error');
      setIsPlaying(false);
    }
    setIsLoading(false);
  };

  const startRun = (fromFloor: number = 1) => {
    setIsPlaying(true);
    setCurrentFloor(fromFloor);
    setShields(MAX_SHIELDS);
    setIsGameOver(false);
    setLastAnswerWasCorrect(null);
    checkAndUpdateCheckpoint(fromFloor);
    generateFloorQuestion(fromFloor);
  };

  const handleAnswerResult = (isCorrect: boolean) => {
    setLastAnswerWasCorrect(isCorrect);

    if (!isCorrect) {
      const remainingShields = shields - 1;
      setShields(remainingShields);

      if (remainingShields <= 0) {
        setIsGameOver(true);
        setIsPlaying(false);
        showToast(`💥 Khiên Hộ Mệnh cuối cùng đã vỡ! Bạn đã gục ngã tại Tầng ${currentFloor}.`, 'error');
      } else {
        showToast(
          `🛡️ Bạn trả lời chưa chuẩn và mất 1 Khiên! Còn ${remainingShields}/${MAX_SHIELDS} Khiên. Giữ vững Tầng ${currentFloor} để làm câu thử thách tiếp theo!`, 
          'info'
        );
      }
    } else {
      showToast(`✨ CHÍNH XÁC! Chuẩn bị chinh phục nấc thang tiếp theo!`, 'success');
    }
  };

  const handleNextQuestion = () => {
    if (lastAnswerWasCorrect) {
      // Đúng -> Tiến lên tầng kế tiếp
      const nextFloor = currentFloor + 1;
      setCurrentFloor(nextFloor);
      checkAndUpdateCheckpoint(nextFloor);
      generateFloorQuestion(nextFloor);
    } else {
      // Sai nhưng vẫn còn khiên -> Giữ tầng hiện tại và gọi câu hỏi mới cho tầng này
      showToast(`🔄 Đang triệu hồi câu hỏi thử thách khác cho Tầng ${currentFloor}...`, 'info');
      generateFloorQuestion(currentFloor);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 max-w-5xl mx-auto px-4">
      {/* Header Tháp Vô Tận */}
      <div 
        className="math-academy-header epic-shake-active relative overflow-hidden rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-2xl" 
        style={{ background: "linear-gradient(135deg, #020617 0%, #1e1b4b 50%, #0f172a 100%)" }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="math-title-container flex items-center gap-4">
            <div className="math-icon text-5xl">🗼</div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-500/40 text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">
                <span>🛡️ ROGUELIKE CỨU SINH 3 KHIÊN + CHECKPOINT</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-indigo-200 to-indigo-400">
                THÁP VÔ TẬN (ENDLESS TOWER)
              </h1>
              <p className="text-gray-300 text-sm mt-1">
                Hệ thống 3 Khiên Hộ Mệnh 🛡️ & Mốc Checkpoint mỗi 5 tầng — Xóa tan ức chế làm lại từ đầu!
              </p>
            </div>
          </div>

          {/* Badge Kỷ lục & Checkpoint */}
          <div className="flex items-center gap-3 bg-slate-900/90 border border-indigo-500/30 p-3.5 rounded-xl shadow-lg">
            <div className="text-center px-2 border-r border-gray-700">
              <div className="text-[10px] text-gray-400 font-bold uppercase">Kỷ Lục</div>
              <div className="text-xl font-black text-amber-400">Tầng {highestFloor}</div>
            </div>
            <div className="text-center px-2">
              <div className="text-[10px] text-indigo-300 font-bold uppercase">Mốc Lưu (Checkpoint)</div>
              <div className="text-xl font-black text-indigo-400">Tầng {savedCheckpoint}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Màn hình khởi đầu (Start Screen) */}
      {!isPlaying && !isGameOver && (
        <div className="text-center p-8 sm:p-12 bg-[#0e1117] rounded-2xl border border-[#334155] shadow-xl space-y-6">
          <div className="text-6xl animate-pulse">⛩️</div>
          
          <div className="max-w-xl mx-auto space-y-3">
            <h2 className="text-2xl font-black text-white">CHẾ ĐỘ LEO THÁP SINH TỒN THÍCH ỨNG</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              AI liên tục triệu hồi câu hỏi nhắm thẳng vào các kỹ năng SAT cần gia cố nhất của bạn. Leo càng cao, độ khó và phần thưởng kinh nghiệm càng bùng nổ!
            </p>
          </div>

          {/* Cơ chế bảo hiểm 3 Khiên & Checkpoint */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto text-left">
            <div className="bg-[#1b2533] p-4 rounded-xl border border-indigo-500/30">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm mb-1">
                <span>🛡️</span> 3 Khiên Hộ Mệnh:
              </div>
              <p className="text-xs text-gray-300">
                Trả lời sai chỉ mất 1 Khiên và được giữ nguyên tầng để giải lại câu biến thể mới. Chỉ game over khi mất hết cả 3 Khiên!
              </p>
            </div>
            <div className="bg-[#1b2533] p-4 rounded-xl border border-emerald-500/30">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1">
                <span>🚩</span> Checkpoint Mỗi 5 Tầng:
              </div>
              <p className="text-xs text-gray-300">
                Chạm mốc Tầng 5, 10, 15, 20... tiến trình tự động lưu vĩnh viễn. Khi thất bại có thể hồi sinh ngay từ Checkpoint gần nhất!
              </p>
            </div>
          </div>

          {/* Dải Checkpoint trực quan */}
          <div className="bg-[#111827] p-4 rounded-xl border border-gray-800 max-w-xl mx-auto">
            <div className="text-xs text-gray-400 font-bold uppercase mb-2 flex justify-between">
              <span>Hệ Thống Mốc Checkpoint:</span>
              <span className="text-indigo-400">Mốc của bạn: Tầng {savedCheckpoint}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold gap-1 overflow-x-auto py-1">
              {[1, 5, 10, 15, 20, 25].map((cpFloor) => {
                const isUnlocked = savedCheckpoint >= cpFloor;
                return (
                  <div 
                    key={cpFloor} 
                    className={`flex-1 min-w-[65px] py-1.5 px-1 rounded-lg text-center border transition-all ${
                      isUnlocked 
                        ? 'bg-indigo-950/80 border-indigo-500/60 text-indigo-300 shadow-sm' 
                        : 'bg-gray-900 border-gray-800 text-gray-600'
                    }`}
                  >
                    <div>{isUnlocked ? (cpFloor === 1 ? '🏁' : '🚩') : '🔒'}</div>
                    <div className="text-[10px] mt-0.5">T.{cpFloor}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Các nút Bắt đầu */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            {savedCheckpoint > 1 && (
              <button
                onClick={() => startRun(savedCheckpoint)}
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black text-lg px-8 py-3.5 rounded-full shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-transform hover:scale-105 flex items-center justify-center gap-2"
              >
                <span>🚀</span> TIẾP TỤC TỪ CHECKPOINT TẦNG {savedCheckpoint}
              </button>
            )}

            <button 
              onClick={() => startRun(1)} 
              className={`w-full sm:w-auto ${
                savedCheckpoint > 1 
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 text-sm px-6 py-3.5 rounded-full' 
                  : 'bg-red-600 hover:bg-red-500 text-white font-black text-xl px-12 py-4 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] hover:scale-105'
              } transition-all`}
            >
              {savedCheckpoint > 1 ? '🔄 Bắt Đầu Lại Từ Tầng 1' : 'BƯỚC VÀO THÁP VÔ TẬN'}
            </button>
          </div>
        </div>
      )}

      {/* Màn hình Game Over */}
      {isGameOver && (
        <div className="text-center p-8 sm:p-12 bg-[#450a0a]/90 rounded-2xl border border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.35)] space-y-6">
          <div className="text-5xl animate-bounce">🛡️💥</div>
          <div>
            <h2 className="text-4xl font-black text-red-500 mb-2">HẾT KHIÊN HỘ MỆNH!</h2>
            <p className="text-xl text-white">
              Bạn đã dừng chân tại <span className="font-bold text-yellow-400">Tầng {currentFloor}</span>.
            </p>
            {currentFloor >= highestFloor && currentFloor > 1 && (
              <p className="text-sm text-amber-300 font-bold mt-2">🎉 ĐÂY LÀ KỶ LỤC MỚI CỦA BẠN!</p>
            )}
          </div>

          <div className="bg-[#1e0808] p-4 rounded-xl border border-red-800 max-w-md mx-auto text-sm text-gray-300">
            <div className="flex justify-between items-center py-1">
              <span>Mốc Lưu Tầng (Checkpoint) sẵn sàng:</span>
              <span className="font-bold text-indigo-400">Tầng {savedCheckpoint}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-t border-red-900/50 mt-1">
              <span>Trạng thái khiên lượt mới:</span>
              <span className="font-bold text-emerald-400">Đầy đủ 3/3 Khiên 🛡️</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {savedCheckpoint > 1 && (
              <button
                onClick={() => startRun(savedCheckpoint)}
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2"
              >
                <span>🚀</span> Hồi Sinh Tại Checkpoint Tầng {savedCheckpoint}
              </button>
            )}
            <button 
              onClick={() => startRun(1)} 
              className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-white font-bold px-8 py-3.5 rounded-xl border border-gray-600 transition"
            >
              Chơi Lại Từ Tầng 1
            </button>
          </div>
        </div>
      )}

      {/* Giao diện đang leo tháp */}
      {isPlaying && (
        <>
          {/* Thanh trạng thái leo tháp: Tầng Hiện Tại + 3 Khiên + Nút Thoát */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1b2533] p-4 rounded-xl border border-[#262730] shadow-md">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-gray-400 text-xs uppercase font-bold tracking-wider">Đang Leo:</span>
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-amber-400">
                  TẦNG {currentFloor}
                </h2>
              </div>

              {/* 3 Khiên Hộ Mệnh */}
              <div className="bg-[#0f172a] px-3.5 py-1.5 rounded-xl border border-gray-700 flex items-center gap-2">
                <span className="text-xs font-bold text-gray-300">Khiên Hộ Mệnh:</span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3].map((shieldIndex) => {
                    const isShieldActive = shields >= shieldIndex;
                    return (
                      <span 
                        key={shieldIndex}
                        className={`text-lg transition-transform duration-300 ${
                          isShieldActive 
                            ? 'opacity-100 scale-100 filter drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]' 
                            : 'opacity-30 grayscale scale-75'
                        }`}
                        title={isShieldActive ? `Khiên ${shieldIndex}: Đang bảo vệ` : `Khiên ${shieldIndex}: Đã vỡ`}
                      >
                        {isShieldActive ? '🛡️' : '💔'}
                      </span>
                    );
                  })}
                </div>
                <span className="text-xs font-bold font-mono text-indigo-300">({shields}/3)</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {currentFloor % 5 === 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-500/40 animate-pulse">
                  🚩 Đang ở Mốc Checkpoint Tầng {currentFloor}!
                </span>
              )}
              <button 
                onClick={() => { setIsPlaying(false); setIsGameOver(false); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Thoát (Bảo Toàn Mạng)
              </button>
            </div>
          </div>

          {/* Cảnh báo khi chỉ còn 1 khiên */}
          {shields === 1 && (
            <div className="bg-red-950/70 border border-red-500/50 text-red-300 px-4 py-2 rounded-xl text-xs flex items-center gap-2 animate-pulse">
              <span>⚠️</span>
              <span><strong>CẢNH BÁO NGUY HIỂM:</strong> Bạn chỉ còn 1 Khiên duy nhất! Nếu trả lời sai thêm một lần nữa, lượt leo tháp sẽ kết thúc.</span>
            </div>
          )}
          
          {(isLoading || questionData) && (
            <div className="relative">
              <div className="bg-[#0e1117] p-6 rounded-2xl border border-indigo-500/30 shadow-xl mb-6">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4 pb-3 border-b border-gray-800">
                  <p className="text-indigo-300 font-bold text-sm flex items-center gap-2">
                    <span>⚔️</span> Quái vật Tầng {currentFloor} — Kỹ năng thích ứng theo lỗ hổng kiến thức thực tế.
                  </p>
                  <span className="text-xs text-gray-400">
                    Checkpoint kế tiếp: <strong className="text-indigo-300">Tầng {Math.ceil((currentFloor + 1) / 5) * 5}</strong>
                  </span>
                </div>

                <CorePracticeUI
                  questionData={questionData as PracticeQuestion}
                  isLoading={isLoading}
                  onAnswer={handleAnswerResult}
                  onNext={handleNextQuestion} 
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Điều hướng nhanh sang Boss & Quests */}
      <div className="pt-6 border-t border-gray-800 flex flex-wrap items-center justify-between text-xs text-gray-400 gap-4">
        <div>
          Luyện chán Tháp Vô Tận? Hãy thử sức với 8 Đại Boss học thuật:
        </div>
        <div className="flex items-center gap-3">
          <Link href="/boss" className="text-red-400 hover:text-red-300 font-bold underline flex items-center gap-1">
            <span>⚔️</span> Đấu Trường Boss (/boss)
          </Link>
          <span>•</span>
          <Link href="/quests" className="text-blue-400 hover:text-blue-300 font-bold underline flex items-center gap-1">
            <span>📜</span> Sổ Tay Nhiệm Vụ (/quests)
          </Link>
        </div>
      </div>
    </div>
  );
}
