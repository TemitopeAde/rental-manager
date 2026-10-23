import { extensions } from '@wix/astro/builders'

export default extensions.customElement({
  id: 'd1133e58-45ed-4db1-855c-8a4d7c938ed4',
  name: 'My Rentals',
  width: {
    defaultWidth: 720,
    allowStretch: true
  },
  height: {
    defaultHeight: 640
  },
  installation: {
    autoAdd: false
  },
  presets: [
    {
      id: '25216d3c-8e4c-49f7-a974-4305344f85ab',
      name: 'default',
      thumbnailUrl: '{{BASE_URL}}/my-rentals-thumbnail.png',
    },
  ],

  tagName: 'my-rentals',
  element: './extensions/site/widgets/my-rentals/my-rentals.tsx',
  settings: './extensions/site/widgets/my-rentals/my-rentals.panel.tsx',
});
