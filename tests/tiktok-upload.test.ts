import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTikTokChunks,
  MIN_TIKTOK_CHUNK_SIZE,
  MAX_TIKTOK_CHUNK_SIZE,
} from '../src/lib/platforms/tiktok/chunks.ts';
import { TikTokClient } from '../src/lib/platforms/tiktok/client.ts';
import { TikTokAdapter } from '../src/lib/platforms/tiktok/adapter.ts';

describe('TikTok FILE_UPLOAD & Chunking Implementation', () => {
  describe('Chunk Calculation & Content-Range Generation', () => {
    it('should upload small files (< 5 MB) as a single chunk per TikTok rules', () => {
      const smallFileSize = 3 * 1024 * 1024; // 3 MB
      const plan = calculateTikTokChunks(smallFileSize);

      assert.strictEqual(plan.videoSize, smallFileSize);
      assert.strictEqual(plan.chunkSize, smallFileSize);
      assert.strictEqual(plan.totalChunkCount, 1);
      assert.strictEqual(plan.chunks.length, 1);

      const chunk0 = plan.chunks[0];
      assert.strictEqual(chunk0.chunkIndex, 0);
      assert.strictEqual(chunk0.startByte, 0);
      assert.strictEqual(chunk0.endByte, smallFileSize - 1);
      assert.strictEqual(chunk0.size, smallFileSize);
      assert.strictEqual(chunk0.contentRange, `bytes 0-${smallFileSize - 1}/${smallFileSize}`);
    });

    it('should calculate floor(video_size / chunk_size) chunks and absorb remainder in final chunk', () => {
      // 25 MB file with default 10 MB chunk size: floor(25/10) = 2 chunks
      const fileSize = 25 * 1024 * 1024; // 26,214,400 bytes
      const preferredChunk = 10 * 1024 * 1024; // 10,485,760 bytes
      const plan = calculateTikTokChunks(fileSize, preferredChunk);

      assert.strictEqual(plan.totalChunkCount, 2);
      assert.strictEqual(plan.chunks.length, 2);

      // Chunk 0: Exactly 10 MB
      const chunk0 = plan.chunks[0];
      assert.strictEqual(chunk0.chunkIndex, 0);
      assert.strictEqual(chunk0.startByte, 0);
      assert.strictEqual(chunk0.endByte, preferredChunk - 1);
      assert.strictEqual(chunk0.size, preferredChunk);
      assert.strictEqual(chunk0.contentRange, `bytes 0-${preferredChunk - 1}/${fileSize}`);

      // Chunk 1 (final chunk): 10 MB + 5 MB remainder = 15 MB
      const chunk1 = plan.chunks[1];
      assert.strictEqual(chunk1.chunkIndex, 1);
      assert.strictEqual(chunk1.startByte, preferredChunk);
      assert.strictEqual(chunk1.endByte, fileSize - 1);
      assert.strictEqual(chunk1.size, 15 * 1024 * 1024);
      assert.strictEqual(chunk1.contentRange, `bytes ${preferredChunk}-${fileSize - 1}/${fileSize}`);

      // Total bytes uploaded must equal exact file size
      assert.strictEqual(chunk0.size + chunk1.size, fileSize);
    });

    it('should clamp chunk size to minimum 5 MB and maximum 64 MB', () => {
      const fileSize = 50 * 1024 * 1024; // 50 MB

      // Request 1 MB chunk -> clamped to 5 MB
      const minClampedPlan = calculateTikTokChunks(fileSize, 1 * 1024 * 1024);
      assert.strictEqual(minClampedPlan.chunkSize, MIN_TIKTOK_CHUNK_SIZE);

      // Request 100 MB chunk -> clamped to 64 MB
      const maxClampedPlan = calculateTikTokChunks(fileSize, 100 * 1024 * 1024);
      assert.strictEqual(maxClampedPlan.chunkSize, MAX_TIKTOK_CHUNK_SIZE);
    });

    it('should reject invalid or negative video sizes', () => {
      assert.throws(() => calculateTikTokChunks(0), /Invalid video size/);
      assert.throws(() => calculateTikTokChunks(-100), /Invalid video size/);
      assert.throws(() => calculateTikTokChunks(NaN), /Invalid video size/);
    });
  });

  describe('TikTok Client FILE_UPLOAD Integration', () => {
    it('should format source_info with FILE_UPLOAD parameters when requested', async () => {
      const client = new TikTokClient({
        clientKey: 'test_key',
        clientSecret: 'test_secret',
        redirectUri: 'https://test.ngrok.app/callback',
      });

      // Intercept fetch to verify init payload
      let capturedBody: Record<string, unknown> | null = null;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, init) => {
        if (typeof url === 'string' && url.includes('/post/publish/video/init/')) {
          capturedBody = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              data: {
                publish_id: 'v_pub_file_upload_123',
                upload_url: 'https://open-upload.tiktokapis.com/upload/v1/test',
              },
              error: { code: 'ok', message: '' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return originalFetch(url, init);
      };

      try {
        const initRes = await client.initPublish('mock_access_token', {
          title: 'FILE_UPLOAD Test',
          source: 'FILE_UPLOAD',
          video_size: 15000000,
          chunk_size: 10000000,
          total_chunk_count: 1,
        });

        assert.ok(capturedBody !== null);
        const bodyMap = capturedBody as Record<string, unknown>;
        const sourceInfo = bodyMap.source_info as Record<string, unknown>;
        assert.strictEqual(sourceInfo.source, 'FILE_UPLOAD');
        assert.strictEqual(sourceInfo.video_size, 15000000);
        assert.strictEqual(sourceInfo.chunk_size, 10000000);
        assert.strictEqual(sourceInfo.total_chunk_count, 1);
        assert.strictEqual(initRes.data?.publish_id, 'v_pub_file_upload_123');
        assert.strictEqual(initRes.data?.upload_url, 'https://open-upload.tiktokapis.com/upload/v1/test');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should upload chunks sequentially with PUT and correct Content-Range', async () => {
      const client = new TikTokClient();
      const testBuffer = Buffer.alloc(12 * 1024 * 1024, 0xaa); // 12 MB
      const plan = calculateTikTokChunks(testBuffer.length, 10 * 1024 * 1024);

      const capturedPutRequests: Array<{
        range: string | null;
        length: string | null;
        bytes: number;
      }> = [];

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, init) => {
        if (typeof url === 'string' && url.includes('/upload/')) {
          const headers = new Headers(init?.headers);
          capturedPutRequests.push({
            range: headers.get('Content-Range'),
            length: headers.get('Content-Length'),
            bytes: (init?.body as Buffer).byteLength,
          });
          return new Response('', { status: 200 });
        }
        return originalFetch(url, init);
      };

      try {
        const uploadRes = await client.uploadVideoInChunks(
          'https://open-upload.tiktokapis.com/upload/v1/stream',
          testBuffer,
          plan
        );

        assert.strictEqual(uploadRes.totalUploadedChunks, plan.totalChunkCount);
        assert.strictEqual(capturedPutRequests.length, plan.totalChunkCount);
        assert.strictEqual(capturedPutRequests[0].range, plan.chunks[0].contentRange);
        assert.strictEqual(capturedPutRequests[0].length, plan.chunks[0].size.toString());
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('TikTok Adapter Transfer Mode Precedence', () => {
    it('should prefer FILE_UPLOAD when videoBuffer is provided', async () => {
      const adapter = new TikTokAdapter();
      assert.strictEqual(adapter.supportsDirectPublish(), true);

      // In development simulation mode with mock token
      const res = await adapter.publish(
        {
          contentId: 'c-1',
          title: 'Direct Video Post',
          caption: 'Testing FILE_UPLOAD',
          hashtags: ['test'],
          videoStoragePath: 'user1/c-1/video.mp4',
          videoUrl: 'https://project.supabase.co/video.mp4',
          videoBuffer: Buffer.alloc(1024),
          transferMode: 'FILE_UPLOAD',
          affiliateUrl: null,
          affiliatePlatform: null,
        },
        {
          platform: 'tiktok',
          platformUserId: 'tt-1',
          accessToken: 'stub_test_token',
          accountType: 'standard',
        }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.status, 'PUBLISHED');
      assert.ok(res.publishId?.startsWith('v_pub_'));
    });
  });
});
