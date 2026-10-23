/**
 * THIS FILE IS AUTO-GENERATED — DO NOT EDIT.
 * It contains the `editorElement` portion of the manifest, automatically derived from your component's
 * source code, prop types, and CSS rules.
 * Update your source code and run `npx wix build && npx wix generate manifest` to regenerate it.
 * If you need to override specific manifest values (sizing, layout, etc.),
 * you can do so in rental-catalog.extension.ts.
 */

import type { EditorElement } from '@wix/react-component-schema';

export const editorElement = {
  "selector": ".rental-catalog",
  "displayName": "Rental Catalog",
  "data": {
    "direction": {
      "displayName": "Direction",
      "dataType": "direction"
    },
    "title": {
      "displayName": "Title",
      "dataType": "text",
      "text": {}
    },
    "columns": {
      "displayName": "Columns",
      "dataType": "number",
      "number": {
        "min": "1",
        "max": "4"
      }
    },
    "pageSize": {
      "displayName": "Page Size",
      "dataType": "number",
      "number": {
        "min": "1",
        "max": "48"
      }
    },
    "priceBasis": {
      "displayName": "Price Basis",
      "dataType": "textEnum",
      "textEnum": {
        "options": [
          {
            "value": "daily",
            "displayName": "Daily"
          },
          {
            "value": "weekly",
            "displayName": "Weekly"
          }
        ]
      }
    },
    "showCategoryFilter": {
      "displayName": "Show Category Filter",
      "dataType": "booleanValue"
    }
  },
  "elements": {
    "rentalCatalogTitle": {
      "elementType": "inlineElement",
      "inlineElement": {
        "selector": ".rental-catalog-title",
        "displayName": "Title",
        "behaviors": {
          "removable": true,
          "selectable": false
        },
        "cssProperties": {
          "font": {
            "defaultValue": "700 20px/1.3 sans-serif"
          },
          "lineHeight": {
            "defaultValue": "1.3"
          },
          "letterSpacing": {},
          "textDecorationLine": {},
          "textTransform": {},
          "textAlign": {
            "defaultValue": "start"
          },
          "textShadow": {},
          "color": {
            "defaultValue": "#1a1a1a"
          },
          "marginTop": {
            "defaultValue": "0"
          },
          "marginBottom": {
            "defaultValue": "0"
          },
          "marginInlineStart": {
            "defaultValue": "0"
          },
          "marginInlineEnd": {
            "defaultValue": "0"
          },
          "display": {
            "display": {
              "displayValues": [
                "none",
                "block"
              ]
            }
          },
          "alignSelf": {}
        }
      }
    }
  },
  "cssProperties": {
    "background": {
      "defaultValue": "#ffffff"
    },
    "borderTop": {
      "defaultValue": "1px solid #e0e0e0"
    },
    "borderBottom": {
      "defaultValue": "1px solid #e0e0e0"
    },
    "borderInlineStart": {
      "defaultValue": "1px solid #e0e0e0"
    },
    "borderInlineEnd": {
      "defaultValue": "1px solid #e0e0e0"
    },
    "paddingTop": {},
    "paddingBottom": {},
    "paddingInlineStart": {},
    "paddingInlineEnd": {},
    "borderStartStartRadius": {
      "defaultValue": "12px"
    },
    "borderStartEndRadius": {
      "defaultValue": "12px"
    },
    "borderEndStartRadius": {
      "defaultValue": "12px"
    },
    "borderEndEndRadius": {
      "defaultValue": "12px"
    },
    "boxShadow": {
      "defaultValue": "0 4px 16px rgba(0,0,0,0.08)"
    },
    "overflow": {},
    "mixBlendMode": {},
    "flexDirection": {
      "defaultValue": "column"
    },
    "justifyContent": {},
    "alignItems": {}
  },
  "cssCustomProperties": {}
} as EditorElement;
