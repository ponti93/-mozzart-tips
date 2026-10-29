// Helper: find the numeric id of your Telegram channel.
// 1. Put the bot token in the environment:
//      PowerShell:  $env:TELEGRAM_BOT_TOKEN="123:ABC"
// 2. Post any message in the channel (the bot must be an admin there).
// 3. Run:  node scripts/chatid.js
// It prints every chat the bot has seen, e.g.
//   -1001234567890   channel   My Tips Channel

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN first.');
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`);
const data = await res.json();
if (!data.ok) {
  console.error('Telegram error:', JSON.stringify(data));
  process.exit(1);
}

const seen = new Map();
for (const u of data.result || []) {
  const chat = u.message?.chat || u.channel_post?.chat || u.my_chat_member?.chat || u.edited_channel_post?.chat;
  if (chat) seen.set(chat.id, `${chat.id}   ${chat.type}   ${chat.title || chat.username || ''}`);
}

if (!seen.size) {
  console.log('No chats found yet.');
  console.log('Add the bot as an administrator of your channel, post a message in the channel, then run this again.');
} else {
  for (const line of seen.values()) console.log(line);
}
