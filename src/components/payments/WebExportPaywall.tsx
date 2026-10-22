'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { posthog } from '@/lib/posthog';
import { loadPaddle, previewPrices, setPaddleEventListener, waitForBalanceAbove, type PaddleEnvironmentName } from '@/lib/paddle-client';

type Pack = { priceId: string; credits: number };
type Phase = 'loading' | 'ready' | 'opening' | 'waiting' | 'unavailable';

/** The pack W1 highlights: the $0.50 fixed fee takes the most from the 1-pack. */
const HIGHLIGHTED_CREDITS = 5;

async function readBalance(): Promise<number | null> {
  try {
    const response = await fetch('/api/v1/credits?limit=1', { cache: 'no-store' });
    if (!response.ok) return null;
    const json = (await response.json()) as { balance?: unknown };
    return typeof json.balance === 'number' ? json.balance : null;
  } catch {
    return null;
  }
}

/**
 * The web pack sheet (StoreKit spec 16.3 step 1). Opens only after the server
 * answered 402 `export_credits_required` for an export the user asked for:
 * never on page load, never as a banner, no "Premium" wording (EXD-018).
 * The webhook grants; this sheet waits for the balance to rise, then calls
 * `onUnlocked` so the export the user asked for runs without a second click.
 */
export function WebExportPaywall({
  open,
  optimizationId,
  onClose,
  onUnlocked,
}: {
  open: boolean;
  optimizationId: string;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const t = useTranslations('exportCredits');
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>('loading');
  const [packs, setPacks] = useState<Pack[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const balanceBefore = useRef<number>(0);
  const environment = useRef<PaddleEnvironmentName>('sandbox');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase('loading');
    setMessage(null);
    posthog.capture('paywall_shown', { optimization_id: optimizationId, platform: 'web', store: 'paddle' });
    (async () => {
      try {
        const response = await fetch('/api/v1/web-checkout', { cache: 'no-store' });
        const json = (await response.json()) as { gated?: boolean; environment?: PaddleEnvironmentName; packs?: Pack[] };
        if (!json.gated || !json.packs?.length || !json.environment) throw new Error('not_gated');
        environment.current = json.environment;
        const paddle = await loadPaddle(json.environment);
        const preview = await previewPrices(paddle, json.packs.map((pack) => pack.priceId));
        if (cancelled) return;
        setPacks(json.packs);
        setPrices(preview);
        setPhase('ready');
      } catch {
        if (!cancelled) {
          setPhase('unavailable');
          setMessage(t('unavailable'));
        }
      }
    })();
    return () => {
      cancelled = true;
      setPaddleEventListener(null);
    };
  }, [open, optimizationId, t]);

  const buy = useCallback(
    async (pack: Pack) => {
      if (phase !== 'ready') return;
      setPhase('opening');
      setMessage(null);
      posthog.capture('purchase_started', { product_id: pack.priceId, platform: 'web', store: 'paddle' });
      try {
        const response = await fetch('/api/v1/web-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId: pack.priceId }),
        });
        const json = (await response.json().catch(() => ({}))) as { transactionId?: string; error?: string };
        if (!response.ok || !json.transactionId) {
          setPhase('ready');
          setMessage(json.error === 'account_required' ? t('accountRequired') : t('checkoutError'));
          return;
        }
        balanceBefore.current = (await readBalance()) ?? 0;
        const paddle = await loadPaddle(environment.current);
        setPaddleEventListener(async (event) => {
          if (event.name === 'checkout.closed') {
            setPhase((current) => (current === 'opening' ? 'ready' : current));
            return;
          }
          if (event.name !== 'checkout.completed') return;
          paddle.Checkout.close();
          setPhase('waiting');
          setMessage(t('waiting'));
          const granted = await waitForBalanceAbove(balanceBefore.current, readBalance);
          if (granted) {
            posthog.capture('purchase_completed', { product_id: pack.priceId, credits_granted: pack.credits, platform: 'web', store: 'paddle' });
            setPaddleEventListener(null);
            onUnlocked();
          } else {
            setMessage(t('delayed'));
          }
        });
        paddle.Checkout.open({ transactionId: json.transactionId, settings: { displayMode: 'overlay', locale } });
      } catch {
        setPhase('ready');
        setMessage(t('checkoutError'));
      }
    },
    [phase, t, locale, onUnlocked]
  );

  const close = () => {
    if (phase === 'waiting') return;
    posthog.capture('paywall_dismissed', { optimization_id: optimizationId, platform: 'web', store: 'paddle' });
    setPaddleEventListener(null);
    onClose();
  };

  const label = (credits: number) => (credits === 1 ? t('pack1') : credits === 5 ? t('pack5') : t('pack10'));

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block">{t('whatACreditBuys')}</span>
            <span className="block">{t('neverExpire')}</span>
          </DialogDescription>
        </DialogHeader>

        {phase === 'loading' && <p className="text-sm text-muted-foreground">{t('loading')}</p>}

        {(phase === 'ready' || phase === 'opening' || phase === 'waiting') && (
          <div className="flex flex-col gap-2">
            {packs.map((pack) => {
              const highlighted = pack.credits === HIGHLIGHTED_CREDITS;
              return (
                <button
                  key={pack.priceId}
                  type="button"
                  onClick={() => buy(pack)}
                  disabled={phase !== 'ready'}
                  className={`flex min-h-14 items-center justify-between rounded-md border px-4 text-start transition-colors disabled:opacity-60 ${
                    highlighted ? 'border-gray-900 bg-gray-50 dark:border-gray-100 dark:bg-gray-900' : 'border-border hover:bg-muted'
                  }`}
                  data-testid={`web-paywall-pack-${pack.credits}`}
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{label(pack.credits)}</span>
                    {highlighted && <span className="text-xs text-muted-foreground">{t('recommended')}</span>}
                  </span>
                  <span className="font-semibold tabular-nums">{prices[pack.priceId] ?? ''}</span>
                </button>
              );
            })}
          </div>
        )}

        {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}

        <p className="text-xs text-muted-foreground">{t('sharedAccount')}</p>
        <Button variant="ghost" onClick={close} disabled={phase === 'waiting'}>
          {t('close')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
