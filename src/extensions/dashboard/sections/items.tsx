import { useState } from 'react';
import { Package, Pencil, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { post } from '@/dashboard/client';
import { cn } from '@/lib/utils';
import { EmptyState, LoadingState, numberField, SectionHeader, TextField, useDashboard, type ItemRow } from './shared';
import { StoreProductPicker } from './store-product-picker';
import { useToast } from './toast';

const statusTone: Record<ItemRow['status'], string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  hidden: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
  archived: 'bg-slate-100 text-slate-500 dark:bg-slate-500/15',
};

const statusName: Record<ItemRow['status'], string> = { active: 'Bookable', hidden: 'Hidden', archived: 'Archived' };

export function ItemsSection() {
  const { items, plan, settings, money, reload, canBook } = useDashboard();
  const [editing, setEditing] = useState<ItemRow | 'new' | null>(null);

  if (!plan || !settings) return <LoadingState />;

  const live = items.filter((item) => item.status !== 'archived').length;
  const atLimit = plan.maxItems !== null && live >= plan.maxItems;
  const overLimit = plan.maxItems !== null && live > plan.maxItems;
  const usage = plan.maxItems ? Math.min(100, (live / plan.maxItems) * 100) : 0;
  const upgrade = plan.upgradeUrl && !plan.trialActive ? (
    <Button asChild size="sm" variant={atLimit ? 'default' : 'outline'}>
      <a href={plan.upgradeUrl} target="_blank" rel="noreferrer">{plan.trialAvailable ? 'Start free trial' : 'Upgrade plan'}</a>
    </Button>
  ) : null;
  const limitHint = overLimit
    ? `${plan.trialEnded ? 'Your Business trial ended. ' : ''}All your items are kept, but only the oldest ${plan.maxItems === 1 ? 'item takes' : `${plan.maxItems} take`} new bookings. Existing bookings are unaffected.`
    : atLimit
      ? 'Upgrade your plan or archive an item to add more.'
      : 'Archived items don\'t count toward the limit.';

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Items"
        description="What you rent out, how much it costs, and how many you have."
        actions={<Button disabled={atLimit} onClick={() => setEditing('new')}><Plus data-icon="inline-start" />Add item</Button>}
      />

      {plan.maxItems !== null ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{live} of {plan.maxItems} items on the {plan.label} plan</span>
            <span className="text-xs text-muted-foreground">{limitHint}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted sm:w-48" role="progressbar" aria-valuenow={live} aria-valuemin={0} aria-valuemax={plan.maxItems}>
              <div className={cn('h-full rounded-full', atLimit ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${usage}%` }} />
            </div>
            {upgrade}
          </div>
        </div>
      ) : plan.trialActive ? (
        <div className="rounded-xl border bg-card p-4 text-sm">
          <span className="font-medium">Business trial:</span> unlimited items and bookings.
          <span className="text-muted-foreground"> If it ends without a subscription, only your oldest item keeps taking new bookings.</span>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Add your first rental item"
          action={<Button onClick={() => setEditing('new')}><Plus data-icon="inline-start" />Add item</Button>}
        >
          A name and a daily rate are enough to start taking bookings.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">Item</TableHead>
                <TableHead className="text-right">Per day</TableHead>
                <TableHead className="text-right">Per week</TableHead>
                <TableHead className="text-right">Deposit</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4"><span className="sr-only">Edit</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item._id} className={cn('cursor-pointer', item.status === 'archived' && 'opacity-60')} onClick={() => setEditing(item)}>
                  <TableCell className="pl-4">
                    <div className="flex flex-col">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{item.category || 'No category'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(item.dailyRate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.weeklyRate ? money(item.weeklyRate) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.depositAmount ? money(item.depositAmount) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.unitCount}</TableCell>
                  <TableCell>
                    {item.status === 'active' && !canBook(item._id) ? (
                      <Badge variant="secondary" className="border-0 bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" title="Over your plan's item limit. Upgrade to take new bookings.">Over limit</Badge>
                    ) : (
                      <Badge variant="secondary" className={cn('border-0', statusTone[item.status])}>{statusName[item.status]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${item.name}`}><Pencil /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ItemSheet
        key={editing === 'new' ? 'new' : editing?._id ?? 'closed'}
        item={editing}
        perItemRules={plan.perItemRules}
        currency={settings.currency}
        money={money}
        defaults={{ minDays: settings.defaultMinDays, maxDays: settings.defaultMaxDays, bufferDays: settings.defaultBufferDays, leadDays: settings.defaultLeadDays }}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
    </div>
  );
}

type Draft = Omit<ItemRow, '_id'>;

function ItemSheet({ item, perItemRules, currency, money, defaults, onClose, onSaved }: {
  item: ItemRow | 'new' | null;
  perItemRules: boolean;
  currency: string;
  money: (amount: number) => string;
  defaults: { minDays: number; maxDays: number; bufferDays: number; leadDays: number };
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const isNew = item === 'new';
  const [draft, setDraft] = useState<Draft>(() => (item && item !== 'new' ? { ...item } : {
    name: '',
    description: '',
    category: '',
    dailyRate: 0,
    weeklyRate: 0,
    depositAmount: 0,
    unitCount: 1,
    status: 'active',
    storeProductId: '',
    storeRentalOverride: 'inherit',
    ...defaults,
  }));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const num = (key: keyof Draft, min = 0) => numberField(draft[key] as number, (value) => set(key, value as never), min);
  const weeklyTooLow = draft.weeklyRate > 0 && draft.dailyRate > 0 && draft.weeklyRate <= draft.dailyRate;
  const rangeInvalid = draft.maxDays < draft.minDays;

  async function save() {
    setSaving(true);
    try {
      const payload = isNew ? draft : { ...draft, itemId: (item as ItemRow)._id };
      const result = await post<{ ok: boolean; message?: string }>('/api/rentals/items', payload);
      if (!result.ok) {
        toast(result.message || 'The item was not saved.', 'error');
        return;
      }
      toast(isNew ? `${draft.name} added.` : `${draft.name} saved.`);
      await onSaved();
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'The item was not saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={item !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isNew ? 'Add item' : 'Edit item'}</SheetTitle>
          <SheetDescription>Prices are in {currency}. Renters see bookable items in your catalog.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Details</legend>
            <TextField id="item-name" label="Name" value={draft.name} onChange={(event) => set('name', event.target.value)} />
            <TextField id="item-category" label="Category" placeholder="e.g. Cameras" value={draft.category} onChange={(event) => set('category', event.target.value)} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-description">Description</Label>
              <textarea
                id="item-description"
                rows={3}
                className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={draft.description}
                onChange={(event) => set('description', event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={draft.status} onValueChange={(value) => set('status', value as Draft['status'])}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Bookable</SelectItem>
                  <SelectItem value="hidden">Hidden from the site</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <StoreProductPicker
              id="store-product"
              value={draft.storeProductId ?? ''}
              formatPrice={money}
              onChange={(product) => setDraft((current) => ({
                ...current,
                storeProductId: product?.id ?? '',
                name: current.name || product?.name || '',
              }))}
            />
            <div className="flex flex-col gap-1.5">
              <Label>Store rental eligibility</Label>
              <Select value={draft.storeRentalOverride ?? 'inherit'} onValueChange={(value) => set('storeRentalOverride', value as Draft['storeRentalOverride'])}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Follow selected category</SelectItem>
                  <SelectItem value="enabled">Always show rental controls</SelectItem>
                  <SelectItem value="disabled">Never show rental controls</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Category membership is evaluated live on Store product pages.</p>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Pricing & stock</legend>
            <div className="grid grid-cols-2 gap-3">
              <TextField id="item-daily" label="Daily rate" step="0.01" tip="What renters pay for each day. A Monday pickup with a Wednesday return is 2 days." {...num('dailyRate')} />
              <TextField
                id="item-weekly"
                label="Weekly rate"
                step="0.01"
                tip="The price for a full 7 days, not per day. Renters pay whichever is cheaper, so any rental of 1–7 days never costs more than this. Set it above the daily rate, usually 5–6× (e.g. daily 30 → weekly 150–180)."
                hint="Leave empty to use the daily rate"
                error={weeklyTooLow ? `Must be more than the daily rate (${money(draft.dailyRate)}), or every rental up to 7 days costs ${money(draft.weeklyRate)}.` : undefined}
                {...num('weeklyRate')}
              />
              <TextField id="item-deposit" label="Deposit" step="0.01" tip="Refundable amount charged per unit at checkout, on top of the rental price. Set 0 for no deposit." {...num('depositAmount')} />
              <TextField id="item-units" label="Units you own" tip="How many of this item can be out on rent at the same time." {...num('unitCount', 1)} />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Rental rules</legend>
            <div className="grid grid-cols-2 gap-3">
              <TextField id="item-min" label="Minimum days" tip="Shortest rental renters can book, counted in days from pickup to return." {...num('minDays', 1)} />
              <TextField id="item-max" label="Maximum days" tip="Longest rental renters can book." error={rangeInvalid ? 'Must be at least the minimum days.' : undefined} {...num('maxDays', 1)} />
              <TextField id="item-buffer" label="Buffer days" hint="Gap between rentals" tip="Days kept free after each return for cleaning or repairs before the next pickup." disabled={!perItemRules && !isNew} {...num('bufferDays')} />
              <TextField id="item-lead" label="Lead days" hint="Notice before pickup" tip="How many days ahead renters must book. 0 allows same-day pickup." disabled={!perItemRules && !isNew} {...num('leadDays')} />
            </div>
            {!perItemRules ? <p className="text-xs text-muted-foreground">Per-item buffer and lead days are on the Business plan; your defaults from Settings apply.</p> : null}
          </fieldset>
        </div>

        <SheetFooter>
          <Button loading={saving} disabled={saving || !draft.name || draft.dailyRate <= 0 || weeklyTooLow || rangeInvalid} onClick={() => void save()}>
            {isNew ? 'Add item' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
