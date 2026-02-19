import { Metadata } from 'next';
import { Link } from '@/navigation';
import { createServerComponentClient } from '@/lib/supabase-server';
import { SupportTicketForm } from '@/components/feedback/SupportTicketForm';
import { Mail, MessageSquare, Lightbulb } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact & Support',
  description: 'Get in touch with the Resume Builder AI team',
};

export default async function ContactPage() {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userEmail: string | undefined;
  let userName: string | undefined;

  if (user) {
    userEmail = user.email ?? undefined;
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();
    userName = profile?.full_name ?? undefined;
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-3">Contact &amp; Support</h1>
        <p className="text-lg text-muted-foreground">
          Have a question, hit a bug, or want to share an idea? We read every message and typically
          respond within 1–2 business days.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="flex flex-col items-center text-center p-4 rounded-xl border border-border bg-muted/30">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
            <Mail size={20} className="text-indigo-600" />
          </div>
          <h3 className="font-semibold text-sm mb-1">Email us directly</h3>
          <a
            href="mailto:resumebuilderaiteam@gmail.com"
            className="text-xs text-blue-600 hover:underline break-all"
          >
            resumebuilderaiteam@gmail.com
          </a>
        </div>

        <div className="flex flex-col items-center text-center p-4 rounded-xl border border-border bg-muted/30">
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3">
            <MessageSquare size={20} className="text-purple-600" />
          </div>
          <h3 className="font-semibold text-sm mb-1">Live feedback</h3>
          <p className="text-xs text-muted-foreground">
            Use the Feedback button at the bottom-right of the screen — we read every one.
          </p>
        </div>

        <div className="flex flex-col items-center text-center p-4 rounded-xl border border-border bg-muted/30">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
            <Lightbulb size={20} className="text-amber-600" />
          </div>
          <h3 className="font-semibold text-sm mb-1">Feature requests</h3>
          <p className="text-xs text-muted-foreground">
            Have a great idea? Use the form below — feature requests go directly to our roadmap.
          </p>
        </div>
      </div>

      {/* Main form */}
      <div className="bg-background border border-border rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-1">Send us a message</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Fill out the form below and we&apos;ll get back to you as soon as possible.
        </p>
        <SupportTicketForm userEmail={userEmail} userName={userName} />
      </div>

      {/* Quick links */}
      <div className="mt-8 p-5 bg-muted/30 rounded-xl border border-border">
        <h3 className="font-semibold text-sm mb-3">Quick Links</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/privacy" className="text-sm text-blue-600 hover:underline">Privacy Policy</Link>
          <Link href="/terms" className="text-sm text-blue-600 hover:underline">Terms of Service</Link>
          <Link href="/blog" className="text-sm text-blue-600 hover:underline">Blog</Link>
        </div>
      </div>
    </div>
  );
}
