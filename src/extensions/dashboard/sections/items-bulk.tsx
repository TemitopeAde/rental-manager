import { useState } from 'react';
import { Archive, Eye, EyeOff, Tag, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { post } from '@/dashboard/client';
import { useI18n } from '@/i18n';
import { useToast } from './toast';

/** Items per request; matches the server's bulk batch size. */
const BATCH = 50;

type UpdateResult = { ok: boolean; message?: string; updated: number; failed: Array<{ id: string; message: string }> };
type DeleteResult = { ok: boolean; message?: string; deleted: number; blocked: Array<{ id: string; message: string }> };

/** Sends `ids` to the server in batches, reporting progress after each one. */
async function inBatches<T>(ids: string[], send: (batch: string[]) => Promise<T>, onProgress: (done: number) => void): Promise<T[]> {
  const results: T[] = [];
  for (let start = 0; start < ids.length; start += BATCH) {
    results.push(await send(ids.slice(start, start + BATCH)));
    onProgress(Math.min(ids.length, start + BATCH));
  }
  return results;
}

/** A tri-state checkbox (checked, unchecked, or some selected). */
export function SelectBox({ checked, indeterminate = false, label, onChange }: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="size-4 cursor-pointer rounded border-input accent-primary align-middle"
      checked={checked}
      ref={(node) => { if (node) node.indeterminate = indeterminate; }}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

/**
 * The action bar shown while items are selected: change status, set a category, or delete. Work is
 * sent in batches so it scales to thousands of selected items.
 */
export function ItemsBulkBar({ selectedIds, onClear, onDone }: {
  selectedIds: string[];
  onClear: () => void;
  onDone: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState<{ done: number } | null>(null);
  const [category, setCategory] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blocked, setBlocked] = useState<string[]>([]);
  const count = selectedIds.length;

  async function update(change: { status?: 'active' | 'hidden' | 'archived'; category?: string }, ids = selectedIds) {
    setBusy({ done: 0 });
    try {
      const results = await inBatches(
        ids,
        (batch) => post<UpdateResult>('/api/rentals/items', { action: 'bulk-update', itemIds: batch, ...change }),
        (done) => setBusy({ done }),
      );
      const updated = results.reduce((sum, result) => sum + result.updated, 0);
      const failed = results.flatMap((result) => result.failed);
      if (updated) toast(t('items_bulk.toast_updated', { count: updated }));
      if (failed.length) toast(`${t('items_bulk.toast_update_failed', { count: failed.length })} ${failed[0].message}`, 'error');
      onClear();
    } catch (error) {
      toast(error instanceof Error ? error.message : t('items.toast_save_failed'), 'error');
    } finally {
      setBusy(null);
      await onDone();
    }
  }

  async function remove() {
    setConfirmDelete(false);
    setBusy({ done: 0 });
    try {
      const results = await inBatches(
        selectedIds,
        (batch) => post<DeleteResult>('/api/rentals/items', { action: 'bulk-delete', itemIds: batch }),
        (done) => setBusy({ done }),
      );
      const deleted = results.reduce((sum, result) => sum + result.deleted, 0);
      const kept = results.flatMap((result) => result.blocked.map((entry) => entry.id));
      if (deleted) toast(t('items_bulk.toast_deleted', { count: deleted }));
      onClear();
      // Items with bookings or a store link can't be deleted; offer to archive them instead.
      if (kept.length) setBlocked(kept);
    } catch (error) {
      toast(error instanceof Error ? error.message : t('items.toast_save_failed'), 'error');
    } finally {
      setBusy(null);
      await onDone();
    }
  }

  return (
    <>
      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm" role="toolbar" aria-label={t('items_bulk.toolbar_label')}>
        <span className="text-sm font-medium" aria-live="polite">
          {busy ? t('items_bulk.working', { done: busy.done, total: count }) : t('items_bulk.selected', { count })}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void update({ status: 'active' })}>
            <Eye data-icon="inline-start" />{t('items_bulk.make_active')}
          </Button>
          <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void update({ status: 'hidden' })}>
            <EyeOff data-icon="inline-start" />{t('items_bulk.hide')}
          </Button>
          <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void update({ status: 'archived' })}>
            <Archive data-icon="inline-start" />{t('items_bulk.archive')}
          </Button>
          <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" disabled={Boolean(busy)}>
                <Tag data-icon="inline-start" />{t('items_bulk.set_category')}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  setCategoryOpen(false);
                  void update({ category });
                }}
              >
                <Label htmlFor="bulk-category">{t('items.field_category')}</Label>
                <Input id="bulk-category" autoFocus placeholder={t('items.placeholder_category')} value={category} onChange={(event) => setCategory(event.target.value)} />
                <p className="text-xs text-muted-foreground">{t('items_bulk.category_hint')}</p>
                <Button type="submit" size="sm">{t('items_bulk.apply_category', { count })}</Button>
              </form>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={Boolean(busy)} onClick={() => setConfirmDelete(true)}>
            <Trash2 data-icon="inline-start" />{t('items_bulk.delete')}
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={t('items_bulk.clear')} disabled={Boolean(busy)} onClick={onClear}><X /></Button>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('items_bulk.delete_title', { count })}</DialogTitle>
            <DialogDescription>{t('items_bulk.delete_desc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => void remove()}>{t('items_bulk.delete_confirm', { count })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blocked.length > 0} onOpenChange={(open) => { if (!open) setBlocked([]); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('items_bulk.blocked_title', { count: blocked.length })}</DialogTitle>
            <DialogDescription>{t('items_bulk.blocked_desc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlocked([])}>{t('items_bulk.keep')}</Button>
            <Button
              onClick={() => {
                const ids = blocked;
                setBlocked([]);
                void update({ status: 'archived' }, ids);
              }}
            >
              <Archive data-icon="inline-start" />{t('items_bulk.archive_instead', { count: blocked.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
