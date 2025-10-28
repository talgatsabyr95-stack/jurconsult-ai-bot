// app/src/core/config.ts
import 'dotenv/config';

export const cfg = {
  tgToken: process.env.TELEGRAM_BOT_TOKEN || '',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  publicUrl: process.env.PUBLIC_URL || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseSvcKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  defaultJurisdiction: process.env.DEFAULT_JURISDICTION || 'KZ',
  salesManagerChatId: process.env.SALES_MANAGER_CHAT_ID || '',
  paymentsProvider: process.env.PAYMENTS_PROVIDER || 'none',
};
if (!cfg.tgToken) console.warn('⚠️ TELEGRAM_BOT_TOKEN is empty');
