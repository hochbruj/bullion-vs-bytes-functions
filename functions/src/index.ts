import * as functions from 'firebase-functions';

import { savePrices } from './schedule/prices';
import { PriceData } from './types/rates';
import { aggregateMonth } from './utils/aggregate';
import { getPerformanceData } from './utils/perfromanceData';

const RUNTIME_OPTS = {
  timeoutSeconds: 540,
};

//Scheduled function to save prices every 30 minutes
export const savePricesScheduled = functions
  .runWith(RUNTIME_OPTS)
  .pubsub.schedule('every 30 minutes')
  .timeZone('UTC')
  .onRun(savePrices);

// Scheduled function to aggregate the previous month's prices
export const aggregateMonthlyPrices = functions.pubsub
  .schedule('0 0 1 * *') // Runs on the 1st of each month at midnight UTC
  .timeZone('UTC')
  .onRun(async () => {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); // Previous month
    const year = previousMonth.getUTCFullYear();
    const month = previousMonth.getUTCMonth() + 1;

    await aggregateMonth(year, month);
    return null;
  });

export const getPerformance = functions.https.onRequest(async (req, res) => {
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

export const test = functions
  .runWith(RUNTIME_OPTS)
  .https.onRequest(async (req, res) => {
    res.send('OK');
  });
