import axios from 'axios';

import { RealEstateObservation } from '../types/rates';

import { describeError } from './http';

// URA Private Residential Property Price Index (2009-Q1 = 100), quarterly, via data.gov.sg.
// Covers private housing only (landed + non-landed), not public HDB flats.
const SG_API_URL = 'https://data.gov.sg/api/action/datastore_search';
const SG_DATASET_ID = 'd_97f8a2e995022d311c6c68cfda6d034c';

export const getSingaporeObservations = async (
  fromYear: number,
): Promise<RealEstateObservation[]> => {
  try {
    const result = await axios.get(SG_API_URL, {
      timeout: 30000,
      params: {
        resource_id: SG_DATASET_ID,
        filters: JSON.stringify({ property_type: 'All Residential' }),
        sort: 'quarter asc',
        limit: 1000, // ~210 quarters exist
      },
    });

    const records: { quarter: string; index: string }[] | undefined =
      result.data?.result?.records;
    if (!result.data?.success || !records || records.length < 100) {
      throw new Error(
        `unexpected response: ${JSON.stringify(result.data).slice(0, 200)}`,
      );
    }

    const observations: RealEstateObservation[] = [];
    for (const { quarter, index } of records) {
      const match = /^(\d{4})-Q([1-4])$/.exec(quarter); // '2026-Q2'
      const value = parseFloat(index);
      if (!match || isNaN(value)) {
        throw new Error(`unexpected record: ${quarter} / ${index}`);
      }
      if (Number(match[1]) >= fromYear) {
        const month = `${match[1]}-${String(Number(match[2]) * 3).padStart(
          2,
          '0',
        )}`;
        observations.push({ key: 'SINGAPORE_RE', month, value });
      }
    }
    return observations;
  } catch (error) {
    throw describeError('data.gov.sg', error);
  }
};
