import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react';
import type { DateRange } from 'react-day-picker';
import { ecom } from '@wix/site-ecom';
import { post, request } from './client';
import { addDays, isoDate, partClass } from './format';
import { useSiteI18n } from './i18n';
import { renterError } from '../lib/error-text';
import { RentalCalendar } from './RentalCalendar';
import type { CatalogItem } from './types';
import type { ItemAvailability } from '../rental/calendar-rules';
import styles from './rental.module.css';

interface QuoteResult {
  ok: boolean;
  message?: string;
  currency?: string;
  quote?: { days: number; rental: number; deposit: number; total: number };
}

interface CartResult {
  ok: boolean;
  /** Where it failed: 'hold' means the dates were taken; 'cart' means Wix rejected the cart line. */
  stage?: 'input' | 'hold' | 'cart';
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

export type BookingNotification = {
  tone: 'success' | 'error';
  text: string;
};

const samples: CatalogItem[] = [
  { _id: 'sample', name: 'Sample rental', dailyRate: 20, weeklyRate: 100, depositAmount: 50, category: 'Equipment', minDays: 1, maxDays: 30, leadDays: 1 },
];

function LoadingDots({ label }: { label: string }) {
  return (
    <div className={styles.progress} role="status" aria-label={label}>
      <span>{label}</span>
      <svg className={styles.loadingDots} viewBox="0 0 36 12" aria-hidden="true">
        <circle className={styles.loadingDot} cx="6" cy="6" r="4" />
        <circle className={styles.loadingDot} cx="18" cy="6" r="4" />
        <circle className={styles.loadingDot} cx="30" cy="6" r="4" />
      </svg>
    </div>
  );
}

export function RentalBookingForm({
  itemId = '',
  buttonLabel,
  showDeposit = true,
  showWeeklyPrice = true,
  showQuantity = true,
  title,
  description = '',
  monthsShown = 1,
  embedded = false,
  language,
  parts,
  onNotification,
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
  language?: string;
  parts?: BookingParts;
  onNotification?: (notification: BookingNotification) => void;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [currency, setCurrency] = useState<string | undefined>();
  // One deposit for the whole order, added at checkout as a separate line; 0 when items carry their own.
  const [orderDeposit, setOrderDeposit] = useState(0);
  const [apiLanguage, setApiLanguage] = useState<string | undefined>();
  const [selected, setSelected] = useState(itemId);
  const [range, setRange] = useState<DateRange | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  // Reused across retries of the same selection, so a request that timed out on the
  // client but succeeded on the server replays that hold instead of colliding with it.
  const holdAttempt = useRef<{ signature: string; key: string } | null>(null);

  const { t, dateLocale, isRtl, money, shortDate } = useSiteI18n(language || apiLanguage);

  // Every error shown to the renter goes through here: a raw Wix error dump becomes its message, and a bare
  // status line ("Internal Server Error") becomes our own wording, since it tells the renter nothing.
  function notify(notification: BookingNotification) {
    const shown = notification.tone === 'error'
      ? { ...notification, text: renterError(notification.text, t('checkout_error')) }
      : notification;
    onNotification?.(shown);
    return shown;
  }

  useEffect(() => {
    request<{ items: CatalogItem[]; currency?: string; language?: string; orderDeposit?: number }>('/api/rentals/catalog')
      .then((body) => {
        setItems(body.items);
        setCurrency(body.currency);
        setOrderDeposit(Number(body.orderDeposit) > 0 ? Number(body.orderDeposit) : 0);
        if (body.language) setApiLanguage(body.language);
        setSelected((current) => current || body.items[0]?._id || '');
      })
      .catch(() => {
        setPreview(true);
        setItems(samples);
        setCurrency('USD');
        setSelected(itemId || samples[0]._id);
      });
  }, [itemId]);

  // Booked and closed days for the selected item, so the calendar can grey them out.
  // `availabilityVersion` re-reads it when a quote or hold shows the calendar was out of date.
  const [availability, setAvailability] = useState<ItemAvailability | null>(null);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const reloadAvailability = () => setAvailabilityVersion((version) => version + 1);
  useEffect(() => {
    if (!selected || preview) {
      setAvailability(null);
      return;
    }
    let active = true;
    request<{ availability: ItemAvailability }>(`/api/rentals/availability?itemId=${encodeURIComponent(selected)}`)
      .then((body) => { if (active) setAvailability(body.availability); })
      // Without it the calendar falls back to past/lead-time limits; the server still checks every range.
      .catch(() => { if (active) setAvailability(null); });
    return () => { active = false; };
  }, [selected, preview, availabilityVersion]);

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
      setQuoteLoading(false);
      return;
    }
    let active = true;
    setQuote(null);
    setQuoteLoading(true);
    const timer = setTimeout(() => {
      post<QuoteResult>('/api/rentals/quote', { itemId: selected, startDate, endDate, quantity })
        .then((body) => {
          if (!active) return;
          setQuote(body);
          if (!body.ok) {
            notify({ tone: 'error', text: body.message || t('dates_unavailable') });
            reloadAvailability();
          }
        })
        .catch((error: Error) => {
          if (!active) return;
          const text = error.message || t('availability_error');
          setQuote({ ok: false, message: text });
          notify({ tone: 'error', text });
        })
        .finally(() => { if (active) setQuoteLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [selected, startDate, endDate, quantity, preview, t]);

  function holdKey() {
    const signature = [selected, startDate, endDate, quantity].join('|');
    if (holdAttempt.current?.signature !== signature) {
      holdAttempt.current = { signature, key: crypto.randomUUID() };
    }
    return holdAttempt.current.key;
  }

  async function rent() {
    if (preview) {
      const notification = notify({ tone: 'error', text: t('preview_booking_notice') });
      setMessage(notification);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      // One request holds the dates, adds the line to the visitor's cart and extends the hold.
      const held = await post<CartResult>('/api/rentals/cart', {
        itemId: selected,
        startDate,
        endDate,
        quantity,
        idempotencyKey: holdKey(),
      });
      if (!held.ok || !held.booking) {
        const fallback = held.stage === 'cart' ? t('checkout_error') : t('dates_unavailable');
        const notification = notify({ tone: 'error', text: held.message || fallback });
        setMessage(notification);
        if (held.stage !== 'cart') reloadAvailability();
        return;
      }
      // Updates the site's cart icon and side cart. (currentCartV2.refreshCurrentCart only re-prices the
      // cart on the server, which re-runs our catalog and fee plugins for nothing right after adding.)
      // The item is already in the cart, so a failed UI refresh shouldn't surface as a booking error.
      await ecom.refreshCart().catch((error: unknown) => console.warn('Could not refresh the cart UI.', error));
      // Show the renter what they just added. Some sites hide the side cart; that's fine, the item is in the cart.
      await ecom.openSideCart().catch((error: unknown) => console.warn('Could not open the side cart.', error));
      // In the cart now; a later booking of the same dates is a new hold.
      holdAttempt.current = null;
      // These dates are held now; show them as taken if the renter books again.
      reloadAvailability();
      const notification = notify({ tone: 'success', text: t('cart_success', { reference: held.booking.reference }) });
      setMessage(notification);
    } catch (error) {
      // The cart SDK throws Wix's raw error text; notify() reduces it to something readable.
      const notification = notify({ tone: 'error', text: error instanceof Error ? error.message : t('checkout_error') });
      setMessage(notification);
    } finally {
      setBusy(false);
    }
  }

  const priced = quote?.ok && quote.quote ? quote.quote : null;
  const quoteCurrency = quote?.currency ?? currency;
  const ready = Boolean(selected && startDate && endDate) && (preview || Boolean(priced));
  const isDefaultTitle = !title || title === 'Rentals' || title === 'Book your rental';
  const effectiveTitle = isDefaultTitle ? t('booking_title') : title;
  const isDefaultButton = !buttonLabel || buttonLabel === 'Rent now';
  const effectiveButtonLabel = isDefaultButton ? t('rent_now') : buttonLabel;

  return (
    <form className={styles.booking} dir={isRtl ? 'rtl' : 'ltr'} onSubmit={(event) => { event.preventDefault(); void rent(); }}>
      <header className={styles.header}>
        {effectiveTitle ? <h2 {...parts?.title} className={partClass(styles.heading, parts?.title)}>{effectiveTitle}</h2> : null}
        {description ? (
          <p {...parts?.description} className={partClass(styles.lede, parts?.description)}>{description}</p>
        ) : null}
      </header>

      {showPicker ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="rental-item">{t('item_picker_label')}</label>
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
          <span className={styles.rate}><strong>{money(item.dailyRate, currency)}</strong>{t('per_day')}</span>
          {showWeeklyPrice && item.weeklyRate > 0 ? (
            <span className={styles.rate}><strong>{money(item.weeklyRate, currency)}</strong>{t('per_week')}</span>
          ) : null}
          {showDeposit && item.depositAmount ? (
            <span className={styles.rateMuted}>{money(item.depositAmount, currency)} {t('refundable_deposit')}</span>
          ) : null}
          {showDeposit && orderDeposit > 0 ? (
            <span className={styles.rateMuted}>{t('order_deposit_rate', { amount: money(orderDeposit, currency) })}</span>
          ) : null}
        </div>
      ) : null}

      <div className={styles.dates} aria-live="polite">
        <div className={styles.dateChip} data-active={!range?.from || undefined}>
          <span className={styles.dateLabel}>{t('pickup')}</span>
          <span className={styles.dateValue}>{shortDate(range?.from) || t('select_date')}</span>
        </div>
        <span className={styles.dateArrow} aria-hidden="true">{isRtl ? '←' : '→'}</span>
        <div className={styles.dateChip} data-active={(range?.from && !range.to) || undefined}>
          <span className={styles.dateLabel}>{t('return')}</span>
          <span className={styles.dateValue}>{shortDate(range?.to) || t('select_date')}</span>
        </div>
      </div>

      <div className={styles.calendarCard}>
        <RentalCalendar
          range={range}
          onChange={setRange}
          firstAvailable={firstAvailable}
          availability={availability?.itemId === selected ? availability : null}
          quantity={quantity}
          months={monthsShown}
          locale={dateLocale}
          dir={isRtl ? 'rtl' : 'ltr'}
        />
        {item && (item.minDays ?? 1) > 1 ? (
          <p className={styles.hint}>{t('min_days_sentence', { count: item.minDays })}</p>
        ) : null}
      </div>

      {showQuantity ? (
        <div className={styles.quantityRow}>
          <span className={styles.label} id="rental-qty-label">{t('quantity')}</span>
          <div className={styles.stepper} role="group" aria-labelledby="rental-qty-label">
            <button type="button" className={styles.stepButton} aria-label={t('decrease_quantity')} disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
            <output className={styles.stepValue} aria-live="polite">{quantity}</output>
            <button type="button" className={styles.stepButton} aria-label={t('increase_quantity')} disabled={quantity >= maxQuantity} onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}>+</button>
          </div>
        </div>
      ) : null}

      {priced ? (
        <dl className={styles.summary}>
          <div className={styles.summaryRow}>
            <dt>{t('rental_summary_line', { days: priced.days, unit: priced.days === 1 ? t('day') : t('days') })}{quantity > 1 ? ` × ${quantity}` : ''}</dt>
            <dd>{money(priced.rental, quoteCurrency)}</dd>
          </div>
          {showDeposit && priced.deposit > 0 ? (
            <div className={styles.summaryRow}>
              <dt>{t('deposit_label')}</dt>
              <dd>{money(priced.deposit, quoteCurrency)}</dd>
            </div>
          ) : null}
          <div className={styles.summaryTotal}>
            <dt>{t('total')}</dt>
            <dd>
              <p {...parts?.quote} className={partClass(styles.totalValue, parts?.quote)}>{money(priced.total, quoteCurrency)}</p>
            </dd>
          </div>
        </dl>
      ) : null}
      {priced && showDeposit && orderDeposit > 0 ? (
        <p className={styles.hint}>{t('order_deposit_note', { amount: money(orderDeposit, quoteCurrency) })}</p>
      ) : null}

      {quoteLoading ? <LoadingDots label={t('checking_availability')} /> : null}
      {quote && !quote.ok && !onNotification ? <p className={styles.notice} data-tone="error" role="alert">{quote.message}</p> : null}
      {busy ? <LoadingDots label={t('adding_to_cart')} /> : null}
      {message && !onNotification ? <p className={styles.notice} data-tone={message.tone} role="status">{message.text}</p> : null}

      <button {...parts?.button} className={partClass(styles.action, parts?.button)} type="submit" disabled={busy || !ready} aria-busy={busy}>
        <span className={styles.buttonContent}>
          {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
          <span>{effectiveButtonLabel}</span>
        </span>
      </button>
    </form>
  );
}
