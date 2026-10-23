import React from 'react';
import type { FC } from 'react';
import classNames from 'classnames';
import { MyRentals as MyRentalsView } from '../../../../site/MyRentals';
import styles from './my-rentals.module.css';
import type { MyRentalsProps } from './my-rentals.props';

const MyRentals: FC<MyRentalsProps> = (props) => {
  const { id, className, direction, ...viewProps } = props;

  return (
    <div
      id={id}
      dir={direction}
      className={classNames('my-rentals', styles.myRentals, styles.fallbackDirection, className)}
    >
      <MyRentalsView {...viewProps} />
    </div>
  );
};

export default MyRentals;
