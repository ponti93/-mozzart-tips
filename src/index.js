import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPage, SITE } from './fetchPage.js';
import { parseTips } from './parse.js';
import { sendMessage, pollCommands, esc } from './telegram.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_FILE = path.join(ROOT, 'state.json');
const MAX_STATE_ENTRIES = 400;

const dryRun = process.argv.includes('--dry-run');
const parseOnly = process.argv.includes('--parse-only');
const testSend = process.argv.includes('--test-send');
const force = process.argv.includes('--force');

const token = process.env.TELEGRAM_BOT_TOKEN || '';
const chatId = process.env.TELEGRAM_CHAT_ID || '';
const adminId = process.env.TELEGRAM_ADMIN_ID || '';

const now = new Date().toISOString();

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { tips: {}, tgOffset: 0, updatedAt: null };
  }
}

function saveState(state) {
  const keys = Object.keys(state.tips);
  if (keys.length > MAX_STATE_ENTRIES) {
    keys
      .sort((a, b) => String(state.tips[a].seenAt).localeCompare(String(state.tips[b].seenAt)))
      .slice(0, keys.length - MAX_STATE_ENTRIES)
      .forEach((k) => delete state.tips[k]);
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

function tipMessage(tip, header) {
  return `${header}\n${esc(tip.text)}\n\n${SITE}`;
}

async function deliver(text, label) {
  if (dryRun) {
    console.log(`\n=== WOULD SEND (${label}) ===\n${text.replace(/<\/?b>/g, '')}\n`);
    return;
  }
  await sendMessage(text, { token, chatId });
  console.log(`[telegram] sent ${label}`);
}

async function main() {
  if (testSend) {
    await deliver('✅ <b>Tip watcher connected</b>\nNew tips from mozzart1x2.com will appear here.', 'test');
    return;
  }

  const page = await fetchPage();
  if (!page) {
    console.error('[fatal] could not load the page (direct + jina both failed)');
    process.exit(1);
  }
  console.log(`[fetch] ok via ${page.via}, ${page.html.length} bytes`);

  const tips = parseTips(page.html);
  const singles = tips.filter((t) => t.label === 'Single');
  const notTips = singles.filter((t) => t.kind !== 'tip');
  const parsed = singles.filter((t) => t.kind === 'tip');

  console.log(
    `[parse] ${tips.length} tip blocks (${singles.length} Single), ${parsed.length} real tips, ${notTips.length} placeholders/notes`
  );
  for (const t of parsed.slice(0, 6)) {
    console.log(`   ${t.status.padEnd(8)} ${t.text}`);
  }
  for (const t of notTips.slice(0, 3)) {
    console.log(`   ${'SKIP'.padEnd(8)} [${t.kind}] ${t.text.slice(0, 80)}`);
  }

  if (parseOnly) {
    console.log('\n--- pending ---');
    parsed.filter((t) => t.status === 'pending').forEach((t) => console.log(`  ${t.text}`));
    return;
  }

  const state = loadState();
  const toSend = [];
  const results = [];
  let dirty = false;

  for (const tip of parsed) {
    const prev = state.tips[tip.key];

    if (!prev) {
      state.tips[tip.key] = { label: tip.label, status: tip.status, seenAt: now };
      dirty = true;
      if (tip.status === 'pending') toSend.push(tip);
      continue;
    }

    if (prev.status !== tip.status) {
      prev.status = tip.status;
      prev.seenAt = now;
      dirty = true;
      if (tip.status === 'won' || tip.status === 'lost') results.push(tip);
      if (tip.status === 'pending') toSend.push(tip); // reposted tip
    }
  }

  // --force: re-announce whatever is pending right now, even if already sent
  if (force) {
    for (const tip of parsed) {
      if (tip.status === 'pending' && !toSend.some((t) => t.key === tip.key)) {
        console.log(`[force] re-sending: ${tip.text}`);
        toSend.push(tip);
      }
    }
  }

  // safety: never flood the channel after downtime
  const overflow = toSend.splice(3);
  if (overflow.length) console.log(`[skip] ${overflow.length} older pending tips ignored`);

  for (const tip of results) {
    await deliver(tipMessage(tip, tip.status === 'won' ? '✅ <b>WON</b>' : '❌ <b>LOST</b>'), 'result');
  }

  for (const tip of toSend) {
    await deliver(tipMessage(tip, '🆕 <b>NEW TIP</b>'), 'new tip');
  }

  // optional manual sender
  if (token && adminId && !dryRun) {
    const { offset, jobs } = await pollCommands({ token, adminId, offset: state.tgOffset || 0 });
    if (offset !== state.tgOffset) {
      state.tgOffset = offset;
      dirty = true;
    }
    for (const text of jobs) {
      await sendMessage(text, { token, chatId });
      console.log('[telegram] forwarded manual tip');
    }
  }

  if (dirty) {
    state.updatedAt = now;
    saveState(state);
    console.log('[state] saved');
  } else {
    console.log('[state] no change');
  }

  console.log(`[done] ${toSend.length} new, ${results.length} results`);
}

main().catch((e) => {
  console.error('[error]', e.message);
  process.exit(1);
});
