import { db } from '../admin';
import { CryptoRates } from '../types/rates';
import { describeError } from '../utils/http';
import { getCryptoRates, getFundRates, getSPYRate } from '../utils/rates';
import { getDate } from '../utils/time';

type PriceFields = Partial<
  CryptoRates & { SPY: number; BTGLD: number; YPGLD: number; BBGLD: number }
>;

// Each source fails independently: a broken Tiingo/CoinGecko/fund-value call must not stop the
// others from saving (previously a Promise.all meant one bad source blocked every write, crypto
// and gold included). Whatever succeeded is written; the run then throws so a failure still shows
// up in the logs.
const getPriceFields = async (): Promise<{
  fields: PriceFields;
  errors: Error[];
}> => {
  const fields: PriceFields = {};
  const errors: Error[] = [];

  await Promise.all([
    getCryptoRates()
      .then((rates) => Object.assign(fields, rates))
      .catch((error) => errors.push(describeError('CoinGecko', error))),
    getSPYRate()
      .then((SPY) => {
        fields.SPY = SPY;
      })
      .catch((error) => errors.push(describeError('Tiingo', error))),
    getFundRates()
      .then((rates) => Object.assign(fields, rates))
      .catch((error) =>
        errors.push(describeError('fund value service', error)),
      ),
  ]);

  return { fields, errors };
};

export const savePrices = async (): Promise<void> => {
  const { fields, errors } = await getPriceFields();

  // Save to daily prices (every 30 minutes)
  const now = new Date();
  const timestamp = now.getTime(); // Use timestamp as document ID
  await db
    .collection('dailyPrices')
    .doc(timestamp.toString())
    .set({ timestamp, ...fields });

  // Limit to 48 entries (24 hours) by deleting the oldest if necessary
  const dailyPricesSnapshot = await db
    .collection('dailyPrices')
    .orderBy('timestamp', 'asc') // Oldest first
    .get();

  const totalEntries = dailyPricesSnapshot.size;
  if (totalEntries > 48) {
    const oldestDoc = dailyPricesSnapshot.docs[0]; // Get the oldest document
    await oldestDoc.ref.delete(); // Delete the oldest entry
  }

  // Save to price history (daily snapshot at midnight UTC, exactly once)
  if (now.getUTCHours() === 0 && now.getUTCMinutes() < 30) {
    const date = getDate(); // e.g., "2025-04-25"

    // Check if we've already saved for this date
    const lastSavedRef = db.collection('metadata').doc('lastSavedDate');
    const lastSavedDoc = await lastSavedRef.get();
    const lastSavedDate = lastSavedDoc.exists
      ? lastSavedDoc.data()?.date
      : null;

    if (lastSavedDate !== date) {
      await db
        .collection('prices')
        .doc(date)
        .set({ date, ...fields });

      // Update the last saved date
      await lastSavedRef.set({ date });
    }
  }

  // Save what we got first, then fail the run so a broken source shows up in the logs/alerts
  if (errors.length > 0) {
    throw new Error(
      `Price sources failed: ${errors.map((e) => e.message).join(' | ')}`,
    );
  }
};
