import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * The credential the app is built with for these tests (global-setup.ts).
 * Made up, in the three-part shape of a TMDB "API Read Access Token".
 */
export const APP_TOKEN = 'e2e.app-read-access.token';
/** The only key of a user that the stand-in accepts. */
export const VALID_KEY = '0123456789abcdef0123456789abcdef';
export const REJECTED_KEY = 'ffffffffffffffffffffffffffffffff';

export const PAGE_SIZE = 20;
export const TOTAL_RESULTS = 45;
/** The one query that finds nothing. */
export const QUERY_WITHOUT_RESULTS = 'nothing like this';
/** The one movie that TMDB does not have. */
export const MISSING_MOVIE = 404404;
/** The trailer of every title, on YouTube. */
export const TRAILER_KEY = 'e2eTrailer1';

/** Where the stand-in has the approval page of the TMDB website. */
const WEBSITE_PATH = '/authenticate';

/** The TMDB account of whoever approves a login in these tests. */
export const ACCOUNT = { id: 4242, username: 'e2e-user', name: 'E2E User' };

export interface TmdbRequest {
  path: string;
  /** Whose credential came with the request, if one that is accepted. */
  credential: 'app' | 'user' | 'rejected';
  query?: string;
  page?: string;
  language?: string;
}

async function jsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

/**
 * A local server that answers like the parts of the TMDB API the app uses.
 * The app is pointed at it through TMDB_BASE_URL, so the tests are fast,
 * repeatable and never leave the machine.
 *
 * It accepts the app's token in the Authorization header and a user's key
 * in the query string, the two ways TMDB itself takes a credential, and
 * answers 401 to anything else.
 *
 * Every search has 45 results: two full pages and a last one with five,
 * except QUERY_WITHOUT_RESULTS, which has none. Titles carry their number
 * and the language that was asked for, which lets a test tell what the app
 * requested from what it shows. Each of them has a page, except
 * MISSING_MOVIE.
 *
 * Signing in works like at TMDB: a request token becomes a session once,
 * and only after it was approved. The approval, which a person gives on the
 * TMDB website, is `approve()` here. For the web version, whose browser
 * goes to that website, there is a page that answers by itself (`website`).
 */
