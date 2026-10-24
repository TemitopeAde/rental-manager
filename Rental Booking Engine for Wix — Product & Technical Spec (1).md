# Rental Booking Engine for Wix — Product & Technical Spec

Oct 16, 2026 · @Temmy

## Summary

Build a paid Wix App Market app that lets any Wix site rent out items by the day or week, with its own rental catalog and booking engine, and no dependency on Wix Stores.

MVP decisions:

- **Category:** general-purpose. Any rentable item (equipment, event gear, vehicles, apparel). The data model stays category-neutral; category-specific fields come later as custom attributes.
- **Rental periods:** daily and weekly only. Hourly and monthly are deferred.
- **Integration:** standalone. The app owns its rental catalog, availability and booking records. It should still use Wix's own cart and payments for checkout (see Architecture), so merchants don't need to install Wix Stores.

Positioning: the rental app for Wix sites that don't run Wix Stores, or don't want rentals mixed into their product catalog, with reliable no-double-booking inventory as the core promise.

## Market and competition

Three rental apps already sit on the Wix App Market; two depend on Wix Stores and Wix's own is limited to Harmony sites. That leaves room for a standalone rental engine that works on any editor.

| App | Maker | Price | Needs Wix Stores | Notable limits |
| --- | --- | --- | --- | --- |
| [Wix Rentals](https://www.wix.com/app-market/web-solution/wix-rental) | Wix | Free to install | No | A listing review reports it would not run on a Wix Studio site and was told to rebuild on Harmony |
| [Rentals](https://www.wix.com/app-market/marketpushapps-rentals) | MarketPushApps | Free | Yes, turns store products into rentals | Uses the store's own stock; booking sent from the product page |
| [TWICE Rentals](https://support.twicecommerce.com/installing-the-twice-app-on-wix) | TWICE Commerce | Paid (14-day trial) | Yes, connects to the Wix Stores checkout | Separate TWICE account; [deposits only via Wix Payments, charged or released in full](https://support.twicecommerce.com/en/articles/10546649-managing-security-deposit-in-the-twice-rentals-app-wix) |

Our gap:

- **No Wix Stores required.** Service businesses, event companies and Studio sites can rent without running a shop.
- **Works on Wix Studio and the classic editor**, not only Harmony. Must be verified per editor before we claim it in the listing.
- **Rental-native catalog.** Units, quantities, buffers and condition live in a model built for rentals, not bolted onto products.

Risk: Wix Rentals is free and Wix-built. We compete on editor coverage, reliability and rental depth, not price.

## Users and core flows

Two users: the **merchant** (site owner renting out items) and the **renter** (site visitor). Three flows cover the MVP.

**Merchant setup**

1. Install the app. Wix Checkout & Orders installs with it, adding cart, checkout and thank-you pages.
2. Set business defaults: currency (from site), timezone, pickup/return hours, default buffer days, booking approval mode.
3. Create rental items: name, photos, description, category, daily and weekly price, deposit, minimum and maximum days, number of units.
4. Add the Rental Catalog and Rental Booking components to site pages (React component on Harmony, widget on Studio and Wix Editor), or use the app's auto-added pages.
5. Block dates (maintenance, holidays) per item or globally.

**Renter booking**

1. Browse the rental catalog and open an item.
2. Pick start and end dates on the calendar. Unavailable dates are disabled.
3. See the live quote: days, rental charge, deposit, total.
4. Click Rent now. The app places a short hold on the units, then adds the item to the Wix cart.
5. Pay through Wix checkout. On payment, the hold becomes a confirmed booking (or a pending one, if the merchant approves manually).
6. Receive a confirmation email with dates, pickup details and the booking reference.

**Merchant fulfilment**

1. See today's pickups and returns on the dashboard home.
2. Mark a booking picked up (Active), then returned.
3. On return, release the deposit or keep part of it, with a note.
4. Overdue bookings are flagged automatically after the return time passes.

## MVP feature scope

The MVP ships a complete book-pay-return loop for daily and weekly rentals; everything else waits for v2.

| Area | In the MVP | Later (v2+) |
| --- | --- | --- |
| Catalog | Rental items with photos, category, units, prices, deposit | Variants (size, colour), bundles and kits, add-ons (insurance, delivery) |
| Pricing | Daily rate, weekly rate, best-price combination, flat deposit | Hourly and monthly, seasonal rates, weekend rates, discount codes specific to rentals |
| Availability | Per-unit-count calendar, buffer days, min/max days, lead time, blocked dates | Hourly slots, multiple locations, serialized units with condition tracking |
| Checkout | Wix cart and checkout via Catalog service plugin, short holds | Partial payment upfront, card pre-authorisation for deposits |
| Bookings | Statuses, manual approval option, cancel, mark picked up/returned, overdue flag | Late fees, damage charges, signed rental agreements |
| Notifications | Confirmation, pickup reminder, return reminder (email) | SMS, merchant-editable templates |
| Dashboard | Bookings list, item manager, calendar view, today's pickups/returns, settings | Reports, CSV export, staff roles |
| Site UI | Rental Booking (date picker, quote, Rent now) and Rental Catalog, each shipped as both an Editor React Component (Harmony) and a custom element widget (Studio, Wix Editor) | Search filters, embeddable "check availability" button |

Deposit handling in the MVP is a charged line item refunded on return. Card holds depend on Wix payment support and are deferred until verified.

## Pricing and availability rules

The renter always gets the cheapest mix of full weeks and extra days, and a unit is only bookable when no overlapping booking, hold, buffer or block touches it.

**Counting days.** A rental runs from the pickup date to the return date. Days billed = return date minus pickup date, minimum 1 (pick up Monday, return Wednesday = 2 days). Merchants who bill same-day returns as a full day can switch on "count return day" (+1).

**Price.** With d billed days, daily rate r\_d and weekly rate r\_w:

```latex
\text{rental} = \min\left( \left\lfloor \tfrac{d}{7} \right\rfloor r_w + (d \bmod 7)\, r_d,\; \left\lceil \tfrac{d}{7} \right\rceil r_w \right)
```

Example: daily 20, weekly 100, 10 days → min(100 + 3 × 20, 2 × 100) = 160. If no weekly rate is set, rental = d × r\_d.

**Total at checkout** = rental × quantity + deposit × quantity. Tax and shipping come from Wix checkout.

**Availability rules (checked server-side on every quote and hold):**

- **Units:** an item has N interchangeable units. A date range is available when booked + held units on every day of the range, plus the requested quantity, stays at or below N.
- **Buffer:** each booking blocks its units for B days after return (cleaning, inspection). Default 0, set per item.
- **Minimum / maximum days:** per item, default 1 and 30.
- **Lead time:** earliest pickup is today + L days (default 1). Booking window: up to 180 days ahead.
- **Blocked dates:** per item or business-wide (closed days). Pickup and return cannot fall on a closed day.
- **Timezone:** all dates are calendar dates in the business timezone, stored as `YYYY-MM-DD`, never as timestamps.

## Architecture

The app owns its catalog and bookings, and plugs into Wix eCommerce through the Catalog service plugin, so renters pay through the normal Wix cart and checkout without Wix Stores.

&#91;embedded content: app architecture · 3 layers, Wix eCommerce for payment\]

The item widget asks the backend to quote and hold units, then adds the booking to the Wix cart; Wix calls back for item details and, once paid, the order handler confirms the booking.

| Component | Implementation |
| --- | --- |
| Checkout dependency | App Profile → Required Wix Products → **Wix Checkout & Orders**, so cart, checkout and thank-you pages install with the app ([Wix docs](https://dev.wix.com/docs/build-apps/develop-your-app/wix-business-solutions/wix-e-commerce/build-a-wix-e-com-business-solution)) |
| Catalog service plugin | Implements Get Catalog Items: Wix calls it whenever the cart or checkout updates, passing item IDs and expecting price, name and image back ([tutorial](https://dev.wix.com/docs/build-apps/get-started/tutorials/tutorial-build-an-e-commerce-business-solution/step-5-implement-a-self-hosted-catalog-service-plugin)). Returns the held booking's quoted price |
| Inventory service plugin | Not in MVP: our UnitDays ledger is the inventory. Revisit if Wix requires it for listing |
| Tax | Tax Groups service plugin, needed before tax can be charged on non-Stores items; MVP ships with merchant-configured tax on, after verifying |
| Site UI | Shared React booking and catalog components, shipped as an Editor React Component (Harmony) and a custom element (Studio, Wix Editor); see React editor component |
| Dashboard | Dashboard pages in React with the Wix Design System: Home (today), Bookings, Calendar, Items, Settings |
| Backend | Wix CLI backend: HTTP functions for quote/hold/cancel, eCom order event handlers, scheduled jobs |
| Data | Wix Data collections owned by the app (see Data model) |
| Validation | Zod schemas shared by widget and backend |
| Email | Triggered emails for confirmation and reminders |
| Billing | Wix App Market pricing plans, read on the backend to enforce limits |

## React editor component

Build the renter-facing booking UI once in React, and ship it as an Editor React Component for Harmony plus a custom element wrapper for Studio and Wix Editor, because Editor React Components run only on Harmony.

Per Wix, [Editor React Components](https://dev.wix.com/docs/build-apps/develop-your-app/develop-an-app-with-the-cli/supported-extensions/site/about-site-extensions-in-the-wix-cli) are React site widgets for Harmony whose settings panels Wix generates from the component manifest, and they aren't supported on Wix Editor or Studio. [Custom elements](https://dev.wix.com/docs/build-apps/develop-your-app/extensions/site-extensions/custom-elements-vs-editor-react-components) work on Studio, Wix Editor and Harmony but need hand-built settings panels.

| Layer | What it is | Editors |
| --- | --- | --- |
| Shared React core | `RentalBooking` and `RentalCatalog` components: date picker, live quote, Rent now, catalog grid. Pure React + CSS, talks to the Quote and hold API | All |
| Editor React Component shell | Wraps the core; manifest declares props so Harmony auto-builds the settings panel and theme hooks | Harmony |
| Custom element shell | Mounts the same core inside a custom element; hand-built settings panel (React + Wix Design System) | Studio, Wix Editor |

**Components and editor settings (manifest props):**

- **Rental Booking** — item to show (picker of RentalItems), calendar style (inline or pop-up), show deposit line (on/off), show weekly-price badge (on/off), button label (default "Rent now"), quantity selector (on/off).
- **Rental Catalog** — category filter, columns (1–4), cards per page, show "from" price (daily or weekly), sort order.
- **Design** — colours, fonts, corner radius and spacing come from the site theme; Harmony exposes them through the manifest, the custom element panel exposes the same set manually.

**Shipped together:** the Editor React Component and the custom element widget are registered in the same app and released in every app version, so one install covers every editor. Each is built and tested in the same milestone, never one after the other. Before listing, confirm on a test site per editor which of the two the add panel shows, and that a merchant can't add both to one page.

**Rules for the core:** no editor-specific code inside it; all settings arrive as typed props; all data comes from the backend so both shells behave identically; empty and loading states render in the editor preview with sample data.

This also corrects the editor claim in Market and competition: Studio and Wix Editor coverage depends on the custom element shell, not the React component.

## Wix AI (Aria) access

Every action a merchant can take in the dashboard is also exposed to Aria, Wix's AI assistant, through an App Tools extension, so a merchant can run the whole app by chatting in their site dashboard.

**How it works.** Per [Wix's App Tools docs](https://dev.wix.com/docs/build-apps/develop-your-app/extensions/backend-extensions/app-tools/about-app-tools-extensions), two extensions work together: an App Tools declaration that tells Aria which tools exist, and a [Tools Provider service plugin](https://dev.wix.com/docs/build-apps/develop-your-app/develop-an-app-with-the-cli/supported-extensions/backend/schema-plugins/add-app-tools-extensions-with-the-wix-cli) whose `runTool` handler runs the chosen tool. Aria picks a tool by its description, asks the merchant for missing inputs using the tool's request schema, then turns the result into a plain-language answer. Both are generated with `wix generate` and take effect after `wix release`.

**Design rule:** `runTool` routes on `methodName` to the same service layer the dashboard uses. No tool gets logic of its own, so Aria and the dashboard can never disagree, and every plan limit, availability rule and ledger check applies to both.

| Tool | What it does | Main inputs |
| --- | --- | --- |
| list\_rental\_items | Lists items with prices, units and status | category, status |
| get\_rental\_item | Full details of one item | item name or ID |
| create\_rental\_item | Adds an item | name, daily rate, weekly rate, units, deposit |
| update\_rental\_item | Changes prices, units, rules or status | item, fields to change |
| check\_availability | Free units for a date range | item, start, end, quantity |
| get\_quote | Price for a rental | item, start, end, quantity |
| list\_bookings | Bookings by status or date range | status, from, to |
| get\_booking | One booking with renter and payment link | reference |
| create\_manual\_booking | Books for a phone or walk-in renter, claims units via the ledger | item, dates, quantity, renter name and email |
| approve\_booking / decline\_booking | Acts on Pending bookings | reference |
| mark\_picked\_up / mark\_returned | Moves Confirmed → Active → Returned | reference |
| settle\_deposit | Records deposit released or amount kept | reference, amount kept, note |
| cancel\_booking | Cancels and frees units | reference, reason |
| block\_dates / unblock\_dates | Item or business-wide closures | item or all, dates, reason |
| get\_today | Today's pickups, returns and overdue rentals | none |
| get\_rental\_summary | Bookings, revenue and top items for a period | from, to |
| get\_settings / update\_settings | Business rules, approval mode, hours | fields to change |

**Safety:**

- Changing tools (create, update, cancel, decline, settle, block, update settings) require a `confirm: true` field. The first call returns a summary of what will happen; Aria shows it and calls again only after the merchant agrees.
- Cancelling a paid booking never refunds by itself; the tool returns a link to the Wix order so the merchant refunds there.
- Every tool call is written to an audit log with source `aria`, visible on the booking's history.
- Descriptions stay short and state what the tool does, when to use it and what it needs, as Wix recommends for reliable tool selection.

**Example prompts:** "What's going out and coming back today?", "Is the Canon R6 free next Friday to Monday?", "Book two folding tables for Ada Obi, 3 to 5 November", "Close the shop on 25 December", "How much did rentals make last month?"

Scope impact: `create_manual_booking` is a new MVP capability, so the dashboard gets the same "New booking" form. Add the App Tools work to milestone 2 (tools) and 3 (descriptions tuned with real prompts).

## Data model

Five app-owned collections hold everything; Wix eCommerce owns orders and payments, and we link to them by ID.

**RentalItems** — the catalog the Catalog service plugin reads.

| Field | Type | Notes |
| --- | --- | --- |
| \_id | text | Catalog item ID passed to the Wix cart |
| name, description, slug | text | Slug drives the item page URL |
| images | media gallery | First image shows in cart |
| category | text | Free text in MVP |
| unitCount | number | N interchangeable units |
| dailyRate, weeklyRate | number | In site currency; weekly optional |
| depositAmount | number | Per unit, 0 = none |
| minDays, maxDays, bufferDays, leadDays | number | Override business defaults |
| status | text | active, hidden, archived |

**Bookings** — one per rental.

| Field | Type | Notes |
| --- | --- | --- |
| \_id, reference | text | Reference shown to renter, e.g. RB-10423 |
| itemId, quantity | text, number |  |
| startDate, endDate | text (YYYY-MM-DD) | Business-timezone dates |
| status | text | hold, pending, confirmed, active, returned, cancelled, overdue, expired |
| holdExpiresAt | date-time | Only while status = hold |
| quote | object | days, rental, deposit, total, rates used |
| cartLineItemId, ecomOrderId | text | Links to Wix cart and order |
| renter | object | name, email, phone (from checkout) |
| depositOutcome | object | released / kept amount, note |
| idempotencyKey | text | Unique; see next section |

**UnitDays** — the availability ledger; one row per unit per occupied day (including buffer days).

| Field | Type | Notes |
| --- | --- | --- |
| \_id | text | Deterministic: `itemId:YYYY-MM-DD:unitIndex` |
| bookingId | text | Owner of this unit-day |

**BlockedDates** — itemId (or `*` for business-wide), date, reason.

**Settings** — one row per site: timezone, pickup/return hours, approval mode, default rules, email sender name, plan tier.

## Double-booking prevention

Two renters can never hold the same unit on the same day, because each unit-day is a row with a deterministic ID and the database rejects a second insert of the same ID.

**Claiming units (on Rent now):**

1. Validate the request with Zod and re-run every availability rule server-side. The calendar is only a hint.
2. Create a Booking with status `hold`, `holdExpiresAt` = now + 15 minutes.
3. For each day from pickup through return + buffer, insert one UnitDays row per requested unit, trying unit indexes 0 to N−1 until an insert succeeds.
4. If any day cannot be claimed, delete the rows already written for this booking, mark it `expired`, and return "those dates were just taken".
5. Add the item to the Wix cart with the booking ID in the line item's catalog reference options.

**Releasing:** a scheduled job every 5 minutes finds holds past `holdExpiresAt` with no paid order, deletes their UnitDays rows and marks them `expired`. Cancellation does the same. Holds are extended once (to 30 minutes) when checkout starts.

**Confirming:** on the Wix order-paid event, look up the booking by its ID from the order line item. If it is still `hold`, move it to `confirmed` (or `pending` in manual-approval mode). If the hold already expired, try to re-claim the units; if that fails, flag the order for refund and alert the merchant.

**Idempotency:** every write endpoint takes a client-generated `idempotencyKey`, stored uniquely on the booking. A retried request returns the original result instead of claiming twice. Order-event handlers check the booking's current status before acting, so a repeated event is a no-op.

**Catalog service plugin check:** when Wix asks for item details, the plugin confirms the booking is still a live hold. If not, it returns the item as unavailable so checkout cannot complete.

## Booking lifecycle and notifications

A booking moves through eight statuses; each transition that matters to a person sends one email.

&#91;embedded content: booking lifecycle · 8 statuses\]

Paid holds go to Pending when the merchant approves manually, otherwise straight to Confirmed. Merchants move Confirmed to Active at pickup and Active to Returned at return. Pending and Confirmed bookings can be cancelled; cancelling frees the units.

| Trigger | Renter gets | Merchant gets |
| --- | --- | --- |
| Paid, manual approval | "Request received" | New request alert |
| Confirmed | Confirmation with dates, pickup hours, reference | New booking alert |
| 1 day before pickup | Pickup reminder | Shown on dashboard Home |
| 1 day before return | Return reminder | Shown on dashboard Home |
| Overdue | Late return notice | Overdue alert |
| Cancelled | Cancellation notice | Cancellation alert |

## App Market billing and plans

Proposed: a free tier to win installs against free competitors, and two paid tiers gated on items and bookings. Prices are a starting point to test, in USD per month, billed through Wix's app pricing plans.

| Plan | Price | Rental items | Bookings / month | Extras |
| --- | --- | --- | --- | --- |
| Basic | $0 | 1 | 10 | "Powered by" line in emails |
| Pro | $12 | 30 | 150 | Reminders, manual approval, no branding |
| Business | $29 | Unlimited | Unlimited | Calendar view, buffer and lead-time rules per item, priority support |

Enforcement: the backend reads the site's plan on each item create and each hold. Over-limit sites keep existing bookings working; only new items or holds are blocked, with an upgrade prompt in the dashboard. Never block a renter mid-checkout over a plan limit.

## Risks, open questions and milestones

The biggest risk is the checkout path: everything depends on the Catalog service plugin carrying a booking ID through cart and order, so we prove that first, before building UI.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Catalog service plugin or Checkout & Orders dependency behaves differently than documented | Blocks the whole standalone model | Week 1 spike: one hard-coded item, add to cart, pay on a test site, read booking ID from the order |
| Resolved: the unified Wix CLI lists service plugins, events, data collections and App Tools as backend extensions. Remaining risk: Aria picks the wrong tool or acts on a vague prompt | Wrong or unwanted changes made through chat | Confirm step on every changing tool, audit log, prompt test set before release |
| Wix Data insert does not reject a duplicate `_id` the way the ledger assumes | Double bookings | Load-test 50 parallel holds on one unit before anything else is built on it |
| Site widgets render differently on Harmony, Studio and classic editor | Our main differentiator fails | Test matrix on all three before listing; claim only what passes |
| Wix Rentals (free, Wix-built) adds features | Squeezes paid tiers | Lead on editor coverage and reliability; keep a useful free tier |
| Deposit refunds are manual in MVP | Merchant friction | Clear "refund deposit" action linking to the Wix order |

**Open questions**

- [ ] App name and listing positioning ("Rental Booking Engine" or shorter).
- [ ] Does the free tier carry branding, or only limits?
- [ ] Delivery vs pickup only: is delivery needed for MVP event-rental merchants?
- [ ] Should cancelled paid bookings auto-refund, or leave refunds to the merchant?

**Milestones**

&#91;embedded content: build milestones · 4 phases, 2 gates\]

Week counts are an estimate for one developer. If the week-2 gate fails, stop and decide between a Wix Stores-based build and a self-hosted checkout before writing any UI.
