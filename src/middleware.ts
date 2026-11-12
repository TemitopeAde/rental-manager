import { defineMiddleware } from 'astro:middleware';
import { getSecret } from 'astro:env/server';
import { publishLifecycleSheetsEnv } from './backend/lifecycle-env-bridge';
import { publishEnvironment } from './backend/environment';

export const onRequest = defineMiddleware((context, next) => {
  // Every request, so dashboard routes, service plugins and events all see the same environment.
  publishEnvironment(getSecret('WIX_ENVIRONMENT'));
  if (context.url.pathname.startsWith('/_wix/extensions/webhooks/')) {
    publishLifecycleSheetsEnv({
      LIFECYCLE_SHEETS_WEBHOOK_URL: getSecret('LIFECYCLE_SHEETS_WEBHOOK_URL'),
      LIFECYCLE_SHEETS_WEBHOOK_SECRET: getSecret('LIFECYCLE_SHEETS_WEBHOOK_SECRET'),
    });
  }
  return next();
});
