"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/navigation";
import { createClientComponentClient } from "@/lib/supabase";
import { posthog } from "@/lib/posthog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";

interface AuthFormProps {
  mode: "signin" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const t = useTranslations("auth.form");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  // Check for error/success messages in URL params
  useEffect(() => {
    const urlError = searchParams.get('error');
    const urlMessage = searchParams.get('message');
    if (urlError || urlMessage) {
      setError(urlMessage || t('errorGeneric'));
    }
  }, [searchParams, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "signup") {
        // Track signup started
        posthog.capture('signup_started', {
          method: 'email',
          source: 'auth_form',
        });

        // Get the current origin for the redirect URL
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const storedSessionId = typeof window !== 'undefined'
          ? localStorage.getItem('ats_session_id')
          : null;
        const redirectPath = storedSessionId
          ? `/auth/callback?session_id=${encodeURIComponent(storedSessionId)}`
          : '/auth/callback';

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${origin}${redirectPath}`,
          },
        });

        if (error) throw error;

        if (data.user && !data.user.email_confirmed_at) {
          setMessage(t("confirmEmail"));
        } else if (data.user) {
          // User is immediately confirmed - complete signup flow
          const utmParams = typeof window !== 'undefined' 
            ? JSON.parse(localStorage.getItem('ph_utm_params') || '{}') 
            : {};

          // Alias anonymous ID to user ID
          posthog.alias(data.user.id);

          // Identify user with properties
          posthog.identify(data.user.id, {
            email: data.user.email,
            full_name: fullName,
            created_at: data.user.created_at,
            ...utmParams,
          });

          // Track signup completed
          posthog.capture('signup_completed', {
            method: 'email',
            source: 'auth_form',
            user_id: data.user.id,
            ...utmParams,
          });

          router.push(ROUTES.dashboard);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Identify returning user
        if (data.user) {
          posthog.identify(data.user.id, {
            email: data.user.email,
          });
        }

        router.push(ROUTES.dashboard);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <Link href={ROUTES.home} className="inline-block">
            <span className="font-bold text-2xl text-foreground px-6 py-2 border-2 border-foreground rounded-full">
              RESUMELY
            </span>
          </Link>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-3">
            <CardTitle className="text-3xl font-bold text-center">
              {mode === "signup" ? t("title.signup") : t("title.signin")}
            </CardTitle>
            <CardDescription className="text-center text-base">
              {mode === "signup"
                ? t("subtitle.signup")
                : t("subtitle.signin")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">{t("labels.fullName")}</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder={t("placeholders.fullName")}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">{t("labels.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("placeholders.email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">{t("labels.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="p-4 rounded-3xl bg-destructive/10 border-2 border-destructive/30">
                <p className="text-sm text-destructive text-center font-medium">
                  {error}
                </p>
              </div>
            )}

            {message && (
              <div className="p-4 rounded-3xl bg-secondary/50 border-2 border-secondary">
                <p className="text-sm text-foreground text-center font-medium">
                  {message}
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full text-base"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin"></span>
                  {t("processing")}
                </span>
              ) : (
                mode === "signup" ? t("buttons.createAccount") : t("buttons.signIn")
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-card px-4 text-foreground/60">
                {mode === "signup" ? t("switchPrompt.hasAccount") : t("switchPrompt.noAccount")}
              </span>
            </div>
          </div>

          <div className="text-center">
            {mode === "signup" ? (
              <Link href={ROUTES.auth.signIn}>
                <Button variant="outline" className="w-full">
                  {t("switchButtons.signIn")}
                </Button>
              </Link>
            ) : (
              <Link href={ROUTES.auth.signUp}>
                <Button variant="outline" className="w-full">
                  {t("switchButtons.createAccount")}
                </Button>
              </Link>
            )}
          </div>

          {mode === "signin" && (
            <div className="text-center mt-4">
              <Link
                href={ROUTES.auth.resetPassword}
                className="text-sm text-foreground/70 hover:text-foreground font-medium"
              >
                {t("forgotPassword")}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
