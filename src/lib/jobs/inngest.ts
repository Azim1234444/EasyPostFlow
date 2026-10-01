import { Inngest } from 'inngest';

export type PostPublishRequestedEvent = {
  name: 'postflow/post.publish.requested';
  data: {
    jobId: string;
    scheduledPostId: string;
    idempotencyKey: string;
  };
};

export type PostflowEvents = {
  'postflow/post.publish.requested': PostPublishRequestedEvent;
};

// Create a client to send and receive events
export const inngest = new Inngest({
  id: 'postflow',
});
