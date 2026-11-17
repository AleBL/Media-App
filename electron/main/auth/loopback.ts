import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export const CALLBACK_PATH = '/callback';

/** What the page shown in the browser tells the user. */
export type CallbackOutcome = 'done' | 'failed';

export interface LoopbackOptions {
  /** Runs once, when the browser comes back from TMDB. */
  onCallback: () => Promise<CallbackOutcome>;
  /** The HTML to answer the browser with. */
  page: (outcome: CallbackOutcome) => string;
}

export interface Loopback {
  /** Where TMDB must send the browser back to. */
  url: string;
  /** Stops listening. Safe to call more than once. */
  close(): Promise<void>;
}

const HEADERS = {
  'Cache-Control': 'no-store',
  // No connection is kept open: closing the server then leaves nothing behind.
  Connection: 'close',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

/**
 * A one-login server on 127.0.0.1 where TMDB sends the browser back.
 *
 * Anything on this computer can reach the port, so the callback proves
 * nothing: it only triggers `onCallback`, which asks TMDB. The path ends in
 * a random value only TMDB knows; anything else gets a 404.
 */
export async function startLoopback(
  options: LoopbackOptions,
): Promise<Loopback> {
  const path = `${CALLBACK_PATH}/${randomBytes(16).toString('hex')}`;
  let host = '';
  let used = false;
  let closing: Promise<void> | undefined;

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const isCallback =
      !used &&
      request.method === 'GET' &&
      // Another name for this address (DNS rebinding) is not this server.
      request.headers.host === host &&
      url.pathname === path;

    if (!isCallback) {
      response.writeHead(404, HEADERS).end();
      return;
    }

    used = true;
    options
      .onCallback()
      .catch((): CallbackOutcome => 'failed')
      .then((outcome) => {
        response.writeHead(200, {
          ...HEADERS,
          'Content-Type': 'text/html; charset=utf-8',
        });
        response.end(options.page(outcome), () => void close());
      });
  });

  const close = () =>
    (closing ??= new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections();
    }));

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      // A later failure must not take the whole app down with it.
      server.on('error', () => {});
      resolve();
    });
  });

  host = `127.0.0.1:${(server.address() as AddressInfo).port}`;

  return { url: `http://${host}${path}`, close };
}
