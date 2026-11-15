import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, sep } from 'node:path';
import { expect, test as base } from '@playwright/test';
import { createSite } from '../../shared/tmdb/site';
import { APP_TOKEN, startFakeTmdb, type FakeTmdb } from '../support/fake-tmdb';
import { projectRoot } from '../support/fixtures';

const dist = join(projectRoot, 'dist');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

/**
 * The web version of the app as the site serves it: the built pages as
 * plain files, and the functions of the site at the paths where Vercel runs
 * the files of /api. The functions talk to the stand-in for TMDB, and send
 * the browser to its approval page instead of the TMDB website.
 */
async function startSite(tmdb: FakeTmdb, credential: string) {
  const functions = createSite({
    credential,
    baseUrl: tmdb.url,
    authorizeUrl: tmdb.websiteUrl,
  });

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://site.test');

    try {
      if (await functions(request, response)) {
        return;
      }

      const file = normalize(
        join(dist, url.pathname === '/' ? 'index.html' : url.pathname),
      );

      if (!file.startsWith(dist + sep)) {
        throw new Error('outside of dist');
      }

      const body = await readFile(file);

      response.writeHead(200, {
        'Content-Type':
          CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not found');
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

type Fixtures = {
  /** The local stand-in for the TMDB API that the site talks to. */
  tmdb: FakeTmdb;
  /** The credential the site has. An empty one is a site left unconfigured. */
  siteCredential: string;
  /** The site, serving the web version of the app. */
  site: { url: string };
  /** Everything the browser was sent while the test ran, by address. */
  received: Map<string, string>;
};

export const test = base.extend<Fixtures>({
  // Playwright needs the first argument to be a destructuring pattern.
  // eslint-disable-next-line no-empty-pattern
  tmdb: async ({}, use) => {
    const tmdb = await startFakeTmdb();

    await use(tmdb);
    await tmdb.close();
  },

  siteCredential: [APP_TOKEN, { option: true }],

  site: async ({ tmdb, siteCredential }, use) => {
    const site = await startSite(tmdb, siteCredential);

    await use(site);
    await site.close();
  },

  received: async ({ page }, use) => {
    const received = new Map<string, string>();
    const pending: Promise<unknown>[] = [];

    page.on('response', (response) => {
      pending.push(
        response
          .text()
          .then((text) => received.set(response.url(), text))
          // a body that is gone, as after a redirect
          .catch(() => received.set(response.url(), '')),
      );
    });

    await use(received);
    await Promise.all(pending);
  },
});

export { expect };
