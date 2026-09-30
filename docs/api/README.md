# Sportgearhub API Docs

## Start here

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — the domain model, what `Product` is, and the rules worth
  not breaking
- [`api/openapi/`](api/openapi/) — the **API contract**: three generated documents, one per surface,
  plus how to regenerate them
- [`api/errors.md`](api/errors.md) — every error code a client can receive, with its message. Branch
  on `code`, not on the text. Generated from the source and guarded by a test
- [`catalog-categories.md`](catalog-categories.md) — what the platform rents: the category tree,
  its slugs, and what is deliberately absent

The three hand-written endpoint references (`app-api.md`, `provider-api.md`, `admin-api.md`) were
deleted on 2026-09-30. They described routes that had been renamed underneath them, and the generated
specs cover the same ground without drifting. `database-model.md` went the same way: its figures were
measured against a schema that no longer exists.

## Flows

- [`flows/sign-in-seller-onboarding.md`](flows/sign-in-seller-onboarding.md) — auth and seller
  onboarding diagrams

## Design records

Dated records of decisions and what they cost. A design doc is history, not a plan — where one
disagrees with the code, the code is right.

- [`rental-first-simplification.design.md`](rental-first-simplification.design.md) — the collapse of
  the catalogue into `Product`, and everything removed with it
- [`addresses-and-cities.design.md`](addresses-and-cities.design.md) — how a pickup point gets an
  address, and where cities come from
- [`seller-onboarding-redesign.design.md`](seller-onboarding-redesign.design.md) — registering a
  seller, and what makes one publishable
- [`seller-agreement.design.md`](seller-agreement.design.md) — the agreement, its number, and when it
  takes effect
- [`admin-onboarding-and-payouts.design.md`](admin-onboarding-and-payouts.design.md) — the platform
  side of onboarding, and how a seller becomes payable
- [`two-ways-in-auth.design.md`](two-ways-in-auth.design.md) — the phone and the email both sign in
- [`phone-first-auth.design.md`](phone-first-auth.design.md) — when the phone was the only way in, and
  what that decision removed for good
- [`payments-and-payouts-context-map.design.md`](payments-and-payouts-context-map.design.md) — where
  the money logic lives and what is worth moving
- [`payout-destination-and-payment-events.design.md`](payout-destination-and-payment-events.design.md) —
  the destination tables, and taking booking writes out of the gateway

## Strategy

- [`three-systems.design.md`](three-systems.design.md) — rental as the product, experience later,
  payments as their own gateway
- [`three-directions.strategy.md`](three-directions.strategy.md) — the three directions the platform
  could take
- [`payment-gateway.strategy.md`](payment-gateway.strategy.md) — could payments stand alone

## Analysis

- [`trusted-devices.analysis.md`](trusted-devices.analysis.md) — what a trusted device buys

## Integrations

- [`integrations/t-bank-acquiring/`](integrations/t-bank-acquiring/) — T-Bank acquiring contracts and
  reference

## Migrations

Build first — `dotnet ef` against a stale assembly has deleted an applied migration before.

```bash
dotnet build --nologo -v q

dotnet ef migrations add MigrationName \
  --project src/EbashIT.Sportgearhub.Database.Postgresql \
  --startup-project src/EbashIT.Sportgearhub.Api \
  --no-build
```

Then **read the generated `Up()`**, and check every name it mentions against the live schema before
committing. Renaming a table does not rename its constraints or its indexes, so a name taken from the
model is not the name in the database — that mistake cost five consecutive failed deploys on
2026-09-30. Dry-run any `UPDATE` as a `SELECT`, or inside a transaction you roll back.

Migrations are applied by the API on startup, so a broken one takes the container down rather than
failing a build.
