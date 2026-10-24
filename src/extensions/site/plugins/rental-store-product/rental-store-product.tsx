import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreRentalEmbed } from '../../../../site/StoreRentalEmbed';

const appearanceAttributes = [
  'background-color',
  'card-color',
  'text-color',
  'heading-color',
  'accent-color',
  'button-text-color',
  'border-color',
  'corner-radius',
  'heading-font',
  'body-font',
  'button-font',
] as const;

class RentalStoreProductElement extends HTMLElement {
  private root: Root | undefined;

  static get observedAttributes() {
    return ['product-id', 'selected-variant-id', ...appearanceAttributes];
  }

  connectedCallback() {
    this.style.display = 'block';
    this.style.margin = '0';
    this.style.marginInlineStart = '0';
    this.root = createRoot(this);
    this.render();
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = undefined;
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    if (!this.root) return;
    const productId = this.getAttribute('product-id') || this.readProperty('productId');
    if (!productId) {
      this.root.render(React.createElement('div', { 'aria-hidden': true }));
      return;
    }
    const appearance = {
      backgroundColor: this.readSetting('background-color', 'backgroundColor'),
      cardColor: this.readSetting('card-color', 'cardColor'),
      textColor: this.readSetting('text-color', 'textColor'),
      headingColor: this.readSetting('heading-color', 'headingColor'),
      accentColor: this.readSetting('accent-color', 'accentColor'),
      buttonTextColor: this.readSetting('button-text-color', 'buttonTextColor'),
      borderColor: this.readSetting('border-color', 'borderColor'),
      cornerRadius: Number(this.readSetting('corner-radius', 'cornerRadius')),
      headingFont: this.readSetting('heading-font', 'headingFont'),
      bodyFont: this.readSetting('body-font', 'bodyFont'),
      buttonFont: this.readSetting('button-font', 'buttonFont'),
    };
    console.info('[rental-store-product] appearance settings received', {
      productId,
      headingFont: { value: appearance.headingFont, type: typeof appearance.headingFont },
      bodyFont: { value: appearance.bodyFont, type: typeof appearance.bodyFont },
      buttonFont: { value: appearance.buttonFont, type: typeof appearance.buttonFont },
      attributes: appearanceAttributes.reduce<Record<string, string | null>>((result, attribute) => {
        result[attribute] = this.getAttribute(attribute);
        return result;
      }, {}),
    });
    this.root.render(React.createElement(StoreRentalEmbed, {
      productId,
      appearance,
    }));
  }

  private readProperty(name: string): string {
    const value = (this as unknown as Record<string, unknown>)[name];
    return typeof value === 'string' ? value : '';
  }

  private readSetting(attribute: string, property: string): string {
    return this.getAttribute(attribute) || this.readProperty(property);
  }
}

export default RentalStoreProductElement;
