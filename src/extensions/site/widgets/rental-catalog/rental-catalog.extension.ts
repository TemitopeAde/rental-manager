import { extensions } from '@wix/astro/builders'

export default extensions.customElement({
  id: '99d509c0-caa2-4701-8489-771780d8505a',
  name: 'Rental Catalog',
  width: {
    defaultWidth: 980,
    allowStretch: true
  },
  height: {
    defaultHeight: 560
  },
  installation: {
    autoAdd: false
  },
  presets: [
    {
      id: '36eeaf68-1b97-4ccf-8f25-dc0b2cf6a71f',
      name: 'default',
      thumbnailUrl: '{{BASE_URL}}/rental-catalog-thumbnail.png',
    },
  ],
  
  tagName: 'rental-catalog',
  element: './extensions/site/widgets/rental-catalog/rental-catalog.tsx',
  settings: './extensions/site/widgets/rental-catalog/rental-catalog.panel.tsx',
});
