import { extensions } from '@wix/astro/builders'

export default extensions.customElement({
  id: '583c249b-866e-4973-8878-591a49add8ad',
  name: 'Rental Details',
  width: {
    defaultWidth: 980,
    allowStretch: true
  },
  height: {
    defaultHeight: 900
  },
  installation: {
    autoAdd: false
  },
  presets: [
    {
      id: '94903c19-e2a1-451b-9ae1-f3a22d1ad80c',
      name: 'default',
      thumbnailUrl: '{{BASE_URL}}/rental-details-thumbnail.png',
    },
  ],

  tagName: 'rental-details',
  element: './extensions/site/widgets/rental-details/rental-details.tsx',
  settings: './extensions/site/widgets/rental-details/rental-details.panel.tsx',
});
