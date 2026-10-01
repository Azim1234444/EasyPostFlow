import { z } from 'zod';

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime', // .mov
  'video/webm',
] as const;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_VIDEO_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
export const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const mediaAttachmentSchema = z.object({
  media_type: z.enum(['video', 'thumbnail', 'cover']),
  storage_path: z.string().min(1, 'Storage path is required'),
  original_filename: z.string().nullable().optional(),
  mime_type: z.string().refine(
    (type) =>
      ALLOWED_VIDEO_MIME_TYPES.includes(type as (typeof ALLOWED_VIDEO_MIME_TYPES)[number]) ||
      ALLOWED_IMAGE_MIME_TYPES.includes(type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]),
    { message: 'Unsupported media MIME type' }
  ),
  file_size: z
    .number()
    .positive('File size must be positive')
    .max(MAX_VIDEO_FILE_SIZE_BYTES, 'File size cannot exceed 500 MB')
    .nullable()
    .optional(),
  duration_seconds: z.number().nonnegative().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  thumbnail_path: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const contentFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(150, 'Title cannot exceed 150 characters'),
  caption: z
    .string()
    .max(2200, 'Caption cannot exceed 2200 characters (TikTok limit)')
    .nullable()
    .optional()
    .transform((val) => val || null),
  hashtags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((val) => {
      if (!val) return [];
      if (Array.isArray(val)) {
        return val.map((h) => h.replace(/^#/, '').trim()).filter(Boolean);
      }
      return val
        .split(/[\s,]+/)
        .map((h) => h.replace(/^#/, '').trim())
        .filter(Boolean);
    }),
  affiliate_url: z
    .string()
    .trim()
    .url('Must be a valid URL (e.g. https://shopee.com/...)')
    .or(z.literal(''))
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  affiliate_platform: z
    .enum(['shopee', 'tiktok_shop', 'amazon', 'lazada', 'other'])
    .or(z.literal(''))
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  affiliate_metadata: z.record(z.string(), z.unknown()).default({}),
  status: z
    .enum(['DRAFT', 'SCHEDULED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'CANCELLED'])
    .default('DRAFT'),
  media: z.array(mediaAttachmentSchema).optional().default([]),
});

export type ContentFormValues = z.input<typeof contentFormSchema>;
export type ContentValidatedData = z.output<typeof contentFormSchema>;
export type MediaAttachmentData = z.infer<typeof mediaAttachmentSchema>;
