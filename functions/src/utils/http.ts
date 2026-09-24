import axios from 'axios';

// Deliberately not the raw axios error: it embeds the request URL, including API keys.
export const describeError = (source: string, error: unknown): Error => {
  if (axios.isAxiosError(error)) {
    return new Error(
      `${source} request failed: ${
        error.response?.status ?? error.code
      } ${JSON.stringify(error.response?.data ?? error.message)}`,
    );
  }
  return error instanceof Error ? error : new Error(`${source}: ${error}`);
};
