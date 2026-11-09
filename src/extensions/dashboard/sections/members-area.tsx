import { Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { api } from '@/dashboard/client';
import { useI18n } from '@/i18n';
import { hasMembersAreaApp } from '@/rental/constants';
import { ErrorState, RefreshNotice, useResource } from './shared';

// Online bookings stay closed until the site has Wix Members Area, which My Rentals and
// renter sign-in depend on. This checks on load and displays a notice if missing.
export function MembersAreaNotice() {
  const { t } = useI18n();
  const { data, error, refresh, refreshError } = useResource('/api/rentals/app-instance', () => api<{ installedWixApps: string[] }>('/api/rentals/app-instance'));
  const installed = data ? hasMembersAreaApp(data.installedWixApps) : null;

  if (error && !data) return <ErrorState title={t('members_area.error_title')} message={error} onRetry={() => void refresh()} />;
  if (installed !== false && !refreshError) return null;
  return (
    <div className="flex flex-col gap-3">
      {refreshError ? <RefreshNotice onRetry={() => void refresh()} /> : null}
      {installed === false ? (
        <Alert variant="destructive">
          <Users />
          <AlertTitle>{t('members_area.title')}</AlertTitle>
          <AlertDescription>{t('members_area.desc')}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
