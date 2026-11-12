import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { post } from '@/dashboard/client';
import { useI18n } from '@/i18n';
import { useToast } from './toast';

interface Check {
  ok: boolean;
  message?: string;
  name: string;
  status: string;
  allowed: boolean;
  reason: 'live' | 'store' | 'history' | null;
  liveCount: number;
  historyCount: number;
  sampleBookingIds: string[];
}

const endpoint = '/api/rentals/items';

/**
 * Confirms deleting an item. The server decides whether a permanent delete is safe; when it isn't
 * (live bookings, booking history, or a Wix Store link) the dialog explains why and offers Archive instead.
 */
export function DeleteItemDialog({ item, open, onOpenChange, onDone }: {
  item: { _id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the item is deleted or archived. */
  onDone: () => Promise<void> | void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'delete' | 'archive' | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCheck(null);
    setError('');
    post<Check>(endpoint, { action: 'delete-check', itemId: item._id })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setCheck(result);
        else setError(result.message || t('items.delete_check_failed'));
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t('items.delete_check_failed'));
      });
    return () => {
      cancelled = true;
    };
  }, [open, item._id, t]);

  async function run(kind: 'delete' | 'archive') {
    setBusy(kind);
    try {
      const result = await post<{ ok: boolean; message?: string }>(
        endpoint,
        kind === 'delete' ? { action: 'delete', itemId: item._id } : { itemId: item._id, status: 'archived' },
      );
      if (!result.ok) {
        toast(result.message || t('items.delete_failed'), 'error');
        return;
      }
      toast(kind === 'delete' ? t('items.toast_deleted', { name: item.name }) : t('items.toast_archived', { name: item.name }));
      onOpenChange(false);
      await onDone();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : t('items.delete_failed'), 'error');
    } finally {
      setBusy(null);
    }
  }

  const blocked = check && !check.allowed;
  const canArchive = Boolean(blocked && check.status !== 'archived');
  const reasonText = check?.reason === 'live'
    ? t('items.delete_blocked_live', { name: item.name, count: check.liveCount })
    : check?.reason === 'store'
      ? t('items.delete_blocked_store', { name: item.name })
      : check?.reason === 'history'
        ? t('items.delete_blocked_history', { name: item.name, count: check.historyCount })
        : '';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{blocked ? t('items.delete_blocked_title', { name: item.name }) : t('items.delete_title', { name: item.name })}</DialogTitle>
          <DialogDescription>
            {!check ? (error ? '' : t('items.delete_checking')) : blocked ? reasonText : t('items.delete_desc')}
          </DialogDescription>
        </DialogHeader>

        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        {check?.allowed && check.sampleBookingIds.length > 0 ? (
          <p className="text-sm text-muted-foreground">{t('items.delete_samples', { count: check.sampleBookingIds.length })}</p>
        ) : null}
        {blocked && !canArchive ? <p className="text-sm text-muted-foreground">{t('items.delete_already_archived')}</p> : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy !== null}>{t('common.cancel')}</Button>
          </DialogClose>
          {check?.allowed ? (
            <Button variant="destructive" loading={busy === 'delete'} disabled={busy !== null} onClick={() => void run('delete')}>
              {t('items.btn_delete_confirm')}
            </Button>
          ) : canArchive ? (
            <Button loading={busy === 'archive'} disabled={busy !== null} onClick={() => void run('archive')}>
              {t('items.btn_archive_instead')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
