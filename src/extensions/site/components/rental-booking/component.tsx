// This file wires your component with its default props and exports it for use by the extension.
// Please do not modify the structure or logic of this file

import { withDefaults } from '@wix/react-component-utils';
import Component from './rental-booking';
import { defaultProps } from './rental-booking.props';

const RentalBooking = withDefaults(
  Component,
  defaultProps
);

export default RentalBooking;
