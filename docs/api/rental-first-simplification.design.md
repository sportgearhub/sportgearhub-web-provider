# Rental-First Simplification — What To Cut

> Status: **done, 2026-09-30.** What actually shipped is in «What it came to» at the end of this
> document; the body below is the plan as written on 2026-09-22 and is kept for the reasoning, not as a
> description of the code. Captured from the 2026-09-22 discussion following
> [three-directions.strategy.md](three-directions.strategy.md), which argues for winning rental
> first. Tours and training become plans, not code.
>
> Every figure below is a live row count from the **production database**, 2026-09-22.

## The measurement that frames everything

| | Rows in production |
|---|---|
| Providers | **2** |
| Offers | **5** |
| Bookings | **3** |
| Users | **6** |
| Invoices | **0** |
| Reservations | **0** |

The product has not launched. Against that: **81 tables, 24 of them empty**, and the five
largest tables in the database are attribute metadata totalling **441 rows to describe 5
offers**.

That ratio is the whole problem. Nothing below is about code quality — it is about a system
built for a scale and a product surface that does not exist yet, where every unused table is
something that has to be migrated, reasoned about and kept consistent for no return.

Now is also the cheapest this will ever be. Deleting an empty table is free; deleting one with a
year of production rows in it is a project.

## What to cut

### 1. A duplicate category tree — delete

`equipment.EquipmentCategories` (6 rows) and `equipment.EquipmentCategoryTranslations` (12) are
**structurally identical to `inventory.ResourceCategories`** — same columns, same 6 IDs, same
data — and referenced by **zero service files**. `ProviderResource.CategoryId` resolves against
`ResourceCategories`; `EquipmentCategories` is a parallel copy nothing reads.

Two tables, 18 rows, no consumers.

### 2. Canonicalisation — remove entirely

| Table | Rows |
|---|---|
| `operations.CanonicalMappings` | 4 |
| `operations.CanonicalMappingProposals` | 3 |
| `operations.CanonicalOffers` | 2 |
| `operations.CanonicalProducts` | 2 |
| `operations.CanonicalReviewHistories` | 2 |
| `operations.CapabilityDriftAuditRecords` | 0 |

Canonicalisation solves catalogue deduplication — the same product listed by many sellers under
different names. It is a real problem **at a few thousand sellers**. With two providers and five
offers there is nothing to deduplicate, and the machinery plus its admin review workflow is
being maintained against a problem that has not arrived.

Six tables, an entire schema, and the admin surface that drives them.

### 3. Reversed by measurement: the payout path is live, and so is its safety net

The first draft of this document listed `SettlementPlans`, `LedgerRepairRecords` and
`ReconciliationIncidentRecords` as empty tables to retire. Doing the work reversed all three,
for one reason: **zero rows measured how often they had been *needed*, not whether they were
load-bearing.**

| Table | Rows | What the code says |
|---|---|---|
| `SettlementPlans` | 0 | ~120 references across seven services, and `PayoutExecution.SettlementPlanId` is a **non-nullable** `Guid`. The spine this document says to keep is keyed on the table it said to retire. |
| `ReconciliationIncidentRecords` | 0 | A ~20-usage service, an entire `Internal/Reconciliation/` endpoint folder, seven call sites in `WorkflowRuntimeService` |
| `LedgerRepairRecords` | 0 | **This row was wrong, and the table is gone (2026-09-26).** Reconciliation's `repair_ledger` action only moved incident status; it never wrote here, and the action itself was removed on 2026-09-27 because it planned a repair nothing could perform. The table recorded that someone had recomputed a derived table — and every ledger read recomputes it anyway |

The billing doc's "legacy until retired" does not mean `SettlementPlan` is a dead table beside
the Invoice model. It means it is the **live payout path**, and the Invoice/ledger accrual layer
is the designed-but-unbuilt replacement. Retiring it is not a cut; it is building that layer.

Reconciliation is the safety net for that path. Unlike canonicalisation, which solves a scale
problem that does not exist yet, it solves a correctness problem that exists the moment the first
real payment settles. **`SettlementPlans` and `ReconciliationIncidentRecords` stay.**

### 4. Speculative provider features — remove

