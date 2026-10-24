import { createContext, useContext, useEffect, useRef, useState, type MouseEvent } from 'react';
import { DayPicker, type DayButtonProps } from 'react-day-picker';
import { CalendarRange, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/dashboard/client';
import { cn } from '@/lib/utils';
import { BookingSheet, useBookingActions } from './bookings';
import {
  EmptyState,
  ErrorState,
  formatDay,
  isoDay,
  LoadingState,
  SectionHeader,
  StatusBadge,
  useDashboard,
  useResource,
  type BookingRow,
  type BookingStatus,
} from './shared';

const hidden: BookingStatus[] = ['cancelled', 'expired', 'hold'];

const chipTone: Partial<Record<BookingStatus, string>> = {
  pending: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  confirmed: 'bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-200',
  active: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200',
  overdue: 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200',
  returned: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
};

function onDay(rows: BookingRow[], iso: string) {
  return rows.filter((row) => row.startDate <= iso && iso <= row.endDate);
}

// MonthDay is passed to DayPicker as a component, so it must keep a stable identity;
// the bookings it draws come through context instead of a closure.
const MonthData = createContext<{
  rows: BookingRow[];
  itemName: (id: string) => string;
  onBookingClick: (id: string) => void;
}>({ rows: [], itemName: () => '', onBookingClick: () => undefined });

function MonthDay({ day: calendarDay, modifiers, className, ...button }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);
  const { rows, itemName, onBookingClick } = useContext(MonthData);
  const iso = isoDay(calendarDay.date);
  const bookings = onDay(rows, iso);
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    button.onClick?.(event);
    if (bookings.length === 1) onBookingClick(bookings[0]._id);
  };
  return (
    <button
      ref={ref}
      {...button}
      onClick={handleClick}
      className={cn(
        'flex h-full min-h-20 w-full flex-col items-stretch gap-1 rounded-lg border border-transparent p-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-24',
        modifiers.outside && 'opacity-40',
        modifiers.selected && 'border-primary bg-primary/5',
        className,
      )}
    >
      <span
        className={cn(
          'grid size-6 place-items-center self-end rounded-full text-xs tabular-nums',
          modifiers.today && 'bg-primary font-semibold text-primary-foreground',
        )}
      >
        {calendarDay.date.getDate()}
      </span>
      <span className="flex flex-col gap-0.5">
        {bookings.slice(0, 2).map((row) => (
          <span key={row._id} className={cn('truncate rounded px-1 py-px text-[0.7rem] leading-tight', chipTone[row.status])}>
            {row.startDate === iso ? '↑ ' : row.endDate === iso ? '↓ ' : ''}{itemName(row.itemId)}
          </span>
        ))}
        {bookings.length > 2 ? <span className="px-1 text-[0.7rem] text-muted-foreground">+{bookings.length - 2} more</span> : null}
      </span>
    </button>
  );
}

