import { ArrowRight, CalendarDays, ClipboardList, Package, Settings2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type GuideTarget = 'items' | 'settings' | 'bookings';

const steps: Array<{
  number: string;
  title: string;
  description: string;
  icon: typeof Package;
  action: string;
  target?: GuideTarget;
}> = [
  {
    number: '01',
    title: 'Add your rental items',
    description: 'Create an item for each product or service you rent. Add a name, photos, rates, deposit, and availability details.',
    icon: Package,
    action: 'Open items',
    target: 'items',
  },
  {
    number: '02',
    title: 'Set your rental rules',
    description: 'Choose your timezone and currency, set pickup and return times, and define minimum, maximum, buffer, and lead days.',
    icon: Settings2,
    action: 'Configure settings',
    target: 'settings',
  },
  {
    number: '03',
    title: 'Add booking to your site',
    description: 'In the Wix Editor, add the Rental Catalog, Rental Details, or Rental Booking widget to the pages where customers should browse and book. If you use Wix Stores to manage rental products, add the Rental Store Product site plugin to each product page so customers can select rental dates and book through your store.',
    icon: ShoppingBag,
    action: 'View items',
    target: 'items',
  },
  {
    number: '04',
    title: 'Manage incoming bookings',
    description: 'Review booking requests, approve or decline them when manual approval is enabled, and track pickups and returns from your dashboard.',
    icon: ClipboardList,
    action: 'Open bookings',
    target: 'bookings',
  },
];

export function GuideSection({ onNavigate }: { onNavigate: (id: GuideTarget) => void }) {
  return (
    <div className="flex flex-col gap-5 pb-20">
      <Card>
        <CardHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarDays className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>Set up rentals in four steps</CardTitle>
          <CardDescription>Prepare your inventory, set your rules, add booking to your site, and manage each reservation here.</CardDescription>
        </CardHeader>
      </Card>

      <ol className="grid gap-3 lg:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.number}>
              <Card className="h-full">
                <CardHeader className="flex-row items-start gap-3 space-y-0">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40" aria-hidden="true">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground">STEP {step.number}</p>
                    <CardTitle className="text-base">{step.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-4 pl-[3.75rem]">
                  <CardDescription>{step.description}</CardDescription>
                  {step.target ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => onNavigate(step.target!)}>
                      {step.action}<ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>Connect the customer journey</CardTitle>
          <CardDescription>For a browsable catalog, set the catalog widget’s Details page URL to a page containing Rental Details. Add Rental Booking where you want customers to start a booking directly.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
