import { createWebAuth } from '../../shared/tmdb/web-auth';

// A Vercel Function: ends the session, in the browser and at TMDB. It only
// answers a POST, which a link on another site cannot make. See
// shared/tmdb/web-auth.ts.
const auth = createWebAuth({ credential: process.env.TMDB_READ_TOKEN });

export function POST(request: Request) {
  return auth(request);
}
