import { useState, type FC } from 'react';
import { CalendarDays, CalendarRange, ClipboardList, Package, Settings } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  BookingsSection,
  CalendarSection,
  ItemsSection,
  SettingsSection,
  TodaySection,
  sections,
  type SectionId,
} from '../../sections';
import '@/styles/globals.css';

const icons: Record<SectionId, typeof CalendarDays> = {
  today: CalendarDays,
  bookings: ClipboardList,
  calendar: CalendarRange,
  items: Package,
  settings: Settings,
};

const views: Record<SectionId, FC> = {
  today: TodaySection,
  bookings: BookingsSection,
  calendar: CalendarSection,
  items: ItemsSection,
  settings: SettingsSection,
};

function initialSection(): SectionId {
  if (typeof window === 'undefined') return 'today';
  const hash = window.location.hash.replace('#', '');
  return sections.some((section) => section.id === hash) ? (hash as SectionId) : 'today';
}

const DashboardPage: FC = () => {
  const [active, setActive] = useState<SectionId>(initialSection);
  const current = sections.find((section) => section.id === active) ?? sections[0];
  const View = views[active];

  function open(id: SectionId) {
    setActive(id);
    window.location.hash = id;
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="px-2 py-1 text-sm font-medium">Rentals</div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sections.map((section) => {
                    const Icon = icons[section.id];
                    return (
                      <SidebarMenuItem key={section.id}>
                        <SidebarMenuButton isActive={section.id === active} tooltip={section.label} onClick={() => open(section.id)}>
                          <Icon />
                          <span>{section.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 items-center gap-3 border-b px-4">
            <SidebarTrigger />
            <div>
              <h1 className="text-sm font-medium">{current.label}</h1>
              <p className="text-xs text-muted-foreground">{current.description}</p>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <View />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
};

export default DashboardPage;
