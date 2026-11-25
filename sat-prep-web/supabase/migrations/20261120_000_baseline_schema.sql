-- ============================================================================
-- 2026-11-20 — BASELINE SCHEMA (BOOTSTRAP-SAFE & IDEMPOTENT FOR SUPABASE PROD)
-- ============================================================================
-- Hợp nhất đầy đủ toàn bộ bảng lõi + RPC nguyên tử cần thiết cho SAT.Guru.
-- Chạy an toàn trên cả Supabase Project trắng lẫn DB đã có dữ liệu (IF NOT EXISTS).
-- Thứ tự chạy chuẩn:
--   1) 20261120_000_baseline_schema.sql
--   2) 20261121_security_and_atomic_hardening.sql
--   3) 20261121_v2_classrooms_and_cleanup.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. USER ECONOMY (server-authoritative coins, xp, inventory, quest_claims)
CREATE TABLE IF NOT EXISTS public.user_economy (
  user_id        uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins          integer     NOT NULL DEFAULT 100 CHECK (coins >= 0),
  xp             integer     NOT NULL DEFAULT 0   CHECK (xp >= 0),
  inventory      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  quest_claims   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  last_spin_date text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_economy ADD COLUMN IF NOT EXISTS quest_claims jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.user_economy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_economy_read" ON public.user_economy;
CREATE POLICY "own_economy_read" ON public.user_economy FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. USER PROGRESS (raw HMAC-signed JSON text)
CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data_json  text        NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_progress_read" ON public.user_progress;
CREATE POLICY "user_progress_read" ON public.user_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. USER MASTERY (skillId -> {score, attempts, correct, lastSeen})
CREATE TABLE IF NOT EXISTS public.user_mastery (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  skills     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_mastery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_mastery_read" ON public.user_mastery;
CREATE POLICY "own_mastery_read" ON public.user_mastery FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4. USER GOALS
CREATE TABLE IF NOT EXISTS public.user_goals (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_score integer,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_goals_read" ON public.user_goals;
CREATE POLICY "own_goals_read" ON public.user_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 5. USER AI USAGE (daily quota per user)
CREATE TABLE IF NOT EXISTS public.user_ai_usage (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  date       text        NOT NULL DEFAULT '',
  count      integer     NOT NULL DEFAULT 0,
  gen_count  integer     NOT NULL DEFAULT 0,
  chat_count integer     NOT NULL DEFAULT 0,
  tokens_in  integer     NOT NULL DEFAULT 0,
  tokens_out integer     NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_ai_usage ADD COLUMN IF NOT EXISTS gen_count  integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_ai_usage ADD COLUMN IF NOT EXISTS chat_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_ai_usage_read" ON public.user_ai_usage;
CREATE POLICY "own_ai_usage_read" ON public.user_ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 6. USER VOCAB SRS
CREATE TABLE IF NOT EXISTS public.user_vocab_srs (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  words      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_vocab_srs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_vocab_srs" ON public.user_vocab_srs;
CREATE POLICY "own_vocab_srs" ON public.user_vocab_srs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. USER MISTAKES + LEITNER SRS
CREATE TABLE IF NOT EXISTS public.user_mistakes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passage        text        NOT NULL DEFAULT '',
  question       text        NOT NULL,
  choices        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  correct_choice text        NOT NULL DEFAULT '',
  user_choice    text        NOT NULL DEFAULT '',
  explanation    text        NOT NULL DEFAULT '',
  source         text        NOT NULL DEFAULT 'Luyện AI (Next.js)',
  box            integer     NOT NULL DEFAULT 1,
  next_review    text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_mistakes ADD COLUMN IF NOT EXISTS box integer NOT NULL DEFAULT 1;
ALTER TABLE public.user_mistakes ADD COLUMN IF NOT EXISTS next_review text;
CREATE INDEX IF NOT EXISTS idx_user_mistakes_user ON public.user_mistakes(user_id, created_at DESC);
ALTER TABLE public.user_mistakes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_mistakes" ON public.user_mistakes;
CREATE POLICY "own_mistakes" ON public.user_mistakes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. TEST HISTORY
CREATE TABLE IF NOT EXISTS public.test_history (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module         text        NOT NULL DEFAULT '',
  subject        text        NOT NULL DEFAULT '',
  correct        integer     NOT NULL DEFAULT 0,
  total          integer     NOT NULL DEFAULT 0,
  score          integer     NOT NULL DEFAULT 0,
  test_timestamp numeric     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_test_history_user ON public.test_history(user_id, created_at DESC);
ALTER TABLE public.test_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_test_history" ON public.test_history;
CREATE POLICY "own_test_history" ON public.test_history FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. ISSUED QUESTIONS (server-authoritative anti-cheat grading)
CREATE TABLE IF NOT EXISTS public.issued_questions (
  id             text        PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  correct_choice text        NOT NULL,
  difficulty     text        NOT NULL DEFAULT 'Medium',
  domain         text,
  skill_id       text,
  explanation    text,
  explanation_vi text,
  choice_analysis jsonb,
  trap_label     text,
  answered       boolean     NOT NULL DEFAULT false,
  is_correct     boolean,
  source         text,
  expires_at     timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_issued_questions_user ON public.issued_questions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issued_questions_exp  ON public.issued_questions(expires_at);
ALTER TABLE public.issued_questions ENABLE ROW LEVEL SECURITY;

-- 10. AI COST LEDGER (global daily budget kill-switch)
CREATE TABLE IF NOT EXISTS public.ai_cost_ledger (
  ledger_date text        PRIMARY KEY,
  calls       integer     NOT NULL DEFAULT 0,
  tokens_in   bigint      NOT NULL DEFAULT 0,
  tokens_out  bigint      NOT NULL DEFAULT 0,
  cost_usd    numeric     NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_cost_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_cost_ledger" ON public.ai_cost_ledger;
CREATE POLICY "auth_read_cost_ledger" ON public.ai_cost_ledger FOR SELECT TO authenticated USING (true);

-- 11. AI CHAT CACHE (shared Socratic response cache)
CREATE TABLE IF NOT EXISTS public.ai_chat_cache (
  cache_hash  text        PRIMARY KEY,
  question_id text,
  user_query  text        NOT NULL,
  ai_response text        NOT NULL,
  hit_count   integer     NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_chat_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_chat_cache" ON public.ai_chat_cache;
CREATE POLICY "auth_read_chat_cache" ON public.ai_chat_cache FOR SELECT TO authenticated USING (true);

-- 12. QUESTIONS BANK (shared pool)
CREATE TABLE IF NOT EXISTS public.questions (
  id              text        PRIMARY KEY,
  subject         text        NOT NULL,
  topic           text        NOT NULL,
  difficulty      text        NOT NULL,
  skill_id        text,
  question_text   text        NOT NULL,
  passage         text,
  choices         jsonb       NOT NULL,
  correct_choice  text        NOT NULL,
  explanation     text        NOT NULL,
  explanation_vi  text,
  choice_analysis jsonb,
  trap_label      text,
  usage_count     integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS skill_id text;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_questions" ON public.questions;
CREATE POLICY "auth_read_questions" ON public.questions FOR SELECT TO authenticated USING (true);

-- 13. USER SUBSCRIPTIONS (commercial tier entitlements)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier       text        NOT NULL CHECK (tier IN ('pro', 'premium', 'ultimate')),
  period     text        NOT NULL CHECK (period IN ('monthly', 'quarterly', 'semiannual', 'yearly')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_subscriptions_select_own" ON public.user_subscriptions;
CREATE POLICY "user_subscriptions_select_own" ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 14. PAYMENT TRANSACTIONS (single source of truth for revenue & webhooks)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  order_id       text        PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gateway        text        NOT NULL CHECK (gateway IN ('vnpay', 'momo', 'payos', 'stripe', 'manual')),
  tier           text        NOT NULL CHECK (tier IN ('pro', 'premium', 'ultimate')),
  period         text        NOT NULL CHECK (period IN ('monthly', 'quarterly', 'semiannual', 'yearly')),
  amount_vnd     integer     NOT NULL CHECK (amount_vnd >= 0),
  duration_days  integer     NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  status         text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded')),
  gateway_txn_id text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  paid_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_payment_tx_user ON public.payment_transactions(user_id, created_at DESC);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_tx_select_own" ON public.payment_transactions;
CREATE POLICY "payment_tx_select_own" ON public.payment_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 15. USER PROFILES, ROLES, AUDIT LOGS, PARENT SHARE, REDEMPTIONS
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  school_name  text,
  target_uni   text,
  avatar_url   text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS school_name text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS target_uni  text;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_profiles_own" ON public.user_profiles;
CREATE POLICY "user_profiles_own" ON public.user_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor       text        NOT NULL,
  action      text        NOT NULL,
  target_id   text        NOT NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.parent_share_codes (
  code       text        PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
ALTER TABLE public.parent_share_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parent_share_own" ON public.parent_share_codes;
CREATE POLICY "parent_share_own" ON public.parent_share_codes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id    text        NOT NULL,
  reward_name  text        NOT NULL,
  cost_coins   integer     NOT NULL CHECK (cost_coins > 0),
  status       text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled', 'rejected')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz
);
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reward_redemptions_select_own" ON public.reward_redemptions;
CREATE POLICY "reward_redemptions_select_own" ON public.reward_redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 16. AUXILIARY TRACKING TABLES (snapshots, streaks, cosmetics, plans)
CREATE TABLE IF NOT EXISTS public.daily_snapshots (
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snap_date       text        NOT NULL,
  predicted_score integer,
  math_score      integer,
  rw_score        integer,
  payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, snap_date)
);
ALTER TABLE public.daily_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_snapshots_own" ON public.daily_snapshots;
CREATE POLICY "daily_snapshots_own" ON public.daily_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_daily_activity (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day        text        NOT NULL,
  answers    integer     NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.user_daily_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_daily_activity_own" ON public.user_daily_activity;
CREATE POLICY "user_daily_activity_own" ON public.user_daily_activity
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_answer_streak (
  user_id        uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak integer     NOT NULL DEFAULT 0,
  best_streak    integer     NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_answer_streak ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_answer_streak_own" ON public.user_answer_streak;
CREATE POLICY "user_answer_streak_own" ON public.user_answer_streak
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_cosmetics (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  equipped   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  unlocked   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_cosmetics_own" ON public.user_cosmetics;
CREATE POLICY "user_cosmetics_own" ON public.user_cosmetics
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_plans (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_json  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_plans_own" ON public.user_plans;
CREATE POLICY "user_plans_own" ON public.user_plans
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 17. ATOMIC RPC: confirm_payment (lock order row + upsert subscription atomically)
CREATE OR REPLACE FUNCTION public.confirm_payment(
  p_order_id       text,
  p_gateway_txn_id text,
  p_amount_vnd     integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx      public.payment_transactions%ROWTYPE;
  v_now     timestamptz := now();
  v_cur_exp timestamptz;
  v_base    timestamptz;
  v_new_exp timestamptz;
BEGIN
  SELECT * INTO v_tx
    FROM public.payment_transactions
   WHERE order_id = p_order_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_tx.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_confirmed', true, 'order_id', p_order_id);
  END IF;

  IF v_tx.status IN ('cancelled', 'refunded') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_closed', 'status', v_tx.status);
  END IF;

  IF p_amount_vnd IS NOT NULL AND p_amount_vnd <> v_tx.amount_vnd THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch', 'expected', v_tx.amount_vnd, 'received', p_amount_vnd);
  END IF;

  UPDATE public.payment_transactions
     SET status = 'paid',
         gateway_txn_id = p_gateway_txn_id,
         paid_at = v_now
   WHERE order_id = p_order_id;

  SELECT expires_at INTO v_cur_exp
    FROM public.user_subscriptions
   WHERE user_id = v_tx.user_id;

  IF v_cur_exp IS NOT NULL AND v_cur_exp > v_now THEN
    v_base := v_cur_exp;
  ELSE
    v_base := v_now;
  END IF;

  v_new_exp := v_base + make_interval(days => GREATEST(1, COALESCE(v_tx.duration_days, 30)));

  INSERT INTO public.user_subscriptions (user_id, tier, period, started_at, expires_at, updated_at)
  VALUES (v_tx.user_id, v_tx.tier, v_tx.period, v_now, v_new_exp, v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET tier       = CASE WHEN user_subscriptions.tier = 'ultimate' AND user_subscriptions.expires_at > v_now THEN 'ultimate' ELSE EXCLUDED.tier END,
        period     = EXCLUDED.period,
        expires_at = EXCLUDED.expires_at,
        updated_at = v_now;

  RETURN jsonb_build_object(
    'ok', true,
    'already_confirmed', false,
    'order_id', p_order_id,
    'user_id', v_tx.user_id,
    'tier', v_tx.tier,
    'expires_at', v_new_exp
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_payment(text, text, integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.confirm_payment(text, text, integer) TO service_role;

-- 18. ATOMIC RPC: increment_ai_cost_ledger
CREATE OR REPLACE FUNCTION public.increment_ai_cost_ledger(
  p_date       text,
  p_tokens_in  bigint,
  p_tokens_out bigint,
  p_cost_usd   numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_cost_ledger (ledger_date, calls, tokens_in, tokens_out, cost_usd, updated_at)
  VALUES (p_date, 1, GREATEST(0, p_tokens_in), GREATEST(0, p_tokens_out), GREATEST(0, p_cost_usd), now())
  ON CONFLICT (ledger_date) DO UPDATE
    SET calls      = ai_cost_ledger.calls + 1,
        tokens_in  = ai_cost_ledger.tokens_in + GREATEST(0, p_tokens_in),
        tokens_out = ai_cost_ledger.tokens_out + GREATEST(0, p_tokens_out),
        cost_usd   = ai_cost_ledger.cost_usd + GREATEST(0, p_cost_usd),
        updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_ai_cost_ledger(text, bigint, bigint, numeric) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_ai_cost_ledger(text, bigint, bigint, numeric) TO service_role;
