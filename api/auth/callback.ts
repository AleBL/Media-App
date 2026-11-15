import { createWebAuth } from '../../shared/tmdb/web-auth';

// A Vercel Function: where TMDB sends the browser after the user answered
// on the approval page. See shared/tmdb/web-auth.ts.
const auth = createWebAuth({ credential: process.env.TMDB_READ_TOKEN });

export function GET(request: Request) {
  return auth(request);
}
