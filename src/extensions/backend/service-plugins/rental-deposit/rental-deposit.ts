import { additionalFees } from '@wix/ecom/service-plugins';
import { APP_ID, collections } from '../../../../rental/constants';
import { loadSettings } from '../../../../rental/availability';
import { getCurrentAppInstance } from '../../../../rental/app-instance';
import { readPlan } from '../../../../rental/plans';
import { depositFeeName, orderDepositAmount, ORDER_DEPOSIT_FEE_CODE } from '../../../../rental/deposit-rules';
import { asBooking } from '../../../../rental/holds';
import { queryRows } from '../../../../rental/store';

const merchant = { elevate: true };

// Adds one "Refundable deposit" fee per checkout when the site charges a per-order deposit.
// Wix calls this on every cart and checkout calculation and drops the fee if we error or take over 3 seconds,
// so it does at most three reads and returns no fee on any failure. The order handler records what was
// actually charged, so a dropped fee shows up as no deposit rather than a wrong one.
additionalFees.provideHandlers({
  calculateAdditionalFees: async ({ request, metadata }) => {
    const currency = metadata.currency ?? '';
    const none = { additionalFees: [], currency };
    try {
      const lines = (request.lineItems ?? [])
        .filter((line) => line.catalogReference?.appId === APP_ID && line._id)
        .map((line) => ({ lineItemId: line._id as string, bookingId: line.catalogReference?.options?.bookingId }))
        .filter((line): line is { lineItemId: string; bookingId: string } => typeof line.bookingId === 'string' && line.bookingId !== '');
      if (lines.length === 0) return none;

      // The app instance is fetched once (and cached briefly per site) and shared by the plan and the
      // site currency, so everything below runs in about two round trips instead of four.
      const appInstancePromise = getCurrentAppInstance().catch(() => undefined);
      const [settings, plan, result] = await Promise.all([
        appInstancePromise.then((appInstance) => loadSettings(merchant, appInstance)),
        appInstancePromise.then((appInstance) => readPlan(merchant, appInstance)),
        queryRows(collections.bookings, merchant).hasSome('_id', lines.map((line) => line.bookingId)).limit(100).find(),
      ]);
      const amount = orderDepositAmount(settings, plan.orderDeposit);
      if (amount <= 0) return none;

      // Only lines quoted without their own deposit are covered. A line added to the cart before the site switched
      // to per-order deposits already includes its item deposit, and charging both would double up.
      const withoutOwnDeposit = new Set(
        result.items.map(asBooking).filter((booking) => booking.quote.deposit === 0).map((booking) => booking._id),
      );
      const covered = lines.filter((line) => withoutOwnDeposit.has(line.bookingId));
      if (covered.length === 0) return none;

      const language = metadata.languages?.[0] ?? settings.language;
      return {
        additionalFees: [
          {
            code: ORDER_DEPOSIT_FEE_CODE,
            name: depositFeeName(settings.language),
            translatedName: depositFeeName(language),
            price: amount.toFixed(2),
            // A refundable deposit isn't a sale, so it isn't taxed.
            taxDetails: { taxable: false },
            lineItemIds: covered.map((line) => line.lineItemId),
          },
        ],
        currency,
      };
    } catch (error) {
      console.error('Could not calculate the rental deposit fee.', error);
      return none;
    }
  },
});
