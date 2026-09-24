import axios from 'axios';

import { RealEstateObservation } from '../types/rates';

import { describeError } from './http';

// Hong Kong residential property prices from the BIS property price statistics (WS_SPP), nominal
// index 2010 = 100, quarterly. The BIS republishes the Hong Kong Rating and Valuation
// Department's private domestic price index (RVD itself only offers legacy .xls files).
// Series key: quarterly . Hong Kong . nominal . index.
const BIS_HK_URL =
  'https://stats.bis.org/api/v2/data/dataflow/BIS/WS_SPP/1.0/Q.HK.N.628';

export const getBisObservations = async (
  fromYear: number,
): Promise<RealEstateObservation[]> => {
  try {
    const result = await axios.get<string>(BIS_HK_URL, {
      timeout: 30000,
      responseType: 'text',
      params: { format: 'csv', startPeriod: `${fromYear}-Q1` },
    });

    const [header, ...rows] = result.data.trim().split(/\r?\n/);
    const columns = header.split(',');
    const periodColumn = columns.indexOf('TIME_PERIOD');
    const valueColumn = columns.indexOf('OBS_VALUE');
    if (periodColumn === -1 || valueColumn === -1 || rows.length === 0) {
      throw new Error(`unexpected response: ${result.data.slice(0, 200)}`);
    }

    return rows.map((row) => {
      const cells = row.split(',');
      const match = /^(\d{4})-Q([1-4])$/.exec(cells[periodColumn]); // '2026-Q2'
      const value = parseFloat(cells[valueColumn]);
      if (!match || isNaN(value)) {
        throw new Error(`unexpected row: ${row}`);
      }
      return {
        key: 'HONGKONG_RE' as const,
        month: `${match[1]}-${String(Number(match[2]) * 3).padStart(2, '0')}`,
        value,
      };
    });
  } catch (error) {
    throw describeError('BIS', error);
  }
};
