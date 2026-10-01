import { serve } from 'inngest/next';
import { inngest } from '@/lib/jobs/inngest';
import { publishScheduledPost } from '@/lib/jobs/functions/publish-scheduled-post';

// Create an API handler that serves Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [publishScheduledPost],
});
