import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/** The only key the stand-in accepts. Anything else gets a 401. */
export const VALID_KEY = '0123456789abcdef0123456789abcdef';
export const REJECTED_KEY = 'ffffffffffffffffffffffffffffffff';

export const PAGE_SIZE = 20;
export const TOTAL_RESULTS = 45;
/** The one query that finds nothing. */
export const QUERY_WITHOUT_RESULTS = 'nothing like this';

export interface TmdbRequest {
  path: string;
  query?: string;
  page?: string;
  language?: string;
}

/**
 * A local server that answers like the parts of the TMDB API the app uses.
 * The app is pointed at it through TMDB_BASE_URL, so the tests are fast,
 * repeatable and never leave the machine.
 *
 * Every search has 45 results: two full pages and a last one with five,
 * except QUERY_WITHOUT_RESULTS, which has none. Titles carry their number
 * and the language that was asked for, which lets a test tell what the app
 * requested from what it shows.
 */
export async function startFakeTmdb() {
  const requests: TmdbRequest[] = [];

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://tmdb.test');
    const { api_key: apiKey, ...query } = Object.fromEntries(url.searchParams);
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
    };

    requests.push({ path: url.pathname, ...query });

    if (apiKey !== VALID_KEY) {
      return send(401, {
        status_code: 7,
        status_message: 'Invalid API key: You must be granted a valid key.',
      });
    }

    if (url.pathname === '/3/genre/movie/list') {
      return send(200, {
        genres: [
          { id: 28, name: query.language === 'pt-BR' ? 'Ação' : 'Action' },
        ],
      });
    }

    if (url.pathname === '/3/genre/tv/list') {
      return send(200, { genres: [{ id: 18, name: 'Drama' }] });
    }

    if (url.pathname === '/3/search/movie' || url.pathname === '/3/search/tv') {
      const tv = url.pathname.endsWith('/tv');
      const page = Number(query.page);
      const total = query.query === QUERY_WITHOUT_RESULTS ? 0 : TOTAL_RESULTS;
      const first = (page - 1) * PAGE_SIZE + 1;
      const count = Math.max(0, Math.min(PAGE_SIZE, total - first + 1));

      return send(200, {
        page,
        results: Array.from({ length: count }, (_, index) => {
          const number = first + index;

          return tv
            ? {
                id: 9000 + number,
                name: `Show ${number} [${query.language}]`,
                first_air_date: '2008-01-20',
                poster_path: null,
                genre_ids: [18],
                vote_average: 8.9,
              }
            : {
                id: number,
                title: `Movie ${number} [${query.language}]`,
                release_date: '2020-01-01',
                poster_path: null,
                genre_ids: [28],
                vote_average: 7.5,
              };
        }),
        total_pages: Math.ceil(total / PAGE_SIZE),
        total_results: total,
      });
    }

    return send(404, { status_message: 'Not found' });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address() as AddressInfo;
  const searches = () =>
    requests.filter((request) => request.path.startsWith('/3/search/'));

  return {
    /** What TMDB_BASE_URL must be for the app to talk to this server. */
    url: `http://127.0.0.1:${port}/3`,
    requests,
    searches,
    lastSearch: () => searches().at(-1),
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export type FakeTmdb = Awaited<ReturnType<typeof startFakeTmdb>>;
