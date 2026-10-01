import type { PlatformType } from '../../types/database.ts';
import type { PlatformAdapter } from './types.ts';
import { TikTokAdapter } from './tiktok/adapter.ts';
import { ShopeeAdapter } from './shopee/adapter.ts';

const adapters: Record<PlatformType, PlatformAdapter> = {
  tiktok: new TikTokAdapter(),
  shopee: new ShopeeAdapter(),
};

/**
 * Retrieve the integration adapter for a given target social platform.
 * Decouples caller code from platform-specific SDKs and logic.
 */
export function getPlatformAdapter(platform: PlatformType): PlatformAdapter {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new Error(`Unsupported platform adapter requested: ${platform}`);
  }
  return adapter;
}
