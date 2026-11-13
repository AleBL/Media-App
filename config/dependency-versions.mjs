import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const nodeModules = fileURLToPath(new URL('../node_modules/', import.meta.url));

/**
 * @param {string} name package name
 * @returns {string} the version that is installed in node_modules
 */
function installedVersion(name) {
  const manifest = readFileSync(`${nodeModules}${name}/package.json`, 'utf8');

  return JSON.parse(manifest).version;
}

// Versions shown on the About page. They are read from what is installed
// at build time, so they cannot drift from the real dependencies.
// Plain JavaScript on purpose: vite.config.mts and vitest.config.mts both
// import this file, and Node can load it without a TypeScript step.
export const dependencyVersions = {
  electron: installedVersion('electron'),
  node: process.versions.node,
  vue: installedVersion('vue'),
  vueuse: installedVersion('@vueuse/core'),
  vite: installedVersion('vite'),
  prettier: installedVersion('prettier'),
  pinia: installedVersion('pinia'),
  tailwindcss: installedVersion('tailwindcss'),
  eslint: installedVersion('eslint'),
  primevue: installedVersion('primevue'),
};
