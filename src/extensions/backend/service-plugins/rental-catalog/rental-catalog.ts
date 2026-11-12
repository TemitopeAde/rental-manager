import { catalog } from '@wix/ecom/service-plugins';
import { findBooking } from '../../../../rental/actions';
import { appOwns, toCatalogItem } from '../../../../rental/catalog-item';
export default catalog.provideHandlers({
  getCatalogItems: async ({ request }) => {
    const catalogItems = [];
    const references = request.catalogReferences ?? [];
    for (const reference of references) {
      if (!appOwns(reference)) continue;
      const bookingId = reference.catalogReference?.options?.bookingId;
      if (typeof bookingId !== 'string') continue;
      // A throw here surfaces as a bare 500 from the cart, so log the cause and skip the line instead.
      try {
        const booking = await findBooking(bookingId);
        if (!booking) {
          console.warn('[rental-catalog] booking not found', JSON.stringify({ bookingId }));
          continue;
        }
        const item = await toCatalogItem(reference, booking);
        if (item) catalogItems.push(item);
        else console.warn('[rental-catalog] booking not sellable (item missing or hold expired)', JSON.stringify({
          bookingId, itemId: booking.itemId, status: booking.status, holdExpiresAt: booking.holdExpiresAt,
        }));
      } catch (error) {
        console.error('[rental-catalog] failed to build catalog item', JSON.stringify({ bookingId }), error);
      }
    }
    return { catalogItems };
  },
});
