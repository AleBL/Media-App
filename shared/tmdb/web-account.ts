import type { TmdbErrorCode } from '../api';
import { createTmdbClient } from './client';
import { isSessionOver } from './login';
import { HTTP_STATUS, toFailure } from './proxy';
import {
  parseAccountListRequest,
  parseMarkRequest,
  parseRateRequest,
  parseTitleRequest,
} from './validation';
import { visit, type WebAuthOptions } from './web-auth';

export type WebAccountOptions = Omit<WebAuthOptions, 'authorizeUrl'>;

/** The resources that change something at TMDB: POST only. */
const CHANGES = new Set(['mark', 'rate', 'unrate']);

/** `true` and `false` as an address says them; anything else is neither. */
function toBoolean(value: string | null) {
  return value === 'true' ? true : value === 'false' ? false : null;
}

/**
 * The lists and the ratings of the TMDB account of whoever signed in on the
 * web version, with the session that the site keeps in a cookie
 * (web-auth.ts): the page never sees it. Nothing here is the same for two
 * visitors, so no cache keeps any of it.
 *
 *   GET  ?resource=states&type=movie&id=603
 *   GET  ?resource=list&list=watchlist&type=movie&page=1&language=en
 *   POST ?resource=mark&list=watchlist&type=movie&id=603&value=true
 *   POST ?resource=rate&type=movie&id=603&value=8.5
 *   POST ?resource=unrate&type=movie&id=603
 *
 * Every parameter is checked the same way the desktop app checks what its
 * window sends.
 */
export function createWebAccount(options: WebAccountOptions) {
  const credential = options.credential?.trim() || null;
  const tmdb = createTmdbClient({
    getCredential: () => credential,
    fetch: options.fetch ?? ((url, init) => fetch(url, init)),
    baseUrl: options.baseUrl,
    // A function has a few seconds to answer, and a change asks twice.
    timeoutMs: 4000,
    retries: 0,
  });

  return async function handle(request: Request): Promise<Response> {
    const at = visit(request);
    const params = new URL(request.url).searchParams;
    const resource = params.get('resource');
    const changing = CHANGES.has(resource ?? '');
    const fail = (code: TmdbErrorCode) =>
      at.answer({ ok: false, error: { code } }, HTTP_STATUS[code]);

    // Reading never changes anything, and a change is never a link.
    if (request.method !== (changing ? 'POST' : 'GET')) {
      return at.refuse(405, changing ? 'POST' : 'GET');
    }

    // Browsers say where a POST comes from. SameSite already keeps the
    // cookie out of the ones other sites start; this does not depend on it.
    if (changing && request.headers.get('origin') !== at.origin) {
      return at.refuse(403);
    }

    const sessionId = at.cookie('session');

    if (!sessionId) {
      return fail('signed-out');
    }

    const title = {
      type: params.get('type'),
      id: Number(params.get('id')),
    };

    try {
      switch (resource) {
        case 'states': {
          const asked = parseTitleRequest(title);

          return asked
            ? at.answer({
                ok: true,
                data: await tmdb.accountStates(sessionId, asked),
              })
            : fail('invalid-request');
        }

        case 'mark': {
          const asked = parseMarkRequest({
            ...title,
            list: params.get('list'),
            value: toBoolean(params.get('value')),
          });

          if (!asked) {
            return fail('invalid-request');
          }

          // The lists are under the id of the account, which the cookie
          // does not keep: the session says whose it is.
          const account = await tmdb.account(sessionId);

          await tmdb.mark(sessionId, account.id, asked);

          return at.answer({ ok: true, data: null });
        }

        // A rating is under the title, not the account: the session is all
        // TMDB needs.
        case 'rate':
        case 'unrate': {
          const asked = parseRateRequest({
            ...title,
            value: resource === 'rate' ? Number(params.get('value')) : null,
          });

          if (!asked) {
            return fail('invalid-request');
          }

          await tmdb.rate(sessionId, asked);

          return at.answer({ ok: true, data: null });
        }

        case 'list': {
          const asked = parseAccountListRequest({
            list: params.get('list'),
            type: params.get('type'),
            page: Number(params.get('page')),
            language: params.get('language'),
          });

          if (!asked) {
            return fail('invalid-request');
          }

          const account = await tmdb.account(sessionId);

          return at.answer({
            ok: true,
            data: await tmdb.accountList(sessionId, account.id, asked),
          });
        }

        default:
          return fail('invalid-request');
      }
    } catch (error) {
      // Ended on the TMDB website, or in another browser: this one forgets
      // it too, the way /api/auth/session does.
      if (isSessionOver(error)) {
        at.drop('session');

        return fail('signed-out');
      }

      const failure = toFailure(error);

      return at.answer(
        { ok: false, error: failure },
        HTTP_STATUS[failure.code],
      );
    }
  };
}

export type WebAccount = ReturnType<typeof createWebAccount>;
