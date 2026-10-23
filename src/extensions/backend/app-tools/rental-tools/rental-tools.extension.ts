import { extensions } from '@wix/astro/builders';

const object = { type: 'object' as const };

function tool(
  methodName: string,
  displayName: string,
  description: string,
  properties: Record<string, { type: string }>,
  required: string[] = [],
) {
  return {
    methodName,
    displayName,
    description,
    activated: true,
    requestSchema: { ...object, properties, required },
    responseSchema: object,
  };
}

export default extensions.appTools({
  id: 'c211a8db-e51e-4c7f-8dad-edaa15a9a708',
  name: 'rental-tools',
  tools: [
    tool('list_rental_items', 'List rental items', 'Lists the rental catalog, optionally filtered by category or status. Use this when a collaborator asks what is available to rent.', { category: { type: 'string' }, status: { type: 'string' } }),
    tool('get_rental_item', 'Get rental item', 'Returns one rental item by its id, including price, deposit, and unit count. Use this before quoting or editing an item.', { itemId: { type: 'string' } }, ['itemId']),
    tool('create_rental_item', 'Create rental item', 'Creates a rental item with a name and daily rate. Call once without confirm to show the summary, then again with confirm true only after the collaborator agrees.', { name: { type: 'string' }, dailyRate: { type: 'number' }, weeklyRate: { type: 'number' }, units: { type: 'number' }, deposit: { type: 'number' }, confirm: { type: 'boolean' } }, ['name', 'dailyRate']),
    tool('update_rental_item', 'Update rental item', 'Updates fields on an existing rental item. Call once without confirm to show the summary, then again with confirm true only after the collaborator agrees.', { itemId: { type: 'string' }, name: { type: 'string' }, dailyRate: { type: 'number' }, confirm: { type: 'boolean' } }, ['itemId']),
    tool('check_availability', 'Check availability', 'Checks whether an item can be rented for a date range and quantity. Use this before promising dates to a renter.', { itemId: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, quantity: { type: 'number' } }, ['itemId', 'start', 'end']),
    tool('get_quote', 'Get rental quote', 'Prices a rental for a date range using the daily and weekly rates. Use this when a collaborator asks what a rental would cost.', { itemId: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, quantity: { type: 'number' } }, ['itemId', 'start', 'end']),
    tool('list_bookings', 'List bookings', 'Lists bookings, optionally by status or pickup date range. Use this to find a reservation before changing it.', { status: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } }),
    tool('get_booking', 'Get booking', 'Returns one booking by its reference or id. Use this when a collaborator asks about a specific reservation.', { reference: { type: 'string' } }, ['reference']),
    tool('create_manual_booking', 'Create manual booking', 'Books an item for a named renter without checkout. Call once without confirm, then again with confirm true only after the collaborator agrees.', { item: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, quantity: { type: 'number' }, renterName: { type: 'string' }, renterEmail: { type: 'string' }, confirm: { type: 'boolean' } }, ['item', 'start', 'end', 'renterName']),
    tool('approve_booking', 'Approve booking', 'Approves a pending booking. Call once without confirm, then again with confirm true only after the collaborator agrees.', { reference: { type: 'string' }, confirm: { type: 'boolean' } }, ['reference']),
    tool('decline_booking', 'Decline booking', 'Declines a pending booking and releases the dates. Call once without confirm, then again with confirm true only after the collaborator agrees.', { reference: { type: 'string' }, reason: { type: 'string' }, confirm: { type: 'boolean' } }, ['reference']),
    tool('mark_picked_up', 'Mark picked up', 'Marks a confirmed booking as out with the renter. Call once without confirm, then again with confirm true only after the collaborator agrees.', { reference: { type: 'string' }, confirm: { type: 'boolean' } }, ['reference']),
    tool('mark_returned', 'Mark returned', 'Marks an active booking as returned. Call once without confirm, then again with confirm true only after the collaborator agrees.', { reference: { type: 'string' }, confirm: { type: 'boolean' } }, ['reference']),
    tool('settle_deposit', 'Settle deposit', 'Records how much of the deposit to keep after return. It does not refund the Wix order. Call once without confirm, then again with confirm true only after the collaborator agrees.', { reference: { type: 'string' }, amountKept: { type: 'number' }, note: { type: 'string' }, confirm: { type: 'boolean' } }, ['reference']),
    tool('cancel_booking', 'Cancel booking', 'Cancels a booking and releases the dates. A paid booking is not refunded automatically. Call once without confirm, then again with confirm true only after the collaborator agrees.', { reference: { type: 'string' }, reason: { type: 'string' }, confirm: { type: 'boolean' } }, ['reference']),
    tool('block_dates', 'Block dates', 'Closes dates for one item or the whole business so they cannot be pickup or return days. Call once without confirm, then again with confirm true only after the collaborator agrees.', { item: { type: 'string' }, dates: { type: 'array' }, reason: { type: 'string' }, confirm: { type: 'boolean' } }, ['dates']),
    tool('unblock_dates', 'Unblock dates', 'Reopens previously blocked dates. Call once without confirm, then again with confirm true only after the collaborator agrees.', { item: { type: 'string' }, dates: { type: 'array' }, confirm: { type: 'boolean' } }, ['dates']),
    tool('get_today', 'Get today', 'Returns today\'s pickups, returns, and overdue rentals in the business timezone. Use this when a collaborator asks what is happening today.', {}),
    tool('get_rental_summary', 'Get rental summary', 'Summarizes booking count and rental revenue between two pickup dates. Use this for a period recap.', { from: { type: 'string' }, to: { type: 'string' } }, ['from', 'to']),
    tool('get_settings', 'Get rental settings', 'Returns business defaults and the current plan limits. Use this before changing hours, buffers, or approval mode.', {}),
    tool('update_settings', 'Update rental settings', 'Updates timezone, hours, buffers, and approval mode. Call once without confirm, then again with confirm true only after the collaborator agrees.', { timezone: { type: 'string' }, pickupHour: { type: 'string' }, returnHour: { type: 'string' }, approvalMode: { type: 'string' }, confirm: { type: 'boolean' } }),
  ],
});
