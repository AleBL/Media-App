import { createTmdbProxy } from '../shared/tmdb/proxy';

// A Vercel Function: every file in /api is deployed as one, at the path of
// the file. This one is what TMDB_PROXY_PATH (shared/api.ts) points to.
//
// It is the only place of the site that sees TMDB_READ_TOKEN, a variable of
// the Vercel project. The pages of the site are public files and never get
// it. In development, vite.config.mts answers the same path with the same
// code.
const proxy = createTmdbProxy({ credential: process.env.TMDB_READ_TOKEN });

export function GET(request: Request) {
  return proxy(request);
}
