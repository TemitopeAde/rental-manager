import React from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import { RentalCatalogGrid, type ImageHover, type ImageRatio } from '../../../../site/RentalCatalogGrid';
import { appearanceStyle, bodyFont, buttonFont, headingFont, parseFont } from '../panel-fields';
import styles from './rental-catalog.module.css';

function CatalogElement(props: {
  title?: string;
  columns?: number;
  pageSize?: number;
  priceBasis?: 'daily' | 'weekly';
  showCategoryFilter?: boolean;
  backgroundColor?: string;
  cardColor?: string;
  textColor?: string;
  headingColor?: string;
  accentColor?: string;
  buttonTextColor?: string;
  borderColor?: string;
  cornerRadius?: number;
  showDescription?: boolean;
  showSort?: boolean;
  showRibbon?: boolean;
  showButton?: boolean;
  buttonLabel?: string;
  detailsPage?: string;
  imageRatio?: string;
  imageHover?: string;
  textAlign?: string;
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
      <RentalCatalogGrid
        title={props.title}
        columns={props.columns}
        pageSize={props.pageSize}
        priceBasis={props.priceBasis}
        showCategoryFilter={props.showCategoryFilter}
        showDescription={props.showDescription}
        showSort={props.showSort}
        showRibbon={props.showRibbon}
        showButton={props.showButton}
        buttonLabel={props.buttonLabel}
        detailsPage={props.detailsPage}
        imageRatio={props.imageRatio as ImageRatio | undefined}
        imageHover={props.imageHover as ImageHover | undefined}
        textAlign={props.textAlign === 'center' ? 'center' : 'start'}
      />
    </div>
  );
}

export default reactToWebComponent(CatalogElement, React, ReactDOM, {
  props: {
    title: 'string',
    columns: 'number',
    pageSize: 'number',
    priceBasis: 'string',
    showCategoryFilter: 'boolean',
    backgroundColor: 'string',
    cardColor: 'string',
    textColor: 'string',
    headingColor: 'string',
    accentColor: 'string',
    buttonTextColor: 'string',
    borderColor: 'string',
    cornerRadius: 'number',
    showDescription: 'boolean',
    showSort: 'boolean',
    showRibbon: 'boolean',
    showButton: 'boolean',
    buttonLabel: 'string',
    detailsPage: 'string',
    imageRatio: 'string',
    imageHover: 'string',
    textAlign: 'string',
    headingFont: 'string',
    bodyFont: 'string',
    buttonFont: 'string',
  },
});
