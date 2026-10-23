import { orders } from '@wix/ecom';
import { findBooking, transition } from '../../../../rental/actions';
import { text } from '../../../../rental/models';

export default orders.onOrderCanceled(async (event) => {
  const record = event as unknown as Record<string, unknown>;
  const data = record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : undefined;
  const order = (data?.order ?? record.entity ?? record.order) as { _id?: string; lineItems?: Array<{ catalogReference?: { options?: Record<string, unknown> } }> } | undefined;
  if (!order?.lineItems) return;
  for (const line of order.lineItems) {
    const bookingId = line.catalogReference?.options?.bookingId;
    if (typeof bookingId !== 'string') continue;
    const booking = await findBooking(bookingId);
    if (!booking || booking.ecomOrderId !== text(order._id)) continue;
    if (booking.status === 'returned' || booking.status === 'cancelled') continue;
    await transition(booking._id, 'cancel', 'order', 'Wix order cancelled');
  }
});
