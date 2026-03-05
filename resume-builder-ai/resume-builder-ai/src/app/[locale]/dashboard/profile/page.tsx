"use client";

import { Link } from "@/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createClientComponentClient } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default function ProfilePage() {
  const t = useTranslations("dashboard.profile");
  const { user } = useAuth();
  const supabase = createClientComponentClient();

  if (!user) return null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-12">
      <Card className="max-w-2xl mx-auto border-2">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{t("labels.fullName")}</p>
              <p className="text-lg font-semibold">
                {user.user_metadata?.full_name || t("labels.notProvided")}
              </p>
            </div>
            {user.user_metadata?.is_premium && (
              <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 border-0 text-white">
                {t("labels.premium")}
              </Badge>
            )}
          </div>

          <div>
            <p className="text-sm text-muted-foreground">{t("labels.email")}</p>
            <p className="text-lg font-semibold break-all">{user.email}</p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard">{t("actions.backToDashboard")}</Link>
            </Button>
            <Button variant="destructive" onClick={handleSignOut}>
              {t("actions.signOut")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
