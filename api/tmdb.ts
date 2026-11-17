import { createTmdbProxy } from '../shared/tmdb/proxy';

// Vercel Function at TMDB_PROXY_PATH. Only the functions see
// TMDB_READ_TOKEN; the pages are public files.
const proxy = createTmdbProxy({ credential: process.env.TMDB_READ_TOKEN });

export function GET(request: Request) {
  return proxy(request);
}
