import { orders } from '@wix/ecom';
import { confirmPaid } from '../../../../rental/actions';
import { text } from '../../../../rental/models';

interface LineItem {
  _id?: string;
  catalogReference?: { options?: Record<string, unknown> | null };
}

interface OrderShape {
  _id?: string;
  buyerInfo?: { email?: string; memberId?: string };
  billingInfo?: { contactDetails?: { firstName?: string; lastName?: string; phone?: string } };
  lineItems?: LineItem[];
}

function readOrder(event: unknown): OrderShape | undefined {
  if (!event || typeof event !== 'object') return undefined;
  const record = event as Record<string, unknown>;
  const data = record.data;
  if (data && typeof data === 'object' && 'order' in data) return (data as { order?: OrderShape }).order;
  if (record.entity && typeof record.entity === 'object') return record.entity as OrderShape;
  if (record.order && typeof record.order === 'object') return record.order as OrderShape;
  return undefined;
}

export default orders.onOrderApproved(async (event) => {
  const order = readOrder(event);
  if (!order?._id || !order.lineItems) return;
  const contact = order.billingInfo?.contactDetails;
  const renter = {
    name: [contact?.firstName, contact?.lastName].filter(Boolean).join(' '),
    email: text(order.buyerInfo?.email),
    phone: text(contact?.phone),
  };
  for (const line of order.lineItems) {
    const bookingId = line.catalogReference?.options?.bookingId;
    if (typeof bookingId !== 'string' || !bookingId) continue;
    try {
      await confirmPaid(bookingId, order._id, text(line._id), renter, text(order.buyerInfo?.memberId));
    } catch (error) {
      console.error('Failed to confirm rental booking', bookingId, error);
    }
  }
});
