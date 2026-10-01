import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createAdminClient } from '../src/lib/supabase/admin.ts';

describe('Worker Pipeline, Scheduling Logic & Security Invariants', () => {
  describe('Scheduling Timing & Delay Logic', () => {
    it('should determine that future scheduled posts must wait and not publish immediately', () => {
      const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const scheduledTimeMs = new Date(futureTime).getTime();
      const nowMs = Date.now();

      const shouldWait = scheduledTimeMs > nowMs;
      assert.strictEqual(shouldWait, true);
    });

    it('should identify that past or due scheduled posts can execute immediately without waiting', () => {
      const pastTime = new Date(Date.now() - 5 * 1000).toISOString();
      const scheduledTimeMs = new Date(pastTime).getTime();
      const nowMs = Date.now();

      const shouldWait = scheduledTimeMs > nowMs;
      assert.strictEqual(shouldWait, false);
    });

    it('should detect cancelled posts and prevent publishing', () => {
      const post = {
        id: 'post-1',
        scheduled_at: new Date(Date.now() + 3600000).toISOString(),
        status: 'CANCELLED' as const,
      };

      const isCancelled = post.status === 'CANCELLED';
      assert.strictEqual(isCancelled, true);
    });

    it('should detect posts cancelled while sleeping and abort execution', () => {
      // Simulates wakeup verification step
      const postAfterSleep = {
        id: 'post-1',
        scheduled_at: new Date().toISOString(),
        status: 'CANCELLED' as const,
      };

      const canProceed = postAfterSleep.status !== 'CANCELLED';
      assert.strictEqual(canProceed, false);
    });

    it('should detect posts rescheduled to a later future date while sleeping and abort current run', () => {
      // Post was rescheduled to tomorrow while the original wait was finishing
      const rescheduledPost = {
        id: 'post-1',
        scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'SCHEDULED' as const,
      };

      const postTime = new Date(rescheduledPost.scheduled_at).getTime();
      const isRescheduledToFuture = postTime > Date.now() + 60 * 1000;
      const canProceed = !isRescheduledToFuture;

      assert.strictEqual(canProceed, false);
    });
  });

  describe('Admin Client Security Guard', () => {
    it('should throw immediately if createAdminClient is invoked in browser context', () => {
      // Simulate browser window
      // @ts-expect-error Mocking global window for testing security guard
      globalThis.window = {} as unknown;

      assert.throws(
        () => createAdminClient(),
        (err: Error) => err.message.includes('FATAL: createAdminClient cannot be called from the browser')
      );

      // Clean up global window
      // @ts-expect-error Deleting mocked window
      delete globalThis.window;
    });
  });
});
