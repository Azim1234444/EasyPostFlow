'use server';

import { createClient } from '@/lib/supabase/server';
import { TikTokClient } from '@/lib/platforms/tiktok/client';
import { encryptToken, decryptToken } from '@/lib/crypto/encryption';
import type { PlatformAccount } from '@/types/database';
import { revalidatePath } from 'next/cache';

export interface ActionResponse<T = unknown> {
  data?: T;
  error?: string;
}

export type SafePlatformAccount = Omit<
  PlatformAccount,
  'access_token_encrypted' | 'refresh_token_encrypted'
>;

/**
 * Fetch all platform accounts for the authenticated user with secrets stripped.
 */
export async function getPlatformAccounts(): Promise<ActionResponse<SafePlatformAccount[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    const { data, error } = await supabase
      .from('platform_accounts')
      .select(
        'id, user_id, platform, account_type, platform_user_id, platform_username, display_name, avatar_url, token_expires_at, status, scopes, metadata, connected_at, updated_at'
      )
      .eq('user_id', user.id)
      .order('platform', { ascending: true });

    if (error) {
      return { error: error.message };
    }

    return { data: (data as SafePlatformAccount[]) || [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to retrieve connected accounts' };
  }
}

/**
 * Disconnect a platform account and revoke access.
 */
export async function disconnectAccount(accountId: string): Promise<ActionResponse<boolean>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    const { error } = await supabase
      .from('platform_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', user.id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath('/accounts');
    revalidatePath('/calendar');
    revalidatePath('/dashboard');

    return { data: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to disconnect account' };
  }
}

/**
 * Manually trigger token refresh for a connected TikTok account.
 */
export async function refreshAccountToken(accountId: string): Promise<ActionResponse<boolean>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    // Query encrypted refresh token
    const { data: account, error: accountError } = await supabase
      .from('platform_accounts')
      .select('id, platform, refresh_token_encrypted')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return { error: 'Account not found' };
    }

    if (account.platform !== 'tiktok') {
      return { error: 'Token refresh is currently implemented for TikTok' };
    }

    if (!account.refresh_token_encrypted) {
      return { error: 'No refresh token stored for this account' };
    }

    // Decrypt refresh token
    const rawRefreshToken = decryptToken(account.refresh_token_encrypted);

    const client = new TikTokClient();
    const newTokens = await client.refreshAccessToken(rawRefreshToken);

    // Encrypt new tokens (TikTok rotates refresh token upon refresh)
    const encryptedAccessToken = encryptToken(newTokens.access_token);
    const encryptedRefreshToken = encryptToken(newTokens.refresh_token);
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('platform_accounts')
      .update({
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: expiresAt,
        status: 'connected',
      })
      .eq('id', accountId);

    if (updateError) {
      throw new Error(`Failed to persist refreshed tokens: ${updateError.message}`);
    }

    revalidatePath('/accounts');

    return { data: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Token refresh failed' };
  }
}

export interface ConnectShopeeInput {
  accountType: 'seller' | 'affiliate';
  displayName: string;
  shopId?: string;
  accessToken?: string;
  appId?: string;
  appSecret?: string;
}

/**
 * Connect a Shopee Seller or Affiliate account.
 */
export async function connectShopeeAccount(
  input: ConnectShopeeInput
): Promise<ActionResponse<SafePlatformAccount>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    if (!input.displayName.trim()) {
      return { error: 'Account or shop name is required' };
    }

    const platformUserId =
      input.accountType === 'seller' ? input.shopId || `shop_${Date.now()}` : `aff_${Date.now()}`;

    const encryptedToken = input.accessToken
      ? encryptToken(input.accessToken)
      : encryptToken(`stub_shopee_${Date.now()}`);

    const metadata: Record<string, unknown> = {
      account_type: input.accountType,
      shop_id: input.shopId || null,
      app_id: input.appId || null,
    };

    const { data, error } = await supabase
      .from('platform_accounts')
      .upsert(
        {
          user_id: user.id,
          platform: 'shopee',
          account_type: input.accountType,
          platform_user_id: platformUserId,
          platform_username: input.displayName.trim(),
          display_name: input.displayName.trim(),
          access_token_encrypted: encryptedToken,
          status: 'connected',
          metadata,
          connected_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,platform,platform_user_id',
        }
      )
      .select(
        'id, user_id, platform, account_type, platform_user_id, platform_username, display_name, avatar_url, token_expires_at, status, scopes, metadata, connected_at, updated_at'
      )
      .single();

    if (error || !data) {
      return { error: error?.message || 'Failed to save Shopee account' };
    }

    revalidatePath('/accounts');
    revalidatePath('/calendar');
    revalidatePath('/dashboard');

    return { data: data as SafePlatformAccount };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error connecting Shopee account' };
  }
}

