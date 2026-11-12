import { appInstances } from '@wix/app-management';
import { emailTransmissions } from '@wix/email-transmissions';
import { auth } from '@wix/essentials';
import { loadItem, loadSettings } from './availability';
import { getCurrentAppInstance } from './app-instance';
import type { Booking, PaymentRequest } from './models';
import { orderAlertTitle, ownerAlertAddress } from './notify-rules';

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

// The owner's alert address: the one set in Settings → Email notifications, else their Wix login email.
// Wix returns the login email only when the app has the "Read Site Owner Email" permission.
async function ownerEmail(): Promise<string> {
  const settings = await loadSettings(merchant);
  let loginEmail = '';
  if (!settings.ownerNotificationEmail) {
    try {
      const response = await auth.elevate(appInstances.getAppInstance)();
      loginEmail = response.site?.ownerInfo?.email ?? '';
    } catch (error) {
      console.error('Could not read the site owner email.', error);
    }
  }
  const address = ownerAlertAddress(settings.ownerNotificationEmail, loginEmail);
  if (!address) {
    console.warn('No address for owner alerts: set one in Settings → Email notifications, or grant "Read Site Owner Email".');
  }
  return address;
}

// Sends one transactional email. Failures are logged, never thrown: an email
// problem must not undo or block the booking change that triggered it.
async function send(to: { email: string; name?: string }, subject: string, html: string, key: string) {
  if (!to.email) return;
  try {
    const settings = await loadSettings(merchant);
    const response = await auth.elevate(emailTransmissions.sendEmailTransmission)(
      {
        type: 'TRANSACTIONAL',
        emailSubject: subject,
        emailHtmlContent: html,
        senderName: settings.emailSenderName,
        toRecipients: [{ emailAddress: to.email, name: to.name || undefined }],
      },
      { idempotencyKey: key },
    );
    const transmission = (response as { emailTransmission?: { status?: string; rejectedOptions?: unknown } })?.emailTransmission;
    if (transmission?.status === 'REJECTED') {
      console.error(`Email "${subject}" was rejected.`, transmission.rejectedOptions);
    }
  } catch (error) {
    // Most often a missing "Manage Email Marketing" permission or a used-up email quota.
    console.error(`Could not send email "${subject}".`, error);
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

// A paid order has become one or more rental bookings: send the owner one email for the whole order,
// listing each rental and saying whether any of them wait for approval.
export async function emailOrderReceived(orderId: string, orderNumber: string, bookings: Booking[]) {
  try {
    if (bookings.length === 0) return;
    const settings = await loadSettings(merchant);
    if (!settings.emailOwnerNewBookings) return;
    const owner = await ownerEmail();
    if (!owner) return;
    const items = await Promise.all(bookings.map((booking) => loadItem(booking.itemId, merchant)));
    const currency = settings.currency;
    const { subject, heading, needsApproval } = orderAlertTitle(orderNumber, bookings);
    const renter = bookings.find((booking) => booking.renter.name || booking.renter.email)?.renter ?? bookings[0].renter;

    const rows: Array<[string, string]> = [];
    if (orderNumber) rows.push(['Order', `#${orderNumber}`]);
    bookings.forEach((booking, index) => {
      const name = items[index]?.name ?? 'Rental';
      rows.push([
        booking.reference,
        `${booking.quantity > 1 ? `${name} × ${booking.quantity}` : name} · ${dateRange(booking.startDate, booking.endDate)} · ${money(booking.quote.rental, currency)}${booking.status === 'pending' ? ' · needs approval' : ''}`,
      ]);
    });
    const deposit = bookings.reduce((sum, booking) => sum + booking.quote.deposit, 0);
    if (deposit > 0) rows.push(['Refundable deposit', money(deposit, currency)]);
    rows.push(['Total paid', money(bookings.reduce((sum, booking) => sum + booking.quote.total, 0), currency)]);
    if (renter.name) rows.push(['Customer', renter.name]);
    if (renter.email) rows.push(['Email', renter.email]);
    if (renter.phone) rows.push(['Phone', renter.phone]);

    await send(
      { email: owner },
      subject,
      layout(
        heading,
        [
          `${escape(renter.name || renter.email || 'A customer')} paid for ${bookings.length === 1 ? 'a rental' : `${bookings.length} rentals`}.`,
          needsApproval
            ? 'Open Rentals → Bookings in your site dashboard to approve or decline.'
            : 'Open Rentals → Bookings in your site dashboard to view the details.',
        ],
        rows,
      ),
      `${orderId}:owner-order-received`,
    );
  } catch (error) {
    // Email problems must not undo or block a paid booking.
    console.error(`Could not send the owner email for order ${orderId}.`, error);
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
  action: 'approve' | 'decline' | 'cancel' | 'pickup' | 'returned' | 'manual' | 'lost',
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
      lost: { subject: `Your rental ${after.reference} was not returned`, heading: 'Rental marked as not returned', message: 'The shop has recorded that this rental was not returned, and has kept your deposit toward its cost. Contact the shop if you still have the item or think this is a mistake.' },
    };
    const email = messages[action];
    const paragraphs = [`Hi ${escape(after.renter.name || 'there')},`, email.message];
    if (reason) paragraphs.push(escape(reason));
    const rows = summary(after, itemName, currency);
    if (action === 'returned' && after.lateReturn && after.lateReturn.lateDays > 0) {
      paragraphs.push(
        after.lateReturn.fee > 0
          ? `This rental came back after its return time, so a late fee of ${escape(money(after.lateReturn.fee, currency))} applies. The shop will take it from your deposit or send you a way to pay.`
          : 'This rental came back after its return time.',
      );
      if (after.lateReturn.fee > 0) rows.push(['Late fee', money(after.lateReturn.fee, currency)]);
    }
    if (action === 'cancel' && after.ecomOrderId) {
      paragraphs.push('The shop will handle any refund through the original Wix order.');
    }
    await send(
      { email: after.renter.email, name: after.renter.name },
      email.subject,
      layout(email.heading, paragraphs, rows),
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
  const isExtend = request.type === 'extend';
  if (isExtend) {
    rows.push(['New return date', formatDay(request.endDate)], ['New total', money(request.quote.total, currency)]);
  } else if (!isCancel) {
    rows.push(['New dates', dateRange(request.startDate, request.endDate)], ['New total', money(request.quote.total, currency)]);
  }
  const renter = booking.renter.name || booking.renter.email || 'A renter';
  const key = `${booking._id}:${request.requestedAt}`;
    const settings = await loadSettings(merchant);
    if (settings.emailOwnerRenterRequests) {
      const owner = await ownerEmail();
      await send(
        { email: owner },
        isCancel ? `Cancellation request for ${booking.reference}` : isExtend ? `Extension request for ${booking.reference}` : `Date change request for ${booking.reference}`,
        layout(
          isCancel ? 'A renter wants to cancel' : isExtend ? 'A renter wants to keep their rental longer' : 'A renter wants new dates',
          [
            `${escape(renter)} asked to ${isCancel ? 'cancel this rental' : isExtend ? 'extend this rental' : 'move this rental'}.`,
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
        isCancel
          ? `We received your cancellation request (${booking.reference})`
          : isExtend
            ? `We received your extension request (${booking.reference})`
            : `We received your date change request (${booking.reference})`,
        layout(
          'Request received',
          [
            `Hi ${escape(booking.renter.name || 'there')},`,
            `Thanks, we got your request to ${isCancel ? 'cancel' : isExtend ? 'extend' : 'change the dates of'} this rental. Nothing changes until the shop confirms, and we'll email you as soon as it does.`,
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
    if (request.type === 'extend') {
      const newReturn = escape(formatDay(request.endDate));
      await send(
        { email: after.renter.email, name: after.renter.name },
        approved ? `Your rental ${before.reference} is extended` : `Your extension request for ${before.reference}`,
        layout(
          approved ? 'Extension approved' : 'Extension declined',
          [
            `Hi ${escape(after.renter.name || 'there')},`,
            approved
              ? `The shop extended your rental. Please bring it back by ${newReturn}.`
              : `The shop couldn’t extend your rental to ${newReturn}, so please return it as soon as you can.`,
            ...(approved && note ? [escape(note)] : []),
            'Reply to this email if you have any questions.',
          ],
          summary(after, itemName, currency),
        ),
        `${before._id}:${request.requestedAt}:${approved ? 'approved' : 'declined'}`,
      );
      return;
    }
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

// ---------- Late returns ----------

// The live site's address, for "manage your rental" links. Empty when it can't be read.
async function siteUrl(): Promise<string> {
  try {
    const { site } = await getCurrentAppInstance();
    return site?.url ?? '';
  } catch {
    return '';
  }
}

function link(url: string, label: string): string {
  return `<a href="${escape(url)}" style="color:#116dff">${escape(label)}</a>`;
}

/** The renter's "due back today" reminder. */
export async function emailReturnReminder(booking: Booking) {
  try {
    const settings = await loadSettings(merchant);
    if (!settings.emailRentersReturnReminders) return;
    const { itemName, currency } = await details(booking);
    await send(
      { email: booking.renter.email, name: booking.renter.name },
      `Reminder: ${itemName} is due back today`,
      layout(
        'Your rental is due back today',
        [
          `Hi ${escape(booking.renter.name || 'there')},`,
          `Please bring your rental back by ${escape(settings.returnHour)} today.`,
          'Need it longer? Request an extension from My rentals on our site before then, or reply to this email.',
        ],
        summary(booking, itemName, currency),
      ),
      `${booking._id}:${booking.endDate}:due-today`,
    );
  } catch {
    // Email problems must not block the overdue sweep.
  }
}

/** The renter's overdue notice. `day` is 0 on the day it went overdue, then each follow-up day. */
export async function emailOverdueNotice(booking: Booking, day: number) {
  try {
    const settings = await loadSettings(merchant);
    if (!settings.emailRentersReturnReminders) return;
    const [{ itemName, currency }, url] = await Promise.all([details(booking), siteUrl()]);
    const fee = booking.lateReturn?.fee ?? 0;
    const paragraphs = [
      `Hi ${escape(booking.renter.name || 'there')},`,
      day === 0
        ? `Your rental was due back on ${escape(formatDay(booking.endDate))} by ${escape(settings.returnHour)} and we haven't received it yet.`
        : `Your rental is now ${booking.lateReturn?.lateDays ?? day + 1} days late. Please return it as soon as possible.`,
    ];
    if (fee > 0) paragraphs.push(`Late fees so far: <strong>${escape(money(fee, currency))}</strong>. They keep adding up until the rental is back.`);
    if (booking.changeRequest?.status !== 'pending') {
      paragraphs.push(
        url
          ? `Need it longer? ${link(url, 'Request an extension')} from My rentals on our site, or reply to this email.`
          : 'Need it longer? Request an extension from My rentals on our site, or reply to this email.',
      );
    }
    const rows = summary(booking, itemName, currency);
    if (fee > 0) rows.push(['Late fees so far', money(fee, currency)]);
    await send(
      { email: booking.renter.email, name: booking.renter.name },
      day === 0 ? `Your rental ${booking.reference} is overdue` : `Reminder: your rental ${booking.reference} is still overdue`,
      layout(day === 0 ? 'Your rental is overdue' : 'Your rental is still overdue', paragraphs, rows),
      `${booking._id}:${booking.endDate}:overdue-${day}`,
    );
  } catch {
    // Email problems must not block the overdue sweep.
  }
}

export interface AtRiskSummary {
  reference: string;
  renterName: string;
  startDate: string;
}

/** Tells the owner a rental just went overdue, and which upcoming rentals it may hold up. */
export async function emailOwnerOverdue(booking: Booking, atRisk: AtRiskSummary[]) {
  try {
    const settings = await loadSettings(merchant);
    if (!settings.emailOwnerOverdueAlerts) return;
    const owner = await ownerEmail();
    if (!owner) return;
    const { itemName, currency } = await details(booking);
    const rows = summary(booking, itemName, currency);
    if (booking.renter.name) rows.push(['Renter', booking.renter.name]);
    if (booking.renter.email) rows.push(['Email', booking.renter.email]);
    if (booking.renter.phone) rows.push(['Phone', booking.renter.phone]);
    for (const next of atRisk) rows.push(['Next rental at risk', `${next.reference} · ${next.renterName || 'Renter'} · picks up ${formatDay(next.startDate)}`]);
    await send(
      { email: owner },
      `Overdue: ${booking.reference} (${itemName})`,
      layout(
        'A rental is overdue',
        [
          `${escape(booking.renter.name || booking.renter.email || 'A renter')} hasn't returned this rental. It was due on ${escape(formatDay(booking.endDate))} by ${escape(settings.returnHour)}.`,
          atRisk.length > 0
            ? 'An upcoming rental needs this item. Open Rentals → Today to warn that renter, or cancel and refund their booking.'
            : 'The renter has been emailed. Open Rentals → Today to follow up.',
        ],
        rows,
      ),
      `${booking._id}:${booking.endDate}:owner-overdue`,
    );
  } catch {
    // Email problems must not block the overdue sweep.
  }
}

/** Tells the owner an upcoming rental can't go out unless an overdue item comes back first. */
export async function emailOwnerAtRisk(upcoming: Booking, overdueReferences: string[]) {
  try {
    const settings = await loadSettings(merchant);
    if (!settings.emailOwnerOverdueAlerts) return;
    const owner = await ownerEmail();
    if (!owner) return;
    const { itemName, currency } = await details(upcoming);
    const rows = summary(upcoming, itemName, currency);
    rows.push(['Waiting on', overdueReferences.join(', ')]);
    await send(
      { email: owner },
      `${upcoming.reference} may not be ready for pickup`,
      layout(
        'An upcoming rental is at risk',
        [
          `${escape(upcoming.renter.name || 'A renter')} picks up on ${escape(formatDay(upcoming.startDate))}, but the item hasn't come back from an overdue rental.`,
          'Open Rentals → Today to warn the renter, or cancel and refund their booking if the item won’t be back in time.',
        ],
        rows,
      ),
      `${upcoming._id}:${upcoming.startDate}:owner-at-risk`,
    );
  } catch {
    // Email problems must not block the overdue sweep.
  }
}

/** Sent by the owner to an upcoming renter whose item hasn't come back yet. */
export async function emailNextRenterDelay(upcoming: Booking) {
  const { itemName, currency } = await details(upcoming);
  await send(
    { email: upcoming.renter.email, name: upcoming.renter.name },
    `About your upcoming rental ${upcoming.reference}`,
    layout(
      'Your rental may be delayed',
      [
        `Hi ${escape(upcoming.renter.name || 'there')},`,
        `The ${escape(itemName)} you booked for ${escape(formatDay(upcoming.startDate))} hasn't been returned by the previous renter yet. We're working on it and will let you know as soon as it's back.`,
        'Reply to this email if you would like to change or cancel your booking.',
      ],
      summary(upcoming, itemName, currency),
    ),
    `${upcoming._id}:${upcoming.startDate}:renter-delay`,
  );
}

/** Tells the owner a rental has been out long enough that it may not come back. */
export async function emailOwnerLostFlag(booking: Booking) {
  try {
    const settings = await loadSettings(merchant);
    if (!settings.emailOwnerOverdueAlerts) return;
    const owner = await ownerEmail();
    if (!owner) return;
    const { itemName, currency } = await details(booking);
    const rows = summary(booking, itemName, currency);
    rows.push(['Days late', String(booking.lateReturn?.lateDays ?? 0)]);
    if (booking.renter.email) rows.push(['Email', booking.renter.email]);
    if (booking.renter.phone) rows.push(['Phone', booking.renter.phone]);
    await send(
      { email: owner },
      `${booking.reference} may not come back`,
      layout(
        'A rental may be lost',
        [
          `This rental is ${booking.lateReturn?.lateDays ?? 0} days late.`,
          'If it won’t come back, open the booking in Rentals and choose "Mark as not returned". That keeps the deposit and takes the unit out of your stock.',
        ],
        rows,
      ),
      `${booking._id}:${booking.endDate}:owner-lost`,
    );
  } catch {
    // Email problems must not block the overdue sweep.
  }
}

/** Sends the renter a payment link for a late fee balance or an extension. */
export async function emailPaymentRequest(booking: Booking, request: PaymentRequest) {
  const { itemName, currency } = await details(booking);
  const amount = money(request.amount, currency);
  const what = request.kind === 'extension' ? 'the extra days on your rental' : 'the late return fee';
  await send(
    { email: booking.renter.email, name: booking.renter.name },
    request.kind === 'extension' ? `Payment for your extended rental ${booking.reference}` : `Late fee for your rental ${booking.reference}`,
    layout(
      'Payment due',
      [
        `Hi ${escape(booking.renter.name || 'there')},`,
        `${escape(amount)} is due for ${what}. ${link(request.url, 'Pay securely online')}.`,
        'Reply to this email if you have any questions.',
      ],
      [...summary(booking, itemName, currency), ['Amount due', amount]],
    ),
    `${booking._id}:payment:${request.linkId}`,
  );
}
