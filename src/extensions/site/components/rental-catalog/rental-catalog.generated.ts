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
    },
    "rentalCatalogField": {
      "elementType": "inlineElement",
      "inlineElement": {
        "selector": ".rental-catalog-field",
        "displayName": "Field",
        "behaviors": {
          "removable": true,
          "selectable": false
        },
        "cssProperties": {
          "font": {
            "defaultValue": "400 16px sans-serif"
          },
          "lineHeight": {},
          "letterSpacing": {},
          "textDecorationLine": {},
          "textTransform": {},
          "textAlign": {},
          "textShadow": {},
          "color": {
            "defaultValue": "#1a1a1a"
          },
          "background": {
            "defaultValue": "#ffffff"
          },
          "borderTop": {
            "defaultValue": "1px solid #c7c7c7"
          },
          "borderBottom": {
            "defaultValue": "1px solid #c7c7c7"
          },
          "borderInlineStart": {
            "defaultValue": "1px solid #c7c7c7"
          },
          "borderInlineEnd": {
            "defaultValue": "1px solid #c7c7c7"
          },
          "paddingTop": {},
          "paddingBottom": {},
          "paddingInlineStart": {
            "defaultValue": "12px"
          },
          "paddingInlineEnd": {
            "defaultValue": "12px"
          },
          "borderStartStartRadius": {
            "defaultValue": "6px"
          },
          "borderStartEndRadius": {
            "defaultValue": "6px"
          },
          "borderEndStartRadius": {
            "defaultValue": "6px"
          },
          "borderEndEndRadius": {
            "defaultValue": "6px"
          },
          "boxShadow": {},
          "width": {
            "defaultValue": "100%"
          },
          "height": {},
          "overflow": {},
          "mixBlendMode": {},
          "display": {
            "display": {
              "displayValues": [
                "none",
                "flex"
              ]
            }
          },
          "marginTop": {},
          "marginBottom": {},
          "marginInlineStart": {},
          "marginInlineEnd": {},
          "flexDirection": {
            "defaultValue": "column"
          },
          "justifyContent": {},
          "alignItems": {},
          "alignSelf": {}
        },
        "states": {
          "hover": {
            "displayName": "Hover",
            "className": "rental-catalog-field--hover",
            "pseudoClass": "hover"
          },
          "focus": {
            "displayName": "Focus",
            "className": "rental-catalog-field--focus",
            "pseudoClass": "focus"
          },
          "disabled": {
            "displayName": "Disabled",
            "className": "rental-catalog-field--disabled",
            "pseudoClass": "disabled"
          },
          "invalid": {
            "displayName": "Invalid",
            "className": "rental-catalog-field--invalid",
            "pseudoClass": "invalid"
          }
        }
      }
    },
    "rentalCatalogButton": {
      "elementType": "inlineElement",
      "inlineElement": {
        "selector": ".rental-catalog-button",
        "displayName": "Button",
        "behaviors": {
          "removable": true,
          "selectable": false
        },
        "cssProperties": {
          "color": {
            "defaultValue": "#ffffff"
          },
          "background": {
            "defaultValue": "#116dff",
            "statesDefaultValues": {
              "hover": "#0b5ed7"
            }
          },
          "borderTop": {
            "defaultValue": "0"
          },
          "borderBottom": {
            "defaultValue": "0"
          },
          "borderInlineStart": {
            "defaultValue": "0"
          },
          "borderInlineEnd": {
            "defaultValue": "0"
          },
          "paddingTop": {},
          "paddingBottom": {},
          "paddingInlineStart": {
            "defaultValue": "16px"
          },
          "paddingInlineEnd": {
            "defaultValue": "16px"
          },
          "borderStartStartRadius": {
            "defaultValue": "6px"
          },
          "borderStartEndRadius": {
            "defaultValue": "6px"
          },
          "borderEndStartRadius": {
            "defaultValue": "6px"
          },
          "borderEndEndRadius": {
            "defaultValue": "6px"
          },
          "boxShadow": {},
          "width": {},
          "height": {},
          "overflow": {},
          "mixBlendMode": {},
          "marginTop": {},
          "marginBottom": {},
          "marginInlineStart": {},
          "marginInlineEnd": {},
          "display": {
            "display": {
              "displayValues": [
                "none",
                "inlineBlock"
              ]
            }
          },
          "font": {
            "defaultValue": "600 16px/1.2 sans-serif"
          },
          "lineHeight": {
            "defaultValue": "1.2"
          },
          "letterSpacing": {},
          "textDecorationLine": {},
          "textTransform": {},
          "textAlign": {},
          "textShadow": {},
          "alignSelf": {}
        },
        "states": {
          "hover": {
            "displayName": "Hover",
            "className": "rental-catalog-button--hover",
            "pseudoClass": "hover"
          },
          "disabled": {
            "displayName": "Disabled",
            "className": "rental-catalog-button--disabled",
            "pseudoClass": "disabled"
          }
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
    "gap": {},
    "flexDirection": {
      "defaultValue": "column"
    },
    "justifyContent": {},
    "alignItems": {}
  },
  "cssCustomProperties": {}
} as EditorElement;
