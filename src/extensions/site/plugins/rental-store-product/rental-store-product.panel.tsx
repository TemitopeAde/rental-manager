import React, { type FC } from 'react';
import { SidePanel, WixDesignSystemProvider, Text } from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const Panel: FC = () => (
  <WixDesignSystemProvider>
    <SidePanel width="320" height="100vh">
      <SidePanel.Content noPadding stretchVertically>
        <SidePanel.Field>
          <Text>Rental controls appear automatically for products enabled in Rental Manager or included in the selected rental category.</Text>
        </SidePanel.Field>
      </SidePanel.Content>
    </SidePanel>
  </WixDesignSystemProvider>
);

export default Panel;
