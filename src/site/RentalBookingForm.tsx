import { useEffect, useMemo, useState, type HTMLAttributes } from 'react';
import type { DateRange } from 'react-day-picker';
import { currentCartV2 } from '@wix/ecom';
import { APP_ID } from '../rental/constants';
import { post, request } from './client';
import { addDays, isoDate, money, partClass, shortDate } from './format';
import { RentalCalendar } from './RentalCalendar';
import type { CatalogItem } from './types';
import styles from './rental.module.css';

interface QuoteResult {
  ok: boolean;
  message?: string;
  currency?: string;
  quote?: { days: number; rental: number; deposit: number; total: number };
}

interface HoldResult {
  ok: boolean;
  message?: string;
  booking?: { _id: string; itemId: string; quantity: number; reference: string };
}

export type BookingParts = {
  title?: HTMLAttributes<HTMLHeadingElement>;
  description?: HTMLAttributes<HTMLParagraphElement>;
  field?: HTMLAttributes<HTMLInputElement>;
  quote?: HTMLAttributes<HTMLParagraphElement>;
  button?: HTMLAttributes<HTMLButtonElement>;
};

const samples: CatalogItem[] = [
  { _id: 'sample', name: 'Sample rental', dailyRate: 20, weeklyRate: 100, depositAmount: 50, category: 'Equipment', minDays: 1, maxDays: 30, leadDays: 1 },
];