export async function startFakeTmdb() {
  const requests: TmdbRequest[] = [];
  const requestTokens = new Map<string, 'new' | 'approved' | 'used'>();
  const sessions = new Set<string>();
  const website = {
    /** What the user answers on the approval page. */
    answer: 'approve' as 'approve' | 'deny',
    /** The approval pages a browser was sent to. */
    visits: [] as { requestToken: string; redirectTo: string }[],
  };
  let appTokenRevoked = false;
  let unreachable = false;

  const server = createServer(async (request, response) => {
    // Like a computer without a connection: no answer at all.
    if (unreachable) {
      request.socket.destroy();
      return;
    }

    const url = new URL(request.url ?? '/', 'http://tmdb.test');
    const method = request.method ?? 'GET';
    const {
      api_key: apiKey,
      session_id: sessionId,
      ...query
    } = Object.fromEntries(url.searchParams);

    // The approval page of the TMDB website, which a browser visits and the
    // app never does. It answers by itself what the test says the user
    // would, and sends the browser on like TMDB: to `redirect_to`, with the
    // request token and the answer in the address.
    if (url.pathname.startsWith(`${WEBSITE_PATH}/`) && query.redirect_to) {
      const requestToken = url.pathname.slice(WEBSITE_PATH.length + 1);
      const back = new URL(query.redirect_to);
      const approved =
        website.answer === 'approve' &&
        requestTokens.get(requestToken) === 'new';

      website.visits.push({ requestToken, redirectTo: query.redirect_to });

      if (approved) {
        requestTokens.set(requestToken, 'approved');
      }

      back.searchParams.set('request_token', requestToken);
      back.searchParams.set(approved ? 'approved' : 'denied', 'true');
      response.writeHead(302, { Location: back.toString() });
      response.end();
      return;
    }

    const sent = method === 'GET' ? {} : await jsonBody(request);
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    const fromApp =
      !appTokenRevoked &&
      request.headers.authorization === `Bearer ${APP_TOKEN}`;
    const credential = fromApp
      ? 'app'
      : apiKey === VALID_KEY
        ? 'user'
        : 'rejected';

    // Sessions are left out of the record on purpose: see sessions().
    requests.push({ path: url.pathname, credential, ...query });

    if (credential === 'rejected') {
      return send(401, {
        status_code: 7,
        status_message: 'Invalid API key: You must be granted a valid key.',
      });
    }

    if (url.pathname === '/3/authentication/token/new') {
      const requestToken = randomBytes(20).toString('hex');

      requestTokens.set(requestToken, 'new');

      return send(200, {
        success: true,
        expires_at: '2099-01-01 00:00:00 UTC',
        request_token: requestToken,
      });
    }

    if (url.pathname === '/3/authentication/session/new' && method === 'POST') {
      const requestToken = String(sent.request_token);

      if (requestTokens.get(requestToken) !== 'approved') {
        return send(401, {
          success: false,
          status_code: 17,
          status_message: 'Session denied.',
        });
      }

      const session = randomBytes(20).toString('hex');

      requestTokens.set(requestToken, 'used');
      sessions.add(session);

      return send(200, { success: true, session_id: session });
    }

    if (url.pathname === '/3/authentication/session' && method === 'DELETE') {
      sessions.delete(String(sent.session_id));

      return send(200, { success: true });
    }

    if (url.pathname === '/3/account') {
      return sessions.has(sessionId)
        ? send(200, {
            ...ACCOUNT,
            include_adult: false,
            avatar: { gravatar: { hash: null }, tmdb: { avatar_path: null } },
          })
        : send(401, {
            success: false,
            status_code: 3,
            status_message:
              'Authentication failed: You do not have permissions to access the service.',
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

    // The page of a title: the one the search listed, with two people in
    // the cast, a trailer and a service in the United States and another in
    // Brazil, so a test can tell which region the app showed.
    const page = /^\/3\/(movie|tv)\/(\d+)$/.exec(url.pathname);

    if (page) {
      const tv = page[1] === 'tv';
      const id = Number(page[2]);
      const number = tv ? id - 9000 : id;
      const language = query.language;

      if (id === MISSING_MOVIE) {
        return send(404, {
          success: false,
          status_code: 34,
          status_message: 'The resource you requested could not be found.',
        });
      }

      return send(200, {
        id,
        ...(tv
          ? {
              name: `Show ${number} [${language}]`,
              original_name: `Show ${number}`,
              first_air_date: '2008-01-20',
              episode_run_time: [47],
              number_of_seasons: 5,
              number_of_episodes: 62,
              genres: [{ id: 18, name: 'Drama' }],
            }
          : {
              title: `Movie ${number} [${language}]`,
              original_title: `Movie ${number}`,
              release_date: '2020-01-01',
              runtime: 136,
              imdb_id: 'tt0133093',
              genres: [
                { id: 28, name: language === 'pt-BR' ? 'Ação' : 'Action' },
              ],
            }),
        overview: `The story of title ${number}, told in ${language}.`,
        poster_path: null,
        vote_average: 7.5,
        vote_count: 1234,
        credits: {
          cast: [
            { id: 1, name: 'Ada Actor', character: 'Hero', profile_path: null },
            { id: 2, name: 'Bob Actor', character: 'Villain' },
          ],
        },
        videos: {
          results: [
            {
              key: TRAILER_KEY,
              site: 'YouTube',
              type: 'Trailer',
              iso_639_1: 'en',
              official: true,
              name: 'Trailer',
            },
          ],
        },
        'watch/providers': {
          results: {
            US: {
              link: `https://www.themoviedb.org/${page[1]}/${id}/watch?locale=US`,
              flatrate: [{ provider_id: 8, provider_name: 'Stream US' }],
            },
            BR: { flatrate: [{ provider_id: 9, provider_name: 'Stream BR' }] },
          },
        },
        external_ids: { imdb_id: tv ? 'tt0903747' : 'tt0133093' },
      });
    }

    return send(404, { status_message: 'Not found' });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address() as AddressInfo;
  const searches = () =>
    requests.filter((request) => request.path.startsWith('/3/search/'));
  const pages = () =>
    requests.filter((request) => /^\/3\/(movie|tv)\/\d+$/.test(request.path));

  return {
    /** What TMDB_BASE_URL must be for the app to talk to this server. */
    url: `http://127.0.0.1:${port}/3`,
    /**
     * The approval page of the TMDB website, for the web version: there the
     * browser itself goes to it, so it has to be a page that exists here.
     */
    websiteUrl: `http://127.0.0.1:${port}${WEBSITE_PATH}`,
    website,
    requests,
    searches,
    lastSearch: () => searches().at(-1),
    /** The pages of titles the app asked for. */
    pages,
    /** From now on the app's own token is refused, as if TMDB revoked it. */
    revokeAppToken: () => {
      appTokenRevoked = true;
    },
    /** What the user does on the TMDB website: allows the app in. */
    approve: (requestToken: string) => {
      if (requestTokens.get(requestToken) !== 'new') {
        throw new Error('No such request token waiting for an approval');
      }

      requestTokens.set(requestToken, 'approved');
    },
    /** The sessions that are open at TMDB right now. */
    sessions: () => [...sessions],
    /** What the user does on the TMDB website to sign out everywhere. */
    endSessions: () => sessions.clear(),
    /** From now on nothing reaches TMDB, as if the computer were offline. */
    goOffline: () => {
      unreachable = true;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export type FakeTmdb = Awaited<ReturnType<typeof startFakeTmdb>>;
