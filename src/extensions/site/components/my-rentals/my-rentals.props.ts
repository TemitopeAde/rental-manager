import type { A11y, Direction } from '@wix/editor-react-types';

export type MyRentalsProps = {
  id: string;
  className?: string;
  direction?: Direction;
  a11y?: A11y;
  title?: string;
  description?: string;
  loginLabel?: string;
  emptyText?: string;
  showPast?: boolean;
};

export const defaultProps = {
  title: 'My rentals',
  description: '',
  loginLabel: 'Log in',
  emptyText: "You don't have any rentals yet.",
  showPast: true,
} as const satisfies Omit<MyRentalsProps, 'id' | 'className'>;
