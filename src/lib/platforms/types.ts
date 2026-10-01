import type { PlatformType, AccountType } from '../../types/database.ts';

export interface PublishRequestPayload {
  contentId: string;
  title: string;
  caption: string | null;
  hashtags: string[];
  videoStoragePath: string;
  videoUrl: string;
  videoBuffer?: Buffer | Uint8Array;
  videoSize?: number;
  transferMode?: 'FILE_UPLOAD' | 'PULL_FROM_URL';
  affiliateUrl: string | null;
  affiliatePlatform: string | null;
  metadata?: Record<string, unknown>;
}

export interface PlatformCredentials {
  platform: PlatformType;
  platformUserId: string | null;
  platformUsername?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  accountType: AccountType;
  metadata?: Record<string, unknown>;
}

export type PublishExecutionStatus =
  | 'PUBLISHED'
  | 'PROCESSING'
  | 'MANUAL_ACTION_REQUIRED'
  | 'FAILED';

export interface PublishResult {
  success: boolean;
  status: PublishExecutionStatus;
  providerPostId?: string;
  publishId?: string;
  error?: string;
  manualActionInstructions?: string;
  rawResponse?: Record<string, unknown>;
}

export interface PublishStatusResult {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  providerPostId?: string;
  errorMessage?: string;
  rawResponse?: Record<string, unknown>;
}

export interface PlatformAdapter {
  readonly platform: PlatformType;

  /**
   * Whether this platform currently supports automated direct video publishing
   * under the current account/configuration.
   */
  supportsDirectPublish(credentials?: PlatformCredentials): boolean;

  /**
   * Execute or initiate content publication to the target platform.
   */
  publish(
    payload: PublishRequestPayload,
    credentials: PlatformCredentials
  ): Promise<PublishResult>;

  /**
   * Check asynchronous status of a publication in progress.
   */
  checkPublishStatus?(
    publishId: string,
    credentials: PlatformCredentials
  ): Promise<PublishStatusResult>;
}
