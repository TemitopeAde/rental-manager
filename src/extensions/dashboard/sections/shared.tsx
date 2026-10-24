import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Inbox, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { api } from '@/dashboard/client';
import { cn } from '@/lib/utils';

export type BookingStatus = 'hold' | 'pending' | 'confirmed' | 'active' | 'returned' | 'cancelled' | 'overdue' | 'expired';

export interface BookingRow {
  _id: string;
  reference: string;
  itemId: string;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  quantity: number;
  ecomOrderId: string;
  refundNeeded: boolean;
  renter: { name: string; email: string; phone?: string };
  quote: { days: number; rental: number; deposit: number; total: number };
  depositOutcome?: { outcome: 'released' | 'kept'; amountKept: number; note: string };
  changeRequest?: {
    type: 'dates' | 'cancel';
    startDate: string;
    endDate: string;
    quote: { days: number; rental: number; deposit: number; total: number };
    status: 'pending' | 'declined';
  };
}

export interface ItemRow {
  _id: string;
  name: string;
  description: string;
  category: string;
  dailyRate: number;
  weeklyRate: number;
  depositAmount: number;
  unitCount: number;
  minDays: number;
  maxDays: number;
  bufferDays: number;
  leadDays: number;
  status: 'active' | 'hidden' | 'archived';
  storeProductId?: string;
  storeRentalOverride: 'inherit' | 'enabled' | 'disabled';
}

export interface Settings {
  timezone: string;
  pickupHour: string;
  returnHour: string;
  approvalMode: 'auto' | 'manual';
  defaultBufferDays: number;
  defaultMinDays: number;
  defaultMaxDays: number;
  defaultLeadDays: number;
  countReturnDay: boolean;
  currency: string;
  storeCategoryId: string;
  storeCategoryName: string;
  storeCategoryVersion?: 'V1_CATALOG' | 'V3_CATALOG';
}

export interface StoreCategoryRow {
  id: string;
  name: string;
  version: 'V1_CATALOG' | 'V3_CATALOG';
}

export interface Plan {
  tier: 'free' | 'starter' | 'pro';
  label: 'Basic' | 'Pro' | 'Business' | 'Business trial';
  maxItems: number | null;
  maxBookingsPerMonth: number | null;
  manualApproval: boolean;
  perItemRules: boolean;
  calendar: boolean;
  trialAvailable: boolean;
  trialActive: boolean;
  trialEnded: boolean;
  trialEndDate?: string;
  upgradeUrl?: string;
}

// ---------- Shared data: settings, plan and items are needed by every tab ----------

interface DashboardData {
  settings: Settings | null;
  plan: Plan | null;
  items: ItemRow[];
  storeCategories: StoreCategoryRow[];
  storeCatalogVersion: 'V1_CATALOG' | 'V3_CATALOG' | 'STORES_NOT_INSTALLED';
  /** False for items past the plan's limit after a downgrade: kept and editable, but not bookable. */
  canBook: (id: string) => boolean;
  itemName: (id: string) => string;
  money: (amount: number) => string;
  reload: () => Promise<void>;
}

const DataContext = createContext<DashboardData | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [bookableIds, setBookableIds] = useState<Set<string> | null>(null);
  const [storeCategories, setStoreCategories] = useState<StoreCategoryRow[]>([]);
  const [storeCatalogVersion, setStoreCatalogVersion] = useState<DashboardData['storeCatalogVersion']>('STORES_NOT_INSTALLED');

  const reload = useCallback(async () => {
    const [config, catalog, stores] = await Promise.all([
      api<{ settings: Settings; plan: Plan }>('/api/rentals/settings'),
      api<{ items: ItemRow[]; bookableIds: string[] | null }>('/api/rentals/items'),
      api<{ version: DashboardData['storeCatalogVersion']; categories: StoreCategoryRow[] }>('/api/rentals/store-categories'),
    ]);
    setSettings(config.settings);
    setPlan(config.plan);
    setItems(catalog.items);
    setBookableIds(catalog.bookableIds ? new Set(catalog.bookableIds) : null);
    setStoreCategories(stores.categories);
    setStoreCatalogVersion(stores.version);
  }, []);

  useEffect(() => {
    reload().catch(() => undefined);
  }, [reload]);

  const currency = settings?.currency;
  const value: DashboardData = {
    settings,
    plan,
    items,
    canBook: (id) => bookableIds === null || bookableIds.has(id),
    storeCategories,
    storeCatalogVersion,
    itemName: (id) => items.find((item) => item._id === id)?.name ?? 'Unknown item',
    money: (amount) => formatMoney(amount, currency),
    reload,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDashboard(): DashboardData {
  const value = useContext(DataContext);
  if (!value) throw new Error('useDashboard must be used inside DashboardDataProvider');
  return value;
}

// Loads one endpoint and exposes loading/error state plus a reload.
export function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      setData(await load());
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Something went wrong.');
    }
    // `load` is an inline arrow per caller; refreshing on identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, error, refresh };
}

