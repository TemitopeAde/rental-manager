import { DayPicker, type DateRange, type Matcher } from 'react-day-picker';
import styles from './calendar.module.css';

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
  months = 1,
}: {
  range: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  firstAvailable: Date;
  months?: number;
}) {
  const disabled: Matcher[] = [{ before: firstAvailable }];
  return (
    <DayPicker
      mode="range"
      selected={range}
      onSelect={onChange}
      disabled={disabled}
      excludeDisabled
      resetOnSelect
      startMonth={firstAvailable}
      defaultMonth={range?.from ?? firstAvailable}
      numberOfMonths={Math.min(2, Math.max(1, months))}
      showOutsideDays
      classNames={classNames}
    />
  );
}
