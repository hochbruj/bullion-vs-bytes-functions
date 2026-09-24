import axios from 'axios';

import { RealEstateObservation, RealEstateRates } from '../types/rates';

import { getAbsObservations } from './abs';
import { getBisObservations } from './bis';
import { getEastmoneyObservations } from './eastmoney';
import { fetchFredSeries } from './fred';
import { describeError } from './http';
import { getSingaporeObservations } from './singapore';

type RealEstateKey = keyof RealEstateRates;

// --- FRED: S&P Cotality Case-Shiller home price indices (US, monthly) ---

const FRED_SERIES: { key: RealEstateKey; seriesId: string }[] = [
  { key: 'NY_RE', seriesId: 'NYXRSA' },
  { key: 'SF_RE', seriesId: 'SFXRSA' },
  { key: 'MIAMI_RE', seriesId: 'MIXRNSA' },
  { key: 'DALLAS_RE', seriesId: 'DAXRSA' },
];

export const getFredObservations = async (
  fromYear: number,
): Promise<RealEstateObservation[]> => {
  const perSeries = await Promise.all(
    FRED_SERIES.map(async ({ key, seriesId }) =>
      (
        await fetchFredSeries(seriesId, fromYear)
      ).map((obs) => ({
        key,
        month: obs.date.slice(0, 7),
        value: obs.value,
      })),
    ),
  );

  return perSeries.flat();
};

// --- GREIX: German Real Estate Index, Kiel Institute (Germany, quarterly) ---
// Undocumented API behind greix.de's own charts (no key needed). It can change without notice,
// so a failure here must surface loudly rather than silently leaving the German cities stale.

const GREIX_API_URL = 'https://api.greixx.net/api-v1/cities/metrics/';
const GREIX_APARTMENTS = 3; // property type id: 1 single-family, 2 multi-family, 3 apartments

const GREIX_CITIES: { key: RealEstateKey; id: number; name: string }[] = [
  { key: 'BERLIN_RE', id: 1, name: 'Berlin' },
  { key: 'FRANKFURT_RE', id: 2, name: 'Frankfurt' },
  { key: 'MUNICH_RE', id: 10, name: 'Munich' },
];

export const getGreixObservations = async (
  fromYear: number,
): Promise<RealEstateObservation[]> => {
  let data;
  try {
    const result = await axios.get(GREIX_API_URL, {
      params: {
        cities: GREIX_CITIES.map((city) => city.id).join(','),
        prop_types: GREIX_APARTMENTS,
        inflation: false, // nominal, not inflation-adjusted
        data_index: true, // index points rather than price per m²
        per_year: false, // quarterly
        from_year: fromYear,
        to_year: new Date().getUTCFullYear(),
        from_quarter: 1,
        to_quarter: 4,
      },
    });
    data = result.data;
  } catch (error) {
    throw describeError('GREIX', error);
  }

  // { 'Q1 2005': { Munich: { data_value: 101.65, ... }, ... }, ... }
  const byQuarter = data?.chart_legend?.[GREIX_APARTMENTS];
  if (!byQuarter || typeof byQuarter !== 'object') {
    throw new Error(
      `GREIX response has an unexpected shape: ${JSON.stringify(data).slice(
        0,
        200,
      )}`,
    );
  }

  const observations: RealEstateObservation[] = [];
  for (const [label, cities] of Object.entries<any>(byQuarter)) {
    const match = /^Q([1-4]) (\d{4})$/.exec(label);
    if (!match) continue;
    const month = `${match[2]}-${String(Number(match[1]) * 3).padStart(
      2,
      '0',
    )}`;

    for (const { key, name } of GREIX_CITIES) {
      const value = cities[name]?.data_value;
      if (typeof value === 'number') {
        observations.push({ key, month, value });
      }
    }
  }

  return observations;
};

const monthToIndex = (month: string): number =>
  Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;

const indexToMonth = (index: number): string =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;

// Quarterly sources (and lagging monthly ones) leave gaps, so every city is carried forward at its
// last known value from its first observation up to the newest month any source has published.
// Revisions are not tracked: a later run simply overwrites the months it covers.
export const fillMissingMonths = (
  observations: RealEstateObservation[],
): RealEstateObservation[] => {
  const byKey = new Map<RealEstateKey, Map<string, number>>();
  let lastIndex = -Infinity;
  for (const { key, month, value } of observations) {
    byKey.set(key, (byKey.get(key) ?? new Map()).set(month, value));
    lastIndex = Math.max(lastIndex, monthToIndex(month));
  }

  const filled: RealEstateObservation[] = [];
  byKey.forEach((values, key) => {
    const firstIndex = Math.min(...Array.from(values.keys(), monthToIndex));
    let previous = 0;
    for (let index = firstIndex; index <= lastIndex; index++) {
      const month = indexToMonth(index);
      previous = values.get(month) ?? previous;
      filled.push({ key, month, value: previous });
    }
  });
  return filled;
};

// Sources fail independently: a broken GREIX endpoint must not stop FRED data from saving.
// Every returned city has a value for every month (see fillMissingMonths).
export const getAllRealEstateObservations = async (
  fromYear: number,
): Promise<{
  observations: RealEstateObservation[];
  errors: Error[];
}> => {
  const fetched: RealEstateObservation[] = [];
  const errors: Error[] = [];

  await Promise.all(
    [
      getFredObservations,
      getGreixObservations,
      getAbsObservations,
      getEastmoneyObservations,
      getSingaporeObservations,
      getBisObservations,
    ].map(async (fetchSource) => {
      try {
        fetched.push(...(await fetchSource(fromYear)));
      } catch (error) {
        errors.push(error as Error);
      }
    }),
  );

  return { observations: fillMissingMonths(fetched), errors };
};
