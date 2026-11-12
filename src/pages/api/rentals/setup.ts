import type { APIRoute } from 'astro';
import { merchantOnly } from '../../../rental/guard';
import { json, readJson, str } from '../../../rental/http';
import { markSetupStep, setSetupHidden, setupStatus } from '../../../rental/setup';
import { isSetupStep } from '../../../rental/setup-rules';

export const GET: APIRoute = async () => {
  const denied = await merchantOnly();
  if (denied) return denied;
  return json(await setupStatus());
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const body = await readJson(request);
  const action = str(body.action);
  if (action === 'done' || action === 'undo') {
    const step = str(body.step);
    if (!isSetupStep(step)) return json({ ok: false, message: 'Unknown setup step.' }, 400);
    return json(await markSetupStep(step, action === 'done'));
  }
  if (action === 'hide' || action === 'show') return json(await setSetupHidden(action === 'hide'));
  return json({ ok: false, message: 'Unknown action.' }, 400);
};
