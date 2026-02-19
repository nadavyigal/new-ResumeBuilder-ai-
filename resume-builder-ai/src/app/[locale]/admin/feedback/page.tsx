import { Metadata } from 'next';
import { redirect } from '@/navigation';
import { createServerComponentClient, createServiceRoleClient } from '@/lib/supabase-server';
import { FeedbackAdminDashboard } from '@/components/admin/FeedbackAdminDashboard';

export const metadata: Metadata = {
  title: 'Feedback Admin',
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'resumebuilderaiteam@gmail.com';

export default async function AdminFeedbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: '/auth/signin', locale });
    return null;
  }

  // Check admin access — email match OR profile role = 'admin'
  let isAdmin = user.email === ADMIN_EMAIL;

  if (!isAdmin) {
    const serviceClient = createServiceRoleClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    isAdmin = profile?.role === 'admin';
  }

  if (!isAdmin) {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Feedback &amp; Support Dashboard</h1>
        <p className="text-muted-foreground">
          Manage user feedback, NPS scores, bug reports, and support tickets.
        </p>
      </div>
      <FeedbackAdminDashboard />
    </div>
  );
}
