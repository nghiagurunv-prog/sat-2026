import type { Difficulty } from './mastery';

/**
 * ============================================================================
 *  MISTAKE → BIẾN THỂ (Variant) — Nâng cấp V2 (Mục #14):
 *  Leitner-Box-Aware Difficulty Calibration + Targeted Trap-Replication
 * ============================================================================
 *  ⚠️ THUẦN (pure) — chỉ import TYPE Difficulty, không import value chéo .ts
 *  để chạy trực tiếp với `node:test` (< 5ms).
 * ============================================================================
 */

export type TrapType =
  | 'too-broad'
  | 'extreme'
  | 'opposite'
  | 'word-matching'
  | 'sign-error'
  | 'unit-trap'
  | 'formula-misuse'
  | 'time-trap'
  | (string & {});

/** Thông tin skill tối thiểu cần để dựng câu biến thể (từ getSkill). */
export interface SkillLike {
  id: string;
  /** moduleType để gọi /api/generate-practice (math/literature/vocab). */
  moduleType: string;
  /** Nhãn skill — dùng làm topic cho prompt AI bám đúng dạng. */
  label: string;
}

export interface VariantBuildOptions {
  /** Hộp SRS Leitner (1..5) của câu sai */
  leitnerBox?: number;
  /** Loại bẫy College Board học sinh vừa mắc phải */
  targetTrapType?: TrapType;
  /** Đáp án nhiễu học sinh đã chọn sai trước đó */
  userWrongChoice?: string;
}

export interface VariantRequest {
  /** skillId gốc — echo lại để câu biến thể ghi mastery đúng chỗ. */
  skillId: string;
  /** moduleType để gọi /api/generate-practice. */
  moduleType: string;
  /** topic = nhãn skill. */
  topic: string;
  /** Độ khó theo ZPD đã hiệu chỉnh theo hộp Leitner (nếu có). */
  difficulty: Difficulty;
  /** Hộp Leitner gốc (1..5) nếu truyền vào */
  leitnerBox?: number;
  /** Bẫy tư duy mục tiêu cần tái tạo trong đáp án nhiễu */
  targetTrapType?: TrapType;
  /** Đáp án sai cũ của học sinh */
  userWrongChoice?: string;
  /** Chỉ dẫn prompt tái tạo bẫy gửi sang AI generator */
  trapPromptHint?: string;
}

const TRAP_PROMPT_DESCRIPTIONS: Record<string, string> = {
  'too-broad': 'Thiết kế 1 phương án nhiễu kiểu Too-Broad (suy diễn quá rộng vượt phạm vi đoạn văn).',
  extreme: 'Thiết kế 1 phương án nhiễu dùng từ tuyệt đối hóa (always, never, solely, completely).',
  opposite: 'Thiết kế 1 phương án nhiễu đảo ngược quan hệ nhân-quả hoặc trái chiều lập luận gốc.',
  'word-matching': 'Thiết kế 1 phương án nhiễu lặp lại từ khóa trong bài nhưng sai logic câu hỏi.',
  'sign-error': 'Thiết kế 1 phương án nhiễu tương ứng với lỗi quên đổi dấu âm/dương khi chuyển vế.',
  'unit-trap': 'Thiết kế 1 phương án nhiễu đánh bẫy đổi đơn vị hoặc hỏi đại lượng phái sinh (vd hỏi 2x+1 thay vì x).',
  'formula-misuse': 'Thiết kế 1 phương án nhiễu sinh ra từ nhầm công thức (vd bán kính vs đường kính, đỉnh vs nghiệm).',
  'time-trap': 'Thiết kế câu hỏi có đường tắt giải nhanh 15s (Desmos hoặc nhận diện cấu trúc) bên cạnh lối tính dài dòng.',
};

/**
 * Hiệu chỉnh độ khó câu biến thể theo hộp SRS Leitner (Mục #14):
 * - Box 1 (mới sai / 1 ngày): hạ trần về Medium (hoặc giữ Easy) để củng cố nền tảng.
 * - Box 2–3 (2–4 ngày): tối thiểu Medium, giữ Hard nếu mastery đã cao.
 * - Box 4–5 (7–14 ngày): bắt buộc Hard để kiểm chứng học sinh thực sự hóa giải được bẫy.
 */
export function calibrateDifficultyByLeitner(
  baseDifficulty: Difficulty,
  leitnerBox?: number
): Difficulty {
  if (typeof leitnerBox !== 'number' || !Number.isFinite(leitnerBox)) {
    return baseDifficulty;
  }
  const box = Math.max(1, Math.min(5, Math.round(leitnerBox)));
  if (box === 1) {
    return baseDifficulty === 'Hard' ? 'Medium' : baseDifficulty;
  }
  if (box === 2 || box === 3) {
    return baseDifficulty === 'Easy' ? 'Medium' : baseDifficulty;
  }
  return 'Hard';
}

/**
 * Dựng payload gọi generate-practice cho một BIẾN THỂ của skill đã làm sai.
 * Hoàn toàn tương thích ngược khi gọi 2 tham số `buildVariantRequest(skill, difficulty)`.
 */
export function buildVariantRequest(
  skill: SkillLike | undefined | null,
  difficulty: Difficulty,
  options?: VariantBuildOptions
): VariantRequest | null {
  if (!skill) return null;

  const calibratedDifficulty =
    typeof options?.leitnerBox === 'number' && Number.isFinite(options.leitnerBox)
      ? calibrateDifficultyByLeitner(difficulty, options.leitnerBox)
      : difficulty;

  const result: VariantRequest = {
    skillId: skill.id,
    moduleType: skill.moduleType,
    topic: skill.label,
    difficulty: calibratedDifficulty,
  };

  if (typeof options?.leitnerBox === 'number' && Number.isFinite(options.leitnerBox)) {
    result.leitnerBox = Math.max(1, Math.min(5, Math.round(options.leitnerBox)));
  }
  if (options?.targetTrapType) {
    result.targetTrapType = options.targetTrapType;
    const baseDesc =
      TRAP_PROMPT_DESCRIPTIONS[options.targetTrapType] ??
      `Thiết kế 1 phương án nhiễu tái tạo đúng bẫy tư duy loại "${options.targetTrapType}".`;
    result.trapPromptHint = options.userWrongChoice
      ? `${baseDesc} (Học sinh từng chọn nhầm phương án: ${options.userWrongChoice}).`
      : baseDesc;
  }
  if (options?.userWrongChoice) {
    result.userWrongChoice = options.userWrongChoice;
  }

  return result;
}
