import { audit, findBooking, listBookings, settleDeposit, transition } from './actions';
import { quoteRental } from './holds';
import { checkRange, loadItem, loadSettings } from './availability';
import {
  blockDates,
  createItem,
  createManualBooking,
  listItems,
  rentalSummary,
  saveSettings,
  todayBoard,
  unblockDates,
  updateItem,
} from './merchant';
import { readPlan } from './plans';
import type { RentalItem, Settings } from './models';
import { text } from './models';

const source = 'aria';

function payload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function confirmed(body: Record<string, unknown>, summary: string) {
  if (body.confirm !== true) return { needsConfirmation: true, summary };
  return undefined;
}

export async function runAriaTool(methodName: string, raw: unknown) {
  const body = payload(raw);
  const result = await dispatch(methodName, body);
  await audit(methodName, `Aria ${methodName}`, text(body.reference) || text(body.itemId), source);
  return result;
}

async function dispatch(methodName: string, body: Record<string, unknown>) {
  switch (methodName) {
    case 'list_rental_items':
      return { items: await listItems(text(body.category) || undefined, text(body.status) || undefined) };
    case 'get_rental_item': {
      const item = await loadItem(text(body.itemId) || text(body.item), { elevate: true });
      return item ? { item } : { message: 'Item not found.' };
    }
    case 'create_rental_item': {
      const pending = confirmed(body, `Create ${text(body.name)} at ${text(body.dailyRate)} per day.`);
      if (pending) return pending;
      return createItem({
        name: text(body.name),
        dailyRate: Number(body.dailyRate),
        weeklyRate: Number(body.weeklyRate ?? 0),
        unitCount: Number(body.units ?? body.unitCount ?? 1),
        depositAmount: Number(body.deposit ?? 0),
      });
    }
    case 'update_rental_item': {
      const pending = confirmed(body, `Update item ${text(body.itemId) || text(body.item)}.`);
      if (pending) return pending;
      return updateItem(text(body.itemId) || text(body.item), body as Partial<RentalItem>);
    }
    case 'check_availability': {
      const plan = await readPlan({ elevate: true });
      const settings = await loadSettings({ elevate: true });
      const item = await loadItem(text(body.itemId) || text(body.item), { elevate: true });
      if (!item) return { message: 'Item not found.' };
      return checkRange(item, settings, text(body.start), text(body.end), Number(body.quantity ?? 1), plan.perItemRules, { elevate: true });
    }
    case 'get_quote':
      return quoteRental({
        itemId: text(body.itemId) || text(body.item),
        startDate: text(body.start),
        endDate: text(body.end),
        quantity: Number(body.quantity ?? 1),
      });
    case 'list_bookings':
      return { bookings: await listBookings(text(body.status) || undefined, text(body.from) || undefined, text(body.to) || undefined) };
    case 'get_booking': {
      const booking = await findBooking(text(body.reference));
      return booking ? { booking } : { message: 'Booking not found.' };
    }
    case 'create_manual_booking': {
      const pending = confirmed(body, `Book ${text(body.quantity) || '1'} of ${text(body.item)} for ${text(body.renterName)}, ${text(body.start)} to ${text(body.end)}.`);
      if (pending) return pending;
      return createManualBooking({
        itemId: text(body.itemId) || text(body.item),
        startDate: text(body.start),
        endDate: text(body.end),
        quantity: Number(body.quantity ?? 1),
        renterName: text(body.renterName),
        renterEmail: text(body.renterEmail),
      });
    }
    case 'approve_booking':
    case 'decline_booking':
    case 'mark_picked_up':
    case 'mark_returned':
    case 'cancel_booking': {
      const action = methodName === 'approve_booking' ? 'approve'
        : methodName === 'decline_booking' ? 'decline'
        : methodName === 'mark_picked_up' ? 'pickup'
        : methodName === 'mark_returned' ? 'returned'
        : 'cancel';
      const pending = confirmed(body, `${action} booking ${text(body.reference)}.`);
      if (pending) return pending;
      return transition(text(body.reference), action, source, text(body.reason));
    }
    case 'settle_deposit': {
      const pending = confirmed(body, `Keep ${text(body.amountKept) || '0'} of the deposit on ${text(body.reference)}.`);
      if (pending) return pending;
      return settleDeposit(text(body.reference), Number(body.amountKept ?? 0), text(body.note), source);
    }
    case 'block_dates':
    case 'unblock_dates': {
      const dates = Array.isArray(body.dates) ? body.dates.filter((date): date is string => typeof date === 'string') : [];
      const pending = confirmed(body, `${methodName === 'block_dates' ? 'Block' : 'Unblock'} ${dates.join(', ') || 'no dates'}.`);
      if (pending) return pending;
      return methodName === 'block_dates'
        ? blockDates(text(body.item) || undefined, dates, text(body.reason))
        : unblockDates(text(body.item) || undefined, dates);
    }
    case 'get_today':
      return todayBoard();
    case 'get_rental_summary':
      return rentalSummary(text(body.from), text(body.to));
    case 'get_settings':
      return { settings: await loadSettings({ elevate: true }), plan: await readPlan({ elevate: true }) };
    case 'update_settings': {
      const pending = confirmed(body, 'Update rental business settings.');
      if (pending) return pending;
      return { settings: await saveSettings(body as Partial<Settings>) };
    }
    default:
      throw new Error(`Unknown tool: ${methodName}`);
  }
}
