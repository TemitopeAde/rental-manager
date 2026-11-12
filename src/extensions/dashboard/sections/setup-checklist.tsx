import { useState } from 'react';
import { ArrowRight, Check, Circle, EyeOff, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, post } from '@/dashboard/client';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import type { SetupStep } from '@/rental/setup-rules';
import { useResource } from './shared';
import { useToast } from './toast';

type Target = 'items' | 'settings' | 'bookings' | 'guide';

interface SetupStatus {
  steps: Array<{ id: SetupStep; complete: boolean; manual: boolean }>;
  completed: number;
  total: number;
  finished: boolean;
  hidden: boolean;
  /** Steps the owner marked done by hand, which they can undo. */
  marked: string[];
}

// Where each step's button goes. Members Area has no tab: its button checks again instead.
const targets: Partial<Record<SetupStep, Target>> = {
  item: 'items',
  sample: 'items',
  rules: 'settings',
  late: 'settings',
  site: 'guide',
  booking: 'bookings',
};

export const SETUP_KEY = '/api/rentals/setup';

/**
 * The new-owner setup checklist at the top of Today. It disappears once every step is done; hiding it
 * collapses it to a one-line progress bar the owner can open again.
 */
export function SetupChecklist({ onNavigate }: { onNavigate: (target: Target) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const { data, refresh } = useResource(SETUP_KEY, () => api<SetupStatus>(SETUP_KEY));
  const [busy, setBusy] = useState<string | null>(null);

  // The checklist is a helper, not the page: if it can't load, Today carries on without it.
  if (!data || data.finished) return null;

  async function send(key: string, payload: Record<string, unknown>) {
    setBusy(key);
    try {
      await post<SetupStatus>(SETUP_KEY, payload);
      await refresh();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : t('setup.error'), 'error');
    } finally {
      setBusy(null);
    }
  }

  const percent = Math.round((data.completed / data.total) * 100);
  const nextStep = data.steps.find((step) => !step.complete)?.id;
  const bar = (
    <div
      className="h-2 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={data.total}
      aria-valuenow={data.completed}
      aria-label={t('setup.progress', { done: data.completed, total: data.total })}
    >
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );

  if (data.hidden) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-xs">
        <Rocket className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="shrink-0 text-sm font-medium">{t('setup.progress', { done: data.completed, total: data.total })}</span>
        <div className="min-w-0 flex-1">{bar}</div>
        <Button size="sm" variant="ghost" loading={busy === 'show'} disabled={busy !== null} onClick={() => void send('show', { action: 'show' })}>
          {t('setup.show')}
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Rocket className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-0.5">
              <CardTitle>{t('setup.title')}</CardTitle>
              <CardDescription>{t('setup.desc')}</CardDescription>
            </div>
          </div>
          <Button size="sm" variant="ghost" loading={busy === 'hide'} disabled={busy !== null} onClick={() => void send('hide', { action: 'hide' })}>
            <EyeOff className="size-4" aria-hidden="true" />{t('setup.hide')}
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('setup.progress', { done: data.completed, total: data.total })}</span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          {bar}
        </div>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col divide-y">
          {data.steps.map((step) => {
            const target = targets[step.id];
            const isNext = step.id === nextStep;
            return (
              <li key={step.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span
                    className={cn(
                      'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
                      step.complete ? 'bg-emerald-600 text-white dark:bg-emerald-500' : 'text-muted-foreground',
                    )}
                    aria-hidden="true"
                  >
                    {step.complete ? <Check className="size-3.5" /> : <Circle className="size-5" />}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className={cn('text-sm font-medium', step.complete && 'text-muted-foreground line-through')}>
                      {t(`setup.step_${step.id}_title`)}
                      <span className="sr-only"> — {step.complete ? t('setup.done_label') : t('setup.todo_label')}</span>
                    </p>
                    {!step.complete ? <p className="text-sm text-muted-foreground">{t(`setup.step_${step.id}_desc`)}</p> : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 pl-8 sm:pl-0">
                  {!step.complete && target ? (
                    <Button size="sm" variant={isNext ? 'default' : 'outline'} onClick={() => onNavigate(target)}>
                      {t(`setup.step_${step.id}_action`)}<ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                  {!step.complete && step.id === 'members' ? (
                    <Button size="sm" variant={isNext ? 'default' : 'outline'} loading={busy === 'refresh'} disabled={busy !== null} onClick={async () => { setBusy('refresh'); await refresh(); setBusy(null); }}>
                      {t('setup.step_members_action')}
                    </Button>
                  ) : null}
                  {step.manual ? (
                    step.complete ? (
                      !data.marked.includes(step.id) ? null : <Button size="sm" variant="ghost" loading={busy === `undo:${step.id}`} disabled={busy !== null} onClick={() => void send(`undo:${step.id}`, { action: 'undo', step: step.id })}>
                        {t('setup.undo')}
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" loading={busy === `done:${step.id}`} disabled={busy !== null} onClick={() => void send(`done:${step.id}`, { action: 'done', step: step.id })}>
                        <Check className="size-4" aria-hidden="true" />{t('setup.mark_done')}
                      </Button>
                    )
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
