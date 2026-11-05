"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { createClientComponentClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";

// Same minimum as Supabase (`supabase/config.toml`) and iOS sign-up.
const MIN_PASSWORD_LENGTH = 6;

type Phase = "checking" | "ready" | "invalid" | "done";

/**
 * Landing page of the password reset email (`resetPasswordForEmail` in
 * `../reset-password/page.tsx` redirects here). The link signs the user in
 * with a recovery session, then the user sets a new password.
 *
 * Required Supabase "Reset password" email template link, so it works on any
 * device: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password`.
 * `../confirm/route.ts` verifies it on the server and redirects here signed in.
 * The default `{{ .ConfirmationURL }}` sends a PKCE `code`, which only works in
 * the browser that asked for the reset (its code verifier lives there).
 * A `token_hash` or hash tokens arriving here directly are also handled.
 */
export default function UpdatePasswordPage() {
  const t = useTranslations("auth.updatePassword");
  const [supabase] = useState(() => createClientComponentClient());
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function establishRecoverySession() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const linkError =
        url.searchParams.get("error_description") ?? hash.get("error_description");
      if (linkError) return false;

      const tokenHash = url.searchParams.get("token_hash");
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });
        return !error;
      }

      // The browser client exchanges a `code` or reads hash tokens on its own
      // while it starts, and getSession waits for that.
      const { data } = await supabase.auth.getSession();
      if (data.session) return true;

      // Implicit-flow links put the tokens in the hash. The PKCE browser
      // client refuses them on start, so set the session from them here.
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        return !error;
      }

      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        return !error;
      }
      return false;
    }

    establishRecoverySession()
      .catch(() => false)
      .then((ok) => {
        if (!cancelled) setPhase(ok ? "ready" : "invalid");
      });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("tooShort", { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t("mismatch"));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Sign out so the next sign-in proves the new password works.
      await supabase.auth.signOut();
      setPhase("done");
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : t("genericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">{t("title")}</CardTitle>
          {phase === "ready" && (
            <CardDescription className="text-center">{t("description")}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {phase === "checking" && (
            <p className="text-sm text-muted-foreground text-center" role="status">
              {t("checking")}
            </p>
          )}

          {phase === "invalid" && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive" role="alert">
                {t("invalidLink")}
              </p>
              <Link href={ROUTES.auth.resetPassword} className="text-sm text-primary hover:underline">
                {t("requestNewLink")}
              </Link>
            </div>
          )}

          {phase === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t("passwordLabel")}</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t("confirmLabel")}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-destructive text-center" role="alert">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("saving") : t("save")}
              </Button>
            </form>
          )}

          {phase === "done" && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-green-600" role="status">
                {t("success")}
              </p>
              <Link href={ROUTES.auth.signIn} className="text-sm text-primary hover:underline">
                {t("goToSignIn")}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
