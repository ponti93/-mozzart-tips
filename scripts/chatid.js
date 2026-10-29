// Helper: find the numeric id of your Telegram channel.
//
//   1. PowerShell:  $env:TELEGRAM_BOT_TOKEN="123:ABC"
//   2. Make sure the bot is an ADMIN of the channel.
//   3. Either post a message in the channel, or forward a channel post to the bot
//      in a private chat with it.
//   4. Run:  node scripts/chatid.js
//
// It prints every chat the bot has seen, e.g.
//   -1001234567890   channel   My Tips Channel

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN first:  $env:TELEGRAM_BOT_TOKEN="123:ABC"');
  process.exit(1);
}

const api = (m, q = '') => fetch(`https://api.telegram.org/bot${token}/${m}${q}`).then((r) => r.json());

const me = await api('getMe');
if (!me.ok) {
  console.error('Token rejected by Telegram:', me.description || JSON.stringify(me));
  process.exit(1);
}
console.log(`Bot: @${me.result.username}\n`);

const hook = await api('getWebhookInfo');
if (hook.ok && hook.result.url) {
  console.log(`⚠ a webhook is set (${hook.result.url}) — getUpdates will not work.`);
  console.log('  Delete it with:  curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"\n');
}

const data = await api('getUpdates', '?limit=100');
if (!data.ok) {
  console.error('getUpdates failed:', data.description);
  process.exit(1);
}

const found = new Map();
const add = (chat, how) => {
  if (chat && chat.id) found.set(chat.id, `${chat.id}   ${chat.type.padEnd(8)} ${chat.title || chat.username || ''}   (via ${how})`);
};

for (const u of data.result || []) {
  const m = u.message || u.channel_post || u.edited_message || u.edited_channel_post;
  if (m) {
    add(m.chat, u.channel_post || u.edited_channel_post ? 'channel post' : 'message');
    add(m.forward_origin?.chat, 'forwarded post');
    add(m.forward_from_chat, 'forwarded post');
    add(m.reply_to_message?.forward_origin?.chat, 'forwarded post');
  }
  const member = u.my_chat_member || u.chat_member;
  if (member) add(member.chat, 'membership');
}

console.log(`updates received: ${(data.result || []).length}\n`);

if (!found.size) {
  console.log('No chats found yet. Telegram only sends a bot what happens AFTER it was added.');
  console.log('');
  console.log('Try, in this order:');
  console.log('  1. Open the channel → Administrators → make sure the bot is there as admin.');
  console.log('  2. Post a new message in the channel (as yourself), then run this again.');
  console.log('  3. Or forward any message from the channel to the bot in a private chat, then run this again.');
  console.log('  4. Or skip all of this: long-press a message in the channel → Copy Link.');
  console.log('     The link looks like https://t.me/c/1234567890/45');
  console.log('     Your chat id is -1001234567890  (add -100 to the number after /c/).');
  process.exit(0);
}

for (const line of found.values()) console.log(line);
console.log('\nUse the -100... id as TELEGRAM_CHAT_ID.');
