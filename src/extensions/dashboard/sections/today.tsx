import { useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CalendarClock, CalendarX2, Hourglass, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/dashboard/client';
import { requestDashboardData } from '@/dashboard/data-cache';
import { useI18n } from '@/i18n';
import { BookingActionButton, BookingSheet, useBookingActions } from './bookings';
import { SetupChecklist } from './setup-checklist';
import {
  ErrorState,
  isoDay,
  LoadingState,
  RefreshNotice,
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
  /** Upcoming rentals an overdue item may hold up, with the overdue references holding it. */
  atRisk?: Array<{ booking: BookingRow; blockedBy: string[] }>;
}

export function TodaySection({ onNavigate }: { onNavigate: (id: 'bookings' | 'calendar' | 'items' | 'settings' | 'guide') => void }) {
  const { itemName, money } = useDashboard();
  const { t, formatDay, formatRange } = useI18n();
  const { data, error, refresh, refreshError } = useResource('/api/rentals/today-board', async () => {
    const [board, all] = await Promise.all([
      requestDashboardData('/api/rentals/today', () => api<TodayBoard>('/api/rentals/today')),
      requestDashboardData('/api/rentals/bookings', () => api<{ bookings: BookingRow[] }>('/api/rentals/bookings')),
    ]);
    return { board, bookings: all.bookings };
  });
  const { act, busy } = useBookingActions(refresh);
  const [openId, setOpenId] = useState<string | null>(null);

  if (error && !data) return <ErrorState title={t('today.error_title')} message={error} onRetry={() => void refresh()} />;
  if (!data) return <LoadingState />;

  const { board, bookings } = data;
  const pending = bookings.filter((row) => row.status === 'pending');
  const weekAhead = isoDay(new Date(Date.now() + 7 * 86400000));
  const upcoming = bookings
    .filter((row) => row.status === 'confirmed' && row.startDate > board.date && row.startDate <= weekAhead)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const atRisk = board.atRisk ?? [];
  const selected = [...bookings, ...board.overdue, ...atRisk.map((risk) => risk.booking)].find((row) => row._id === openId) ?? null;

  // "3 days late · $60 late fee · may be lost", for overdue rows.
  const lateDetail = (booking: BookingRow) => {
    const late = booking.lateReturn;
    if (!late || booking.status !== 'overdue') return '';
    const parts = [late.lateDays === 1 ? t('today.late_one_day') : t('today.late_days', { count: late.lateDays })];
    if (late.fee > 0) parts.push(t('today.late_fee', { amount: money(late.fee) }));
    if (late.lostFlaggedAt) parts.push(t('today.may_be_lost'));
    return parts.join(' · ');
  };

  const row = (booking: BookingRow) => {
    const detail = lateDetail(booking);
    const next = nextAction(booking.status, t);
    return (
      <li key={booking._id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
        <button type="button" className="flex min-w-0 flex-col text-left hover:underline" onClick={() => setOpenId(booking._id)}>
          <span className="truncate font-medium">{booking.renter.name || booking.reference}</span>
          <span className="truncate text-xs text-muted-foreground">
            {itemName(booking.itemId)}{booking.quantity > 1 ? ` × ${booking.quantity}` : ''} · {booking.reference}
          </span>
          {detail ? <span className="truncate text-xs font-medium text-red-700 dark:text-red-300">{detail}</span> : null}
        </button>
        {next ? (
          next.action === 'approve' ? (
            <BookingActionButton
              reference={booking.reference}
              action={next.action}
              label={next.label}
              title={t('today.approve_dialog_title')}
              description={t('today.approve_dialog_desc')}
              act={act}
              busy={busy}
              variant="outline"
              size="sm"
            />
          ) : (
            <Button size="sm" variant="outline" loading={busy === `${booking.reference}:${next.action}`} disabled={busy !== null} onClick={() => void act(booking.reference, next.action)}>
              {next.label}
            </Button>
          )
        ) : <StatusBadge status={booking.status} />}
      </li>
    );
  };

  const lists = [
    { title: t('today.pickups_title'), description: t('today.pickups_desc'), icon: ArrowUpFromLine, rows: board.pickups, empty: t('today.pickups_empty') },
    { title: t('today.returns_title'), description: t('today.returns_desc'), icon: ArrowDownToLine, rows: board.returns, empty: t('today.returns_empty') },
  ];

  return (
    <div className="flex flex-col gap-5">
      {refreshError ? <RefreshNotice onRetry={() => void refresh()} /> : null}
      <SetupChecklist onNavigate={onNavigate} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('today.stat_pickups')} value={board.pickups.length} icon={ArrowUpFromLine} />
        <StatCard label={t('today.stat_returns')} value={board.returns.length} icon={ArrowDownToLine} tone="success" />
        <StatCard
          label={t('today.stat_overdue')}
          value={board.overdue.length}
          icon={AlertTriangle}
          tone={board.overdue.length ? 'danger' : 'default'}
          hint={board.overdue.length ? t('today.hint_overdue_positive') : t('today.hint_overdue_zero')}
        />
        <StatCard
          label={t('today.stat_pending')}
          value={pending.length}
          icon={Hourglass}
          tone={pending.length ? 'warning' : 'default'}
          onClick={() => onNavigate('bookings')}
          hint={t('today.hint_open_bookings')}
        />
      </div>

      {board.overdue.length > 0 ? (
        <Card className="border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-300">
              <AlertTriangle className="size-4" />{t('today.overdue_title')}
            </CardTitle>
            <CardDescription>{t('today.overdue_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-red-200/70 dark:divide-red-500/20">
              {board.overdue.map((booking) => row(booking))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {atRisk.length > 0 ? (
        <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <CalendarX2 className="size-4" />{t('today.at_risk_title')}
            </CardTitle>
            <CardDescription>{t('today.at_risk_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-amber-200/70 dark:divide-amber-500/20">
              {atRisk.map(({ booking, blockedBy }) => (
                <li key={booking._id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <button type="button" className="flex min-w-0 flex-col text-left hover:underline" onClick={() => setOpenId(booking._id)}>
                    <span className="truncate font-medium">{booking.renter.name || booking.reference}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t('today.at_risk_line', {
                        item: itemName(booking.itemId),
                        date: formatDay(booking.startDate, { weekday: 'short', month: 'short', day: 'numeric' }),
                        references: blockedBy.join(', '),
                      })}
                    </span>
                  </button>
                  {booking.notices?.includes('delay-warned') ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <MailCheck className="size-3.5" />{t('today.at_risk_warned')}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busy === `${booking.reference}:warn-delay`}
                      disabled={busy !== null || !booking.renter.email}
                      onClick={() => void act(booking.reference, 'warn-delay')}
                    >
                      {t('today.at_risk_warn')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {lists.map((list) => (
          <Card key={list.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <list.icon className="size-4 text-muted-foreground" />{list.title}
              </CardTitle>
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
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-muted-foreground" />{t('today.next_7_days')}
          </CardTitle>
          <CardDescription>{t('today.next_7_days_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="rounded-lg bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">{t('today.next_7_days_empty')}</p>
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
            <Button variant="link" className="mt-2 px-0" onClick={() => onNavigate('calendar')}>{t('action.open_calendar')}</Button>
          ) : null}
        </CardContent>
      </Card>

      <BookingSheet key={selected?._id} booking={selected} onClose={() => setOpenId(null)} act={act} busy={busy} onChanged={refresh} />
    </div>
  );
}
