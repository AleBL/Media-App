<div align="center">

# Media App (TMDB)

A simple starter template for a **Vue3** + **Electron** TypeScript based application, including **ViteJS** and **Electron Builder**.

An application that organizes and manages watched series and movies through TMDB. This application is built with **TypeScript**, utilizing **Vue3**, **Electron**, **ViteJS**, and **Electron Builder**.
</div>

## About

This application utilizes [ViteJS](https://vitejs.dev) for building and serving your (Vue powered) front-end process, it provides Hot Reloads (HMR) to make development fast and easy.

Building the Electron (main) process is done with [Electron Builder](https://www.electron.build/), which makes this application easily distributable and supports cross-platform compilation.

## Getting started

Packages needed in linux:
```bash
sudo apt-get install -yq --no-install-recommends libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 libnss3 libgbm-dev
```

***Installed versions:***
```bash
node -v # 20.9.0
yarn -v # 1.22.22
npm -v # 10.1.0
```

### Install dependencies ⏬
```bash
npm install
# OR
yarn install
```

### Start developing ⚒️

```bash
# starts application with hot reload
npm run dev
# OR
yarn dev
```

## Additional Commands

```bash
npm run build # builds application, distributable files can be found in "dist" folder
# OR
npm run build:win # uses windows as build target
npm run build:mac # uses mac as build target
npm run build:linux # uses linux as build target
# OR
yarn build:win # uses windows as build target
yarn build:mac # uses mac as build target
yarn build:linux # uses linux as build target
```
Optional configuration options can be found in the [Electron Builder CLI docs](https://www.electron.build/cli.html).

## Project Structure

```bash
- scripts/ # all the scripts used to build or serve your application, change as you like.
- src/
- main/ # Main thread (Electron application source)
- renderer/ # Renderer thread (VueJS application source)
```
