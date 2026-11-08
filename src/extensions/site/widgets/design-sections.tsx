import type { ReactNode } from 'react';
import { SidePanel } from '@wix/design-system';
import {
  bodyFont,
  buttonFont,
  ColorField,
  FontField,
  headingFont,
  parseFont,
} from './panel-fields';

// Prop names and defaults shared by every rental widget's Design settings.
export const designDefaults = {
  'background-color': '',
  'card-color': '#ffffff',
  'text-color': '#1a1a1a',
  'heading-color': '#111111',
  'accent-color': '#116dff',
  'button-text-color': '#ffffff',
  'border-color': '#e3e3e3',
  'corner-radius': '12',
  'heading-font': '',
  'body-font': '',
  'button-font': '',
  'title-font': '',
  'description-font': '',
  'price-font': '',
};

type DesignKey = keyof typeof designDefaults;

const colorProps: Array<{ key: DesignKey; label: string }> = [
  { key: 'background-color', label: 'Background' },
  { key: 'card-color', label: 'Card' },
  { key: 'text-color', label: 'Text' },
  { key: 'heading-color', label: 'Headings' },
  { key: 'accent-color', label: 'Accent & buttons' },
  { key: 'button-text-color', label: 'Button text' },
  { key: 'border-color', label: 'Borders' },
];

export function designSections(
  values: Record<DesignKey, string>,
  set: (name: DesignKey, value: string) => void,
): Array<{ title: string; children: ReactNode }> {
  return [
    {
      title: 'Colors',
      children: (
        <>
          {colorProps.map((prop) => (
            <ColorField
              key={prop.key}
              label={prop.label}
              value={values[prop.key] || '#ffffff'}
              onChange={(value) => set(prop.key, value)}
            />
          ))}
        </>
      ),
    },
    {
      title: 'Typography',
      children: (
        <>
          <FontField label="Headings" value={parseFont(values['heading-font'], headingFont)} onChange={(value) => set('heading-font', JSON.stringify(value))} />
          <FontField label="Body text" value={parseFont(values['body-font'], bodyFont)} onChange={(value) => set('body-font', JSON.stringify(value))} />
          <FontField label="Buttons" value={parseFont(values['button-font'], buttonFont)} onChange={(value) => set('button-font', JSON.stringify(value))} />
          <FontField label="Element titles" value={parseFont(values['title-font'], headingFont)} onChange={(value) => set('title-font', JSON.stringify(value))} />
          <FontField label="Descriptions" value={parseFont(values['description-font'], bodyFont)} onChange={(value) => set('description-font', JSON.stringify(value))} />
          <FontField label="Prices" value={parseFont(values['price-font'], bodyFont)} onChange={(value) => set('price-font', JSON.stringify(value))} />
        </>
      ),
    },
  ];
}
