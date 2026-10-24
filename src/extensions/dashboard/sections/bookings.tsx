import { useMemo, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, post } from '@/dashboard/client';
import { cn } from '@/lib/utils';
import {
  canCancel,
  ConfirmButton,
  EmptyState,
  ErrorState,
  formatDay,
  formatRange,
  isoDay,
  LoadingState,
  nextAction,
  numberField,
  SectionHeader,
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

type ActionResult = { ok: boolean; message?: string; refundOrderId?: string };

// Runs a booking transition, reports the outcome, then lets the caller refresh.
export function useBookingActions(onDone: () => Promise<void> | void) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(reference: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(`${reference}:${action}`);
    try {
      const result = await post<ActionResult>('/api/rentals/bookings', { reference, action, ...extra });
      if (!result.ok) {
        toast(result.message || 'That change was not saved.', 'error');
        return false;
      }
      const messages: Record<string, string> = {
        approve: `${reference} approved.`,
        decline: `${reference} declined.`,
        pickup: `${reference} marked as picked up.`,
        returned: `${reference} marked as returned.`,
        settle: `Deposit for ${reference} settled.`,
        'change-approve': result.message || `${reference} updated.`,
        'change-decline': result.message || `Request for ${reference} declined.`,
        cancel: result.refundOrderId
          ? `${reference} cancelled. Refund Wix order ${result.refundOrderId} from the Orders page.`
          : `${reference} cancelled.`,
      };
      toast(messages[action] ?? 'Saved.');
      await onDone();
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That change was not saved.', 'error');
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
              <Button variant="outline" disabled={busy !== null}>Cancel</Button>
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
  const { data, error, refresh } = useResource(() => api<{ bookings: BookingRow[] }>('/api/rentals/bookings'));
  const { act, busy } = useBookingActions(refresh);
  const [filter, setFilter] = useState<BookingStatus | 'all' | 'open'>('open');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = data?.bookings ?? [];
  const counts = useMemo(() => {
    const result: Partial<Record<BookingStatus, number>> = {};
    for (const row of rows) result[row.status] = (result[row.status] ?? 0) + 1;
    return result;
  }, [rows]);

  const openStatuses: BookingStatus[] = ['pending', 'confirmed', 'active', 'overdue'];
  const filtered = rows.filter((row) => {
    if (filter === 'open' && !openStatuses.includes(row.status)) return false;
    if (filter !== 'open' && filter !== 'all' && row.status !== filter) return false;
    if (!query) return true;
    const haystack = `${row.reference} ${row.renter.name} ${row.renter.email} ${itemName(row.itemId)}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const selected = rows.find((row) => row._id === openId) ?? null;

  if (error) return <ErrorState title="Could not load bookings" message={error} onRetry={() => void refresh()} />;
  if (!data) return <LoadingState />;

  const filters: Array<{ id: BookingStatus | 'all' | 'open'; label: string; count: number }> = [
    { id: 'open', label: 'Open', count: openStatuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0) },
    ...statusOrder.filter((status) => counts[status]).map((status) => ({ id: status, label: statusLabel(status), count: counts[status] ?? 0 })),
    { id: 'all', label: 'All', count: rows.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Bookings"
        description="Approve requests, hand items over, check them back in."
        actions={<Button onClick={() => setCreating(true)}><Plus data-icon="inline-start" />New booking</Button>}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
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
                {entry.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search reference, renter or item" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search bookings" />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No bookings yet"
          action={<Button variant="outline" onClick={() => setCreating(true)}><Plus data-icon="inline-start" />Add a booking</Button>}
        >
          Bookings appear here when a renter checks out, or when you add one yourself.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Nothing matches">Try another status or clear the search.</EmptyState>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">Booking</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="pr-4 text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const next = nextAction(row.status);
                return (
                  <TableRow key={row._id} className="cursor-pointer" onClick={() => setOpenId(row._id)}>
                    <TableCell className="pl-4">
                      <div className="flex flex-col">
                        <span className="font-medium">{row.renter.name || row.renter.email || 'Renter'}</span>
                        <span className="text-xs text-muted-foreground">{row.reference}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {itemName(row.itemId)}
                      {row.quantity > 1 ? <span className="text-muted-foreground"> × {row.quantity}</span> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatRange(row.startDate, row.endDate)}
                      <span className="block text-xs text-muted-foreground">{row.quote.days} {row.quote.days === 1 ? 'day' : 'days'}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} refundNeeded={row.refundNeeded} />
                      {row.changeRequest?.status === 'pending' ? (
                        <span className="mt-1 block text-xs font-medium text-amber-700 dark:text-amber-300">
                          {row.changeRequest.type === 'cancel' ? 'Cancellation requested' : 'Date change requested'}
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
                            title="Approve this booking?"
                            description="This confirms the booking and lets the renter know it is approved."
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

      <BookingSheet key={selected?._id} booking={selected} onClose={() => setOpenId(null)} act={act} busy={busy} />
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
  const request = booking.changeRequest;
  if (!request) return null;
  const difference = request.quote.total - booking.quote.total;
  if (request.type === 'cancel') {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
        <h3 className="font-medium">Renter asked to cancel</h3>
        <p className="text-muted-foreground">
          Approving frees the dates and emails the renter.
          {booking.ecomOrderId ? ` You'll still need to refund Wix order ${booking.ecomOrderId}.` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <BookingActionButton reference={booking.reference} action="change-approve" label="Approve cancellation" title="Approve this cancellation?" description="This will cancel the booking, free the dates, and email the renter." act={act} busy={busy} variant="destructive" size="sm" />
          <BookingActionButton reference={booking.reference} action="change-decline" label="Keep booking" title="Keep this booking?" description="The renter’s cancellation request will be declined and the booking will remain active." act={act} busy={busy} variant="outline" size="sm" />
        </div>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
      <h3 className="font-medium">Renter asked to change dates</h3>
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground line-through">{formatRange(booking.startDate, booking.endDate)}</p>
        <p className="font-medium">{formatRange(request.startDate, request.endDate)} · {request.quote.days} {request.quote.days === 1 ? 'day' : 'days'}</p>
        <p className="text-muted-foreground">
          The renter is emailed either way. New total {money(request.quote.total)}
          {difference > 0 ? ` · collect ${money(difference)} more` : difference < 0 ? ` · refund ${money(-difference)}` : ' · no price change'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <BookingActionButton reference={booking.reference} action="change-approve" label="Approve new dates" title="Approve these new dates?" description="The booking dates and total will be updated, and the renter will be notified." act={act} busy={busy} size="sm" />
        <BookingActionButton reference={booking.reference} action="change-decline" label="Decline" title="Decline this date change?" description="The booking will keep its current dates and the renter will be notified." act={act} busy={busy} variant="outline" size="sm" />
      </div>
    </section>
  );
}

export function BookingSheet({ booking, onClose, act, busy }: {
  booking: BookingRow | null;
  onClose: () => void;
  act: (reference: string, action: string, extra?: Record<string, unknown>) => Promise<boolean>;
  busy: string | null;
}) {
  const { itemName, money } = useDashboard();
  const [kept, setKept] = useState(0);
  const [note, setNote] = useState('');

  const next = booking ? nextAction(booking.status) : null;
  const canSettle = booking
    && ['active', 'overdue', 'returned'].includes(booking.status)
    && booking.quote.deposit > 0
    && !booking.depositOutcome;

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
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="font-medium">{formatDay(booking.startDate, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Return</p>
                  <p className="font-medium">{formatDay(booking.endDate, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                </div>
              </div>

              <section className="flex flex-col gap-1.5">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Renter</h3>
                <p className="font-medium">{booking.renter.name || '—'}</p>
                {booking.renter.email ? <a className="text-sm text-primary hover:underline" href={`mailto:${booking.renter.email}`}>{booking.renter.email}</a> : null}
                {booking.renter.phone ? <p className="text-sm text-muted-foreground">{booking.renter.phone}</p> : null}
              </section>

              <section className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Rental · {booking.quote.days} days</span><span className="tabular-nums">{money(booking.quote.rental)}</span></div>
                {booking.quote.deposit > 0 ? (
                  <div className="flex justify-between"><span className="text-muted-foreground">Deposit</span><span className="tabular-nums">{money(booking.quote.deposit)}</span></div>
                ) : null}
                <Separator />
                <div className="flex justify-between font-medium"><span>Total</span><span className="tabular-nums">{money(booking.quote.total)}</span></div>
                {booking.depositOutcome ? (
                  <p className="text-xs text-muted-foreground">
                    Deposit {booking.depositOutcome.outcome === 'kept' ? `kept: ${money(booking.depositOutcome.amountKept)}` : 'released'}
                    {booking.depositOutcome.note ? ` · ${booking.depositOutcome.note}` : ''}
                  </p>
                ) : null}
                {booking.ecomOrderId ? <p className="text-xs text-muted-foreground">Wix order {booking.ecomOrderId}</p> : null}
              </section>

              {booking.changeRequest?.status === 'pending' ? (
                <ChangeRequestPanel booking={booking} act={act} busy={busy} />
              ) : null}

              {canSettle ? (
                <section className="flex flex-col gap-3 rounded-lg border p-3">
                  <h3 className="text-sm font-medium">Settle deposit</h3>
                  <TextField id="kept" label="Amount kept" max={booking.quote.deposit} {...numberField(kept, (value) => setKept(Math.min(booking.quote.deposit, value)))} hint={`Up to ${money(booking.quote.deposit)}. Leave empty to release it in full.`} />
                  <TextField id="note" label="Note" placeholder="e.g. Scratched lens" value={note} onChange={(event) => setNote(event.target.value)} />
                  <Button variant="outline" className="w-fit" loading={busy === `${booking.reference}:settle`} disabled={busy !== null} onClick={() => void act(booking.reference, 'settle', { amountKept: kept, note })}>
                    {kept > 0 ? `Keep ${money(kept)}` : 'Release deposit'}
                  </Button>
                </section>
              ) : null}
            </div>

            <SheetFooter className="flex-row flex-wrap gap-2">
              {next ? (
                next.action === 'approve' ? (
                  <BookingActionButton reference={booking.reference} action={next.action} label={next.label} title="Approve this booking?" description="This confirms the booking and lets the renter know it is approved." act={act} busy={busy} />
                ) : (
                  <Button loading={busy === `${booking.reference}:${next.action}`} disabled={busy !== null} onClick={() => void act(booking.reference, next.action)}>{next.label}</Button>
                )
              ) : null}
              {booking.status === 'pending' ? (
                <BookingActionButton reference={booking.reference} action="decline" label="Decline" title="Decline this booking?" description="This rejects the booking request and notifies the renter." act={act} busy={busy} variant="outline" />
              ) : null}
              {canCancel(booking.status) ? (
                <ConfirmButton label="Cancel booking" confirmLabel="Click again to cancel" loading={busy === `${booking.reference}:cancel`} disabled={busy !== null} onConfirm={() => void act(booking.reference, 'cancel')} />
              ) : null}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function NewBookingSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
  const { items } = useDashboard();
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
        toast(result.message || 'Could not create the booking.', 'error');
        return;
      }
      toast(`Booking ${result.booking?.reference ?? ''} created.`);
      reset();
      onClose();
      await onCreated();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create the booking.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New booking</SheetTitle>
          <SheetDescription>For phone or walk-in rentals. It's confirmed straight away, with no checkout.</SheetDescription>
        </SheetHeader>
        {active.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">Add an active item first.</p>
        ) : (
          <div className="flex flex-col gap-4 px-4">
            <div className="flex flex-col gap-1.5">
              <Label>Item</Label>
              <Select value={chosen} onValueChange={(value) => setItemId(value)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose an item" /></SelectTrigger>
                <SelectContent>
                  {active.map((item) => <SelectItem key={item._id} value={item._id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Dates</Label>
              <div className="rounded-lg border p-2">
                <DayPicker mode="range" selected={range} onSelect={setRange} disabled={{ before: new Date() }} excludeDisabled />
              </div>
              <p className="text-xs text-muted-foreground">
                {range?.from && range.to ? formatRange(isoDay(range.from), isoDay(range.to)) : 'Pick the pickup day, then the return day.'}
              </p>
            </div>
            <TextField id="new-qty" label="Quantity" {...numberField(quantity, setQuantity, 1)} />
            <TextField id="new-name" label="Renter name" value={renterName} onChange={(event) => setRenterName(event.target.value)} />
            <TextField id="new-email" label="Renter email" type="email" value={renterEmail} onChange={(event) => setRenterEmail(event.target.value)} />
          </div>
        )}
        <SheetFooter>
          <Button loading={saving} disabled={!ready || saving} onClick={() => void create()}>Create booking</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
