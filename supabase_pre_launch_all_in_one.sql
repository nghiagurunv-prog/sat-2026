-- ============================================================================
--  SAT GURU 2026 — SUPABASE PRE-LAUNCH ALL-IN-ONE MIGRATION (IDEMPOTENT)
--  Cách chạy: Mở Supabase Dashboard → SQL Editor → New Query → Dán toàn bộ
--  nội dung file này và bấm RUN (an toàn chạy lại nhiều lần, không mất dữ liệu).
-- ============================================================================
--  Bao gồm đầy đủ 7 hạng mục критический (Critical Pre-Launch):
--    1. Bảng user_subscriptions (Gói trả phí Premium / Ultimate) + RLS
--    2. Bảng payment_transactions (Giao dịch thanh toán) + RLS
--    3. Mở CHECK constraint gateway: ('vnpay', 'momo', 'stripe', 'payos')
--    4. Mở CHECK constraint period: ('monthly', 'quarterly', 'semiannual', 'yearly')
--    5. Cột duration_days + RPC confirm_payment ATOMIC & Gia hạn cộng dồn (A2 + A3)
--    6. RPC claim_quest_reward ATOMIC (Chống race condition nhận thưởng nhiệm vụ)
--    7. RPC increment_economy ATOMIC (Cộng xu/XP phòng thi không mất welcome coins)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) BẢNG user_subscriptions + RLS
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  tier       text        not null check (tier in ('premium', 'ultimate')),
  period     text        not null check (period in ('monthly', 'quarterly', 'semiannual', 'yearly')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists user_subscriptions_user_expires_idx
  on public.user_subscriptions (user_id, expires_at desc);

alter table public.user_subscriptions enable row level security;

drop policy if exists "user_subscriptions_select_own" on public.user_subscriptions;
create policy "user_subscriptions_select_own" on public.user_subscriptions
  for select to authenticated
  using (auth.uid() = user_id);

-- Mở CHECK constraint period cho bảng user_subscriptions (nếu bảng đã tạo từ bản cũ)
alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_period_check,
  add  constraint user_subscriptions_period_check
       check (period in ('monthly', 'quarterly', 'semiannual', 'yearly'));

-- ────────────────────────────────────────────────────────────────────────────
-- 2) BẢNG payment_transactions + RLS + CỘT duration_days + CHECK CONSTRAINTS
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_transactions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  order_id       text        not null unique,
  gateway        text        not null check (gateway in ('vnpay', 'momo', 'stripe', 'payos')),
  tier           text        not null check (tier in ('premium', 'ultimate')),
  period         text        not null check (period in ('monthly', 'quarterly', 'semiannual', 'yearly')),
  amount_vnd     integer     not null check (amount_vnd > 0),
  duration_days  integer,
  status         text        not null default 'pending'
                              check (status in ('pending', 'paid', 'failed', 'expired')),
  gateway_txn_id text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  paid_at        timestamptz
);

create index if not exists payment_transactions_user_created_idx
  on public.payment_transactions (user_id, created_at desc);

alter table public.payment_transactions enable row level security;

drop policy if exists "payment_transactions_select_own" on public.payment_transactions;
create policy "payment_transactions_select_own" on public.payment_transactions
  for select to authenticated
  using (auth.uid() = user_id);

-- Đảm bảo cột duration_days tồn tại và mở CHECK gateway + period (idempotent)
alter table public.payment_transactions
  add column if not exists duration_days integer;

alter table public.payment_transactions
  drop constraint if exists payment_transactions_gateway_check,
  add  constraint payment_transactions_gateway_check
       check (gateway in ('vnpay', 'momo', 'stripe', 'payos'));

alter table public.payment_transactions
  drop constraint if exists payment_transactions_period_check,
  add  constraint payment_transactions_period_check
       check (period in ('monthly', 'quarterly', 'semiannual', 'yearly'));

