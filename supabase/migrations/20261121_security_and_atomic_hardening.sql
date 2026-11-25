-- ============================================================================
-- 2026-11-21 — Security RLS Hardening & Atomic spend_coins RPC (Wave P1/P2)
-- ============================================================================
-- Idempotent migration: an toàn khi chạy nhiều lần trên Supabase Production.
-- ============================================================================

-- 1. Thu hồi hoàn toàn quyền ghi trực tiếp từ client authenticated trên các bảng
--    dùng chung & server-authoritative (chống AI Cache Poisoning, Question Pollution,
--    và tự sửa quota/xu). Bọc to_regclass guard để tuyệt đối không crash 42P01 trên DB trắng.
DO $$
DECLARE
  v_tbl text;
  v_tables text[] := ARRAY[
    'ai_chat_cache',
    'questions',
    'user_economy',
    'user_mastery',
    'user_ai_usage',
    'ai_cost_ledger',
    'user_progress',
    'user_goals'
  ];
BEGIN
  IF to_regclass('public.ai_chat_cache') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "auth_insert_chat_cache" ON public.ai_chat_cache';
    EXECUTE 'DROP POLICY IF EXISTS "auth_update_chat_cache" ON public.ai_chat_cache';
  END IF;

  IF to_regclass('public.questions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "auth_insert_questions" ON public.questions';
    EXECUTE 'DROP POLICY IF EXISTS "auth_update_questions" ON public.questions';
  END IF;

  FOREACH v_tbl IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_tbl) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', v_tbl);
    END IF;
  END LOOP;

  -- Khóa luôn RPC increment_question_usage khỏi authenticated nếu hàm đã tồn tại
  IF to_regprocedure('public.increment_question_usage(text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.increment_question_usage(text) FROM public, anon, authenticated';
    EXECUTE 'GRANT  EXECUTE ON FUNCTION public.increment_question_usage(text) TO service_role';
  END IF;
  IF to_regprocedure('public.increment_question_usage(text[])') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.increment_question_usage(text[]) FROM public, anon, authenticated';
    EXECUTE 'GRANT  EXECUTE ON FUNCTION public.increment_question_usage(text[]) TO service_role';
  END IF;
END $$;

-- 2. RPC spend_coins ATOMIC (khóa dòng SELECT ... FOR UPDATE chống double-spend xu)
CREATE OR REPLACE FUNCTION public.spend_coins(
  p_user_id uuid,
  p_amount  int,
  p_item_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coins     int;
  v_inventory jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount', 'coins', 0);
  END IF;

  SELECT coins, COALESCE(inventory, '[]'::jsonb)
    INTO v_coins, v_inventory
    FROM public.user_economy
   WHERE user_id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_row', 'coins', 0);
  END IF;

  IF v_coins < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_coins', 'coins', v_coins);
  END IF;

  v_coins := v_coins - p_amount;
  IF p_item_id IS NOT NULL AND length(trim(p_item_id)) > 0 THEN
    v_inventory := v_inventory || to_jsonb(p_item_id);
  END IF;

  UPDATE public.user_economy
     SET coins = v_coins,
         inventory = v_inventory
   WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'spent',
    'coins', v_coins,
    'inventory', v_inventory
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.spend_coins(uuid, int, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.spend_coins(uuid, int, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.spend_coins(uuid, int, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.spend_coins(uuid, int, text) TO service_role;
