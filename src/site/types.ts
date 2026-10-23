// The visitor-facing shape of a rental item, as returned by /api/rentals/catalog and /api/rentals/item.
export interface CatalogItem {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  images?: Array<{ src: string; alt: string }>;
  dailyRate: number;
  weeklyRate: number;
  depositAmount?: number;
  category: string;
  unitCount?: number;
  minDays?: number;
  maxDays?: number;
  leadDays?: number;
}

export function itemKey(item: CatalogItem): string {
  return item.slug || item._id;
}
