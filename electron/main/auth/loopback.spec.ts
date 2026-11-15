// @vitest-environment node
import { request, type IncomingHttpHeaders } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  startLoopback,
  type CallbackOutcome,
  type Loopback,
  type LoopbackOptions,
} from './loopback';

const TOKEN = 'a1b2c3d4e5f6';

interface Answer {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

// A browser, as far as the server can tell. `host` is for the one thing a
// browser decides by itself: the name it used to get here.
function visit(url: string, options: { method?: string; host?: string } = {}) {
  return new Promise<Answer>((resolve, reject) => {
    const outgoing = request(
      url,
      {
        method: options.method ?? 'GET',
        headers: options.host ? { Host: options.host } : {},
        agent: false,
      },
      (response) => {
        let body = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body,
          }),
        );
      },
    );

    outgoing.on('error', reject);
    outgoing.end();
  });
}

describe('loopback', () => {
  let loopback: Loopback;

  async function start(options: Partial<LoopbackOptions> = {}) {
    const onCallback = vi.fn(async (): Promise<CallbackOutcome> => 'done');

    loopback = await startLoopback({
      requestToken: TOKEN,
      onCallback,
      page: (outcome) => `<p>${outcome}</p>`,
      ...options,
    });

    return {
      onCallback,
      callback: `${loopback.url}?request_token=${TOKEN}&approved=true`,
    };
  }

  afterEach(() => loopback.close());

  it('listens on this computer only, on a port picked by the system', async () => {
    await start();

    expect(loopback.url).toMatch(/^http:\/\/127\.0\.0\.1:\d{2,5}\/callback$/);
  });

  it('answers the browser coming back with the page, after asking once', async () => {
    const { onCallback, callback } = await start();

    const answer = await visit(callback);

    expect(answer.status).toBe(200);
    expect(answer.body).toBe('<p>done</p>');
    expect(answer.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(answer.headers['cache-control']).toBe('no-store');
    expect(answer.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    expect(onCallback).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['says so', async (): Promise<CallbackOutcome> => 'failed'],
    [
      'breaks',
      async (): Promise<CallbackOutcome> => {
        throw new Error('boom');
      },
    ],
  ])('shows the failure page when the login %s', async (_case, onCallback) => {
    const { callback } = await start({ onCallback });

    const answer = await visit(callback);

    expect(answer.status).toBe(200);
    expect(answer.body).toBe('<p>failed</p>');
  });

  it('takes nothing else for the callback', async () => {
    const { onCallback, callback } = await start();
    const { origin, host } = new URL(loopback.url);

    const strangers = await Promise.all([
      // what a browser asks for right after any page
      visit(`${origin}/favicon.ico`),
      visit(`${origin}/`),
      visit(loopback.url),
      visit(`${loopback.url}?request_token=another&approved=true`),
      visit(`${loopback.url}/?request_token=${TOKEN}`),
      visit(callback, { method: 'POST' }),
      // a page of some site that resolved its own name to this computer
      visit(callback, { host: `evil.example:${host.split(':')[1]}` }),
    ]);

    expect(strangers.map((answer) => answer.status)).toEqual(
      strangers.map(() => 404),
    );
    expect(strangers.map((answer) => answer.body).join('')).toBe('');
    expect(onCallback).not.toHaveBeenCalled();

    // ...and the real one still works after all of them.
    expect((await visit(callback)).status).toBe(200);
    expect(onCallback).toHaveBeenCalledTimes(1);
  });

  it('works once: it stops listening after the callback', async () => {
    const { onCallback, callback } = await start();

    await visit(callback);

    await vi.waitFor(() =>
      expect(visit(callback)).rejects.toMatchObject({ code: 'ECONNREFUSED' }),
    );
    expect(onCallback).toHaveBeenCalledTimes(1);
  });

  it('stops listening when it is closed, as often as it is asked to', async () => {
    const { onCallback, callback } = await start();

    await loopback.close();
    await loopback.close();

    await expect(visit(callback)).rejects.toMatchObject({
      code: 'ECONNREFUSED',
    });
    expect(onCallback).not.toHaveBeenCalled();
  });
});
