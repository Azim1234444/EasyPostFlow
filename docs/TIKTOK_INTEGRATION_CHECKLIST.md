# PostFlow - Real TikTok Integration Testing Checklist

This guide provides the exact step-by-step procedure for verifying PostFlow's end-to-end TikTok scheduling and publishing pipeline with a real TikTok test account.

---

## 1. Prerequisites in TikTok Developer Portal

1. **Log in to TikTok Developer Portal**:
   - Go to [https://developers.tiktok.com](https://developers.tiktok.com) and log in.
2. **Create or Select App**:
   - Navigate to **Manage Apps** -> click your PostFlow app.
3. **Add Required Products**:
   - Add **Login Kit**
   - Add **Content Posting API**
4. **Configure Permissions (Scopes)**:
   - Ensure the following two scopes are added to the application:
     - `user.info.basic`: Read creator username and avatar.
     - `video.publish`: Post videos directly to creator account (Direct Post).
     - *(Note: `video.upload` is NOT required because PostFlow uses Direct Post, not Inbox Draft uploads)*.
5. **Configure Redirect URI**:
   - Under **Login Kit** -> **Redirect Domains & URIs**:
     - For local testing: `http://localhost:3000/api/platforms/tiktok/callback`
     - For production: `https://your-domain.com/api/platforms/tiktok/callback`
     - *IMPORTANT*: Must match character-for-character including protocol and port.
6. **Register Sandbox / Test Accounts (Crucial)**:
   - In Development / Unaudited mode, TikTok restricts API calls to authorized test accounts.
   - Go to **App Roles** -> **Test Accounts** -> Add your TikTok test handle/email.
   - On your mobile phone, log into the TikTok app with this test account and accept the tester invitation.

---

## 2. Local Environment Setup

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
2. Configure required keys in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key.
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (bypasses RLS in worker).
   - `TOKEN_ENCRYPTION_KEY`: 64-hex AES-256 key (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - `TIKTOK_CLIENT_KEY`: Client Key from TikTok App Details.
   - `TIKTOK_CLIENT_SECRET`: Client Secret from TikTok App Details.
   - `TIKTOK_REDIRECT_URI`: `http://localhost:3000/api/platforms/tiktok/callback`
   - `NEXT_PUBLIC_APP_URL`: `http://localhost:3000`
   - `INNGEST_EVENT_KEY`: Local dev key (`inngest-local`) or cloud event key.
   - `INNGEST_SIGNING_KEY`: Local dev key or cloud signing key.
3. Ensure Supabase Storage `videos` bucket exists:
   - Bucket `videos` must exist in Supabase Storage with authenticated upload policies.
4. Start the Inngest Dev Server:
   ```bash
   npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
   ```
5. Start Next.js Development Server:
   ```bash
   npm run dev
   ```

---

## 3. End-to-End Test Procedure

### Test 1: TikTok OAuth 2.0 PKCE Flow
1. Open browser and sign in to PostFlow at `http://localhost:3000/login`.
2. Navigate to **Connected Accounts** (`/accounts`).
3. Click **Connect TikTok**.
4. Verify browser redirects to `https://www.tiktok.com/v2/auth/authorize/` with:
   - `client_key`, `scope=user.info.basic,video.publish`, `code_challenge_method=S256`, and `state`.
5. Log in with your registered TikTok Sandbox Test Account.
6. Review and accept permissions on TikTok consent screen.
7. Verify browser redirects back to `http://localhost:3000/accounts?success=tiktok_connected`.
8. Verify UI displays:
   - Creator Display Name and Avatar.
   - Platform badge: "TikTok".
   - Status: "Connected".
9. Database Verification:
   - Inspect PostgreSQL `platform_accounts` table:
     - `access_token_encrypted` must be in format `iv:authTag:ciphertext`.
     - `refresh_token_encrypted` must be encrypted.
     - `token_expires_at` must be a future ISO date (~86,400 seconds / 24 hours).

---

### Test 2: Scheduled Publishing Pipeline (Due / Immediate Execution)
1. Navigate to **Content Library** -> **Create Post** (`/content/new`).
2. Upload a test video:
   - Format: MP4 or MOV.
   - Resolution: Vertical 1080x1920 (9:16).
   - Codec: H.264 / AAC.
   - Duration: 5-15 seconds.
   - Size: < 20MB.
3. Fill Title: "PostFlow Automated Test #{timestamp}".
4. Fill Caption: "Testing scheduled TikTok API publishing via PostFlow #affiliate #postflow".
5. Target Platform: Select **TikTok**.
6. Set Schedule Time: Set to current time or 1 minute ago.
7. Click **Schedule Post**.
8. Observe Inngest Dashboard (`http://localhost:8288`):
   - Event `postflow/post.publish.requested` is received.
   - **Step 0 (`check-schedule-timing`)**: Returns `shouldWait: false`.
   - **Step 1 (`verify-and-lock-job`)**: Acquires job lock, sets status to `PROCESSING`.
   - **Step 2 (`prepare-content-and-credentials`)**: Generates signed video URL from Supabase Storage.
   - **Step 3 (`execute-platform-publish`)**:
     - Queries TikTok `/v2/post/publish/creator_info/query/`.
     - Calls `/v2/post/publish/video/init/` with `PULL_FROM_URL`.
     - Receives `publish_id`.
   - **Step 3.5 (`poll-tiktok-status-1..4`)**:
     - Sleeps 10-15 seconds between polls.
     - Polls `/v2/post/publish/status/fetch/`.
     - Waits until TikTok returns `PUBLISH_COMPLETE`.
   - **Step 4 (`record-result-and-notify`)**:
     - Updates database: `publishing_jobs.status = 'COMPLETED'`, `scheduled_posts.status = 'PUBLISHED'`.
     - Inserts success notification in PostFlow.
9. Verify on TikTok Mobile App:
   - Open TikTok on phone with test account.
   - Verify video appears on creator profile (or inbox if privacy was `SELF_ONLY`).

---

### Test 3: Future Scheduled Execution (Delay & Sleep Verification)
1. Create a post and schedule it **5 minutes in the future**.
2. Check Inngest Dev Server dashboard:
   - Event is triggered.
   - **Step 0**: Detects `shouldWait: true` and enters `step.sleepUntil`.
   - Job is paused in `SLEEPING` state until the exact scheduled timestamp.
3. Observe at the scheduled time:
   - Job resumes automatically.
   - `verify-status-after-wakeup` verifies post is still valid.
   - Publishing pipeline completes successfully.

---

### Test 4: Cancellation While Waiting
1. Create a post and schedule it **10 minutes in the future**.
2. Verify Inngest job is sleeping in Step 0.
3. In PostFlow UI, click **Cancel Post** (or delete the post).
4. Verify post status changes to `CANCELLED` in database.
5. In Inngest Dev Server, click **Rerun Step** or wait for sleep timer to expire.
6. Verify worker wakes up, detects `CANCELLED_WHILE_WAITING`, and terminates with `status: 'SKIPPED'` without calling TikTok APIs.

---

### Test 5: Automatic Token Refresh Before Publishing
1. In PostgreSQL, simulate an expired token:
   ```sql
   UPDATE platform_accounts
   SET token_expires_at = NOW() - INTERVAL '1 hour'
   WHERE platform = 'tiktok';
   ```
2. Schedule a post for immediate execution.
3. Observe Inngest worker Step 2:
   - Detects `isExpiredOrNear = true`.
   - Decrypts refresh token.
   - Calls TikTok `/v2/oauth/token/` with `grant_type=refresh_token`.
   - Receives new access & refresh tokens.
   - Re-encrypts with AES-256-GCM and updates `platform_accounts`.
   - Continues publishing with the newly refreshed credentials.

---

## 4. Diagnostics & Troubleshooting Reference

If any stage fails during integration testing, consult this table:

| Symptom / Error | Root Cause | Remediation |
| :--- | :--- | :--- |
| `OAuth state verification failed` | Cookie expired or blocked by browser | Disable third-party cookie blocking; reconnect within 10 minutes. |
| `redirect_uri mismatch` | Registered URI does not match exact string in `.env.local` | Update TikTok Developer Portal -> Login Kit redirect URI. |
| `unaudited_client_can_only_post_to_admin` | App is in Development mode and account is not a test user | Add test account in Developer Portal -> App Roles -> Test Users. |
| `video_url_inaccessible` | TikTok cannot pull video from Supabase Storage | Ensure `videos` bucket is accessible; check signed URL expiration. |
| `reach_max_video_publish_limit` | Creator reached daily upload quota on TikTok | Wait 24 hours or test with another creator account. |
| `token_refresh_failed: invalid_grant` | Refresh token expired (after 365 days) or revoked | User must reconnect account via `/accounts`. |