export function CalendarSection() {
  const { plan, itemName } = useDashboard();
  const { data, error, refresh } = useResource(() => api<{ bookings: BookingRow[] }>('/api/rentals/bookings'));
  const { act, busy } = useBookingActions(refresh);
  const [day, setDay] = useState<Date>(new Date());
  const [openId, setOpenId] = useState<string | null>(null);

  if (plan && !plan.calendar) {
    return (
      <EmptyState icon={Lock} title="The calendar is on the Business plan">
        Upgrade to see every rental on one month view, with pickups and returns for any day.
      </EmptyState>
    );
  }
  if (error) return <ErrorState title="Could not load the calendar" message={error} onRetry={() => void refresh()} />;
  if (!data || !plan) return <LoadingState rows={6} />;

  const rows = data.bookings.filter((row) => !hidden.includes(row.status));
  const selectedIso = isoDay(day);
  const dayRows = onDay(rows, selectedIso);
  const pickups = dayRows.filter((row) => row.startDate === selectedIso);
  const returns = dayRows.filter((row) => row.endDate === selectedIso);
  const ongoing = dayRows.filter((row) => row.startDate !== selectedIso && row.endDate !== selectedIso);
  const selected = data.bookings.find((row) => row._id === openId) ?? null;

  const group = (title: string, list: BookingRow[]) => list.length === 0 ? null : (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title} · {list.length}</h3>
      <ul className="flex flex-col gap-2">
        {list.map((row) => (
          <li key={row._id}>
            <button type="button" onClick={() => setOpenId(row._id)} className="flex w-full flex-col gap-1 rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/50">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{itemName(row.itemId)}{row.quantity > 1 ? ` × ${row.quantity}` : ''}</span>
                <StatusBadge status={row.status} />
              </span>
              <span className="truncate text-xs text-muted-foreground">{row.renter.name || row.reference} · {formatDay(row.startDate)} – {formatDay(row.endDate)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <MonthData.Provider value={{ rows, itemName, onBookingClick: setOpenId }}>
    <div className="flex flex-col gap-4">
      <SectionHeader title="Calendar" description="Every rental on one month. Pick a day to see who's coming and going." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="py-4">
          <CardContent className="px-3 sm:px-4">
            <DayPicker
              mode="single"
              required
              selected={day}
              onSelect={setDay}
              showOutsideDays
              fixedWeeks
              components={{ DayButton: MonthDay }}
              classNames={{
                root: 'relative w-full',
                months: 'w-full',
                month: 'flex w-full flex-col gap-3',
                month_caption: 'flex h-8 items-center px-1',
                caption_label: 'text-base font-semibold',
                nav: 'absolute top-0 right-0 flex gap-1',
                button_previous: 'grid size-8 place-items-center rounded-md border bg-background hover:bg-muted disabled:opacity-40',
                button_next: 'grid size-8 place-items-center rounded-md border bg-background hover:bg-muted disabled:opacity-40',
                chevron: 'size-4 fill-current',
                month_grid: 'w-full table-fixed border-separate border-spacing-1',
                weekdays: '',
                weekday: 'pb-1 text-xs font-medium text-muted-foreground',
                week: '',
                day: 'p-0 align-top',
                day_button: '',
                today: '',
                outside: '',
                selected: '',
              }}
            />
            <div className="mt-3 flex flex-wrap gap-3 px-1 text-xs text-muted-foreground">
              {(['pending', 'confirmed', 'active', 'overdue', 'returned'] as const).map((status) => (
                <span key={status} className="inline-flex items-center gap-1.5">
                  <span className={cn('size-2.5 rounded-sm', chipTone[status])} />
                  <StatusLabel status={status} />
                </span>
              ))}
              <span>↑ pickup · ↓ return</span>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit xl:sticky xl:top-4">
          <CardHeader>
            <CardTitle>{day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</CardTitle>
            <CardDescription>{dayRows.length === 0 ? 'Nothing on this day.' : `${dayRows.length} ${dayRows.length === 1 ? 'rental' : 'rentals'}`}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {dayRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/50 py-8 text-center text-sm text-muted-foreground">
                <CalendarRange className="size-5" />
                All items are free.
              </div>
            ) : null}
            {group('Pickups', pickups)}
            {group('Returns', returns)}
            {group('Out on rent', ongoing)}
          </CardContent>
        </Card>
      </div>

      <BookingSheet key={selected?._id} booking={selected} onClose={() => setOpenId(null)} act={act} busy={busy} />
    </div>
    </MonthData.Provider>
  );
}

function StatusLabel({ status }: { status: BookingStatus }) {
  const labels: Partial<Record<BookingStatus, string>> = {
    pending: 'Needs approval',
    confirmed: 'Confirmed',
    active: 'Out on rent',
    overdue: 'Overdue',
    returned: 'Returned',
  };
  return <>{labels[status]}</>;
}
