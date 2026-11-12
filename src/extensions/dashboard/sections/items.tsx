import { useState } from 'react';
import { ImagePlus, Package, Pencil, Plus, Search, ShoppingBag, Trash2, X } from 'lucide-react';
import { dashboard } from '@wix/dashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { post } from '@/dashboard/client';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { EmptyState, LoadingState, numberField, SectionHeader, TextField, useDashboard, type ItemRow } from './shared';
import { StoreProductPicker } from './store-product-picker';
import { useToast } from './toast';
import { DeleteItemDialog } from './delete-item-dialog';
import { StoreImportDialog } from './store-import-dialog';
import { ItemsBulkBar, SelectBox } from './items-bulk';

const statusTone: Record<ItemRow['status'], string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  hidden: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
  archived: 'bg-slate-100 text-slate-500 dark:bg-slate-500/15',
};

/** Rows rendered at a time; stores that import their whole catalog can have thousands of items. */
const ROWS_PER_PAGE = 100;

export function ItemsSection() {
  const { items, plan, settings, money, reload, canBook, loading, storeCatalogVersion } = useDashboard();
  const { t } = useI18n();
  const [editing, setEditing] = useState<ItemRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ItemRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(ROWS_PER_PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (loading || !plan || !settings) return <LoadingState />;

  const live = items.filter((item) => item.status !== 'archived').length;
  const atLimit = plan.maxItems !== null && live >= plan.maxItems;
  const overLimit = plan.maxItems !== null && live > plan.maxItems;
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? items.filter((item) => item.name.toLowerCase().includes(needle) || item.category.toLowerCase().includes(needle))
    : items;
  const visible = filtered.slice(0, shown);
  // Drop selections for items that no longer exist (deleted, or reloaded away).
  const selectedIds = items.filter((item) => selected.has(item._id)).map((item) => item._id);
  const visibleSelected = visible.filter((item) => selected.has(item._id)).length;
  const allVisibleSelected = visible.length > 0 && visibleSelected === visible.length;
  const allFilteredSelected = filtered.length > 0 && filtered.every((item) => selected.has(item._id));
  const toggleOne = (id: string, on: boolean) => setSelected((current) => {
    const next = new Set(current);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  });
  const toggleVisible = (on: boolean) => setSelected((current) => {
    const next = new Set(current);
    visible.forEach((item) => (on ? next.add(item._id) : next.delete(item._id)));
    return next;
  });
  const storesInstalled = storeCatalogVersion !== 'STORES_NOT_INSTALLED';
  const slotsLeft = plan.maxItems === null ? null : Math.max(0, plan.maxItems - live);
  const importButton = storesInstalled ? (
    <Button variant="outline" disabled={atLimit} onClick={() => setImporting(true)}>
      <ShoppingBag data-icon="inline-start" />{t('store_import.open')}
    </Button>
  ) : null;
  const usage = plan.maxItems ? Math.min(100, (live / plan.maxItems) * 100) : 0;
  const upgrade = plan.upgradeUrl && !plan.trialActive ? (
    <Button asChild size="sm" variant={atLimit ? 'default' : 'outline'}>
      <a href={plan.upgradeUrl} target="_blank" rel="noreferrer">
        {plan.trialAvailable ? t('action.start_free_trial') : t('action.upgrade_plan')}
      </a>
    </Button>
  ) : null;
  const limitHint = overLimit
    ? `${plan.trialEnded ? t('items.limit_hint_trial_ended') : ''}${
        plan.maxItems === 1
          ? t('items.limit_hint_over_singular')
          : t('items.limit_hint_over', { count: plan.maxItems ?? 0 })
      }`
    : atLimit
      ? t('items.limit_hint_at_limit')
      : t('items.limit_hint_below');

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title={t('items.title')}
        description={t('items.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            {importButton}
            <Button disabled={atLimit} onClick={() => setEditing('new')}>
              <Plus data-icon="inline-start" />{t('action.add_item')}
            </Button>
          </div>
        }
      />

      {plan.maxItems !== null ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">
              {t('items.plan_limit_summary', { live, max: plan.maxItems, plan: plan.label })}
            </span>
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
          <span className="font-medium">{t('items.trial_active_title')}</span> {t('items.trial_active_desc')}
          <span className="text-muted-foreground">{t('items.trial_active_sub')}</span>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('items.empty_title')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {importButton}
              <Button onClick={() => setEditing('new')}><Plus data-icon="inline-start" />{t('action.add_item')}</Button>
            </div>
          }
        >
          {t('items.empty_desc')}
          {storesInstalled ? ` ${t('store_import.empty_hint')}` : ''}
        </EmptyState>
      ) : (
        <>
        {items.length > 10 ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                className="pl-8"
                placeholder={t('items.search_placeholder')}
                aria-label={t('items.search_placeholder')}
                value={query}
                onChange={(event) => { setQuery(event.target.value); setShown(ROWS_PER_PAGE); }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{t('items.showing', { shown: visible.length, total: filtered.length })}</span>
          </div>
        ) : null}
        {selectedIds.length > 0 ? (
          <ItemsBulkBar selectedIds={selectedIds} onClear={() => setSelected(new Set())} onDone={reload} />
        ) : null}
        {allVisibleSelected && filtered.length > visible.length && !allFilteredSelected ? (
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-center text-sm">
            {t('items_bulk.page_selected', { count: visible.length })}{' '}
            <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => setSelected(new Set(filtered.map((item) => item._id)))}>
              {needle ? t('items_bulk.select_all_matching', { count: filtered.length }) : t('items_bulk.select_all_items', { count: filtered.length })}
            </button>
          </div>
        ) : null}
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <SelectBox
                    label={t('items_bulk.select_page')}
                    checked={allVisibleSelected}
                    indeterminate={visibleSelected > 0 && !allVisibleSelected}
                    onChange={toggleVisible}
                  />
                </TableHead>
                <TableHead>{t('items.col_item')}</TableHead>
                <TableHead className="text-right">{t('items.col_per_day')}</TableHead>
                <TableHead className="text-right">{t('items.col_per_week')}</TableHead>
                <TableHead className="text-right">{t('items.col_deposit')}</TableHead>
                <TableHead className="text-right">{t('items.col_units')}</TableHead>
                <TableHead>{t('items.col_status')}</TableHead>
                <TableHead className="pr-4"><span className="sr-only">{t('common.edit')}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => (
                <TableRow
                  key={item._id}
                  data-state={selected.has(item._id) ? 'selected' : undefined}
                  className={cn('cursor-pointer', item.status === 'archived' && 'opacity-60')}
                  onClick={() => setEditing(item)}
                >
                  <TableCell className="w-10 pl-4" onClick={(event) => event.stopPropagation()}>
                    <SelectBox label={t('items_bulk.select_item', { name: item.name })} checked={selected.has(item._id)} onChange={(on) => toggleOne(item._id, on)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{item.category || t('items.no_category')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(item.dailyRate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.weeklyRate ? money(item.weeklyRate) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.depositAmount ? money(item.depositAmount) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.unitCount}</TableCell>
                  <TableCell>
                    {item.status === 'active' && !canBook(item._id) ? (
                      <Badge variant="secondary" className="border-0 bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" title={t('status.over_limit_tooltip')}>
                        {t('status.over_limit')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className={cn('border-0', statusTone[item.status])}>
                        {t(`items.status_${item.status}`)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={t('items.col_edit_aria', { name: item.name })}><Pencil /></Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={t('items.delete_aria', { name: item.name })}
                        onClick={(event) => { event.stopPropagation(); setDeleting(item); }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('items.no_search_results', { search: query })}</p>
          ) : null}
        </Card>
        {filtered.length > visible.length ? (
          <Button variant="outline" className="self-center" onClick={() => setShown((count) => count + ROWS_PER_PAGE)}>
            {t('items.show_more', { count: Math.min(ROWS_PER_PAGE, filtered.length - visible.length) })}
          </Button>
        ) : null}
        </>
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

      {storesInstalled ? (
        <StoreImportDialog
          open={importing}
          onOpenChange={setImporting}
          slotsLeft={slotsLeft}
          money={money}
          onImported={reload}
        />
      ) : null}

      {deleting ? (
        <DeleteItemDialog
          item={deleting}
          open
          onOpenChange={(open) => { if (!open) setDeleting(null); }}
          onDone={async () => {
            setEditing(null);
            await reload();
          }}
        />
      ) : null}
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
  const { t } = useI18n();
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
    images: [],
    storeRentalOverride: 'inherit',
    ...defaults,
  }));
  const [saving, setSaving] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const num = (key: keyof Draft, min = 0) => numberField(draft[key] as number, (value) => set(key, value as never), min);
  const weeklyTooLow = draft.weeklyRate > 0 && draft.dailyRate > 0 && draft.weeklyRate <= draft.dailyRate;
  const rangeInvalid = draft.maxDays < draft.minDays;

  async function selectImage() {
    setPickingImage(true);
    try {
      const selection = await dashboard.openMediaManager({ category: 'IMAGE', multiSelect: false });
      const file = selection?.items[0];
      if (!file) return;
      if (!file.url) {
        toast(t('items.image_select_failed'), 'error');
        return;
      }
      set('images', [{ src: file.url, alt: file.displayName || draft.name }]);
    } catch (error) {
      toast(error instanceof Error ? error.message : t('items.image_select_failed'), 'error');
    } finally {
      setPickingImage(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload = isNew ? draft : { ...draft, itemId: (item as ItemRow)._id };
      const result = await post<{ ok: boolean; message?: string }>('/api/rentals/items', payload);
      if (!result.ok) {
        toast(result.message || t('items.toast_save_failed'), 'error');
        return;
      }
      toast(isNew ? t('items.toast_added', { name: draft.name }) : t('items.toast_saved', { name: draft.name }));
      await onSaved();
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : t('items.toast_save_failed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={item !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isNew ? t('items.sheet_add_title') : t('items.sheet_edit_title')}</SheetTitle>
          <SheetDescription>{t('items.sheet_desc', { currency })}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('items.section_details')}</legend>
            <TextField id="item-name" label={t('items.field_name')} value={draft.name} onChange={(event) => set('name', event.target.value)} />
            <TextField id="item-category" label={t('items.field_category')} placeholder={t('items.placeholder_category')} value={draft.category} onChange={(event) => set('category', event.target.value)} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-description">{t('items.field_description')}</Label>
              <textarea
                id="item-description"
                rows={3}
                className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={draft.description}
                onChange={(event) => set('description', event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('items.field_status')}</Label>
              <Select value={draft.status} onValueChange={(value) => set('status', value as Draft['status'])}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('items.status_active')}</SelectItem>
                  <SelectItem value="hidden">{t('items.status_hidden')}</SelectItem>
                  <SelectItem value="archived">{t('items.status_archived')}</SelectItem>
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
                ...(!product ? { images: [] } : {}),
              }))}
            />
            {!draft.storeProductId ? (
              <div className="flex flex-col gap-1.5">
                <Label>{t('items.field_image')}</Label>
                {draft.images[0] ? (
                  <div className="flex items-center gap-3 rounded-lg border p-2">
                    <img src={draft.images[0].src} alt={draft.images[0].alt} className="size-16 rounded-md object-cover" />
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{draft.images[0].alt}</span>
                    <Button type="button" size="icon" variant="ghost" aria-label={t('items.image_remove_aria')} onClick={() => set('images', [])}><X /></Button>
                  </div>
                ) : null}
                <Button type="button" variant="outline" className="w-full justify-start" loading={pickingImage} disabled={pickingImage} onClick={() => void selectImage()}>
                  <ImagePlus data-icon="inline-start" />{draft.images[0] ? t('items.image_change') : t('items.image_select')}
                </Button>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label>{t('items.field_store_eligibility')}</Label>
              <Select value={draft.storeRentalOverride ?? 'inherit'} onValueChange={(value) => set('storeRentalOverride', value as Draft['storeRentalOverride'])}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">{t('items.store_eligibility_inherit')}</SelectItem>
                  <SelectItem value="enabled">{t('items.store_eligibility_enabled')}</SelectItem>
                  <SelectItem value="disabled">{t('items.store_eligibility_disabled')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('items.store_eligibility_hint')}</p>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('items.section_pricing')}</legend>
            <div className="grid grid-cols-2 gap-3">
              <TextField id="item-daily" label={t('items.field_daily_rate')} step="0.01" tip={t('items.tip_daily_rate')} {...num('dailyRate')} />
              <TextField
                id="item-weekly"
                label={t('items.field_weekly_rate')}
                step="0.01"
                tip={t('items.tip_weekly_rate')}
                hint={t('items.hint_weekly_rate')}
                error={weeklyTooLow ? t('items.error_weekly_low', { dailyRate: money(draft.dailyRate), weeklyRate: money(draft.weeklyRate) }) : undefined}
                {...num('weeklyRate')}
              />
              <TextField id="item-deposit" label={t('items.field_deposit')} step="0.01" tip={t('items.tip_deposit')} {...num('depositAmount')} />
              <TextField id="item-units" label={t('items.field_units')} tip={t('items.tip_units')} {...num('unitCount', 1)} />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('items.section_rules')}</legend>
            <div className="grid grid-cols-2 gap-3">
              <TextField id="item-min" label={t('items.field_min_days')} tip={t('items.tip_min_days')} {...num('minDays', 1)} />
              <TextField id="item-max" label={t('items.field_max_days')} tip={t('items.tip_max_days')} error={rangeInvalid ? t('items.error_max_days') : undefined} {...num('maxDays', 1)} />
              <TextField id="item-buffer" label={t('items.field_buffer_days')} hint={t('items.hint_buffer_days')} tip={t('items.tip_buffer_days')} disabled={!perItemRules && !isNew} {...num('bufferDays')} />
              <TextField id="item-lead" label={t('items.field_lead_days')} hint={t('items.hint_lead_days')} tip={t('items.tip_lead_days')} disabled={!perItemRules && !isNew} {...num('leadDays')} />
            </div>
            {!perItemRules ? <p className="text-xs text-muted-foreground">{t('items.plan_rules_notice')}</p> : null}
          </fieldset>
        </div>

        <SheetFooter className="flex-row items-center justify-between gap-2">
          {!isNew && item ? (
            <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={saving} onClick={() => setConfirmDelete(true)}>
              <Trash2 data-icon="inline-start" />{t('items.btn_delete')}
            </Button>
          ) : <span />}
          <Button loading={saving} disabled={saving || !draft.name || draft.dailyRate <= 0 || weeklyTooLow || rangeInvalid} onClick={() => void save()}>
            {isNew ? t('items.btn_add') : t('items.btn_save')}
          </Button>
        </SheetFooter>
        {!isNew && item && confirmDelete ? (
          <DeleteItemDialog
            item={item}
            open
            onOpenChange={setConfirmDelete}
            onDone={async () => {
              await onSaved();
              onClose();
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
