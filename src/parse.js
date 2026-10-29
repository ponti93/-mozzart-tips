// Parses the tip blocks out of the page HTML.
//
// The site publishes each day's tip as a pair of paragraphs, newest first:
//
//   <p style="... color: white ...">Single :</p>
//   <p style="... color: white ...">20:45 Fiorentina – Atalanta : Over 2.5 @ 1.50</p>
//
// Colour of the second paragraph tells you the state:
//   white / #ffffff  -> not played yet  (this is the tip to send)
//   lime  / #33ff33  -> won
//   #33ccff          -> lost
//
// Sometimes, before the real tip is ready, the same slot holds a filler such as
// "..." or "Tips coming soon at 18:00". Those are marked as placeholders and are
// never announced.

const PENDING_COLORS = new Set(['white', '#fff', '#ffffff']);
const WON_COLORS = new Set(['lime', '#33ff33', '#00ff00', '#0f0', 'green', '#32cd32']);
const LOST_COLORS = new Set(['#33ccff', '#00ffff', 'cyan', 'blue', '#0000ff', '#0ff', '#1e90ff', '#00bfff']);

// Filler text that means "no tip yet".
const PLACEHOLDER_RE =
  /^(\.{2,}|[-–—_.!?…\s]+)$|coming soon|coming shortly|coming later|will be (posted|online|published|added|ready)|(posted|published|online|ready) (soon|later|shortly)|be posted|stay tuned|check back|still (working|loading)|wait for|patience|tips? (will|are|is|coming)|tip coming|no tips? (yet|today)|soon\b|later today|in a (few|moment|bit)/i;

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—');
}

function textOf(html) {
  return decodeEntities(html.replace(/<img[^>]*>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function colorOf(attrs, inner) {
  const m = /color\s*:\s*([^;"]+)/i.exec(attrs || '');
  if (m) return m[1].trim().toLowerCase();
  const s = /<span[^>]*color\s*:\s*([^;"]+)/i.exec(inner || '');
  return s ? s[1].trim().toLowerCase() : '';
}

export function classify(color) {
  const c = (color || '').replace(/\s+/g, '').toLowerCase();
  if (PENDING_COLORS.has(c)) return 'pending';
  if (WON_COLORS.has(c)) return 'won';
  if (LOST_COLORS.has(c)) return 'lost';
  return 'unknown';
}

export function isPlaceholder(text) {
  return PLACEHOLDER_RE.test(text) || !/[a-z]/i.test(text.replace(/^[\d:.]+/, ''));
}

// "20:45 Fiorentina – Atalanta : Over 2.5 @ 1.50"
export function looksLikeTip(text) {
  if (!text || isPlaceholder(text)) return false;
  const m = /^(\d{1,2}):(\d{2})\s+(\S[\s\S]*)$/.exec(text);
  if (!m) return false;
  if (Number(m[1]) > 23 || Number(m[2]) > 59) return false;
  const rest = m[3];
  if (!/:/.test(rest)) return false; // "Home – Away : Pick"
  if (!/@\s*\d+(?:[.,]\d+)?\s*$/.test(rest)) return false; // "... @ 1.50"
  return true;
}

const LABEL_RE = /^(single|vip match)\s*:?$/i;

export function parseTips(html) {
  // Walk every <p> in document order and pair a label with the line below it.
  const paras = [];
  const re = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html))) {
    paras.push({ attrs: m[1] || '', inner: m[2] || '' });
  }

  const tips = [];
  for (let i = 0; i < paras.length - 1; i++) {
    const label = textOf(paras[i].inner);
    if (!LABEL_RE.test(label)) continue;

    const body = textOf(paras[i + 1].inner);
    if (!body || LABEL_RE.test(body)) continue;

    const color = colorOf(paras[i + 1].attrs, paras[i + 1].inner);
    const kind = looksLikeTip(body) ? 'tip' : isPlaceholder(body) ? 'placeholder' : 'unknown';

    tips.push({
      label: /vip/i.test(label) ? 'VIP MATCH' : 'Single',
      text: body,
      color,
      status: classify(color),
      kind,
      key: (label.toLowerCase().startsWith('vip') ? 'vip' : 'single') + '|' + body.toLowerCase(),
    });
    i++; // consumed the body paragraph
  }
  return tips;
}
