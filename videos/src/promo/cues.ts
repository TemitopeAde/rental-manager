// Scene starts in seconds. Each scene runs until the next one starts.
export const FPS = 30;
export const SCENES = {
  hook: 0,
  reveal: 5,
  catalog: 9,
  item: 14,
  rentals: 20,
  dashboard: 26,
  themes: 32,
  mobile: 35,
  cta: 38,
  end: 43,
} as const;

export const DURATION = SCENES.end;

// Brand tokens, decoded from app-market/images (background pixel) and the icon.
export const TEAL = "#0F766E";
export const TEAL_LIGHT = "#1D7E76";
export const WHITE = "#FFFFFF";

/**
 * Crop boxes in original screenshot pixels (2400 x 1800), measured from the
 * PNGs: L/T is the window's top-left, w/h its size, r its corner radius.
 */
export type Crop = { src: string; L: number; T: number; w: number; h: number; r: number };

export const CROPS = {
  catalog: { src: "ui/01-main.png", L: 1120, T: 220, w: 1160, h: 1380, r: 29 },
  itemBrowser: { src: "ui/02-item-page.png", L: 160, T: 420, w: 1360, h: 1380, r: 29 },
  itemPanel: { src: "ui/02-item-page.png", L: 1441, T: 419, w: 703, h: 1198, r: 24 },
  rentals: { src: "ui/03-my-rentals.png", L: 270, T: 476, w: 1858, h: 1324, r: 28 },
  dashboard: { src: "ui/04-dashboard.png", L: 136, T: 456, w: 2132, h: 1344, r: 28 },
  themeClassic: { src: "ui/05-themes.png", L: 150, T: 440, w: 680, h: 1120, r: 29 },
  themeWarm: { src: "ui/05-themes.png", L: 880, T: 440, w: 680, h: 1120, r: 29 },
  themeNight: { src: "ui/05-themes.png", L: 1610, T: 440, w: 680, h: 1120, r: 29 },
  phoneCatalog: { src: "ui/06-mobile.png", L: 940, T: 300, w: 648, h: 1352, r: 99 },
  phoneItem: { src: "ui/06-mobile.png", L: 1660, T: 300, w: 648, h: 1352, r: 99 },
} satisfies Record<string, Crop>;
