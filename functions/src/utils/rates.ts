import axios from 'axios';
import * as functions from 'firebase-functions';

import { CryptoRates, PmRates } from '../types/rates';

export const getPmRates = async (): Promise<PmRates> => {
  const result = await axios.get(
    `https://api.freegoldprice.org/request.cfm?key=${
      functions.config().freegoldprice.apikey
    }&action=GSJ`,
  );
  return {
    AU: +result.data['GSJ']['Gold']['USD']['ask'],
    AG: +result.data['GSJ']['Silver']['USD']['ask'],
  };
};

export const getCryptoRates = async (): Promise<CryptoRates> => {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,kinesis-silver,tether-gold&vs_currencies=usd`;
  const result = await axios.get(url);
  return {
    BTC: result.data.bitcoin.usd,
    ETH: result.data.ethereum.usd,
    AG: result.data['kinesis-silver'].usd,
    AU: result.data['tether-gold'].usd,
  };
};

// Fetch SPY price using Tiingo API (15-min delayed in free tier)
export const getSPYRate = async (): Promise<number> => {
  const result = await axios.get(
    `https://api.tiingo.com/iex/?tickers=SPY&token=${
      functions.config().twingo.apikey
    }`,
  );

  // Check for API errors
  if (!result.data) {
    throw new Error('No intraday data available for SPY from Tiingo');
  }

  // Get the latest price (last price, 15-min delayed)
  const latestPrice = result.data[0].tngoLast;
  return latestPrice;
};

export const getFundRates = async (): Promise<{
  BTGLD: number;
  YPGLD: number;
  BBGLD: number;
}> => {
  const result = await axios.get(
    'https://getfundvalue-6jf7yi4gba-uc.a.run.app/',
  );

  // Check for API errors
  if (!result.data) {
    throw new Error('No fund value available from getfundvalue service');
  }

  // Return the fund value
  return result.data;
};
