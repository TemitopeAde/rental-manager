import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronsUpDown, Crown, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { post } from '@/dashboard/client';
import { useI18n } from '@/i18n';
import { LoadingState, numberField, SectionHeader, TextField, useDashboard, type Settings } from './shared';
import { useToast } from './toast';
import { BlockedDatesCard } from './blocked-dates';
import { isEmailAddress } from '@/rental/notify-rules';

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
  function toggleStoreCategory(id: string) {
    if (!draft) return;
    const isSelected = draft.storeCategories.some((entry) => entry.id === id);
    const category = storeCategories.find((entry) => entry.id === id);
    const next = isSelected
      ? draft.storeCategories.filter((entry) => entry.id !== id)
      : category
        ? [...draft.storeCategories, { id: category.id, name: category.name }]
        : draft.storeCategories;
    setDraft({
      ...draft,
      storeCategories: next,
      storeCategoryVersion: next.length ? category?.version ?? draft.storeCategoryVersion : undefined,
    });
  }
  function clearStoreCategories() {
    if (!draft) return;
    setDraft({ ...draft, storeCategories: [], storeCategoryVersion: undefined });
  }
  // Show the store's current name for a category; fall back to the name saved with it.
  const categoryName = (category: { id: string; name: string }) =>
    storeCategories.find((entry) => entry.id === category.id)?.name || category.name || category.id;
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
    plan.orderDeposit ? t('settings.limit_order_deposit') : null,
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                          <span className={draft.storeCategories.length ? 'truncate' : 'truncate text-muted-foreground'}>
                            {draft.storeCategories.length
                              ? draft.storeCategories.map((category) => categoryName(category)).join(', ')
                              : t('settings.category_placeholder')}
                          </span>
                          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
                        <Command>
                          <CommandInput placeholder={t('settings.category_placeholder')} />
                          <CommandList className="max-h-72">
                            <CommandEmpty>{t('settings.category_no_results')}</CommandEmpty>
                            <CommandGroup>
                              {storeCategories.map((category) => {
                                const checked = draft.storeCategories.some((entry) => entry.id === category.id);
                                return (
                                  <CommandItem
                                    key={`${category.version}:${category.id}`}
                                    value={`${category.name} ${category.id}`}
                                    data-checked={checked}
                                    aria-selected={checked}
                                    onSelect={() => toggleStoreCategory(category.id)}
                                  >
                                    {category.name}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {draft.storeCategories.length ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {draft.storeCategories.map((category) => (
                        <Badge key={category.id} variant="secondary" className="gap-1 pr-1">
                          {categoryName(category)}
                          <button
                            type="button"
                            className="rounded-sm opacity-60 hover:opacity-100"
                            aria-label={`Remove ${categoryName(category)}`}
                            onClick={() => toggleStoreCategory(category.id)}
                          >
                            <X className="size-3" aria-hidden="true" />
                          </button>
                        </Badge>
                      ))}
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearStoreCategories}>
                        {t('settings.category_clear')}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('settings.category_hint')}</p>
                  )}
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

          <BlockedDatesCard />

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
              <CardTitle>{t('settings.deposits_title')}</CardTitle>
              <CardDescription>{t('settings.deposits_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>{t('settings.deposit_mode')}</Label>
                <Select
                  value={plan.orderDeposit ? draft.depositMode : 'item'}
                  disabled={!plan.orderDeposit}
                  onValueChange={(value) => set('depositMode', value === 'order' ? 'order' : 'item')}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="item">{t('settings.deposit_mode_item')}</SelectItem>
                    <SelectItem value="order">{t('settings.deposit_mode_order')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {!plan.orderDeposit
                    ? t('settings.deposit_mode_locked_desc')
                    : draft.depositMode === 'order'
                      ? t('settings.deposit_mode_order_desc')
                      : t('settings.deposit_mode_item_desc')}
                </p>
              </div>
              {plan.orderDeposit && draft.depositMode === 'order' ? (
                <TextField
                  id="order-deposit"
                  label={t('settings.order_deposit_amount', { currency: draft.currency })}
                  step="0.01"
                  hint={draft.orderDepositAmount > 0 ? t('settings.order_deposit_amount_hint') : t('settings.order_deposit_amount_empty')}
                  {...numberField(draft.orderDepositAmount, (value) => set('orderDepositAmount', value))}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings.late_title')}</CardTitle>
              <CardDescription>{t('settings.late_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="late-grace"
                  label={t('settings.late_grace')}
                  hint={t('settings.late_grace_hint')}
                  {...numberField(draft.lateGraceMinutes, (value) => set('lateGraceMinutes', Math.round(value)))}
                />
                <div className="flex flex-col gap-1.5">
                  <Label>{t('settings.late_fee_mode')}</Label>
                  <Select value={draft.lateFeeMode} onValueChange={(value) => set('lateFeeMode', value as Settings['lateFeeMode'])}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">{t('settings.late_fee_off')}</SelectItem>
                      <SelectItem value="day">{t('settings.late_fee_day')}</SelectItem>
                      <SelectItem value="hour">{t('settings.late_fee_hour')}</SelectItem>
                      <SelectItem value="rate">{t('settings.late_fee_rate')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {draft.lateFeeMode !== 'off' ? (
                  <>
                    <TextField
                      id="late-fee-amount"
                      step="0.01"
                      label={draft.lateFeeMode === 'rate'
                        ? t('settings.late_fee_percent')
                        : t('settings.late_fee_amount', { currency: draft.currency })}
                      hint={draft.lateFeeMode === 'rate' ? t('settings.late_fee_percent_hint') : t('settings.late_fee_amount_hint')}
                      {...numberField(draft.lateFeeAmount, (value) => set('lateFeeAmount', value))}
                    />
                    <TextField
                      id="late-fee-max"
                      step="0.01"
                      label={t('settings.late_fee_max', { currency: draft.currency })}
                      hint={t('settings.late_fee_max_hint')}
                      {...numberField(draft.lateFeeMax, (value) => set('lateFeeMax', value))}
                    />
                  </>
                ) : null}
                <TextField
                  id="lost-after"
                  label={t('settings.lost_after')}
                  hint={t('settings.lost_after_hint')}
                  {...numberField(draft.lostAfterDays, (value) => set('lostAfterDays', Math.round(value)))}
                />
              </div>
              <Row
                label={t('settings.review_late_renters')}
                description={plan.manualApproval ? t('settings.review_late_renters_desc') : t('settings.manual_approval_disabled_desc')}
              >
                <Switch
                  checked={plan.manualApproval && draft.reviewLateRenters}
                  disabled={!plan.manualApproval}
                  onCheckedChange={(checked) => set('reviewLateRenters', checked)}
                  aria-label={t('settings.review_late_renters')}
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
              <TextField
                id="owner-alert-email"
                type="email"
                label={t('settings.owner_alert_email')}
                placeholder={t('settings.owner_alert_email_placeholder')}
                hint={t('settings.owner_alert_email_hint')}
                error={draft.ownerNotificationEmail?.trim() && !isEmailAddress(draft.ownerNotificationEmail) ? t('settings.owner_alert_email_invalid') : undefined}
                value={draft.ownerNotificationEmail ?? ''}
                onChange={(event) => set('ownerNotificationEmail', event.target.value)}
              />
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
              <Row label={t('settings.email_renters_returns')} description={t('settings.email_renters_returns_desc')}>
                <Switch checked={draft.emailRentersReturnReminders} onCheckedChange={(checked) => set('emailRentersReturnReminders', checked)} aria-label={t('settings.email_renters_returns')} />
              </Row>
              <Row label={t('settings.email_owner_overdue')} description={t('settings.email_owner_overdue_desc')}>
                <Switch checked={draft.emailOwnerOverdueAlerts} onCheckedChange={(checked) => set('emailOwnerOverdueAlerts', checked)} aria-label={t('settings.email_owner_overdue')} />
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
