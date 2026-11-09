import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { post } from '@/dashboard/client';
import { useI18n } from '@/i18n';
import { LoadingState, numberField, SectionHeader, TextField, useDashboard, type Settings } from './shared';
import { useToast } from './toast';

function timezones(current: string): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  return supported.includes(current) ? supported : [current, ...supported];
}

function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function SettingsSection() {
  const { settings: saved, plan, storeCategories, storeCatalogVersion, reload, loading } = useDashboard();
  const { t, formatDate, locales, setLocale } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<Settings | null>(saved);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);

  const zones = useMemo(() => timezones(saved?.timezone ?? 'UTC'), [saved?.timezone]);
  const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));

  if (loading || !draft || !plan) return <LoadingState />;

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft({ ...draft, [key]: value });
  function setStoreCategory(value: string) {
    if (!draft) return;
    if (value === '__none') {
      setDraft({ ...draft, storeCategoryId: '', storeCategoryName: '', storeCategoryVersion: undefined });
      return;
    }
    const category = storeCategories.find((entry) => entry.id === value);
    setDraft({
      ...draft,
      storeCategoryId: category?.id ?? '',
      storeCategoryName: category?.name ?? '',
      storeCategoryVersion: category?.version,
    });
  }
  const num = (key: 'defaultBufferDays' | 'defaultLeadDays' | 'defaultMinDays' | 'defaultMaxDays', min = 0) =>
    numberField(draft[key], (value) => set(key, value), min);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await post<{ settings: Settings }>('/api/rentals/settings', draft);
      await reload();
      toast(t('settings.toast_saved'));
    } catch (error) {
      toast(error instanceof Error ? error.message : t('settings.toast_save_failed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  const limits = [
    plan.maxItems === null ? t('settings.limit_unlimited_items') : t('settings.limit_items', { count: plan.maxItems }),
    plan.maxBookingsPerMonth === null ? t('settings.limit_unlimited_bookings') : t('settings.limit_bookings', { count: plan.maxBookingsPerMonth }),
    plan.manualApproval ? t('settings.limit_manual_approval') : null,
    plan.perItemRules ? t('settings.limit_item_rules') : null,
    plan.calendar ? t('settings.limit_calendar') : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4 pb-20">
      <SectionHeader title={t('settings.title')} description={t('settings.description')} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.store_title')}</CardTitle>
              <CardDescription>{t('settings.store_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>{t('settings.timezone')}</Label>
                <Select value={draft.timezone} onValueChange={(value) => set('timezone', value)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {zones.map((zone) => <SelectItem key={zone} value={zone}>{zone.replace(/_/g, ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('settings.currency')}</Label>
                <p className="flex h-9 items-center text-sm font-medium">{draft.currency}</p>
                <p className="text-xs text-muted-foreground">{t('settings.currency_desc')}</p>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>{t('settings.language_label')}</Label>
                <Select
                  value={draft.language || 'en'}
                  onValueChange={(value) => {
                    set('language', value);
                    setLocale(value as any);
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {locales.map((loc) => (
                      <SelectItem key={loc.code} value={loc.code}>
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true">{loc.flag}</span>
                          <span>{loc.nativeName} ({loc.name})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('settings.language_desc')}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings.category_card_title')}</CardTitle>
              <CardDescription>{t('settings.category_card_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {storeCatalogVersion === 'STORES_NOT_INSTALLED' ? (
                <p className="text-sm text-muted-foreground">{t('settings.stores_not_installed')}</p>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label>{t('settings.rental_category_label')}</Label>
                    <Select value={draft.storeCategoryId || '__none'} onValueChange={setStoreCategory}>
                      <SelectTrigger className="w-full"><SelectValue placeholder={t('settings.category_placeholder')} /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="__none">{t('settings.no_category_selected')}</SelectItem>
                        {storeCategories.map((category) => (
                          <SelectItem key={`${category.version}:${category.id}`} value={category.id}>{category.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!draft.storeCategoryId ? <p className="text-xs text-muted-foreground">{t('settings.category_hint')}</p> : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings.pickup_return_title')}</CardTitle>
              <CardDescription>{t('settings.pickup_return_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="pickup-hour" label={t('settings.pickup_time')} type="time" value={draft.pickupHour} onChange={(event) => set('pickupHour', event.target.value)} />
                <TextField id="return-hour" label={t('settings.return_time')} type="time" value={draft.returnHour} onChange={(event) => set('returnHour', event.target.value)} hint={t('settings.return_time_hint')} />
              </div>
              <Row label={t('settings.count_return_day')} description={t('settings.count_return_day_desc')}>
                <Switch checked={draft.countReturnDay} onCheckedChange={(checked) => set('countReturnDay', checked)} aria-label={t('settings.count_return_day')} />
              </Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings.rules_title')}</CardTitle>
              <CardDescription>{t('settings.rules_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField id="min-days" label={t('settings.min_days')} {...num('defaultMinDays', 1)} />
              <TextField id="max-days" label={t('settings.max_days')} {...num('defaultMaxDays', 1)} />
              <TextField id="buffer-days" label={t('settings.buffer_days')} hint={t('settings.buffer_days_hint')} {...num('defaultBufferDays')} />
              <TextField id="lead-days" label={t('settings.lead_days')} hint={t('settings.lead_days_hint')} {...num('defaultLeadDays')} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings.confirming_title')}</CardTitle>
              <CardDescription>{t('settings.confirming_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Row
                label={t('settings.manual_approval')}
                description={plan.manualApproval ? t('settings.manual_approval_enabled_desc') : t('settings.manual_approval_disabled_desc')}
              >
                <Switch
                  checked={draft.approvalMode === 'manual'}
                  disabled={!plan.manualApproval}
                  onCheckedChange={(checked) => set('approvalMode', checked ? 'manual' : 'auto')}
                  aria-label={t('settings.manual_approval')}
                />
              </Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings.notifications_title')}</CardTitle>
              <CardDescription>{t('settings.notifications_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Row label={t('settings.email_owner_new')} description={t('settings.email_owner_new_desc')}>
                <Switch checked={draft.emailOwnerNewBookings} onCheckedChange={(checked) => set('emailOwnerNewBookings', checked)} aria-label={t('settings.email_owner_new')} />
              </Row>
              <Row label={t('settings.email_owner_requests')}>
                <Switch checked={draft.emailOwnerRenterRequests} onCheckedChange={(checked) => set('emailOwnerRenterRequests', checked)} aria-label={t('settings.email_owner_requests')} />
              </Row>
              <Row label={t('settings.email_owner_refunds')} description={t('settings.email_owner_refunds_desc')}>
                <Switch checked={draft.emailOwnerRefundAlerts} onCheckedChange={(checked) => set('emailOwnerRefundAlerts', checked)} aria-label={t('settings.email_owner_refunds')} />
              </Row>
              <Row label={t('settings.email_renters_requests')} description={t('settings.email_renters_requests_desc')}>
                <Switch checked={draft.emailRentersRequestUpdates} onCheckedChange={(checked) => set('emailRentersRequestUpdates', checked)} aria-label={t('settings.email_renters_requests')} />
              </Row>
              <Row label={t('settings.email_renters_bookings')} description={t('settings.email_renters_bookings_desc')}>
                <Switch checked={draft.emailRentersBookingUpdates} onCheckedChange={(checked) => set('emailRentersBookingUpdates', checked)} aria-label={t('settings.email_renters_bookings')} />
              </Row>
              <Row label={t('settings.email_renters_deposits')}>
                <Switch checked={draft.emailRentersDepositUpdates} onCheckedChange={(checked) => set('emailRentersDepositUpdates', checked)} aria-label={t('settings.email_renters_deposits')} />
              </Row>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Crown className="size-4 text-amber-500" />{t('settings.plan_title')}</CardTitle>
            <CardDescription><Badge variant="secondary">{plan.label}</Badge></CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {limits.map((limit) => (
                <li key={limit} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" />{limit}</li>
              ))}
            </ul>
            {plan.trialActive ? (
              <p className="mt-4 text-xs text-muted-foreground">
                {t('settings.trial_active_note')}
              </p>
            ) : plan.trialEnded ? (
              <p className="mt-4 text-xs text-muted-foreground">
                {t('settings.trial_ended_note', {
                  endDate: plan.trialEndDate
                    ? t('settings.trial_ended_on', { date: formatDate(plan.trialEndDate, { year: 'numeric', month: 'numeric', day: 'numeric' }) })
                    : '',
                })}
              </p>
            ) : null}
            {plan.upgradeUrl && !plan.trialActive && (plan.trialAvailable || plan.trialEnded || plan.tier !== 'pro') ? (
              <Button asChild className="mt-4 w-full">
                <a href={plan.upgradeUrl} target="_blank" rel="noreferrer">
                  {plan.trialAvailable ? t('action.start_free_trial') : t('action.upgrade_plan')}
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur animate-in slide-in-from-bottom-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-muted-foreground">{t('common.unsaved_changes')}</span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={saving} onClick={() => setDraft(saved)}>{t('common.discard')}</Button>
              <Button loading={saving} disabled={saving} onClick={() => void save()}>{t('common.save_changes')}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
