-- ============================================================================
-- 2026-11-28 — UNIFIED WALLET & 4-APP ENTITLEMENTS (aionthi.com Ecosystem)
-- ============================================================================
-- Cho phép học sinh/phụ huynh tạo 1 tài khoản duy nhất, nạp tiền VNĐ vào Ví
-- chung qua PayOS/Stripe rồi mua bất kỳ gói nào của 4 app (SAT, IELTS, THCS,
-- THPT hoặc Combo 4 App) bằng 1 chạm nguyên tử (FOR UPDATE).
-- 100% Idempotent & Server-Authoritative (client chỉ SELECT own, cấm tự ghi).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. VÍ TIỀN CHUNG (1 dòng / user, chống âm tiền bằng CHECK balance_vnd >= 0)
CREATE TABLE IF NOT EXISTS public.user_wallets (
  user_id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_vnd         bigint      NOT NULL DEFAULT 0 CHECK (balance_vnd >= 0),
  total_deposited_vnd bigint      NOT NULL DEFAULT 0 CHECK (total_deposited_vnd >= 0),
  total_spent_vnd     bigint      NOT NULL DEFAULT 0 CHECK (total_spent_vnd >= 0),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_wallets_select_own" ON public.user_wallets;
CREATE POLICY "user_wallets_select_own" ON public.user_wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.user_wallets FROM authenticated;

-- 2. ĐƠN NẠP TIỀN VÀO VÍ (PayOS VietQR / Stripe)
CREATE TABLE IF NOT EXISTS public.wallet_topups (
  order_id       text        PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gateway        text        NOT NULL CHECK (gateway IN ('payos', 'stripe', 'manual')),
  amount_vnd     integer     NOT NULL CHECK (amount_vnd >= 10000),
  status         text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded')),
  gateway_txn_id text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  paid_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_wallet_topups_user ON public.wallet_topups(user_id, created_at DESC);
ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet_topups_select_own" ON public.wallet_topups;
CREATE POLICY "wallet_topups_select_own" ON public.wallet_topups
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.wallet_topups FROM authenticated;

-- 3. SỔ CÁI GIAO DỊCH VÍ BẤT BIẾN (Ledger minh bạch cho phụ huynh & đối soát)
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type        text        NOT NULL CHECK (entry_type IN ('topup', 'purchase', 'refund', 'admin_adjust')),
  amount_vnd        integer     NOT NULL,
  balance_after_vnd bigint      NOT NULL CHECK (balance_after_vnd >= 0),
  ref_id            text,
  app_code          text,
  description       text        NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON public.wallet_ledger(user_id, created_at DESC);
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet_ledger_select_own" ON public.wallet_ledger;
CREATE POLICY "wallet_ledger_select_own" ON public.wallet_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.wallet_ledger FROM authenticated;

-- 4. QUYỀN TRUY CẬP ĐỒNG BỘ 4 APP (sat / ielts / thcs / thpt)
CREATE TABLE IF NOT EXISTS public.user_app_entitlements (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_code   text        NOT NULL CHECK (app_code IN ('sat', 'ielts', 'thcs', 'thpt')),
  tier       text        NOT NULL DEFAULT 'pro',
  period     text        NOT NULL DEFAULT 'monthly',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app_code)
);
CREATE INDEX IF NOT EXISTS idx_user_app_entitlements_exp ON public.user_app_entitlements(user_id, expires_at DESC);
ALTER TABLE public.user_app_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_app_entitlements_select_own" ON public.user_app_entitlements;
CREATE POLICY "user_app_entitlements_select_own" ON public.user_app_entitlements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.user_app_entitlements FROM authenticated;

-- 5. ATOMIC RPC: XÁC NHẬN NẠP VÍ (Webhook PayOS / Stripe gọi qua service_role)
CREATE OR REPLACE FUNCTION public.confirm_wallet_topup(
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
  v_topup   public.wallet_topups%ROWTYPE;
  v_now     timestamptz := now();
  v_balance bigint;
BEGIN
  SELECT * INTO v_topup
    FROM public.wallet_topups
   WHERE order_id = p_order_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_topup.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_confirmed', true, 'order_id', p_order_id);
  END IF;

  IF v_topup.status IN ('cancelled', 'refunded') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_closed', 'status', v_topup.status);
  END IF;

  IF p_amount_vnd IS NOT NULL AND p_amount_vnd <> v_topup.amount_vnd THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch', 'expected', v_topup.amount_vnd, 'received', p_amount_vnd);
  END IF;

  UPDATE public.wallet_topups
     SET status = 'paid',
         gateway_txn_id = p_gateway_txn_id,
         paid_at = v_now
   WHERE order_id = p_order_id;

  INSERT INTO public.user_wallets (user_id, balance_vnd, total_deposited_vnd, total_spent_vnd, updated_at)
  VALUES (v_topup.user_id, v_topup.amount_vnd, v_topup.amount_vnd, 0, v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET balance_vnd         = user_wallets.balance_vnd + v_topup.amount_vnd,
        total_deposited_vnd = user_wallets.total_deposited_vnd + v_topup.amount_vnd,
        updated_at          = v_now
  RETURNING balance_vnd INTO v_balance;

  INSERT INTO public.wallet_ledger (user_id, entry_type, amount_vnd, balance_after_vnd, ref_id, app_code, description)
  VALUES (
    v_topup.user_id,
    'topup',
    v_topup.amount_vnd,
    v_balance,
    p_order_id,
    'wallet',
    'Nạp tiền vào Ví qua ' || upper(v_topup.gateway) || ' (#' || p_order_id || ')'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_confirmed', false,
    'order_id', p_order_id,
    'user_id', v_topup.user_id,
    'balance_vnd', v_balance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_wallet_topup(text, text, integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.confirm_wallet_topup(text, text, integer) TO service_role;

-- 6. ATOMIC RPC: MUA GÓI BẤT KỲ TRỪ THẲNG TỪ VÍ (Khóa dòng FOR UPDATE chống double-spend)
CREATE OR REPLACE FUNCTION public.purchase_catalog_with_wallet(
  p_user_id       uuid,
  p_item_id       text,
  p_app_codes     text[],
  p_tier          text,
  p_period        text,
  p_duration_days integer,
  p_price_vnd     integer,
  p_label         text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now         timestamptz := now();
  v_balance     bigint;
  v_new_balance bigint;
  v_app         text;
  v_cur_exp     timestamptz;
  v_base        timestamptz;
  v_new_exp     timestamptz;
  v_sat_tier    text;
  v_sat_period  text;
BEGIN
  IF p_price_vnd IS NULL OR p_price_vnd <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_price');
  END IF;

  INSERT INTO public.user_wallets (user_id, balance_vnd, total_deposited_vnd, total_spent_vnd, updated_at)
  VALUES (p_user_id, 0, 0, 0, v_now)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance_vnd INTO v_balance
    FROM public.user_wallets
   WHERE user_id = p_user_id
     FOR UPDATE;

  IF v_balance < p_price_vnd THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_balance',
      'balance_vnd', v_balance,
      'required_vnd', p_price_vnd,
      'shortfall_vnd', p_price_vnd - v_balance
    );
  END IF;

  v_new_balance := v_balance - p_price_vnd;

  UPDATE public.user_wallets
     SET balance_vnd     = v_new_balance,
         total_spent_vnd = total_spent_vnd + p_price_vnd,
         updated_at      = v_now
   WHERE user_id = p_user_id;

  INSERT INTO public.wallet_ledger (user_id, entry_type, amount_vnd, balance_after_vnd, ref_id, app_code, description)
  VALUES (
    p_user_id,
    'purchase',
    -p_price_vnd,
    v_new_balance,
    p_item_id,
    array_to_string(p_app_codes, ','),
    'Mua ' || COALESCE(p_label, p_item_id)
  );

  FOREACH v_app IN ARRAY p_app_codes LOOP
    SELECT expires_at INTO v_cur_exp
      FROM public.user_app_entitlements
     WHERE user_id = p_user_id AND app_code = v_app;

    v_base := CASE WHEN v_cur_exp IS NOT NULL AND v_cur_exp > v_now THEN v_cur_exp ELSE v_now END;
    v_new_exp := v_base + make_interval(days => GREATEST(1, COALESCE(p_duration_days, 30)));

    INSERT INTO public.user_app_entitlements (user_id, app_code, tier, period, started_at, expires_at, updated_at)
    VALUES (p_user_id, v_app, p_tier, p_period, v_now, v_new_exp, v_now)
    ON CONFLICT (user_id, app_code) DO UPDATE
      SET tier       = CASE WHEN user_app_entitlements.tier = 'ultimate' AND user_app_entitlements.expires_at > v_now THEN 'ultimate' ELSE EXCLUDED.tier END,
          period     = EXCLUDED.period,
          expires_at = EXCLUDED.expires_at,
          updated_at = v_now;

    -- Đồng bộ trực tiếp vào user_subscriptions để App SAT mở khóa tức thì
    IF v_app = 'sat' THEN
      v_sat_tier := CASE WHEN lower(p_tier) = 'ultimate' THEN 'ultimate' ELSE 'premium' END;
      v_sat_period := CASE
        WHEN p_period IN ('monthly', 'quarterly', 'semiannual', 'yearly') THEN p_period
        ELSE 'monthly'
      END;

      SELECT expires_at INTO v_cur_exp
        FROM public.user_subscriptions
       WHERE user_id = p_user_id;

      v_base := CASE WHEN v_cur_exp IS NOT NULL AND v_cur_exp > v_now THEN v_cur_exp ELSE v_now END;
      v_new_exp := v_base + make_interval(days => GREATEST(1, COALESCE(p_duration_days, 30)));

      INSERT INTO public.user_subscriptions (user_id, tier, period, started_at, expires_at, updated_at)
      VALUES (p_user_id, v_sat_tier, v_sat_period, v_now, v_new_exp, v_now)
      ON CONFLICT (user_id) DO UPDATE
        SET tier       = CASE WHEN user_subscriptions.tier = 'ultimate' AND user_subscriptions.expires_at > v_now THEN 'ultimate' ELSE EXCLUDED.tier END,
            period     = EXCLUDED.period,
            expires_at = EXCLUDED.expires_at,
            updated_at = v_now;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'balance_vnd', v_new_balance,
    'item_id', p_item_id,
    'expires_at', v_new_exp
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_catalog_with_wallet(uuid, text, text[], text, text, integer, integer, text) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.purchase_catalog_with_wallet(uuid, text, text[], text, text, integer, integer, text) TO service_role;
