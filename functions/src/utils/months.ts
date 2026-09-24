type MonthlyObservation = { key: string; month: string; value: number };

// { 'YYYY-MM': { NY_RE: 123, EURUSD: 1.1 } } — one Firestore monthlyPrices doc per month
export const groupByMonth = <T extends MonthlyObservation>(
  observations: T[],
): Map<string, Record<string, number>> => {
  const months = new Map<string, Record<string, number>>();
  for (const { key, month, value } of observations) {
    months.set(month, { ...months.get(month), [key]: value });
  }
  return months;
};
