import { useEffect, useRef, useState } from 'react';
import { Check, ImageOff, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api, post } from '@/dashboard/client';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import type { StoreProductOption } from './store-product-picker';
import { useToast } from './toast';

type Product = StoreProductOption & { linked?: boolean };
type ProductPage = { version: string; products: Product[]; nextCursor: string; total?: number; error?: string };
type SkipReason = 'linked' | 'missing' | 'no_price' | 'not_physical' | 'limit';
type ImportResult = {
  ok: boolean;
  message?: string;
  added: Array<{ _id: string }>;
  skipped: Array<{ productId: string; reason: SkipReason }>;
  limitReached?: boolean;
};

/** Either a hand-picked set, or every product matching the search except the ones unticked. */
type Selection =
  | { mode: 'some'; ids: Set<string> }
  | { mode: 'all'; excluded: Set<string> };

const PAGE_SIZE = 50;
/** Products per import request; matches the server's batch size. */
const BATCH = 25;

function pageUrl(search: string, cursor: string, limit = PAGE_SIZE) {
  return `/api/rentals/store-products?linked=1&limit=${limit}&search=${encodeURIComponent(search)}&cursor=${encodeURIComponent(cursor)}`;
}

const canPick = (product: Product) => !product.linked && product.price > 0;

/**
 * Lets the merchant turn Wix Store products into rental items in bulk. Built for large stores:
 * products load page by page as the list scrolls, "Select all" covers every matching product (not
 * just the loaded ones), and the import runs in small batches with progress and a Stop button.
 */
