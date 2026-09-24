import axios from 'axios';
import { readSheet } from 'read-excel-file/node';

import { RealEstateObservation, RealEstateRates } from '../types/rates';

import { describeError } from './http';

// ABS "Total Value of Dwellings" (cat. 6432.0), Table 2 — quarterly median transfer prices per
// capital city, in AUD thousands. Unlike the other sources this is a raw median price, not an
// index. The file URL contains the release quarter and changes every release, so it is
// discovered from the "latest release" page on each run. Scraping: if ABS restructures the page
// or file, this must throw rather than return wrong data.
const ABS_ORIGIN = 'https://www.abs.gov.au';
const ABS_RELEASE_PAGE = `${ABS_ORIGIN}/statistics/economy/price-indexes-and-inflation/total-value-dwellings/latest-release`;
const ABS_TABLE_FILE = '643202.xlsx';

// Established house medians. Columns are matched by ABS Series ID (stable), and the column label
// is checked as well so a reshuffled sheet can't silently map the wrong city.
const ABS_SERIES: {
  key: keyof RealEstateRates;
  seriesId: string;
  city: string;
}[] = [
  { key: 'SYDNEY_RE', seriesId: 'A83728545T', city: 'Sydney' },
  { key: 'MELBOURNE_RE', seriesId: 'A83728549A', city: 'Melbourne' },
  { key: 'PERTH_RE', seriesId: 'A83728561T', city: 'Perth' },
];

export const getAbsObservations = async (
  fromYear: number,
): Promise<RealEstateObservation[]> => {
  try {
    const page = await axios.get<string>(ABS_RELEASE_PAGE, {
      responseType: 'text',
    });
    const link = new RegExp(`href="([^"]*/${ABS_TABLE_FILE})"`).exec(page.data);
    if (!link) {
      throw new Error(`no link to ${ABS_TABLE_FILE} found on the release page`);
    }

    const file = await axios.get(new URL(link[1], ABS_ORIGIN).href, {
      responseType: 'arraybuffer',
    });
    const rows = await readSheet(Buffer.from(file.data), 'Data1');

    const labels = rows[0];
    const seriesIds = rows.find((row) => row[0] === 'Series ID');
    if (!seriesIds) {
      throw new Error('no "Series ID" row in the sheet');
    }

    const observations: RealEstateObservation[] = [];
    for (const { key, seriesId, city } of ABS_SERIES) {
      const column = seriesIds.indexOf(seriesId);
      const label = String(labels[column] ?? '');
      if (
        column === -1 ||
        !label.includes('Established House') ||
        !label.includes(city)
      ) {
        throw new Error(
          `series ${seriesId} not found as ${city} established house (got "${label}")`,
        );
      }

      for (const row of rows) {
        const [date, value] = [row[0], row[column]];
        if (date instanceof Date && typeof value === 'number') {
          const month = date.toISOString().slice(0, 7); // quarter-end month, e.g. 2026-06
          if (Number(month.slice(0, 4)) >= fromYear) {
            observations.push({ key, month, value });
          }
        }
      }
    }
    return observations;
  } catch (error) {
    throw describeError('ABS', error);
  }
};
