// One-off backfill of the monthly-only data: real estate history (FRED for the US, GREIX for
// Germany, from 1983) and month-end FX rates (FRED, from 2000). Everything is merged into
// monthlyPrices/{YYYY-MM}. Safe to re-run (merge: true) — e.g. after adding a city or currency,
// or if a run gets interrupted.
//
// Usage (from functions/):
//   yarn build && node lib/scripts/backfillMonthly.js [--dry-run]
//
// Requires FRED_API_KEY in functions/.env, and Firestore write access via Application
// Default Credentials (`gcloud auth application-default login`) or GOOGLE_APPLICATION_CREDENTIALS.
import 'dotenv/config';

import * as admin from 'firebase-admin';

import { getFxMonthEnd } from '../utils/fx';
import { groupByMonth } from '../utils/months';
import { getAllRealEstateObservations } from '../utils/realEstate';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'bullion-vs-bytes' });
}
const db = admin.firestore();

const REAL_ESTATE_FROM_YEAR = 1983;
const FX_FROM_YEAR = 2000;

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const countPerKey = (observations: { key: string }[]): void => {
  const counts = new Map<string, number>();
  for (const { key } of observations) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  counts.forEach((count, key) => console.log(`${key}: ${count} observations`));
};

const run = async (): Promise<void> => {
  const isDryRun = process.argv.includes('--dry-run');

  const { observations, errors } = await getAllRealEstateObservations(
    REAL_ESTATE_FROM_YEAR,
  );
  if (errors.length > 0) {
    throw new Error(
      `Aborting, sources failed: ${errors.map((e) => e.message).join(' | ')}`,
    );
  }
  const fxRates = await getFxMonthEnd(FX_FROM_YEAR);

  countPerKey(observations);
  countPerKey(fxRates);

  const entries = Array.from(groupByMonth([...observations, ...fxRates])).sort(
    ([a], [b]) => a.localeCompare(b),
  );
  console.log(
    `${entries.length} monthly documents to write (${entries[0]?.[0]} to ${
      entries[entries.length - 1]?.[0]
    })`,
  );

  if (isDryRun) {
    console.log('[dry run] Skipping Firestore writes.');
    return;
  }

  for (const batchEntries of chunk(entries, 400)) {
    const batch = db.batch();
    for (const [month, values] of batchEntries) {
      const ref = db.collection('monthlyPrices').doc(month);
      batch.set(ref, { month, ...values }, { merge: true });
    }
    await batch.commit();
    console.log(`Committed batch of ${batchEntries.length}`);
  }

  console.log('Backfill complete.');
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Backfill failed:', error.message ?? error);
    process.exit(1);
  });
