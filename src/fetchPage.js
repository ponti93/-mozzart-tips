// Fetches the site and returns HTML.
// The site is behind Cloudflare's "managed challenge", which blocks plain
// requests from datacenter IPs (i.e. GitHub Actions). Strategy:
//   1. Try a direct request with browser-like headers, a few times.
//   2. If we get the challenge page, fall back to r.jina.ai (renders the page
//      and returns the raw HTML, keeping inline colours).

const SITE = 'https://mozzart1x2.com/';
const JINA = 'https://r.jina.ai/' + SITE;

const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'upgrade-insecure-requests': '1',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isChallenge(html) {
  return (
    !html ||
    html.length < 5000 ||
    html.includes('cf_chl_opt') ||
    /<title>\s*Just a moment/i.test(html) ||
    /Enable JavaScript and cookies to continue/i.test(html)
  );
}

async function tryDirect(attempts = 3) {
  let lastErr = 'unknown';
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(SITE + '?t=' + Date.now(), {
        headers: HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
      });
      const html = await res.text();
      if (res.ok && !isChallenge(html)) return { html, via: 'direct' };
      lastErr = `HTTP ${res.status}${isChallenge(html) ? ' (cloudflare challenge)' : ''}`;
    } catch (e) {
      lastErr = e.message;
    }
    if (i < attempts) await sleep(3000 * i);
  }
  console.log(`[fetch] direct failed: ${lastErr}`);
  return null;
}

async function tryJina() {
  const headers = { 'x-respond-with': 'html', accept: 'text/html' };
  if (process.env.JINA_API_KEY) headers.authorization = 'Bearer ' + process.env.JINA_API_KEY;
  for (let i = 1; i <= 2; i++) {
    try {
      const res = await fetch(JINA, { headers, signal: AbortSignal.timeout(90000) });
      const html = await res.text();
      if (res.ok && !isChallenge(html)) return { html, via: 'jina' };
      console.log(`[fetch] jina HTTP ${res.status}`);
    } catch (e) {
      console.log(`[fetch] jina error: ${e.message}`);
    }
    if (i < 2) await sleep(5000);
  }
  return null;
}

export async function fetchPage() {
  return (await tryDirect()) || (await tryJina());
}

export { SITE };
