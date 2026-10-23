import { useEffect, useState, type ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, post } from '@/dashboard/client';

export const sections = [
  { id: 'today', label: 'Today', description: 'Pickups, returns, and overdue rentals' },
  { id: 'bookings', label: 'Bookings', description: 'Approve, hand over, return, and cancel' },
  { id: 'calendar', label: 'Calendar', description: 'Upcoming rentals' },
  { id: 'items', label: 'Items', description: 'What you rent, and the daily rate' },
  { id: 'settings', label: 'Settings', description: 'Hours, buffers, and how bookings are confirmed' },
] as const;

export type SectionId = (typeof sections)[number]['id'];

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'overdue') return 'destructive';
  if (status === 'cancelled' || status === 'expired') return 'outline';
  if (status === 'pending' || status === 'hold') return 'secondary';
  return 'default';
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function LoadingRows() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

interface BookingRow {
  _id: string;
  reference: string;
  itemId: string;
  startDate: string;
  endDate: string;
  status: string;
  quantity: number;
  ecomOrderId: string;
  refundNeeded: boolean;
  renter: { name: string; email: string };
  quote: { total: number };
}

export function TodaySection() {
  const [today, setToday] = useState<{ date: string; pickups: BookingRow[]; returns: BookingRow[]; overdue: BookingRow[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ date: string; pickups: BookingRow[]; returns: BookingRow[]; overdue: BookingRow[] }>('/api/rentals/today')
      .then(setToday)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <Notice title="Could not load today">{error}</Notice>;
  if (!today) return <LoadingRows />;

  const groups = [
    { title: 'Pickups', rows: today.pickups },
    { title: 'Returns', rows: today.returns },
    { title: 'Overdue', rows: today.overdue },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {groups.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
            <CardDescription>{group.rows.length} for {today.date}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {group.rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing scheduled.</p> : group.rows.map((row) => (
              <div key={row._id}>
                <p className="font-medium">{row.reference}</p>
                <p className="text-sm text-muted-foreground">{row.renter.name || 'Renter'} · {row.status}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function BookingsSection() {
  const [rows, setRows] = useState<BookingRow[] | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  async function load() {
    const body = await api<{ bookings: BookingRow[] }>('/api/rentals/bookings');
    setRows(body.bookings);
  }

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
  }, []);

  async function act(reference: string, action: string) {
    setNote('');
    const result = await post<{ ok: boolean; message?: string; refundOrderId?: string }>('/api/rentals/bookings', { reference, action });
    if (!result.ok) {
      setNote(result.message || 'That change was not saved.');
      return;
    }
    if (action === 'cancel' && result.refundOrderId) {
      setNote(`Cancelled. Refund the Wix order ${result.refundOrderId} from the order page.`);
    }
    await load();
  }

  if (error) return <Notice title="Could not load bookings">{error}</Notice>;
  if (!rows) return <LoadingRows />;

  return (
    <div className="flex flex-col gap-4">
      {note ? <Alert><AlertDescription>{note}</AlertDescription></Alert> : null}
      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No bookings yet</CardTitle>
            <CardDescription>Reservations appear here after a renter pays, or after you add one.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Renter</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="font-medium">{row.reference}</TableCell>
                    <TableCell>{row.renter.name || row.renter.email}</TableCell>
                    <TableCell>{row.startDate} → {row.endDate}</TableCell>
                    <TableCell>
                      <Badge variant={row.refundNeeded ? 'destructive' : statusVariant(row.status)}>
                        {row.refundNeeded ? `${row.status} · refund` : row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.quote.total}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {row.status === 'pending' ? <Button size="sm" onClick={() => void act(row.reference, 'approve')}>Approve</Button> : null}
                        {row.status === 'pending' ? <Button size="sm" variant="outline" onClick={() => void act(row.reference, 'decline')}>Decline</Button> : null}
                        {row.status === 'confirmed' ? <Button size="sm" onClick={() => void act(row.reference, 'pickup')}>Picked up</Button> : null}
                        {row.status === 'active' || row.status === 'overdue' ? <Button size="sm" onClick={() => void act(row.reference, 'returned')}>Returned</Button> : null}
                        {row.status !== 'cancelled' && row.status !== 'returned' ? <Button size="sm" variant="destructive" onClick={() => void act(row.reference, 'cancel')}>Cancel</Button> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function CalendarSection() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ plan: { calendar: boolean } }>('/api/rentals/settings')
      .then(async (settings) => {
        setAllowed(settings.plan.calendar);
        if (!settings.plan.calendar) return;
        const body = await api<{ bookings: BookingRow[] }>('/api/rentals/bookings');
        setRows(body.bookings.filter((row) => !['expired', 'cancelled'].includes(row.status)));
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <Notice title="Could not load the calendar">{error}</Notice>;
  if (allowed === null) return <LoadingRows />;
  if (!allowed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calendar is on the Pro plan</CardTitle>
          <CardDescription>Upgrade to see every rental on one schedule.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pickup</TableHead>
              <TableHead>Return</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Renter</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row._id}>
                <TableCell>{row.startDate}</TableCell>
                <TableCell>{row.endDate}</TableCell>
                <TableCell>{row.reference}</TableCell>
                <TableCell>{row.renter.name}</TableCell>
                <TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface ItemRow {
  _id: string;
  name: string;
  category: string;
  dailyRate: number;
  weeklyRate: number;
  unitCount: number;
  status: string;
}

export function ItemsSection() {
  const [rows, setRows] = useState<ItemRow[] | null>(null);
  const [name, setName] = useState('');
  const [dailyRate, setDailyRate] = useState(20);
  const [message, setMessage] = useState('');

  async function load() {
    const body = await api<{ items: ItemRow[] }>('/api/rentals/items');
    setRows(body.items);
  }

  useEffect(() => {
    load().catch((reason: Error) => setMessage(reason.message));
  }, []);

  async function create() {
    const result = await post<{ ok: boolean; message?: string }>('/api/rentals/items', { name, dailyRate, unitCount: 1 });
    if (!result.ok) {
      setMessage(result.message || 'Could not create the item.');
      return;
    }
    setName('');
    setMessage('Item created.');
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <Alert><AlertDescription>{message}</AlertDescription></Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>New item</CardTitle>
          <CardDescription>A name and a daily rate are enough to start renting.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-name">Name</Label>
              <Input id="item-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-rate">Daily rate</Label>
              <Input id="item-rate" type="number" min={0} value={dailyRate} onChange={(event) => setDailyRate(Number(event.target.value) || 0)} />
            </div>
          </div>
          <Button className="w-fit" disabled={!name || dailyRate <= 0} onClick={() => void create()}>Add item</Button>
        </CardContent>
      </Card>
      {!rows && !message ? <LoadingRows /> : null}
      {rows && rows.length > 0 ? (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Daily</TableHead>
                  <TableHead>Weekly</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.category || '—'}</TableCell>
                    <TableCell>{row.dailyRate}</TableCell>
                    <TableCell>{row.weeklyRate || '—'}</TableCell>
                    <TableCell>{row.unitCount}</TableCell>
                    <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

interface Settings {
  timezone: string;
  pickupHour: string;
  returnHour: string;
  approvalMode: 'auto' | 'manual';
  defaultBufferDays: number;
  defaultMinDays: number;
  defaultMaxDays: number;
  defaultLeadDays: number;
  countReturnDay: boolean;
  currency: string;
}

export function SettingsSection() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [manualAllowed, setManualAllowed] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api<{ settings: Settings; plan: { manualApproval: boolean } }>('/api/rentals/settings')
      .then((body) => {
        setSettings(body.settings);
        setManualAllowed(body.plan.manualApproval);
      })
      .catch((reason: Error) => setMessage(reason.message));
  }, []);

  async function save() {
    if (!settings) return;
    const saved = await post<{ settings: Settings }>('/api/rentals/settings', settings);
    setSettings(saved.settings);
    setMessage('Settings saved.');
  }

  if (message && !settings) return <Notice title="Could not load settings">{message}</Notice>;
  if (!settings) return <LoadingRows />;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {message ? <Alert><AlertDescription>{message}</AlertDescription></Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Timezone" value={settings.timezone} onChange={(timezone) => setSettings({ ...settings, timezone })} />
          <Field label="Currency" value={settings.currency} onChange={(currency) => setSettings({ ...settings, currency })} />
          <Field label="Pickup time" value={settings.pickupHour} onChange={(pickupHour) => setSettings({ ...settings, pickupHour })} />
          <Field label="Return time" value={settings.returnHour} onChange={(returnHour) => setSettings({ ...settings, returnHour })} />
          <NumberField label="Buffer days" value={settings.defaultBufferDays} onChange={(defaultBufferDays) => setSettings({ ...settings, defaultBufferDays })} />
          <NumberField label="Lead days" value={settings.defaultLeadDays} onChange={(defaultLeadDays) => setSettings({ ...settings, defaultLeadDays })} />
          <NumberField label="Minimum days" value={settings.defaultMinDays} min={1} onChange={(defaultMinDays) => setSettings({ ...settings, defaultMinDays })} />
          <NumberField label="Maximum days" value={settings.defaultMaxDays} min={1} onChange={(defaultMaxDays) => setSettings({ ...settings, defaultMaxDays })} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="count-return">Count the return day</Label>
          <Switch id="count-return" checked={settings.countReturnDay} onCheckedChange={(checked) => setSettings({ ...settings, countReturnDay: checked })} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="manual-approval">{manualAllowed ? 'Manual approval' : 'Manual approval is on Starter and Pro'}</Label>
          <Switch
            id="manual-approval"
            checked={settings.approvalMode === 'manual'}
            disabled={!manualAllowed}
            onCheckedChange={(checked) => setSettings({ ...settings, approvalMode: checked ? 'manual' : 'auto' })}
          />
        </div>
        <Button className="w-fit" onClick={() => void save()}>Save</Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({ label, value, min = 0, onChange }: { label: string; value: number; min?: number; onChange: (value: number) => void }) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={min} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} />
    </div>
  );
}
