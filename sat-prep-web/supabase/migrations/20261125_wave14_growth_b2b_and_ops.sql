-- ============================================================================
-- MIGRATION ĐỢT 14 (2026-11-25): Growth, Anti-Cheat, Freeze, B2B2C & Admin Config
-- Idempotent 100% — có guard to_regclass chống lỗi 42P01 trên môi trường mới.
-- ============================================================================

-- 1. Bảo lưu gói học 7-14 ngày mùa thi học kỳ (#25)
DO $$
BEGIN
  IF to_regclass('public.user_subscriptions') IS NOT NULL THEN
    ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS freeze_used boolean NOT NULL DEFAULT false;
    ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS frozen_from timestamptz;
    ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS frozen_until timestamptz;
    ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS frozen_days integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. Mở rộng payment_transactions cho Sprint/Squad Packs (#21, #23) & Abandoned Recovery (#26)
DO $$
BEGIN
  IF to_regclass('public.payment_transactions') IS NOT NULL THEN
    ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS plan_id text;
    ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS seats integer NOT NULL DEFAULT 1;
    ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS recovery_notified_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_payment_tx_pending_recovery
      ON public.payment_transactions (status, created_at)
      WHERE status = 'pending';
  END IF;
END $$;

-- 3. Mở rộng classroom_assignments cho Giao Đề Full Mock Adaptive có khung giờ (#36)
DO $$
BEGIN
  IF to_regclass('public.classroom_assignments') IS NOT NULL THEN
    ALTER TABLE public.classroom_assignments ADD COLUMN IF NOT EXISTS assignment_type text NOT NULL DEFAULT 'drill';
    ALTER TABLE public.classroom_assignments ADD COLUMN IF NOT EXISTS exam_id text;
    ALTER TABLE public.classroom_assignments ADD COLUMN IF NOT EXISTS window_start timestamptz;
    ALTER TABLE public.classroom_assignments ADD COLUMN IF NOT EXISTS window_end timestamptz;
  END IF;
END $$;

-- 4. Bảng báo lỗi câu hỏi từ học sinh đẩy về hàng đợi Admin (#10)
CREATE TABLE IF NOT EXISTS public.question_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  question_id text NOT NULL,
  skill_id text,
  subject text DEFAULT 'Math',
  stem_preview text DEFAULT '',
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  admin_note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_question_reports_status_created
  ON public.question_reports (status, created_at DESC);

ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS question_reports_insert_auth ON public.question_reports;
CREATE POLICY question_reports_insert_auth ON public.question_reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Bảng thưởng Xu học thuật cho Mã giới thiệu bạn bè (#24 — chống claim trùng)
CREATE TABLE IF NOT EXISTS public.referral_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_code text NOT NULL,
  referrer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referee_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  coins_awarded integer NOT NULL DEFAULT 300,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_claims_referrer ON public.referral_claims (referrer_user_id);
ALTER TABLE public.referral_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS referral_claims_self_select ON public.referral_claims;
CREATE POLICY referral_claims_self_select ON public.referral_claims
  FOR SELECT USING (auth.uid() = referee_user_id OR auth.uid() = referrer_user_id);

-- 6. Bảng đăng ký dùng thử Trung tâm 14 ngày tự động (B2B Trial #39)
CREATE TABLE IF NOT EXISTS public.b2b_trial_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  center_name text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL,
  email text DEFAULT '',
  seat_limit integer NOT NULL DEFAULT 10,
  demo_classroom_code text,
  trial_expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.b2b_trial_requests ENABLE ROW LEVEL SECURITY;

-- 7. Bảng cấu hình động Điểm chuẩn Đại học VN & Học bổng quản trị từ /admin (#40)
CREATE TABLE IF NOT EXISTS public.app_dynamic_config (
  key text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_by text DEFAULT 'admin',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_dynamic_config ENABLE ROW LEVEL SECURITY;

-- 8. Bảng nhật ký phát hiện bất thường BXH / Speed Quiz (#16)
CREATE TABLE IF NOT EXISTS public.speed_quiz_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id text,
  difficulty text,
  time_spent_ms integer NOT NULL,
  tab_switches integer NOT NULL DEFAULT 0,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_speed_quiz_anomalies_user ON public.speed_quiz_anomalies (user_id, created_at DESC);
ALTER TABLE public.speed_quiz_anomalies ENABLE ROW LEVEL SECURITY;
