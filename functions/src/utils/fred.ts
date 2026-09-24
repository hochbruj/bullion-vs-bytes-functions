import axios from 'axios';

import { describeError } from './http';

export type FredObservation = { date: string; value: number }; // date: 'YYYY-MM-DD'

// Observations from Jan 1 of fromYear onwards, oldest first, without FRED's "." placeholders
// for values that aren't published yet.
export const fetchFredSeries = async (
  seriesId: string,
  fromYear: number,
): Promise<FredObservation[]> => {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    throw new Error('FRED_API_KEY is not set');
  }

  try {
    const result = await axios.get(
      'https://api.stlouisfed.org/fred/series/observations',
      {
        params: {
          series_id: seriesId,
          api_key: apiKey,
          file_type: 'json',
          sort_order: 'asc',
          observation_start: `${fromYear}-01-01`,
        },
      },
    );
    const observations: { date: string; value: string }[] =
      result.data.observations ?? [];

    return observations
      .filter((obs) => obs.value !== '.')
      .map((obs) => ({ date: obs.date, value: parseFloat(obs.value) }));
  } catch (error) {
    throw describeError(`FRED ${seriesId}`, error);
  }
};
