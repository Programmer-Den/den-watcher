// Opens the demo build (npm run build:demo) in a real browser and goes through every view: home,
// each device's page, the comparison, the Wi-Fi map and the alert log, in dark and light mode and
// at phone width. It fails on any error the page throws or logs, which unit tests in jsdom miss,
// such as a template that only breaks when it is drawn.
//
// Run with: npm run build:demo && npm run test:demo
// It uses the Chrome installed on the machine (as on GitHub's runners); CHROME_PATH names another
// Chrome or Chromium binary.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';

const root = new URL('../dist/demo/', import.meta.url).pathname;
// The demo is built for GitHub Pages, below the repository's name.
const base = '/den-watcher/';
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
};

let server;
let browser;
let origin;

before(async () => {
  server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
    if (!path.startsWith(base)) {
      response.writeHead(404).end();
      return;
    }
    const file = normalize(join(root, path.slice(base.length) || 'index.html'));
    try {
      const body = await readFile(file.startsWith(root) ? file : join(root, 'index.html'));
      response.writeHead(200, {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const path = process.env.CHROME_PATH;
  browser = await chromium.launch(path ? { executablePath: path } : { channel: 'chrome' });
});

after(async () => {
  await browser?.close();
  server?.close();
});

/** Opens the demo and collects every error the page throws or logs from its own files. */
async function open(options) {
  const page = await browser.newPage(options);
  const errors = [];
  page.on('pageerror', (error) => errors.push(`thrown: ${error.message}`));
  page.on('console', (message) => {
    // The map tiles come from OpenStreetMap, which a test machine may not reach. The browser
    // reports a ResizeObserver loop when a chart redraws at its new size within the same frame;
    // it is harmless, and Angular only logs it.
    if (
      message.type() === 'error' &&
      message.location().url.startsWith(origin) &&
      !message.text().includes('ResizeObserver loop')
    ) {
      errors.push(`logged: ${message.text()}`);
    }
  });
  await page.route(/^https?:\/\//, (route) =>
    route.request().url().startsWith(origin) ? route.continue() : route.abort(),
  );
  await page.goto(origin + base);
  // At phone width the list is in a drawer, so it is there but not shown.
  await page.locator('app-device-item').first().waitFor({ state: 'attached' });
  return { page, errors };
}

/** Clicks a button and waits until the page has settled. */
async function click(page, locator) {
  await locator.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}

for (const colorScheme of ['dark', 'light']) {
  test(`every view opens without errors, ${colorScheme}`, async () => {
    const { page, errors } = await open({ colorScheme, viewport: { width: 1400, height: 900 } });

    const devices = page.locator('app-device-item button');
    const count = await devices.count();
    assert.ok(count > 1, 'the demo lists several devices');
    for (let i = 0; i < count; i++) {
      await click(page, devices.nth(i));
      await page.locator('app-dashboard').first().waitFor();
    }
    for (const title of ['Compare', 'Wi-Fi map']) {
      await click(page, page.locator(`button[title^="${title}"]`).first());
    }
    for (const tab of ['Networks', 'Town Wi-Fi', 'Track by Wi-Fi']) {
      await click(page, page.getByRole('button', { name: tab, exact: false }).first());
    }
    await click(page, page.locator('button[title^="Home"]').first());
    // Named by the number of active alerts while there are any, as in the demo.
    await click(page, page.locator('app-alerts-button button'));
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');

    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('the page opens without errors at phone width', async () => {
  const { page, errors } = await open({
    colorScheme: 'dark',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await page.waitForLoadState('networkidle');
  assert.deepEqual(errors, []);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    'the page does not scroll sideways',
  );
  await page.close();
});