// ---------- Formatting ----------

export function formatMoney(amount: number, currency?: string): string {
  if (!currency) return amount.toLocaleString();
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function parseDay(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDay(iso: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  if (!iso) return '—';
  return parseDay(iso).toLocaleDateString(undefined, options);
}

export function formatRange(start: string, end: string): string {
  return `${formatDay(start)} – ${formatDay(end)}`;
}

// ---------- Status ----------

const statusStyle: Record<BookingStatus, { label: string; className: string }> = {
  hold: { label: 'On hold', className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  pending: { label: 'Needs approval', className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300' },
  active: { label: 'Out on rent', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300' },
  returned: { label: 'Returned', className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-500 line-through dark:bg-slate-500/15' },
  expired: { label: 'Expired', className: 'bg-slate-100 text-slate-500 dark:bg-slate-500/15' },
};

export const statusOrder: BookingStatus[] = ['pending', 'confirmed', 'active', 'overdue', 'returned', 'cancelled', 'hold', 'expired'];

export function statusLabel(status: BookingStatus): string {
  return statusStyle[status]?.label ?? status;
}

export function StatusBadge({ status, refundNeeded }: { status: BookingStatus; refundNeeded?: boolean }) {
  const style = statusStyle[status] ?? statusStyle.expired;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant="secondary" className={cn('border-0 font-medium', style.className)}>{style.label}</Badge>
      {refundNeeded ? <Badge variant="destructive">Refund due</Badge> : null}
    </span>
  );
}

// The next step a booking can take from its current status.
export function nextAction(status: BookingStatus): { action: string; label: string } | null {
  if (status === 'pending') return { action: 'approve', label: 'Approve' };
  if (status === 'confirmed') return { action: 'pickup', label: 'Mark picked up' };
  if (status === 'active' || status === 'overdue') return { action: 'returned', label: 'Mark returned' };
  return null;
}

export function canCancel(status: BookingStatus): boolean {
  return !['cancelled', 'returned', 'expired'].includes(status);
}

// ---------- Layout pieces ----------

export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{message}</span>
        {onRetry ? <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button> : null}
      </AlertDescription>
    </Alert>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }: {
  icon?: typeof Inbox;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
        <div className="flex max-w-sm flex-col gap-1">
          <p className="font-medium">{title}</p>
          {children ? <p className="text-sm text-muted-foreground">{children}</p> : null}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
      </div>
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-12 rounded-lg" />)}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'default', onClick }: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: typeof Inbox;
  tone?: 'default' | 'warning' | 'danger' | 'success';
  onClick?: () => void;
}) {
  const tones = {
    default: 'bg-primary/10 text-primary',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    danger: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  };
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex items-start justify-between gap-3 rounded-xl border bg-card p-4 text-left shadow-xs',
        onClick && 'transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', tones[tone])}>
        <Icon className="size-4" />
      </span>
    </Wrapper>
  );
}

export function SectionHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// Props for a numeric <TextField>. A 0 shows as an empty field rather than a "0" the user has to
// delete, and clearing the field stores 0. Values under `min` are allowed while typing (so "1"
// can be replaced by "3") and raised to `min` when the field loses focus.
export function numberField(value: number, onChange: (value: number) => void, min = 0) {
  return {
    type: 'number',
    inputMode: 'decimal' as const,
    min,
    value: value === 0 ? '' : value,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(event.target.value);
      onChange(event.target.value === '' || !Number.isFinite(parsed) ? 0 : parsed);
    },
    onBlur: () => {
      if (value < min) onChange(min);
    },
  };
}

export function TextField({ id, label, hint, tip, error, className, ...props }: React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  hint?: string;
  tip?: string;
  error?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-1">
        <Label htmlFor={id}>{label}</Label>
        {tip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`About ${label}`}>
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{tip}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <Input id={id} aria-invalid={error ? true : undefined} {...props} />
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// A destructive button that asks for a second click before acting.
export function ConfirmButton({ label, confirmLabel, onConfirm, disabled, loading }: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <Button
      variant="destructive"
      loading={loading}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}
