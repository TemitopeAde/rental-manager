import { catalog } from '@wix/ecom/service-plugins';
import { APP_ID } from './constants';
import { loadItem } from './availability';
import { catalogAvailable } from './holds';
import type { Booking } from './models';

export async function toCatalogItem(reference: {
  catalogReference?: { catalogItemId?: string; appId?: string; options?: Record<string, unknown> | null };
}, booking: Booking) {
  const item = await loadItem(booking.itemId, { elevate: true });
  if (!item || !catalogAvailable(booking)) return undefined;
  const perUnit = booking.quantity > 0 ? (booking.quote.total / booking.quantity).toFixed(2) : booking.quote.total.toFixed(2);
  return {
    catalogReference: reference.catalogReference,
    data: {
      productName: { original: item.name },
      itemType: { preset: catalog.ItemTypePreset.SERVICE },
      price: perUnit,
      fullPrice: perUnit,
      fixedQuantity: true,
      quantityAvailable: booking.quantity,
      descriptionLines: [
        { name: { original: 'Dates' }, plainText: { original: `${booking.startDate} to ${booking.endDate}` } },
        { name: { original: 'Days' }, plainText: { original: String(booking.quote.days) } },
        { name: { original: 'Deposit' }, plainText: { original: booking.quote.deposit.toFixed(2) } },
      ],
    },
  };
}

export function appOwns(reference: { catalogReference?: { appId?: string } | null }) {
  return reference.catalogReference?.appId === APP_ID;
}
