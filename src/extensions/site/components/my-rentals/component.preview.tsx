// This file is the Editor preview entry point for your component.
// Override or extend it when you need Editor-specific behavior or rendering
// (e.g. mock data, Editor-only interactions, or a different visual state).

import React from 'react';
import type { ComponentProps, FC } from 'react';
import {
  withDefaults,
  withFallbackPlaceholder,
} from '@wix/react-component-utils';
import Component from './my-rentals';
import { defaultProps } from './my-rentals.props';

const MyRentalsPreview: FC<ComponentProps<typeof Component>> = (props) => {
  return <Component {...props} />;
};

const MyRentalsPreviewWithFallback = withFallbackPlaceholder(MyRentalsPreview, {
  requiredDataFields: ['title'],
  rootClassName: 'my-rentals',
});

export default withDefaults(
  MyRentalsPreviewWithFallback,
  defaultProps
);
