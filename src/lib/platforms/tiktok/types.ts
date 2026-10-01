export interface TikTokTokenResponse {
  open_id: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
  token_type: string;
}

export interface TikTokUserInfo {
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
}

export interface TikTokCreatorInfo {
  creator_avatar_url?: string;
  creator_username?: string;
  creator_nickname?: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}

export type TikTokPublishStatus =
  | 'PROCESSING_UPLOAD'
  | 'PROCESSING_DOWNLOAD'
  | 'SEND_TO_USER_INBOX'
  | 'PUBLISH_COMPLETE'
  | 'FAILED';

export interface TikTokPublishInitResponse {
  data?: {
    publish_id: string;
    upload_url?: string;
  };
  error: {
    code: string;
    message: string;
    log_id?: string;
  };
}

export interface TikTokPublishStatusResponse {
  data?: {
    status: TikTokPublishStatus;
    fail_reason?: string;
    publicaly_available_post_id?: string[];
  };
  error: {
    code: string;
    message: string;
    log_id?: string;
  };
}

export interface TikTokPostConfig {
  title: string;
  privacy_level?: string;
  disable_duet?: boolean;
  disable_stitch?: boolean;
  disable_comment?: boolean;
  is_aigc?: boolean;
  source?: 'FILE_UPLOAD' | 'PULL_FROM_URL';
  video_url?: string;
  video_size?: number;
  chunk_size?: number;
  total_chunk_count?: number;
}
