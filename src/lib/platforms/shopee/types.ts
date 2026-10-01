import type { AccountType } from '../../../types/database.ts';

export interface ShopeePartnerCredentials {
  partnerId: string;
  partnerKey: string;
  shopId?: string;
  accessToken?: string;
  accountType: AccountType;
}

export interface ShopeeSignatureParams {
  partnerId: string;
  apiPath: string;
  timestamp: number;
  accessToken?: string;
  shopId?: string;
  partnerKey: string;
}

export interface ShopeeVideoInitResponse {
  error: string;
  message: string;
  response?: {
    video_id: string;
    upload_url: string;
  };
  request_id: string;
}

export interface ShopeeVideoPublishResponse {
  error: string;
  message: string;
  response?: {
    item_id?: string;
    video_id: string;
    status: string;
  };
  request_id: string;
}

export interface ShopeeAffiliateLinkResponse {
  shortLink?: string;
  originalLink: string;
  timestamp: string;
}
