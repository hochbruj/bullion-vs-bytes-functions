import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { saveExchangeRates } from './schedule/fx';
import { savePrices } from './schedule/prices';
import { saveRealEstatePrices } from './schedule/realEstate';
import { PriceData } from './types/rates';
import { aggregateMonth } from './utils/aggregate';
import { getPerformanceData } from './utils/perfromanceData';

const RUNTIME_OPTS = {
  timeoutSeconds: 540,
};

//Scheduled function to save prices every 30 minutes
export const savePricesScheduled = onSchedule(
  { ...RUNTIME_OPTS, schedule: 'every 30 minutes' },
  async () => {
    await savePrices();
  },
);

// Scheduled function to aggregate the previous month's prices
export const aggregateMonthlyPrices = onSchedule(
  { ...RUNTIME_OPTS, schedule: '0 0 1 * *', timeZone: 'UTC' }, // Runs on the 1st of each month at midnight UTC
  async () => {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); // Previous month
    const year = previousMonth.getUTCFullYear();
    const month = previousMonth.getUTCMonth() + 1;

    await aggregateMonth(year, month);
  },
);

// Scheduled function to fetch real estate prices (monthly cadence, no daily granularity)
export const saveRealEstatePricesScheduled = onSchedule(
  // 8th, not the 1st: Case-Shiller for month M lands at the very end of M+2 (FRED adds it a day or
  // two after the release), so a run on the 1st would often miss it and lag a full extra month
  { ...RUNTIME_OPTS, schedule: '0 6 8 * *', timeZone: 'UTC' },
  async () => {
    await saveRealEstatePrices();
  },
);

// Month-end FX rates. Runs on the 8th so the previous month's last business day is published:
// FRED's daily rates arrive in weekly batches, up to ~a week after month-end.
export const saveExchangeRatesScheduled = onSchedule(
  { ...RUNTIME_OPTS, schedule: '0 6 8 * *', timeZone: 'UTC' },
  async () => {
    await saveExchangeRates();
  },
);

export const getPerformance = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const response: PriceData = await getPerformanceData();
    res.send(response);
  } catch (error) {
    console.error('Error fetching performance data:', error);
    res.sendStatus(404);
  }
});

// export const test = onRequest({ ...RUNTIME_OPTS }, async (req, res) => {
//   await saveRealEstatePrices();
//   res.send('OK');
// });
