import { useEffect, useMemo, useState, type HTMLAttributes } from 'react';
import { request } from './client';
import styles from './rental.module.css';

function classNameFor(base: string, part?: { className?: string }) {
  return part?.className || base;
}

export type CatalogParts = {
  title?: HTMLAttributes<HTMLHeadingElement>;
  field?: HTMLAttributes<HTMLSelectElement>;
  card?: HTMLAttributes<HTMLElement>;
  price?: HTMLAttributes<HTMLParagraphElement>;
  button?: HTMLAttributes<HTMLButtonElement>;
};

interface CatalogItem {
  _id: string;
  name: string;
  description?: string;
  dailyRate: number;
  weeklyRate: number;
  category: string;
}

const samples: CatalogItem[] = [
  { _id: 'sample-1', name: 'Sample camera', description: 'Preview item', dailyRate: 20, weeklyRate: 100, category: 'Equipment' },
  { _id: 'sample-2', name: 'Sample tent', description: 'Preview item', dailyRate: 15, weeklyRate: 70, category: 'Event' },
];

export function RentalCatalogGrid({
  title = 'Rentals',
  columns = 3,
  pageSize = 12,
  priceBasis = 'daily',
  showCategoryFilter = true,
  parts,
}: {
  title?: string;
  columns?: number;
  pageSize?: number;
  priceBasis?: 'daily' | 'weekly';
  showCategoryFilter?: boolean;
  parts?: CatalogParts;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    request<{ items: CatalogItem[] }>('/api/rentals/catalog')
      .then((body) => setItems(body.items))
      .catch(() => setItems(samples));
  }, []);

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category).filter(Boolean))],
    [items],
  );
  const filtered = category ? items.filter((item) => item.category === category) : items;
  const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const span = Math.min(4, Math.max(1, columns));

  return (
    <section>
      <div className={styles.form}>
        <h2 {...parts?.title} className={classNameFor(styles.heading, parts?.title)}>{title}</h2>
        <div className={styles.field} hidden={!showCategoryFilter || categories.length === 0}>
          <label htmlFor="rental-category">Category</label>
          <select
            id="rental-category"
            className={classNameFor(styles.control, parts?.field)}
            value={category}
            onChange={(event) => { setCategory(event.target.value); setPage(0); }}
          >
              <option value="">All</option>
              {categories.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
        </div>
      </div>
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))` }}>
        {visible.map((item) => {
          const price = priceBasis === 'weekly' && item.weeklyRate > 0 ? item.weeklyRate : item.dailyRate;
          const unit = priceBasis === 'weekly' && item.weeklyRate > 0 ? 'week' : 'day';
          return (
            <article key={item._id} {...parts?.card} className={classNameFor(styles.card, parts?.card)}>
              <h3>{item.name}</h3>
              {item.description ? <p className={styles.message}>{item.description}</p> : null}
              <p {...parts?.price} className={classNameFor(styles.price, parts?.price)}>From {price} / {unit}</p>
            </article>
          );
        })}
      </div>
      <div className={styles.form} hidden={filtered.length <= pageSize}>
        <button {...parts?.button} className={classNameFor(styles.action, parts?.button)} type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button>
        <button {...parts?.button} className={classNameFor(styles.action, parts?.button)} type="button" disabled={(page + 1) * pageSize >= filtered.length} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>
    </section>
  );
}
