import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '../../.env') });
loadEnv();

function parseOrigins(raw?: string) {
  const values = (raw ?? 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return values.length ? values : ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

export const appConfig = {
  port: Number(process.env.API_PORT ?? 4000),
  webOrigins: parseOrigins(process.env.WEB_ORIGIN),
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-32chars',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me-32chars',
  accessTtlSec: 60 * 15,
  refreshTtlSec: 60 * 60 * 24 * 14,
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  aiModel: process.env.AI_MODEL ?? 'gpt-4o-mini',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
  whatsappToken: process.env.WHATSAPP_TOKEN ?? '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  smsApiUrl: process.env.SMS_API_URL ?? '',
  smsApiToken: process.env.SMS_API_TOKEN ?? '',
};
