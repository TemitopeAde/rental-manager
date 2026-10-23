import { useCallback, useEffect, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { httpClient } from '@wix/essentials';
import { authentication } from '@wix/site-members';
import { window as siteWindow } from '@wix/site-window';
import { endpoint, post } from './client';
import { addDays, isoDate, money, shortDate } from './format';
import { RentalCalendar } from './RentalCalendar';
import styles from './my-rentals.module.css';

type Status = 'pending' | 'confirmed' | 'active' | 'overdue' | 'returned' | 'cancelled';

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
  changeRequest?: { type: 'dates' | 'cancel'; startDate: string; endDate: string; quote: Quote; status: 'pending' | 'declined' };
}

const statusLabel: Record<Status, string> = {
  pending: 'Awaiting approval',
  confirmed: 'Confirmed',
  active: 'Picked up',
  overdue: 'Overdue',
  returned: 'Returned',
  cancelled: 'Cancelled',
};

const changeable: Status[] = ['pending', 'confirmed'];

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

function toDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function dateRange(start: string, end: string): string {
  return `${shortDate(toDate(start))} → ${shortDate(toDate(end))}`;
}

type Phase = 'loading' | 'signed-out' | 'ready' | 'preview' | 'error';

async function loadBookings(): Promise<{ phase: Phase; bookings: RenterBooking[]; currency?: string; message?: string }> {
  try {
    const response = await httpClient.fetchWithAuth(endpoint('/api/rentals/my-bookings'));
    if (response.status === 401) {
      const mode = await siteWindow.viewMode().catch(() => 'Site');
      return mode === 'Site' ? { phase: 'signed-out', bookings: [] } : { phase: 'preview', bookings: samples, currency: 'USD' };
    }
    const body = (await response.json()) as { bookings?: RenterBooking[]; currency?: string; message?: string };
    if (!response.ok) return { phase: 'error', bookings: [], message: body.message };
    return { phase: 'ready', bookings: body.bookings ?? [], currency: body.currency };
  } catch {
    return { phase: 'preview', bookings: samples, currency: 'USD' };
  }
}

export function MyRentals({
  title = 'My rentals',
  description = '',
  loginLabel = 'Log in',
  emptyText = "You don't have any rentals yet.",
  showPast = true,
}: {
  title?: string;
  description?: string;
  loginLabel?: string;
  emptyText?: string;
  showPast?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [bookings, setBookings] = useState<RenterBooking[]>([]);
  const [currency, setCurrency] = useState<string | undefined>();
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const result = await loadBookings();
    setPhase(result.phase);
    setBookings(result.bookings);
    setCurrency(result.currency);
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
  const isUpcoming = (booking: RenterBooking) =>
    booking.endDate >= today && booking.status !== 'cancelled' && booking.status !== 'returned';
  const upcoming = bookings.filter(isUpcoming).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = bookings.filter((booking) => !isUpcoming(booking));

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        {title ? <h2 className={styles.heading}>{title}</h2> : null}
        {description ? <p className={styles.lede}>{description}</p> : null}
      </header>

      {phase === 'loading' ? <p className={styles.muted}>Loading your rentals…</p> : null}

      {phase === 'signed-out' ? (
        <div className={styles.empty}>
          <p>Log in with the email you used at checkout to see and manage your rentals.</p>
          <button type="button" className={styles.action} onClick={login}>{loginLabel}</button>
        </div>
      ) : null}

      {phase === 'error' ? <p className={styles.notice} data-tone="error" role="alert">{error || 'Could not load your rentals.'}</p> : null}

      {phase === 'ready' || phase === 'preview' ? (
        bookings.length === 0 ? (
          <p className={styles.empty}>{emptyText}</p>
        ) : (
          <>
            {upcoming.length > 0 ? (
              <div className={styles.group}>
                <h3 className={styles.groupTitle}>Upcoming</h3>
                {upcoming.map((booking) => (
                  <BookingCard key={booking._id} booking={booking} currency={currency} preview={phase === 'preview'} onChanged={refresh} />
                ))}
              </div>
            ) : null}
            {showPast && past.length > 0 ? (
              <div className={styles.group}>
                <h3 className={styles.groupTitle}>Past</h3>
                {past.map((booking) => (
                  <BookingCard key={booking._id} booking={booking} currency={currency} preview={phase === 'preview'} onChanged={refresh} />
                ))}
              </div>
            ) : null}
          </>
        )
      ) : null}
    </section>
  );
}

