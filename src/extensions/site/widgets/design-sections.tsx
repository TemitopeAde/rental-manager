import type { ReactNode } from 'react';
import { Box, Button, SidePanel } from '@wix/design-system';
import {
  bodyFont,
  buttonFont,
  ColorField,
  FontField,
  headingFont,
  parseFont,
  SliderSetting,
  themes,
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
};

type DesignKey = keyof typeof designDefaults;

const colorProps: Array<{ key: DesignKey; theme: string; label: string }> = [
  { key: 'background-color', theme: 'background', label: 'Background' },
  { key: 'card-color', theme: 'card', label: 'Card' },
  { key: 'text-color', theme: 'text', label: 'Text' },
  { key: 'heading-color', theme: 'heading', label: 'Headings' },
  { key: 'accent-color', theme: 'accent', label: 'Accent & buttons' },
  { key: 'button-text-color', theme: 'onAccent', label: 'Button text' },
  { key: 'border-color', theme: 'border', label: 'Borders' },
];

export function designSections(
  values: Record<DesignKey, string>,
  set: (name: DesignKey, value: string) => void,
): Array<{ title: string; children: ReactNode }> {
  return [
    {
      title: 'Theme',
      children: (
        <>
          <SidePanel.Field>
            <Box gap="SP1" style={{ flexWrap: 'wrap' }}>
              {themes.map((theme) => (
                <Button
                  key={theme.id}
                  size="tiny"
                  priority="secondary"
                  prefixIcon={<Swatch color={theme.colors.accent} />}
                  onClick={() => colorProps.forEach((prop) => set(prop.key, theme.colors[prop.theme]))}
                >
                  {theme.label}
                </Button>
              ))}
            </Box>
          </SidePanel.Field>
          <SliderSetting
            label={`Corner radius · ${values['corner-radius']}px`}
            value={Number(values['corner-radius']) || 0}
            min={0}
            max={28}
            onChange={(value) => set('corner-radius', String(value))}
          />
        </>
      ),
    },
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
        </>
      ),
    },
  ];
}

function Swatch({ color }: { color: string }) {
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: color }} />;
}
