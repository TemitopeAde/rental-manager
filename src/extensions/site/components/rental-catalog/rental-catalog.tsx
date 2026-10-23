import React, { type FC } from 'react';
import classNames from 'classnames';
import { RentalCatalogGrid } from '../../../../site/RentalCatalogGrid';
import styles from './rental-catalog.module.css';
import type { RentalCatalogProps } from './rental-catalog.props';

function partClass(globalClass: string, moduleClass: string, className?: string) {
  return { className: classNames(globalClass, moduleClass, className) };
}

const RentalCatalog: FC<RentalCatalogProps> = (props) => {
  const {
    id,
    className,
    direction,
    title,
    columns,
    pageSize,
    priceBasis,
    showCategoryFilter,
    elementProps,
  } = props;

  return (
    <div
      id={id}
      dir={direction}
      className={classNames('rental-catalog', styles.rentalCatalog, styles.fallbackDirection, className)}
    >
      <RentalCatalogGrid
        title={title}
        columns={columns}
        pageSize={pageSize}
        priceBasis={priceBasis}
        showCategoryFilter={showCategoryFilter}
        parts={{
          title: partClass('rental-catalog-title', styles.title, elementProps?.title?.className),
          field: partClass('rental-catalog-field', styles.field, elementProps?.field?.className),
          card: { className: classNames('rental-catalog-card', elementProps?.card?.className) },
          price: partClass('rental-catalog-price', styles.price, elementProps?.price?.className),
          button: partClass('rental-catalog-button', styles.button, elementProps?.button?.className),
        }}
      />
    </div>
  );
};

export default RentalCatalog;
