import { orders } from '@wix/ecom';
import { confirmPaid, recordOrderDeposit } from '../../../../rental/actions';
import { emailOrderReceived } from '../../../../rental/emails';
import type { Booking } from '../../../../rental/models';
import { orderDepositOnOrder, type OrderFee } from '../../../../rental/deposit-rules';
import { text } from '../../../../rental/models';

interface LineItem {
  _id?: string;
  catalogReference?: { options?: Record<string, unknown> | null };
}

interface OrderShape {
  _id?: string;
  number?: string;
  buyerInfo?: { email?: string; memberId?: string };
  billingInfo?: { contactDetails?: { firstName?: string; lastName?: string; phone?: string } };
  lineItems?: LineItem[];
  additionalFees?: OrderFee[];
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
  const confirmed: Array<{ lineItemId: string; bookingId: string }> = [];
  const bookings: Booking[] = [];
  for (const line of order.lineItems) {
    const bookingId = line.catalogReference?.options?.bookingId;
    if (typeof bookingId !== 'string' || !bookingId) continue;
    try {
      const result = await confirmPaid(bookingId, order._id, text(line._id), renter, text(order.buyerInfo?.memberId));
      if (result.ok) {
        confirmed.push({ lineItemId: text(line._id), bookingId });
        bookings.push(result.booking);
      }
    } catch (error) {
      console.error(`Could not confirm booking ${bookingId} from order ${order._id}.`, error);
    }
  }
  // A per-order deposit is one checkout fee; record the amount charged on the first confirmed booking it covers.
  const deposit = orderDepositOnOrder(order.additionalFees, confirmed);
  if (deposit) {
    try {
      const recorded = await recordOrderDeposit(deposit.bookingId, order._id, deposit.amount);
      if (recorded.ok) {
        const index = bookings.findIndex((booking) => booking._id === deposit.bookingId);
        if (index >= 0) bookings[index] = recorded.booking;
      }
    } catch (error) {
      console.error(`Could not record the order deposit for order ${order._id}.`, error);
    }
  }
  // One email to the owner for the whole order. Wix redelivers events, so the send is keyed on the order ID
  // and a repeat delivery doesn't email twice.
  await emailOrderReceived(order._id, text(order.number), bookings);
});
