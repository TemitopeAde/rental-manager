import { type CSSProperties, type FC, type ReactNode, useCallback, useEffect, useState } from 'react';
import { inputs, widget } from '@wix/editor';
import {
  Accordion,
  accordionItemBuilder,
  Box,
  Button,
  Dropdown,
  FillPreview,
  FormField,
  Input,
  InputArea,
  SectionHelper,
  SegmentedToggle,
  SidePanel,
  Slider,
  Text,
  ToggleSwitch,
  WixDesignSystemProvider,
} from '@wix/design-system';

export type FontValue = {
  font: string;
  textDecoration: string;
};

export const headingFont: FontValue = {
  font: '700 22px/1.25 sans-serif',
  textDecoration: '',
};

export const bodyFont: FontValue = {
  font: '400 16px/1.5 "helvetica-w01-roman", sans-serif',
  textDecoration: '',
};

export const buttonFont: FontValue = {
  font: '600 16px/1.2 sans-serif',
  textDecoration: '',
};

export function parseFont(raw: string | undefined, fallback: FontValue): FontValue {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'font' in parsed && typeof parsed.font === 'string') {
      const decoration = 'textDecoration' in parsed && typeof parsed.textDecoration === 'string'
        ? parsed.textDecoration
        : '';
      return { font: parsed.font, textDecoration: decoration };
    }
  } catch {
    return { font: raw, textDecoration: '' };
  }
  return fallback;
}

// Wix returns the selected typeface as part of a CSS font shorthand value,
// for example: `400 16px/1.5 "Wix Madefor Text"`. Keep the preview styled
// with the complete value, but expose the family name in the panel as well.
export function fontFamilyName(font: string): string {
  const sizeIndex = font.search(/(?:^|\s)(?:\d*\.\d+|\d+)(?:px|pt|pc|in|cm|mm|em|rem|ex|ch|vw|vh|vmin|vmax)(?:\/[^\s]+)?\s*/i);
  if (sizeIndex === -1) return font.trim() || 'Default font';

  const match = font.slice(sizeIndex).match(/(?:px|pt|pc|in|cm|mm|em|rem|ex|ch|vw|vh|vmin|vmax)(?:\/[^\s]+)?\s*(.*)$/i);
  const family = match?.[1]?.trim();
  return family ? family.replace(/^['"]|['"]$/g, '') : 'Default font';
}

export function appearanceStyle(values: {
  background?: string;
  text?: string;
  heading?: string;
  accent?: string;
  onAccent?: string;
  card?: string;
  border?: string;
  radius?: number;
  headingFont?: FontValue;
  bodyFont?: FontValue;
  buttonFont?: FontValue;
}): CSSProperties {
  const style: CSSProperties & Partial<Record<`--${string}`, string>> = {};
  const assign = (name: `--${string}`, value: string | undefined) => {
    if (value) style[name] = value;
  };
  assign('--rm-background', values.background);
  assign('--rm-text', values.text);
  assign('--rm-heading-color', values.heading);
  assign('--rm-accent', values.accent);
  assign('--rm-on-accent', values.onAccent);
  assign('--rm-card', values.card);
  assign('--rm-border', values.border);
  assign('--rm-radius', values.radius !== undefined && Number.isFinite(values.radius) ? `${values.radius}px` : undefined);
  assign('--rm-heading-font', values.headingFont?.font);
  assign('--rm-heading-decoration', values.headingFont?.textDecoration);
  assign('--rm-body-font', values.bodyFont?.font);
  assign('--rm-body-decoration', values.bodyFont?.textDecoration);
  assign('--rm-button-font', values.buttonFont?.font);
  assign('--rm-button-decoration', values.buttonFont?.textDecoration);
  return style;
}

// Loads every widget prop named in `defaults` once, then keeps local state and the
// widget in sync. Values are stored as strings, the way widget props travel.
export function usePanelProps<K extends string>(defaults: Record<K, string>) {
  const [values, setValues] = useState(defaults);

  useEffect(() => {
    const names = Object.keys(defaults) as K[];
    Promise.all(names.map((name) => widget.getProp(name)))
      .then((stored) => {
        setValues((current) => {
          const next = { ...current };
          names.forEach((name, index) => {
            if (stored[index]) next[name] = stored[index];
          });
          return next;
        });
      })
      .catch(() => undefined);
    // The defaults object is a constant per panel; load once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback((name: K, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    widget.setProp(name, value);
  }, []);

  return [values, set] as const;
}

export const TextSetting: FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}> = ({ label, value, onChange, placeholder, multiline }) => (
  <SidePanel.Field>
    <FormField label={label}>
      {multiline ? (
        <InputArea
          size="small"
          rows={3}
          resizable
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input size="small" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </FormField>
  </SidePanel.Field>
);

export const SliderSetting: FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step = 1, onChange }) => (
  <SidePanel.Field>
    <FormField label={label}>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        displayMarks={false}
        onChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      />
    </FormField>
  </SidePanel.Field>
);

export const SwitchSetting: FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <SidePanel.Field>
    <Box align="space-between" verticalAlign="middle">
      <Text size="small">{label}</Text>
      <ToggleSwitch size="small" checked={checked} onChange={() => onChange(!checked)} />
    </Box>
  </SidePanel.Field>
);

