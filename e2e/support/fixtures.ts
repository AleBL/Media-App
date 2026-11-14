import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  _electron as electron,
  expect,
  test as base,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { startFakeTmdb, type FakeTmdb } from './fake-tmdb';

const projectRoot = resolve(__dirname, '../..');

// The tests do not need a visible window. E2E_SHOW=1 shows it, to watch a
// test or to debug one.
const hidden = !process.env.E2E_SHOW;

export interface RunningApp {
  app: ElectronApplication;
  page: Page;
  /** Urls the app handed to the system browser. Nothing is really opened. */
  openedInBrowser(): Promise<string[]>;
}

type Fixtures = {
  /** The local stand-in for the TMDB API that the app talks to. */
  tmdb: FakeTmdb;
  /** The profile folder of the test: saved key, genre cache, localStorage. */
  userDataDir: string;
  /**
   * Starts the built app on the home page. Calling it again after
   * `app.close()` is a restart: the profile folder is the same.
   */
  launchApp: () => Promise<RunningApp>;
  /** An app that was started for the test. */
  running: RunningApp;
  /** The window of that app. */
  page: Page;
};

export const test = base.extend<Fixtures>({
  // Playwright needs the first argument to be a destructuring pattern.
  // eslint-disable-next-line no-empty-pattern
  tmdb: async ({}, use) => {
    const tmdb = await startFakeTmdb();

    await use(tmdb);
    await tmdb.close();
  },

  // eslint-disable-next-line no-empty-pattern
  userDataDir: async ({}, use) => {
    const directory = await mkdtemp(join(tmpdir(), 'media-app-e2e-'));

    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },

  launchApp: async ({ tmdb, userDataDir }, use, testInfo) => {
    const started: RunningApp[] = [];

    await use(async () => {
      const env: Record<string, string> = {};

      for (const [name, value] of Object.entries(process.env)) {
        if (value !== undefined) env[name] = value;
      }

      env.TMDB_BASE_URL = tmdb.url;
      // Would make the app load a dev server instead of the built files.
      delete env.VITE_DEV_SERVER_URL;
      // Set by some editors' terminals: turns Electron into plain Node.
      delete env.ELECTRON_RUN_AS_NODE;

      const app = await electron.launch({
        cwd: projectRoot,
        env,
        args: [
          '.',
          // Needed on CI runners and when running as root. The renderer
          // keeps its own sandbox setting (see e2e/security.spec.ts).
          '--no-sandbox',
          `--user-data-dir=${userDataDir}`,
          // On Linux the app can run without any display, so nothing shows
          // up on the desktop and CI needs no virtual screen.
          ...(hidden && process.platform === 'linux'
            ? ['--ozone-platform=headless']
            : []),
        ],
      });

      // Tests must not open pages in the real browser of whoever runs them.
      await app.evaluate(({ shell }) => {
        const opened: string[] = [];

        Object.assign(globalThis, { openedInBrowser: opened });
        shell.openExternal = async (url) => {
          opened.push(url);
        };
      });

      const page = await app.firstWindow();

      // The other systems have no such mode: hide the window instead.
      // Playwright drives a hidden window the same way.
      if (hidden && process.platform !== 'linux') {
        await app.evaluate(({ BrowserWindow }) => {
          for (const window of BrowserWindow.getAllWindows()) window.hide();
        });
      }

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const running: RunningApp = {
        app,
        page,
        openedInBrowser: () =>
          app.evaluate(
            () =>
              (globalThis as unknown as { openedInBrowser: string[] })
                .openedInBrowser,
          ),
      };

      started.push(running);

      return running;
    });

    for (const [index, { app, page }] of started.entries()) {
      if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) {
        await testInfo.attach(`window-${index + 1}`, {
          body: await page.screenshot().catch(() => Buffer.from('')),
          contentType: 'image/png',
        });
      }

      await app.close().catch(() => {});
    }
  },

  running: async ({ launchApp }, use) => {
    await use(await launchApp());
  },

  page: async ({ running }, use) => {
    await use(running.page);
  },
});

export { expect };

/** Types a TMDB key on the home page and saves it. */
export async function saveKey(page: Page, apiKey: string) {
  await page.locator('input[type="password"]').fill(apiKey);
  await page.locator('button:has(.pi-save)').click();
}

/** Goes to a page through the menu, like a user would. */
export async function openPage(page: Page, name: 'home' | 'search' | 'about') {
  await page.locator(`a[href$="#/${name}"]`).click();
  await expect(page).toHaveURL(new RegExp(`#/${name}$`));
}

export const cards = (page: Page) => page.locator('.card-border');
export const searchBox = (page: Page) =>
  page.locator('[data-pc-name="inputtext"]');
