'use client';

import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileVideo, CheckCircle2, AlertCircle, X, Play, Pause, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_VIDEO_FILE_SIZE_BYTES,
  type MediaAttachmentData,
} from '@/lib/validators/content';
import { createSignedUploadUrl } from '@/lib/actions/content';

interface VideoUploaderProps {
  initialMedia?: MediaAttachmentData[];
  onMediaChange: (media: MediaAttachmentData[]) => void;
  disabled?: boolean;
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  thumbnailBlob?: Blob;
  thumbnailPreviewUrl?: string;
}

export function VideoUploader({
  initialMedia = [],
  onMediaChange,
  disabled = false,
}: VideoUploaderProps) {
  const [mediaList, setMediaList] = useState<MediaAttachmentData[]>(initialMedia);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Video preview player state
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Extract video dimensions, duration, and generate a representative thumbnail
   */
  const extractVideoMetadata = (file: File): Promise<VideoMetadata> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const fileUrl = URL.createObjectURL(file);
      video.src = fileUrl;

      video.onloadedmetadata = () => {
        // Seek to 1s or middle to get a clear frame
        const seekTime = Math.min(1.0, video.duration / 2);
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 720;
          canvas.height = video.videoHeight || 1280;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
              (blob) => {
                URL.revokeObjectURL(fileUrl);
                if (blob) {
                  const thumbPreview = URL.createObjectURL(blob);
                  resolve({
                    duration: Math.round(video.duration),
                    width: video.videoWidth,
                    height: video.videoHeight,
                    thumbnailBlob: blob,
                    thumbnailPreviewUrl: thumbPreview,
                  });
                } else {
                  resolve({
                    duration: Math.round(video.duration),
                    width: video.videoWidth,
                    height: video.videoHeight,
                  });
                }
              },
              'image/jpeg',
              0.85
            );
          } else {
            URL.revokeObjectURL(fileUrl);
            resolve({
              duration: Math.round(video.duration),
              width: video.videoWidth,
              height: video.videoHeight,
            });
          }
        } catch {
          URL.revokeObjectURL(fileUrl);
          resolve({
            duration: Math.round(video.duration),
            width: video.videoWidth,
            height: video.videoHeight,
          });
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(fileUrl);
        reject(new Error('Failed to load video file. Please check file integrity.'));
      };
    });
  };

  /**
   * Upload binary data directly to signed storage URL with progress
   */
  const uploadToSignedUrl = (
    signedUrl: string,
    fileData: Blob | File,
    contentType: string,
    onProgressUpdate: (percentage: number) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl, true);
      xhr.setRequestHeader('Content-Type', contentType);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgressUpdate(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during file upload'));
      xhr.send(fileData);
    });
  };

  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);

    // 1. Validation: MIME Type
    const isValidMime = ALLOWED_VIDEO_MIME_TYPES.some((type) => file.type === type);
    if (!isValidMime) {
      setErrorMessage(
        `Invalid file type (${file.type || 'unknown'}). Please upload MP4, QuickTime (MOV), or WebM.`
      );
      return;
    }

    // 2. Validation: File Size
    if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
      setErrorMessage(
        `File is too large (${formatFileSize(file.size)}). Maximum allowed size is 500 MB.`
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);

    try {
      // 3. Extract metadata & generate client-side thumbnail
      const meta = await extractVideoMetadata(file);
      setUploadProgress(15);

      // Local preview URL
      const localPreview = URL.createObjectURL(file);
      setVideoPreviewUrl(localPreview);

      // 4. Request signed URL for Video
      const videoCreds = await createSignedUploadUrl('videos', file.name);
      if (videoCreds.error || !videoCreds.data) {
        throw new Error(videoCreds.error || 'Failed to authorize video upload');
      }

      setUploadProgress(20);

      // 5. Upload Video file
      await uploadToSignedUrl(
        videoCreds.data.signedUrl,
        file,
        file.type,
        (percent) => {
          // Video upload occupies 20% to 80% of total progress
          setUploadProgress(20 + Math.round(percent * 0.6));
        }
      );

      // 6. If thumbnail generated, upload thumbnail
      let thumbPath: string | null = null;
      if (meta.thumbnailBlob) {
        const thumbCreds = await createSignedUploadUrl('thumbnails', 'thumbnail.jpg');
        if (thumbCreds.data) {
          await uploadToSignedUrl(
            thumbCreds.data.signedUrl,
            meta.thumbnailBlob,
            'image/jpeg',
            () => {}
          );
          thumbPath = thumbCreds.data.path;
        }
      }

      setUploadProgress(100);

      const newMedia: MediaAttachmentData = {
        media_type: 'video',
        storage_path: videoCreds.data.path,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        duration_seconds: meta.duration,
        width: meta.width,
        height: meta.height,
        thumbnail_path: thumbPath,
        metadata: {
          client_preview_thumb: meta.thumbnailPreviewUrl,
        },
      };

      const updated = [newMedia];
      setMediaList(updated);
      onMediaChange(updated);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        handleProcessFile(file);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleProcessFile(file);
    }
  };

  const handleRemoveMedia = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    }
    setMediaList([]);
    onMediaChange([]);
    setErrorMessage(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const activeMedia = mediaList[0];

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Error Banner */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="ml-auto text-destructive hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Uploading State */}
      {isUploading && (
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Processing and uploading video...</span>
          </div>
          <Progress value={uploadProgress} className="h-2 w-full max-w-md mx-auto" />
          <p className="text-xs text-muted-foreground">{uploadProgress}% uploaded</p>
        </div>
      )}

      {/* Active Video State */}
      {!isUploading && activeMedia && (
        <div className="relative rounded-xl border border-border bg-slate-950 text-white overflow-hidden shadow-sm">
          <div className="aspect-[9/16] max-h-[380px] w-full relative flex items-center justify-center bg-black">
            {videoPreviewUrl ? (
              <video
                ref={videoRef}
                src={videoPreviewUrl}
                className="h-full w-full object-contain"
                onEnded={() => setIsPlaying(false)}
                onClick={toggleVideoPlay}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                <FileVideo className="h-16 w-16" />
                <span className="text-xs">Uploaded video</span>
              </div>
            )}

            {videoPreviewUrl && (
              <button
                type="button"
                onClick={toggleVideoPlay}
                className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform hover:scale-110"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>
            )}

            <button
              type="button"
              onClick={handleRemoveMedia}
              className="absolute top-3 right-3 rounded-full bg-black/70 p-1.5 text-white transition-colors hover:bg-destructive"
              title="Remove video"
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="truncate max-w-[220px] font-medium text-white">
                {activeMedia.original_filename || 'video.mp4'}
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ready
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              {activeMedia.file_size && <span>{formatFileSize(activeMedia.file_size)}</span>}
              {activeMedia.duration_seconds && (
                <span>Duration: {formatDuration(activeMedia.duration_seconds)}</span>
              )}
              {activeMedia.width && activeMedia.height && (
                <span>
                  {activeMedia.width}x{activeMedia.height}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty Dropzone State */}
      {!isUploading && !activeMedia && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="rounded-full bg-muted p-3 mb-3 text-muted-foreground">
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">Click to upload or drag and drop short video</p>
          <p className="text-xs text-muted-foreground mt-1">
            MP4, MOV or WebM (up to 500 MB, 9:16 vertical recommended)
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 pointer-events-none"
            tabIndex={-1}
          >
            Select video
          </Button>
        </div>
      )}
    </div>
  );
}
