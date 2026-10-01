import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contentFormSchema,
  mediaAttachmentSchema,
  MAX_VIDEO_FILE_SIZE_BYTES,
} from '../src/lib/validators/content.ts';

test('contentFormSchema: parses valid content successfully', () => {
  const input = {
    title: '  Summer Fashion Reel 2026  ',
    caption: 'Check out these top fashion picks! #summer #style',
    hashtags: ['#summer', 'fashion', '#ootd'],
    affiliate_url: 'https://shope.ee/xyz123',
    affiliate_platform: 'shopee' as const,
    status: 'DRAFT' as const,
  };

  const parsed = contentFormSchema.parse(input);

  assert.equal(parsed.title, 'Summer Fashion Reel 2026');
  assert.equal(parsed.caption, 'Check out these top fashion picks! #summer #style');
  assert.deepEqual(parsed.hashtags, ['summer', 'fashion', 'ootd']);
  assert.equal(parsed.affiliate_url, 'https://shope.ee/xyz123');
  assert.equal(parsed.affiliate_platform, 'shopee');
  assert.equal(parsed.status, 'DRAFT');
});

test('contentFormSchema: rejects empty or missing title', () => {
  assert.throws(
    () => contentFormSchema.parse({ title: '' }),
    (err: Error) => err.message.includes('Title is required')
  );

  assert.throws(
    () => contentFormSchema.parse({ title: '    ' }),
    (err: Error) => err.message.includes('Title is required')
  );
});

test('contentFormSchema: enforces 150 char max title length', () => {
  const longTitle = 'a'.repeat(151);
  assert.throws(
    () => contentFormSchema.parse({ title: longTitle }),
    (err: Error) => err.message.includes('Title cannot exceed 150 characters')
  );
});

test('contentFormSchema: enforces 2200 char TikTok caption limit', () => {
  const longCaption = 'c'.repeat(2201);
  assert.throws(
    () => contentFormSchema.parse({ title: 'Valid Title', caption: longCaption }),
    (err: Error) => err.message.includes('Caption cannot exceed 2200 characters')
  );
});

test('contentFormSchema: normalizes comma-separated hashtag string', () => {
  const parsed = contentFormSchema.parse({
    title: 'Post with string hashtags',
    hashtags: '#viral, tech,  #review gadget',
  });

  assert.deepEqual(parsed.hashtags, ['viral', 'tech', 'review', 'gadget']);
});

test('contentFormSchema: validates affiliate URL format', () => {
  assert.throws(
    () =>
      contentFormSchema.parse({
        title: 'Title',
        affiliate_url: 'not-a-valid-url',
      }),
    (err: Error) => err.message.includes('Must be a valid URL')
  );

  // Empty string should be transformed to null
  const withEmpty = contentFormSchema.parse({
    title: 'Title',
    affiliate_url: '',
  });
  assert.equal(withEmpty.affiliate_url, null);
});

test('mediaAttachmentSchema: accepts valid MP4, MOV, WebM videos', () => {
  const validMp4 = {
    media_type: 'video' as const,
    storage_path: 'user-1/123-video.mp4',
    original_filename: 'video.mp4',
    mime_type: 'video/mp4',
    file_size: 15 * 1024 * 1024,
    duration_seconds: 35,
    width: 1080,
    height: 1920,
  };

  const parsed = mediaAttachmentSchema.parse(validMp4);
  assert.equal(parsed.storage_path, 'user-1/123-video.mp4');
  assert.equal(parsed.mime_type, 'video/mp4');
});

test('mediaAttachmentSchema: rejects unsupported MIME types', () => {
  assert.throws(
    () =>
      mediaAttachmentSchema.parse({
        media_type: 'video',
        storage_path: 'user-1/file.flv',
        mime_type: 'video/x-flv',
        file_size: 1000,
      }),
    (err: Error) => err.message.includes('Unsupported media MIME type')
  );

  assert.throws(
    () =>
      mediaAttachmentSchema.parse({
        media_type: 'video',
        storage_path: 'user-1/doc.pdf',
        mime_type: 'application/pdf',
        file_size: 1000,
      }),
    (err: Error) => err.message.includes('Unsupported media MIME type')
  );
});

test('mediaAttachmentSchema: rejects files exceeding 500 MB limit', () => {
  const oversizedBytes = MAX_VIDEO_FILE_SIZE_BYTES + 1;

  assert.throws(
    () =>
      mediaAttachmentSchema.parse({
        media_type: 'video',
        storage_path: 'user-1/huge.mp4',
        mime_type: 'video/mp4',
        file_size: oversizedBytes,
      }),
    (err: Error) => err.message.includes('File size cannot exceed 500 MB')
  );
});
