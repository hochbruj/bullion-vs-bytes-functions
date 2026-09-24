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

// Home price level per city. Monthly docs only — no daily/short-term equivalent. US cities: FRED
// Case-Shiller index (monthly). German cities: GREIX apartment index (quarterly). Australian
// cities: ABS median established-house price in AUD thousands (quarterly) — a price, not an index.
// Shanghai: NBS second-hand price index chained from monthly changes, Dec 2010 = 100 (monthly).
// Singapore: URA private residential price index, 2009-Q1 = 100 (quarterly).
// Hong Kong: RVD private domestic price index via the BIS, 2010 = 100 (quarterly).
// Each city has its own base/unit; the frontend rebases per series and converts currency.
export type RealEstateRates = {
  NY_RE: number;
  SF_RE: number;
  MIAMI_RE: number;
  DALLAS_RE: number;
  BERLIN_RE: number;
  FRANKFURT_RE: number;
  MUNICH_RE: number;
  SYDNEY_RE: number;
  MELBOURNE_RE: number;
  PERTH_RE: number;
  SHANGHAI_RE: number;
  SINGAPORE_RE: number;
  HONGKONG_RE: number;
};

// One data point for one city, dated to the month it belongs to (quarterly sources use the
// quarter's last month).
export type RealEstateObservation = {
  key: keyof RealEstateRates;
  month: string; // 'YYYY-MM'
  value: number;
};

// Month-end FX rates, each USD per 1 unit of the foreign currency (multiply a local value by it
// to get USD). Monthly docs only.
export type FxRates = {
  EURUSD: number;
  AUDUSD: number;
  SGDUSD: number;
  JPYUSD: number;
  CNYUSD: number;
  HKDUSD: number;
};

// Optional: real estate publishes with a lag (and quarterly for some cities), and FX only exists
// on monthly docs, so many rows won't have these
export type Rates = PmRates &
  CryptoRates &
  SPYRate &
  FundRates &
  Partial<RealEstateRates> &
  Partial<FxRates>;
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
  monthlyChartData: Rates[]; // ~120 monthly data points over 10 years,
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
