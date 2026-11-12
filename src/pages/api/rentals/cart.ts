import type { APIRoute } from 'astro';
import { currentCartV2 } from '@wix/ecom';
import { APP_ID } from '../../../rental/constants';
import { extendHold, holdRental } from '../../../rental/holds';
import { json, readJson } from '../../../rental/http';
import { kickReturnSweep } from '../../../rental/returns';
import { holdSchema } from '../../../rental/schemas';
import { runInBackground } from '../../../backend/run-in-background';

/**
 * Books a rental into the renter's cart in one request: holds the units, adds the line item to the
 * visitor's current cart (POST /_api/cart-v2/v2/carts/current/add-line-items), then extends the
 * hold so it outlasts checkout.
 *
 * The cart call is deliberately NOT elevated: the widget calls this route with the visitor's own
 * auth (httpClient.fetchWithAuth), so "current cart" resolves to that visitor's cart.
 *
 * Responds 200 with `ok: false` and a `stage` when booking fails, so the widget can tell
 * "dates just taken" (stage 'hold': refresh the calendar) from a cart problem (stage 'cart').
 */
export const POST: APIRoute = async ({ request }) => {
  const parsed = holdSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ ok: false, stage: 'input', message: parsed.error.issues[0]?.message ?? 'Invalid booking.' }, 400);
  kickReturnSweep();

  const held = await holdRental(parsed.data);
  if (!held.ok || !held.booking) {
    return json({ ok: false, stage: 'hold', message: held.ok ? 'Those dates are no longer available.' : held.message });
  }
  const booking = held.booking;

  try {
    await currentCartV2.addLineItemsToCurrentCart({
      catalogItems: [
        {
          catalogReference: {
            catalogItemId: booking.itemId,
            appId: APP_ID,
            options: { bookingId: booking._id },
          },
          quantity: booking.quantity,
        },
      ],
    });
  } catch (error) {
    // The hold stays until it expires; retrying with the same idempotency key reuses it.
    console.error('[RentalManager cart] Could not add the rental to the cart.', error instanceof Error ? error.message : error);
    return json({
      ok: false,
      stage: 'cart',
      message: error instanceof Error ? error.message : 'Could not add the rental to your cart.',
    });
  }

  // The renter doesn't need to wait for this; the 15-minute hold covers the gap.
  runInBackground('extend hold', () => extendHold(booking._id));

  return json({
    ok: true,
    booking: { _id: booking._id, itemId: booking.itemId, quantity: booking.quantity, reference: booking.reference },
  });
};
