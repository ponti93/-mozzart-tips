// Fetches the site and returns HTML.
//
// The site is behind Cloudflare's "managed challenge", which needs a real
// browser running JavaScript. Plain HTTP clients are tried first because they
// are cheap and sometimes get through.
//
// Order of attempts:
//   1. curl with browser headers
//   2. node fetch
//   3. r.jina.ai
//   4. real Chrome via puppeteer-core   (headed under xvfb on GitHub Actions)

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';

const run = promisify(execFile);
const SITE = 'https://mozzart1x2.com/';
const JINA = 'https://r.jina.ai/' + SITE;
const CURL = process.platform === 'win32' ? 'curl.exe' : 'curl';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function isChallenge(html) {
  return (
    !html ||
    html.length < 5000 ||
    html.includes('cf_chl_opt') ||
    /<title>\s*Just a moment/i.test(html) ||
    /Enable JavaScript and cookies to continue/i.test(html)
  );
}

async function tryCurl(attempts) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const { stdout } = await run(
        CURL,
        [
          '-sS',
          '-L',
          '--compressed',
          '-m',
          '30',
          '-A',
          UA,
          '-H',
          'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          '-H',
          'accept-language: en-US,en;q=0.9',
          '-H',
          'upgrade-insecure-requests: 1',
          SITE,
        ],
        { maxBuffer: 8 * 1024 * 1024, timeout: 45000 }
      );
      const bad = isChallenge(stdout);
      console.log(`[fetch] curl ${i}/${attempts}: ${stdout.length}b${bad ? ' (challenge)' : ''}`);
      if (!bad) return { html: stdout, via: 'curl' };
    } catch (e) {
      console.log(`[fetch] curl ${i}/${attempts}: ${e.message.split('\n')[0]}`);
    }
    if (i < attempts) await sleep(15000 + i * 10000);
  }
  return null;
}

async function tryNode() {
  try {
    const res = await fetch(SITE, {
      headers: { 'user-agent': UA, accept: 'text/html', 'accept-language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(30000),
    });
    const html = await res.text();
    const bad = isChallenge(html);
    console.log(`[fetch] node: HTTP ${res.status} ${html.length}b${bad ? ' (challenge)' : ''}`);
    if (res.ok && !bad) return { html, via: 'node' };
  } catch (e) {
    console.log(`[fetch] node: ${e.message}`);
  }
  return null;
}

async function tryJina(attempts) {
  const headers = { 'x-respond-with': 'html', accept: 'text/html' };
  if (process.env.JINA_API_KEY) headers.authorization = 'Bearer ' + process.env.JINA_API_KEY;

  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(JINA, { headers, signal: AbortSignal.timeout(90000) });
      const html = await res.text();
      const bad = isChallenge(html);
      console.log(`[fetch] jina ${i}/${attempts}: HTTP ${res.status} ${html.length}b${bad ? ' (challenge)' : ''}`);
      if (res.ok && !bad) return { html, via: 'jina' };
    } catch (e) {
      console.log(`[fetch] jina ${i}/${attempts}: ${e.message}`);
    }
    if (i < attempts) await sleep(10000);
  }
  return null;
}

const BROWSERS = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

async function tryBrowser(attempts) {
  const executablePath = BROWSERS.find((p) => fs.existsSync(p));
  if (!executablePath) {
    console.log('[fetch] browser: no chrome found');
    return null;
  }
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer-core')).default;
  } catch {
    console.log('[fetch] browser: puppeteer-core not installed (run npm ci)');
    return null;
  }

  // headed when a display exists (xvfb on CI, desktop on Windows)
  const headless = process.platform !== 'win32' && !process.env.DISPLAY;

  for (let i = 1; i <= attempts; i++) {
    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--no-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1280,900',
          '--no-first-run',
          '--no-default-browser-check',
        ],
        defaultViewport: null,
      });
      const [page] = await browser.pages();
      await page.setUserAgent((await browser.userAgent()).replace('HeadlessChrome', 'Chrome'));
      await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // wait for the challenge to hand over the real page
      let html = '';
      for (let t = 0; t < 45; t++) {
        await sleep(2000);
        html = await page.content().catch(() => '');
        if (!isChallenge(html)) break;
      }
      const bad = isChallenge(html);
      console.log(`[fetch] browser ${i}/${attempts}: ${html.length}b${bad ? ' (challenge)' : ''}${headless ? ' headless' : ''}`);
      if (!bad) return { html, via: 'browser' };
    } catch (e) {
      console.log(`[fetch] browser ${i}/${attempts}: ${e.message.split('\n')[0]}`);
    } finally {
      await browser?.close().catch(() => {});
    }
    if (i < attempts) await sleep(10000);
  }
  return null;
}

export async function fetchPage() {
  return (await tryCurl(2)) || (await tryNode()) || (await tryJina(1)) || (await tryBrowser(3));
}

export { SITE };
