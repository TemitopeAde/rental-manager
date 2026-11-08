import { useState, type FC } from 'react';
import { BookOpenText, CalendarDays, CalendarRange, ChartColumn, ClipboardList, Package, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import { I18nProvider, LanguageSwitcher, useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  AnalyticsSection,
  BookingsSection,
  CalendarSection,
  DashboardDataProvider,
  ItemsSection,
  GuideSection,
  MembersAreaNotice,
  SettingsSection,
  ToastProvider,
  TodaySection,
  sections,
  useDashboard,
  type SectionId,
} from '../../sections';
import 'react-day-picker/style.css';
import '@/styles/globals.css';

const icons: Record<SectionId, typeof CalendarDays> = {
  today: CalendarDays,
  bookings: ClipboardList,
  calendar: CalendarRange,
  items: Package,
  analytics: ChartColumn,
  settings: Settings,
  guide: BookOpenText,
};

function initialSection(): SectionId {
  if (typeof window === 'undefined') return 'today';
  const hash = window.location.hash.replace('#', '');
  return sections.some((section) => section.id === hash) ? (hash as SectionId) : 'today';
}

function Shell() {
  const { plan } = useDashboard();
  const { t, formatDate } = useI18n();
  const [active, setActive] = useState<SectionId>(initialSection);

  function open(id: SectionId) {
    setActive(id);
    window.location.hash = id;
  }

  const today = formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' });
  const current = sections.find((section) => section.id === active) ?? sections[0];

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 md:flex-row">
      <aside className="border-b bg-background md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 md:px-5 md:pt-6 md:pb-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Package className="size-5" />
            </span>
            <span className="text-base font-semibold">{t('common.rentals')}</span>
          </div>
          {/* Mobile language switch pill */}
          <div className="w-32 md:hidden">
            <LanguageSwitcher />
          </div>
        </div>

        <nav
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-x-visible md:overflow-y-auto md:pb-0"
          aria-label={t('common.nav_label')}
        >
          {sections.map((section) => {
            const Icon = icons[section.id];
            const selected = section.id === active;
            return (
              <button
                key={section.id}
                type="button"
                aria-current={selected ? 'page' : undefined}
                onClick={() => open(section.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:w-full',
                  selected
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {t(`nav.${section.id}`)}
              </button>
            );
          })}
        </nav>

        {/* Pinned/fixed sidebar footer */}
        <div className="mt-auto hidden border-t p-4 md:flex md:flex-col md:gap-3 bg-background">
          <LanguageSwitcher />
          {plan ? (
            <div className="pt-0.5">
              <Badge variant="outline" className="w-full justify-center py-1 font-medium">
                {t('common.plan_badge', { plan: plan.label })}
              </Badge>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 md:py-8">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col">
              <h1 className="text-xl leading-tight font-semibold">{t(`nav.${current.id}`)}</h1>
              <p className="text-sm text-muted-foreground">{today}</p>
            </div>
            {plan ? (
              <Badge variant="outline" className="md:hidden">
                {t('common.plan_badge', { plan: plan.label })}
              </Badge>
            ) : null}
          </div>
          <MembersAreaNotice />
          {active === 'today' ? <TodaySection onNavigate={open} /> : null}
          {active === 'bookings' ? <BookingsSection /> : null}
          {active === 'calendar' ? <CalendarSection /> : null}
          {active === 'items' ? <ItemsSection /> : null}
          {active === 'analytics' ? <AnalyticsSection /> : null}
          {active === 'settings' ? <SettingsSection /> : null}
          {active === 'guide' ? <GuideSection onNavigate={open} /> : null}
        </div>
      </main>
    </div>
  );
}

const DashboardPage: FC = () => (
  <I18nProvider>
    <TooltipProvider>
      <ToastProvider>
        <DashboardDataProvider>
          <Shell />
        </DashboardDataProvider>
      </ToastProvider>
    </TooltipProvider>
  </I18nProvider>
);

export default DashboardPage;
