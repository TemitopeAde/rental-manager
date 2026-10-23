import type { A11y, Direction } from '@wix/editor-react-types';

type PartProps = { className?: string };

export type RentalBookingProps = {
  id: string;
  className?: string;
  direction?: Direction;
  a11y?: A11y;
  title?: string;
  description?: string;
  itemId?: string;
  buttonLabel?: string;
  showDeposit?: boolean;
  showWeeklyPrice?: boolean;
  showQuantity?: boolean;
  elementProps?: {
    title?: PartProps;
    description?: PartProps;
    field?: PartProps;
    quote?: PartProps;
    button?: PartProps;
  };
};

export const defaultProps = {
  title: 'Rentals',
  description: 'Choose dates and rent.',
  buttonLabel: 'Rent now',
  showDeposit: true,
  showWeeklyPrice: true,
  showQuantity: true,
} as const satisfies Omit<RentalBookingProps, 'id' | 'className'>;
