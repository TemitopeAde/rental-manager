import React from 'react';
import type { FC } from 'react';
import classNames from 'classnames';
import { RentalDetails as RentalDetailsView } from '../../../../site/RentalDetails';
import styles from './rental-details.module.css';
import type { RentalDetailsProps } from './rental-details.props';

const RentalDetails: FC<RentalDetailsProps> = (props) => {
  const { id, className, direction, ...viewProps } = props;

  return (
    <div
      id={id}
      dir={direction}
      className={classNames('rental-details', styles.rentalDetails, styles.fallbackDirection, className)}
    >
      <RentalDetailsView {...viewProps} />
    </div>
  );
};

export default RentalDetails;
