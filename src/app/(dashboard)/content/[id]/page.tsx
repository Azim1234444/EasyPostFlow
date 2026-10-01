import { getContentById } from '@/lib/actions/content';
import { ContentForm } from '@/components/content/content-form';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const res = await getContentById(id);
  if (!res.data) {
    return { title: 'Post Not Found | PostFlow' };
  }
  return {
    title: `${res.data.title} | PostFlow`,
  };
}

export default async function ContentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const res = await getContentById(id);

  if (res.error || !res.data) {
    notFound();
  }

  return <ContentForm initialData={res.data} mode="edit" />;
}
