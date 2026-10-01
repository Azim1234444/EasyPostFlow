import { generateShopeeHmacSignature } from './crypto.ts';
import type {
  ShopeeVideoInitResponse,
  ShopeeAffiliateLinkResponse,
} from './types.ts';

const SHOPEE_API_BASE = 'https://partner.shopeemobile.com';
const SHOPEE_AFFILIATE_GRAPHQL = 'https://open-api.affiliate.shopee.com/graphql';

export class ShopeeClient {
  private partnerId: string;
  private partnerKey: string;

  constructor(config?: { partnerId?: string; partnerKey?: string }) {
    this.partnerId = config?.partnerId || process.env.SHOPEE_PARTNER_ID || '';
    this.partnerKey = config?.partnerKey || process.env.SHOPEE_PARTNER_KEY || '';
  }

  /**
   * Build an official Shopee Open Platform endpoint URL with HMAC-SHA256 signature query params.
   */
  buildSignedUrl(apiPath: string, accessToken?: string, shopId?: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateShopeeHmacSignature({
      partnerId: this.partnerId,
      apiPath,
      timestamp,
      accessToken,
      shopId,
      partnerKey: this.partnerKey,
    });

    const params = new URLSearchParams({
      partner_id: this.partnerId,
      timestamp: timestamp.toString(),
      sign,
    });

    if (accessToken) params.set('access_token', accessToken);
    if (shopId) params.set('shop_id', shopId);

    return `${SHOPEE_API_BASE}${apiPath}?${params.toString()}`;
  }

  /**
   * Initialize a video upload on Shopee Open Platform v2 (Seller mode).
   */
  async initVideoUpload(
    accessToken: string,
    shopId: string,
    videoSize: number
  ): Promise<ShopeeVideoInitResponse> {
    const apiPath = '/api/v2/media_space/init_video_upload';
    const url = this.buildSignedUrl(apiPath, accessToken, shopId);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_size: videoSize,
      }),
    });

    const data = await res.json();
    return data as ShopeeVideoInitResponse;
  }

  /**
   * NOTE ON SHOPEE VIDEO PUBLISHING:
   * Shopee Open Platform v2 currently provides media_space strictly for seller product item listings.
   * Shopee does NOT provide an open API for automated posting to the consumer Shopee Video feed.
   * Consequently, Shopee Video posting is handled exclusively through the assisted affiliate workflow.
   */

  /**
   * Generate an official Shopee Affiliate short tracking link via GraphQL API.
   * If live credentials are not configured, formats a clean tracking URL fallback.
   */
  async generateAffiliateLink(
    originalUrl: string,
    subId?: string
  ): Promise<ShopeeAffiliateLinkResponse> {
    const appId = process.env.SHOPEE_AFFILIATE_APP_ID;
    const secret = process.env.SHOPEE_AFFILIATE_SECRET || process.env.SHOPEE_AFFILIATE_APP_SECRET;

    if (appId && secret) {
      try {
        const query = `
          mutation {
            generateShortLink(input: { originUrl: "${originalUrl}", subIds: ["${subId || 'postflow'}"] }) {
              shortLink
            }
          }
        `;

        const res = await fetch(SHOPEE_AFFILIATE_GRAPHQL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `SHA256 Credential=${appId}, SignedHeaders=content-type;host`,
          },
          body: JSON.stringify({ query }),
        });

        const json = await res.json();
        const shortLink = json?.data?.generateShortLink?.shortLink;
        if (shortLink) {
          return {
            shortLink,
            originalLink: originalUrl,
            timestamp: new Date().toISOString(),
          };
        }
      } catch (err) {
        console.warn('Shopee Affiliate GraphQL query warning:', err);
      }
    }

    // Deterministic affiliate tracking link format
    const urlObj = new URL(originalUrl);
    urlObj.searchParams.set('utm_source', 'postflow');
    if (subId) urlObj.searchParams.set('sub_id', subId);

    return {
      shortLink: urlObj.toString(),
      originalLink: originalUrl,
      timestamp: new Date().toISOString(),
    };
  }
}
