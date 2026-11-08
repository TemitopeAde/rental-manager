import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api, post } from '@/dashboard/client';
import { useI18n } from '@/i18n';
import { hasMembersAreaApp } from '@/rental/constants';
import { useToast } from './toast';

// Online bookings stay closed until the site has Wix Members Area, which My Rentals and
// renter sign-in depend on. This checks on load and offers a one-click install.
export function MembersAreaNotice() {
  const { t } = useI18n();
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
      toast(t('members_area.toast_installed'));
    } catch (error) {
      toast(error instanceof Error ? error.message : t('members_area.toast_install_failed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (installed !== false) return null;
  return (
    <Alert variant="destructive">
      <Users />
      <AlertTitle>{t('members_area.title')}</AlertTitle>
      <AlertDescription>
        {t('members_area.desc')}
      </AlertDescription>
      <AlertAction>
        <Button size="sm" disabled={busy} onClick={() => void install()}>
          {busy ? t('members_area.btn_installing') : t('members_area.btn_install')}
        </Button>
      </AlertAction>
    </Alert>
  );
}
