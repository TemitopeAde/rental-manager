import { app } from '@wix/astro/builders';
import myPage from './extensions/dashboard/pages/my-page/my-page.extension.ts';

import dataCollections from './extensions/backend/data-collections/data-collections.extension.ts';

import orderApproved from './extensions/backend/events/order-approved/order-approved.extension.ts';

import orderCanceled from './extensions/backend/events/order-canceled/order-canceled.extension.ts';

import rentalTools from './extensions/backend/app-tools/rental-tools/rental-tools.extension.ts';

import rentalTools1 from './extensions/backend/service-plugins/rental-tools/rental-tools.extension.ts';

import rentalCatalogPlugin from './extensions/backend/service-plugins/rental-catalog/rental-catalog.extension.ts';

import rentalBooking from './extensions/site/components/rental-booking/rental-booking.extension.ts';

import rentalCatalog from './extensions/site/components/rental-catalog/rental-catalog.extension.ts';

import rentalBooking1 from './extensions/site/widgets/rental-booking/rental-booking.extension.ts';

import rentalCatalog1 from './extensions/site/widgets/rental-catalog/rental-catalog.extension.ts';

export default app()
  .use(myPage).use(dataCollections).use(orderApproved).use(orderCanceled).use(rentalTools).use(rentalTools1).use(rentalCatalogPlugin).use(rentalBooking).use(rentalCatalog).use(rentalBooking1).use(rentalCatalog1);
