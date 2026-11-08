/**
 * ============================================================================
 *  ITEM RESPONSE THEORY (IRT) 2PL ENGINE & MEMORY DECAY
 * ============================================================================
 *  Cài đặt mô hình IRT 2-Parameter Logistic (2PL) chuẩn khảo thí quốc tế:
 *    • a: Item Discrimination parameter (độ phân biệt, thường từ 0.5 - 2.5)
 *    • b: Item Difficulty parameter (độ khó, thường từ -3 đến +3)
 *    • theta (θ): Latent Ability (năng lực tiềm ẩn của thí sinh, scale [-3, 3])
 *
 *  Tính năng chính:
 *    1. Xác suất trả lời đúng 2PL: P(θ) = 1 / (1 + e^(-a(θ - b)))
 *    2. Hàm thông tin Fisher: I(θ) = a^2 * P(θ) * (1 - P(θ))
 *    3. Ước lượng năng lực EAP (Expected A Posteriori) qua tích phân số (quadrature)
 *       với tiên nghiệm chuẩn N(priorTheta, 1) và ánh xạ sang thang điểm SAT 200 - 800.
 *    4. Suy giảm trí nhớ Ebbinghaus: R = e^(-Δt / S), cập nhật độ hao mòn mastery.
 * ============================================================================
 */

export const THETA_MIN = -3.0;
export const THETA_MAX = 3.0;
export const SAT_SCORE_MIN = 200;
export const SAT_SCORE_MAX = 800;

export interface IRTItemResponse {
  /** Item Discrimination parameter (a > 0) */
  a: number;
  /** Item Difficulty parameter (b in [-3, 3]) */
  b: number;
  /** Kết quả làm bài: true nếu đúng, false nếu sai */
  correct: boolean;
}

export interface EAPResult {
  /** Năng lực tiềm ẩn ước lượng θ kẹp trong [-3, 3] */
  theta: number;
  /** Sai số chuẩn (Standard Error of Measurement - SEM) */
  se: number;
  /** Điểm quy đổi thang chuẩn SAT (200 - 800, làm tròn bậc 10) */
  satScaledScore: number;
}

/**
 * Tính xác suất thí sinh có năng lực theta trả lời đúng câu hỏi có tham số (a, b).
 * Công thức IRT 2PL: P(θ) = 1 / (1 + e^(-a(θ - b)))
 *
 * @param theta Năng lực tiềm ẩn (-3 <= θ <= 3)
 * @param a Độ phân biệt (discrimination, a > 0)
 * @param b Độ khó (difficulty)
 * @returns Xác suất P(θ) trong khoảng (0, 1)
 */
export function irtProbability(theta: number, a: number, b: number): number {
  const z = a * (theta - b);
  // Tránh tràn số (overflow/underflow) đối với exp
  if (z > 35) return 1.0;
  if (z < -35) return 0.0;
  return 1 / (1 + Math.exp(-z));
}

/**
 * Tính hàm thông tin Fisher (Fisher Information) của 1 câu hỏi tại mức năng lực θ.
 * Đạt cực đại khi θ = b (câu hỏi đo lường chính xác nhất năng lực ngang độ khó của nó).
 * Công thức: I(θ) = a^2 * P(θ) * (1 - P(θ))
 *
 * @param theta Năng lực tiềm ẩn
 * @param a Độ phân biệt
 * @param b Độ khó
 * @returns Lượng thông tin Fisher I(θ) >= 0
 */
export function irtItemInformation(theta: number, a: number, b: number): number {
  const p = irtProbability(theta, a, b);
  return a * a * p * (1 - p);
}

/**
 * Quy đổi năng lực tiềm ẩn θ [-3, 3] sang điểm chuẩn Digital SAT (200 - 800).
 * Điểm SAT Digital là bội số của 10:
 *   θ = -3.0 -> 200
 *   θ =  0.0 -> 500
 *   θ = +3.0 -> 800
 */
export function thetaToSatScore(theta: number): number {
  const clampedTheta = Math.max(THETA_MIN, Math.min(THETA_MAX, theta));
  const rawScore = 500 + clampedTheta * 100;
  const steppedScore = Math.round(rawScore / 10) * 10;
  return Math.max(SAT_SCORE_MIN, Math.min(SAT_SCORE_MAX, steppedScore));
}

/**
 * Quy đổi điểm chuẩn SAT (200 - 800) ngược lại năng lực tiềm ẩn θ [-3, 3].
 */
export function satScoreToTheta(score: number): number {
  const clamped = Math.max(SAT_SCORE_MIN, Math.min(SAT_SCORE_MAX, score));
  return Number(((clamped - 500) / 100).toFixed(3));
}

/**
 * Ước lượng năng lực tiềm ẩn θ bằng thuật toán EAP (Expected A Posteriori).
 * Sử dụng lưới cầu phương (quadrature grid) từ -4.0 đến +4.0 với phân phối tiên nghiệm
 * chuẩn Gauss N(priorTheta, 1.0) và ổn định số học bằng Log-Sum-Exp.
 *
 * @param responses Danh sách câu hỏi đã làm kèm tham số (a, b) và kết quả đúng/sai
 * @param priorTheta Năng lực giả định ban đầu (mặc định 0.0, tương ứng SAT 500)
 * @returns { theta, se, satScaledScore }
 */