export const SegmentedSetting: FC<{
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <SidePanel.Field>
    <FormField label={label}>
      <SegmentedToggle size="small" selected={value} onClick={(_, next) => onChange(next)}>
        {options.map((option) => (
          <SegmentedToggle.Button key={option.value} value={option.value}>
            {option.label}
          </SegmentedToggle.Button>
        ))}
      </SegmentedToggle>
    </FormField>
  </SidePanel.Field>
);

export const ChoiceSetting: FC<{
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
  status?: ReactNode;
}> = ({ label, value, options, onChange, placeholder, status }) => (
  <SidePanel.Field>
    <FormField label={label} infoContent={status}>
      <Dropdown
        size="small"
        placeholder={placeholder}
        selectedId={value}
        options={options.map((option) => ({ id: option.value, value: option.label }))}
        onSelect={(option) => onChange(String(option.id))}
      />
    </FormField>
  </SidePanel.Field>
);

const ColorField: FC<{ label: string; value: string; onChange: (value: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <SidePanel.Field>
    <Box align="space-between" verticalAlign="middle">
      <Text size="small">{label}</Text>
      <Box width="28px" height="28px">
        <FillPreview
          fill={value}
          onClick={() => inputs.selectColor(value, {
            onChange: (next) => {
              if (next) onChange(next);
            },
          })}
        />
      </Box>
    </Box>
  </SidePanel.Field>
);

const FontField: FC<{ label: string; value: FontValue; onChange: (value: FontValue) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <SidePanel.Field>
    <FormField label={label}>
      <Button
        size="small"
        priority="secondary"
        fullWidth
        style={{ font: value.font, textDecoration: value.textDecoration || undefined }}
        onClick={() => inputs.selectFont(value, {
          onChange: (next) => onChange({
            font: next.font,
            textDecoration: next.textDecoration || '',
          }),
        })}
      >
        <span aria-hidden="true">Aa</span>
        <span> · {fontFamilyName(value.font)}</span>
      </Button>
    </FormField>
  </SidePanel.Field>
);

export const PanelNote: FC<{ children: ReactNode }> = ({ children }) => (
  <SidePanel.Field>
    <SectionHelper appearance="standard" size="small">{children}</SectionHelper>
  </SidePanel.Field>
);

export const SettingsAccordion: FC<{
  sections: Array<{ title: string; children: ReactNode; initiallyOpen?: boolean }>;
}> = ({ sections }) => (
  <Accordion
    skin="light"
    hideShadow
    size="small"
    items={sections.map((section) => accordionItemBuilder({
      title: section.title,
      initiallyOpen: section.initiallyOpen === true,
      children: <Box direction="vertical" paddingBottom="SP2">{section.children}</Box>,
    }))}
  />
);

export function PanelShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <WixDesignSystemProvider>
      <SidePanel width="300" height="100vh">
        <SidePanel.Header title={title} />
        <SidePanel.Content noPadding>
          {children}
        </SidePanel.Content>
      </SidePanel>
    </WixDesignSystemProvider>
  );
}

// Theme presets applied in one click; each sets every colour prop at once.
export const themes: Array<{ id: string; label: string; colors: Record<string, string> }> = [
  {
    id: 'classic',
    label: 'Classic',
    colors: { background: '#ffffff', card: '#ffffff', text: '#1a1a1a', heading: '#111111', accent: '#116dff', onAccent: '#ffffff', border: '#e3e3e3' },
  },
  {
    id: 'warm',
    label: 'Warm',
    colors: { background: '#fbf7f2', card: '#ffffff', text: '#3b2f2a', heading: '#2a1f1a', accent: '#c4622d', onAccent: '#ffffff', border: '#eadfd3' },
  },
  {
    id: 'forest',
    label: 'Forest',
    colors: { background: '#f3f6f2', card: '#ffffff', text: '#24302a', heading: '#17231c', accent: '#2f6b4f', onAccent: '#ffffff', border: '#d9e2db' },
  },
  {
    id: 'night',
    label: 'Night',
    colors: { background: '#121417', card: '#1c1f24', text: '#e6e8eb', heading: '#ffffff', accent: '#7aa7ff', onAccent: '#0d1117', border: '#30353d' },
  },
];

export { ColorField, FontField };
