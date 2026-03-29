export type PmRates = {
  AG: number;
  AU: number;
};

export type CryptoRates = {
  BTC: number;
  ETH: number;
  AG: number; // Kinesis Silver
  AU: number; // Tether Gold
};

export type SPYRate = {
  SPY: number;
};

export type FundRates = {
  BTGLD: number;
  YPGLD: number;
  BBGLD: number;
};

export type Rates = PmRates & CryptoRates & SPYRate & FundRates;
export type MonthlyRates = Rates & { month: string }; // e.g., '2023-01'

export type DailyRates = {
  BTC: number[];
  ETH: number[];
  AG: number[];
  AU: number[];
  SPY: number[];
  BTGLD: number[];
  YPGLD: number[];
  BBGLD: number[];
};

export interface PriceData {
  dailyRates: DailyRates; // 48 data points over 24 hours
  monthlyChartData: Rates[]; // 84 monthly data points over 7 years,
  shortTermChartData: Rates[]; // 45 data points over 90 days (every 2 days)
  lastUpdated: number; // Timestamp of the latest daily price
  performances: Performances;
}

export interface Performances {
  '1M': Rates;
  '3M': Rates;
  YTD: Rates;
  '1Y': Rates;
  '3Y': Rates;
  '5Y': Rates;
}
