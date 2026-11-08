import { appInstances } from '@wix/app-management';
import { emailTransmissions } from '@wix/email-transmissions';
import { auth } from '@wix/essentials';
import { loadItem, loadSettings } from './availability';
import type { Booking } from './models';

const merchant = { elevate: true };

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

function formatDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function dateRange(start: string, end: string): string {
  return `${formatDay(start)} – ${formatDay(end)}`;
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

// Wraps a few paragraphs and a details table in a plain, client-safe HTML email.
function layout(heading: string, paragraphs: string[], rows: Array<[string, string]>): string {
  const body = paragraphs.map((text) => `<p style="margin:0 0 14px">${text}</p>`).join('');
  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#6b6b6b">${escape(label)}</td><td style="padding:6px 0;font-weight:600">${escape(value)}</td></tr>`,
    )
    .join('');
  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:560px">
<h2 style="font-size:20px;margin:0 0 16px">${escape(heading)}</h2>${body}
<table style="border-collapse:collapse;margin:8px 0 0">${table}</table></div>`;
}

async function ownerEmail(): Promise<string> {
  try {
    const response = await auth.elevate(appInstances.getAppInstance)();
    return response.site?.ownerInfo?.email ?? '';
  } catch (error) {
    return '';
  }
}

// Sends one transactional email. Failures are logged, never thrown: an email
// problem must not undo or block the booking change that triggered it.
async function send(to: { email: string; name?: string }, subject: string, html: string, key: string) {
  if (!to.email) return;
  try {
    const settings = await loadSettings(merchant);
    await auth.elevate(emailTransmissions.sendEmailTransmission)(
      {
        type: 'TRANSACTIONAL',
        emailSubject: subject,
        emailHtmlContent: html,
        senderName: settings.emailSenderName,
        toRecipients: [{ emailAddress: to.email, name: to.name || undefined }],
      },
      { idempotencyKey: key },
    );
  } catch (error) {
  }
}

async function details(booking: Booking) {
  const [item, settings] = await Promise.all([loadItem(booking.itemId, merchant), loadSettings(merchant)]);
  return { itemName: item?.name ?? 'Rental', currency: settings.currency, shop: settings.emailSenderName };
}

function summary(booking: Booking, itemName: string, currency: string): Array<[string, string]> {
  return [
    ['Booking', booking.reference],
    ['Item', booking.quantity > 1 ? `${itemName} × ${booking.quantity}` : itemName],
    ['Dates', dateRange(booking.startDate, booking.endDate)],
    ['Total', money(booking.quote.total, currency)],
  ];
}

// A paid order has become a rental booking: let the site owner know, including
// whether the booking is ready or waiting for manual approval.
export async function emailPaidBookingReceived(booking: Booking, orderId: string) {
  try {
    if (!(await loadSettings(merchant)).emailOwnerNewBookings) return;
    const { itemName, currency } = await details(booking);
    const rows = summary(booking, itemName, currency);
    if (booking.renter.email) rows.push(['Renter email', booking.renter.email]);
    if (booking.renter.phone) rows.push(['Renter phone', booking.renter.phone]);
    rows.push(['Order', orderId]);
    const needsApproval = booking.status === 'pending';
    const owner = await ownerEmail();
    await send(
      { email: owner },
      `New paid booking ${booking.reference}`,
      layout(
        needsApproval ? 'A new booking needs approval' : 'A new booking is confirmed',
        [
          `${escape(booking.renter.name || booking.renter.email || 'A renter')} paid for this rental.`,
          needsApproval
            ? 'Open Rentals → Bookings in your site dashboard to approve or decline.'
            : 'The booking is confirmed. Open Rentals → Bookings in your site dashboard to view it.',
        ],
        rows,
      ),
      `${booking._id}:${orderId}:owner-paid-booking`,
    );
  } catch (error) {
    // Email problems must not undo or block a paid booking.
  }
}

export async function emailRefundNeeded(booking: Booking, orderId: string) {
  try {
    if (!(await loadSettings(merchant)).emailOwnerRefundAlerts) return;
    const { itemName, currency } = await details(booking);
    const owner = await ownerEmail();
    await send(
      { email: owner },
      `Refund needed for ${booking.reference}`,
      layout(
        'A paid order could not be matched to available rental dates',
        ['The booking hold expired before payment was confirmed. Review the Wix order and refund it if the rental cannot be honored.'],
        [...summary(booking, itemName, currency), ['Order', orderId]],
      ),
      `${booking._id}:${orderId}:owner-refund-needed`,
    );
  } catch (error) {
    // Email problems must not block the paid order handling.
  }
}

export async function emailBookingUpdate(
  after: Booking,
  action: 'approve' | 'decline' | 'cancel' | 'pickup' | 'returned' | 'manual',
  reason = '',
) {
  try {
    if (!(await loadSettings(merchant)).emailRentersBookingUpdates) return;
    const { itemName, currency } = await details(after);
    const messages: Record<typeof action, { subject: string; heading: string; message: string }> = {
      approve: { subject: `Your rental ${after.reference} is confirmed`, heading: 'Booking confirmed', message: 'The shop approved your rental.' },
      decline: { subject: `Update on your rental ${after.reference}`, heading: 'Booking not approved', message: 'The shop could not approve your rental. Contact the shop if you have questions about your payment.' },
      cancel: { subject: `Your rental ${after.reference} was cancelled`, heading: 'Booking cancelled', message: 'The shop cancelled your rental.' },
      pickup: { subject: `Pickup recorded for ${after.reference}`, heading: 'Rental picked up', message: 'The shop recorded that you picked up this rental.' },
      returned: { subject: `Return recorded for ${after.reference}`, heading: 'Rental returned', message: 'The shop recorded that you returned this rental.' },
      manual: { subject: `Your rental ${after.reference} is booked`, heading: 'Rental booked', message: 'The shop created this rental booking for you.' },
    };
    const email = messages[action];
    const paragraphs = [`Hi ${escape(after.renter.name || 'there')},`, email.message];
    if (reason) paragraphs.push(escape(reason));
    if (action === 'cancel' && after.ecomOrderId) {
      paragraphs.push('The shop will handle any refund through the original Wix order.');
    }
    await send(
      { email: after.renter.email, name: after.renter.name },
      email.subject,
      layout(email.heading, paragraphs, summary(after, itemName, currency)),
      `${after._id}:renter-booking-update:${action}`,
    );
  } catch (error) {
    // Email problems must not undo or block the booking change.
  }
}

export async function emailDepositSettled(booking: Booking) {
  try {
    if (!(await loadSettings(merchant)).emailRentersDepositUpdates) return;
    const outcome = booking.depositOutcome;
    if (!outcome) return;
    const { itemName, currency } = await details(booking);
    const kept = money(outcome.amountKept, currency);
    const paragraphs = [
      `Hi ${escape(booking.renter.name || 'there')},`,
      outcome.outcome === 'kept'
        ? `The shop kept ${kept} from your deposit. The remaining deposit is to be refunded through the original Wix order.`
        : 'The shop released your deposit. The refund will be handled through the original Wix order.',
    ];
    if (outcome.note) paragraphs.push(escape(outcome.note));
    await send(
      { email: booking.renter.email, name: booking.renter.name },
      `Deposit settled for ${booking.reference}`,
      layout('Deposit settled', paragraphs, [...summary(booking, itemName, currency), ['Amount kept', kept]]),
      `${booking._id}:deposit-settled`,
    );
  } catch (error) {
    // Email problems must not undo or block the deposit record.
  }
}

// A renter just asked to move or cancel: tell the owner it needs a decision, and confirm receipt to the renter.
export async function emailRequestReceived(booking: Booking) {
  const request = booking.changeRequest;
  if (!request) return;
  try {
  const { itemName, currency } = await details(booking);
  const rows = summary(booking, itemName, currency);
  const isCancel = request.type === 'cancel';
  if (!isCancel) {
    rows.push(['New dates', dateRange(request.startDate, request.endDate)], ['New total', money(request.quote.total, currency)]);
  }
  const renter = booking.renter.name || booking.renter.email || 'A renter';
  const key = `${booking._id}:${request.requestedAt}`;
    const settings = await loadSettings(merchant);
    if (settings.emailOwnerRenterRequests) {
      const owner = await ownerEmail();
      await send(
        { email: owner },
        isCancel ? `Cancellation request for ${booking.reference}` : `Date change request for ${booking.reference}`,
        layout(
          isCancel ? 'A renter wants to cancel' : 'A renter wants new dates',
          [
            `${escape(renter)} asked to ${isCancel ? 'cancel this rental' : 'move this rental'}.`,
            'Open Rentals → Bookings in your site dashboard to approve or decline.',
          ],
          rows,
        ),
        `${key}:owner`,
      );
    }
    if (settings.emailRentersRequestUpdates) {
      await send(
        { email: booking.renter.email, name: booking.renter.name },
        isCancel ? `We received your cancellation request (${booking.reference})` : `We received your date change request (${booking.reference})`,
        layout(
          'Request received',
          [
            `Hi ${escape(booking.renter.name || 'there')},`,
            `Thanks, we got your request to ${isCancel ? 'cancel' : 'change the dates of'} this rental. Nothing changes until the shop confirms, and we'll email you as soon as it does.`,
          ],
          rows,
        ),
        `${key}:renter-received`,
      );
    }
  } catch (error) {
    // Email problems must not undo or block a renter request.
  }
}

