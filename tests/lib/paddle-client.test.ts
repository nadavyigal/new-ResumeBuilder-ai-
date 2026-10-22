import { describe, expect, it } from '@jest/globals';
import { waitForBalanceAbove } from '@/lib/paddle-client';

// The browser's checkout.completed grants nothing (spec 16.3 step 4): the page
// waits for the webhook's grant to show in the balance before it re-runs the export.

const noSleep = async () => {};

describe('waitForBalanceAbove', () => {
  it('resolves true once the balance rises above the starting value', async () => {
    const reads = [0, 0, 5];
    let i = 0;
    await expect(waitForBalanceAbove(0, async () => reads[Math.min(i++, reads.length - 1)], { sleep: noSleep })).resolves.toBe(true);
    expect(i).toBe(3);
  });

  it('gives up after the attempts without a rise (the sheet then says credits will appear)', async () => {
    let calls = 0;
    await expect(waitForBalanceAbove(2, async () => { calls++; return 2; }, { attempts: 4, sleep: noSleep })).resolves.toBe(false);
    expect(calls).toBe(4);
  });

  it('treats an unreadable balance as not yet granted', async () => {
    await expect(waitForBalanceAbove(0, async () => null, { attempts: 2, sleep: noSleep })).resolves.toBe(false);
  });
});
