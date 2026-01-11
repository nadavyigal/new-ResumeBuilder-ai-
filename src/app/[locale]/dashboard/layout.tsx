import { ReactNode } from "react";
import { redirect } from "@/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { AppLayout } from "@/components/layout/app-layout";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  return <AppLayout user={user}>{children}</AppLayout>;
}
