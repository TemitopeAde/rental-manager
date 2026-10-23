import { bundlers, extensions } from '@wix/astro/builders';

const source = './extensions/backend/service-plugins/rental-catalog/rental-catalog.ts';

export default extensions.genericExtension({
  compId: '8f4c2a61-6d0e-4b7a-9c15-2e7b0a4d6f83',
  compName: 'rental-catalog',
  compType: 'ECOM_CATALOG',
  compData: {
    ecomCatalog: {
      deploymentUri: bundlers.servicePlugin({ source }),
    },
  },
});
