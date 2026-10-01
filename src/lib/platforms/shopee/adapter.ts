import type {
  PlatformAdapter,
  PublishRequestPayload,
  PlatformCredentials,
  PublishResult,
} from '../types.ts';
import { ShopeeClient } from './client.ts';

/**
 * Shopee Integration Adapter
 *
 * NOTE ON OFFICIAL SHOPEE CAPABILITIES:
 * Shopee Open Platform v2 does NOT offer an automated video publishing API for the consumer
 * "Shopee Video" feed. Shopee Affiliate APIs support official GraphQL deep-link generation.
 *
 * To maintain strict compliance and zero fragile automation / zero scraping, all Shopee
 * video posts are routed through PostFlow's transparent assisted manual workflow
 * (MANUAL_ACTION_REQUIRED).
 */
export class ShopeeAdapter implements PlatformAdapter {
  readonly platform = 'shopee' as const;
  private client: ShopeeClient;

  constructor(client?: ShopeeClient) {
    this.client = client || new ShopeeClient();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  supportsDirectPublish(_credentials?: PlatformCredentials): boolean {
    // Shopee Video consumer feed does not support direct automated API publishing
    return false;
  }

  async publish(
    payload: PublishRequestPayload,
    credentials: PlatformCredentials
  ): Promise<PublishResult> {
    if (!payload.title && !payload.caption) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Shopee requires a title or caption for video posts.',
      };
    }

    if (!payload.videoUrl) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Video source URL is required for publication.',
      };
    }

    // 1. Generate tracked affiliate short link if affiliate URL is provided
    let affiliateShortLink = payload.affiliateUrl || '';
    if (payload.affiliateUrl) {
      try {
        const linkRes = await this.client.generateAffiliateLink(payload.affiliateUrl, 'postflow');
        if (linkRes.shortLink) {
          affiliateShortLink = linkRes.shortLink;
        }
      } catch (linkErr) {
        console.warn('Shopee affiliate link generation warning:', linkErr);
      }
    }

    // 2. Assemble ready-to-copy post package with title, caption, hashtags, and product link
    const hashtagText = payload.hashtags.map((h) => `#${h}`).join(' ');
    const formattedPostText = [
      payload.title,
      payload.caption,
      affiliateShortLink ? `🛒 Product Link: ${affiliateShortLink}` : '',
      hashtagText,
    ]
      .filter(Boolean)
      .join('\n\n');

    const instructions =
      'Shopee Video does not provide an official automated feed publishing API. Your post package is ready! Copy your caption & product link, download your video, and upload directly in the Shopee Mobile App (Me > Shopee Video > Post Video).';

    return {
      success: true,
      status: 'MANUAL_ACTION_REQUIRED',
      manualActionInstructions: instructions,
      rawResponse: {
        platform: 'shopee',
        mode: 'assisted_workflow',
        account_type: credentials.accountType,
        video_url: payload.videoUrl,
        affiliate_short_link: affiliateShortLink,
        formatted_caption: formattedPostText,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
