// Bundles once, then renders each requested time (in seconds) as a PNG.
//   node scripts/stills.mjs <out dir> <seconds>...
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const [dir, ...times] = process.argv.slice(2);
const root = resolve(import.meta.dirname, "..");
mkdirSync(resolve(dir), { recursive: true });
const serveUrl = await bundle({ entryPoint: join(root, "src/index.ts"), publicDir: join(root, "public") });
const composition = await selectComposition({ serveUrl, id: "Promo" });
for (const s of times) {
  const frame = Math.round(Number(s) * composition.fps);
  const output = join(resolve(dir), `t${s}.png`);
  await renderStill({ serveUrl, composition, frame, output, overwrite: true, scale: 0.5 });
  console.log(output);
}
