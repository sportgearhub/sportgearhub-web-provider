# Provider Console ↔ Offer API: What Went Dead

> Status: **analysis + fix, 2026-09-25.** The console was written against an offer contract that
> three later refactors changed underneath it. This is what broke, why, and what each side does now.

## How the drift happened

Nothing here is a mistake in the console's own logic: the API moved and the console was not moved
with it. Three commits did it.

| Commit | What it changed | What the console still assumed |
|---|---|---|
| `2672ad2` Replace offer visibility with one status and one predicate | `OfferVisibility` table, its two endpoints and its models deleted; `Offer.Status` gained `Paused` | a `/offers/{id}/visibility` resource with `always_visible` / `seasonal` / `hidden` modes and a date range |
| `047bf1c` Rental pricing: tiers as duration blocks | the pricing policy is tiers only | a `multi_day_rate` field beside the tiers |
| earlier offer-model work | the provider-facing offer response lost every location field | `fulfillment_location_id`, `location_summary`, `location` on the offer it reads back |

A dead **route** fails loudly — a 404 the console catches and shows. A dead **field** fails
silently, and those are the ones that cost data.

## Dead routes

| Console call | Verdict |
|---|---|
| `GET`/`PUT /offers/{id}/visibility` | gone in `2672ad2`. The replacement is the offer's own status: `POST …/deactivate` pauses it, `POST …/activate` publishes it. |
| `GET /acquiring-connections/{id}/recipient-routes` | gone. Nothing replaces it; the console never rendered its result. |

Everything else the console calls exists, including `/members/*`, which a first pass mistook for
dead because its routes are declared on their own lines.

## Dead fields, and what each one cost

1. **`fulfillment_location_id` is written but never read back.** Create and patch accept it; no
   provider-facing offer response returns it. So when the console opened an offer for editing, the
   «Пункт проката» picker found nothing to prefill, fell back to *the first location in the list*,
   and the next save sent that — **silently moving an offer to a different pickup point**. A
   provider with two пункта could not edit an offer's title without relocating it. This is the one
   real data-loss bug of the set, and the only one whose honest fix is on the API side: the
   response now carries the id.

2. **`multi_day_rate` never existed in the API.** The console showed «Каждые следующие сутки»,
   sent it on every save and read it back as empty. The tiers already express the same thing —
   a tier at 48 or 72 hours — so the field is removed rather than added to the API.

3. **Offer status vocabulary disagreed.** The API emits `draft · active · paused · suspended ·
   archived`. The console accepted `active · inactive · archived · draft` and mapped anything else
   to `draft`. So the moment a seller pressed «Отключить», the API set `paused` and the console
   displayed «Черновик» — and a platform suspension looked like a draft too, hiding the fact that
   the seller cannot lift it.

4. **`unit_rules`, `variant_ready`, `visibility`** — read behind `??` fallbacks, so they cost
   nothing but noise. `variant_ready` is the API's `inventory_ready` under its old name.

## What each side does now

**API** — one change, closing the read-side gap: `fulfillment_location_id` is returned by both the
provider offer summary and the detail. It was always accepted on write; now what was written can
be read.

**Console** —

- Offer status is the API's: `draft · active · paused · suspended · archived`, with «На паузе» and
  «Приостановлено платформой» as distinct labels. A suspended offer shows no seller controls,
  because `ActivateOfferAsync` refuses it by design.
- «Видимость» is gone from the offer page and from the creation flow. Publication is the status,
  and a created offer is already `active`, which the creation preview now says.
- The пункт проката is prefilled from the offer and no longer defaults to the first location; with
  no location the picker stays empty and the save keeps it empty.
- `multi_day_rate`, `unit_rules`, `variant_ready`, `visibility` and the `recipient-routes` call are
  removed from the client and the types.

## Unused API routes

`/resources/{id}/availability-diagnostics` and `/offers/{id}/policy-summary-preview` were deleted on
2026-09-28, together with `/payout-setup/routability`, `/payout-setup/deal-binding` and the three
`/contacts` routes, once a sweep of all six front-end repos confirmed nothing called them. The
orphaned service methods went with them; `PreviewPricingSummaryAsync` and `GetPricingDiagnosticsAsync`
stayed, because their endpoints are called.

`/resources/{id}/slots` and its three siblings are still here. Unlike the others they are not inert:
slots are read by checkout, offer readiness, routability, the offer query and diagnostics. Retiring
them is the slot-path decision, not an endpoint cleanup.

## Why none of this was caught

The console's `npm run build` was `vite build` alone, and its root `tsconfig.json` has
`"files": []` — it type-checks nothing and defers to project references that nothing invoked. So
`tsc --noEmit -p tsconfig.json` passed vacuously and every dead field sailed through CI into
production. The build is now `tsc -b && vite build`; run against the real config it reported
twenty-five errors, one per site listed above. That guard, not this cleanup, is what keeps the
next API refactor from drifting the same way.
