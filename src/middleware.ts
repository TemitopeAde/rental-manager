import { defineMiddleware } from 'astro:middleware';
import { getSecret } from 'astro:env/server';
import { publishLifecycleSheetsEnv } from './backend/lifecycle-env-bridge';

export const onRequest = defineMiddleware((context, next) => {
  if (context.url.pathname.startsWith('/_wix/extensions/webhooks/')) {
    publishLifecycleSheetsEnv({
      LIFECYCLE_SHEETS_WEBHOOK_URL: getSecret('LIFECYCLE_SHEETS_WEBHOOK_URL'),
      LIFECYCLE_SHEETS_WEBHOOK_SECRET: getSecret('LIFECYCLE_SHEETS_WEBHOOK_SECRET'),
    });
  }
  return next();
});
