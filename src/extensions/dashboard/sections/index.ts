export { BookingsSection } from './bookings';
export { CalendarSection } from './calendar';
export { ItemsSection } from './items';
export { SettingsSection } from './settings';
export { DashboardDataProvider, useDashboard } from './shared';
export { TodaySection } from './today';
export { ToastProvider } from './toast';

export const sections = [
  { id: 'today', label: 'Today' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'items', label: 'Items' },
  { id: 'settings', label: 'Settings' },
] as const;

export type SectionId = (typeof sections)[number]['id'];