export function RentalBookingForm({
  itemId = '',
  buttonLabel = 'Rent now',
  showDeposit = true,
  showWeeklyPrice = true,
  showQuantity = true,
  title = 'Book your rental',
  description = '',
  monthsShown = 1,
  embedded = false,
  parts,
}: {
  itemId?: string;
  buttonLabel?: string;
  showDeposit?: boolean;
  showWeeklyPrice?: boolean;
  showQuantity?: boolean;
  title?: string;
  description?: string;
  monthsShown?: number;
  /** Inside the details widget, which already shows the item's name and rates. */
  embedded?: boolean;
  parts?: BookingParts;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [currency, setCurrency] = useState<string | undefined>();
  const [selected, setSelected] = useState(itemId);
  const [range, setRange] = useState<DateRange | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    request<{ items: CatalogItem[]; currency?: string }>('/api/rentals/catalog')
      .then((body) => {
        setItems(body.items);
        setCurrency(body.currency);
        setSelected((current) => current || body.items[0]?._id || '');
      })
      .catch(() => {
        setPreview(true);
        setItems(samples);
        setCurrency('USD');
        setSelected(itemId || samples[0]._id);
      });
  }, [itemId]);

  const item = items.find((entry) => entry._id === selected);
  const firstAvailable = useMemo(() => addDays(new Date(), item?.leadDays ?? 0), [item?.leadDays]);
  const startDate = range?.from ? isoDate(range.from) : '';
  const endDate = range?.to ? isoDate(range.to) : '';
  const maxQuantity = Math.max(1, item?.unitCount ?? 99);
  const showPicker = !itemId && items.length > 1;

  useEffect(() => {
    setRange(undefined);
    setQuantity(1);
    setMessage(null);
  }, [selected]);

  useEffect(() => {
    if (!selected || !startDate || !endDate || preview) {
      setQuote(null);
      return;
    }
    const timer = setTimeout(() => {
      post<QuoteResult>('/api/rentals/quote', { itemId: selected, startDate, endDate, quantity })
        .then(setQuote)
        .catch((error: Error) => setQuote({ ok: false, message: error.message }));
    }, 300);
    return () => clearTimeout(timer);
  }, [selected, startDate, endDate, quantity, preview]);

  async function rent() {
    if (preview) {
      setMessage({ tone: 'error', text: 'This is a preview. Publish the site to take a booking.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const held = await post<HoldResult>('/api/rentals/hold', {
        itemId: selected,
        startDate,
        endDate,
        quantity,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!held.ok || !held.booking) {
        setMessage({ tone: 'error', text: held.message || 'Those dates are not available.' });
        return;
      }
      await currentCartV2.addLineItemsToCurrentCart({
        catalogItems: [
          {
            catalogReference: {
              catalogItemId: held.booking.itemId,
              appId: APP_ID,
              options: { bookingId: held.booking._id },
            },
            quantity: held.booking.quantity,
          },
        ],
      });
      await post('/api/rentals/hold', { action: 'extend', bookingId: held.booking._id }).catch(() => undefined);
      setMessage({ tone: 'success', text: `${held.booking.reference} is in your cart. Complete checkout within 30 minutes.` });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not start checkout.' });
    } finally {
      setBusy(false);
    }
  }

  const priced = quote?.ok && quote.quote ? quote.quote : null;
  const quoteCurrency = quote?.currency ?? currency;
  const ready = Boolean(selected && startDate && endDate) && (preview || Boolean(priced));

  return (
    <form className={styles.booking} onSubmit={(event) => { event.preventDefault(); void rent(); }}>
      <header className={styles.header}>
        {title ? <h2 {...parts?.title} className={partClass(styles.heading, parts?.title)}>{title}</h2> : null}
        {description ? (
          <p {...parts?.description} className={partClass(styles.lede, parts?.description)}>{description}</p>
        ) : null}
      </header>

      {showPicker ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="rental-item">What would you like to rent?</label>
          <div className={styles.selectWrap}>
            <select
              id="rental-item"
              className={partClass(styles.control, parts?.field)}
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              {items.map((entry) => (
                <option key={entry._id} value={entry._id}>{entry.name}</option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {!showPicker && !embedded && item ? <p className={styles.itemName}>{item.name}</p> : null}

      {item && !embedded ? (
        <div className={styles.rates}>
          <span className={styles.rate}><strong>{money(item.dailyRate, currency)}</strong> / day</span>
          {showWeeklyPrice && item.weeklyRate > 0 ? (
            <span className={styles.rate}><strong>{money(item.weeklyRate, currency)}</strong> / week</span>
          ) : null}
          {showDeposit && item.depositAmount ? (
            <span className={styles.rateMuted}>{money(item.depositAmount, currency)} refundable deposit</span>
          ) : null}
        </div>
      ) : null}

      <div className={styles.dates} aria-live="polite">
        <div className={styles.dateChip} data-active={!range?.from || undefined}>
          <span className={styles.dateLabel}>Pickup</span>
          <span className={styles.dateValue}>{shortDate(range?.from) || 'Select date'}</span>
        </div>
        <span className={styles.dateArrow} aria-hidden="true">→</span>
        <div className={styles.dateChip} data-active={(range?.from && !range.to) || undefined}>
          <span className={styles.dateLabel}>Return</span>
          <span className={styles.dateValue}>{shortDate(range?.to) || 'Select date'}</span>
        </div>
      </div>

      <div className={styles.calendarCard}>
        <RentalCalendar range={range} onChange={setRange} firstAvailable={firstAvailable} months={monthsShown} />
        {item && (item.minDays ?? 1) > 1 ? (
          <p className={styles.hint}>Minimum rental: {item.minDays} days.</p>
        ) : null}
      </div>

      {showQuantity ? (
        <div className={styles.quantityRow}>
          <span className={styles.label} id="rental-qty-label">Quantity</span>
          <div className={styles.stepper} role="group" aria-labelledby="rental-qty-label">
            <button type="button" className={styles.stepButton} aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
            <output className={styles.stepValue} aria-live="polite">{quantity}</output>
            <button type="button" className={styles.stepButton} aria-label="Increase quantity" disabled={quantity >= maxQuantity} onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}>+</button>
          </div>
        </div>
      ) : null}

      {priced ? (
        <dl className={styles.summary}>
          <div className={styles.summaryRow}>
            <dt>Rental · {priced.days} {priced.days === 1 ? 'day' : 'days'}{quantity > 1 ? ` × ${quantity}` : ''}</dt>
            <dd>{money(priced.rental, quoteCurrency)}</dd>
          </div>
          {showDeposit && priced.deposit > 0 ? (
            <div className={styles.summaryRow}>
              <dt>Refundable deposit</dt>
              <dd>{money(priced.deposit, quoteCurrency)}</dd>
            </div>
          ) : null}
          <div className={styles.summaryTotal}>
            <dt>Total</dt>
            <dd>
              <p {...parts?.quote} className={partClass(styles.totalValue, parts?.quote)}>{money(priced.total, quoteCurrency)}</p>
            </dd>
          </div>
        </dl>
      ) : null}

      {quote && !quote.ok ? <p className={styles.notice} data-tone="error" role="alert">{quote.message}</p> : null}
      {message ? <p className={styles.notice} data-tone={message.tone} role="status">{message.text}</p> : null}

      <button {...parts?.button} className={partClass(styles.action, parts?.button)} type="submit" disabled={busy || !ready} aria-busy={busy}>
        <span className={styles.buttonContent}>
          {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
          <span>{buttonLabel}</span>
        </span>
      </button>
    </form>
  );
}
