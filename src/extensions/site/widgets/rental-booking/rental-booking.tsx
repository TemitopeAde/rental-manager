import React from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import { RentalBookingForm } from '../../../../site/RentalBookingForm';
import { appearanceStyle, bodyFont, buttonFont, headingFont, parseFont } from '../panel-fields';
import styles from './rental-booking.module.css';

function BookingElement(props: {
  title?: string;
  description?: string;
  itemId?: string;
  buttonLabel?: string;
  showDeposit?: boolean;
  showWeeklyPrice?: boolean;
  showQuantity?: boolean;
  backgroundColor?: string;
  cardColor?: string;
  textColor?: string;
  headingColor?: string;
  accentColor?: string;
  buttonTextColor?: string;
  borderColor?: string;
  headingFont?: string;
  bodyFont?: string;
  buttonFont?: string;
}) {
  return (
    <div
      className={styles.root}
      style={appearanceStyle({
        background: props.backgroundColor,
        card: props.cardColor,
        text: props.textColor,
        heading: props.headingColor,
        accent: props.accentColor,
        onAccent: props.buttonTextColor,
        border: props.borderColor,
        headingFont: props.headingFont ? parseFont(props.headingFont, headingFont) : undefined,
        bodyFont: props.bodyFont ? parseFont(props.bodyFont, bodyFont) : undefined,
        buttonFont: props.buttonFont ? parseFont(props.buttonFont, buttonFont) : undefined,
      })}
    >
      <RentalBookingForm
        title={props.title}
        description={props.description}
        itemId={props.itemId}
        buttonLabel={props.buttonLabel}
        showDeposit={props.showDeposit}
        showWeeklyPrice={props.showWeeklyPrice}
        showQuantity={props.showQuantity}
      />
    </div>
  );
}

export default reactToWebComponent(BookingElement, React, ReactDOM, {
  props: {
    title: 'string',
    description: 'string',
    itemId: 'string',
    buttonLabel: 'string',
    showDeposit: 'boolean',
    showWeeklyPrice: 'boolean',
    showQuantity: 'boolean',
    backgroundColor: 'string',
    cardColor: 'string',
    textColor: 'string',
    headingColor: 'string',
    accentColor: 'string',
    buttonTextColor: 'string',
    borderColor: 'string',
    headingFont: 'string',
    bodyFont: 'string',
    buttonFont: 'string',
  },
});
