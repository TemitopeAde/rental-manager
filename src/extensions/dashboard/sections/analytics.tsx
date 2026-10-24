import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, ChartColumn, Gauge, Receipt, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/dashboard/client';
import { cn } from '@/lib/utils';
import { ErrorState, formatDay, formatMoney, LoadingState, SectionHeader, StatusBadge, type BookingRow } from './shared';

type RangeKey = '7d' | '30d' | '90d' | '12m';
type Bucket = 'day' | 'week' | 'month';

interface Totals {
  revenue: number;
  bookings: number;
  averageValue: number;
  averageDays: number;
  depositsKept: number;
  cancelled: number;
}

interface Analytics {
  range: RangeKey;
  from: string;
  to: string;
  bucket: Bucket;
  currency: string;
  current: Totals & { utilization: number };
  previous: Totals;
  series: Array<{ key: string; revenue: number; bookings: number }>;
  items: Array<{ itemId: string; name: string; revenue: number; bookings: number; utilization: number }>;
  statuses: Record<string, number>;
  partial: boolean;
}

const ranges: Array<{ id: RangeKey; label: string; previous: string }> = [
  { id: '7d', label: 'Last 7 days', previous: 'previous 7 days' },
  { id: '30d', label: 'Last 30 days', previous: 'previous 30 days' },
  { id: '90d', label: 'Last 90 days', previous: 'previous 90 days' },
  { id: '12m', label: 'Last 12 months', previous: 'previous 12 months' },
];

const statusOrder: BookingRow['status'][] = ['pending', 'confirmed', 'active', 'overdue', 'returned', 'cancelled'];

function compactMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(amount);
  } catch {
    return String(amount);
  }
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function bucketLabel(key: string, bucket: Bucket, long = false): string {
  if (bucket === 'month') return formatDay(key, long ? { month: 'long', year: 'numeric' } : { month: 'short' });
  const day = formatDay(key, long ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' });
  return bucket === 'week' && long ? `Week of ${day}` : day;
}

// Signed change against the previous period. Direction is spelled out with an arrow, never color alone.
function Delta({ now, before, previous }: { now: number; before: number; previous: string }) {
  if (before === 0) {
    return <span className="text-xs text-muted-foreground">{now === 0 ? `No change vs ${previous}` : `New vs ${previous}`}</span>;
  }
  const change = (now - before) / before;
  if (Math.abs(change) < 0.005) return <span className="text-xs text-muted-foreground">No change vs {previous}</span>;
  const up = change > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs">
      <span className={cn('inline-flex items-center font-medium', up ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
        <Icon className="size-3.5" aria-hidden />
        {up ? '+' : '−'}{Math.abs(Math.round(change * 100))}%
      </span>
      <span className="text-muted-foreground">vs {previous}</span>
    </span>
  );
}

function Kpi({ label, value, icon: Icon, children }: { label: string; value: string; icon: typeof Wallet; children?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {children}
      </div>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
    </div>
  );
}

// Only the fields this tooltip reads; recharts' own content props are generic over every value type.
interface TooltipState {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown; payload?: unknown }>;
}

function ChartTooltip({ active, payload, bucket, format }: TooltipState & { bucket: Bucket; format: (value: number) => string }) {
  const point = payload?.[0];
  if (!active || !point) return null;
  const key = (point.payload as { key: string }).key;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="text-xs text-muted-foreground">{bucketLabel(key, bucket, true)}</div>
      <div className="font-semibold tabular-nums">{format(Number(point.value ?? 0))}</div>
    </div>
  );
}

// One measure per chart: revenue and booking counts have different scales, so they never share an axis.
function ColumnChart({ data, dataKey, bucket, format, axisFormat, label }: {
  data: Analytics['series'];
  dataKey: 'revenue' | 'bookings';
  bucket: Bucket;
  format: (value: number) => string;
  axisFormat: (value: number) => string;
  label: string;
}) {
  return (
    <div className="h-60 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
          <XAxis
            dataKey="key"
            tickFormatter={(key: string) => bucketLabel(key, bucket)}
            tickLine={false}
            axisLine={{ stroke: 'var(--viz-grid)' }}
            tick={{ fill: 'var(--viz-axis)', fontSize: 12 }}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={axisFormat}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--viz-axis)', fontSize: 12 }}
            width={56}
          />
          <Tooltip
            cursor={{ fill: 'var(--viz-grid)', opacity: 0.5 }}
            content={(props) => <ChartTooltip {...props} bucket={bucket} format={format} />}
          />
          <Bar dataKey={dataKey} fill="var(--viz-series)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-20 overflow-hidden rounded-full"
        style={{ background: 'var(--viz-track)' }}
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: 'var(--viz-series)' }} />
      </div>
      <span className="w-9 text-right text-sm tabular-nums">{percent(value)}</span>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-muted/50 px-3 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

