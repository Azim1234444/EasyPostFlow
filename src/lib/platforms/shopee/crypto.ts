import crypto from 'node:crypto';
import type { ShopeeSignatureParams } from './types.ts';

/**
 * Generate official HMAC-SHA256 signature for Shopee Open Platform v2 API requests.
 *
 * Formula:
 * For shop APIs: HMAC-SHA256(partner_id + api_path + timestamp + access_token + shop_id, partner_key)
 * For public APIs: HMAC-SHA256(partner_id + api_path + timestamp, partner_key)
 */
export function generateShopeeHmacSignature(params: ShopeeSignatureParams): string {
  let baseString = `${params.partnerId}${params.apiPath}${params.timestamp}`;

  if (params.accessToken && params.shopId) {
    baseString += `${params.accessToken}${params.shopId}`;
  }

  return crypto
    .createHmac('sha256', params.partnerKey)
    .update(baseString)
    .digest('hex');
}
