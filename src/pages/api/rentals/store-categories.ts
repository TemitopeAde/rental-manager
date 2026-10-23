import type { APIRoute } from 'astro';
import { merchantOnly } from '../../../rental/guard';
import { storeCategories } from '../../../rental/merchant';
import { json } from '../../../rental/http';

export const GET: APIRoute = async () => {
  const denied = await merchantOnly();
  if (denied) return denied;
  return json(await storeCategories());
};
