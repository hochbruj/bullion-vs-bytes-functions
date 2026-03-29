import { db } from '../admin';
import {
  DailyRates,
  MonthlyRates,
  Performances,
  PriceData,
  Rates,
} from '../types/rates';

export const getPerformanceData = async (): Promise<PriceData> => {
  // Fetch daily prices (48 documents over 24 hours)
  const dailyDocs = (
    await db
      .collection('dailyPrices')
      .orderBy('timestamp', 'asc')
      .limit(48)
      .get()
  ).docs;

  const dailyRates: DailyRates = {
    ETH: [],
    BTC: [],
    AG: [],
    AU: [],
    SPY: [],
    BTGLD: [],
    YPGLD: [],
    BBGLD: [],
  };

  dailyDocs.forEach((doc) => {
    const docData = doc.data() as Rates;
    dailyRates.ETH.push(docData.ETH);
    dailyRates.BTC.push(docData.BTC);
    dailyRates.AG.push(docData.AG);
    dailyRates.AU.push(docData.AU);
    dailyRates.SPY.push(docData.SPY);
    dailyRates.BTGLD.push(docData.BTGLD);
    dailyRates.YPGLD.push(docData.YPGLD);
    dailyRates.BBGLD.push(docData.BBGLD);
  });

  const lastUpdated = dailyDocs[dailyDocs.length - 1].data().timestamp;

  // Fetch all monthly prices for chart data (84 documents over 7 years)
  const monthlyDocs = (
    await db.collection('monthlyPrices').orderBy('month', 'asc').get()
  ).docs;

  const monthlyChartData: MonthlyRates[] = monthlyDocs.map((doc) => {
    const data = doc.data();
    return {
      month: data.month,
      ETH: data.ETH,
      BTC: data.BTC,
      AG: data.AG,
      AU: data.AU,
      SPY: data.SPY,
      BTGLD: data.BTGLD,
      YPGLD: data.YPGLD,
      BBGLD: data.BBGLD,
    } as MonthlyRates;
  });

  // Add current month's data from dailyRates (most recent values)
  const lastMonthlyRates = {
    month: `${new Date().getFullYear()}-${String(
      new Date().getMonth() + 1,
    ).padStart(2, '0')}`, // Format: "YYYY-MM"
    ETH: dailyRates.ETH[dailyRates.ETH.length - 1],
    BTC: dailyRates.BTC[dailyRates.BTC.length - 1],
    AG: dailyRates.AG[dailyRates.AG.length - 1],
    AU: dailyRates.AU[dailyRates.AU.length - 1],
    SPY: dailyRates.SPY[dailyRates.SPY.length - 1],
    BTGLD: dailyRates.BTGLD[dailyRates.BTGLD.length - 1],
    YPGLD: dailyRates.YPGLD[dailyRates.YPGLD.length - 1],
    BBGLD: dailyRates.BBGLD[dailyRates.BBGLD.length - 1],
  };

  monthlyChartData.push(lastMonthlyRates);

  // Fetch daily prices for the last 90 days, sampling every 2 days (45 documents)
  const now = new Date();
  const endDate = now.toISOString().split('T')[0]; // e.g., "2025-04-28"
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 90);
  const startDateStr = startDate.toISOString().split('T')[0]; // e.g., "2025-01-28"

  // Fetch all documents in the range (90 days), then sample every 2 days
  const allDocs = (
    await db
      .collection('prices')
      .where('date', '>=', startDateStr)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
      .get()
  ).docs;

  // Sample every 2 days (expect ~90 documents, take every 2nd one → ~45 documents)
  const shortTermChartData: Rates[] = [];
  for (let i = 0; i < allDocs.length; i += 2) {
    const doc = allDocs[i];
    const data = doc.data();
    shortTermChartData.push({
      date: data.date,
      ETH: data.ETH,
      BTC: data.BTC,
      AG: data.AG,
      AU: data.AU,
      SPY: data.SPY,
      BTGLD: data.BTGLD,
      YPGLD: data.YPGLD,
      BBGLD: data.BBGLD,
    } as Rates);
  }

  const lastDailyRates = {
    date: endDate,
    ETH: dailyRates.ETH[dailyRates.ETH.length - 1],
    BTC: dailyRates.BTC[dailyRates.BTC.length - 1],
    AG: dailyRates.AG[dailyRates.AG.length - 1],
    AU: dailyRates.AU[dailyRates.AU.length - 1],
    SPY: dailyRates.SPY[dailyRates.SPY.length - 1],
    BTGLD: dailyRates.BTGLD[dailyRates.BTGLD.length - 1],
    YPGLD: dailyRates.YPGLD[dailyRates.YPGLD.length - 1],
    BBGLD: dailyRates.BBGLD[dailyRates.BBGLD.length - 1],
  };

  shortTermChartData.pop();
  shortTermChartData.push(lastDailyRates);

  // Get current values (latest from dailyRates)
  const currentValues = {
    ETH: dailyRates.ETH[dailyRates.ETH.length - 1],
    BTC: dailyRates.BTC[dailyRates.BTC.length - 1],
    AG: dailyRates.AG[dailyRates.AG.length - 1],
    AU: dailyRates.AU[dailyRates.AU.length - 1],
    SPY: dailyRates.SPY[dailyRates.SPY.length - 1],
    BTGLD: dailyRates.BTGLD[dailyRates.BTGLD.length - 1],
    YPGLD: dailyRates.YPGLD[dailyRates.YPGLD.length - 1],
    BBGLD: dailyRates.BBGLD[dailyRates.BBGLD.length - 1],
  };

  // Calculate performances for different time periods
  const performances = {} as Performances;

  // 1 Month performance: Compare with 30 days ago
  // Total 90 days of data with 2 day sampling
  // 1 Month ago is approximately 15 data points back
  const oneMonthAgo = shortTermChartData[28]; // First element in the 90-day range
  performances['1M'] = {
    AG: calculatePerformance(currentValues.AG, oneMonthAgo.AG),
    AU: calculatePerformance(currentValues.AU, oneMonthAgo.AU),
    SPY: calculatePerformance(currentValues.SPY, oneMonthAgo.SPY),
    ETH: calculatePerformance(currentValues.ETH, oneMonthAgo.ETH),
    BTC: calculatePerformance(currentValues.BTC, oneMonthAgo.BTC),
    BTGLD: calculatePerformance(currentValues.BTGLD, oneMonthAgo.BTGLD),
    YPGLD: calculatePerformance(currentValues.YPGLD, oneMonthAgo.YPGLD),
    BBGLD: calculatePerformance(currentValues.BBGLD, oneMonthAgo.BBGLD),
  };

  // 90 days / 2 day sampling = ~45 data points
  const threeMonthsAgo = shortTermChartData[0]; // First element is ~90 days ago
  performances['3M'] = {
    AG: calculatePerformance(currentValues.AG, threeMonthsAgo.AG),
    AU: calculatePerformance(currentValues.AU, threeMonthsAgo.AU),
    SPY: calculatePerformance(currentValues.SPY, threeMonthsAgo.SPY),
    ETH: calculatePerformance(currentValues.ETH, threeMonthsAgo.ETH),
    BTC: calculatePerformance(currentValues.BTC, threeMonthsAgo.BTC),
    BTGLD: calculatePerformance(currentValues.BTGLD, threeMonthsAgo.BTGLD),
    YPGLD: calculatePerformance(currentValues.YPGLD, threeMonthsAgo.YPGLD),
    BBGLD: calculatePerformance(currentValues.BBGLD, threeMonthsAgo.BBGLD),
  };

  // Year-to-Date (YTD) performance
  const currentYear = new Date().getFullYear();
  const yearStartData = monthlyChartData.find(
    (item) => item.month === `${String(currentYear - 1)}-12`,
  );

  performances['YTD'] = {
    AG: calculatePerformance(currentValues.AG, yearStartData!.AG),
    AU: calculatePerformance(currentValues.AU, yearStartData!.AU),
    SPY: calculatePerformance(currentValues.SPY, yearStartData!.SPY),
    ETH: calculatePerformance(currentValues.ETH, yearStartData!.ETH),
    BTC: calculatePerformance(currentValues.BTC, yearStartData!.BTC),
    BTGLD: calculatePerformance(currentValues.BTGLD, yearStartData!.BTGLD),
    YPGLD: calculatePerformance(currentValues.YPGLD, yearStartData!.YPGLD),
    BBGLD: calculatePerformance(currentValues.BBGLD, yearStartData!.BBGLD),
  };

  performances['3Y'] = yearlyPerformance(monthlyChartData, 3, currentValues);
  performances['5Y'] = yearlyPerformance(monthlyChartData, 5, currentValues);
  performances['1Y'] = yearlyPerformance(monthlyChartData, 1, currentValues);

  return {
    dailyRates,
    monthlyChartData,
    shortTermChartData,
    lastUpdated,
    performances,
  };
};

