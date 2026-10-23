import { useEffect, useState, type HTMLAttributes } from 'react';
import { currentCartV2 } from '@wix/ecom';
import { APP_ID } from '../rental/constants';
import { post, request } from './client';
import styles from './rental.module.css';

interface CatalogItem {
  _id: string;
  name: string;
  dailyRate: number;
  weeklyRate: number;
  depositAmount: number;
  category: string;
}

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

function classNameFor(base: string, part?: { className?: string }) {
  return part?.className || base;
}

export type BookingParts = {
  title?: HTMLAttributes<HTMLHeadingElement>;
  description?: HTMLAttributes<HTMLParagraphElement>;
  field?: HTMLAttributes<HTMLInputElement>;
  quote?: HTMLAttributes<HTMLParagraphElement>;
  button?: HTMLAttributes<HTMLButtonElement>;
};

const samples: CatalogItem[] = [
  { _id: 'sample', name: 'Sample rental', dailyRate: 20, weeklyRate: 100, depositAmount: 50, category: 'Equipment' },
];

export function RentalBookingForm({
  itemId = '',
  buttonLabel = 'Rent now',
  showDeposit = true,
  showWeeklyPrice = true,
  showQuantity = true,
  title = 'Rentals',
  description = '',
  parts,
}: {
  itemId?: string;
  buttonLabel?: string;
  showDeposit?: boolean;
  showWeeklyPrice?: boolean;
  showQuantity?: boolean;
  title?: string;
  description?: string;
  parts?: BookingParts;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [selected, setSelected] = useState(itemId);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    request<{ items: CatalogItem[] }>('/api/rentals/catalog')
      .then((body) => {
        setItems(body.items);
        setSelected((current) => current || body.items[0]?._id || '');
      })
      .catch(() => {
        setPreview(true);
        setItems(samples);
        setSelected(itemId || samples[0]._id);
      });
  }, [itemId]);

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

  const item = items.find((entry) => entry._id === selected);

  async function rent() {
    if (preview) {
      setMessage('This is a preview. Publish the site to take a booking.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const held = await post<HoldResult>('/api/rentals/hold', {
        itemId: selected,
        startDate,
        endDate,
        quantity,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!held.ok || !held.booking) {
        setMessage(held.message || 'Those dates are not available.');
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
      setMessage(`${held.booking.reference} is in your cart. Complete checkout within 30 minutes.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start checkout.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void rent(); }}>
      <h2 {...parts?.title} className={classNameFor(styles.heading, parts?.title)}>{title}</h2>
      <p {...parts?.description} className={classNameFor(styles.message, parts?.description)} hidden={!description}>{description}</p>
      <div className={styles.field}>
        <label htmlFor="rental-item">Item</label>
        <select
          id="rental-item"
          className={classNameFor(styles.control, parts?.field)}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {items.map((entry) => (
            <option key={entry._id} value={entry._id}>{entry.name}</option>
          ))}
        </select>
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="rental-start">Pickup</label>
          <input id="rental-start" className={classNameFor(styles.control, parts?.field)} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </div>
        <div className={styles.field}>
          <label htmlFor="rental-end">Return</label>
          <input id="rental-end" className={classNameFor(styles.control, parts?.field)} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
        </div>
      </div>
      {showQuantity ? (
        <div className={styles.field}>
          <label htmlFor="rental-qty">Quantity</label>
          <input id="rental-qty" className={classNameFor(styles.control, parts?.field)} type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value) || 1)} />
        </div>
      ) : null}
      {item && showWeeklyPrice && item.weeklyRate > 0 ? <p {...parts?.quote} className={classNameFor(styles.quote, parts?.quote)}>Weekly rate {item.weeklyRate}</p> : null}
      {quote?.ok && quote.quote ? (
        <p {...parts?.quote} className={classNameFor(styles.quote, parts?.quote)}>
          {quote.quote.days} days · {quote.quote.total} {quote.currency}
          {showDeposit ? ` (deposit ${quote.quote.deposit})` : ''}
        </p>
      ) : null}
      {quote && !quote.ok ? <p className={styles.message}>{quote.message}</p> : null}
      {message ? <p className={styles.message} role="status">{message}</p> : null}
      <button {...parts?.button} className={classNameFor(styles.action, parts?.button)} type="submit" disabled={busy || !selected}>{busy ? 'Holding dates…' : buttonLabel}</button>
    </form>
  );
}
