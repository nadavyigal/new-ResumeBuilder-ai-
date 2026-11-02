/** Local-only pre-publication check. Input: JSON array of ALL historical + proposed IDs. */
import fs from 'node:fs';
import { validateStoreCampaignRegistry } from '../src/lib/campaign-context';

try {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: tsx scripts/check-store-campaigns.ts <complete-registry.json>');
  const ids: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
    throw new Error('Registry must be a JSON array of campaign IDs.');
  }
  console.log(JSON.stringify(validateStoreCampaignRegistry(ids), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
