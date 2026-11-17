import { createWebAuth } from '../../shared/tmdb/web-auth';

// A Vercel Function, like api/tmdb.ts. It starts signing in on the web
// version: the browser comes here and is sent to the approval page of the
// TMDB website. What it does is in shared/tmdb/web-auth.ts, which answers
// the four functions of this folder by their path.
const auth = createWebAuth({ credential: process.env.TMDB_READ_TOKEN });

export function GET(request: Request) {
  return auth(request);
}
