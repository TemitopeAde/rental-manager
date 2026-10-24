import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { post } from '@/dashboard/client';
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
  const { settings: saved, plan, storeCategories, storeCatalogVersion, reload } = useDashboard();
  const toast = useToast();
  const [draft, setDraft] = useState<Settings | null>(saved);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);

  const zones = useMemo(() => timezones(saved?.timezone ?? 'UTC'), [saved?.timezone]);
  const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));

  if (!draft || !plan) return <LoadingState />;

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
      toast('Settings saved.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Settings were not saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const limits = [
    plan.maxItems === null ? 'Unlimited items' : `Up to ${plan.maxItems} items`,
    plan.maxBookingsPerMonth === null ? 'Unlimited bookings' : `${plan.maxBookingsPerMonth} bookings a month`,
    plan.manualApproval ? 'Manual approval' : null,
    plan.perItemRules ? 'Per-item rules' : null,
    plan.calendar ? 'Calendar' : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4 pb-20">
      <SectionHeader title="Settings" description="These apply to every item unless an item overrides them." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Store</CardTitle>
              <CardDescription>Used for prices, rental categories, and for deciding what "today" means.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Time zone</Label>
                <Select value={draft.timezone} onValueChange={(value) => set('timezone', value)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {zones.map((zone) => <SelectItem key={zone} value={zone}>{zone.replace(/_/g, ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Currency</Label>
                <p className="flex h-9 items-center text-sm font-medium">{draft.currency}</p>
                <p className="text-xs text-muted-foreground">Your site's currency, which checkout charges in. Change it in your site's General Info.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Wix Stores rental category</CardTitle>
              <CardDescription>
                Products in this category can show the rental booking plugin. Product-level overrides are managed in Items.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {storeCatalogVersion === 'STORES_NOT_INSTALLED' ? (
                <p className="text-sm text-muted-foreground">Wix Stores is not installed or its catalog cannot be read.</p>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label>Rental category</Label>
                    <Select value={draft.storeCategoryId || '__none'} onValueChange={setStoreCategory}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="__none">No category selected</SelectItem>
                        {storeCategories.map((category) => (
                          <SelectItem key={`${category.version}:${category.id}`} value={category.id}>{category.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!draft.storeCategoryId ? <p className="text-xs text-muted-foreground">Only products explicitly enabled in Items will show rental controls.</p> : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pickup and return</CardTitle>
              <CardDescription>When renters collect and bring items back.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="pickup-hour" label="Pickup time" type="time" value={draft.pickupHour} onChange={(event) => set('pickupHour', event.target.value)} />
                <TextField id="return-hour" label="Return time" type="time" value={draft.returnHour} onChange={(event) => set('returnHour', event.target.value)} hint="Rentals not back by this time show as overdue." />
              </div>
              <Row label="Charge for the return day" description="Off: a Friday–Sunday rental is 2 days. On: it's 3.">
                <Switch checked={draft.countReturnDay} onCheckedChange={(checked) => set('countReturnDay', checked)} aria-label="Charge for the return day" />
              </Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default rental rules</CardTitle>
              <CardDescription>New items start with these values.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField id="min-days" label="Minimum days" {...num('defaultMinDays', 1)} />
              <TextField id="max-days" label="Maximum days" {...num('defaultMaxDays', 1)} />
              <TextField id="buffer-days" label="Buffer days" hint="Days kept free between rentals for cleaning or repairs." {...num('defaultBufferDays')} />
              <TextField id="lead-days" label="Lead days" hint="How much notice you need before a pickup." {...num('defaultLeadDays')} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Confirming bookings</CardTitle>
              <CardDescription>Choose whether paid bookings are confirmed automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              <Row
                label="Approve each booking myself"
                description={plan.manualApproval ? 'New bookings wait in Bookings until you approve them.' : 'Available on the Pro and Business plans.'}
              >
                <Switch
                  checked={draft.approvalMode === 'manual'}
                  disabled={!plan.manualApproval}
                  onCheckedChange={(checked) => set('approvalMode', checked ? 'manual' : 'auto')}
                  aria-label="Approve each booking myself"
                />
              </Row>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Crown className="size-4 text-amber-500" />Your plan</CardTitle>
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
                Your Business trial is active. Subscribe before it ends to keep these limits.
              </p>
            ) : plan.trialEnded ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Your Business trial ended{plan.trialEndDate ? ` on ${new Date(plan.trialEndDate).toLocaleDateString()}` : ''}. Items added during it are kept, but only your oldest item takes new bookings.
              </p>
            ) : null}
            {plan.upgradeUrl && !plan.trialActive && (plan.trialAvailable || plan.trialEnded || plan.tier !== 'pro') ? (
              <Button asChild className="mt-4 w-full">
                <a href={plan.upgradeUrl} target="_blank" rel="noreferrer">
                  {plan.trialAvailable ? 'Start free trial' : 'Upgrade plan'}
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur animate-in slide-in-from-bottom-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-muted-foreground">You have unsaved changes.</span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={saving} onClick={() => setDraft(saved)}>Discard</Button>
              <Button loading={saving} disabled={saving} onClick={() => void save()}>Save changes</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
