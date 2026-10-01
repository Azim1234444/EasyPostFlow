-- Migration: 00002_grant_platform_accounts_permissions.sql
-- Description: Grant explicit table permissions on platform_accounts and all public tables
-- to the 'authenticated' and 'service_role' PostgreSQL roles while keeping Row Level Security (RLS) fully enabled.

-- 1. Ensure schema usage privileges
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Explicit grants on platform_accounts
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_accounts TO authenticated;
GRANT ALL ON TABLE public.platform_accounts TO service_role;

-- 3. Explicit grants on all public tables for authenticated users and service_role
-- Note: Row Level Security (RLS) remains active and strictly enforced on all tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 4. Explicit grants on sequences for auto-generated identifiers
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 5. Set default privileges so future tables automatically inherit these permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
