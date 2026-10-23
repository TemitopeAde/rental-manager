/**
 * THIS FILE IS AUTO-GENERATED — DO NOT EDIT.
 * It contains the `editorElement` portion of the manifest, automatically derived from your component's
 * source code, prop types, and CSS rules.
 * Update your source code and run `npx wix build && npx wix generate manifest` to regenerate it.
 * If you need to override specific manifest values (sizing, layout, etc.),
 * you can do so in rental-details.extension.ts.
 */

import type { EditorElement } from '@wix/react-component-schema';

export const editorElement = {
  "selector": ".rental-details",
  "displayName": "Rental Details",
  "data": {
    "direction": {
      "displayName": "Direction",
      "dataType": "direction"
    },
    "itemSlug": {
      "displayName": "Item Slug",
      "dataType": "text",
      "text": {}
    },
    "catalogPage": {
      "displayName": "Catalog Page",
      "dataType": "text",
      "text": {}
    },
    "backLabel": {
      "displayName": "Back Label",
      "dataType": "text",
      "text": {}
    },
    "bookingTitle": {
      "displayName": "Booking Title",
      "dataType": "text",
      "text": {}
    },
    "buttonLabel": {
      "displayName": "Button Label",
      "dataType": "text",
      "text": {}
    },
    "imageRatio": {
      "displayName": "Image Ratio",
      "dataType": "textEnum",
      "textEnum": {
        "options": [
          {
            "value": "square",
            "displayName": "Square"
          },
          {
            "value": "portrait",
            "displayName": "Portrait"
          },
          {
            "value": "landscape",
            "displayName": "Landscape"
          }
        ]
      }
    },
    "imageSize": {
      "displayName": "Image Size",
      "dataType": "textEnum",
      "textEnum": {
        "options": [
          {
            "value": "medium",
            "displayName": "Medium"
          },
          {
            "value": "small",
            "displayName": "Small"
          },
          {
            "value": "large",
            "displayName": "Large"
          }
        ]
      }
    },
    "monthsShown": {
      "displayName": "Months Shown",
      "dataType": "number",
      "number": {}
    },
    "showCategory": {
      "displayName": "Show Category",
      "dataType": "booleanValue"
    },
    "showDescription": {
      "displayName": "Show Description",
      "dataType": "booleanValue"
    },
    "showThumbnails": {
      "displayName": "Show Thumbnails",
      "dataType": "booleanValue"
    },
    "showWeeklyPrice": {
      "displayName": "Show Weekly Price",
      "dataType": "booleanValue"
    },
    "showDeposit": {
      "displayName": "Show Deposit",
      "dataType": "booleanValue"
    },
    "showQuantity": {
      "displayName": "Show Quantity",
      "dataType": "booleanValue"
    }
  },
  "elements": {},
  "cssProperties": {
    "background": {},
    "borderTop": {},
    "borderBottom": {},
    "borderInlineStart": {},
    "borderInlineEnd": {},
    "paddingTop": {},
    "paddingBottom": {},
    "paddingInlineStart": {},
    "paddingInlineEnd": {},
    "borderStartStartRadius": {},
    "borderStartEndRadius": {},
    "borderEndStartRadius": {},
    "borderEndEndRadius": {},
    "boxShadow": {},
    "overflow": {},
    "mixBlendMode": {}
  },
  "cssCustomProperties": {}
} as EditorElement;
