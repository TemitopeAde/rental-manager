import { useMemo, useState } from 'react';
import { CalendarOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, post } from '@/dashboard/client';
import { useI18n } from '@/i18n';
import { groupBlocks, MAX_BLOCK_DAYS, datesBetween, type BlockGroup, type BlockRow } from '@/rental/blocked-rules';
import { isoDay, TextField, useDashboard, useResource } from './shared';
import { useToast } from './toast';

const ALL_ITEMS = '*';
const blocksKey = '/api/rentals/blocks';

export function BlockedDatesCard() {
  const { items, itemName } = useDashboard();
  const { t, formatDay } = useI18n();
  const toast = useToast();
  const { data, error, refresh } = useResource(blocksKey, () => api<{ blocks: BlockRow[] }>(blocksKey));
  const today = isoDay(new Date());
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [itemId, setItemId] = useState(ALL_ITEMS);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState('');

  const groups = useMemo(() => groupBlocks(data?.blocks ?? []), [data]);
  const bookable = items.filter((item) => item.status !== 'archived');
  const last = end || start;
  const rangeError = start && last < start
    ? t('blocked.error_order')
    : start && datesBetween(start, last).length === 0
      ? t('blocked.error_too_long', { count: MAX_BLOCK_DAYS })
      : '';

  function label(group: BlockGroup) {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return group.start === group.end
      ? formatDay(group.start, options)
      : `${formatDay(group.start, options)} – ${formatDay(group.end, options)}`;
  }

  async function close() {
    if (!start || rangeError) return;
    setSaving(true);
    try {
      const result = await post<{ ok: boolean; count: number }>(blocksKey, {
        action: 'block',
        itemId: itemId === ALL_ITEMS ? '' : itemId,
        start,
        end: last,
        reason,
      });
      await refresh();
      setStart('');
      setEnd('');
      setReason('');
      toast(result.count > 0 ? t('blocked.toast_closed', { count: result.count }) : t('blocked.toast_already_closed'));
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : t('blocked.toast_failed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function reopen(group: BlockGroup) {
    const key = group.ids.join(',');
    setRemoving(key);
    try {
      await post(blocksKey, { action: 'remove', ids: group.ids });
      await refresh();
      toast(t('blocked.toast_reopened'));
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : t('blocked.toast_failed'), 'error');
    } finally {
      setRemoving('');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarOff className="size-4" />{t('blocked.title')}</CardTitle>
        <CardDescription>{t('blocked.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="block-start"
            label={t('blocked.from')}
            type="date"
            min={today}
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              if (end && end < event.target.value) setEnd('');
            }}
          />
          <TextField
            id="block-end"
            label={t('blocked.to')}
            type="date"
            min={start || today}
            value={end}
            placeholder={start}
            hint={t('blocked.to_hint')}
            error={rangeError}
            onChange={(event) => setEnd(event.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <Label>{t('blocked.applies_to')}</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ALL_ITEMS}>{t('blocked.all_items')}</SelectItem>
                {bookable.map((item) => <SelectItem key={item._id} value={item._id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <TextField
            id="block-reason"
            label={t('blocked.reason')}
            placeholder={t('blocked.reason_placeholder')}
            maxLength={120}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button loading={saving} disabled={saving || !start || Boolean(rangeError)} onClick={() => void close()}>
            {t('blocked.btn_close')}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t('blocked.upcoming')}</span>
          {error ? (
            <p className="text-sm text-destructive">{t('blocked.load_failed')}</p>
          ) : !data ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('blocked.empty')}</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border">
              {groups.map((group) => {
                const key = group.ids.join(',');
                return (
                  <li key={key} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium">{label(group)}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {group.itemId === ALL_ITEMS ? t('blocked.all_items') : itemName(group.itemId)}
                        {group.reason ? ` · ${group.reason}` : ''}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={removing === key}
                      disabled={Boolean(removing)}
                      onClick={() => void reopen(group)}
                      aria-label={t('blocked.reopen_aria', { dates: label(group) })}
                    >
                      <X className="size-4" />{t('blocked.btn_reopen')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
