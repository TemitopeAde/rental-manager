import { DayPicker, type DateRange, type Matcher } from 'react-day-picker';
import type { Locale } from 'react-day-picker/locale';
import { rangeProblem, startProblem, type ItemAvailability } from '../rental/calendar-rules';
import { isoDate } from './format';
import styles from './calendar.module.css';

function localDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

// react-day-picker ships unstyled when its stylesheet isn't imported; these module
// classes theme it with the widget's --rm-* tokens without leaking global CSS.
const classNames = {
  root: styles.root,
  months: styles.months,
  month: styles.month,
  month_caption: styles.caption,
  caption_label: styles.captionLabel,
  nav: styles.nav,
  button_previous: styles.navButton,
  button_next: styles.navButton,
  chevron: styles.chevron,
  month_grid: styles.grid,
  weekdays: styles.weekdays,
  weekday: styles.weekday,
  week: styles.week,
  day: styles.day,
  day_button: styles.dayButton,
  today: styles.today,
  outside: styles.outside,
  disabled: styles.disabled,
  hidden: styles.hidden,
  selected: styles.selected,
  range_start: styles.rangeStart,
  range_middle: styles.rangeMiddle,
  range_end: styles.rangeEnd,
};

export function RentalCalendar({
  range,
  onChange,
  firstAvailable,
  availability,
  quantity = 1,
  months = 1,
  locale,
  dir,
}: {
  range: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  firstAvailable: Date;
  /** Booked and closed days for the item. Until it loads, only past and lead-time days are disabled. */
  availability?: ItemAvailability | null;
  quantity?: number;
  months?: number;
  locale?: Locale;
  dir?: 'ltr' | 'rtl';
}) {
  const earliest = availability ? localDate(availability.earliestStart) : firstAvailable;
  const latest = availability ? localDate(availability.latestStart) : undefined;
  const pickup = range?.from && !range.to ? isoDate(range.from) : '';

  // A day stays clickable if it can start a rental, or (once a pickup is chosen) end one.
  // The server runs the same rules, so a greyed-out day is one it would reject.
  const unavailable = (date: Date) => {
    if (!availability) return false;
    const day = isoDate(date);
    if (!startProblem(availability, day, quantity)) return false;
    return !(pickup && day >= pickup && !rangeProblem(availability, pickup, day, quantity));
  };
  const disabled: Matcher[] = [{ before: earliest }, unavailable];

  function select(next: DateRange | undefined, clicked: Date) {
    if (availability && next?.from && next.to) {
      const problem = rangeProblem(availability, isoDate(next.from), isoDate(next.to), quantity);
      if (problem) {
        // Can't end here (e.g. a booked day in between): treat the click as a new pickup if it can be one.
        if (!startProblem(availability, isoDate(clicked), quantity)) onChange({ from: clicked, to: undefined });
        return;
      }
    }
    onChange(next);
  }

  return (
    <DayPicker
      mode="range"
      selected={range}
      onSelect={select}
      disabled={disabled}
      resetOnSelect
      startMonth={earliest}
      endMonth={latest}
      defaultMonth={range?.from ?? earliest}
      numberOfMonths={Math.min(2, Math.max(1, months))}
      showOutsideDays
      classNames={classNames}
      locale={locale}
      dir={dir}
    />
  );
}
