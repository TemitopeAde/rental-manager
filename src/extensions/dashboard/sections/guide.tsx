import { useEffect, useState, type ReactNode } from 'react';
import {
  AlarmClock,
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardList,
  LayoutGrid,
  Package,
  Settings2,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SectionHeader, useDashboard } from './shared';

type GuideTarget = 'items' | 'settings' | 'bookings' | 'today';
type StepId = 'items' | 'rules' | 'site' | 'approval' | 'late';

// Steps the app can't detect (like placing a widget in the Editor) are ticked off by hand.
// Kept per browser: it's a personal checklist, and losing it only means re-ticking a box.
const STORAGE_KEY = 'rental-manager:guide-done';

function readDone(): StepId[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is StepId => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function writeDone(done: StepId[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
  } catch {
    // Storage blocked (private mode, embedded frame): the checklist still works for this visit.
  }
}

interface Step {
  id: StepId;
  title: string;
  summary: string;
  icon: typeof Package;
  /** Set when the app can tell the step is done; such steps can't be ticked by hand. */
  autoDone?: boolean;
  body: ReactNode;
}

export function GuideSection({ onNavigate }: { onNavigate: (id: GuideTarget) => void }) {
  const { items, settings, plan, storeCatalogVersion } = useDashboard();
  const [manualDone, setManualDone] = useState<StepId[]>([]);
  // null follows the next unfinished step; 'none' means the merchant collapsed everything.
  const [openStep, setOpenStep] = useState<StepId | 'none' | null>(null);
  useEffect(() => setManualDone(readDone()), []);

  const realItems = items.filter((item) => !item._id.startsWith('sample-') && item.status !== 'archived');
  const storesInstalled = storeCatalogVersion !== 'STORES_NOT_INSTALLED';

  const steps: Step[] = [
    {
      id: 'items',
      title: 'Add your rental items',
      summary: realItems.length
        ? `${realItems.length} item${realItems.length === 1 ? '' : 's'} ready to rent.`
        : 'Create an item for each thing you rent.',
      icon: Package,
      autoDone: realItems.length > 0,
      body: (
        <>
          <p>Give each item a name, photos, a daily rate (and a weekly rate if you offer one), a deposit, and how many units you have.</p>
          <p>The sample “Camera kit” is there to show how things look. Edit it into a real item or archive it.</p>
          <StepAction label="Open items" onClick={() => onNavigate('items')} />
        </>
      ),
    },
    {
      id: 'rules',
      title: 'Set your rental rules',
      summary: 'Time zone, pickup and return times, and booking limits.',
      icon: Settings2,
      body: (
        <>
          <p>Choose your time zone and pickup and return times, then the limits every booking follows:</p>
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <Rule label="Minimum and maximum" text="the shortest and longest rental" />
            <Rule label="Lead time" text="how much notice you need before a pickup" />
            <Rule label="Buffer" text="days kept free after a return, for cleaning or checks" />
            <Rule label="Return day" text="whether the return day is billed" />
          </ul>
          {plan && !plan.perItemRules ? (
            <p className="text-xs">Your plan applies these to every item. Upgrade to set them per item.</p>
          ) : null}
          <StepAction label="Open settings" onClick={() => onNavigate('settings')} />
        </>
      ),
    },
    {
      id: 'site',
      title: 'Add booking to your site',
      summary: 'Place the booking widgets in the Wix Editor.',
      icon: LayoutGrid,
      body: (
        <>
          <p>In the Wix Editor, choose how customers find and book your rentals. You can use both.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Path
              icon={LayoutGrid}
              title="Rental widgets"
              points={[
                'Rental Catalog lists your items.',
                'Rental Details shows one item with its booking calendar. Set the catalog’s Details page URL to this page.',
                'Rental Booking starts a booking anywhere on your site.',
              ]}
            />
            <Path
              icon={ShoppingBag}
              title="Wix Stores products"
              points={[
                'Add the Rental Store Product plugin to your product page.',
                'Link a product to an item in Items, or pick a rental category in Settings.',
              ]}
              footer={storesInstalled ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span>Rental category:</span>
                  {settings?.storeCategories.length
                    ? settings.storeCategories.map((category) => <Badge key={category.id} variant="secondary">{category.name}</Badge>)
                    : <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => onNavigate('settings')}>Not set</button>}
                </div>
              ) : <p className="text-xs">Wix Stores isn’t installed on this site.</p>}
            />
          </div>
          <p className="text-xs">Each customer also needs Members Area to see their bookings under My rentals.</p>
        </>
      ),
    },
    {
      id: 'approval',
      title: 'Decide how bookings are approved',
      summary: settings?.approvalMode === 'manual' ? 'You review each booking before it’s confirmed.' : 'Paid bookings are confirmed straight away.',
      icon: ClipboardList,
      body: (
        <>
          <p>
            With <strong className="font-medium text-foreground">automatic</strong> approval, a paid booking is confirmed straight away.
            With <strong className="font-medium text-foreground">manual</strong> approval, it waits in Bookings as Pending until you approve or decline it.
          </p>
          {plan && !plan.manualApproval ? (
            <p className="text-xs">Manual approval isn’t included in your plan.</p>
          ) : null}
          <p>Either way, renters can ask to change dates, cancel or extend from My rentals, and those requests come to you.</p>
          <div className="flex flex-wrap gap-2">
            <StepAction label="Choose approval mode" onClick={() => onNavigate('settings')} />
            <StepAction label="Open bookings" variant="ghost" onClick={() => onNavigate('bookings')} />
          </div>
        </>
      ),
    },
    {
      id: 'late',
      title: 'Plan for late returns',
      summary: settings && settings.lateFeeMode !== 'off' ? 'Late fees are on.' : 'Set a grace period and an optional late fee.',
      icon: AlarmClock,
      body: (
        <>
          <p>
            In Settings → Late returns, set a grace period and an optional late fee: per day, per hour, or a share of the daily rate, with a cap.
            You also choose when an overdue rental is treated as possibly lost.
          </p>
          <p>Renters get a reminder on the return day and overdue notices after it. See “When a rental comes back late” below for what happens next.</p>
          <StepAction label="Set late return rules" onClick={() => onNavigate('settings')} />
        </>
      ),
    },
  ];

  const isDone = (step: Step) => Boolean(step.autoDone) || manualDone.includes(step.id);
  const doneCount = steps.filter(isDone).length;
  const nextStep = steps.find((step) => !isDone(step));
  const expanded = openStep ?? nextStep?.id ?? null;

  function toggleDone(id: StepId) {
    const next = manualDone.includes(id) ? manualDone.filter((entry) => entry !== id) : [...manualDone, id];
    setManualDone(next);
    writeDone(next);
    // Ticking a step off moves on to the next one.
    if (!manualDone.includes(id)) setOpenStep(null);
  }

  return (
    <div className="flex flex-col gap-5 pb-20">
      <SectionHeader title="Guide" description="Get your rentals online, then keep this page for everyday questions." />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-col gap-3 border-b p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold">{doneCount === steps.length ? 'You’re all set up' : 'Set up your rentals'}</h3>
              <span className="text-sm tabular-nums text-muted-foreground">{doneCount} of {steps.length} done</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-valuenow={doneCount}
              aria-label="Setup progress"
            >
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
          </div>

          <ol>
            {steps.map((step, index) => {
              const done = isDone(step);
              const open = expanded === step.id;
              const Icon = step.icon;
              return (
                <li key={step.id} className={cn('border-b last:border-b-0', open && 'bg-muted/30')}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-4 px-5 py-4 text-left"
                    aria-expanded={open}
                    aria-controls={`guide-step-${step.id}`}
                    onClick={() => setOpenStep(open ? 'none' : step.id)}
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums',
                        done ? 'border-primary bg-primary text-primary-foreground' : open ? 'border-primary text-primary' : 'text-muted-foreground',
                      )}
                      aria-hidden="true"
                    >
                      {done ? <Check className="size-4" /> : index + 1}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn('font-medium', done && !open && 'text-muted-foreground')}>{step.title}</span>
                      <span className="truncate text-sm text-muted-foreground">{step.summary}</span>
                    </span>
                    <span className="sr-only">{done ? 'Done' : 'Not done'}</span>
                    <Icon className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
                    <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
                  </button>
                  {open ? (
                    <div id={`guide-step-${step.id}`} className="flex flex-col gap-3 pr-5 pb-5 pl-[4.25rem] text-sm text-muted-foreground">
                      {step.body}
                      {step.autoDone === undefined ? (
                        <label className="mt-1 flex w-fit cursor-pointer items-center gap-2 text-foreground">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--primary)]"
                            checked={manualDone.includes(step.id)}
                            onChange={() => toggleDone(step.id)}
                          />
                          Mark as done
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Card>

        <Card className="lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle className="text-base">Your current setup</CardTitle>
            <CardDescription>Change any of these in Settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col divide-y text-sm">
              <SetupRow label="Plan" value={plan?.label ?? '—'} />
              <SetupRow label="Approval" value={settings ? (settings.approvalMode === 'manual' ? 'Manual' : 'Automatic') : '—'} />
              <SetupRow label="Deposit" value={settings ? (settings.depositMode === 'order' ? 'One per order' : 'Per item') : '—'} />
              <SetupRow label="Late fee" value={settings ? lateFeeLabel(settings.lateFeeMode) : '—'} />
              {storesInstalled ? (
                <SetupRow
                  label={settings?.storeCategories.length === 1 ? 'Rental category' : 'Rental categories'}
                  value={settings?.storeCategories.map((category) => category.name).join(', ') || 'Not set'}
                  muted={!settings?.storeCategories.length}
                />
              ) : null}
            </dl>
            <Button type="button" size="sm" variant="outline" className="mt-4 w-full" onClick={() => onNavigate('settings')}>
              Open settings<ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Everyday reference</h3>

        <Topic icon={ClipboardList} title="Running your bookings" summary="From a new booking to a returned item.">
          <Timeline
            entries={[
              ['A customer books', 'They pick dates, pay at checkout, and the booking appears in Bookings: Confirmed straight away, or Pending if you approve bookings yourself.'],
              ['Pickup day', 'Today lists the day’s pickups. Choose Mark picked up when the item leaves.'],
              ['Return day', 'Choose Mark returned when it comes back, then settle the deposit: keep some for damage or late fees, and refund the rest.'],
              ['Changes and cancellations', 'Open a booking to cancel it, refund it, or answer a renter’s request to change dates, cancel or extend.'],
            ]}
          />
          <StepAction label="Open Today" onClick={() => onNavigate('today')} />
        </Topic>

        <Topic icon={AlarmClock} title="When a rental comes back late" summary="What the app does for you, and what to do next.">
          <Timeline
            entries={[
              ['It’s flagged automatically', 'Once the return time and grace period pass, the rental is marked overdue. Its unit stays reserved and the late fee grows until you mark it returned. Open Today for the latest status.'],
              ['Protect the next renter', 'If the item is needed for a pickup in the next few days, it shows under “Next rentals at risk” on Today. Email that renter, or cancel and refund their booking.'],
              ['Collect the late fee', 'Marking it returned fixes the fee, and settling the deposit suggests keeping it. If the deposit doesn’t cover it, email the renter a payment link from the booking. Payment links need a published site that accepts payments.'],
              ['Or offer an extension', 'Renters can ask to keep the item longer from My rentals, even once it’s overdue. Approving reserves the extra days, reprices the rental and drops the late fee.'],
              ['If it doesn’t come back', 'Choose “Mark as not returned” on the booking. This keeps the whole deposit, stops the late fee, emails the renter, and can take the unit out of stock. To review that renter’s future bookings, turn on “Approve renters with a late return myself” in Settings.'],
            ]}
          />
          <StepAction label="Open Today" onClick={() => onNavigate('today')} />
        </Topic>

        {storesInstalled ? (
          <Topic icon={Store} title="Renting Wix Stores products" summary="Which products get rental dates.">
            <p>A product shows the rental calendar when its page has the Rental Store Product plugin and either:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>it’s linked to a rental item in Items, or</li>
              <li>it’s in the rental category chosen in Settings. Products in a subcategory of it count too.</li>
            </ul>
            <p>It also has to be a visible, physical product with a price. That price becomes the daily rate.</p>
            <StepAction label="Open items" onClick={() => onNavigate('items')} />
          </Topic>
        ) : null}
      </div>
    </div>
  );
}

function lateFeeLabel(mode: 'off' | 'day' | 'hour' | 'rate'): string {
  return { off: 'Off', day: 'Per day', hour: 'Per hour', rate: 'Share of daily rate' }[mode];
}

function StepAction({ label, onClick, variant = 'outline' }: { label: string; onClick: () => void; variant?: 'outline' | 'ghost' }) {
  return (
    <Button type="button" size="sm" variant={variant} className="w-fit" onClick={onClick}>
      {label}<ArrowRight className="size-4" aria-hidden="true" />
    </Button>
  );
}

function Rule({ label, text }: { label: string; text: string }) {
  return (
    <li>
      <span className="font-medium text-foreground">{label}</span>: {text}
    </li>
  );
}

function Path({ icon: Icon, title, points, footer }: { icon: typeof Package; title: string; points: string[]; footer?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2 text-foreground">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        <span className="font-medium">{title}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {points.map((point) => (
          <li key={point} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      {footer ? <div className="mt-auto border-t pt-2">{footer}</div> : null}
    </div>
  );
}

function SetupRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('truncate text-right font-medium', muted && 'font-normal text-muted-foreground')}>{value}</dd>
    </div>
  );
}

function Topic({ icon: Icon, title, summary, children }: { icon: typeof Package; title: string; summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
          <Icon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{title}</span>
          <span className="text-sm text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="flex flex-col gap-3 px-5 pb-5 pl-16 text-sm text-muted-foreground">{children}</div>
    </details>
  );
}

function Timeline({ entries }: { entries: Array<[string, string]> }) {
  return (
    <ol className="flex flex-col">
      {entries.map(([title, text], index) => (
        <li key={title} className="relative flex gap-3 pb-4 last:pb-0">
          {index < entries.length - 1 ? <span className="absolute top-6 bottom-0 left-[0.6875rem] w-px bg-border" aria-hidden="true" /> : null}
          <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold tabular-nums text-foreground" aria-hidden="true">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="font-medium text-foreground">{title}</p>
            <p>{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
