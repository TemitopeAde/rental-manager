import type { FC } from 'react';
import '@wix/design-system/styles.global.css';
import { designDefaults, designSections } from '../design-sections';
import {
  PanelNote,
  PanelShell,
  SegmentedSetting,
  SettingsAccordion,
  SliderSetting,
  SwitchSetting,
  TextSetting,
  usePanelProps,
} from '../panel-fields';

const defaults = {
  title: 'Rentals',
  'details-page': '/rental-details',
  'button-label': 'View details',
  columns: '3',
  'page-size': '12',
  'price-basis': 'daily',
  'image-ratio': 'square',
  'image-hover': 'swap',
  'text-align': 'start',
  'show-button': 'true',
  'show-sort': 'true',
  'show-ribbon': 'true',
  'show-category-filter': 'true',
  'show-description': 'false',
  ...designDefaults,
};

type Toggle = 'show-button' | 'show-sort' | 'show-category-filter' | 'show-ribbon' | 'show-description';

const toggleLabels: Record<Toggle, string> = {
  'show-button': 'Button on each item',
  'show-sort': 'Sort menu',
  'show-category-filter': 'Category filter',
  'show-ribbon': 'Category ribbon on image',
  'show-description': 'Item descriptions',
};

const Panel: FC = () => {
  const [values, set] = usePanelProps(defaults);

  const toggle = (name: Toggle) => (
    <SwitchSetting key={name} label={toggleLabels[name]} checked={values[name] === 'true'} onChange={(checked) => set(name, String(checked))} />
  );

  return (
    <PanelShell title="Rental catalog">
      <SettingsAccordion
        sections={[
          {
            title: 'Content',
            initiallyOpen: true,
            children: (
              <>
                <TextSetting label="Heading" value={values.title} placeholder="Leave empty to hide" onChange={(value) => set('title', value)} />
                <TextSetting label="Details page URL" value={values['details-page']} placeholder="/rental-details" onChange={(value) => set('details-page', value)} />
                <PanelNote>Add a page with the Rental Details widget and enter its URL here. Each item opens it as ?slug=item-slug.</PanelNote>
                <TextSetting label="Button label" value={values['button-label']} onChange={(value) => set('button-label', value)} />
                <SegmentedSetting
                  label="Show price per"
                  value={values['price-basis']}
                  options={[{ value: 'daily', label: 'Day' }, { value: 'weekly', label: 'Week' }]}
                  onChange={(value) => set('price-basis', value)}
                />
                {(Object.keys(toggleLabels) as Toggle[]).map(toggle)}
              </>
            ),
          },
          {
            title: 'Layout',
            initiallyOpen: true,
            children: (
              <>
                <SegmentedSetting
                  label="Columns"
                  value={values.columns}
                  options={['1', '2', '3', '4'].map((value) => ({ value, label: value }))}
                  onChange={(value) => set('columns', value)}
                />
                <SliderSetting
                  label={`Items before "Load more" · ${values['page-size']}`}
                  value={Number(values['page-size']) || 12}
                  min={1}
                  max={48}
                  onChange={(value) => set('page-size', String(value))}
                />
                <SegmentedSetting
                  label="Text alignment"
                  value={values['text-align']}
                  options={[{ value: 'start', label: 'Left' }, { value: 'center', label: 'Center' }]}
                  onChange={(value) => set('text-align', value)}
                />
              </>
            ),
          },
          {
            title: 'Images',
            children: (
              <>
                <SegmentedSetting
                  label="Image shape"
                  value={values['image-ratio']}
                  options={[{ value: 'square', label: 'Square' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]}
                  onChange={(value) => set('image-ratio', value)}
                />
                <SegmentedSetting
                  label="On hover"
                  value={values['image-hover']}
                  options={[{ value: 'swap', label: 'Second image' }, { value: 'zoom', label: 'Zoom' }, { value: 'none', label: 'None' }]}
                  onChange={(value) => set('image-hover', value)}
                />
              </>
            ),
          },
          ...designSections(values, set),
        ]}
      />
    </PanelShell>
  );
};

export default Panel;