export function StoreImportDialog({ open, onOpenChange, slotsLeft, money, onImported }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Items the plan still allows; `null` when unlimited. */
  slotsLeft: number | null;
  money: (amount: number) => string;
  onImported: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [nextCursor, setNextCursor] = useState('');
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [state, setState] = useState<'loading' | 'more' | 'idle' | 'error' | 'no-stores'>('loading');
  const [problem, setProblem] = useState('');
  const [selection, setSelection] = useState<Selection>({ mode: 'some', ids: new Set() });
  const [progress, setProgress] = useState<{ done: number; total: number | null; added: number } | null>(null);
  const stopRequested = useRef(false);
  const requestId = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const running = progress !== null;

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelection({ mode: 'some', ids: new Set() });
    setProgress(null);
  }, [open]);

  // A new search starts the list (and an "all matching" selection) over.
  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    setState('loading');
    setSelection((current) => (current.mode === 'all' ? { mode: 'some', ids: new Set() } : current));
    const timer = setTimeout(() => {
      api<ProductPage>(pageUrl(search, ''))
        .then((body) => {
          if (id !== requestId.current) return;
          setProducts(body.products);
          setNextCursor(body.nextCursor);
          setTotal(body.total);
          setProblem(body.error ?? '');
          setState(body.error ? 'error' : body.version === 'STORES_NOT_INSTALLED' ? 'no-stores' : 'idle');
        })
        .catch((error: unknown) => {
          if (id !== requestId.current) return;
          setProblem(error instanceof Error ? error.message : '');
          setState('error');
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [open, search]);

  function loadMore() {
    if (state !== 'idle' || !nextCursor) return;
    const id = requestId.current;
    setState('more');
    api<ProductPage>(pageUrl(search, nextCursor))
      .then((body) => {
        if (id !== requestId.current) return;
        setProducts((current) => {
          const seen = new Set(current.map((product) => product.id));
          return [...current, ...body.products.filter((product) => !seen.has(product.id))];
        });
        setNextCursor(body.error ? nextCursor : body.nextCursor);
        if (body.error) toast(body.error, 'error');
        setState('idle');
      })
      .catch((error: unknown) => {
        if (id !== requestId.current) return;
        toast(error instanceof Error ? error.message : t('store_picker.load_failed'), 'error');
        setState('idle');
      });
  }

  // Load the next page when the bottom of the list scrolls into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !nextCursor || state !== 'idle') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => observer.disconnect();
    // loadMore reads the latest state through this effect's own dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCursor, state, products.length]);

  const isChecked = (product: Product) =>
    canPick(product) && (selection.mode === 'all' ? !selection.excluded.has(product.id) : selection.ids.has(product.id));

  function toggle(product: Product) {
    setSelection((current) => {
      if (current.mode === 'all') {
        const excluded = new Set(current.excluded);
        if (excluded.has(product.id)) excluded.delete(product.id);
        else excluded.add(product.id);
        return { mode: 'all', excluded };
      }
      const ids = new Set(current.ids);
      if (ids.has(product.id)) ids.delete(product.id);
      else ids.add(product.id);
      return { mode: 'some', ids };
    });
  }

  const loadedPickable = products.filter(canPick);
  const everythingLoaded = !nextCursor;
  // In "all" mode the exact number isn't known until the import walks every page, so it's an upper bound.
  const selectedCount = selection.mode === 'all'
    ? Math.max(0, (everythingLoaded ? loadedPickable.length : total ?? loadedPickable.length) - selection.excluded.size)
    : selection.ids.size;
  const overLimit = slotsLeft !== null && selectedCount > slotsLeft;

  /** Yields product IDs to import, BATCH at a time, walking every page in "all" mode. */
  async function* batches(): AsyncGenerator<string[]> {
    if (selection.mode === 'some') {
      const ids = [...selection.ids];
      for (let start = 0; start < ids.length; start += BATCH) yield ids.slice(start, start + BATCH);
      return;
    }
    const excluded = selection.excluded;
    let cursor = '';
    let pending: string[] = [];
    do {
      const page = await api<ProductPage>(pageUrl(search, cursor, 100));
      if (page.error) throw new Error(page.error);
      pending.push(...page.products.filter((product) => canPick(product) && !excluded.has(product.id)).map((product) => product.id));
      while (pending.length >= BATCH) {
        yield pending.slice(0, BATCH);
        pending = pending.slice(BATCH);
      }
      cursor = page.nextCursor;
    } while (cursor && !stopRequested.current);
    if (pending.length) yield pending;
  }

  async function runImport() {
    stopRequested.current = false;
    const expected = selection.mode === 'some' ? selection.ids.size : total !== undefined ? selectedCount : null;
    const cap = slotsLeft;
    let added = 0;
    let done = 0;
    const skipped = new Map<SkipReason, number>();
    let stoppedForLimit = false;
    setProgress({ done: 0, total: expected, added: 0 });
    try {
      for await (const ids of batches()) {
        if (stopRequested.current) break;
        const result = await post<ImportResult>('/api/rentals/items', { action: 'import-store', productIds: ids });
        if (!result.ok) throw new Error(result.message || t('store_import.toast_failed'));
        added += result.added.length;
        done += ids.length;
        result.skipped.forEach((entry) => skipped.set(entry.reason, (skipped.get(entry.reason) ?? 0) + 1));
        setProgress({ done, total: expected, added });
        if (result.limitReached || (cap !== null && added >= cap)) {
          stoppedForLimit = true;
          break;
        }
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : t('store_import.toast_failed'), 'error');
    }

    // Products past the plan limit were never sent, so report the limit itself rather than a count.
    if (stoppedForLimit) skipped.set('limit', Math.max(skipped.get('limit') ?? 0, 1));
    const skippedTotal = [...skipped.entries()].filter(([reason]) => reason !== 'limit').reduce((sum, [, count]) => sum + count, 0);
    if (added) toast(t('store_import.toast_added', { count: added }));
    if (skipped.size) {
      const reasons = [...skipped.keys()].map((reason) => t(`store_import.skip_${reason}`)).join(' ');
      toast(`${skippedTotal ? `${t('store_import.toast_skipped', { count: skippedTotal })} ` : ''}${reasons}`, added ? 'info' : 'error');
    }
    if (stopRequested.current && !stoppedForLimit) toast(t('store_import.toast_stopped', { count: added }), 'info');
    setProgress(null);
    await onImported();
    if (added) onOpenChange(false);
  }

  const empty = {
    loading: t('store_picker.searching'),
    more: t('store_picker.searching'),
    error: problem || t('store_picker.load_failed'),
    'no-stores': t('store_picker.stores_not_installed'),
    idle: search ? t('store_picker.no_matches', { search }) : t('store_picker.no_products_found'),
  }[state];
  const showList = (state === 'idle' || state === 'more') && products.length > 0;
  const percent = progress?.total ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!running) onOpenChange(next); }}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('store_import.title')}</DialogTitle>
          <DialogDescription>{t('store_import.desc')}</DialogDescription>
        </DialogHeader>

        {running ? (
          <div className="flex flex-col gap-3 py-6" role="status" aria-live="polite">
            <span className="text-sm font-medium">
              {progress.total
                ? t('store_import.progress', { done: Math.min(progress.done, progress.total), total: progress.total })
                : t('store_import.progress_unknown', { done: progress.done })}
            </span>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full bg-primary transition-[width]', percent === null && 'w-1/3 animate-pulse')}
                style={percent === null ? undefined : { width: `${percent}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{t('store_import.progress_added', { count: progress.added })}</span>
            <span className="text-xs text-muted-foreground">{t('store_import.progress_keep_open')}</span>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                className="pl-8"
                placeholder={t('store_picker.search_placeholder')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label={t('store_picker.search_placeholder')}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {total !== undefined ? t('store_import.matching', { count: total }) : t('store_import.loaded', { count: products.length })}
                {' · '}
                {selection.mode === 'all' ? t('store_import.selected_all', { count: selectedCount }) : t('store_import.selected', { count: selectedCount })}
                {slotsLeft !== null ? ` · ${t('store_import.slots_left', { count: slotsLeft })}` : ''}
              </span>
              {state === 'idle' && products.length > 0 ? (
                selection.mode === 'all' || selection.ids.size > 0 ? (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelection({ mode: 'some', ids: new Set() })}>
                    {t('store_import.clear_selection')}
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelection({ mode: 'all', excluded: new Set() })}>
                    {total !== undefined ? t('store_import.select_all_matching', { count: total }) : t('store_import.select_all')}
                  </Button>
                )
              ) : null}
            </div>
            {selection.mode === 'all' ? <p className="-mt-2 text-xs text-muted-foreground">{t('store_import.select_all_note')}</p> : null}

            <div className="-mx-1 min-h-40 flex-1 overflow-y-auto px-1" role="listbox" aria-multiselectable="true">
              {!showList ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {products.map((product) => {
                    const disabled = !canPick(product);
                    const checked = isChecked(product);
                    return (
                      <li key={product.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={checked}
                          disabled={disabled}
                          onClick={() => toggle(product)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors',
                            checked ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted',
                            disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                              checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                            )}
                            aria-hidden="true"
                          >
                            {checked || product.linked ? <Check className="size-3" /> : null}
                          </span>
                          {product.image ? (
                            <img src={product.image} alt="" loading="lazy" className="size-10 shrink-0 rounded-md border object-cover" />
                          ) : (
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
                              <ImageOff className="size-4 text-muted-foreground" />
                            </span>
                          )}
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">{product.name}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {product.linked
                                ? t('store_import.already_added')
                                : product.price <= 0
                                  ? t('store_import.needs_price')
                                  : `${t('store_import.per_day', { price: money(product.price) })}${product.visible ? '' : ` · ${t('status.hidden')}`}`}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  <li>
                    <div ref={sentinel} className="flex justify-center py-2">
                      {state === 'more' ? (
                        <span className="text-xs text-muted-foreground">{t('store_picker.searching')}</span>
                      ) : nextCursor ? (
                        <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={loadMore}>{t('store_import.load_more')}</Button>
                      ) : null}
                    </div>
                  </li>
                </ul>
              )}
            </div>

            {overLimit ? <p className="text-xs text-amber-700 dark:text-amber-300">{t('store_import.over_limit', { count: slotsLeft ?? 0 })}</p> : null}
          </>
        )}

        <DialogFooter>
          {running ? (
            <Button type="button" variant="outline" disabled={stopRequested.current} onClick={() => { stopRequested.current = true; setProgress((current) => current && { ...current }); }}>
              {t('store_import.stop')}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
              <Button type="button" disabled={selectedCount === 0 || state !== 'idle'} onClick={() => void runImport()}>
                {t('store_import.btn_add', { count: selectedCount })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
