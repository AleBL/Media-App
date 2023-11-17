<div align="center"> 

# Media App (TMDB)
A simple starter template for a **Vue3** + **Electron** TypeScript based application, including **ViteJS** and **Electron Builder**.
An application that organizes and manages watched series and movies through TMDB. This application is built with **TypeScript**, utilizing **Vue3**, **Electron**, **ViteJS**, and **Electron Builder**.
</div>

## About

This application utilizes [ViteJS](https://vitejs.dev) for building and serving your (Vue powered) front-end process, it provides Hot Reloads (HMR) to make development fast and easy.

Building the Electron (main) process is done with [Electron Builder](https://www.electron.build/), which makes this application easily distributable and supports cross-platform compilation.

## Getting started

***Installed node version 20.9.0***

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
