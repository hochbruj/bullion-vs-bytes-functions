import { FxRates } from '../types/rates';

import { fetchFredSeries } from './fred';

export type FxKey = keyof FxRates;

export type FxObservation = { key: FxKey; month: string; value: number }; // month: 'YYYY-MM'

// Every key is USD per 1 unit of the foreign currency (EURUSD = 1.17 means 1 EUR = 1.17 USD), so
// converting a local-currency value to USD is always `value * rate`. FRED quotes some pairs the
// other way round (units per USD); those are inverted here.
const FX_SERIES: { key: FxKey; seriesId: string; quotedPerUsd: boolean }[] = [
  { key: 'EURUSD', seriesId: 'DEXUSEU', quotedPerUsd: false },
  { key: 'AUDUSD', seriesId: 'DEXUSAL', quotedPerUsd: false },
  { key: 'SGDUSD', seriesId: 'DEXSIUS', quotedPerUsd: true },
  { key: 'JPYUSD', seriesId: 'DEXJPUS', quotedPerUsd: true },
  { key: 'CNYUSD', seriesId: 'DEXCHUS', quotedPerUsd: true },
  { key: 'HKDUSD', seriesId: 'DEXHKUS', quotedPerUsd: true },
];

// Rate at each month's last available business day, matching the month-end snapshots the other
// monthlyPrices fields use. The in-progress month is skipped: it has no month-end yet.
// (FRED's daily series lags a few days, so a just-finished month can briefly end early; the
// next run's window overwrites it with the true month-end.)
export const getFxMonthEnd = async (
  fromYear: number,
): Promise<FxObservation[]> => {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const perSeries = await Promise.all(
    FX_SERIES.map(async ({ key, seriesId, quotedPerUsd }) => {
      const daily = await fetchFredSeries(seriesId, fromYear);

      const lastPerMonth = new Map<string, number>();
      for (const { date, value } of daily) {
        lastPerMonth.set(date.slice(0, 7), value); // oldest first, so the last write wins
      }

      return Array.from(lastPerMonth, ([month, value]) => ({
        key,
        month,
        value: quotedPerUsd ? 1 / value : value,
      })).filter((rate) => rate.month < currentMonth);
    }),
  );

  return perSeries.flat();
};
