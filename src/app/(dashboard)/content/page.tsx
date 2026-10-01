import { getContentList } from '@/lib/actions/content';
import { ContentLibraryView } from '@/components/content/content-library-view';

export const metadata = {
  title: 'Content Library | PostFlow',
  description: 'Manage, edit, and organize short-form video posts and affiliate metadata.',
};

export default async function ContentPage() {
  const { data } = await getContentList();

  return <ContentLibraryView initialContent={data || []} />;
}
