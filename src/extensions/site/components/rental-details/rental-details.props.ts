import type { A11y, Direction } from '@wix/editor-react-types';

export type RentalDetailsProps = {
  id: string;
  className?: string;
  direction?: Direction;
  a11y?: A11y;
  itemSlug?: string;
  catalogPage?: string;
  backLabel?: string;
  bookingTitle?: string;
  buttonLabel?: string;
  imageRatio?: 'square' | 'portrait' | 'landscape';
  imageSize?: 'small' | 'medium' | 'large';
  monthsShown?: number;
  showCategory?: boolean;
  showDescription?: boolean;
  showThumbnails?: boolean;
  showWeeklyPrice?: boolean;
  showDeposit?: boolean;
  showQuantity?: boolean;
};

export const defaultProps = {
  itemSlug: '',
  catalogPage: '',
  backLabel: 'All rentals',
  bookingTitle: 'Choose your dates',
  buttonLabel: 'Rent now',
  imageRatio: 'square',
  imageSize: 'medium',
  monthsShown: 1,
  showCategory: true,
  showDescription: true,
  showThumbnails: true,
  showWeeklyPrice: true,
  showDeposit: true,
  showQuantity: true,
} as const satisfies Omit<RentalDetailsProps, 'id' | 'className'>;
