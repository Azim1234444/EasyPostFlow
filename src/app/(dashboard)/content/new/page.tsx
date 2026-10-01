import { ContentForm } from '@/components/content/content-form';

export const metadata = {
  title: 'Create Content | PostFlow',
};

export default function NewContentPage() {
  return <ContentForm mode="create" />;
}
