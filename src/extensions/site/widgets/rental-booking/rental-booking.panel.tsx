import { type FC, useEffect, useState } from 'react';
import '@wix/design-system/styles.global.css';
import { request } from '../../../../site/client';
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
  title: 'Book your rental',
  description: '',
  'button-label': 'Rent now',
  'item-id': '',
  'show-deposit': 'true',
  'show-weekly-price': 'true',
  'show-quantity': 'true',
  'months-shown': '1',
  ...designDefaults,
};

const ALL_ITEMS = '__all__';

const Panel: FC = () => {
  const [values, set] = usePanelProps(defaults);
  const [items, setItems] = useState<Array<{ _id: string; name: string }> | null>(null);

  useEffect(() => {
    request<{ items: Array<{ _id: string; name: string }> }>('/api/rentals/catalog')
      .then((body) => setItems(body.items))
      .catch(() => setItems(null));
  }, []);

  const toggle = (name: 'show-deposit' | 'show-weekly-price' | 'show-quantity') => (
    <SwitchSetting
      label={{ 'show-deposit': 'Deposit', 'show-weekly-price': 'Weekly price', 'show-quantity': 'Quantity picker' }[name]}
      checked={values[name] !== 'false'}
      onChange={(checked) => set(name, String(checked))}
    />
  );

  return (
    <PanelShell title="Rental booking">
      <SettingsAccordion
        sections={[
          {
            title: 'Content',
            initiallyOpen: true,
            children: (
              <>
                <TextSetting label="Heading" value={values.title} onChange={(value) => set('title', value)} />
                <TextSetting label="Description" multiline placeholder="Optional intro shown under the heading" value={values.description} onChange={(value) => set('description', value)} />
                <TextSetting label="Button label" value={values['button-label']} onChange={(value) => set('button-label', value)} />
              </>
            ),
          },
          {
            title: 'Rental item',
            initiallyOpen: true,
            children: items ? (
              <>
                <ChoiceSetting
                  label="Item"
                  value={values['item-id'] || ALL_ITEMS}
                  options={[
                    { value: ALL_ITEMS, label: 'Let visitors choose' },
                    ...items.map((item) => ({ value: item._id, label: item.name })),
                  ]}
                  onChange={(value) => set('item-id', value === ALL_ITEMS ? '' : value)}
                />
                {items.length === 0 ? <PanelNote>Add rental items in the app dashboard to pick one here.</PanelNote> : null}
              </>
            ) : (
              <>
                <TextSetting label="Item ID" value={values['item-id']} placeholder="Leave empty to let visitors choose" onChange={(value) => set('item-id', value)} />
                <PanelNote>Couldn't load your items. Paste an item ID from the dashboard, or leave it empty.</PanelNote>
              </>
            ),
          },
          {
            title: 'Display',
            children: (
              <>
                <SegmentedSetting
                  label="Calendar months"
                  value={values['months-shown']}
                  options={[{ value: '1', label: 'One' }, { value: '2', label: 'Two' }]}
                  onChange={(value) => set('months-shown', value)}
                />
                {toggle('show-weekly-price')}
                {toggle('show-deposit')}
                {toggle('show-quantity')}
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