- `provider.ProviderTariffs` (0) — a fee schedule for a platform not charging fees yet
- ~~`provider.ProviderStorefrontConfigurations` (0)~~ — **kept.** Empty, but `ProviderStorefrontService`, its endpoints and the widget are live; whether per-provider storefronts survive rental-first is a product decision (see open decisions), not a cleanup one.

### 5. Park with tours and training

Not deletions — these belong to directions now deferred, and should move out of the rental path
rather than sit in it as conditionals:

- `inventory.ResourceSlots` (2) — slot-based capacity, the experience/training supply model
- `catalog.OfferMeetupLocations` (4) — a meeting point is a tour concept
- `OfferType.Experience` and `OfferType.Service`, and the per-participant pricing modes

Per fulfillment-dimensions.design.md (the deleted fulfillment-dimensions design, removed 2026-09-30), rental is unit-backed
and everything else is slot-backed; with only rental live there is **one supply shape**, and the
fourteen type branches collapse to none rather than to a contract. The contract becomes worth
building the day tours ship — and the design is already written down for then.

**Decision (2026-09-22): leave it in place.** Measured before touching it: `OfferType.Experience|Service`
is six sites in three files, but the machinery under it is ~25 — a live `ResourceSlotService`,
catalog management, readiness, pricing config and thirteen files of meetup locations. "Parking"
that as a code move is a large diff with no functional effect; parking it as a deletion throws
away the tours design that fulfillment-dimensions.design.md (the deleted fulfillment-dimensions design, removed 2026-09-30)
already specifies. With no slot-backed offers live it costs nothing to leave. Revisit the day
tours ship, when the supply-backing contract becomes worth building.

### 6. Leftovers

- `catalog.TestEntities` — **3 rows, in production**
- `provider.ProviderOnboardingApplications` — superseded by
  [seller-onboarding-redesign.design.md](seller-onboarding-redesign.design.md)

## What to freeze rather than cut

The attribute system is the largest thing in the database:

| Table | Rows |
|---|---|
| `AttributeAllowedValueTranslations` | 158 |
| `AttributeDefinitionTranslations` | 96 |
| `AttributeAllowedValues` | 79 |
| `CategoryAttributeDefinitions` | 60 |
| `AttributeDefinitions` | 48 |
| | **441** |

Against **28 actual attribute values** on real resources. A filterable, translatable,
conditionally-visible, per-category attribute schema is the right long-term answer for a rental
catalogue — frame size, wetsuit thickness, ski length are genuinely how people search — so this
is not waste in the way canonicalisation is.

But it is 16× more taxonomy than catalogue. **Freeze it**: no new attribute definitions, no new
translations, no extensions to the visibility-condition model until the catalogue is large
enough to be limited by it. Seed exactly what the first rental cities need and stop.

Related: `inventory.ActivityDomains` (17 rows + 34 translations) is a third classification axis
alongside categories. With one direction live, decide whether activity is a facet of category or
an independent axis before adding a row to either.

## After the cut

| | Now | After |
|---|---|---|
| Tables | 81 | **71** now; 68 once the onboarding redesign and slot parking land |
| Schemas | 9 | 8 (`operations` goes) |
| Empty tables | 24 | ~15, all of them spine or its safety net |

Ten tables removed now, with a combined **34 rows** of production data between them — and none
of those rows is a booking, a payment or a customer. Three more were planned and reversed once
the code was measured (§3); three are deferred to their own designs.

## The rental spine that remains

What a rental-only product actually needs, and nothing else:

```
auth        Users · ProviderMemberships · Verifications · TrustedDevices
provider    Providers · SellerProfiles · PayoutContracts · Contacts · FulfillmentLocations
inventory   ProviderResources · ResourceCategories · PricingPolicies
equipment   AttributeDefinitions · AttributeAllowedValues · ResourceAttributeValues   [frozen]
catalog     Offers · OfferAvailabilitySettings · OfferVisibilities · OfferInclusions · Cities
booking     Bookings · ProviderFulfillmentRecords · CustomerReviews
payments    Invoices · InvoiceLines · PaymentIntents · PayoutExecutions · TBank bindings
```

One offer type, one supply shape, one fulfillment flow: **list a bike, book it, hand it over,
take it back, get paid.**

## Sequencing

