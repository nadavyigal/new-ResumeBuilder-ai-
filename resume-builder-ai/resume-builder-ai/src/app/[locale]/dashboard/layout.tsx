import { ReactNode } from "react";
import { redirect } from "@/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { AppLayout } from "@/components/layout/app-layout";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/auth/signin", locale });
  }

  return <AppLayout user={user}>{children}</AppLayout>;
}
