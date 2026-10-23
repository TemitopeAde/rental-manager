import React, { type FC } from 'react';
import classNames from 'classnames';
import { RentalBookingForm } from '../../../../site/RentalBookingForm';
import styles from './rental-booking.module.css';
import type { RentalBookingProps } from './rental-booking.props';

function partClass(globalClass: string, moduleClass: string, className?: string) {
  return { className: classNames(globalClass, moduleClass, className) };
}

const RentalBooking: FC<RentalBookingProps> = (props) => {
  const {
    id,
    className,
    direction,
    title,
    description,
    itemId,
    buttonLabel,
    showDeposit,
    showWeeklyPrice,
    showQuantity,
    elementProps,
  } = props;

  return (
    <div
      id={id}
      dir={direction}
      className={classNames('rental-booking', styles.rentalBooking, styles.fallbackDirection, className)}
    >
      <RentalBookingForm
        title={title}
        description={description}
        itemId={itemId}
        buttonLabel={buttonLabel}
        showDeposit={showDeposit}
        showWeeklyPrice={showWeeklyPrice}
        showQuantity={showQuantity}
        parts={{
          title: partClass('rental-booking-title', styles.title, elementProps?.title?.className),
          description: partClass('rental-booking-description', styles.description, elementProps?.description?.className),
          field: partClass('rental-booking-field', styles.field, elementProps?.field?.className),
          quote: partClass('rental-booking-quote', styles.quote, elementProps?.quote?.className),
          button: partClass('rental-booking-button', styles.button, elementProps?.button?.className),
        }}
      />
    </div>
  );
};

export default RentalBooking;