1. **Delete the duplicate category tree.** Zero consumers; safe first step that proves the process.
2. **Drop `TestEntities` and the `operations` schema.** Largest surface reduction, no dependants outside its own admin endpoints.
3. ~~Retire `SettlementPlan`, `LedgerRepairRecords`, `ReconciliationIncidentRecords`.~~ **Partly reversed** — see §3. `SettlementPlan` and reconciliation are the live payout path and its safety net and stay; `LedgerRepairRecords` was removed on 2026-09-26.
4. **Remove `ProviderTariffs` and `ProviderStorefrontConfigurations`.**
5. ~~Park the slot path.~~ **Deferred, by measurement** — see the decision under §5. It is inert with no Experience or Service offers live, and moving ~25 files buys nothing rental needs.
6. **Replace `ProviderOnboardingApplication`** per the onboarding redesign.
7. **Freeze the attribute system** — a written rule, not a code change.

Steps 1–4 are pure deletion with no behavioural change and can ship in a day. Step 5 is the only
one that touches live paths.

## Open decisions

1. Is `ActivityDomain` a facet of `ResourceCategory` or an independent axis? Decide before
   either grows.
2. Do reviews stay in the rental MVP? `CustomerReviews` is empty and reviews need liquidity to
   mean anything — but they are also how a marketplace earns trust, so this is a product call
   rather than a cleanup one.
3. Does the storefront survive? `ProviderStorefrontConfigurations` goes, but
   `ProviderStorefront*` endpoints and the widget exist — are per-provider storefronts part of
   rental-first, or do they wait?
4. Is `TrustedDevices` / passcode sign-in needed for rental launch, or is phone OTP enough on
   its own for now?

## Related

- [three-directions.strategy.md](three-directions.strategy.md) — why rental first
- fulfillment-dimensions.design.md (the deleted fulfillment-dimensions design, removed 2026-09-30) — the slot path, for when tours arrive
- [seller-onboarding-redesign.design.md](seller-onboarding-redesign.design.md) — replaces the onboarding table
- database-model.md (the deleted database-model analysis, removed 2026-09-30) — current schema, and the index gaps to fix alongside

## What it came to

Written 2026-09-30, after the branch landed on production. The plan above was a list of things to
delete; the result went further, because each deletion exposed the next.

**The catalogue became one table.** `ProviderResource`, `ResourceVariant`, `Offer` and
`BookingSubject` collapsed into `Product`. A booking points straight at a product. This was not in the
plan above — the plan still assumed the offer/resource split — and it is the change everything else
hangs off.

**Provider became seller,** in the code, the schemas, the routes and the console. The old
`provider` schema is gone.

**Removed outright:** variants and any computed variant axis; per-offer availability windows, blocked
periods and slot intervals; every ru/en translation table and its seeders; `EquipmentBrand`;
`ActivityDomain` translations; `SelfEmployedLegalIdentity` as a table per type; `ProviderTariff`;
`deduction_records`; `ProductMeetupLocation`; product readiness endpoints; and `updated_at` from
21 tables where nothing read it.

**Replaced rather than deleted:** variants became a **group name** a seller types, with the oldest
card as the face of the group. Categories became a **tree** with inherited attributes and activities.
Attributes, allowed values, cancellation tiers and a pickup point's schedule became `jsonb`. Cities
became **curated**, with an operator typing an address and the city derived from the registry.
A product **names its pickup point**.

**The open questions above, answered:**

1. `ActivityDomain` is an independent axis, and activities now live on the category as a `jsonb` list
   inherited down the tree. A filter by activity resolves to a set of category ids.
2. Reviews stayed, simplified: a review is published on arrival. No status, no publish step, no
   seller id — it is reached through the product.
3. Storefronts stayed.
4. Trusted devices and passcode sign-in stayed.

**What the work cost, and the lesson worth keeping:** seven production deploys, five of which failed,
each on a single hand-written identifier that did not exist — because renaming a table does not rename
its constraints or its indexes, and nothing local catches it. The tests run on the in-memory provider,
which ignores migrations, foreign keys and index names entirely. Resolve every name against the live
schema before writing migration SQL, and dry-run any `UPDATE` as a `SELECT` first.

The same class of mistake was hiding in the code, not just the migrations: after the collapse, a
satellite row's own `Id` stopped being the product id, but fourteen queries kept filtering on it. The
price never resolved on a card or at checkout, photos were never listed back, and the price upsert
added a duplicate policy on every save. Nothing threw — nothing was found. See
[ARCHITECTURE.md](ARCHITECTURE.md).
