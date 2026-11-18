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

/** Where the stand-in has the approval pages of the TMDB website. */
const WEBSITE_PATH = '/authenticate';
const WEBSITE_V4_PATH = '/auth/access';

/** The TMDB account of whoever approves a login in these tests. */
export const ACCOUNT = { id: 4242, username: 'e2e-user', name: 'E2E User' };
/** Its id in v4, which TMDB gives with the access token of the user. */
export const ACCOUNT_OBJECT_ID = '5f0c4a1b2c3d4e5f6a7b8c9d';

/**
 * A v4 token in the three-part shape of TMDB's. A request token of the
 * stand-in keeps in its middle part where the browser goes back to (see
 * wayBackOf), as one of TMDB keeps it somewhere TMDB alone reads.
 */
function v4Token(claims: Record<string, unknown>) {
  return [
    'e2e',
    Buffer.from(JSON.stringify(claims)).toString('base64url'),
    randomBytes(16).toString('hex'),
  ].join('.');
}

/** Where the browser goes back to after the approval of a v4 request token. */
export const wayBackOf = (requestToken: string) =>
  String(
    JSON.parse(
      Buffer.from(requestToken.split('.')[1] ?? '', 'base64url').toString() ||
        '{}',
    ).redirect_to ?? '',
  );

export interface TmdbRequest {
  path: string;
  /** Whose credential came with the request, if one that is accepted. */
  /** `account`: the access token of a user (v4), for their own lists. */
  credential: 'app' | 'user' | 'account' | 'rejected';
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
 * except QUERY_WITHOUT_RESULTS, which has none. A search of everything
 * (multi) has movies, tv shows and people in turn. Titles carry their number
 * and the language that was asked for, which lets a test tell what the app
 * requested from what it shows. Each of them has a page, except
 * MISSING_MOVIE.
 *
 * Signing in works like at TMDB: a request token is traded once, and only
 * after it was approved. With the token of the app that is v4: the request
 * token becomes the access token of the user, which becomes a session; with
 * a key of the user, v3, where it becomes a session. The approval, which a
 * person gives on the TMDB website, is `approve()` here. For the web
 * version, whose browser goes to that website, there is a page that answers
 * by itself (`website`).
 */
export async function startFakeTmdb() {
  const requests: TmdbRequest[] = [];
  const requestTokens = new Map<string, 'new' | 'approved' | 'used'>();
  const sessions = new Set<string>();
  const accessTokens = new Set<string>();
  const website = {
    /** What the user answers on the approval page. */
    answer: 'approve' as 'approve' | 'deny',
    /** The approval pages a browser was sent to. */
    visits: [] as { requestToken: string; redirectTo: string }[],
  };
  let appTokenRevoked = false;
  let unreachable = false;
  // What the account has in each list, as "movie:603", with when it was
  // added: a count, which puts the titles added last first.
  const accountLists = {
    watchlist: new Map<string, number>(),
    favorite: new Map<string, number>(),
  };
  // The ratings of the account, by title, with when each was given.
  const ratings = new Map<string, { value: number; at: number }>();
  let added = 0;
  // The lists the user made (v4), by id: titles as "movie:603", with when
  // each was added and its comment.
  const userLists = new Map<
    number,
    {
      name: string;
      description: string;
      public: boolean;
      sortBy: string;
      items: Map<string, { at: number; comment: string | null }>;
    }
  >();
  let lastListId = 7000;
  // Deleted, but still among the lists of the user for a while.
  const deletedLists = new Map<number, { name: string; description: string }>();

  type Title = { id: number; [field: string]: unknown };

  /** The v4 lists of the user, as at TMDB, for their access token alone. */
  function answerList(
    url: URL,
    method: string,
    query: Record<string, string>,
    sent: Record<string, unknown>,
    send: (status: number, body: unknown) => void,
    titles: { movie: (n: number) => Title; show: (n: number) => Title },
  ) {
    const notFound = () =>
      send(404, {
        success: false,
        status_code: 34,
        status_message: 'The resource you requested could not be found.',
      });
    const page = Number(query.page) || 1;
    const paged = <T>(all: T[]) => ({
      page,
      slice: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total_pages: Math.max(1, Math.ceil(all.length / PAGE_SIZE)),
      total_results: all.length,
    });
    const owned = /^\/4\/account\/([^/]+)\/lists$/.exec(url.pathname);

    if (owned) {
      if (owned[1] !== ACCOUNT_OBJECT_ID) {
        return notFound();
      }

      // As TMDB did when tried: a list deleted on the website is still
      // listed for a while, though it is no more.
      const { slice, ...counts } = paged([
        ...[...userLists].map(([id, list]) => ({
          id,
          name: list.name,
          description: list.description,
          public: list.public ? 1 : 0,
          number_of_items: list.items.size,
        })),
        ...[...deletedLists].map(([id, list]) => ({
          id,
          ...list,
          public: 1,
          number_of_items: 0,
        })),
      ]);

      return send(200, { ...counts, results: slice });
    }

    if (url.pathname === '/4/list' && method === 'POST') {
      lastListId += 1;
      userLists.set(lastListId, {
        name: String(sent.name),
        description: String(sent.description ?? ''),
        // As TMDB did when tried: public, whatever `public` says. Only an
        // update makes it private.
        public: true,
        sortBy: 'original_order.asc',
        items: new Map(),
      });

      return send(201, { success: true, status_code: 1, id: lastListId });
    }

    const path = /^\/4\/list\/(\d+)(\/items|\/item_status)?$/.exec(
      url.pathname,
    );
    const list = path && userLists.get(Number(path[1]));

    if (!path || !list) {
      return notFound();
    }

    const sentItems = (Array.isArray(sent.items) ? sent.items : []) as {
      media_type?: unknown;
      media_id?: unknown;
      comment?: unknown;
    }[];
    const keyOf = (item: { media_type?: unknown; media_id?: unknown }) =>
      `${String(item.media_type)}:${Number(item.media_id)}`;

    if (path[2] === '/item_status') {
      const key = `${query.media_type}:${Number(query.media_id)}`;

      return list.items.has(key)
        ? send(200, {
            success: true,
            status_code: 1,
            status_message: 'Success.',
            id: Number(path[1]),
            media_id: Number(query.media_id),
            media_type: query.media_type,
          })
        : notFound();
    }

    if (path[2] === '/items') {
      for (const item of sentItems) {
        const key = keyOf(item);

        if (method === 'POST' && !list.items.has(key)) {
          list.items.set(key, { at: (added += 1), comment: null });
        } else if (method === 'PUT' && list.items.has(key)) {
          list.items.get(key)!.comment = String(item.comment ?? '');
        } else if (method === 'DELETE') {
          list.items.delete(key);
        }
      }

      return send(200, {
        success: true,
        status_code: 1,
        results: sentItems.map((item) => ({
          media_type: item.media_type,
          media_id: item.media_id,
          success: true,
        })),
      });
    }

    if (method === 'PUT') {
      if (typeof sent.sort_by === 'string') {
        list.sortBy = sent.sort_by;
      }

      if (typeof sent.public === 'boolean') {
        list.public = sent.public;
      }

      return send(201, { success: true, status_code: 12 });
    }

    const order = [...list.items].sort(([, a], [, b]) =>
      list.sortBy === 'original_order.desc' ? b.at - a.at : a.at - b.at,
    );
    const { slice, ...counts } = paged(order);

    return send(200, {
      ...counts,
      id: Number(path[1]),
      name: list.name,
      description: list.description,
      sort_by: list.sortBy,
      results: slice.map(([key]) => {
        const [type, id] = key.split(':');

        return type === 'movie'
          ? { ...titles.movie(Number(id)), media_type: 'movie' }
          : { ...titles.show(Number(id) - 9000), media_type: 'tv' };
      }),
      comments: Object.fromEntries(
        slice.map(([key, item]) => [key, item.comment]),
      ),
    });
  }

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

    // The same for v4, whose request token already says where to go back
    // to, and which adds nothing to that address.
    if (url.pathname === WEBSITE_V4_PATH && query.request_token) {
      const requestToken = query.request_token;
      const redirectTo = wayBackOf(requestToken);

      website.visits.push({ requestToken, redirectTo });

      if (
        website.answer === 'approve' &&
        requestTokens.get(requestToken) === 'new'
      ) {
        requestTokens.set(requestToken, 'approved');
      }

      response.writeHead(302, { Location: redirectTo });
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
    const bearer = request.headers.authorization?.replace(/^Bearer /, '');
    const credential = fromApp
      ? 'app'
      : bearer && accessTokens.has(bearer)
        ? 'account'
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

    // Signing in to v4 only takes the access token of the app, in the header.
    if (url.pathname.startsWith('/4/auth/') && credential !== 'app') {
      return send(401, { status_code: 7, status_message: 'Invalid API key.' });
    }

    if (url.pathname === '/4/auth/request_token' && method === 'POST') {
      const requestToken = v4Token({ redirect_to: sent.redirect_to ?? '' });

      requestTokens.set(requestToken, 'new');

      return send(200, {
        success: true,
        status_code: 1,
        status_message: 'Success.',
        request_token: requestToken,
      });
    }

    if (url.pathname === '/4/auth/access_token' && method === 'POST') {
      const requestToken = String(sent.request_token);

      if (requestTokens.get(requestToken) !== 'approved') {
        return send(422, {
          success: false,
          status_code: 41,
          status_message:
            "This request token hasn't been approved by the user.",
        });
      }

      const accessToken = v4Token({ sub: ACCOUNT_OBJECT_ID });

      requestTokens.set(requestToken, 'used');
      accessTokens.add(accessToken);

      return send(200, {
        success: true,
        status_code: 1,
        account_id: ACCOUNT_OBJECT_ID,
        access_token: accessToken,
      });
    }

    if (url.pathname === '/4/auth/access_token' && method === 'DELETE') {
      accessTokens.delete(String(sent.access_token));

      return send(200, { success: true, status_code: 13 });
    }

    if (
      url.pathname === '/3/authentication/session/convert/4' &&
      method === 'POST'
    ) {
      if (!accessTokens.has(String(sent.access_token))) {
        return send(401, { status_code: 35, status_message: 'Invalid token.' });
      }

      const session = randomBytes(20).toString('hex');

      sessions.add(session);

      return send(200, { success: true, session_id: session });
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

    // The countries where TMDB knows where to watch: the two that the
    // page of a title has services in, and two more.
    if (url.pathname === '/3/watch/providers/regions') {
      return send(200, {
        results: [
          { iso_3166_1: 'US', english_name: 'United States of America' },
          { iso_3166_1: 'BR', english_name: 'Brazil' },
          { iso_3166_1: 'PT', english_name: 'Portugal' },
          { iso_3166_1: 'DE', english_name: 'Germany' },
        ],
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

    const searched = /^\/3\/search\/(movie|tv|multi)$/.exec(url.pathname);

    if (searched) {
      const type = searched[1];
      const page = Number(query.page);
      const total = query.query === QUERY_WITHOUT_RESULTS ? 0 : TOTAL_RESULTS;
      const first = (page - 1) * PAGE_SIZE + 1;
      const count = Math.max(0, Math.min(PAGE_SIZE, total - first + 1));
      const movie = (number: number) => ({
        id: number,
        title: `Movie ${number} [${query.language}]`,
        release_date: '2020-01-01',
        poster_path: null,
        genre_ids: [28],
        vote_average: 7.5,
        overview: `The story of title ${number}, told in ${query.language}.`,
      });
      const show = (number: number) => ({
        id: 9000 + number,
        name: `Show ${number} [${query.language}]`,
        first_air_date: '2008-01-20',
        poster_path: null,
        genre_ids: [18],
        vote_average: 8.9,
        overview: `The story of show ${number}, told in ${query.language}.`,
      });
      // A search of everything has a movie, a tv show and a person in
      // turn. The person has the id of the movie two places before, as
      // different kinds of results can at TMDB, and is known for that
      // movie and the show right after it.
      const anything = (number: number) => {
        switch (number % 3) {
          case 1:
            return { ...movie(number), media_type: 'movie' };
          case 2:
            return { ...show(number), media_type: 'tv' };
          default:
            return {
              id: number - 2,
              media_type: 'person',
              name: `Person ${number}`,
              profile_path: null,
              known_for: [
                { ...movie(number - 2), media_type: 'movie' },
                { ...show(number - 1), media_type: 'tv' },
              ],
            };
        }
      };
      const result = type === 'multi' ? anything : type === 'tv' ? show : movie;

      return send(200, {
        page,
        results: Array.from({ length: count }, (_, index) =>
          result(first + index),
        ),
        total_pages: Math.ceil(total / PAGE_SIZE),
        total_results: total,
      });
    }

    // The lists of the home page, with titles named like those of a search.
    // Trending also has a person, as at TMDB, which the app leaves out.
    const movie = (number: number) => ({
      id: number,
      title: `Movie ${number} [${query.language}]`,
      release_date: '2020-01-01',
      poster_path: null,
      vote_average: 7.5,
    });
    const show = (number: number) => ({
      id: 9000 + number,
      name: `Show ${number} [${query.language}]`,
      first_air_date: '2008-01-20',
      poster_path: null,
      vote_average: 8.9,
    });

    // The lists a user makes (v4), which only their access token reaches.
    if (
      url.pathname.startsWith('/4/list') ||
      url.pathname.startsWith('/4/account/')
    ) {
      if (credential !== 'account') {
        return send(401, {
          success: false,
          status_code: 3,
          status_message: 'Authentication failed.',
        });
      }

      return answerList(url, method, query, sent, send, { movie, show });
    }

    if (url.pathname === '/3/trending/all/week') {
      return send(200, {
        page: 1,
        results: [
          { ...movie(1), media_type: 'movie' },
          { id: 31, name: 'A Trending Person', media_type: 'person' },
          { ...show(1), media_type: 'tv' },
          { ...movie(2), media_type: 'movie' },
        ],
      });
    }

    if (url.pathname === '/3/movie/popular') {
      return send(200, { page: 1, results: [11, 12, 13].map(movie) });
    }

    if (url.pathname === '/3/tv/popular') {
      return send(200, { page: 1, results: [11, 12, 13].map(show) });
    }

    // The lists of the account, which only a session that is open reaches,
    // under the id of its account, as at TMDB.
    const states = /^\/3\/(movie|tv)\/(\d+)\/account_states$/.exec(
      url.pathname,
    );
    const marked = /^\/3\/account\/(\d+)\/(watchlist|favorite)$/.exec(
      url.pathname,
    );
    const listed =
      /^\/3\/account\/(\d+)\/(watchlist|favorite|rated)\/(movies|tv)$/.exec(
        url.pathname,
      );
    const rating = /^\/3\/(movie|tv)\/(\d+)\/rating$/.exec(url.pathname);

    if (states || marked || listed || rating) {
      if (!sessions.has(sessionId)) {
        return send(401, {
          success: false,
          status_code: 3,
          status_message:
            'Authentication failed: You do not have permissions to access the service.',
        });
      }

      if (Number((marked ?? listed)?.[1] ?? ACCOUNT.id) !== ACCOUNT.id) {
        return send(404, { status_code: 34, status_message: 'Not found.' });
      }
    }

    if (states) {
      const title = `${states[1]}:${states[2]}`;

      const rated = ratings.get(title);

      return send(200, {
        id: Number(states[2]),
        favorite: accountLists.favorite.has(title),
        rated: rated ? { value: rated.value } : false,
        watchlist: accountLists.watchlist.has(title),
      });
    }

    if (rating && method === 'POST') {
      const title = `${rating[1]}:${rating[2]}`;
      const value = Number(sent.value);

      if (!Number.isInteger(value * 2) || value < 0.5 || value > 10) {
        return send(400, {
          success: false,
          status_code: value > 10 ? 18 : 19,
          status_message: 'Not a rating.',
        });
      }

      const updated = ratings.has(title);

      ratings.set(title, { value, at: (added += 1) });
      // What TMDB does by default: a title rated leaves the watchlist.
      accountLists.watchlist.delete(title);

      return send(201, {
        success: true,
        status_code: updated ? 12 : 1,
      });
    }

    if (rating && method === 'DELETE') {
      ratings.delete(`${rating[1]}:${rating[2]}`);

      return send(200, { success: true, status_code: 13 });
    }

    if (marked && method === 'POST') {
      const list = accountLists[marked[2] as 'watchlist' | 'favorite'];
      const title = `${String(sent.media_type)}:${Number(sent.media_id)}`;

      if (sent[marked[2]] === true) {
        list.set(title, (added += 1));
      } else {
        list.delete(title);
      }

      return send(201, { success: true, status_code: 1 });
    }

    if (listed) {
      const type = listed[3] === 'movies' ? 'movie' : 'tv';
      const list =
        listed[2] === 'rated'
          ? new Map([...ratings].map(([title, { at }]) => [title, at]))
          : accountLists[listed[2] as 'watchlist' | 'favorite'];
      // the titles added (or rated) last first, as the app asks with sort_by
      const titles = [...list]
        .filter(([title]) => title.startsWith(`${type}:`))
        .sort(([, a], [, b]) => b - a)
        .map(([title]) => Number(title.split(':')[1]));
      const page = Number(query.page);

      return send(200, {
        page,
        results: titles
          .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
          .map((id) => ({
            ...(type === 'movie'
              ? { ...movie(id), genre_ids: [28] }
              : { ...show(id - 9000), genre_ids: [18] }),
            ...(listed[2] === 'rated'
              ? { rating: ratings.get(`${type}:${id}`)?.value }
              : {}),
          })),
        total_pages: Math.ceil(titles.length / PAGE_SIZE),
        total_results: titles.length,
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
  const lists = () =>
    requests.filter((request) =>
      /^\/3\/(trending\/all\/week|movie\/popular|tv\/popular)$/.test(
        request.path,
      ),
    );

  return {
    /** What TMDB_BASE_URL must be for the app to talk to this server. */
    url: `http://127.0.0.1:${port}/3`,
    /**
     * The TMDB website, for the web version: there the browser itself goes
     * to its approval page, so it has to be a page that exists here.
     */
    websiteUrl: `http://127.0.0.1:${port}`,
    /** The approval page of v4, as the browser of the web version sees it. */
    approvalUrl: `http://127.0.0.1:${port}${WEBSITE_V4_PATH}`,
    website,
    requests,
    searches,
    lastSearch: () => searches().at(-1),
    /** The pages of titles the app asked for. */
    pages,
    /** The lists of the home page the app asked for. */
    lists,
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
    /** The access tokens of the user (v4) that TMDB still takes. */
    accessTokens: () => [...accessTokens],
    /** The lists the user made (v4): their names, and whether they are public. */
    userLists: () =>
      [...userLists.values()].map((list) => ({
        name: list.name,
        public: list.public,
        sortBy: list.sortBy,
      })),
    /**
     * What the list of watched titles has, such as { "movie:1": "2026-11-16" },
     * last marked first; null while there is no such list.
     */
    watched: () => {
      const list = [...userLists.values()].find(({ description }) =>
        description.includes('media-app:watched'),
      );

      return list
        ? Object.fromEntries(
            [...list.items]
              .sort(([, a], [, b]) => b.at - a.at)
              .map(([title, { comment }]) => [title, comment]),
          )
        : null;
    },
    /**
     * What the user does on the TMDB website: deletes every list of theirs,
     * which TMDB goes on listing for a while (`stillListed`).
     */
    deleteUserLists: ({ stillListed = false } = {}) => {
      for (const [id, { name, description }] of userLists) {
        if (stillListed) {
          deletedLists.set(id, { name, description });
        }
      }

      userLists.clear();
    },
    /** What the user does on the TMDB website: puts a title in a list. */
    addToList: (list: 'watchlist' | 'favorite', title: string) => {
      accountLists[list].set(title, (added += 1));
    },
    /** What a list of the account has, such as "movie:1", last added first. */
    listed: (list: 'watchlist' | 'favorite') =>
      [...accountLists[list]]
        .sort(([, a], [, b]) => b - a)
        .map(([title]) => title),
    /** What the user does on the TMDB website: rates a title. */
    rateOnWebsite: (title: string, value: number) => {
      ratings.set(title, { value, at: (added += 1) });
    },
    /** The ratings of the account, such as { "movie:1": 8.5 }. */
    ratings: () =>
      Object.fromEntries(
        [...ratings].map(([title, { value }]) => [title, value]),
      ),
    /** What the user does on the TMDB website to sign out everywhere. */
    endSessions: () => {
      sessions.clear();
      accessTokens.clear();
    },
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
