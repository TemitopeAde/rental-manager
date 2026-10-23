import { useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CalendarClock, Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/dashboard/client';
import { BookingSheet, useBookingActions } from './bookings';
import {
  ErrorState,
  formatDay,
  formatRange,
  isoDay,
  LoadingState,
  nextAction,
  StatCard,
  StatusBadge,
  useDashboard,
  useResource,
  type BookingRow,
} from './shared';

interface TodayBoard {
  date: string;
  pickups: BookingRow[];
  returns: BookingRow[];
  overdue: BookingRow[];
}

export function TodaySection({ onNavigate }: { onNavigate: (id: 'bookings' | 'calendar') => void }) {
  const { itemName } = useDashboard();
  const { data, error, refresh } = useResource(async () => {
    const [board, all] = await Promise.all([
      api<TodayBoard>('/api/rentals/today'),
      api<{ bookings: BookingRow[] }>('/api/rentals/bookings'),
    ]);
    return { board, bookings: all.bookings };
  });
  const { act, busy } = useBookingActions(refresh);
  const [openId, setOpenId] = useState<string | null>(null);

  if (error) return <ErrorState title="Could not load today" message={error} onRetry={() => void refresh()} />;
  if (!data) return <LoadingState />;

  const { board, bookings } = data;
  const pending = bookings.filter((row) => row.status === 'pending');
  const weekAhead = isoDay(new Date(Date.now() + 7 * 86400000));
  const upcoming = bookings
    .filter((row) => row.status === 'confirmed' && row.startDate > board.date && row.startDate <= weekAhead)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const selected = bookings.find((row) => row._id === openId) ?? null;

  const row = (booking: BookingRow) => {
    const next = nextAction(booking.status);
    return (
      <li key={booking._id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
        <button type="button" className="flex min-w-0 flex-col text-left hover:underline" onClick={() => setOpenId(booking._id)}>
          <span className="truncate font-medium">{booking.renter.name || booking.reference}</span>
          <span className="truncate text-xs text-muted-foreground">
            {itemName(booking.itemId)}{booking.quantity > 1 ? ` × ${booking.quantity}` : ''} · {booking.reference}
          </span>
        </button>
        {next ? (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void act(booking.reference, next.action)}>
            {busy === `${booking.reference}:${next.action}` ? 'Saving…' : next.label}
          </Button>
        ) : <StatusBadge status={booking.status} />}
      </li>
    );
  };

  const lists = [
    { title: 'Going out today', description: 'Hand these over at pickup.', icon: ArrowUpFromLine, rows: board.pickups, empty: 'No pickups today.' },
    { title: 'Coming back today', description: 'Check these in when they arrive.', icon: ArrowDownToLine, rows: board.returns, empty: 'No returns today.' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pickups today" value={board.pickups.length} icon={ArrowUpFromLine} />
        <StatCard label="Returns today" value={board.returns.length} icon={ArrowDownToLine} tone="success" />
        <StatCard label="Overdue" value={board.overdue.length} icon={AlertTriangle} tone={board.overdue.length ? 'danger' : 'default'} hint={board.overdue.length ? 'Past their return time' : 'All on time'} />
        <StatCard label="Awaiting approval" value={pending.length} icon={Hourglass} tone={pending.length ? 'warning' : 'default'} onClick={() => onNavigate('bookings')} hint="Open bookings" />
      </div>

      {board.overdue.length > 0 ? (
        <Card className="border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-300"><AlertTriangle className="size-4" />Overdue rentals</CardTitle>
            <CardDescription>Contact these renters, then mark each one returned when it's back.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-red-200/70 dark:divide-red-500/20">
              {board.overdue.map((booking) => row(booking))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {lists.map((list) => (
          <Card key={list.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><list.icon className="size-4 text-muted-foreground" />{list.title}</CardTitle>
              <CardDescription>{list.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {list.rows.length === 0 ? (
                <p className="rounded-lg bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">{list.empty}</p>
              ) : (
                <ul className="divide-y">{list.rows.map((booking) => row(booking))}</ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-muted-foreground" />Next 7 days</CardTitle>
          <CardDescription>Confirmed pickups coming up.</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="rounded-lg bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">Nothing booked for the coming week.</p>
          ) : (
            <ul className="divide-y">
              {upcoming.slice(0, 8).map((booking) => (
                <li key={booking._id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-lg border py-1 leading-tight">
                    <span className="text-[0.65rem] font-medium text-muted-foreground uppercase">{formatDay(booking.startDate, { month: 'short' })}</span>
                    <span className="text-lg font-semibold">{formatDay(booking.startDate, { day: 'numeric' })}</span>
                  </div>
                  <button type="button" className="flex min-w-0 flex-1 flex-col text-left hover:underline" onClick={() => setOpenId(booking._id)}>
                    <span className="truncate font-medium">{itemName(booking.itemId)}</span>
                    <span className="truncate text-xs text-muted-foreground">{booking.renter.name || booking.reference} · {formatRange(booking.startDate, booking.endDate)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {upcoming.length > 0 ? (
            <Button variant="link" className="mt-2 px-0" onClick={() => onNavigate('calendar')}>Open the calendar</Button>
          ) : null}
        </CardContent>
      </Card>

      <BookingSheet key={selected?._id} booking={selected} onClose={() => setOpenId(null)} act={act} busy={busy} />
    </div>
  );
}
