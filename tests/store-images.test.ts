import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractStoreProductImages } from '../src/rental/store-images.ts';

describe('extractStoreProductImages', () => {
  it('reads every V1 gallery image in order and skips video media', () => {
    const images = extractStoreProductImages({
      media: {
        items: [
          { mediaType: 'image', image: { url: 'https://static.wixstatic.com/media/first.jpg', altText: 'First' } },
          { mediaType: 'video', video: { files: [] } },
          { mediaType: 'image', image: { url: 'https://static.wixstatic.com/media/second.jpg' }, title: 'Second' },
        ],
      },
    }, 'V1_CATALOG');

    assert.deepEqual(images, [
      { src: 'https://static.wixstatic.com/media/first.jpg', alt: 'First' },
      { src: 'https://static.wixstatic.com/media/second.jpg', alt: 'Second' },
    ]);
  });

  it('reads every V3 gallery image in order and skips video media', () => {
    const images = extractStoreProductImages({
      media: {
        main: { mediaType: 'IMAGE', image: { url: 'https://static.wixstatic.com/media/first.jpg' } },
        itemsInfo: {
          items: [
            { mediaType: 'IMAGE', media: { image: { url: 'https://static.wixstatic.com/media/first.jpg' } }, altText: 'First' },
            { mediaType: 'VIDEO', media: { video: { url: 'https://example.com/video.mp4' } } },
            { mediaType: 'IMAGE', setBy: { url: 'https://images.example.com/second.jpg' }, displayName: 'Second' },
          ],
        },
      },
    }, 'V3_CATALOG');

    assert.deepEqual(images, [
      { src: 'https://static.wixstatic.com/media/first.jpg', alt: 'First' },
      { src: 'https://images.example.com/second.jpg', alt: 'Second' },
    ]);
  });

  it('normalizes Wix Media Manager image references and returns an empty gallery when there are no images', () => {
    assert.deepEqual(extractStoreProductImages({
      media: {
        items: [{ mediaType: 'image', image: { url: 'wix:image://v1/file-id/photo.jpg#originWidth=600' } }],
      },
    }, 'V1_CATALOG'), [
      { src: 'https://static.wixstatic.com/media/file-id', alt: '' },
    ]);

    assert.deepEqual(extractStoreProductImages({ media: { itemsInfo: { items: [] } } }, 'V3_CATALOG'), []);
  });
});
