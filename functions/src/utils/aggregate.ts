import { db } from '../admin';

// Type for a daily price document in the prices collection
interface DailyPrice {
  date: string; // e.g., "2016-12-30"
  AG: number;
  AU: number;
  BTC: number;
  ETH: number;
  SPY: number;
  BTGLD: number;
  YPGLD: number;
  BBGLD: number;
}

// Type for a monthly price document in the monthlyPrices collection
interface MonthlyPrice {
  month: string; // e.g., "2016-12"
  AG: number;
  AU: number;
  BTC: number;
  ETH: number;
  SPY: number;
  BTGLD: number;
  YPGLD: number;
  BBGLD: number;
}

// Helper function to get the start and end timestamps for a given month
export const getMonthRange = (year: number, month: number) => {
  const start = new Date(Date.UTC(year, month - 1, 1)); // First day of the month
  const end = new Date(Date.UTC(year, month, 0)); // Last day of the month
  return {
    startDate: start.toISOString().split('T')[0], // e.g., "2016-12-01"
    endDate: end.toISOString().split('T')[0], // e.g., "2016-12-31"
  };
};

// Function to aggregate prices for a single month
export const aggregateMonth = async (
  year: number,
  month: number,
): Promise<void> => {
  const { startDate, endDate } = getMonthRange(year, month);
  const formattedMonth = month < 10 ? `0${month}` : month;
  const monthKey = `${year}-${formattedMonth}`; // e.g., "2016-12"

  // Fetch all prices for the month, ordered by date
  const docs = (
    await db
      .collection('prices')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
      .get()
  ).docs;

  if (docs.length === 0) {
    console.log(`No data found for ${monthKey}`);
    return;
  }

  // Take the last document as the representative price for the month
  const lastDoc = docs[docs.length - 1].data() as DailyPrice;
  const monthlyPrice: MonthlyPrice = {
    month: monthKey,
    AG: lastDoc.AG,
    AU: lastDoc.AU,
    BTC: lastDoc.BTC,
    ETH: lastDoc.ETH,
    SPY: lastDoc.SPY,
    BTGLD: lastDoc.BTGLD,
    YPGLD: lastDoc.YPGLD,
    BBGLD: lastDoc.BBGLD,
  };

  // Write to monthlyPrices collection
  await db.collection('monthlyPrices').doc(monthKey).set(monthlyPrice);
  console.log(`Aggregated prices for ${monthKey}`);
};
