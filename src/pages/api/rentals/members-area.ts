import type { APIRoute } from 'astro';
import { merchantOnly } from '../../../rental/guard';
import { json } from '../../../rental/http';
import { checkMembersArea, installMembersArea } from '../../../rental/members-area';

export const GET: APIRoute = async () => {
  const denied = await merchantOnly();
  if (denied) return denied;
  try {
    return json({ installed: await checkMembersArea() });
  } catch (error) {
    console.error('Members Area check failed', error);
    return json({ ok: false, message: 'Could not check for Wix Members Area.' }, 500);
  }
};

export const POST: APIRoute = async () => {
  const denied = await merchantOnly();
  if (denied) return denied;
  try {
    const result = await installMembersArea();
    return json(result, result.ok ? 200 : 400);
  } catch (error) {
    console.error('Members Area install failed', error);
    return json({ ok: false, message: 'Could not install Wix Members Area. Add it from the Wix App Market instead.' }, 500);
  }
};
