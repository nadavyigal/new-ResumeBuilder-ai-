'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClientComponentClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, useRouter } from '@/navigation';
import { ROUTES } from '@/lib/constants';

export default function ConfirmEmailPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const t = useTranslations('auth.confirmEmail');
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  // Get the full confirmation URL from the query params
  const confirmationUrl = searchParams.get('confirmation_url');

  const handleConfirmation = useCallback(async () => {
    if (!confirmationUrl) {
      setError(t('invalidLinkError'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Parse the confirmation URL to extract token_hash and type
      const url = new URL(confirmationUrl);
      const token_hash = url.searchParams.get('token');
      const type = url.searchParams.get('type');

      if (!token_hash || !type) {
        throw new Error(t('invalidParams'));
      }

      // Verify the OTP using the token hash
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      });

      if (verifyError) throw verifyError;

      if (data.user) {
        setSuccess(true);
        // Wait a moment to show success message, then redirect
        setTimeout(() => {
          router.push(ROUTES.dashboard);
        }, 2000);
      }
    } catch (err: any) {
      console.error('Confirmation error:', err);
      setError(err.message || t('confirmFailed'));
    } finally {
      setLoading(false);
    }
  }, [confirmationUrl, router, supabase, t]);

  // Auto-confirm on mount if we have a confirmation URL
  useEffect(() => {
    if (confirmationUrl && !success && !error && !loading) {
      // Small delay to show the page before confirming
      const timer = setTimeout(() => {
        handleConfirmation();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [confirmationUrl, error, handleConfirmation, loading, success]);

  if (!confirmationUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">{t('invalidLinkTitle')}</CardTitle>
            <CardDescription className="text-center">
              {t('invalidLinkDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href={ROUTES.auth.signUp}>
              <Button>{t('signUpAgain')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Link href={ROUTES.home}>
              <span className="font-bold text-2xl text-foreground px-6 py-2 border-2 border-foreground rounded-full">
                RESUMELY
              </span>
            </Link>
          </div>
          <CardTitle className="text-2xl">
            {success ? t('confirmedTitle') : t('confirmTitle')}
          </CardTitle>
          <CardDescription>
            {success
              ? t('confirmedDescription')
              : loading
              ? t('verifying')
              : t('confirmDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-4 rounded-3xl bg-destructive/10 border-2 border-destructive/30">
              <p className="text-sm text-destructive text-center font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-3xl bg-green-50 border-2 border-green-200">
              <p className="text-sm text-green-800 text-center font-medium">
                {t('redirecting')}
              </p>
            </div>
          )}

          {!success && !loading && !error && (
            <Button onClick={handleConfirmation} className="w-full" size="lg">
              {t('confirmButton')}
            </Button>
          )}

          {loading && (
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          <div className="text-center mt-6">
            <Link
              href={ROUTES.auth.signIn}
              className="text-sm text-foreground/70 hover:text-foreground font-medium"
            >
              {t('backToSignIn')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
