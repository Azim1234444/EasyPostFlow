/**
 * TikTok Content Posting API - Video Chunking Utilities
 *
 * Implements official TikTok chunking specifications for the FILE_UPLOAD method:
 * - Chunk size must be between 5 MB (5,242,880 bytes) and 64 MB (67,108,864 bytes).
 * - Total chunk count formula: floor(video_size / chunk_size).
 * - Final chunk exception: absorbs trailing bytes up to 128 MB (134,217,728 bytes).
 * - Files smaller than 5 MB must be uploaded as a single chunk.
 * - Total chunk count must be between 1 and 1,000.
 */

export const MIN_TIKTOK_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB (5,242,880 bytes)
export const MAX_TIKTOK_CHUNK_SIZE = 64 * 1024 * 1024; // 64 MB (67,108,864 bytes)
export const DEFAULT_TIKTOK_CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB (10,485,760 bytes)
export const MAX_TIKTOK_FINAL_CHUNK_SIZE = 128 * 1024 * 1024; // 128 MB (134,217,728 bytes)

export interface TikTokChunkDescriptor {
  chunkIndex: number;
  startByte: number;
  endByte: number;
  size: number;
  contentRange: string;
}

export interface TikTokChunkPlan {
  videoSize: number;
  chunkSize: number;
  totalChunkCount: number;
  chunks: TikTokChunkDescriptor[];
}

/**
 * Calculates TikTok-compliant chunk parameters and sequential byte ranges for a video file.
 *
 * @param videoSize Total size of the video in bytes
 * @param preferredChunkSize Preferred chunk size (defaults to 10 MB)
 */
export function calculateTikTokChunks(
  videoSize: number,
  preferredChunkSize = DEFAULT_TIKTOK_CHUNK_SIZE
): TikTokChunkPlan {
  if (!Number.isFinite(videoSize) || videoSize <= 0) {
    throw new Error(`Invalid video size: ${videoSize}. Must be a positive integer.`);
  }

  // Small file rule: under 5 MB must be uploaded in 1 single chunk
  if (videoSize < MIN_TIKTOK_CHUNK_SIZE) {
    return {
      videoSize,
      chunkSize: videoSize,
      totalChunkCount: 1,
      chunks: [
        {
          chunkIndex: 0,
          startByte: 0,
          endByte: videoSize - 1,
          size: videoSize,
          contentRange: `bytes 0-${videoSize - 1}/${videoSize}`,
        },
      ],
    };
  }

  // Clamp preferred chunk size between 5 MB and 64 MB
  const chunkSize = Math.max(
    MIN_TIKTOK_CHUNK_SIZE,
    Math.min(preferredChunkSize, MAX_TIKTOK_CHUNK_SIZE)
  );

  // Official TikTok formula: floor(video_size / chunk_size)
  let totalChunkCount = Math.floor(videoSize / chunkSize);
  if (totalChunkCount < 1) {
    totalChunkCount = 1;
  }

  // Enforce TikTok maximum 1000 chunks limit
  if (totalChunkCount > 1000) {
    throw new Error(
      `Video requires ${totalChunkCount} chunks, exceeding TikTok's maximum limit of 1000 chunks.`
    );
  }

  const chunks: TikTokChunkDescriptor[] = [];

  for (let i = 0; i < totalChunkCount; i++) {
    const startByte = i * chunkSize;
    const isFinalChunk = i === totalChunkCount - 1;

    // The final chunk absorbs trailing remainder bytes
    const endByte = isFinalChunk ? videoSize - 1 : (i + 1) * chunkSize - 1;
    const size = endByte - startByte + 1;

    if (isFinalChunk && size > MAX_TIKTOK_FINAL_CHUNK_SIZE) {
      throw new Error(
        `Final chunk size (${size} bytes) exceeds TikTok's maximum final chunk limit of 128 MB.`
      );
    }

    chunks.push({
      chunkIndex: i,
      startByte,
      endByte,
      size,
      contentRange: `bytes ${startByte}-${endByte}/${videoSize}`,
    });
  }

  return {
    videoSize,
    chunkSize,
    totalChunkCount,
    chunks,
  };
}
