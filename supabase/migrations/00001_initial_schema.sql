-- PostFlow Database Schema
-- Migration: 00001_initial_schema
-- Creates all core tables, indexes, RLS policies, and triggers

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Helper function: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Table: profiles
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Table: platform_accounts
-- ============================================================
CREATE TABLE public.platform_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'shopee')),
  account_type TEXT NOT NULL DEFAULT 'standard' CHECK (account_type IN ('standard', 'seller', 'affiliate')),
  platform_user_id TEXT,
  platform_username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'expired', 'revoked')),
  scopes TEXT[],
  metadata JSONB DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_accounts_user_id ON public.platform_accounts(user_id);
CREATE INDEX idx_platform_accounts_user_platform ON public.platform_accounts(user_id, platform);
CREATE UNIQUE INDEX idx_platform_accounts_unique
  ON public.platform_accounts(user_id, platform, platform_user_id);

CREATE TRIGGER set_platform_accounts_updated_at
  BEFORE UPDATE ON public.platform_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own platform accounts"
  ON public.platform_accounts FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own platform accounts"
  ON public.platform_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own platform accounts"
  ON public.platform_accounts FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own platform accounts"
  ON public.platform_accounts FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- Table: content
-- ============================================================
CREATE TABLE public.content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  affiliate_url TEXT,
  affiliate_platform TEXT,
  affiliate_metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_user_id ON public.content(user_id);
CREATE INDEX idx_content_status ON public.content(status);
CREATE INDEX idx_content_user_status ON public.content(user_id, status);

CREATE TRIGGER set_content_updated_at
  BEFORE UPDATE ON public.content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content"
  ON public.content FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own content"
  ON public.content FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own content"
  ON public.content FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own content"
  ON public.content FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- Table: content_media
-- ============================================================
CREATE TABLE public.content_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('video', 'thumbnail', 'cover')),
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  file_size BIGINT,
  duration_seconds INTEGER,
  width INTEGER,
  height INTEGER,
  thumbnail_path TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_media_content_id ON public.content_media(content_id);

ALTER TABLE public.content_media ENABLE ROW LEVEL SECURITY;

-- Content media access is governed through content ownership
CREATE POLICY "Users can view own content media"
  ON public.content_media FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content
      WHERE content.id = content_media.content_id
      AND content.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own content media"
  ON public.content_media FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content
      WHERE content.id = content_media.content_id
      AND content.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own content media"
  ON public.content_media FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content
      WHERE content.id = content_media.content_id
      AND content.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete own content media"
  ON public.content_media FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content
      WHERE content.id = content_media.content_id
      AND content.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- Table: scheduled_posts
-- ============================================================
CREATE TABLE public.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  platform_account_id UUID NOT NULL REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'shopee')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_posts_scheduled_at ON public.scheduled_posts(scheduled_at);
CREATE INDEX idx_scheduled_posts_status ON public.scheduled_posts(status);
CREATE INDEX idx_scheduled_posts_user_platform ON public.scheduled_posts(user_id, platform);
-- Prevent duplicate active schedules for same content + account
CREATE UNIQUE INDEX idx_scheduled_posts_unique_active
  ON public.scheduled_posts(content_id, platform_account_id)
  WHERE status IN ('SCHEDULED', 'PROCESSING');

CREATE TRIGGER set_scheduled_posts_updated_at
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled posts"
  ON public.scheduled_posts FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own scheduled posts"
  ON public.scheduled_posts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own scheduled posts"
  ON public.scheduled_posts FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own scheduled posts"
  ON public.scheduled_posts FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- Table: publishing_jobs
-- ============================================================
CREATE TABLE public.publishing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_post_id UUID NOT NULL REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  platform_account_id UUID NOT NULL REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'shopee')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'UPLOADING', 'PUBLISHING', 'VERIFYING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  provider_post_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  provider_response JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_publishing_jobs_status ON public.publishing_jobs(status);
CREATE INDEX idx_publishing_jobs_next_retry
  ON public.publishing_jobs(next_retry_at)
  WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX idx_publishing_jobs_scheduled_post
  ON public.publishing_jobs(scheduled_post_id);

CREATE TRIGGER set_publishing_jobs_updated_at
  BEFORE UPDATE ON public.publishing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.publishing_jobs ENABLE ROW LEVEL SECURITY;

-- Jobs are accessed through scheduled_post ownership
CREATE POLICY "Users can view own publishing jobs"
  ON public.publishing_jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scheduled_posts
      WHERE scheduled_posts.id = publishing_jobs.scheduled_post_id
      AND scheduled_posts.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own publishing jobs"
  ON public.publishing_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scheduled_posts
      WHERE scheduled_posts.id = publishing_jobs.scheduled_post_id
      AND scheduled_posts.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own publishing jobs"
  ON public.publishing_jobs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scheduled_posts
      WHERE scheduled_posts.id = publishing_jobs.scheduled_post_id
      AND scheduled_posts.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- Table: publishing_attempts
-- ============================================================
CREATE TABLE public.publishing_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.publishing_jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'uploading', 'publishing', 'completed', 'failed')),
  error_message TEXT,
  error_code TEXT,
  provider_response JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_publishing_attempts_job_id ON public.publishing_attempts(job_id);

ALTER TABLE public.publishing_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own publishing attempts"
  ON public.publishing_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.publishing_jobs
      JOIN public.scheduled_posts ON scheduled_posts.id = publishing_jobs.scheduled_post_id
      WHERE publishing_jobs.id = publishing_attempts.job_id
      AND scheduled_posts.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own publishing attempts"
  ON public.publishing_attempts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.publishing_jobs
      JOIN public.scheduled_posts ON scheduled_posts.id = publishing_jobs.scheduled_post_id
      WHERE publishing_jobs.id = publishing_attempts.job_id
      AND scheduled_posts.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- Table: notifications
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('publish_success', 'publish_failure', 'account_issue', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'success')),
  data JSONB DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read = FALSE;
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- Storage: videos bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  FALSE,
  524288000, -- 500MB
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thumbnails',
  'thumbnails',
  TRUE,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can upload/read/delete only within their own folder
CREATE POLICY "Users can upload own videos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'videos' AND
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "Users can view own videos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'videos' AND
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "Users can delete own videos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'videos' AND
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "Users can upload own thumbnails"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'thumbnails' AND
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "Users can view thumbnails"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'thumbnails');

CREATE POLICY "Users can delete own thumbnails"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'thumbnails' AND
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ============================================================
-- Explicit Table & Schema Privileges
-- Ensures the 'authenticated' and 'service_role' roles have table
-- access while Row Level Security (RLS) strictly filters rows.
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_accounts TO authenticated;
GRANT ALL ON TABLE public.platform_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;

