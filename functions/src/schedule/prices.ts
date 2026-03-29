import { db } from '../admin';
import { getCryptoRates, getFundRates, getSPYRate } from '../utils/rates';
import { getDate } from '../utils/time';

export const savePrices = async (): Promise<void> => {
  const [cryptoRates, SPY, fundValues] = await Promise.all([
    getCryptoRates(),
    getSPYRate(),
    getFundRates(),
  ]);
  const { ETH, BTC, AG, AU } = cryptoRates;

  const { BTGLD, YPGLD, BBGLD } = fundValues;

  // Save to daily prices (every 30 minutes)
  const now = new Date();
  const timestamp = now.getTime(); // Use timestamp as document ID
  await db.collection('dailyPrices').doc(timestamp.toString()).set({
    timestamp,
    ETH,
    BTC,
    AG,
    AU,
    SPY,
    BTGLD,
    YPGLD,
    BBGLD,
  });

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
      await db.collection('prices').doc(date).set({
        date,
        ETH,
        BTC,
        AG,
        AU,
        SPY,
        BTGLD,
        YPGLD,
        BBGLD,
      });

      // Update the last saved date
      await lastSavedRef.set({ date });
    }
  }
};
