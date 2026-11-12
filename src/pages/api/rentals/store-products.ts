import type { APIRoute } from 'astro';
import { merchantOnly } from '../../../rental/guard';
import { getStoreProductOption, searchStoreProducts } from '../../../rental/stores';
import { linkedStoreProductIds } from '../../../rental/merchant';
import { json, str } from '../../../rental/http';

// ?search=<text> lists matching products; ?productId=<id> resolves the one already linked.
export const GET: APIRoute = async ({ request }) => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const productId = str(params.get('productId'));
  if (productId) return json({ product: await getStoreProductOption(productId) });
  const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 20));
  const page = await searchStoreProducts(str(params.get('search')), limit, str(params.get('cursor')));
  // `?linked=1` marks products that already have a rental item, so pickers can grey them out.
  if (params.get('linked') !== '1' || !page.products.length) return json(page);
  const linked = await linkedStoreProductIds(page.products.map((product) => product.id));
  return json({ ...page, products: page.products.map((product) => ({ ...product, linked: linked.has(product.id) })) });
};