export function AnalyticsSection() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async (next: RangeKey) => {
    try {
      setData(await api<Analytics>(`/api/rentals/analytics?range=${next}`));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Something went wrong.');
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  const header = (
    <SectionHeader title="Analytics" description="Revenue, bookings and how busy your items are, by pickup date." />
  );
  const picker = (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Date range">
      {ranges.map((entry) => (
        <button
          key={entry.id}
          type="button"
          role="tab"
          aria-selected={range === entry.id}
          onClick={() => setRange(entry.id)}
          className={cn(
            'inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors',
            range === entry.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
          )}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );

  if (error) return <div className="flex flex-col gap-4">{header}{picker}<ErrorState title="Could not load analytics" message={error} onRetry={() => void load(range)} /></div>;
  // Only the first load shows a skeleton; switching range keeps the last figures up until the new ones land.
  if (!data) return <div className="flex flex-col gap-4">{header}{picker}<LoadingState /></div>;

  const money = (amount: number) => formatMoney(amount, data.currency);
  const previous = ranges.find((entry) => entry.id === data.range)?.previous ?? 'previous period';
  const { current } = data;
  const hasBookings = current.bookings > 0;
  const statuses = statusOrder.filter((status) => data.statuses[status]);
  const busiest = data.items.filter((item) => item.bookings > 0 || item.utilization > 0).slice(0, 8);
  const period = `${formatDay(data.from, { month: 'short', day: 'numeric', year: 'numeric' })} – ${formatDay(data.to, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="flex flex-col gap-4">
      {header}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {picker}
        <span className="text-xs text-muted-foreground">{period}</span>
      </div>

      {data.partial ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          This range has more than 1,000 bookings, so the figures cover the first 1,000. Pick a shorter range for exact numbers.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Rental revenue" value={money(current.revenue)} icon={Wallet}>
          <Delta now={current.revenue} before={data.previous.revenue} previous={previous} />
        </Kpi>
        <Kpi label="Bookings" value={current.bookings.toLocaleString()} icon={ChartColumn}>
          <Delta now={current.bookings} before={data.previous.bookings} previous={previous} />
        </Kpi>
        <Kpi label="Average booking" value={money(current.averageValue)} icon={Receipt}>
          <Delta now={current.averageValue} before={data.previous.averageValue} previous={previous} />
        </Kpi>
        <Kpi label="Utilization" value={percent(current.utilization)} icon={Gauge}>
          <span className="text-xs text-muted-foreground">Unit-days rented out of all available</span>
        </Kpi>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Rental revenue</CardTitle>
            <CardDescription>Rental charges by pickup {data.bucket}. Deposits aren't revenue and are left out.</CardDescription>
          </div>
          {hasBookings ? (
            <button type="button" className="shrink-0 text-sm text-primary hover:underline" onClick={() => setShowTable((value) => !value)}>
              {showTable ? 'Show chart' : 'Show table'}
            </button>
          ) : null}
        </CardHeader>
        <CardContent>
          {!hasBookings ? (
            <Empty>No paid bookings picked up in this range yet.</Empty>
          ) : showTable ? (
            <div className="max-h-72 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{data.bucket === 'month' ? 'Month' : data.bucket === 'week' ? 'Week' : 'Day'}</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.series.map((point) => (
                    <TableRow key={point.key}>
                      <TableCell>{bucketLabel(point.key, data.bucket, true)}</TableCell>
                      <TableCell className="text-right tabular-nums">{point.bookings}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(point.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <ColumnChart
              data={data.series}
              dataKey="revenue"
              bucket={data.bucket}
              format={money}
              axisFormat={(value) => compactMoney(value, data.currency)}
              label={`Rental revenue by ${data.bucket}, ${period}. Total ${money(current.revenue)}.`}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <CardHeader>
            <CardTitle>Bookings</CardTitle>
            <CardDescription>Paid bookings by pickup {data.bucket}.</CardDescription>
          </CardHeader>
          <CardContent>
            {hasBookings ? (
              <ColumnChart
                data={data.series}
                dataKey="bookings"
                bucket={data.bucket}
                format={(value) => `${value} ${value === 1 ? 'booking' : 'bookings'}`}
                axisFormat={(value) => value.toLocaleString(undefined, { notation: 'compact' })}
                label={`Bookings by ${data.bucket}, ${period}. Total ${current.bookings}.`}
              />
            ) : (
              <Empty>No paid bookings picked up in this range yet.</Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>At a glance</CardTitle>
            <CardDescription>Bookings picked up in this range.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Average length</dt><dd className="font-semibold">{current.averageDays ? `${current.averageDays} days` : '—'}</dd></div>
              <div><dt className="text-muted-foreground">Deposits kept</dt><dd className="font-semibold">{money(current.depositsKept)}</dd></div>
              <div><dt className="text-muted-foreground">Cancellations</dt><dd className="font-semibold">{current.cancelled}</dd></div>
            </dl>
            {statuses.length ? (
              <ul className="flex flex-col gap-2 border-t pt-4">
                {statuses.map((status) => (
                  <li key={status} className="flex items-center justify-between text-sm">
                    <StatusBadge status={status} />
                    <span className="tabular-nums">{data.statuses[status]}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>Ranked by rental revenue. Utilization counts every day an item was out in this range.</CardDescription>
        </CardHeader>
        <CardContent>
          {busiest.length === 0 ? (
            <Empty>Your items haven't been rented in this range yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {busiest.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.bookings}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(item.revenue)}</TableCell>
                    <TableCell><Meter value={item.utilization} label={`${item.name} utilization`} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