-- ────────────────────────────────────────────────────────────────────────────
-- 3) RPC confirm_payment (Bản A2 + A3: Cấp gói nguyên tử & Gia hạn cộng dồn)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.confirm_payment(
  p_order_id       text,
  p_gateway_txn_id text default '',
  p_amount         integer default 0
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_status       text;
  v_amount       integer;
  v_user         uuid;
  v_tier         text;
  v_period       text;
  v_duration     integer;
  v_base_start   timestamptz;
begin
  select status, amount_vnd, user_id, tier, period, duration_days
    into v_status, v_amount, v_user, v_tier, v_period, v_duration
    from public.payment_transactions
    where order_id = p_order_id
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if p_amount > 0 and p_amount <> v_amount then
    return jsonb_build_object('ok', false, 'reason', 'amount_mismatch',
                              'userId', v_user, 'tier', v_tier, 'period', v_period);
  end if;

  if v_status = 'paid' then
    return jsonb_build_object('ok', true, 'alreadyConfirmed', true,
                              'userId', v_user, 'tier', v_tier, 'period', v_period);
  end if;

  -- Fix #006: Chấp nhận cả đơn 'pending' và 'expired' (khách chuyển trễ qua webhook tiền về thực tế)
  if v_status not in ('pending', 'expired') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status',
                              'userId', v_user, 'tier', v_tier, 'period', v_period);
  end if;

  update public.payment_transactions
    set status         = 'paid',
        gateway_txn_id = nullif(p_gateway_txn_id, ''),
        paid_at        = now(),
        updated_at     = now()
    where order_id = p_order_id;

  if v_duration is not null and v_duration > 0 then
    select greatest(now(), coalesce(max(expires_at), now()))
      into v_base_start
      from public.user_subscriptions
      where user_id = v_user
        and tier = v_tier
        and expires_at > now();

    insert into public.user_subscriptions (user_id, tier, period, started_at, expires_at)
    values (v_user, v_tier, v_period, now(), v_base_start + (v_duration || ' days')::interval);
  end if;

  return jsonb_build_object('ok', true, 'alreadyConfirmed', false,
                            'userId', v_user, 'tier', v_tier, 'period', v_period);
end;
$$;

revoke all on function public.confirm_payment(text, text, integer) from public;
revoke all on function public.confirm_payment(text, text, integer) from anon;
revoke all on function public.confirm_payment(text, text, integer) from authenticated;
grant execute on function public.confirm_payment(text, text, integer) to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Đảm bảo cột quest_claims trên user_economy + RPC claim_quest_reward ATOMIC
-- ────────────────────────────────────────────────────────────────────────────
alter table if exists public.user_economy
  add column if not exists quest_claims jsonb not null default '{}'::jsonb;

create or replace function public.claim_quest_reward(
  p_user_id  uuid default auth.uid(),
  p_quest_id text default '',
  p_today    text default '',
  p_coins    int  default 0,
  p_xp       int  default 0
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_coins    int;
  v_xp       int;
  v_claims   jsonb;
  v_today    jsonb;
begin
  select coins, xp, coalesce(quest_claims, '{}'::jsonb)
    into v_coins, v_xp, v_claims
    from public.user_economy
    where user_id = p_user_id
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_row', 'coins', 0, 'xp', 0);
  end if;

  v_today := coalesce(v_claims -> p_today, '[]'::jsonb);

  if v_today @> to_jsonb(p_quest_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed',
                              'coins', v_coins, 'xp', v_xp);
  end if;

  v_coins := v_coins + greatest(0, coalesce(p_coins, 0));
  v_xp    := v_xp    + greatest(0, coalesce(p_xp, 0));
  v_today := v_today || to_jsonb(p_quest_id);
  v_claims := jsonb_set(v_claims, array[p_today], v_today, true);

  update public.user_economy
     set coins = v_coins,
         xp = v_xp,
         quest_claims = v_claims
   where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'reason', 'ok', 'coins', v_coins, 'xp', v_xp);
