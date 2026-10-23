import type { APIRoute } from 'astro';
import { merchantOnly } from '../../../rental/guard';
import { json } from '../../../rental/http';
import { todayBoard } from '../../../rental/merchant';

export const GET: APIRoute = async () => {
  const denied = await merchantOnly();
  if (denied) return denied;
  return json(await todayBoard());
};
