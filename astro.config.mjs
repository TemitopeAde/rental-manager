// @ts-check
import { defineConfig, envField } from 'astro/config';
import wix from '@wix/astro';
import react from "@astrojs/react";
import wixHostingAdapter from "@wix/astro-wix-hosting-adapter";
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  output: "server",
  adapter: wixHostingAdapter(),
  integrations: [wix(), react()],
  env: {
    schema: {
      LIFECYCLE_SHEETS_WEBHOOK_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      LIFECYCLE_SHEETS_WEBHOOK_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      // "DEVELOPMENT" unlocks every plan feature for testing; anything else (or unset) is production.
      WIX_ENVIRONMENT: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  image: { domains: ["static.wixstatic.com"] },
  security: { checkOrigin: false },
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      cors: true
    }
  },
});
