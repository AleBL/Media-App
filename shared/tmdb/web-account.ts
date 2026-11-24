import type { TmdbErrorCode } from '../api';
import { createTmdbClient } from './client';
import { decodeSeasons, MAX_PROGRESS_LENGTH } from './episodes';
import { isSessionExpired } from './login';
import { HTTP_STATUS, toFailure } from './proxy';
import {
  parseAccountListRequest,
  parseMarkRequest,
  parseProgressRequest,
  parseRateRequest,
  parseRecommendationsRequest,
  parseTitleRequest,
  parseWatchedListRequest,
  parseWatchedRequest,
} from './validation';
import { createWatched, requireUserAccess } from './watched';
import {
  clearAccess,
  episodesListCache,
  httpContext,
  readAccess,
  watchedListCache,
  type WebAuthOptions,
} from './web-auth';

export type WebAccountOptions = Omit<WebAuthOptions, 'website'>;

/** Resources that change something at TMDB: POST only. */
const CHANGE_RESOURCES = new Set([
  'mark',
  'rate',
  'unrate',
  'watched-mark',
  'watched-save-progress',
]);

function toBoolean(value: string | null) {
  return value === 'true' ? true : value === 'false' ? false : null;
}

/**
 * The account lists, ratings and watched titles for the web version, with
 * the session the site keeps in a cookie (web-auth.ts). Parameters are
 * validated like the desktop IPC.
 *
 *   GET  ?resource=states&type=movie&id=603
 *   GET  ?resource=list&list=watchlist&type=movie&page=1&language=en
 *   POST ?resource=mark&list=watchlist&type=movie&id=603&value=true
 *   POST ?resource=rate&type=movie&id=603&value=8.5
 *   POST ?resource=unrate&type=movie&id=603
 *   GET  ?resource=recommendations&type=movie&language=en
 *   GET  ?resource=watched-state&type=movie&id=603
 *   POST ?resource=watched-mark&type=movie&id=603&value=true&date=2026-11-16&language=en
 *   GET  ?resource=watched-list&page=1&language=en
 *   GET  ?resource=watched-progress
 *   POST ?resource=watched-save-progress&id=1396&seasons=1:1-7,9;2:1&date=2026-11-20&language=en
 */
