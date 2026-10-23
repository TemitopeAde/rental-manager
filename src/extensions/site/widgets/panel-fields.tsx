import { type CSSProperties, type FC, type ReactNode } from 'react';
import { inputs } from '@wix/editor';
import {
  Accordion,
  accordionItemBuilder,
  Box,
  Button,
  Dropdown,
  FillPreview,
  FormField,
  Input,
  NumberInput,
  SidePanel,
  ToggleSwitch,
  WixDesignSystemProvider,
} from '@wix/design-system';

export type FontValue = {
  font: string;
  textDecoration: string;
};

export const headingFont: FontValue = {
  font: '700 20px/1.3 sans-serif',
  textDecoration: '',
};

export const bodyFont: FontValue = {
  font: '400 16px/1.5 sans-serif',
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

export function appearanceStyle(values: {
  background?: string;
  text?: string;
  heading?: string;
  accent?: string;
  onAccent?: string;
  card?: string;
  border?: string;
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
  assign('--rm-heading-font', values.headingFont?.font);
  assign('--rm-heading-decoration', values.headingFont?.textDecoration);
  assign('--rm-body-font', values.bodyFont?.font);
  assign('--rm-body-decoration', values.bodyFont?.textDecoration);
  assign('--rm-button-font', values.buttonFont?.font);
  assign('--rm-button-decoration', values.buttonFont?.textDecoration);
  return style;
}

export const TextSetting: FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <SidePanel.Field>
    <FormField label={label}>
      <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </FormField>
  </SidePanel.Field>
);

export const NumberSetting: FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, onChange }) => (
  <SidePanel.Field>
    <FormField label={label}>
      <NumberInput
        value={value}
        min={min}
        max={max}
        onChange={(next) => onChange(next ?? min)}
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
    <FormField label={label}>
      <ToggleSwitch checked={checked} onChange={() => onChange(!checked)} />
    </FormField>
  </SidePanel.Field>
);

export const ChoiceSetting: FC<{
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <SidePanel.Field>
    <FormField label={label}>
      <Dropdown
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
    <FormField label={label}>
      <Box width="30px" height="30px">
        <FillPreview
          fill={value}
          onClick={() => inputs.selectColor(value, {
            onChange: (next) => {
              if (next) onChange(next);
            },
          })}
        />
      </Box>
    </FormField>
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
        Change font
      </Button>
    </FormField>
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
      children: section.children,
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

export { ColorField, FontField };
