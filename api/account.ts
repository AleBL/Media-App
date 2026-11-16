import { createWebAccount } from '../shared/tmdb/web-account';

// A Vercel Function: the watchlist and the favorites of whoever signed in,
// with the session in the cookie of the site. Reading is a GET, a change a
// POST from the app itself. See shared/tmdb/web-account.ts.
const account = createWebAccount({ credential: process.env.TMDB_READ_TOKEN });

export function GET(request: Request) {
  return account(request);
}

export function POST(request: Request) {
  return account(request);
}
