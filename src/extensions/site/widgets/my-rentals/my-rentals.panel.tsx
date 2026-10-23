import { type FC } from 'react';
import '@wix/design-system/styles.global.css';
import { designDefaults, designSections } from '../design-sections';
import { PanelNote, PanelShell, SettingsAccordion, SwitchSetting, TextSetting, usePanelProps } from '../panel-fields';

const defaults = {
  title: 'My rentals',
  description: '',
  'login-label': 'Log in',
  'empty-text': "You don't have any rentals yet.",
  'show-past': 'true',
  ...designDefaults,
};

const Panel: FC = () => {
  const [values, set] = usePanelProps(defaults);

  return (
    <PanelShell title="My rentals">
      <SettingsAccordion
        sections={[
          {
            title: 'Content',
            initiallyOpen: true,
            children: (
              <>
                <PanelNote>
                  Logged-in members see the rentals booked with their email, and can cancel or ask to move them before pickup. Needs the Wix Members Area on the site.
                </PanelNote>
                <TextSetting label="Heading" value={values.title} onChange={(value) => set('title', value)} />
                <TextSetting label="Description" value={values.description} placeholder="Optional" onChange={(value) => set('description', value)} />
                <TextSetting label="Login button" value={values['login-label']} onChange={(value) => set('login-label', value)} />
                <TextSetting label="Text when there are no rentals" value={values['empty-text']} onChange={(value) => set('empty-text', value)} />
              </>
            ),
          },
          {
            title: 'Display',
            children: (
              <SwitchSetting label="Show past rentals" checked={values['show-past'] !== 'false'} onChange={(checked) => set('show-past', String(checked))} />
            ),
          },
          ...designSections(values, set),
        ]}
      />
    </PanelShell>
  );
};

export default Panel;
