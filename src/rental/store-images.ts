import { mediaUrl, type StoreCatalogVersion } from './models.ts';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? value as UnknownRecord : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function imageSource(item: UnknownRecord): string {
  const image = record(item.image);
  const media = record(item.media);
  const mediaImage = record(media.image);
  const setBy = record(item.setBy);
  const thumbnail = record(item.thumbnail);
  const imageThumbnail = record(image.thumbnail);
  const candidates = [
    stringValue(item.url),
    stringValue(image.url),
    stringValue(mediaImage.url),
    stringValue(typeof media.image === 'string' ? media.image : ''),
    stringValue(setBy.url),
    stringValue(thumbnail.url),
    stringValue(imageThumbnail.url),
  ];
  const direct = candidates.map(mediaUrl).find(Boolean);
  if (direct) return direct;

  // V3 can identify an existing Wix Media Manager image by its file ID.
  const mediaId = stringValue(item.id) || stringValue(item._id) || stringValue(setBy.id);
  return mediaId ? mediaUrl(`wix:image://v1/${mediaId}/${mediaId}`) : '';
}

/** Extracts only image media, preserving the order Wix returns for the product gallery. */
export function extractStoreProductImages(product: UnknownRecord, version: StoreCatalogVersion) {
  const media = record(product.media);
  const itemsInfo = record(media.itemsInfo);
  const entries = version === 'V1_CATALOG'
    ? (Array.isArray(media.items) ? media.items : [])
    : (Array.isArray(itemsInfo.items) ? itemsInfo.items : []);

  return entries.flatMap((entry) => {
    const item = record(entry);
    const type = stringValue(item.mediaType).toLowerCase();
    const image = record(item.image);
    const itemMedia = record(item.media);
    const isImage = type === 'image' || (type === '' && (Object.keys(image).length > 0 || Boolean(itemMedia.image)));
    if (!isImage) return [];
    const src = imageSource(item);
    if (!src) return [];
    const alt = stringValue(item.altText) || stringValue(image.altText) || stringValue(item.title) || stringValue(item.displayName);
    return [{ src, alt }];
  });
}