// The owner approved or declined a request: let the renter know the outcome.
export async function emailRequestResolved(before: Booking, after: Booking, approved: boolean, note = '') {
  const request = before.changeRequest;
  if (!request) return;
  try {
    if (!(await loadSettings(merchant)).emailRentersRequestUpdates) return;
    const { itemName, currency } = await details(after);
    const isCancel = request.type === 'cancel';
    const subject = approved
      ? isCancel
        ? `Your rental ${before.reference} is cancelled`
        : `Your new dates for ${before.reference} are confirmed`
      : isCancel
        ? `Your cancellation request for ${before.reference}`
        : `Your date change request for ${before.reference}`;
    const message = approved
      ? isCancel
        ? 'The shop approved your cancellation. Any refund is sent to your original payment method.'
        : `The shop approved your new dates: ${escape(dateRange(request.startDate, request.endDate))}.`
      : isCancel
        ? 'The shop couldn’t approve your cancellation, so your rental stays booked as before.'
        : `The shop couldn’t move your rental to ${escape(dateRange(request.startDate, request.endDate))}, so your original dates still stand.`;
    const paragraphs = [`Hi ${escape(after.renter.name || 'there')},`, message];
    if (approved && note) paragraphs.push(escape(note));
    paragraphs.push('Reply to this email if you have any questions.');
    await send(
      { email: after.renter.email, name: after.renter.name },
      subject,
      layout(approved ? 'Request approved' : 'Request declined', paragraphs, summary(after, itemName, currency)),
      `${before._id}:${request.requestedAt}:${approved ? 'approved' : 'declined'}`,
    );
  } catch (error) {
    // Email problems must not undo or block the booking change.
  }
}
