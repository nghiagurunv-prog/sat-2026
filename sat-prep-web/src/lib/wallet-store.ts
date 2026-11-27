import { createAdminClient } from '@/lib/supabase/admin';
import { activateSubscription } from '@/lib/subscription-store';
import type { EcosystemAppCode, WalletCatalogItem } from '@/lib/wallet-catalog';

/**
 * ============================================================================
 *  UNIFIED WALLET STORE — Server-Authoritative (service_role + Atomic RPC)
 * ============================================================================
 *  Quản lý Ví VNĐ chung (`user_wallets`), đơn nạp (`wallet_topups`), sao kê
 *  bất biến (`wallet_ledger`) và quyền 4 app (`user_app_entitlements`).
 *  Tất cả thao tác tiền đều đi qua RPC Postgres `FOR UPDATE` (có nhánh fallback
 *  CAS an toàn phục vụ môi trường dev/test chưa cài RPC).
 * ============================================================================
 */

export interface WalletBalance {
  balanceVnd: number;
  totalDepositedVnd: number;
  totalSpentVnd: number;
  updatedAt: string | null;
}

export interface WalletLedgerEntry {
  id: string;
  entryType: 'topup' | 'purchase' | 'refund' | 'admin_adjust';
  amountVnd: number;
  balanceAfterVnd: number;
  refId: string | null;
  appCode: string | null;
  description: string;
  createdAt: string;
}

export interface WalletTopupRecord {
  orderId: string;
  gateway: string;
  amountVnd: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

export interface AppEntitlement {
  appCode: EcosystemAppCode;
  tier: string;
  period: string;
  startedAt: string;
  expiresAt: string;
  active: boolean;
}

export type ConfirmWalletTopupResult =
  | { ok: true; alreadyConfirmed: boolean; balanceVnd?: number }
  | { ok: false; reason: 'not_found' | 'amount_mismatch' | 'order_closed' | 'confirm_unavailable' | 'error' };

export type WalletPurchaseResult =
  | { ok: true; balanceVnd: number; itemId: string; expiresAt: string }
  | {
      ok: false;
      reason: 'insufficient_balance' | 'unavailable' | 'error';
      balanceVnd?: number;
      requiredVnd?: number;
      shortfallVnd?: number;
    };

export async function getWalletSummary(userId: string): Promise<{
  wallet: WalletBalance;
  entitlements: AppEntitlement[];
  ledger: WalletLedgerEntry[];
  topups: WalletTopupRecord[];
}> {
  const admin = createAdminClient();
  const nowMs = Date.now();

  const [walletRes, entRes, satSubRes, ledgerRes, topupsRes] = await Promise.all([
    admin.from('user_wallets').select('balance_vnd, total_deposited_vnd, total_spent_vnd, updated_at').eq('user_id', userId).maybeSingle(),
    admin.from('user_app_entitlements').select('app_code, tier, period, started_at, expires_at').eq('user_id', userId),
    admin.from('user_subscriptions').select('tier, period, started_at, expires_at').eq('user_id', userId).maybeSingle(),
    admin.from('wallet_ledger').select('id, entry_type, amount_vnd, balance_after_vnd, ref_id, app_code, description, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(25),
    admin.from('wallet_topups').select('order_id, gateway, amount_vnd, status, created_at, paid_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
  ]);

  const wRow = walletRes.data as {
    balance_vnd?: number;
    total_deposited_vnd?: number;
    total_spent_vnd?: number;
    updated_at?: string;
  } | null;

  const wallet: WalletBalance = {
    balanceVnd: Number(wRow?.balance_vnd ?? 0),
    totalDepositedVnd: Number(wRow?.total_deposited_vnd ?? 0),
    totalSpentVnd: Number(wRow?.total_spent_vnd ?? 0),
    updatedAt: wRow?.updated_at ?? null,
  };

  const entMap = new Map<EcosystemAppCode, AppEntitlement>();
  for (const row of (entRes.data ?? []) as Array<{
    app_code: EcosystemAppCode;
    tier: string;
    period: string;
    started_at: string;
    expires_at: string;
  }>) {
    const expMs = new Date(row.expires_at).getTime();
    entMap.set(row.app_code, {
      appCode: row.app_code,
      tier: row.tier,
      period: row.period,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      active: Number.isFinite(expMs) && expMs > nowMs,
    });
  }

  // Gộp trạng thái gói SAT mua trực tiếp từ /upgrade (user_subscriptions) nếu hạn xa hơn
  const satSub = satSubRes.data as {
    tier?: string;
    period?: string;
    started_at?: string;
    expires_at?: string;
  } | null;
  if (satSub?.expires_at) {
    const subExpMs = new Date(satSub.expires_at).getTime();
    const existingSat = entMap.get('sat');
    const existingMs = existingSat ? new Date(existingSat.expiresAt).getTime() : 0;
    if (Number.isFinite(subExpMs) && subExpMs > existingMs) {
      entMap.set('sat', {
        appCode: 'sat',
        tier: satSub.tier ?? 'premium',
        period: satSub.period ?? 'monthly',
        startedAt: satSub.started_at ?? new Date().toISOString(),
        expiresAt: satSub.expires_at,
        active: subExpMs > nowMs,
      });
    }
  }

  const ledger: WalletLedgerEntry[] = ((ledgerRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id ?? ''),
    entryType: (r.entry_type as WalletLedgerEntry['entryType']) || 'purchase',
    amountVnd: Number(r.amount_vnd ?? 0),
    balanceAfterVnd: Number(r.balance_after_vnd ?? 0),
    refId: r.ref_id ? String(r.ref_id) : null,
    appCode: r.app_code ? String(r.app_code) : null,
    description: String(r.description ?? ''),
    createdAt: String(r.created_at ?? ''),
  }));

  const topups: WalletTopupRecord[] = ((topupsRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    orderId: String(r.order_id ?? ''),
    gateway: String(r.gateway ?? 'payos'),
    amountVnd: Number(r.amount_vnd ?? 0),
    status: String(r.status ?? 'pending'),
    createdAt: String(r.created_at ?? ''),
    paidAt: r.paid_at ? String(r.paid_at) : null,
  }));