function BookingCard({
  booking,
  currency,
  preview,
  onChanged,
}: {
  booking: RenterBooking;
  currency?: string;
  preview: boolean;
  onChanged: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'view' | 'cancel' | 'change'>('view');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const canChange = changeable.includes(booking.status);
  const request = booking.changeRequest;

  async function run(payload: Record<string, unknown>) {
    if (preview) {
      setMessage({ tone: 'error', text: 'This is a preview. Publish the site to manage real bookings.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await post<{ message?: string }>('/api/rentals/my-bookings', { reference: booking.reference, ...payload });
      setMessage({ tone: 'success', text: result.message || 'Done.' });
      setMode('view');
      await onChanged();
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Something went wrong.' });
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
          <dt>Dates</dt>
          <dd>{dateRange(booking.startDate, booking.endDate)}</dd>
        </div>
        <div>
          <dt>Quantity</dt>
          <dd>{booking.quantity}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{money(booking.quote.total, currency)}</dd>
        </div>
        {booking.quote.deposit > 0 ? (
          <div>
            <dt>Deposit</dt>
            <dd>{money(booking.quote.deposit, currency)}</dd>
          </div>
        ) : null}
      </dl>

      {request?.status === 'pending' ? (
        <p className={styles.notice} data-tone="info">
          {request.type === 'cancel'
            ? 'You asked to cancel this rental. Waiting for the shop to confirm.'
            : `You asked to move this rental to ${dateRange(request.startDate, request.endDate)}. Waiting for the shop to confirm.`}
        </p>
      ) : null}
      {request?.status === 'declined' ? (
        <p className={styles.notice} data-tone="error">
          {request.type === 'cancel'
            ? "The shop couldn't cancel this rental, so it stays booked."
            : `The shop couldn't move this rental to ${dateRange(request.startDate, request.endDate)}.`}
        </p>
      ) : null}
      {booking.status === 'cancelled' && booking.refundNeeded ? (
        <p className={styles.muted}>The shop will refund your payment.</p>
      ) : null}

      {message ? <p className={styles.notice} data-tone={message.tone} role="status">{message.text}</p> : null}

      {canChange && mode === 'view' && request?.status !== 'pending' ? (
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => { setMessage(null); setMode('change'); }}>Change dates</button>
          <button type="button" className={styles.danger} onClick={() => { setMessage(null); setMode('cancel'); }}>Cancel rental</button>
        </div>
      ) : null}

      {mode === 'cancel' ? (
        <div className={styles.confirm}>
          <p>Ask the shop to cancel {booking.itemName} for {dateRange(booking.startDate, booking.endDate)}? Your rental stays booked until the shop confirms.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => setMode('view')}>Keep rental</button>
            <button type="button" className={styles.dangerSolid} disabled={busy} onClick={() => void run({ action: 'cancel' })}>
              {busy ? 'Sending…' : 'Request cancellation'}
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'change' ? (
        <ChangeDates booking={booking} currency={currency} preview={preview} busy={busy} onCancel={() => setMode('view')} onSubmit={(startDate, endDate) => void run({ action: 'change', startDate, endDate })} />
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
}: {
  booking: RenterBooking;
  currency?: string;
  preview: boolean;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (startDate: string, endDate: string) => void;
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
      <p className={styles.muted}>Pick your new pickup and return dates. The shop confirms every change.</p>
      <div className={styles.calendarCard}>
        <RentalCalendar range={range} onChange={setRange} firstAvailable={new Date()} />
      </div>
      {startDate && endDate ? <p className={styles.newDates}>New dates: {dateRange(startDate, endDate)}</p> : null}
      {quote?.ok && quote.quote ? (
        <p className={styles.muted}>
          New total {money(quote.quote.total, currency)}
          {difference > 0 ? ` (${money(difference, currency)} more)` : difference < 0 ? ` (${money(-difference, currency)} less)` : ' (no change)'}
        </p>
      ) : null}
      {quote && !quote.ok ? <p className={styles.notice} data-tone="error" role="alert">{quote.message}</p> : null}
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} disabled={busy} onClick={onCancel}>Back</button>
        <button
          type="button"
          className={styles.action}
          disabled={busy || !startDate || !endDate || (!preview && !quote?.ok)}
          onClick={() => onSubmit(startDate, endDate)}
        >
          {busy ? 'Sending…' : 'Request new dates'}
        </button>
      </div>
    </div>
  );
}
