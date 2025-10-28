// scripts/setWebhook.ts
import 'dotenv/config';
import https from 'https';

const token = process.env.TELEGRAM_BOT_TOKEN!;
const publicUrl = process.env.PUBLIC_URL!;      // должен заканчиваться на /webhook
const secret = process.env.WEBHOOK_SECRET || 'dev_secret_123';

if (!token || !publicUrl) {
  console.error('❌ TELEGRAM_BOT_TOKEN или PUBLIC_URL не заданы в .env');
  process.exit(1);
}

const payload = JSON.stringify({
  url: publicUrl,
  secret_token: secret,
  allowed_updates: ['message', 'callback_query']
});

const req = https.request(
  `https://api.telegram.org/bot${token}/setWebhook`,
  { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
  res => {
    let data = '';
    res.on('data', c => (data += c));
    res.on('end', () => console.log('➡️ setWebhook response:', data));
  }
);

req.on('error', e => console.error('❌ setWebhook error:', e));
req.write(payload);
req.end();
