import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreRentalEmbed } from '../../../../site/StoreRentalEmbed';

class RentalStoreProductElement extends HTMLElement {
  private root: Root | undefined;

  static get observedAttributes() {
    return ['product-id', 'selected-variant-id'];
  }

  connectedCallback() {
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
    this.root.render(React.createElement(StoreRentalEmbed, { productId }));
  }

  private readProperty(name: string): string {
    const value = (this as unknown as Record<string, unknown>)[name];
    return typeof value === 'string' ? value : '';
  }
}

export default RentalStoreProductElement;