  return {
    wallet,
    entitlements: Array.from(entMap.values()),
    ledger,
    topups,
  };
}

export async function createWalletTopup(input: {
  userId: string;
  orderId: string;
  gateway: 'payos' | 'stripe';
  amountVnd: number;
}): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('wallet_topups').insert({
      order_id: input.orderId,
      user_id: input.userId,
      gateway: input.gateway,
      amount_vnd: input.amountVnd,
      status: 'pending',
    });
    if (error) {
      console.error('createWalletTopup lỗi:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('createWalletTopup lỗi:', err);
    return false;
  }
}

export async function getWalletTopupPublicStatus(
  orderId: string
): Promise<{ orderId: string; status: string } | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('wallet_topups')
      .select('order_id, status')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { order_id?: string; status?: string };
    return {
      orderId: String(row.order_id ?? orderId),
      status: String(row.status ?? 'unknown'),
    };
  } catch {
    return null;
  }
}

export async function confirmWalletTopupAtomic(
  orderId: string,
  gatewayTxnId: string,
  amountVnd: number
): Promise<ConfirmWalletTopupResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('confirm_wallet_topup', {
    p_order_id: orderId,
    p_gateway_txn_id: gatewayTxnId,
    p_amount_vnd: amountVnd,
  });

  if (!error && data && typeof data === 'object') {
    const res = data as {
      ok?: boolean;
      already_confirmed?: boolean;
      reason?: string;
      balance_vnd?: number;
    };
    if (res.ok) {
      return {
        ok: true,
        alreadyConfirmed: Boolean(res.already_confirmed),
        balanceVnd: typeof res.balance_vnd === 'number' ? res.balance_vnd : undefined,
      };
    }
    if (res.reason === 'not_found') return { ok: false, reason: 'not_found' };
    if (res.reason === 'amount_mismatch') return { ok: false, reason: 'amount_mismatch' };
    if (res.reason === 'order_closed') return { ok: false, reason: 'order_closed' };
    return { ok: false, reason: 'error' };
  }

  // Fallback CAS chỉ cho môi trường dev/test chưa cài RPC (vd fake-db trong integration test)
  const errCode = (error as { code?: string; message?: string } | null)?.code;
  const errMsg = (error as { message?: string } | null)?.message || '';
  const rpcMissing = errCode === '42883' || errCode === 'PGRST202' || /function .* does not exist|not found/i.test(errMsg);
  if (!rpcMissing) {
    console.error('confirmWalletTopupAtomic RPC error:', error);
    return { ok: false, reason: 'confirm_unavailable' };
  }

  const { data: topupRow } = await admin
    .from('wallet_topups')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  const topup = topupRow as {
    order_id: string;
    user_id: string;
    gateway: string;
    amount_vnd: number;
    status: string;
  } | null;

  if (!topup) return { ok: false, reason: 'not_found' };
  if (topup.status === 'paid') return { ok: true, alreadyConfirmed: true };
  if (topup.status === 'cancelled' || topup.status === 'refunded') return { ok: false, reason: 'order_closed' };
  if (amountVnd !== topup.amount_vnd) return { ok: false, reason: 'amount_mismatch' };

  const nowIso = new Date().toISOString();
  const { data: updatedRows, error: updErr } = await admin
    .from('wallet_topups')
    .update({ status: 'paid', gateway_txn_id: gatewayTxnId, paid_at: nowIso })
    .eq('order_id', orderId)
    .eq('status', 'pending')
    .select('order_id');

  if (updErr) return { ok: false, reason: 'error' };
  if (!updatedRows || updatedRows.length === 0) {
    return { ok: true, alreadyConfirmed: true };
  }

  const { data: curWallet } = await admin
    .from('user_wallets')
    .select('balance_vnd, total_deposited_vnd, total_spent_vnd')
    .eq('user_id', topup.user_id)
    .maybeSingle();
  const w = curWallet as { balance_vnd?: number; total_deposited_vnd?: number; total_spent_vnd?: number } | null;
  const nextBalance = Number(w?.balance_vnd ?? 0) + topup.amount_vnd;

  await admin.from('user_wallets').upsert(
    {
      user_id: topup.user_id,
      balance_vnd: nextBalance,
      total_deposited_vnd: Number(w?.total_deposited_vnd ?? 0) + topup.amount_vnd,
      total_spent_vnd: Number(w?.total_spent_vnd ?? 0),
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );

  await admin.from('wallet_ledger').insert({
    user_id: topup.user_id,
    entry_type: 'topup',
    amount_vnd: topup.amount_vnd,
    balance_after_vnd: nextBalance,
    ref_id: orderId,
    app_code: 'wallet',
    description: `Nạp tiền vào Ví qua ${String(topup.gateway).toUpperCase()} (#${orderId})`,
  });

  return { ok: true, alreadyConfirmed: false, balanceVnd: nextBalance };
}

