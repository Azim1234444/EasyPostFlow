export type ContentStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELLED';

export type MediaType = 'video' | 'thumbnail' | 'cover';

export type PlatformType = 'tiktok' | 'shopee';

export type AccountType = 'standard' | 'seller' | 'affiliate';

export type AccountStatus = 'connected' | 'disconnected' | 'expired' | 'revoked';

export type JobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'UPLOADING'
  | 'PUBLISHING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type NotificationType =
  | 'publish_success'
  | 'publish_failure'
  | 'account_issue'
  | 'system';

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PlatformAccount {
  id: string;
  user_id: string;
  platform: PlatformType;
  account_type: AccountType;
  platform_user_id: string | null;
  platform_username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  status: AccountStatus;
  scopes: string[] | null;
  metadata: Record<string, unknown>;
  connected_at: string;
  updated_at: string;
}

export interface Content {
  id: string;
  user_id: string;
  title: string;
  caption: string | null;
  hashtags: string[];
  affiliate_url: string | null;
  affiliate_platform: string | null;
  affiliate_metadata: Record<string, unknown>;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

export interface ContentMedia {
  id: string;
  content_id: string;
  media_type: MediaType;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  thumbnail_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ContentWithMedia extends Content {
  media?: ContentMedia[];
}

export interface ScheduledPost {
  id: string;
  content_id: string;
  platform_account_id: string;
  user_id: string;
  platform: PlatformType;
  scheduled_at: string;
  timezone: string;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

export interface PublishingJob {
  id: string;
  scheduled_post_id: string;
  content_id: string;
  platform_account_id: string;
  platform: PlatformType;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  provider_post_id: string | null;
  idempotency_key: string;
  started_at: string | null;
  completed_at: string | null;
  next_retry_at: string | null;
  provider_response: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PublishingAttempt {
  id: string;
  job_id: string;
  attempt_number: number;
  status: string;
  error_message: string | null;
  error_code: string | null;
  provider_response: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  data: Record<string, unknown>;
  read: boolean;
  read_at: string | null;
  created_at: string;
}
