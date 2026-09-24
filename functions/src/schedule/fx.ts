import { db } from '../admin';
import { getFxMonthEnd } from '../utils/fx';
import { groupByMonth } from '../utils/months';

// Non-USD real estate indices need a month-end FX rate to be compared with USD assets. Recent
// window only; the full history comes from the backfill script.
export const saveExchangeRates = async (): Promise<void> => {
  const fromYear = new Date().getUTCFullYear() - 1;
  const rates = await getFxMonthEnd(fromYear);

  await Promise.all(
    Array.from(groupByMonth(rates)).map(([month, values]) =>
      db
        .collection('monthlyPrices')
        .doc(month)
        .set({ month, ...values }, { merge: true }),
    ),
  );
};