export function estimateThetaEAP(
  responses: Array<{ a: number; b: number; correct: boolean }>,
  priorTheta = 0.0
): EAPResult {
  // Nếu chưa có phản hồi nào, trả về prior
  if (!responses || responses.length === 0) {
    const defaultTheta = Math.max(THETA_MIN, Math.min(THETA_MAX, priorTheta));
    return {
      theta: Number(defaultTheta.toFixed(3)),
      se: 1.0,
      satScaledScore: thetaToSatScore(defaultTheta),
    };
  }

  // Tạo lưới cầu phương (Quadrature points) từ -4.0 đến 4.0 với bước 0.1 (81 điểm)
  const QUAD_STEP = 0.1;
  const QUAD_MIN = -4.0;
  const QUAD_MAX = 4.0;
  const points: number[] = [];
  for (let q = QUAD_MIN; q <= QUAD_MAX + 1e-9; q += QUAD_STEP) {
    points.push(Number(q.toFixed(2)));
  }

  // Tiên nghiệm: phân phối chuẩn N(priorTheta, 1^2)
  const priorMean = Math.max(THETA_MIN, Math.min(THETA_MAX, priorTheta));
  const priorVar = 1.0;

  // Tính log posterior cho từng điểm cầu phương:
  // log posterior(q) = log likelihood(responses | q) + log prior(q)
  const logPosteriors: number[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const q = points[i];
    // Log prior
    const logPrior = -0.5 * Math.pow(q - priorMean, 2) / priorVar;

    // Log likelihood
    let logLikelihood = 0;
    for (const r of responses) {
      const p = irtProbability(q, r.a, r.b);
      // Giới hạn xác suất tránh log(0)
      const safeP = Math.max(1e-12, Math.min(1 - 1e-12, p));
      logLikelihood += r.correct ? Math.log(safeP) : Math.log(1 - safeP);
    }

    logPosteriors[i] = logPrior + logLikelihood;
  }

  // Ổn định số học qua Log-Sum-Exp để tính trọng số hậu nghiệm (posterior weights)
  let maxLog = -Infinity;
  for (let i = 0; i < logPosteriors.length; i++) {
    if (logPosteriors[i] > maxLog) maxLog = logPosteriors[i];
  }

  let sumWeights = 0;
  const expWeights: number[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const w = Math.exp(logPosteriors[i] - maxLog);
    expWeights[i] = w;
    sumWeights += w;
  }

  // Chuẩn hóa trọng số
  const normWeights = expWeights.map((w) => w / (sumWeights || 1));

  // Kỳ vọng hậu nghiệm: EAP(θ) = sum(w_k * q_k)
  let estimatedTheta = 0;
  for (let i = 0; i < points.length; i++) {
    estimatedTheta += normWeights[i] * points[i];
  }

  // Phương sai hậu nghiệm: Var(θ) = sum(w_k * (q_k - EAP)^2)
  let variance = 0;
  for (let i = 0; i < points.length; i++) {
    const diff = points[i] - estimatedTheta;
    variance += normWeights[i] * diff * diff;
  }
  const se = Math.sqrt(Math.max(0, variance));

  // Giới hạn theta trong thang chuẩn [-3, 3]
  const clampedTheta = Math.max(THETA_MIN, Math.min(THETA_MAX, estimatedTheta));
  const satScaledScore = thetaToSatScore(clampedTheta);

  return {
    theta: Number(clampedTheta.toFixed(3)),
    se: Number(se.toFixed(3)),
    satScaledScore,
  };
}

/**
 * Tính tỷ lệ lưu giữ trí nhớ theo đường cong quên lãng Ebbinghaus (Forgetting Curve).
 * Công thức: R = e^(-Δt / S)
 *
 * @param daysSinceLastReview Khoảng thời gian từ lần ôn tập gần nhất (ngày, >= 0)
 * @param stabilityDays Độ bền trí nhớ (stability S tính bằng ngày, mặc định 30 ngày)
 * @returns Tỷ lệ lưu giữ R trong khoảng [0, 1]
 */
export function ebbinghausRetention(daysSinceLastReview: number, stabilityDays = 30): number {
  if (daysSinceLastReview <= 0) return 1.0;
  const s = stabilityDays > 0 ? stabilityDays : 30;
  return Math.exp(-daysSinceLastReview / s);
}

/**
 * Áp dụng suy giảm trí nhớ Ebbinghaus lên điểm thành thạo (masteryScore).
 * Giúp phát hiện kỹ năng bị "nguội" để hệ thống Spaced Repetition kích hoạt nhắc nhở ôn luyện.
 *
 * @param masteryScore Điểm thành thạo hiện tại (thang 0 - 100)
 * @param daysSinceLastReview Số ngày trôi qua kể từ lần ôn tập gần nhất
 * @param stabilityDays Độ bền trí nhớ (mặc định 30 ngày)
 * @returns Điểm thành thạo sau suy giảm (đã làm tròn nguyên, [0, 100])
 */
export function applyMemoryDecay(
  masteryScore: number,
  daysSinceLastReview: number,
  stabilityDays = 30
): number {
  if (daysSinceLastReview <= 0) {
    return Math.max(0, Math.min(100, Math.round(masteryScore)));
  }
  const retention = ebbinghausRetention(daysSinceLastReview, stabilityDays);
  const decayed = Math.round(masteryScore * retention);
  return Math.max(0, Math.min(100, decayed));
}
