import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { post } from '@/dashboard/client';
import { useI18n } from '@/i18n';
import { useDashboard } from './shared';
import { useToast } from './toast';

export type RefundKind = 'item' | 'order' | 'deposit';

interface Preview {
  ok: boolean;
  message?: string;
  amount: number;
  external: boolean;
  providerLink: string;
  references: string[];
  lines: Array<{ bookingId: string; amount: number }>;
  deposit: { amount: number } | null;
}

interface IssueResult {
  ok: boolean;
  message?: string;
  amount?: number;
  external?: boolean;
  providerLink?: string;
}

const endpoint = '/api/rentals/refunds';

// Shows exactly what Wix will refund before anything is sent. Refunds can't be undone.
export function RefundDialog({ reference, kind, open, onOpenChange, onDone }: {
  reference: string;
  kind: RefundKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<void> | void;
}) {
  const { t } = useI18n();
  const { money } = useDashboard();
  const toast = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreview(null);
    setError('');
    setNote('');
    post<Preview>(endpoint, { action: 'preview', reference, kind })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setPreview(result);
        else setError(result.message || t('refunds.preview_failed'));
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t('refunds.preview_failed'));
      });
    return () => {
      cancelled = true;
    };
  }, [open, reference, kind, t]);

  async function confirm() {
    if (!preview) return;
    setSending(true);
    try {
      const result = await post<IssueResult>(endpoint, { action: 'issue', reference, kind, amount: preview.amount, note });
      if (!result.ok) {
        toast(result.message || t('refunds.failed'), 'error');
        return;
      }
      toast(result.external
        ? t('refunds.toast_recorded', { amount: money(result.amount ?? preview.amount) })
        : t('refunds.toast_refunded', { amount: money(result.amount ?? preview.amount) }));
      onOpenChange(false);
      await onDone();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : t('refunds.failed'), 'error');
    } finally {
      setSending(false);
    }
  }

  const titles: Record<RefundKind, string> = {
    item: t('refunds.title_item', { reference }),
    order: t('refunds.title_order'),
    deposit: t('refunds.title_deposit', { reference }),
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!sending) onOpenChange(next); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titles[kind]}</DialogTitle>
          <DialogDescription>{t('refunds.desc')}</DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
        ) : !preview ? (
          <p className="text-sm text-muted-foreground">{t('refunds.checking')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3 text-sm">
              {preview.lines.length > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {preview.lines.length === 1 ? t('refunds.line_one') : t('refunds.line_many', { count: preview.lines.length })}
                  </dt>
                  <dd className="tabular-nums">{money(preview.lines.reduce((sum, line) => sum + line.amount, 0))}</dd>
                </div>
              ) : null}
              {preview.deposit ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t('refunds.line_deposit')}</dt>
                  <dd className="tabular-nums">{money(preview.deposit.amount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t pt-1.5 font-medium">
                <dt>{t('refunds.total')}</dt>
                <dd className="tabular-nums">{money(preview.amount)}</dd>
              </div>
              {kind === 'order' && preview.references.length > 1 ? (
                <p className="text-xs text-muted-foreground">{t('refunds.covers', { references: preview.references.join(', ') })}</p>
              ) : null}
            </dl>

            {preview.external ? (
              <Alert>
                <AlertDescription className="flex flex-col gap-2">
                  <span>{t('refunds.external_warning')}</span>
                  {preview.providerLink ? (
                    <a className="inline-flex items-center gap-1 text-primary hover:underline" href={preview.providerLink} target="_blank" rel="noreferrer">
                      {t('refunds.open_provider')}<ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="refund-note">{t('refunds.note')}</Label>
              <Textarea
                id="refund-note"
                rows={2}
                maxLength={200}
                placeholder={t('refunds.note_placeholder')}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={sending}>{t('common.cancel')}</Button>
          </DialogClose>
          <Button variant="destructive" loading={sending} disabled={!preview || sending} onClick={() => void confirm()}>
            {preview
              ? preview.external
                ? t('refunds.btn_record', { amount: money(preview.amount) })
                : t('refunds.btn_refund', { amount: money(preview.amount) })
              : t('refunds.btn_refund_plain')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
