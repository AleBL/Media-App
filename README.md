<div align="center">
<h1>Media App (TMDB)</h1>

An application that organizes and manages watched series and movies through [TMDB](https://www.themoviedb.org/). This application is built with **TypeScript**, utilizing **Vue3**, **Electron**, **ViteJS**, and **Electron Builder**.
</div>

## About

This application utilizes [ViteJS](https://vitejs.dev) for building and serving your (Vue powered) front-end process, it provides Hot Reloads (HMR) to make development fast and easy.

Building the Electron (main) process is done with [Electron Builder](https://www.electron.build/), which makes this application easily distributable and supports cross-platform compilation.

### Built With

- [![Vue][Vue.js]][Vue-url]
- [![Vite][Vite.js]][Vite-url]
- [![NodeJS][NodeJS]][Node-url]
- [![TypeScript][TypeScript]][TypeScript-url]
- [![Electron][Electron.js]][Electron-url]
- [![TailwindCSS][TailwindCSS]][TailwindCSS-url]
- [![ESLint][ESLint]][ESLint-url]

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[Vue.js]: https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D
[Vue-url]: https://vuejs.org/
[Vite.js]: https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vitejs.dev
[NodeJS]: https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white
[Node-url]: https://nodejs.org/
[TypeScript]: https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[Electron.js]: https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white
[Electron-url]: https://www.electronjs.org/
[TailwindCSS]: https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white
[TailwindCSS-url]: https://tailwindcss.com/
[ESLint]: https://img.shields.io/badge/ESLint-4B3263?style=for-the-badge&logo=eslint&logoColor=white
[ESLint-url]: https://eslint.org/

## Getting started

Packages needed in linux:

```bash
sudo apt-get install -yq --no-install-recommends libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 libnss3 libgbm-dev
```

_**Requirements:**_

```bash
node -v # 22.13+, 24 or 26+ (CI runs on 26)
npm  -v # >= 11 (this project uses npm only; do not use yarn or pnpm)
```

### Install dependencies ⏬

```bash
npm ci
```

### Give the app access to TMDB 🔑

The app talks to TMDB with a credential of its own, so whoever uses it does not have to create a key. That credential comes from the `TMDB_READ_TOKEN` variable when the app is built:

```bash
cp .env.example .env.local # ignored by git
# then paste your "API Read Access Token" from https://www.themoviedb.org/settings/api
```

`npm run dev` and the build scripts read it from `.env.local` or from the environment, which is how a release workflow passes a repository secret. Without it everything still builds, with a warning, and the app asks each user for a key of their own on the **Settings** page.

The token is compiled into the main process only (`dist-electron/main`), never into the renderer. It is not in the repository, but anyone can extract it from a distributed app: treat it as what identifies the app to TMDB, not as a secret, and be ready to replace it. A key that a user saves in **Settings** is used instead of it, which keeps their copy working if the token is ever revoked.

### The web version 🌐

The same interface also runs as a web page, deployed by Vercel. A page cannot hold the credential (everything a browser loads is public), so there it asks functions of the site, the files in `api`, which keep `TMDB_READ_TOKEN` on the server and only do what the app does: search movies, tv shows and people, list genres, show the lists of the home page and the page of a title, sign in, and read and change the watchlist, the favorites, the ratings and the watched titles of whoever signed in.

- On Vercel, set `TMDB_READ_TOKEN` in the project's environment variables, for Production and for Preview. Never give it a `VITE_` prefix: that would put it in the page.
- The Settings page of the web version has no key of the user, as a browser has no safe place for it, and no cache to clear: the browser keeps it.
- Signing in works there too, with the session kept by the site (`api/auth`). It needs no other variable.
- Locally, `npm run dev` and `npx vite preview` answer `/api/tmdb`, `/api/auth` and `/api/account` with the same code, so opening the address they print in a browser shows the web version.
- Vercel does not build the functions with Vite: it compiles them with `api/tsconfig.json`, which makes them CommonJS, the only format in which Node finds the files they import without an extension. `shared/tmdb/vercel.spec.ts` builds and loads them the same way.

### Signing in with TMDB 👤

Signing in is optional: the search never needs it. On the **Sign in** page the user is sent to the approval page of the TMDB website, so the app never sees a password. It needs no setup beyond the credential above.

The app signs in through TMDB v4, with its own access token: one approval gives the user's access token, which lists of their own take, and a session made from it (`/3/authentication/session/convert/4`), which the watchlist, the favorites and the ratings take. v4 only takes an access token, so in the desktop app, with a key of the user (v3) in place of the one of the app, it signs in through v3 and gets the session alone.

In the desktop app:

- The approval page opens in the browser of the system. TMDB sends that browser back to a web server that the app opens for that one login, on `127.0.0.1`, a port picked by the system and an address made up for the login. It closes after the first callback, on **Cancel**, or after five minutes.
- When the browser does not come back by itself, **I already approved in the browser** asks TMDB directly. When the browser does not even open, the page shows the address to copy.
- The session (with the access token of the user) is kept for the next launch, encrypted by the keyring of the system (Keychain, DPAPI, Secret Service or KWallet), in `tmdb-session.bin` inside the app's profile folder. The next launch shows who is signed in at once and asks TMDB whether the session still works: ended on the TMDB website, it signs out; TMDB out of reach, it stays signed in, says so, and asks again by itself.
- On a system without a keyring (some Linux setups, WSL) the session only lasts until the app closes, unless the user presses **Keep me signed in**, which saves it unencrypted in a file only that user can read.
- **Sign out** removes the saved session and ends it at TMDB.

In the web version:

- The page itself goes to the TMDB website and comes back through the site (`/api/auth/login`, then `/api/auth/callback`), which keeps the session and the access token of the user in cookies that scripts cannot read.
- The browser stays signed in for 180 days after the last visit, or until **Sign out**, which also ends the session at TMDB. Ending it on the TMDB website signs out here on the next visit.

### My list and favorites 🔖

Whoever signed in has a menu of their own under their name, in the menu bar: **My list** (the watchlist of the TMDB account), **Favorites**, **Rated**, **Watched**, **Account** and **Sign out**. The page of a title has a **My list** and a **Favorite** button, and so does every card of the search, of the home page and of the lists, on its poster: a change shows at once and is undone if TMDB does not take it. For the cards the app reads the lists once, at sign in (TMDB only tells it otherwise one title at a time), up to 200 movies and 200 tv shows in each; a title past them shows as not in the list on its card, and as it is on its page, which asks TMDB about it alone. The two lists have pages of their own, movies or tv shows, the titles added last first. They live at TMDB, so they are the same on the TMDB website and in any other app of the same account.

Nobody signed in: the page of a title offers to sign in instead, and the pages of the lists lead to the sign in. In the desktop app the sign in then goes back to the page the user was on; on the web the browser comes back from TMDB to the account page, which links to the lists.

### Ratings ⭐

The page of a title also has **Your rating**: a list from 0.5 to 10, in steps of 0.5, the ones TMDB takes, and **Not rated**, which takes the rating away. Like the buttons, a rating shows at once and goes back to what TMDB has if TMDB does not take it; choosing again while one is on its way only sends the last choice. By default TMDB takes a title it rates out of the watchlist (a setting of the TMDB account), so after a rating the page asks TMDB again which lists the title is in. **Rated** lists the rated movies or tv shows, the last rated first, each card with the rating it got.

### Watched titles 👁️

TMDB keeps no "watched", so the app keeps it in a list of the TMDB account: a private one, made the first time a title is marked (**Watched** on the page of the title), named in the language of the app and found again by its description on any computer and on the web. Each title has the day it was marked as its comment. **Watched** lists them, movies and tv shows together, the last marked first. A list of the user takes their v4 access token, so whoever signed in before the v4 login (or with a key of their own) is asked to sign out and in again. Being a list, it shows on the TMDB website too, and deleting it there just makes the app start a new one.

### Settings ⚙️

**Settings** has the language and the theme (the same as the menu, plus following the system), and the country of where to watch: automatic (from the languages of the system, see below) or one of the countries TMDB knows where to watch in. In the desktop app it also has a key of your own (above) and **Clear cache**, which forgets the genres kept on disk and the images Chromium kept, asked again when needed. Everything is kept in the window (or browser) for the next launch.

### The page of a title 🎬

The search looks for movies, for tv shows, or for everything (**All**), which also finds people: each of them comes with the titles they are known for, linked to their pages, as the app has no page of a person. The home page lists what is trending this week and the popular movies and tv shows, from TMDB. A title of those lists, or a result of the search, opens the page of the movie or tv show: the overview, the cast, where to watch it, and links to the trailer and to IMDb, which open in the browser of the system. Where to watch comes from JustWatch through TMDB, for the country named by the languages of the system (of the browser, on the web): `pt-BR` is Brazil, `en-GB` the United Kingdom. TMDB only allows that data with JustWatch named as its source, so that line stays on the page.

### Start developing ⚒️

```bash
# starts application with hot reload
npm run dev
```

### Additional Commands

#### Build

```bash
npm run build # builds application, distributable files can be found in "release" folder

# OR

npm run build:win   # uses windows as build target
npm run build:mac   # uses mac as build target
npm run build:linux # uses linux as build target
```

Optional configuration options can be found in the [Electron Builder CLI docs](https://www.electron.build/cli.html).

#### Lint and Prettier

```bash
npm run lint         # run eslint, fixing what it can
npm run lint:check   # run eslint without changing files (used by CI)
npm run format       # format every file with prettier
npm run format:check # check the formatting without changing files (used by CI)
npm run typecheck    # run vue-tsc
```

#### Tests

```bash
npm test           # run unit tests once (vitest)
npm run test:watch # run unit tests in watch mode
npm run test:e2e   # build the app and drive it end to end (playwright)
```

The end-to-end tests cover the two ways the app runs: as a desktop app, in Electron (`e2e/*.spec.ts`), and as a web page, in a browser (`e2e/web`). The browser has to be downloaded once with `npx playwright install chromium`; to run only one of the two, add `-- --project=desktop` or `-- --project=web`.

The end-to-end tests in `e2e/` start the real app against a local stand-in for the TMDB API (`e2e/support/fake-tmdb.ts`), each with its own profile folder, so they need neither a TMDB credential nor a connection. On Linux they run without opening a window; set `E2E_SHOW=1` to watch them.

The run builds the app itself (`e2e/support/global-setup.ts`) with a made up credential, so a real token from `.env.local` is never in the app under test. That test build stays in `dist` and `dist-electron` afterwards: the `build` scripts replace it, but run `npx vite build` before starting or packaging the app by hand.

#### Taze

```bash
npm run deps:update # run taze major -I
```

Keep `primeicons` on 7: version 8, like the other PrimeTek libraries since mid 2026, is no longer MIT and needs a license key. That is also why the app has no PrimeVue: its components are in `src/components/ui`.

## Project Structure

```bash
📦api # Vercel Functions: what the web version asks of the site
 ┣ 📦auth # signing in: login, callback, session and logout
 ┣ 📜account.ts # the watchlist, the favorites, the ratings and the watched titles of whoever signed in
 ┣ 📜tmdb.ts # answers the TMDB requests
 ┗ 📜tsconfig.json # how Vercel compiles the functions
📦config # build helpers shared by the Vite and Vitest configs
📦e2e # end-to-end tests: the built app against a local stand-in for TMDB
 ┗ 📦web # the same for the web version, in a browser
📦electron
 ┣ 📦main
 ┃ ┣ 📦auth # signing in to TMDB: the login, the way back from the browser, the saved session
 ┃ ┣ 📦tmdb # credentials and genre cache of the desktop app
 ┃ ┣ 📜index.ts # entry of Electron-Main
 ┃ ┣ 📜ipc.ts # handlers behind window.api
 ┃ ┣ 📜secret-file.ts # a value of the user on disk, encrypted when the system can
 ┃ ┗ 📜security.ts # rules for navigation, external links and IPC input
 ┗ 📦preload
   ┗ 📜index.ts # exposes window.api to the renderer, loading screen
📦shared # used by more than one of: main process, renderer, web function
 ┣ 📦tmdb # TMDB client, input validation and what the functions of the site do
 ┗ 📜api.ts # what the renderer can ask, on the desktop and on the web
📦src
 ┣ 📦assets
 ┣ 📦components
 ┃ ┗ 📦ui # buttons and the paginator of the app, in Tailwind CSS
 ┣ 📦locales # i18n messages (en, es, pt-BR)
 ┣ 📦plugins
 ┣ 📦router
 ┣ 📦services # the api of the renderer: window.api, or HTTP on the web
 ┣ 📦stores # Pinia stores: search, genres, TMDB credential status, session, lists of the account
 ┣ 📦test # helpers for the unit tests
 ┣ 📦types
 ┣ 📦util
 ┣ 📦views
 ┗ 📜style.css # Tailwind CSS 4 and its theme: colors, font, dark mode (no tailwind.config.js)
```

## Security model

The renderer is plain web code: it runs sandboxed, with context isolation and without Node or Electron access. Whatever it needs from the main process is exposed by the preload script as `window.api` and declared in `shared/api.ts`. To add a capability, declare it there, implement it in `electron/preload/index.ts` and handle it in `electron/main/ipc.ts`, validating every value that comes from the renderer.

In the desktop app, TMDB is only reached from the main process. The renderer asks through `window.api.tmdb` and never sees a credential. The app's own is compiled into the main process (see [Give the app access to TMDB](#give-the-app-access-to-tmdb-)), and the optional key of the user is saved by the main process, encrypted by the operating system when a keyring is available. The end-to-end tests check that the app's credential is in no file that the window loads. Unit tests replace `window.api` with `installFakeApi()` from `src/test/fakeApi.ts`.

Signing in follows the same rule. TMDB's `session_id` and the v4 access token of the user each work as a password of the account, so they stay in the main process (`electron/main/auth/service.ts`) and the renderer is only told who signed in. The callback from the browser (`electron/main/auth/loopback.ts`) can be reached by any program or page on the computer, so it proves nothing: it is only the signal to ask TMDB whether the request token was approved. Its address ends in a random value made up for each login, which only TMDB is given; requests to any other address get a 404.

The web version has no main process, so the same `shared/api.ts` is implemented over HTTP (`src/services/webApi.ts`) on top of the functions in `api`. `api/tmdb.ts` is not a general proxy: it accepts only the requests of the app, validates them with the code the main process uses (`shared/tmdb/validation.ts`) and lets the CDN cache the answers. A capability added to `shared/api.ts` has to be implemented there too, or the web version loses it.

On the web the `session_id` and the access token of the user stay with the site (`shared/tmdb/web-auth.ts`, behind `api/auth`): in cookies that are `HttpOnly`, so no script of the page can read it, `Secure`, `SameSite=Lax` and named with the `__Host-` prefix, so no other site on the same domain can plant one. The page is only told who signed in, and those answers are never cached. The way back from TMDB (`/api/auth/callback`) can be opened by anyone, like the one of the desktop app, so its parameters decide nothing: the token traded is the one in the cookie of the login, and TMDB says whether it was approved (at worst, a page that sends the browser there early ends a login that was still waiting, as a refusal). Signing out is a `POST` that has to come from the site itself. The lists and the ratings of the account (`shared/tmdb/web-account.ts`, behind `api/account`) work with the same cookie: reading is a `GET`, a change (to a list or a rating) a `POST` that has to come from the site itself, and nothing they answer is cached. TMDB keeps the lists under the id of the account, which the site asks TMDB for with the session; a rating is under the title, so the session alone does. The watched titles take the access token of the user instead, from its cookie; the id of their list is kept in a cookie too, so it is looked for once.

The window only shows the app itself: other links open in the system browser (https only), permission requests are denied and the Content-Security-Policy is generated by `vite.config.mts`.

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