export function createWebAccount(options: WebAccountOptions) {
  const credential = options.credential?.trim() || null;
  const tmdb = createTmdbClient({
    getCredential: () => credential,
    fetch: options.fetch ?? ((url, init) => fetch(url, init)),
    baseUrl: options.baseUrl,
    // A function has a few seconds, and a change makes two requests.
    timeoutMs: 4000,
    retries: 0,
  });
  const watched = createWatched(tmdb);

  return async function handle(request: Request): Promise<Response> {
    const http = httpContext(request);
    const params = new URL(request.url).searchParams;
    const resource = params.get('resource');
    const isChange = CHANGE_RESOURCES.has(resource ?? '');
    const failWith = (code: TmdbErrorCode) =>
      http.json({ ok: false, error: { code } }, HTTP_STATUS[code]);

    if (request.method !== (isChange ? 'POST' : 'GET')) {
      return http.reject(405, isChange ? 'POST' : 'GET');
    }

    // Only the app itself may change anything, whatever SameSite does.
    if (isChange && request.headers.get('origin') !== http.origin) {
      return http.reject(403);
    }

    const sessionId = http.getCookie('session');

    if (!sessionId) {
      return failWith('signed-out');
    }

    const title = {
      type: params.get('type'),
      id: Number(params.get('id')),
    };

    try {
      switch (resource) {
        case 'states': {
          const parsed = parseTitleRequest(title);

          return parsed
            ? http.json({
                ok: true,
                data: await tmdb.accountStates(sessionId, parsed),
              })
            : failWith('invalid-request');
        }

        case 'mark': {
          const parsed = parseMarkRequest({
            ...title,
            list: params.get('list'),
            value: toBoolean(params.get('value')),
          });

          if (!parsed) {
            return failWith('invalid-request');
          }

          // The lists need the account id, which the cookie does not keep.
          const account = await tmdb.account(sessionId);

          await tmdb.mark(sessionId, account.id, parsed);

          return http.json({ ok: true, data: null });
        }

        case 'rate':
        case 'unrate': {
          const parsed = parseRateRequest({
            ...title,
            value: resource === 'rate' ? Number(params.get('value')) : null,
          });

          if (!parsed) {
            return failWith('invalid-request');
          }

          await tmdb.rate(sessionId, parsed);

          return http.json({ ok: true, data: null });
        }

        case 'list': {
          const parsed = parseAccountListRequest({
            list: params.get('list'),
            type: params.get('type'),
            page: Number(params.get('page')),
            language: params.get('language'),
          });

          if (!parsed) {
            return failWith('invalid-request');
          }

          const account = await tmdb.account(sessionId);

          return http.json({
            ok: true,
            data: await tmdb.accountList(sessionId, account.id, parsed),
          });
        }

        case 'recommendations': {
          const parsed = parseRecommendationsRequest({
            type: params.get('type'),
            language: params.get('language'),
          });

          if (!parsed) {
            return failWith('invalid-request');
          }

          const user = requireUserAccess(readAccess(http));

          return http.json({
            ok: true,
            data: await tmdb.recommendations(
              user.accessToken,
              user.accountObjectId,
              parsed,
            ),
          });
        }

        case 'watched-state': {
          const parsed = parseTitleRequest(title);

          return parsed
            ? http.json({
                ok: true,
                data: await watched.state(
                  requireUserAccess(readAccess(http)),
                  watchedListCache(http),
                  parsed,
                ),
              })
            : failWith('invalid-request');
        }

        case 'watched-mark': {
          const parsed = parseWatchedRequest({
            ...title,
            value: toBoolean(params.get('value')),
            date: params.get('date'),
            language: params.get('language'),
          });

          if (!parsed) {
            return failWith('invalid-request');
          }

          await watched.mark(
            requireUserAccess(readAccess(http)),
            watchedListCache(http),
            parsed,
          );

          return http.json({ ok: true, data: null });
        }

        case 'watched-list': {
          const parsed = parseWatchedListRequest({
            page: Number(params.get('page')),
            language: params.get('language'),
          });

          return parsed
            ? http.json({
                ok: true,
                data: await watched.list(
                  requireUserAccess(readAccess(http)),
                  watchedListCache(http),
                  parsed,
                ),
              })
            : failWith('invalid-request');
        }

        case 'watched-progress':
          return http.json({
            ok: true,
            data: await watched.progress(
              requireUserAccess(readAccess(http)),
              episodesListCache(http),
            ),
          });

        case 'watched-save-progress': {
          // The seasons as in the comment (episodes.ts), read only when they
          // could be one.
          const text = params.get('seasons') ?? '';
          const parsed = parseProgressRequest({
            id: title.id,
            seasons:
              text.length <= MAX_PROGRESS_LENGTH ? decodeSeasons(text) : null,
            date: params.get('date'),
            language: params.get('language'),
          });

          if (!parsed) {
            return failWith('invalid-request');
          }

          await watched.saveProgress(
            requireUserAccess(readAccess(http)),
            episodesListCache(http),
            parsed,
          );

          return http.json({ ok: true, data: null });
        }

        default:
          return failWith('invalid-request');
      }
    } catch (error) {
      // Ended on the TMDB website or in another browser: forget it here too.
      if (isSessionExpired(error)) {
        clearAccess(http);

        return failWith('signed-out');
      }

      const failure = toFailure(error);

      return http.json(
        { ok: false, error: failure },
        HTTP_STATUS[failure.code],
      );
    }
  };
}

export type WebAccount = ReturnType<typeof createWebAccount>;
