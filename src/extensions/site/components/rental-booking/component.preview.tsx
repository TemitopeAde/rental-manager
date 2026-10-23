// This file is the Editor preview entry point for your component.
// Override or extend it when you need Editor-specific behavior or rendering
// (e.g. mock data, Editor-only interactions, or a different visual state).

import React from 'react';
import type { ComponentProps, FC } from 'react';
import {
  withDefaults,
  withFallbackPlaceholder,
} from '@wix/react-component-utils';
import Component from './rental-booking';
import { defaultProps } from './rental-booking.props';

const RentalBookingPreview: FC<ComponentProps<typeof Component>> = (props) => {
  return <Component {...props} />;
};

const RentalBookingPreviewWithFallback = withFallbackPlaceholder(RentalBookingPreview, {
  requiredDataFields: ['title', 'buttonLabel'],
  rootClassName: 'rental-booking',
});

export default withDefaults(
  RentalBookingPreviewWithFallback,
  defaultProps
);
