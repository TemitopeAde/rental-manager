export { AnalyticsSection } from './analytics';
export { BookingsSection } from './bookings';
export { CalendarSection } from './calendar';
export { ItemsSection } from './items';
export { MembersAreaNotice } from './members-area';
export { SettingsSection } from './settings';
export { DashboardDataProvider, useDashboard } from './shared';
export { TodaySection } from './today';
export { ToastProvider } from './toast';

export const sections = [
  { id: 'today', label: 'Today' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'items', label: 'Items' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
] as const;

export type SectionId = (typeof sections)[number]['id'];
