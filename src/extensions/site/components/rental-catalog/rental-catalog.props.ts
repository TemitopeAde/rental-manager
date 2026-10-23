import type { A11y, Direction } from '@wix/editor-react-types';

type PartProps = { className?: string };

export type RentalCatalogProps = {
  id: string;
  className?: string;
  direction?: Direction;
  a11y?: A11y;
  title?: string;
  /** @min 1 @max 4 */
  columns?: number;
  /** @min 1 @max 48 */
  pageSize?: number;
  priceBasis?: 'daily' | 'weekly';
  showCategoryFilter?: boolean;
  elementProps?: {
    title?: PartProps;
    field?: PartProps;
    card?: PartProps;
    price?: PartProps;
    button?: PartProps;
  };
};

export const defaultProps = {
  title: 'Rentals',
  columns: 3,
  pageSize: 12,
  priceBasis: 'daily',
  showCategoryFilter: true,
} as const satisfies Omit<RentalCatalogProps, 'id' | 'className'>;
