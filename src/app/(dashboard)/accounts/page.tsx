import { getPlatformAccounts } from '@/lib/actions/accounts';
import { AccountsView } from '@/components/accounts/accounts-view';

export const metadata = {
  title: 'Connected Accounts | PostFlow',
  description: 'Manage connected social media profiles for TikTok and Shopee.',
};

interface AccountsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const resolvedParams = await searchParams;
  const successParam = resolvedParams.success as string | undefined;
  const errorParam = resolvedParams.error as string | undefined;

  let successMessage: string | null = null;
  if (successParam === 'tiktok_connected') {
    successMessage = 'Your TikTok account was successfully connected!';
  }

  const { data: accounts = [] } = await getPlatformAccounts();

  return (
    <AccountsView
      initialAccounts={accounts || []}
      successMessage={successMessage}
      errorMessage={errorParam || null}
    />
  );
}
