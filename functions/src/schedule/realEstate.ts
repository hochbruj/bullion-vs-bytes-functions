import { db } from '../admin';
import { groupByMonth } from '../utils/months';
import { getAllRealEstateObservations } from '../utils/realEstate';

// The monthly run only needs recent history; the full history comes from the backfill script.
// Two calendar years covers the year boundary and lagging/quarterly sources.
export const saveRealEstatePrices = async (): Promise<void> => {
  const fromYear = new Date().getUTCFullYear() - 1;
  const { observations, errors } = await getAllRealEstateObservations(fromYear);

  await Promise.all(
    Array.from(groupByMonth(observations)).map(([month, values]) =>
      db
        .collection('monthlyPrices')
        .doc(month)
        .set({ month, ...values }, { merge: true }),
    ),
  );

  // Save what we got first, then fail the run so a broken source shows up in the logs/alerts
  if (errors.length > 0) {
    throw new Error(
      `Real estate sources failed: ${errors.map((e) => e.message).join(' | ')}`,
    );
  }
};
