import type { FC } from 'react';
import { WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { designDefaults, designSections } from '../../widgets/design-sections';
import { PanelNote, PanelShell, SettingsAccordion, usePanelProps } from '../../widgets/panel-fields';

const Panel: FC = () => {
  const [values, set] = usePanelProps(designDefaults);
  return (
    <WixDesignSystemProvider>
      <PanelShell title="Rental product plugin">
        <SettingsAccordion
          sections={[
            {
              title: 'About',
              initiallyOpen: true,
              children: <PanelNote>Rental controls appear automatically for eligible products. Use the sections below to customize their appearance.</PanelNote>,
            },
            ...designSections(values, set),
          ]}
        />
      </PanelShell>
    </WixDesignSystemProvider>
  );
};

export default Panel;