// Helper function to calculate percentage change
const calculatePerformance = (
  current: number,
  previous: number,
  years = 1,
): number => {
  if (!previous || previous === 0) return 0;
  if (years > 1) {
    // Compound annual growth rate (CAGR) for multi-year performance
    return (Math.pow(current / previous, 1 / years) - 1) * 100;
  }
  return ((current - previous) / previous) * 100;
};
const yearlyPerformance = (
  monthlyData: MonthlyRates[],
  yearsAgo: number,
  currentValues: Rates,
): Rates => {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0'); // Format MM
  const yearAgo = currentYear - yearsAgo;
  const yearsAgoData = monthlyData.find(
    (item) => item.month === `${yearAgo}-${currentMonth}`,
  );
  return {
    AG: calculatePerformance(currentValues.AG, yearsAgoData!.AG, yearsAgo),
    AU: calculatePerformance(currentValues.AU, yearsAgoData!.AU, yearsAgo),
    SPY: calculatePerformance(currentValues.SPY, yearsAgoData!.SPY, yearsAgo),
    ETH: calculatePerformance(currentValues.ETH, yearsAgoData!.ETH, yearsAgo),
    BTC: calculatePerformance(currentValues.BTC, yearsAgoData!.BTC, yearsAgo),
    BTGLD: calculatePerformance(
      currentValues.BTGLD,
      yearsAgoData!.BTGLD,
      yearsAgo,
    ),
    YPGLD: calculatePerformance(
      currentValues.YPGLD,
      yearsAgoData!.YPGLD,
      yearsAgo,
    ),
    BBGLD: calculatePerformance(
      currentValues.BBGLD,
      yearsAgoData!.BBGLD,
      yearsAgo,
    ),
  };
};
