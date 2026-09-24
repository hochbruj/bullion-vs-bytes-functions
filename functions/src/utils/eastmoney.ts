import axios from 'axios';

import { RealEstateObservation } from '../types/rates';

import { describeError } from './http';

// Shanghai second-hand home prices: the NBS 70-city survey, republished as JSON by Eastmoney's
// data center (the endpoint behind akshare's macro_china_new_house_price). Unofficial and
// undocumented, so it can change or block without notice — this must throw, not guess.
//
// NBS only publishes changes, so the level is a chain of month-on-month changes with Dec 2010 = 100.
// The chain always starts from the first month of history, hence the full history is fetched on
// every run and only the requested window is returned. If Eastmoney ever trims its history the
// level would jump, because the base moves with the first row.
const EASTMONEY_URL = 'https://datacenter-web.eastmoney.com/api/data/v1/get';

type EastmoneyRow = {
  REPORT_DATE: string; // '2026-08-01 00:00:00'
  SECOND_HOUSE_SEQUENTIAL: number | null; // previous month = 100
};

export const getEastmoneyObservations = async (
  fromYear: number,
): Promise<RealEstateObservation[]> => {
  try {
    const result = await axios.get(EASTMONEY_URL, {
      timeout: 30000,
      params: {
        reportName: 'RPT_ECONOMY_HOUSE_PRICE',
        columns: 'REPORT_DATE,CITY,SECOND_HOUSE_SEQUENTIAL',
        filter: '(CITY in ("上海"))',
        pageNumber: 1,
        pageSize: 1000,
        sortColumns: 'REPORT_DATE',
        sortTypes: 1,
        source: 'WEB',
        client: 'WEB',
      },
    });

    const rows: EastmoneyRow[] | undefined = result.data?.result?.data;
    if (!result.data?.success || !rows || rows.length < 100) {
      throw new Error(
        `unexpected response: ${JSON.stringify(result.data).slice(0, 200)}`,
      );
    }

    const observations: RealEstateObservation[] = [];
    let level = 100;
    let previousMonthIndex: number | null = null;
    for (const row of rows) {
      const month = row.REPORT_DATE.slice(0, 7);
      const monthIndex =
        Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
      const change = row.SECOND_HOUSE_SEQUENTIAL;

      // A gap or a missing change would silently corrupt every later level
      if (
        previousMonthIndex !== null &&
        monthIndex !== previousMonthIndex + 1
      ) {
        throw new Error(`gap in monthly history before ${month}`);
      }
      if (typeof change !== 'number') {
        throw new Error(`missing month-on-month change for ${month}`);
      }
      previousMonthIndex = monthIndex;

      level *= change / 100;
      if (Number(month.slice(0, 4)) >= fromYear) {
        observations.push({ key: 'SHANGHAI_RE', month, value: level });
      }
    }
    return observations;
  } catch (error) {
    throw describeError('Eastmoney', error);
  }
};
