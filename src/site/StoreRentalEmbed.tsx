import { useEffect, useState } from 'react';
import { request } from './client';
import { RentalBookingForm } from './RentalBookingForm';
import styles from './rental.module.css';
import type { CatalogItem } from './types';

export function StoreRentalEmbed({ productId }: { productId: string }) {
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setItem(null);
    setMessage('');
    request<{ eligible: boolean; item?: CatalogItem; message?: string }>(`/api/rentals/store-product?productId=${encodeURIComponent(productId)}`)
      .then((body) => {
        if (!active) return;
        if (body.eligible && body.item) setItem(body.item);
        else setMessage(body.message || 'This product is not configured as a rental.');
      })
      .catch(() => {
        if (active) setMessage('Rental booking is not available for this product.');
      });
    return () => { active = false; };
  }, [productId]);

  if (message) return null;
  if (!item) return <div className={styles.notice} aria-live="polite">Loading rental availability…</div>;

  return <RentalBookingForm itemId={item._id} embedded />;
}
