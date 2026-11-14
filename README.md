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
- [![Bootstrap][Bootstrap]][Bootstrap-url]

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
[Bootstrap]: https://img.shields.io/badge/bootstrap-%238511FA.svg?style=for-the-badge&logo=bootstrap&logoColor=white
[Bootstrap-url]: https://getbootstrap.com/

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

The end-to-end tests in `e2e/` start the real app against a local stand-in for the TMDB API (`e2e/support/fake-tmdb.ts`), each with its own profile folder, so they need neither a TMDB credential nor a connection. On Linux they run without opening a window; set `E2E_SHOW=1` to watch them.

The run builds the app itself (`e2e/support/global-setup.ts`) with a made up credential, so a real token from `.env.local` is never in the app under test. That test build stays in `dist` and `dist-electron` afterwards: the `build` scripts replace it, but run `npx vite build` before starting or packaging the app by hand.

#### Taze

```bash
npm run deps:update # run taze major -I
```

## Project Structure

```bash
📦config # build helpers shared by the Vite and Vitest configs
📦e2e # end-to-end tests: the built app against a local stand-in for TMDB
📦electron
 ┣ 📦main
 ┃ ┣ 📦tmdb # TMDB client, credentials, genre cache and input validation
 ┃ ┣ 📜index.ts # entry of Electron-Main
 ┃ ┣ 📜ipc.ts # handlers behind window.api
 ┃ ┗ 📜security.ts # rules for navigation, external links and IPC input
 ┗ 📦preload
   ┗ 📜index.ts # exposes window.api to the renderer, loading screen
📦shared
 ┗ 📜api.ts # contract between the preload script and the renderer
📦src
 ┣ 📦assets
 ┣ 📦components
 ┣ 📦locales # i18n messages (en, es, pt-BR)
 ┣ 📦plugins
 ┣ 📦presets # PrimeVue Components Styled with Tailwind CSS - https://github.com/primefaces/primevue-tailwind
 ┣ 📦router
 ┣ 📦services # access to window.api
 ┣ 📦stores # Pinia stores: search, genres, TMDB credential status
 ┣ 📦style
 ┣ 📦test # helpers for the unit tests
 ┣ 📦types
 ┣ 📦util
 ┗ 📦views
```

## Security model

The renderer is plain web code: it runs sandboxed, with context isolation and without Node or Electron access. Whatever it needs from the main process is exposed by the preload script as `window.api` and declared in `shared/api.ts`. To add a capability, declare it there, implement it in `electron/preload/index.ts` and handle it in `electron/main/ipc.ts`, validating every value that comes from the renderer.

TMDB is only reached from the main process. The renderer asks through `window.api.tmdb` and never sees a credential. The app's own is compiled into the main process (see [Give the app access to TMDB](#give-the-app-access-to-tmdb-)), and the optional key of the user is saved by the main process, encrypted by the operating system when a keyring is available. The end-to-end tests check that the app's credential is in no file that the window loads. Unit tests replace `window.api` with `installFakeApi()` from `src/test/fakeApi.ts`.

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
