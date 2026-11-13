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
```

#### Taze

```bash
npm run deps:update # run taze major -I
```

## Project Structure

```bash
📦electron
 ┣ 📦main
 ┃ ┗ 📜index.ts # entry of Electron-Main
 ┗ 📦preload
   ┗ 📜index.ts # preload script (loading screen)
📦src
 ┣ 📦assets
 ┣ 📦components
 ┣ 📦locales # i18n messages (en, es, pt-BR)
 ┣ 📦plugins
 ┣ 📦presets # PrimeVue Components Styled with Tailwind CSS - https://github.com/primefaces/primevue-tailwind
 ┣ 📦router
 ┣ 📦services
 ┣ 📦style
 ┣ 📦types
 ┣ 📦util
 ┃ ┗ 📜tmdb.js
 ┗ 📦views
```

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
