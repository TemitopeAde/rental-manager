import React from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import { MyRentals } from '../../../../site/MyRentals';
import { appearanceStyle, bodyFont, buttonFont, headingFont, parseFont } from '../panel-fields';
import styles from './my-rentals.module.css';

function MyRentalsElement(props: {
  title?: string;
  description?: string;
  loginLabel?: string;
  emptyText?: string;
  showPast?: boolean;
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
      <MyRentals
        title={props.title}
        description={props.description}
        loginLabel={props.loginLabel}
        emptyText={props.emptyText}
        showPast={props.showPast}
      />
    </div>
  );
}

export default reactToWebComponent(MyRentalsElement, React, ReactDOM, {
  props: {
    title: 'string',
    description: 'string',
    loginLabel: 'string',
    emptyText: 'string',
    showPast: 'boolean',
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
