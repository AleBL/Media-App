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
 * requested from what it shows.
 *
 * Signing in works like at TMDB: a request token becomes a session once,
 * and only after it was approved. The approval, which a person gives on the
 * TMDB website, is `approve()` here.
 */
export async function startFakeTmdb() {
  const requests: TmdbRequest[] = [];
  const requestTokens = new Map<string, 'new' | 'approved' | 'used'>();
  const sessions = new Set<string>();
  let appTokenRevoked = false;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://tmdb.test');
    const method = request.method ?? 'GET';
    const {
      api_key: apiKey,
      session_id: sessionId,
      ...query
    } = Object.fromEntries(url.searchParams);
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
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export type FakeTmdb = Awaited<ReturnType<typeof startFakeTmdb>>;
