import { useCallback, useEffect, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { httpClient } from '@wix/essentials';
import { authentication } from '@wix/site-members';
import { window as siteWindow } from '@wix/site-window';
import { endpoint, post } from './client';
import { addDays, isoDate } from './format';
import { useSiteI18n } from './i18n';
import { RentalCalendar } from './RentalCalendar';
import styles from './my-rentals.module.css';

type Status = 'pending' | 'confirmed' | 'active' | 'overdue' | 'returned' | 'cancelled' | 'lost';

interface Quote {
  days: number;
  rental: number;
  deposit: number;
  total: number;
}

interface RenterBooking {
  _id: string;
  reference: string;
  itemName: string;
  quantity: number;
  startDate: string;
  endDate: string;
  status: Status;
  quote: Quote;
  refundNeeded: boolean;
  changeRequest?: { type: 'dates' | 'cancel' | 'extend'; startDate: string; endDate: string; quote: Quote; status: 'pending' | 'declined' };
  lateReturn?: { lateDays: number; fee: number; final: boolean };
}

const statusLabel: Record<Status, string> = {
  pending: 'Awaiting approval',
  confirmed: 'Confirmed',
  active: 'Picked up',
  overdue: 'Overdue',
  returned: 'Returned',
  cancelled: 'Cancelled',
  lost: 'Not returned',
};

const changeable: Status[] = ['pending', 'confirmed'];
// Out on rent, late or not: the renter can ask to keep it longer.
const extendable: Status[] = ['active', 'overdue'];

// Shown in the Editor, where no member is logged in, so the layout can be designed.
const samples: RenterBooking[] = [
  {
    _id: 'sample-1',
    reference: 'RB-10482',
    itemName: 'Camera kit',
    quantity: 1,
    startDate: isoDate(addDays(new Date(), 6)),
    endDate: isoDate(addDays(new Date(), 9)),
    status: 'confirmed',
    quote: { days: 3, rental: 135, deposit: 150, total: 285 },
    refundNeeded: false,
  },
  {
    _id: 'sample-2',
    reference: 'RB-10311',
    itemName: 'Camping tent',
    quantity: 2,
    startDate: isoDate(addDays(new Date(), -20)),
    endDate: isoDate(addDays(new Date(), -17)),
    status: 'returned',
    quote: { days: 3, rental: 108, deposit: 80, total: 188 },
    refundNeeded: false,
  },
];

type Phase = 'loading' | 'signed-out' | 'ready' | 'preview' | 'error';

async function loadBookings(): Promise<{ phase: Phase; bookings: RenterBooking[]; currency?: string; language?: string; message?: string }> {
  try {
    const response = await httpClient.fetchWithAuth(endpoint('/api/rentals/my-bookings'));
    if (response.status === 401) {
      const mode = await siteWindow.viewMode().catch(() => 'Site');
      return mode === 'Site' ? { phase: 'signed-out', bookings: [] } : { phase: 'preview', bookings: samples, currency: 'USD' };
    }
    const body = (await response.json()) as { bookings?: RenterBooking[]; currency?: string; language?: string; message?: string };
    if (!response.ok) return { phase: 'error', bookings: [], message: body.message };
    return { phase: 'ready', bookings: body.bookings ?? [], currency: body.currency, language: body.language };
  } catch {
    return { phase: 'preview', bookings: samples, currency: 'USD' };
  }
}

export function MyRentals({
  title,
  description = '',
  loginLabel,
  emptyText,
  showPast = true,
  language,
}: {
  title?: string;
  description?: string;
  loginLabel?: string;
  emptyText?: string;
  showPast?: boolean;
  language?: string;
}) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [bookings, setBookings] = useState<RenterBooking[]>([]);
  const [currency, setCurrency] = useState<string | undefined>();
  const [apiLanguage, setApiLanguage] = useState<string | undefined>();
  const [error, setError] = useState('');

  const { t, isRtl, money, dateRange, dateLocale, shortDate } = useSiteI18n(language || apiLanguage);

  const refresh = useCallback(async () => {
    const result = await loadBookings();
    setPhase(result.phase);
    setBookings(result.bookings);
    setCurrency(result.currency);
    if (result.language) setApiLanguage(result.language);
    setError(result.message ?? '');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function login() {
    authentication
      .promptLogin({ mode: 'login' })
      .then(() => {
        setPhase('loading');
        return refresh();
      })
      .catch(() => undefined);
  }

  const today = isoDate(new Date());
  // A rental that is still out stays at the top even once its return date has passed.
  const isUpcoming = (booking: RenterBooking) =>
    extendable.includes(booking.status) ||
    (booking.endDate >= today && booking.status !== 'cancelled' && booking.status !== 'returned' && booking.status !== 'lost');
  const upcoming = bookings.filter(isUpcoming).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = bookings.filter((booking) => !isUpcoming(booking));

  const isDefaultTitle = !title || title === 'My rentals';
  const effectiveTitle = isDefaultTitle ? t('my_rentals_title') : title;
  const isDefaultLogin = !loginLabel || loginLabel === 'Log in';
  const effectiveLoginLabel = isDefaultLogin ? t('login') : loginLabel;
  const isDefaultEmpty = !emptyText || emptyText === "You don't have any rentals yet.";
  const effectiveEmptyText = isDefaultEmpty ? t('empty_rentals') : emptyText;

  return (
    <section className={styles.root} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className={styles.header}>
        {effectiveTitle ? <h2 className={styles.heading}>{effectiveTitle}</h2> : null}
        {description ? <p className={styles.lede}>{description}</p> : null}
      </header>

      {phase === 'loading' ? <BookingsSkeleton ariaLabel={t('loading_your_rentals')} /> : null}

      {phase === 'signed-out' ? (
        <div className={styles.empty}>
          <p>{t('login_prompt')}</p>
          <button type="button" className={styles.action} onClick={login}>{effectiveLoginLabel}</button>
        </div>
      ) : null}

      {phase === 'error' ? <p className={styles.notice} data-tone="error" role="alert">{error || t('could_not_load_rentals')}</p> : null}

      {phase === 'ready' || phase === 'preview' ? (
        bookings.length === 0 ? (
          <p className={styles.empty}>{effectiveEmptyText}</p>
        ) : (
          <>
            {upcoming.length > 0 ? (
              <div className={styles.group}>
                <h3 className={styles.groupTitle}>{t('upcoming')}</h3>
                {upcoming.map((booking) => (
                  <BookingCard
                    key={booking._id}
                    booking={booking}
                    currency={currency}
                    preview={phase === 'preview'}
                    onChanged={refresh}
                    t={t}
                    money={money}
                    dateRange={dateRange}
                    shortDate={shortDate}
                    dateLocale={dateLocale}
                    isRtl={isRtl}
                  />
                ))}
              </div>
            ) : null}
            {showPast && past.length > 0 ? (
              <div className={styles.group}>
                <h3 className={styles.groupTitle}>{t('past')}</h3>
                {past.map((booking) => (
                  <BookingCard
                    key={booking._id}
                    booking={booking}
                    currency={currency}
                    preview={phase === 'preview'}
                    onChanged={refresh}
                    t={t}
                    money={money}
                    dateRange={dateRange}
                    shortDate={shortDate}
                    dateLocale={dateLocale}
                    isRtl={isRtl}
                  />
                ))}
              </div>
            ) : null}
          </>
        )
      ) : null}
    </section>
  );
}

// Placeholder cards shaped like BookingCard, shown while the bookings load.
function BookingsSkeleton({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div className={styles.group} role="status" aria-busy="true" aria-label={ariaLabel}>
      <div className={styles.skeleton} data-shape="label" />
      {[0, 1].map((index) => (
        <div key={index} className={styles.card} aria-hidden="true">
          <div className={styles.cardTop}>
            <div className={styles.cardTitle}>
              <div className={styles.skeleton} data-shape="title" />
              <div className={styles.skeleton} data-shape="reference" />
            </div>
            <div className={styles.skeleton} data-shape="pill" />
          </div>
          <div className={styles.facts}>
            {[0, 1, 2, 3].map((fact) => (
              <div key={fact}>
                <div className={styles.skeleton} data-shape="term" />
                <div className={styles.skeleton} data-shape="value" />
              </div>
            ))}
          </div>
          <div className={styles.actions}>
            <div className={styles.skeleton} data-shape="button" />
            <div className={styles.skeleton} data-shape="button" />
          </div>
        </div>
      ))}
    </div>
  );
}

function BookingCard({
  booking,
  currency,
  preview,
  onChanged,
  t,
  money,
  dateRange,
  shortDate,
  dateLocale,
  isRtl,
}: {
  booking: RenterBooking;
  currency?: string;
  preview: boolean;
  onChanged: () => Promise<void>;
  t: (key: any, params?: any) => string;
  money: (amount: number, currency?: string) => string;
  dateRange: (start: string, end: string) => string;
  shortDate: (date: Date | undefined) => string;
  dateLocale: any;
  isRtl: boolean;
}) {
  const [mode, setMode] = useState<'view' | 'cancel' | 'change' | 'extend'>('view');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const shortDay = (day: string) => shortDate(new Date(`${day}T00:00:00`));
  const canChange = changeable.includes(booking.status);
  const canExtend = extendable.includes(booking.status);
  const request = booking.changeRequest;

  const statusLabel: Record<Status, string> = {
    pending: t('status_pending'),
    confirmed: t('status_confirmed'),
    active: t('status_active'),
    overdue: t('status_overdue'),
    returned: t('status_returned'),
    cancelled: t('status_cancelled'),
    lost: t('status_lost'),
  };

  async function run(payload: Record<string, unknown>) {
    if (preview) {
      setMessage({ tone: 'error', text: t('preview_manage_notice') });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await post<{ message?: string }>('/api/rentals/my-bookings', { reference: booking.reference, ...payload });
      setMessage({ tone: 'success', text: result.message || t('done') });
      setMode('view');
      await onChanged();
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : t('something_went_wrong') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.cardTitle}>
          <span className={styles.itemName}>{booking.itemName}</span>
          <span className={styles.reference}>{booking.reference}</span>
        </div>
        <span className={styles.status} data-status={booking.status}>{statusLabel[booking.status] ?? booking.status}</span>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>{t('dates_label')}</dt>
          <dd>{dateRange(booking.startDate, booking.endDate)}</dd>
        </div>
        <div>
          <dt>{t('quantity_label')}</dt>
          <dd>{booking.quantity}</dd>
        </div>
        <div>
          <dt>{t('total_label')}</dt>
          <dd>{money(booking.quote.total, currency)}</dd>
        </div>
        {booking.quote.deposit > 0 ? (
          <div>
            <dt>{t('deposit_label')}</dt>
            <dd>{money(booking.quote.deposit, currency)}</dd>
          </div>
        ) : null}
      </dl>

      {booking.status === 'overdue' ? (
        <p className={styles.notice} data-tone="error" role="status">
          {t('overdue_notice', { date: shortDay(booking.endDate) })}
          {booking.lateReturn?.fee ? ` ${t('late_fee_so_far', { amount: money(booking.lateReturn.fee, currency) })}` : ''}
        </p>
      ) : null}
      {booking.status === 'returned' && booking.lateReturn?.fee ? (
        <p className={styles.muted}>{t('late_fee_final', { amount: money(booking.lateReturn.fee, currency) })}</p>
      ) : null}
      {request?.status === 'pending' ? (
        <p className={styles.notice} data-tone="info">
          {request.type === 'cancel'
            ? t('request_cancel_pending')
            : request.type === 'extend'
              ? t('request_extend_pending', { date: shortDay(request.endDate) })
              : t('request_change_pending', { range: dateRange(request.startDate, request.endDate) })}
        </p>
      ) : null}
      {request?.status === 'declined' ? (
        <p className={styles.notice} data-tone="error">
          {request.type === 'cancel'
            ? t('request_cancel_declined')
            : request.type === 'extend'
              ? t('request_extend_declined', { date: shortDay(request.endDate) })
              : t('request_change_declined', { range: dateRange(request.startDate, request.endDate) })}
        </p>
      ) : null}
      {booking.status === 'cancelled' && booking.refundNeeded ? (
        <p className={styles.muted}>{t('refund_pending')}</p>
      ) : null}

      {message ? <p className={styles.notice} data-tone={message.tone} role="status">{message.text}</p> : null}

      {canChange && mode === 'view' && request?.status !== 'pending' ? (
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => { setMessage(null); setMode('change'); }}>{t('change_dates')}</button>
          <button type="button" className={styles.danger} onClick={() => { setMessage(null); setMode('cancel'); }}>{t('cancel_rental')}</button>
        </div>
      ) : null}

      {canExtend && mode === 'view' && request?.status !== 'pending' ? (
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => { setMessage(null); setMode('extend'); }}>{t('extend_rental')}</button>
        </div>
      ) : null}

      {mode === 'extend' ? (
        <ExtendRental
          booking={booking}
          currency={currency}
          preview={preview}
          busy={busy}
          today={isoDate(new Date())}
          onCancel={() => setMode('view')}
          onSubmit={(endDate) => void run({ action: 'extend', endDate })}
          t={t}
          money={money}
          shortDay={shortDay}
        />
      ) : null}

      {mode === 'cancel' ? (
        <div className={styles.confirm}>
          <p>{t('cancel_confirm', { name: booking.itemName, range: dateRange(booking.startDate, booking.endDate) })}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => setMode('view')}>{t('keep_rental')}</button>
            <button type="button" className={styles.dangerSolid} disabled={busy} aria-busy={busy} onClick={() => void run({ action: 'cancel' })}>
              <span className={styles.buttonContent}>
                {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
                <span>{t('request_cancellation')}</span>
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'change' ? (
        <ChangeDates
          booking={booking}
          currency={currency}
          preview={preview}
          busy={busy}
          onCancel={() => setMode('view')}
          onSubmit={(startDate, endDate) => void run({ action: 'change', startDate, endDate })}
          t={t}
          money={money}
          dateRange={dateRange}
          dateLocale={dateLocale}
          isRtl={isRtl}
        />
      ) : null}
    </article>
  );
}

function ChangeDates({
  booking,
  currency,
  preview,
  busy,
  onCancel,
  onSubmit,
  t,
  money,
  dateRange,
  dateLocale,
  isRtl,
}: {
  booking: RenterBooking;
  currency?: string;
  preview: boolean;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (startDate: string, endDate: string) => void;
  t: (key: any, params?: any) => string;
  money: (amount: number, currency?: string) => string;
  dateRange: (start: string, end: string) => string;
  dateLocale: any;
  isRtl: boolean;
}) {
  const [range, setRange] = useState<DateRange | undefined>();
  const [quote, setQuote] = useState<{ ok: boolean; message?: string; quote?: Quote; difference?: number } | null>(null);
  const startDate = range?.from ? isoDate(range.from) : '';
  const endDate = range?.to ? isoDate(range.to) : '';

  useEffect(() => {
    setQuote(null);
    if (!startDate || !endDate || preview) return;
    const timer = setTimeout(() => {
      post<{ ok: boolean; quote: Quote; difference: number }>('/api/rentals/my-bookings', {
        action: 'quote-change',
        reference: booking.reference,
        startDate,
        endDate,
      })
        .then(setQuote)
        .catch((error: Error) => setQuote({ ok: false, message: error.message }));
    }, 300);
    return () => clearTimeout(timer);
  }, [booking.reference, startDate, endDate, preview]);

  const difference = quote?.ok ? quote.difference ?? 0 : 0;

  return (
    <div className={styles.change}>
      <p className={styles.muted}>{t('change_prompt')}</p>
      <div className={styles.calendarCard}>
        <RentalCalendar
          range={range}
          onChange={setRange}
          firstAvailable={new Date()}
          locale={dateLocale}
          dir={isRtl ? 'rtl' : 'ltr'}
        />
      </div>
      {startDate && endDate ? <p className={styles.newDates}>{t('new_dates_label', { range: dateRange(startDate, endDate) })}</p> : null}
      {quote?.ok && quote.quote ? (
        <p className={styles.muted}>
          {t('new_total_label', { total: money(quote.quote.total, currency) })}
          {difference > 0 ? ` ${t('more', { amount: money(difference, currency) })}` : difference < 0 ? ` ${t('less', { amount: money(-difference, currency) })}` : ` ${t('no_change')}`}
        </p>
      ) : null}
      {quote && !quote.ok ? <p className={styles.notice} data-tone="error" role="alert">{quote.message}</p> : null}
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} disabled={busy} onClick={onCancel}>{t('back_action')}</button>
        <button
          type="button"
          className={styles.action}
          disabled={busy || !startDate || !endDate || (!preview && !quote?.ok)}
          aria-busy={busy}
          onClick={() => onSubmit(startDate, endDate)}
        >
          <span className={styles.buttonContent}>
            {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
            <span>{t('request_new_dates')}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

function ExtendRental({
  booking,
  currency,
  preview,
  busy,
  today,
  onCancel,
  onSubmit,
  t,
  money,
  shortDay,
}: {
  booking: RenterBooking;
  currency?: string;
  preview: boolean;
  busy: boolean;
  today: string;
  onCancel: () => void;
  onSubmit: (endDate: string) => void;
  t: (key: any, params?: any) => string;
  money: (amount: number, currency?: string) => string;
  shortDay: (day: string) => string;
}) {
  const earliest = booking.endDate >= today ? isoDate(addDays(new Date(`${booking.endDate}T00:00:00`), 1)) : today;
  const [endDate, setEndDate] = useState('');
  const [quote, setQuote] = useState<{ ok: boolean; message?: string; quote?: Quote; difference?: number } | null>(null);

  useEffect(() => {
    setQuote(null);
    if (!endDate || preview) return;
    const timer = setTimeout(() => {
      post<{ ok: boolean; quote: Quote; difference: number }>('/api/rentals/my-bookings', {
        action: 'quote-extend',
        reference: booking.reference,
        endDate,
      })
        .then(setQuote)
        .catch((error: Error) => setQuote({ ok: false, message: error.message }));
    }, 300);
    return () => clearTimeout(timer);
  }, [booking.reference, endDate, preview]);

  const difference = quote?.ok ? quote.difference ?? 0 : 0;

  return (
    <div className={styles.change}>
      <p className={styles.muted}>{t('extend_prompt')}</p>
      <label className={styles.dateField}>
        <span>{t('new_return_date')}</span>
        <input
          type="date"
          className={styles.dateInput}
          min={earliest}
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />
      </label>
      {endDate && quote?.ok && quote.quote ? (
        <p className={styles.muted}>
          {t('extend_until', { date: shortDay(endDate) })} · {t('new_total_label', { total: money(quote.quote.total, currency) })}
          {difference > 0 ? ` ${t('more', { amount: money(difference, currency) })}` : ` ${t('no_change')}`}
        </p>
      ) : null}
      {quote && !quote.ok ? <p className={styles.notice} data-tone="error" role="alert">{quote.message}</p> : null}
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} disabled={busy} onClick={onCancel}>{t('back_action')}</button>
        <button
          type="button"
          className={styles.action}
          disabled={busy || !endDate || (!preview && !quote?.ok)}
          aria-busy={busy}
          onClick={() => onSubmit(endDate)}
        >
          <span className={styles.buttonContent}>
            {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
            <span>{t('request_extension')}</span>
          </span>
        </button>
      </div>
    </div>
  );
}
