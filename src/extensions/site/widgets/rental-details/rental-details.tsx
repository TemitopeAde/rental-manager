import React from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import { RentalDetails, type ImageSize } from '../../../../site/RentalDetails';
import type { ImageRatio } from '../../../../site/RentalCatalogGrid';
import { appearanceStyle, bodyFont, buttonFont, headingFont, parseFont } from '../panel-fields';
import styles from './rental-details.module.css';

function DetailsElement(props: {
  itemSlug?: string;
  catalogPage?: string;
  backLabel?: string;
  showCategory?: boolean;
  showDescription?: boolean;
  showWeeklyPrice?: boolean;
  showDeposit?: boolean;
  showQuantity?: boolean;
  showThumbnails?: boolean;
  imageRatio?: string;
  imageSize?: string;
  bookingTitle?: string;
  buttonLabel?: string;
  monthsShown?: number;
  backgroundColor?: string;
  cardColor?: string;
  textColor?: string;
  headingColor?: string;
  accentColor?: string;
  buttonTextColor?: string;
  borderColor?: string;
  cornerRadius?: number;
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
        radius: props.cornerRadius,
        headingFont: props.headingFont ? parseFont(props.headingFont, headingFont) : undefined,
        bodyFont: props.bodyFont ? parseFont(props.bodyFont, bodyFont) : undefined,
        buttonFont: props.buttonFont ? parseFont(props.buttonFont, buttonFont) : undefined,
      })}
    >
      <RentalDetails
        itemSlug={props.itemSlug}
        catalogPage={props.catalogPage}
        backLabel={props.backLabel}
        showCategory={props.showCategory}
        showDescription={props.showDescription}
        showWeeklyPrice={props.showWeeklyPrice}
        showDeposit={props.showDeposit}
        showQuantity={props.showQuantity}
        showThumbnails={props.showThumbnails}
        imageRatio={props.imageRatio as ImageRatio | undefined}
        imageSize={props.imageSize as ImageSize | undefined}
        bookingTitle={props.bookingTitle}
        buttonLabel={props.buttonLabel}
        monthsShown={props.monthsShown}
      />
    </div>
  );
}

export default reactToWebComponent(DetailsElement, React, ReactDOM, {
  props: {
    itemSlug: 'string',
    catalogPage: 'string',
    backLabel: 'string',
    showCategory: 'boolean',
    showDescription: 'boolean',
    showWeeklyPrice: 'boolean',
    showDeposit: 'boolean',
    showQuantity: 'boolean',
    showThumbnails: 'boolean',
    imageRatio: 'string',
    imageSize: 'string',
    bookingTitle: 'string',
    buttonLabel: 'string',
    monthsShown: 'number',
    backgroundColor: 'string',
    cardColor: 'string',
    textColor: 'string',
    headingColor: 'string',
    accentColor: 'string',
    buttonTextColor: 'string',
    borderColor: 'string',
    cornerRadius: 'number',
    headingFont: 'string',
    bodyFont: 'string',
    buttonFont: 'string',
  },
});
