import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const nodeModules = fileURLToPath(new URL('../node_modules/', import.meta.url));

function installedVersion(name: string): string {
  const manifest = readFileSync(`${nodeModules}${name}/package.json`, 'utf8');

  return JSON.parse(manifest).version;
}

// Versions shown on the About page. They are read from what is installed
// at build time, so they cannot drift from the real dependencies.
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

export type DependencyVersions = typeof dependencyVersions;
