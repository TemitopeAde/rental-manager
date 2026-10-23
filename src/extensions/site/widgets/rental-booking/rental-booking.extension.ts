import { extensions } from '@wix/astro/builders'

export default extensions.customElement({
  id: 'b31550aa-e85a-4482-bb3c-520500fe6ee7',
  name: 'Rental Booking',
  width: {
    defaultWidth: 450,
    allowStretch: true
  },
  height: {
    defaultHeight: 250
  },
  installation: {
    autoAdd: true
  },
  presets: [
    {
      id: '0951638e-d5de-471d-b7c3-efe7cab5581b',
      name: 'default',
      thumbnailUrl: '{{BASE_URL}}/rental-booking-thumbnail.png',
    },
  ],
  
  tagName: 'rental-booking',
  element: './extensions/site/widgets/rental-booking/rental-booking.tsx',
  settings: './extensions/site/widgets/rental-booking/rental-booking.panel.tsx',
});
