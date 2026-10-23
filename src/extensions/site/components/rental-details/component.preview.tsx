// This file is the Editor preview entry point for your component.
// Override or extend it when you need Editor-specific behavior or rendering
// (e.g. mock data, Editor-only interactions, or a different visual state).

import React from 'react';
import type { ComponentProps, FC } from 'react';
import {
  withDefaults,
  withFallbackPlaceholder,
} from '@wix/react-component-utils';
import Component from './rental-details';
import { defaultProps } from './rental-details.props';

const RentalDetailsPreview: FC<ComponentProps<typeof Component>> = (props) => {
  return <Component {...props} />;
};

const RentalDetailsPreviewWithFallback = withFallbackPlaceholder(RentalDetailsPreview, {
  requiredDataFields: ['bookingTitle'],
  rootClassName: 'rental-details',
});

export default withDefaults(
  RentalDetailsPreviewWithFallback,
  defaultProps
);
