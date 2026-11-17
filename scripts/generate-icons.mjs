// Renders build/icon.svg into the icons of the app (npm run icons):
//   build/icon.png      1024 px, for the macOS and Windows installers
//   build/icons/*.png   16 to 512 px, the icon theme set of the Linux packages
//   public/favicon.png  256 px, the window icon on Linux and macOS
//   public/favicon.ico  16 to 256 px, the browser tab and the window icon on Windows
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const svg = await readFile(new URL('build/icon.svg', root), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );

  return page.screenshot({ omitBackground: true, type: 'png' });
}

/** An .ico that holds PNG images, which Windows and browsers read. */
function toIco(images) {
  const header = Buffer.alloc(6);
  const entries = [];
  let offset = header.length + 16 * images.length;

  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);

    // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

try {
  await writeFile(new URL('build/icon.png', root), await render(1024));
  await writeFile(new URL('public/favicon.png', root), await render(256));
  await mkdir(new URL('build/icons/', root), { recursive: true });

  for (const size of [16, 32, 48, 64, 128, 256, 512]) {
    await writeFile(
      new URL(`build/icons/${size}x${size}.png`, root),
      await render(size),
    );
  }

  const icoImages = [];

  for (const size of [16, 32, 48, 256]) {
    icoImages.push({ size, png: await render(size) });
  }

  await writeFile(new URL('public/favicon.ico', root), toIco(icoImages));
} finally {
  await browser.close();
}