export async function purchaseCatalogWithWalletAtomic(
  userId: string,
  item: WalletCatalogItem
): Promise<WalletPurchaseResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('purchase_catalog_with_wallet', {
    p_user_id: userId,
    p_item_id: item.id,
    p_app_codes: item.appCodes,
    p_tier: item.tier,
    p_period: item.period,
    p_duration_days: item.durationDays,
    p_price_vnd: item.priceVnd,
    p_label: item.name,
  });

  if (!error && data && typeof data === 'object') {
    const res = data as {
      ok?: boolean;
      reason?: string;
      balance_vnd?: number;
      required_vnd?: number;
      shortfall_vnd?: number;
      expires_at?: string;
    };
    if (res.ok) {
      return {
        ok: true,
        balanceVnd: Number(res.balance_vnd ?? 0),
        itemId: item.id,
        expiresAt: String(res.expires_at ?? ''),
      };
    }
    if (res.reason === 'insufficient_balance') {
      return {
        ok: false,
        reason: 'insufficient_balance',
        balanceVnd: Number(res.balance_vnd ?? 0),
        requiredVnd: Number(res.required_vnd ?? item.priceVnd),
        shortfallVnd: Number(res.shortfall_vnd ?? item.priceVnd),
      };
    }
    return { ok: false, reason: 'error' };
  }

  const errCode = (error as { code?: string } | null)?.code;
  const errMsg = (error as { message?: string } | null)?.message || '';
  const rpcMissing = errCode === '42883' || errCode === 'PGRST202' || /function .* does not exist|not found/i.test(errMsg);
  if (!rpcMissing) {
    console.error('purchaseCatalogWithWalletAtomic RPC error:', error);
    return { ok: false, reason: 'unavailable' };
  }

  // Fallback CAS cho môi trường dev/test chưa cài RPC
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const { data: wRow } = await admin
    .from('user_wallets')
    .select('balance_vnd, total_deposited_vnd, total_spent_vnd')
    .eq('user_id', userId)
    .maybeSingle();

  const w = wRow as { balance_vnd?: number; total_deposited_vnd?: number; total_spent_vnd?: number } | null;
  const curBalance = Number(w?.balance_vnd ?? 0);
  if (curBalance < item.priceVnd) {
    return {
      ok: false,
      reason: 'insufficient_balance',
      balanceVnd: curBalance,
      requiredVnd: item.priceVnd,
      shortfallVnd: item.priceVnd - curBalance,
    };
  }

  const nextBalance = curBalance - item.priceVnd;
  const { data: casRows, error: casErr } = await admin
    .from('user_wallets')
    .update({
      balance_vnd: nextBalance,
      total_spent_vnd: Number(w?.total_spent_vnd ?? 0) + item.priceVnd,
      updated_at: nowIso,
    })
    .eq('user_id', userId)
    .eq('balance_vnd', curBalance)
    .select('user_id');

  if (casErr || !casRows || casRows.length === 0) {
    return { ok: false, reason: 'error' };
  }

  await admin.from('wallet_ledger').insert({
    user_id: userId,
    entry_type: 'purchase',
    amount_vnd: -item.priceVnd,
    balance_after_vnd: nextBalance,
    ref_id: item.id,
    app_code: item.appCodes.join(','),
    description: `Mua ${item.name}`,
  });

  let latestExpiry = new Date(nowMs + item.durationDays * 86_400_000).toISOString();
  for (const appCode of item.appCodes) {
    const { data: existingEnt } = await admin
      .from('user_app_entitlements')
      .select('expires_at')
      .eq('user_id', userId)
      .eq('app_code', appCode)
      .maybeSingle();
    const curExpMs = (existingEnt as { expires_at?: string } | null)?.expires_at
      ? new Date(String((existingEnt as { expires_at: string }).expires_at)).getTime()
      : 0;
    const baseMs = curExpMs > nowMs ? curExpMs : nowMs;
    const nextExpIso = new Date(baseMs + item.durationDays * 86_400_000).toISOString();
    latestExpiry = nextExpIso;

    if (existingEnt) {
      await admin
        .from('user_app_entitlements')
        .update({
          tier: item.tier,
          period: item.period,
          expires_at: nextExpIso,
          updated_at: nowIso,
        })
        .eq('user_id', userId)
        .eq('app_code', appCode);
    } else {
      await admin.from('user_app_entitlements').insert({
        user_id: userId,
        app_code: appCode,
        tier: item.tier,
        period: item.period,
        started_at: nowIso,
        expires_at: nextExpIso,
        updated_at: nowIso,
      });
    }

    if (appCode === 'sat') {
      await activateSubscription(userId, item.tier, item.durationDays, item.id);
    }
  }

  return {
    ok: true,
    balanceVnd: nextBalance,
    itemId: item.id,
    expiresAt: latestExpiry,
  };
}
