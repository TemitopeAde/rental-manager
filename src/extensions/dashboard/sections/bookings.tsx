import { useCallback, useEffect, useRef, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { AlertTriangle, ClipboardList, ExternalLink, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, post } from '@/dashboard/client';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  canCancel,
  ConfirmButton,
  EmptyState,
  ErrorState,
  isoDay,
  LoadingState,
  nextAction,
  numberField,
  SectionHeader,
  RefreshNotice,
  statusLabel,
  statusOrder,
  StatusBadge,
  TextField,
  useDashboard,
  useResource,
  type BookingRow,
  type BookingStatus,
} from './shared';
import { useToast } from './toast';
import { RefundDialog, type RefundKind } from './refund-dialog';

type ActionResult = { ok: boolean; message?: string; refundOrderId?: string };
type BookingFilter = BookingStatus | 'all' | 'open';
type BookingCounts = { counts: Partial<Record<BookingStatus, number>>; open: number; all: number };

// Runs a booking transition, reports the outcome, then lets the caller refresh.
export function useBookingActions(onDone: () => Promise<void> | void) {
  const toast = useToast();
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(reference: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(`${reference}:${action}`);
    try {
      const result = await post<ActionResult>('/api/rentals/bookings', { reference, action, ...extra });
      if (!result.ok) {
        toast(result.message || t('bookings.toast_save_failed'), 'error');
        return false;
      }
      const messages: Record<string, string> = {
        approve: t('bookings.toast_approved', { reference }),
        decline: t('bookings.toast_declined', { reference }),
        pickup: t('bookings.toast_picked_up', { reference }),
        returned: t('bookings.toast_returned', { reference }),
        settle: t('bookings.toast_deposit_settled', { reference }),
        'change-approve': result.message || t('bookings.toast_updated', { reference }),
        'change-decline': result.message || t('bookings.toast_request_declined', { reference }),
        cancel: result.refundOrderId
          ? t('bookings.toast_cancelled_refund', { reference, orderId: result.refundOrderId })
          : t('bookings.toast_cancelled', { reference }),
      };
      toast(messages[action] ?? (result.message || t('common.saved')));
      await onDone();
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : t('bookings.toast_save_failed'), 'error');
      return false;
    } finally {
      setBusy(null);
    }
  }

  return { act, busy };
}

