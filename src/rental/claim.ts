import { collections } from './constants';
import { insertRow, isDuplicateError, removeRows } from './store';

const merchant = { elevate: true };

export async function claimUnitsForBooking(
  itemId: string,
  bookingId: string,
  quantity: number,
  dates: string[],
  unitCount: number,
): Promise<boolean> {
  const claimed: string[] = [];
  for (const date of dates) {
    let got = 0;
    for (let unit = 0; unit < unitCount && got < quantity; unit += 1) {
      const _id = `${itemId}:${date}:${unit}`;
      try {
        await insertRow(collections.unitDays, { _id, bookingId, itemId, date, unitIndex: unit }, merchant);
        claimed.push(_id);
        got += 1;
      } catch (error) {
        if (!isDuplicateError(error)) throw error;
      }
    }
    if (got < quantity) {
      await removeRows(collections.unitDays, claimed, merchant);
      return false;
    }
  }
  return true;
}
