import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api, post } from '@/dashboard/client';
import { hasMembersAreaApp } from '@/rental/constants';
import { useToast } from './toast';

// Online bookings stay closed until the site has Wix Members Area, which My Rentals and
// renter sign-in depend on. This checks on load and offers a one-click install.
export function MembersAreaNotice() {
  const toast = useToast();
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ installedWixApps: string[] }>('/api/rentals/app-instance')
      .then((body) => {
        const isInstalled = hasMembersAreaApp(body.installedWixApps);
        setInstalled(isInstalled);
      })
      .catch(() => setInstalled(null));
  }, []);

  async function install() {
    setBusy(true);
    try {
      await post('/api/rentals/members-area', {});
      setInstalled(true);
      toast('Wix Members Area installed. Online booking is open.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not install Wix Members Area.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (installed !== false) return null;
  return (
    <Alert variant="destructive">
      <Users />
      <AlertTitle>Install Wix Members Area to take bookings</AlertTitle>
      <AlertDescription>
        Renters sign in to see, move and cancel their rentals, so online booking stays closed until the Members Area is on your site.
      </AlertDescription>
      <AlertAction>
        <Button size="sm" disabled={busy} onClick={() => void install()}>
          {busy ? 'Installing…' : 'Install now'}
        </Button>
      </AlertAction>
    </Alert>
  );
}