export function BookingActionButton({
  reference,
  action,
  label,
  title,
  description,
  act,
  busy,
  variant = 'default',
  size = 'default',
}: {
  reference: string;
  action: string;
  label: string;
  title: string;
  description: string;
  act: (reference: string, action: string, extra?: Record<string, unknown>) => Promise<boolean>;
  busy: string | null;
  variant?: 'default' | 'outline' | 'destructive';
  size?: 'default' | 'sm';
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const actionKey = `${reference}:${action}`;
  const loading = busy === actionKey;

  async function confirm() {
    if (await act(reference, action)) setOpen(false);
  }

  return (
    <>
      <Button
        size={size}
        variant={variant}
        loading={loading}
        disabled={busy !== null}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!busy) setOpen(nextOpen); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={busy !== null}>{t('common.cancel')}</Button>
            </DialogClose>
            <Button variant={variant} loading={loading} disabled={busy !== null} onClick={() => void confirm()}>
              {label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BookingsSection() {
  const { itemName, money } = useDashboard();
  const { t, formatRange } = useI18n();
  const [filter, setFilter] = useState<BookingFilter>('open');
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<BookingRow | null>(null);
  const [creating, setCreating] = useState(false);

  // The server filters each tab and counts every status, so tabs and counts stay right past one page of bookings.
  const listKey = `/api/rentals/bookings?status=${filter}`;
  const { data, loadedKey, error, refresh: refreshList, refreshError } = useResource(listKey, () => api<{ bookings: BookingRow[]; hasMore?: boolean }>(listKey));
  const countsKey = '/api/rentals/bookings?counts=1';
  const { data: totals, refresh: refreshCounts } = useResource(countsKey, () => api<BookingCounts>(countsKey));

  // An action can move the open booking out of this tab, so the sheet keeps its own copy and re-reads it by reference.
  const sheetReference = useRef<string | null>(null);
  sheetReference.current = sheet?.reference ?? null;
  const refresh = useCallback(async () => {
    const reference = sheetReference.current;
    await Promise.all([
      refreshList(),
      refreshCounts(),
      reference
        ? api<{ booking?: BookingRow }>(`/api/rentals/bookings?reference=${encodeURIComponent(reference)}`)
          .then((result) => { if (result.booking && sheetReference.current === reference) setSheet(result.booking); })
          .catch(() => undefined)
        : undefined,
    ]);
  }, [refreshList, refreshCounts]);
  const { act, busy } = useBookingActions(refresh);

  // Rows from the previous tab are hidden until this tab's list arrives.
  const switching = loadedKey !== listKey;
  const rows = switching ? [] : data?.bookings ?? [];
  const filtered = query
    ? rows.filter((row) => `${row.reference} ${row.renter.name} ${row.renter.email} ${itemName(row.itemId)}`.toLowerCase().includes(query.toLowerCase()))
    : rows;

  if (error && !data) return <ErrorState title={t('bookings.error_title')} message={error} onRetry={() => void refresh()} />;
  if (!data) return <LoadingState />;

  const counts = totals?.counts ?? {};
  const filters: Array<{ id: BookingFilter; label: string; count: number | undefined }> = [
    { id: 'open', label: t('bookings.filter_open'), count: totals?.open },
    // Keep the selected tab visible even when its count drops to zero.
    ...statusOrder.filter((status) => counts[status] || filter === status).map((status) => ({ id: status, label: statusLabel(status, t), count: totals ? counts[status] ?? 0 : undefined })),
    { id: 'all', label: t('bookings.filter_all'), count: totals?.all },
  ];
  const noBookingsAtAll = totals ? totals.all === 0 : filter === 'all' && rows.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {refreshError ? <RefreshNotice onRetry={() => void refresh()} /> : null}
      <SectionHeader
        title={t('bookings.title')}
        description={t('bookings.description')}
        actions={<Button onClick={() => setCreating(true)}><Plus data-icon="inline-start" />{t('action.new_booking')}</Button>}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('bookings.filter_aria')}>
          {filters.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={filter === entry.id}
              onClick={() => setFilter(entry.id)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
                filter === entry.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {entry.label}
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', filter === entry.id ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground')}>
                {entry.count ?? '–'}
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder={t('bookings.search_placeholder')} value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t('bookings.search_aria')} />
        </div>
      </div>

      {noBookingsAtAll ? (
        <EmptyState
          icon={ClipboardList}
          title={t('bookings.empty_title')}
          action={<Button variant="outline" onClick={() => setCreating(true)}><Plus data-icon="inline-start" />{t('action.add_booking')}</Button>}
        >
          {t('bookings.empty_desc')}
        </EmptyState>
      ) : switching ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title={t('bookings.empty_matches_title')}>{t('bookings.empty_matches_desc')}</EmptyState>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">{t('bookings.col_booking')}</TableHead>
                <TableHead>{t('bookings.col_item')}</TableHead>
                <TableHead>{t('bookings.col_dates')}</TableHead>
                <TableHead>{t('bookings.col_status')}</TableHead>
                <TableHead className="text-right">{t('bookings.col_total')}</TableHead>
                <TableHead className="pr-4 text-right"><span className="sr-only">{t('bookings.col_actions')}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const next = nextAction(row.status, t);
                return (
                  <TableRow key={row._id} className="cursor-pointer" onClick={() => setSheet(row)}>
                    <TableCell className="pl-4">
                      <div className="flex flex-col">
                        <span className="font-medium">{row.renter.name || row.renter.email || t('bookings.renter_fallback')}</span>
                        <span className="text-xs text-muted-foreground">{row.reference}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {itemName(row.itemId)}
                      {row.quantity > 1 ? <span className="text-muted-foreground"> × {row.quantity}</span> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatRange(row.startDate, row.endDate)}
                      <span className="block text-xs text-muted-foreground">{row.quote.days} {row.quote.days === 1 ? t('common.day') : t('common.days')}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} refundNeeded={row.refundNeeded} />
                      {row.changeRequest?.status === 'pending' ? (
                        <span className="mt-1 block text-xs font-medium text-amber-700 dark:text-amber-300">
                          {row.changeRequest.type === 'cancel' ? t('bookings.cancel_requested') : row.changeRequest.type === 'extend' ? t('bookings.extend_requested') : t('bookings.date_change_requested')}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(row.quote.total)}</TableCell>
                    <TableCell className="pr-4 text-right" onClick={(event) => event.stopPropagation()}>
                      {next ? (
                        next.action === 'approve' ? (
                          <BookingActionButton
                            reference={row.reference}
                            action={next.action}
                            label={next.label}
                            title={t('bookings.dialog_approve_title')}
                            description={t('bookings.dialog_approve_desc')}
                            act={act}
                            busy={busy}
                            variant="outline"
                            size="sm"
                          />
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={busy === `${row.reference}:${next.action}`}
                            disabled={busy !== null}
                            onClick={() => void act(row.reference, next.action)}
                          >
                            {next.label}
                          </Button>
                        )
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <BookingSheet key={sheet?._id} booking={sheet} onClose={() => setSheet(null)} act={act} busy={busy} onChanged={refresh} />
      <NewBookingSheet open={creating} onClose={() => setCreating(false)} onCreated={refresh} />
    </div>
  );
}

function ChangeRequestPanel({ booking, act, busy }: {
  booking: BookingRow;
  act: (reference: string, action: string, extra?: Record<string, unknown>) => Promise<boolean>;
  busy: string | null;
}) {
  const { money } = useDashboard();
  const { t, formatRange, formatDay } = useI18n();
  const request = booking.changeRequest;
  if (!request) return null;
  const difference = request.quote.total - booking.quote.total;
  if (request.type === 'extend') {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
        <h3 className="font-medium">{t('bookings.extend_title')}</h3>
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground line-through">{formatDay(booking.endDate, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          <p className="font-medium">{t('bookings.extend_new_return', { date: formatDay(request.endDate, { weekday: 'short', month: 'short', day: 'numeric' }) })}</p>
          <p className="text-muted-foreground">
            {t('bookings.extend_desc', {
              total: money(request.quote.total),
              differenceText: difference > 0 ? t('bookings.change_dates_collect', { amount: money(difference) }) : t('bookings.change_dates_no_change'),
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BookingActionButton
            reference={booking.reference}
            action="change-approve"
            label={t('bookings.extend_approve_label')}
            title={t('bookings.extend_approve_title')}
            description={t('bookings.extend_approve_desc')}
            act={act}
            busy={busy}
            size="sm"
          />
          <BookingActionButton
            reference={booking.reference}
            action="change-decline"
            label={t('bookings.change_dates_decline_label')}
            title={t('bookings.extend_decline_title')}
            description={t('bookings.extend_decline_desc')}
            act={act}
            busy={busy}
            variant="outline"
            size="sm"
          />
        </div>
      </section>
    );
  }
  if (request.type === 'cancel') {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
        <h3 className="font-medium">{t('bookings.change_cancel_title')}</h3>
        <p className="text-muted-foreground">
          {t('bookings.change_cancel_desc', {
            orderRefundNotice: booking.ecomOrderId
              ? t('bookings.change_cancel_order_notice', { orderId: booking.ecomOrderId })
              : '',
          })}
        </p>
        <div className="flex flex-wrap gap-2">
          <BookingActionButton
            reference={booking.reference}
            action="change-approve"
            label={t('bookings.change_cancel_approve_label')}
            title={t('bookings.change_cancel_approve_title')}
            description={t('bookings.change_cancel_approve_desc')}
            act={act}
            busy={busy}
            variant="destructive"
            size="sm"
          />
          <BookingActionButton
            reference={booking.reference}
            action="change-decline"
            label={t('bookings.change_cancel_keep_label')}
            title={t('bookings.change_cancel_keep_title')}
            description={t('bookings.change_cancel_keep_desc')}
            act={act}
            busy={busy}
            variant="outline"
            size="sm"
          />
        </div>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
      <h3 className="font-medium">{t('bookings.change_dates_title')}</h3>
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground line-through">{formatRange(booking.startDate, booking.endDate)}</p>
        <p className="font-medium">
          {formatRange(request.startDate, request.endDate)} · {request.quote.days} {request.quote.days === 1 ? t('common.day') : t('common.days')}
        </p>
        <p className="text-muted-foreground">
          {t('bookings.change_dates_desc', {
            total: money(request.quote.total),
            differenceText: difference > 0
              ? t('bookings.change_dates_collect', { amount: money(difference) })
              : difference < 0
                ? t('bookings.change_dates_refund', { amount: money(-difference) })
                : t('bookings.change_dates_no_change'),
          })}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <BookingActionButton
          reference={booking.reference}
          action="change-approve"
          label={t('bookings.change_dates_approve_label')}
          title={t('bookings.change_dates_approve_title')}
          description={t('bookings.change_dates_approve_desc')}
          act={act}
          busy={busy}
          size="sm"
        />
        <BookingActionButton
          reference={booking.reference}
          action="change-decline"
          label={t('bookings.change_dates_decline_label')}
          title={t('bookings.change_dates_decline_title')}
          description={t('bookings.change_dates_decline_desc')}
          act={act}
          busy={busy}
          variant="outline"
          size="sm"
        />
      </div>
    </section>
  );
}

export function BookingSheet({ booking, onClose, act, busy, onChanged }: {
  booking: BookingRow | null;
  onClose: () => void;
  act: (reference: string, action: string, extra?: Record<string, unknown>) => Promise<boolean>;
  busy: string | null;
  /** Reloads the bookings after a change made outside `act`, such as a refund. */
  onChanged?: () => Promise<void> | void;
}) {
  const { itemName, money } = useDashboard();
  const { t, formatDay } = useI18n();
  const late = booking?.lateReturn;
  // A late fee is suggested as the amount to keep from the deposit; the owner can change it.
  const [kept, setKept] = useState(() => (booking && late?.fee ? Math.min(late.fee, booking.quote.deposit) : 0));
  const [note, setNote] = useState(() => (late?.fee ? t('bookings.late_settle_note', { count: late.lateDays }) : ''));
  const [lateHistory, setLateHistory] = useState<number | null>(null);
  const [refundKind, setRefundKind] = useState<RefundKind | null>(null);
  const [refundAfterSettle, setRefundAfterSettle] = useState(true);

  const next = booking ? nextAction(booking.status, t) : null;
  const canSettle = booking
    && (['active', 'overdue', 'returned'].includes(booking.status) || (booking.orderDeposit && booking.status === 'cancelled'))
    && booking.quote.deposit > 0
    && !booking.depositOutcome;
  const refunds = booking?.refunds ?? [];
  const itemRefunded = refunds.some((refund) => refund.kind === 'item');
  const depositRefunded = refunds.some((refund) => refund.kind === 'deposit');
  const cancelled = booking ? booking.status === 'cancelled' || booking.status === 'expired' : false;
  const canRefundItem = Boolean(booking?.ecomOrderId) && cancelled && !itemRefunded;
  const depositLeft = booking?.depositOutcome ? Math.max(0, booking.quote.deposit - booking.depositOutcome.amountKept) : 0;
  const canRefundDeposit = Boolean(booking?.ecomOrderId) && depositLeft > 0 && !depositRefunded;
  const reference = booking?.reference ?? '';
  const hasUnpaidLink = Boolean(booking?.paymentRequests?.some((request) => request.status === 'unpaid'));

  // Earlier late or lost rentals from this renter, and the latest status of any unpaid payment link.
  useEffect(() => {
    if (!reference) return;
    let live = true;
    api<{ lateReturns?: number }>(`/api/rentals/bookings?history=${encodeURIComponent(reference)}`)
      .then((result) => { if (live) setLateHistory(result.lateReturns ?? 0); })
      .catch(() => undefined);
    if (hasUnpaidLink) {
      post<{ ok: boolean; changed?: boolean }>('/api/rentals/bookings', { reference, action: 'payment-status' })
        .then((result) => { if (live && result.changed) void onChanged?.(); })
        .catch(() => undefined);
    }
    return () => { live = false; };
    // Runs once per opened booking; onChanged is a fresh closure on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, hasUnpaidLink]);

  return (
    <Sheet open={Boolean(booking)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {booking ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <SheetTitle>{booking.reference}</SheetTitle>
                <StatusBadge status={booking.status} refundNeeded={booking.refundNeeded} />
              </div>
              <SheetDescription>{itemName(booking.itemId)}{booking.quantity > 1 ? ` × ${booking.quantity}` : ''}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('bookings.sheet_pickup')}</p>
                  <p className="font-medium">{formatDay(booking.startDate, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('bookings.sheet_return')}</p>
                  <p className="font-medium">{formatDay(booking.endDate, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                </div>
              </div>

              <section className="flex flex-col gap-1.5">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('bookings.sheet_renter')}</h3>
                <p className="font-medium">{booking.renter.name || '—'}</p>
                {booking.renter.email ? <a className="text-sm text-primary hover:underline" href={`mailto:${booking.renter.email}`}>{booking.renter.email}</a> : null}
                {booking.renter.phone ? <p className="text-sm text-muted-foreground">{booking.renter.phone}</p> : null}
                {lateHistory ? (
                  <p className="inline-flex w-fit items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
                    <AlertTriangle className="size-3.5" />
                    {lateHistory === 1 ? t('bookings.renter_late_once') : t('bookings.renter_late_many', { count: lateHistory })}
                  </p>
                ) : null}
              </section>

              {late ? <LateReturnPanel booking={booking} /> : null}

              <section className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t('bookings.sheet_rental_line', {
                      days: booking.quote.days,
                      dayWord: booking.quote.days === 1 ? t('common.day') : t('common.days'),
                    })}
                  </span>
                  <span className="tabular-nums">{money(booking.quote.rental)}</span>
                </div>
                {booking.quote.deposit > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{booking.orderDeposit ? t('bookings.sheet_order_deposit') : t('bookings.sheet_deposit')}</span>
                    <span className="tabular-nums">{money(booking.quote.deposit)}</span>
                  </div>
                ) : null}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>{t('bookings.sheet_total')}</span>
                  <span className="tabular-nums">{money(booking.quote.total)}</span>
                </div>
                {booking.depositOutcome ? (
                  <p className="text-xs text-muted-foreground">
                    {booking.depositOutcome.outcome === 'kept'
                      ? t('bookings.sheet_deposit_kept', { amount: money(booking.depositOutcome.amountKept) })
                      : t('bookings.sheet_deposit_released')}
                    {booking.depositOutcome.note ? ` · ${booking.depositOutcome.note}` : ''}
                  </p>
                ) : null}
                {booking.ecomOrderId ? (
                  <p className="text-xs text-muted-foreground">{t('bookings.sheet_wix_order', { orderId: booking.ecomOrderId })}</p>
                ) : null}
              </section>

              {booking.ecomOrderId && (refunds.length > 0 || canRefundItem || canRefundDeposit) ? (
                <section className="flex flex-col gap-2 rounded-lg border p-3">
                  <h3 className="text-sm font-medium">{t('refunds.section_title')}</h3>
                  {refunds.map((refund) => (
                    <p key={`${refund.refundId}:${refund.kind}:${refund.at}`} className="text-xs text-muted-foreground">
                      {t(refund.external ? 'refunds.record_external' : 'refunds.record_done', {
                        amount: money(refund.amount),
                        what: refund.kind === 'deposit' ? t('refunds.what_deposit') : t('refunds.what_item'),
                        date: refund.at ? formatDay(refund.at.slice(0, 10), { month: 'short', day: 'numeric' }) : '',
                      })}
                    </p>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    {canRefundItem ? (
                      <>
                        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setRefundKind('item')}>{t('refunds.btn_item')}</Button>
                        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setRefundKind('order')}>{t('refunds.btn_order')}</Button>
                      </>
                    ) : null}
                    {canRefundDeposit ? (
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setRefundKind('deposit')}>
                        {t('refunds.btn_deposit', { amount: money(depositLeft) })}
                      </Button>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {booking.changeRequest?.status === 'pending' ? (
                <ChangeRequestPanel booking={booking} act={act} busy={busy} />
              ) : null}

              <PaymentLinksPanel booking={booking} act={act} busy={busy} />

              {canSettle ? (
                <section className="flex flex-col gap-3 rounded-lg border p-3">
                  <h3 className="text-sm font-medium">{t('bookings.sheet_settle_title')}</h3>
                  {booking.orderDeposit ? (
                    <p className="text-xs text-muted-foreground">{t('bookings.sheet_order_deposit_hint')}</p>
                  ) : null}
                  {late?.fee ? (
                    <p className="text-xs text-muted-foreground">{t('bookings.late_settle_hint', { amount: money(late.fee) })}</p>
                  ) : null}
                  <TextField
                    id="kept"
                    label={t('bookings.sheet_amount_kept')}
                    max={booking.quote.deposit}
                    {...numberField(kept, (value) => setKept(Math.min(booking.quote.deposit, value)))}
                    hint={t('bookings.sheet_amount_kept_hint', { max: money(booking.quote.deposit) })}
                  />
                  <TextField
                    id="note"
                    label={t('bookings.sheet_note')}
                    placeholder={t('bookings.sheet_note_placeholder')}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  {booking.ecomOrderId && kept < booking.quote.deposit ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={refundAfterSettle}
                        onChange={(event) => setRefundAfterSettle(event.target.checked)}
                      />
                      {t('refunds.settle_then_refund', { amount: money(booking.quote.deposit - kept) })}
                    </label>
                  ) : null}
                  <Button
                    variant="outline"
                    className="w-fit"
                    loading={busy === `${booking.reference}:settle`}
                    disabled={busy !== null}
                    onClick={async () => {
                      const settled = await act(booking.reference, 'settle', { amountKept: kept, note });
                      // Confirming the refund is a separate step: the dialog shows Wix's own figure first.
                      if (settled && booking.ecomOrderId && refundAfterSettle && kept < booking.quote.deposit) setRefundKind('deposit');
                    }}
                  >
                    {kept > 0 ? t('bookings.sheet_keep_amount', { amount: money(kept) }) : t('bookings.sheet_release_deposit')}
                  </Button>
                </section>
              ) : null}
            </div>

            <SheetFooter className="flex-row flex-wrap gap-2">
              {next ? (
                next.action === 'approve' ? (
                  <BookingActionButton
                    reference={booking.reference}
                    action={next.action}
                    label={next.label}
                    title={t('bookings.dialog_approve_title')}
                    description={t('bookings.dialog_approve_desc')}
                    act={act}
                    busy={busy}
                  />
                ) : (
                  <Button loading={busy === `${booking.reference}:${next.action}`} disabled={busy !== null} onClick={() => void act(booking.reference, next.action)}>{next.label}</Button>
                )
              ) : null}
              {booking.status === 'pending' ? (
                <BookingActionButton
                  reference={booking.reference}
                  action="decline"
                  label={t('action.decline')}
                  title={t('bookings.dialog_decline_title')}
                  description={t('bookings.dialog_decline_desc')}
                  act={act}
                  busy={busy}
                  variant="outline"
                />
              ) : null}
              {booking.status === 'active' || booking.status === 'overdue' ? (
                <MarkLostButton booking={booking} act={act} busy={busy} />
              ) : null}
              {canCancel(booking.status) ? (
                <ConfirmButton
                  label={t('action.cancel_booking')}
                  confirmLabel={t('action.cancel_confirm')}
                  loading={busy === `${booking.reference}:cancel`}
                  disabled={busy !== null}
                  onConfirm={() => void act(booking.reference, 'cancel')}
                />
              ) : null}
            </SheetFooter>
          </>
        ) : null}
        {booking && refundKind ? (
          <RefundDialog
            reference={booking.reference}
            kind={refundKind}
            open
            onOpenChange={(open) => { if (!open) setRefundKind(null); }}
            onDone={async () => { await onChanged?.(); }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function NewBookingSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
  const { items } = useDashboard();
  const { t, formatRange } = useI18n();
  const toast = useToast();
  const active = items.filter((item) => item.status === 'active');
  const [itemId, setItemId] = useState('');
  const [range, setRange] = useState<DateRange | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [renterName, setRenterName] = useState('');
  const [renterEmail, setRenterEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const chosen = itemId || active[0]?._id || '';
  const ready = Boolean(chosen && range?.from && range.to && renterName);

  function reset() {
    setRange(undefined);
    setQuantity(1);
    setRenterName('');
    setRenterEmail('');
  }

  async function create() {
    if (!range?.from || !range.to) return;
    setSaving(true);
    try {
      const result = await post<{ ok: boolean; message?: string; booking?: { reference: string } }>('/api/rentals/bookings', {
        action: 'manual',
        itemId: chosen,
        startDate: isoDay(range.from),
        endDate: isoDay(range.to),
        quantity,
        renterName,
        renterEmail,
      });
      if (!result.ok) {
        toast(result.message || t('bookings.toast_create_failed'), 'error');
        return;
      }
      toast(t('bookings.toast_created', { reference: result.booking?.reference ?? '' }));
      reset();
      onClose();
      await onCreated();
    } catch (error) {
      toast(error instanceof Error ? error.message : t('bookings.toast_create_failed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('bookings.new_title')}</SheetTitle>
          <SheetDescription>{t('bookings.new_desc')}</SheetDescription>
        </SheetHeader>
        {active.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">{t('bookings.new_need_item')}</p>
        ) : (
          <div className="flex flex-col gap-4 px-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t('bookings.new_item')}</Label>
              <Select value={chosen} onValueChange={(value) => setItemId(value)}>
                <SelectTrigger className="w-full"><SelectValue placeholder={t('bookings.new_choose_item')} /></SelectTrigger>
                <SelectContent>
                  {active.map((item) => <SelectItem key={item._id} value={item._id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('bookings.new_dates')}</Label>
              <div className="rounded-lg border p-2">
                <DayPicker mode="range" selected={range} onSelect={setRange} disabled={{ before: new Date() }} excludeDisabled />
              </div>
              <p className="text-xs text-muted-foreground">
                {range?.from && range.to ? formatRange(isoDay(range.from), isoDay(range.to)) : t('bookings.new_dates_hint')}
              </p>
            </div>
            <TextField id="new-qty" label={t('bookings.new_quantity')} {...numberField(quantity, setQuantity, 1)} />
            <TextField id="new-name" label={t('bookings.new_renter_name')} value={renterName} onChange={(event) => setRenterName(event.target.value)} />
            <TextField id="new-email" label={t('bookings.new_renter_email')} type="email" value={renterEmail} onChange={(event) => setRenterEmail(event.target.value)} />
          </div>
        )}
        <SheetFooter>
          <Button loading={saving} disabled={!ready || saving} onClick={() => void create()}>{t('bookings.new_submit')}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// The late fee still to collect once the deposit is used for it.
function lateBalance(booking: BookingRow): number {
  const fee = booking.lateReturn?.fee ?? 0;
  if (fee <= 0) return 0;
  const covered = booking.depositOutcome ? booking.depositOutcome.amountKept : Math.min(fee, booking.quote.deposit);
  return Math.max(0, Math.round((fee - covered) * 100) / 100);
}

function LateReturnPanel({ booking }: { booking: BookingRow }) {
  const { money } = useDashboard();
  const { t, formatDate } = useI18n();
  const late = booking.lateReturn;
  if (!late) return null;
  const balance = lateBalance(booking);
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50/60 p-3 text-sm dark:border-red-500/30 dark:bg-red-500/5">
      <h3 className="flex items-center gap-2 font-medium text-red-800 dark:text-red-300">
        <AlertTriangle className="size-4" />{late.final ? t('bookings.late_title_final') : t('bookings.late_title')}
      </h3>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">{t('bookings.late_overdue_since')}</dt>
        <dd>{late.overdueSince ? formatDate(late.overdueSince, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</dd>
        <dt className="text-muted-foreground">{t('bookings.late_how_late')}</dt>
        <dd>{late.lateDays === 1 ? t('today.late_one_day') : t('today.late_days', { count: late.lateDays })}</dd>
        <dt className="text-muted-foreground">{late.final ? t('bookings.late_fee_final') : t('bookings.late_fee_so_far')}</dt>
        <dd className="font-medium tabular-nums">{money(late.fee)}</dd>
        {late.fee > 0 && booking.quote.deposit > 0 && !booking.depositOutcome ? (
          <>
            <dt className="text-muted-foreground">{t('bookings.late_from_deposit')}</dt>
            <dd className="tabular-nums">{money(Math.min(late.fee, booking.quote.deposit))}</dd>
          </>
        ) : null}
        {balance > 0 ? (
          <>
            <dt className="text-muted-foreground">{t('bookings.late_balance')}</dt>
            <dd className="font-medium tabular-nums">{money(balance)}</dd>
          </>
        ) : null}
      </dl>
      {late.lostFlaggedAt && booking.status === 'overdue' ? (
        <p className="text-xs text-red-800 dark:text-red-300">{t('bookings.late_lost_flag')}</p>
      ) : null}
      {!late.final && late.fee > 0 ? <p className="text-xs text-muted-foreground">{t('bookings.late_fee_grows')}</p> : null}
    </section>
  );
}

function PaymentLinksPanel({ booking, act, busy }: {
  booking: BookingRow;
  act: (reference: string, action: string, extra?: Record<string, unknown>) => Promise<boolean>;
  busy: string | null;
}) {
  const { money } = useDashboard();
  const { t, formatDay } = useI18n();
  const balance = lateBalance(booking);
  const [kind, setKind] = useState<'late-fee' | 'extension'>(balance > 0 ? 'late-fee' : 'extension');
  const [amount, setAmount] = useState(balance);
  const requests = booking.paymentRequests ?? [];
  const eligible = ['active', 'overdue', 'returned', 'lost'].includes(booking.status) && Boolean(booking.renter.email);
  if (!eligible && requests.length === 0) return null;
  const statusLabel = { unpaid: t('bookings.payment_unpaid'), paid: t('bookings.payment_paid'), inactive: t('bookings.payment_inactive') };
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium">{t('bookings.payment_title')}</h3>
        <p className="text-xs text-muted-foreground">{t('bookings.payment_desc')}</p>
      </div>
      {requests.length > 0 ? (
        <ul className="flex flex-col gap-1 text-xs">
          {requests.map((request) => (
            <li key={request.linkId} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {request.kind === 'late-fee' ? t('bookings.payment_kind_late') : t('bookings.payment_kind_extension')} · {money(request.amount)} · {formatDay(request.at.slice(0, 10), { month: 'short', day: 'numeric' })}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className={cn('font-medium', request.status === 'paid' ? 'text-emerald-700 dark:text-emerald-300' : request.status === 'unpaid' ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
                  {statusLabel[request.status]}
                </span>
                <a href={request.url} target="_blank" rel="noreferrer" className="text-primary" aria-label={t('bookings.payment_open')}>
                  <ExternalLink className="size-3.5" />
                </a>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {eligible ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t('bookings.payment_for')}</Label>
            <Select value={kind} onValueChange={(value) => setKind(value === 'extension' ? 'extension' : 'late-fee')}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="late-fee">{t('bookings.payment_kind_late')}</SelectItem>
                <SelectItem value="extension">{t('bookings.payment_kind_extension')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TextField id="payment-amount" label={t('bookings.payment_amount')} step="0.01" {...numberField(amount, setAmount)} />
          <Button
            variant="outline"
            className="w-fit sm:col-span-2"
            loading={busy === `${booking.reference}:payment-link`}
            disabled={busy !== null || amount <= 0}
            onClick={() => void act(booking.reference, 'payment-link', { kind, amount })}
          >
            {t('bookings.payment_send', { amount: money(amount) })}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function MarkLostButton({ booking, act, busy }: {
  booking: BookingRow;
  act: (reference: string, action: string, extra?: Record<string, unknown>) => Promise<boolean>;
  busy: string | null;
}) {
  const { money } = useDashboard();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [removeFromStock, setRemoveFromStock] = useState(true);
  return (
    <>
      <Button variant="outline" disabled={busy !== null} onClick={() => setOpen(true)}>{t('bookings.lost_button')}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bookings.lost_title', { reference: booking.reference })}</DialogTitle>
            <DialogDescription>
              {booking.quote.deposit > 0 && !booking.depositOutcome
                ? t('bookings.lost_desc_deposit', { amount: money(booking.quote.deposit) })
                : t('bookings.lost_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <TextField
              id="lost-note"
              label={t('bookings.sheet_note')}
              placeholder={t('bookings.lost_note_placeholder')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={removeFromStock} onChange={(event) => setRemoveFromStock(event.target.checked)} />
              {t('bookings.lost_remove_stock', { count: booking.quantity })}
            </label>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t('common.cancel')}</Button></DialogClose>
            <Button
              variant="destructive"
              loading={busy === `${booking.reference}:lost`}
              disabled={busy !== null}
              onClick={async () => {
                if (await act(booking.reference, 'lost', { note, removeFromStock })) setOpen(false);
              }}
            >
              {t('bookings.lost_confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
