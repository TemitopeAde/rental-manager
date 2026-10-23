import type { APIRoute } from 'astro';
import { merchantOnly } from '../../../rental/guard';
import { getStoreProductOption, searchStoreProducts } from '../../../rental/stores';
import { json, str } from '../../../rental/http';

// ?search=<text> lists matching products; ?productId=<id> resolves the one already linked.
export const GET: APIRoute = async ({ request }) => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const productId = str(params.get('productId'));
  if (productId) return json({ product: await getStoreProductOption(productId) });
  return json(await searchStoreProducts(str(params.get('search'))));
};
