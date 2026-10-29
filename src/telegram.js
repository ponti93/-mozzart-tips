// Minimal Telegram Bot API helpers (no dependencies).

const API = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendMessage(text, { token, chatId, silent = false } = {}) {
  if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing');
  const res = await fetch(API(token, 'sendMessage'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      disable_notification: silent,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`sendMessage failed: ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  return data.result;
}

// Optional manual sender: lets you type "/send <text>" to the bot and have it
// posted to the channel. Only messages from TELEGRAM_ADMIN_ID are accepted.
export async function pollCommands({ token, adminId, offset = 0 } = {}) {
  const jobs = [];
  if (!token) return { offset, jobs };
  try {
    const res = await fetch(API(token, 'getUpdates') + `?timeout=0&allowed_updates=message&offset=${offset}`, {
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.result)) return { offset, jobs };

    for (const u of data.result) {
      offset = u.update_id + 1;
      const msg = u.message;
      if (!msg || !msg.text) continue;
      if (adminId && String(msg.from?.id) !== String(adminId)) continue;
      const m = /^\/send(?:@\w+)?\s+([\s\S]+)$/i.exec(msg.text.trim());
      if (m) jobs.push(m[1].trim());
    }
  } catch (e) {
    console.log('[telegram] getUpdates error:', e.message);
  }
  return { offset, jobs };
}
