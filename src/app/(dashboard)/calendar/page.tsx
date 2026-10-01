import { getScheduledPosts } from '@/lib/actions/schedule';
import { CalendarView } from '@/components/scheduling/calendar-view';

export const metadata = {
  title: 'Calendar | PostFlow',
  description: 'View scheduled social media posts across TikTok and Shopee.',
};

export default async function CalendarPage() {
  const { data = [] } = await getScheduledPosts();

  return <CalendarView initialPosts={data || []} />;
}
