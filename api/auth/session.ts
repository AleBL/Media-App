import { createWebAuth } from '../../shared/tmdb/web-auth';

// A Vercel Function: tells the page who is signed in, and nothing else
// about the session. See shared/tmdb/web-auth.ts.
const auth = createWebAuth({ credential: process.env.TMDB_READ_TOKEN });

export function GET(request: Request) {
  return auth(request);
}
