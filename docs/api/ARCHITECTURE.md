# Sportgearhub Architecture

Sportgearhub rents sports equipment. A seller lists what they have, a customer books it for a
period and collects it from a pickup point. The platform runs discovery, booking, payment and
payouts.

Rewritten 2026-09-30, after the rental-first simplification collapsed the catalogue into one
entity. The previous version described `ProviderResource` → `ResourceVariant` → `Offer` →
`BookingSubject`; none of those exist any more, and the invariants it defended are the opposite of
the ones below.

## The one thing to understand

**`Product` is the whole catalogue unit.** It is what a seller creates, what a customer sees, what
gets booked, and what carries the stock. There is no separate operational root, commercial unit or
booking identity — a rental has no need of three, and maintaining the distinction cost more than it
ever explained.

```
Seller → Product → Booking
```

A product names its pickup point, its category and its seller. Everything else about it hangs off it
by `ProductId`.

| Table | Holds |
|---|---|
| `Product` | title, description, status, quantity, group name, attributes, category, pickup point |
| `PricingPolicy` | one per product: the mode, the base amount or the tiers, and the derived `DisplayPrice` |
| `ProductPolicy` | one per product: lead time, deposit, cancellation tiers |
| `ProductImage`, `ProductInclusion`, `ProductReview` | many per product |
| `Booking` | who booked which product, for when, how many, and what it cost |

**Satellites are found by `ProductId`, never by their own `Id`.** Before the collapse those were the
same value, and code that queried a satellite by its own key worked by accident. They are different
values now: `Id` is the row's own key, `ProductId` is the link. Getting this wrong is silent — the
row is simply not found — and it has already cost the price on every card, the photos on every
product, and the policy at checkout.

## Grouping, not variants

A seller who has the same bike in three sizes types the same **group name** on all three. The oldest
card is the face of the group on the storefront; the rest are offered as options inside it. Each
remains a separate product with its own stock, price and photos.

There is no variant axis and nothing is computed from the attributes. A size is not special; it is an
attribute like any other. The platform never decides that «L» and «M» are two points on a scale.

## Categories

`ProductCategory` is a tree (`ParentId`) with a `Slug` for integration and a Russian `Name` for
display. Attributes and activities are inherited down the tree and resolved in memory
(`CategoryAttributeResolver`, `CategoryActivityResolver`) — the tree is small and bounded, so
walking it costs nothing.

**If a customer chooses it before opening the card, it is a category, not an attribute.** An e-bike
is its own category, not a bike with a motor attribute. See
[catalog-categories.md](catalog-categories.md) for the tree itself.

Activities (`туризм`, `зима`, …) are the second axis the tree cannot express: a tent, a rod, skis and
a SUP board are four branches and one activity. A filter by activity resolves to a set of category
ids, so the products query stays one indexed `category_id IN (…)`.

## Where things live

Attributes and their allowed values are `jsonb`, as are cancellation tiers and a pickup point's
schedule. They are read whole with their owner and never queried on their own. They stay typed
classes in C#; only the storage is JSON — see the rule in [CLAUDE.md](../CLAUDE.md).

Filtering reads a product's own attribute values, never the definition's options.

## Pickup points and cities

`FulfillmentLocation` is a pickup point: a city, an address, a required ФИАС id from the address
registry, and optionally a map pin an operator can correct. Cities are curated and seeded by hand;
an operator types an address and the city is derived from what the registry resolves, rather than
being picked from a list.

Working hours are **information for the customer**, not a booking constraint. A booking can start at
any time. A closed day blocks only collection and return — what happens mid-hire, with the equipment
already in the customer's hands, is nobody's problem (`BranchSchedule`).

There is no timezone anywhere. The interface knows the viewer's zone; the database stores instants.

## Sellers

`Seller` is the trading identity. `LegalIdentity` is one flat table with a `kind`
(`self_employed` / `sole_proprietor` / `company`) — no table per type. The API exposes a DTO per
kind, so a field that cannot apply to a kind is absent rather than null, with a hand-written
converter for the request side (`LegalIdentityRequestConverter`).

## The database is storage

Rules and validation live in the API service layer. The database holds no CHECK constraints
expressing business rules and no triggers. What it does hold is structural integrity: keys, foreign
keys, and unique indexes for things the code already assumes are unique.

A derived column is not logic: `PricingPolicy.DisplayPrice` is a function of three fields in its own
row, recomputed by the context on every save, and it exists because the storefront has to order by
price in SQL and the tiers it comes from are JSON the provider cannot see into.

## Surfaces

| Surface | Routes | Scope |
|---|---|---|
| App | `/api/v1/products`, `/discovery`, `/checkout`, `/bookings`, `/public`, `/media` | anonymous or customer |
| Seller console | `/api/v1/sellers/{sellerId}/…`, `/api/v1/seller-invitations` | `seller_api` |
| Internal | `/internal/…` | `internal_api` |
| Auth | `/api/v1/auth`, `/connect` | all three sign in the same way |

The seller is named in the path and the gate checks the caller's membership in it, or the platform
admin role; a person may belong to several sellers.

Wire format is **snake_case in both directions**. Case matching relaxes letter case only, not the
separator, so camelCase keys do not bind.

The generated contracts are in [api/openapi/](api/openapi/) — one document per surface, built by the
API itself. They are the contract reference; this file is only the shape behind them.

## Database schemas

`auth`, `booking`, `catalog`, `equipment`, `inventory`, `payments`, `seller` — all snake_case, via
`UseSnakeCaseNamingConvention()`. The convention rewrites explicitly-set `ToTable` names too, so
`ToTable("PricingPolicies")` in the model is `pricing_policies` in the database.

## Money

Booking, payment and ledger boundaries stay central. Ledger completeness is a hard invariant: no
successful financial side effect without a durable ledger fact. A payment hold precedes booking
confirmation. Reservation and release must be idempotent.

See [payments-and-payouts-context-map.design.md](payments-and-payouts-context-map.design.md) for
where the money logic lives and what is worth moving.

## What not to do

- Do not look up a product's satellite by the satellite's own `Id`
- Do not reintroduce a separate commercial and operational unit for a rental
- Do not compute a variant axis from attributes
- Do not put a business rule in the database
- Do not treat a pickup point's opening hours as a booking constraint
- Do not add a timezone
- Do not hand-maintain endpoint contracts in Markdown — regenerate the specs
