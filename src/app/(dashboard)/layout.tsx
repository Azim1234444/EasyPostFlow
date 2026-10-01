import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const userInfo = {
    email: user.email,
    full_name: user.user_metadata?.full_name || '',
  };

  return (
    <DashboardShell user={userInfo}>
      {children}
    </DashboardShell>
  );
}
