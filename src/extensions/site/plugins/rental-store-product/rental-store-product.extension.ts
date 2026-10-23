import { extensions } from '@wix/astro/builders';

export default extensions.sitePlugin({
  id: '0c7536ae-8f4d-47c7-ae04-2b2b5cd9a8e3',
  name: 'Rental Store Product',
  marketData: {
    name: 'Rental booking controls',
    description: 'Adds date-based rental booking to eligible Wix Stores products.',
    logoUrl: '{{BASE_URL}}/rental-store-product-logo.svg',
  },
  placements: [
    {
      appDefinitionId: 'a0c68605-c2e7-4c8d-9ea1-767f9770e087',
      widgetId: '6a25b678-53ec-4b37-a190-65fcd1ca1a63',
      slotId: 'product-page-details-2',
    },
    {
      appDefinitionId: '1380b703-ce81-ff05-f115-39571d94dfcd',
      widgetId: '13a94f09-2766-3c40-4a32-8edb5acdd8bc',
      slotId: 'product-page-details-2',
    },
  ],
  installation: { autoAdd: true },
  tagName: 'rental-store-product',
  element: './extensions/site/plugins/rental-store-product/rental-store-product.tsx',
  settings: './extensions/site/plugins/rental-store-product/rental-store-product.panel.tsx',
});
