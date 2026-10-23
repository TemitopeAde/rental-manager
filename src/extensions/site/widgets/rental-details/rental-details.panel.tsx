import { type FC, useEffect, useState } from 'react';
import '@wix/design-system/styles.global.css';
import { request } from '../../../../site/client';
import { itemKey, type CatalogItem } from '../../../../site/types';
import { designDefaults, designSections } from '../design-sections';
import {
  ChoiceSetting,
  PanelNote,
  PanelShell,
  SegmentedSetting,
  SettingsAccordion,
  SwitchSetting,
  TextSetting,
  usePanelProps,
} from '../panel-fields';

const defaults = {
  'item-slug': '',
  'catalog-page': '',
  'back-label': 'All rentals',
  'booking-title': 'Choose your dates',
  'button-label': 'Rent now',
  'image-ratio': 'square',
  'image-size': 'medium',
  'months-shown': '1',
  'show-category': 'true',
  'show-description': 'true',
  'show-thumbnails': 'true',
  'show-weekly-price': 'true',
  'show-deposit': 'true',
  'show-quantity': 'true',
  ...designDefaults,
};

type Toggle = 'show-category' | 'show-description' | 'show-thumbnails' | 'show-weekly-price' | 'show-deposit' | 'show-quantity';

const toggleLabels: Record<Toggle, string> = {
  'show-category': 'Category',
  'show-description': 'Description',
  'show-thumbnails': 'Image thumbnails',
  'show-weekly-price': 'Weekly price',
  'show-deposit': 'Deposit',
  'show-quantity': 'Quantity picker',
};

const FIRST_ITEM = '__first__';

const Panel: FC = () => {
  const [values, set] = usePanelProps(defaults);
  const [items, setItems] = useState<CatalogItem[] | null>(null);

  useEffect(() => {
    request<{ items: CatalogItem[] }>('/api/rentals/catalog')
      .then((body) => setItems(body.items))
      .catch(() => setItems(null));
  }, []);

  const toggle = (name: Toggle) => (
    <SwitchSetting key={name} label={toggleLabels[name]} checked={values[name] !== 'false'} onChange={(checked) => set(name, String(checked))} />
  );

  return (
    <PanelShell title="Rental details">
      <SettingsAccordion
        sections={[
          {
            title: 'Item',
            initiallyOpen: true,
            children: (
              <>
                <PanelNote>
                  Visitors land here from the rental catalog, and the item comes from the page link (?slug=…). Point the catalog's "Details page" at this page.
                </PanelNote>
                {items ? (
                  <ChoiceSetting
                    label="Item when the link has no slug"
                    value={values['item-slug'] || FIRST_ITEM}
                    options={[
                      { value: FIRST_ITEM, label: 'First item in the catalog' },
                      ...items.map((item) => ({ value: itemKey(item), label: item.name })),
                    ]}
                    onChange={(value) => set('item-slug', value === FIRST_ITEM ? '' : value)}
                  />
                ) : (
                  <TextSetting
                    label="Item slug when the link has none"
                    value={values['item-slug']}
                    placeholder="e.g. camera-kit"
                    onChange={(value) => set('item-slug', value)}
                  />
                )}
              </>
            ),
          },
          {
            title: 'Content',
            initiallyOpen: true,
            children: (
              <>
                <TextSetting label="Catalog page URL" value={values['catalog-page']} placeholder="/rentals — leave empty to hide the back link" onChange={(value) => set('catalog-page', value)} />
                <TextSetting label="Back link text" value={values['back-label']} onChange={(value) => set('back-label', value)} />
                <TextSetting label="Booking heading" value={values['booking-title']} onChange={(value) => set('booking-title', value)} />
                <TextSetting label="Button label" value={values['button-label']} onChange={(value) => set('button-label', value)} />
              </>
            ),
          },
          {
            title: 'Display',
            children: (
              <>
                <SegmentedSetting
                  label="Image shape"
                  value={values['image-ratio']}
                  options={[{ value: 'square', label: 'Square' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]}
                  onChange={(value) => set('image-ratio', value)}
                />
                <SegmentedSetting
                  label="Image size"
                  value={values['image-size']}
                  options={[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]}
                  onChange={(value) => set('image-size', value)}
                />
                <SegmentedSetting
                  label="Calendar months"
                  value={values['months-shown']}
                  options={[{ value: '1', label: 'One' }, { value: '2', label: 'Two' }]}
                  onChange={(value) => set('months-shown', value)}
                />
                {(Object.keys(toggleLabels) as Toggle[]).map(toggle)}
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
