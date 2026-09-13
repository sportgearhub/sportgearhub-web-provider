# Offer / Fulfillment Model — Redesign Analysis (WORK IN PROGRESS)

> Status: **WIP analysis, not decided, not implemented.** Captured from the 2026-06-12
> design discussion to review later. No code or schema changes have been made.
> Nothing here is committed direction yet.

## Problem

The resource ↔ offer distinction is heavier than the domain needs, and the seam is fuzzy:

- **`Offer.PrimaryResourceId` is non-nullable** → every offer, including experiences and
  services, is forced to hang off a warehouse `ProviderResource` it doesn't really have
  (the SUP *tour* offer invents a `SupTourResource`). This is the root wart.
- **The common case is over-modeled.** "Rent one kind of bike" requires resource + variant +
  unit + offer + pricing + availability + visibility — ~7 concepts where Ozon needs 1
  (article + price + images + stock). Ozon is simpler because it sells physical goods that
  ship (decrement stock); we do **time-based rental reuse** + **experiences** + **services**.
- **Ownership is smeared across layers** (SKU on variant, pricing on offer, media on resource
  *and* offer, title on both) — the source of the `Offer.Price` / media / description
  "which layer owns it?" confusion.

## Core insight

The three offer types diverge in **fulfillment**, not in **commerce**. Money and booking are
type-blind:

| Layer | Rental | Experience | Service | Shared? |
|---|---|---|---|---|
| Discovery / marketplace | listing | listing | listing | **shared** |
| Booking (commit) | reserve unit | reserve seat | reserve slot | **shared anchor, divergent subject** |
| Invoice → lines → payment → settlement | amounts | amounts | amounts | **fully shared, type-blind** |
| Reviews / policies / provider | — | — | — | **shared** |
| **Fulfillment** | inventory / units / return / deposit | slots / capacity | per-participant | **divergent** |

- **Invoices already don't know the type** — `Invoice → InvoiceLine → amounts`, tied to a
  `Booking`. A tour and a lesson invoice identically.
- **Bookings already handle divergence below themselves** — `ReservationRecord` has
  `BookingSubjectType` + `BookingSubjectRef` (unit for rental, slot-seat for experience).
  The polymorphism is already at the *subject* level, under one `Booking`.

## Proposed model (A): shared Offer anchor + polymorphic fulfillment

The Offer is the spine (identity, merchandising, pricing, discovery). Type-specific backing
hangs off it. Resource/variant/unit become **pure warehouse**, referenced only by the rental
binding — never on the offer/booking path directly.

```
                       ┌── Rental ──────────► OfferItem[]  → ResourceVariant → Unit  (inventory)
Offer (no resource) ───┤
                       └── Experience/Service ► OfferSlot[]  (scheduled capacity)

Booking   → Offer        (unchanged)
Invoice   → Booking      (unchanged, type-blind)
Discovery → Offer        (one source)

Warehouse (pure, off the offer path):
  ProviderResource ⊃ ResourceVariant ⊃ ProviderResourceUnit + VariantAllocation
```

| Aspect | Rental | Experience / Service |
|---|---|---|
| Backing | `OfferItem[]` → variant → units | `OfferSlot[]` (capacity per slot) |
| Availability | `OfferAvailabilitySettings` (windows) + unit inventory | the slots themselves |
| Pricing | `rental_tiers` (per time) | `per_participant` / `fixed` |
| Booking subject | a unit of a bound variant | a seat in a slot |
| Scarcity | unit double-book guard (`ReservationRecord`) | slot `Reserved/Total` |

### The invariant

**The type distinction must stay *below* the Booking line.** Booking and everything financial
reference the commercial unit (`Offer`); they never branch on rental-vs-experience. The moment
type rises above the booking (into separate offer/booking/invoice identities per type), every
downstream relationship (booking FK, invoice joins, discovery, reviews, policies,
canonicalization) fragments into polymorphic associations — large cost, no gain.

So: distinct **fulfillment** domains — yes. Distinct **offer/booking/invoice** per type — no.

## Entity changes (mostly rename / re-key, not new build)

Much of this already exists:

- **Drop** `Offer.PrimaryResourceId` and `Offer.VariantExposureMode`.
- **`OfferVariantExposure` → `OfferItem`** — it is *already* the offer↔variant binding
  (`OfferId` + `ResourceVariantId` + visibility/sort). This is the rental backing; `PrimaryResourceId`
  is already redundant with it.
- **`ResourceSlot` → `OfferSlot`** — re-key `ResourceId` → `OfferId`; already has
  start/end + `TotalCapacity`/`ReservedCapacity`. This is the experience/service backing.
- **Keep as pure warehouse**: `ProviderResource`, `ResourceVariant`, `ProviderResourceUnit`,
  `VariantAllocation`. Referenced only via `OfferItem`.
- **Booking resolution** changes from `offer→resource→variant` to `offer→OfferItem→variant→unit`
  (rental) or `offer→OfferSlot→seat` (experience/service).

## Ripples that hung off `PrimaryResourceId` (must be decided)

1. **Category/taxonomy** — today on `resource.CategoryId`; discovery filters by it. Dropping the
   resource link leaves the offer with no category. → **Move category onto the Offer** (recommended),
   or derive from bound items.
2. **Media** — today the offer falls back to resource images via `PrimaryResourceId`. → **Media
   moves to the Offer** (offer-owned gallery); resource fallback removed. (This supersedes the
   earlier "keep media on the resource" note — that held only under the resource-prominent model.)
3. **Attributes (e.g. `frame_size`)** — stay on the variant (physical truth); the offer **projects**
   them from its bound items for display/filtering.
4. **Validation** — a rental offer needs ≥1 `OfferItem`; an experience/service offer needs ≥1
   `OfferSlot`. An offer can't be both; type selects the backing.

## Why bookings & invoices do NOT break (model A)

- `Booking` keeps a single FK to `Offer`; the type-specific reservation already lives in the
  polymorphic `BookingSubjectRef`.
- `Invoice`/`InvoiceLine`/payment/settlement are amount-based and reference `Booking` — they never
  see the offer type. The `OfferItem`/`OfferSlot` split is entirely below the booking line.

## Open decisions (lock before any code)

1. **Category** → on the Offer? (lean: yes)
2. **Media** → on the Offer, resource fallback removed? (lean: yes)
3. **Experiences/services carry no resource at all** — confirm, so `OfferItem`/`OfferSlot` fully
   replace the resource path.
4. **SKU/identity** — keep SKU on variant (inventory) with Offer as the public identity, or hoist a
   public code onto the offer?
5. **Auto-provisioning** — for a simple rental, auto-create resource/variant/unit on offer creation
   (Ozon-like UX), or let providers create an offer with inline inventory and materialize the
   warehouse lazily?

## Phased path (incremental, like the `Offer.Price` removal)

1. Make `Offer.PrimaryResourceId` nullable; allow experiences/services with no resource.
2. Move category + media onto the Offer; remove resource fallbacks.
3. Rename `OfferVariantExposure → OfferItem`; re-key `ResourceSlot → OfferSlot`.
4. Switch booking-subject resolution to `OfferItem` / `OfferSlot`.
5. Drop `Offer.PrimaryResourceId` + `VariantExposureMode`.

## Related

- Billing/payout model: [billing-and-payout-model.design.md](billing-and-payout-model.design.md)
  (the invoice/settlement spine this redesign must leave intact).
