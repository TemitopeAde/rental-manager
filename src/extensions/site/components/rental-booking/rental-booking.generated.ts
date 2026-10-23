/**
 * THIS FILE IS AUTO-GENERATED — DO NOT EDIT.
 * It contains the `editorElement` portion of the manifest, automatically derived from your component's
 * source code, prop types, and CSS rules.
 * Update your source code and run `npx wix build && npx wix generate manifest` to regenerate it.
 * If you need to override specific manifest values (sizing, layout, etc.),
 * you can do so in rental-booking.extension.ts.
 */

import type { EditorElement } from '@wix/react-component-schema';

export const editorElement = {
  "selector": ".rental-booking",
  "displayName": "Rental Booking",
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
    "description": {
      "displayName": "Description",
      "dataType": "text",
      "text": {}
    },
    "itemId": {
      "displayName": "Item Id",
      "dataType": "text",
      "text": {}
    },
    "buttonLabel": {
      "displayName": "Button Label",
      "dataType": "text",
      "text": {}
    },
    "showDeposit": {
      "displayName": "Show Deposit",
      "dataType": "booleanValue"
    },
    "showWeeklyPrice": {
      "displayName": "Show Weekly Price",
      "dataType": "booleanValue"
    },
    "showQuantity": {
      "displayName": "Show Quantity",
      "dataType": "booleanValue"
    }
  },
  "elements": {
    "rentalBookingTitle": {
      "elementType": "inlineElement",
      "inlineElement": {
        "selector": ".rental-booking-title",
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
    "rentalBookingDescription": {
      "elementType": "inlineElement",
      "inlineElement": {
        "selector": ".rental-booking-description",
        "displayName": "Description",
        "behaviors": {
          "removable": true,
          "selectable": false
        },
        "cssProperties": {
          "font": {
            "defaultValue": "400 14px/1.5 sans-serif"
          },
          "lineHeight": {
            "defaultValue": "1.5"
          },
          "letterSpacing": {},
          "textDecorationLine": {},
          "textTransform": {},
          "textAlign": {
            "defaultValue": "start"
          },
          "textShadow": {},
          "color": {
            "defaultValue": "#4d4d4d"
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
    "rentalBookingField": {
      "elementType": "inlineElement",
      "inlineElement": {
        "selector": ".rental-booking-field",
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
            "className": "rental-booking-field--hover",
            "pseudoClass": "hover"
          },
          "focus": {
            "displayName": "Focus",
            "className": "rental-booking-field--focus",
            "pseudoClass": "focus"
          },
          "disabled": {
            "displayName": "Disabled",
            "className": "rental-booking-field--disabled",
            "pseudoClass": "disabled"
          },
          "invalid": {
            "displayName": "Invalid",
            "className": "rental-booking-field--invalid",
            "pseudoClass": "invalid"
          }
        }
      }
    },
    "rentalBookingButton": {
      "elementType": "inlineElement",
      "inlineElement": {
        "selector": ".rental-booking-button",
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
            "className": "rental-booking-button--hover",
            "pseudoClass": "hover"
          },
          "disabled": {
            "displayName": "Disabled",
            "className": "rental-booking-button--disabled",
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