end;
$$;

revoke execute on function public.claim_quest_reward(uuid, text, text, int, int) from public;
revoke execute on function public.claim_quest_reward(uuid, text, text, int, int) from anon;
revoke execute on function public.claim_quest_reward(uuid, text, text, int, int) from authenticated;
grant  execute on function public.claim_quest_reward(uuid, text, text, int, int) to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 5) RPC increment_economy ATOMIC (Thưởng xu/XP phòng thi chuẩn xác)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.increment_economy(
  p_user_id uuid default auth.uid(),
  p_coins   int  default 0,
  p_xp      int  default 0
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_coins int;
  v_xp    int;
begin
  select coins, xp
    into v_coins, v_xp
    from public.user_economy
    where user_id = p_user_id
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_row', 'coins', 0, 'xp', 0);
  end if;

  v_coins := v_coins + greatest(0, coalesce(p_coins, 0));
  v_xp    := v_xp    + greatest(0, coalesce(p_xp, 0));

  update public.user_economy
     set coins = v_coins,
         xp = v_xp
   where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'reason', 'ok', 'coins', v_coins, 'xp', v_xp);
end;
$$;

revoke execute on function public.increment_economy(uuid, int, int) from public;
revoke execute on function public.increment_economy(uuid, int, int) from anon;
revoke execute on function public.increment_economy(uuid, int, int) from authenticated;
grant  execute on function public.increment_economy(uuid, int, int) to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 6) BẢNG questions + RLS BẢO MẬT (Fix #050) + RPC increment_question_usage
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.questions (
  id          text        primary key,
  module_type text        not null,
  topic       text        not null default '',
  difficulty  text,
  data        jsonb       not null,
  usage_count integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_questions_module     on public.questions (module_type);
create index if not exists idx_questions_module_diff on public.questions (module_type, difficulty);

alter table public.questions enable row level security;

drop policy if exists "auth_read_questions" on public.questions;
create policy "auth_read_questions" on public.questions
  for select to authenticated using (true);

drop policy if exists "auth_insert_questions" on public.questions;
create policy "auth_insert_questions" on public.questions
  for insert to authenticated with check (true);

-- 🔴 FIX #050 (CRITICAL): KHÓA QUYỀN UPDATE TRỰC TIẾP TỪ CLIENT AUTHENTICATED
-- Tuyệt đối không mở update policy cho authenticated để bảo vệ nội dung và đáp án đề thi.
drop policy if exists "auth_update_questions" on public.questions;

create or replace function public.increment_question_usage(p_ids text[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.questions
     set usage_count = usage_count + 1
   where id = any(p_ids);
$$;

create or replace function public.increment_question_usage(p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.questions
     set usage_count = usage_count + 1
   where id = p_id;
$$;

grant execute on function public.increment_question_usage(text[]) to authenticated;
grant execute on function public.increment_question_usage(text) to authenticated;
grant execute on function public.increment_question_usage(text[]) to service_role;
grant execute on function public.increment_question_usage(text) to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 7) BẢNG parent_share_codes + RLS (Chia sẻ tiến độ cho phụ huynh)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.parent_share_codes (
  code             text        primary key,
  student_user_id  uuid        not null references auth.users(id) on delete cascade,
  revoked          boolean     not null default false,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz
);

create index if not exists parent_share_codes_student_idx
  on public.parent_share_codes (student_user_id);

alter table public.parent_share_codes enable row level security;

drop policy if exists "parent_share_select_own" on public.parent_share_codes;
create policy "parent_share_select_own" on public.parent_share_codes
  for select to authenticated
  using (auth.uid() = student_user_id);

drop policy if exists "parent_share_update_own" on public.parent_share_codes;
create policy "parent_share_update_own" on public.parent_share_codes
  for update to authenticated
  using (auth.uid() = student_user_id)
  with check (auth.uid() = student_user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 8) BẢNG reward_redemptions + RLS + RPC redeem_reward ATOMIC
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.reward_redemptions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  reward_id    text        not null,
  reward_name  text        not null,
  cost_coins   integer     not null check (cost_coins > 0),
  status       text        not null default 'pending'
                           check (status in ('pending', 'fulfilled', 'cancelled')),
  created_at   timestamptz not null default now(),
  fulfilled_at timestamptz
);

create index if not exists reward_redemptions_user_created_idx
  on public.reward_redemptions (user_id, created_at desc);
create index if not exists reward_redemptions_status_idx
  on public.reward_redemptions (status)
  where status = 'pending';

alter table public.reward_redemptions enable row level security;

drop policy if exists "reward_redemptions_select_own" on public.reward_redemptions;
create policy "reward_redemptions_select_own" on public.reward_redemptions
  for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.redeem_reward(
  p_user_id     uuid    default auth.uid(),
  p_reward_id   text    default '',
  p_reward_name text    default '',
  p_cost        integer default 0
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_coins  integer;
  v_new_id uuid;
begin
  if p_cost is null or p_cost <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_cost');
  end if;

  select coins into v_coins
    from public.user_economy
    where user_id = p_user_id
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_row', 'coins', 0);
  end if;

  if v_coins < p_cost then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'coins', v_coins);
  end if;

  v_coins := v_coins - p_cost;
  update public.user_economy
     set coins = v_coins
   where user_id = p_user_id;

  insert into public.reward_redemptions (user_id, reward_id, reward_name, cost_coins, status)
  values (p_user_id, p_reward_id, p_reward_name, p_cost, 'pending')
  returning id into v_new_id;

  return jsonb_build_object('ok', true, 'reason', 'ok', 'coins', v_coins, 'redemptionId', v_new_id);
end;
$$;

revoke all on function public.redeem_reward(uuid, text, text, integer) from public;
revoke all on function public.redeem_reward(uuid, text, text, integer) from anon;
revoke all on function public.redeem_reward(uuid, text, text, integer) from authenticated;
grant execute on function public.redeem_reward(uuid, text, text, integer) to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 9) BẢNG user_profiles + RLS (Hồ sơ ẩn danh học sinh)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_profiles (
  user_id             uuid        primary key references auth.users(id) on delete cascade,
  nickname            text,
  opt_in_leaderboard  boolean     not null default false,
  nickname_updated_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint user_profiles_nickname_len
    check (nickname is null or char_length(nickname) between 3 and 20)
);

create index if not exists user_profiles_optin_idx
  on public.user_profiles (opt_in_leaderboard) where opt_in_leaderboard = true;

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own" on public.user_profiles
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own" on public.user_profiles
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own" on public.user_profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 10) BẢNG admin_audit_logs + RLS (Fix #010, #030: Ghi vết kiểm toán Admin)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.admin_audit_logs (
  id             uuid        primary key default gen_random_uuid(),
  admin_identity text        not null,
  action         text        not null,
  target_id      text,
  details        jsonb       default '{}'::jsonb,
  created_at     timestamptz default now()
);

create index if not exists idx_admin_audit_logs_created_at
  on public.admin_audit_logs (created_at desc);
create index if not exists idx_admin_audit_logs_action
  on public.admin_audit_logs (action);

alter table public.admin_audit_logs enable row level security;

-- RLS: Authenticated và anon bị chặn hoàn toàn.
-- Chỉ service_role (Admin server client) được phép đọc và ghi (append-only).
revoke all on public.admin_audit_logs from public;
revoke all on public.admin_audit_logs from anon;
revoke all on public.admin_audit_logs from authenticated;
grant select, insert on public.admin_audit_logs to service_role;

-- ============================================================================
--  HOÀN TẤT! Toàn bộ bảng, constraint payOS/Stripe/3-6 tháng, questions, audit logs
--  và các RPC atomic cốt lõi đã sẵn sàng.
-- ============================================================================

