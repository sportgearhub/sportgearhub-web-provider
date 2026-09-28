# Rental Availability — Season, Hours, Inventory (DESIGN NOTE)

> **Removed 2026-09-25.** Offer availability — timezone, windows, blocked periods and the slot
> interval — is gone. A rental is bookable on capacity alone; the seller pauses an offer instead
> of describing a season, and a slot-based offer still needs open resource slots. Kept as the
> record of what the model was, and of the one thing a pause cannot replace: daily opening hours,
> which belong to the пункт проката rather than to each offer.

> Status: **recommendation, nothing changed.** **Partly superseded on branch `rental-first-simplification` (2026-09-23):** `OfferVisibility` was removed. The season is the availability windows' own `StartsOn`/`EndsOn` — the two copies had already drifted apart in production — and a seller pause is `OfferStatus.Paused`. The day-of-week gap and `IsOpenAt` below still stand. Written 2026-09-22 in answer to "should a rental
> offer get another table for its schedule — the period it shows up, and the days/hours it can be
> taken?" Grounded in the entities as they are, because the last time a table was proposed without
> reading its neighbours it turned out to already exist twice.

## Short answer

**No new table.** Both halves already exist, split across two 1:1 rows on `Offer`:

| You asked for | Where it already lives |
|---|---|
| "show up from 1 June to 1 August" — the **listing season** | `OfferVisibility.VisibleFrom` / `VisibleUntil` (`DateOnly?`) |
| "when they can take it" — **operating hours** | `OfferAvailabilitySettings.AvailabilityWindows` — a list of `(StartsOn, EndsOn, DailyOpensAt, DailyClosesAt)` |
| blackout dates | `OfferAvailabilitySettings.BlockedPeriods` — `(StartsOn, EndsOn, ReasonCode)` |
| timezone, slot granularity | `OfferAvailabilitySettings.Timezone`, `SlotIntervalMinutes` |

Adding a schedule table now would be a third copy of the same concern. What is actually missing is
one field.

## The one real gap: day-of-week

A window is a **date range with the same hours every day of it**. "Saturday 10–18 but weekdays
17–20" has no honest representation — it can only be faked as many one-day windows.

Fix, additive and small:

```csharp
public sealed record OfferAvailabilityWindow(
    DateOnly StartsOn,
    DateOnly EndsOn,
    DaysOfWeek Days,          // new — flags enum; existing rows read as "every day"
    TimeOnly DailyOpensAt,
    TimeOnly DailyClosesAt);
```

`Days` defaults to all seven for existing data, so no backfill is needed and nothing that reads
windows today changes meaning. Two windows over the same dates with different `Days` express the
weekday/weekend split directly.

## The layering that good rental systems share

Availability is three questions, and they should stay three because different people change them
at different rates:

```
1. Is the offer listed at all?      season      OfferVisibility          marketing, per season
2. Can it be picked up / returned?  hours       OfferAvailabilitySettings ops, per week
3. Is a unit actually free?         inventory   ready units minus live bookings         per booking
```

`can_book(offer, from, to)` = listed **and** every pickup/return instant falls in an open window
and outside a blocked period **and** a unit is free for the interval. The model already has all
three layers; the temptation to merge them into one "schedule" table is what this note is
arguing against.

## The trade-off to decide deliberately: JSON columns

`AvailabilityWindows` and `BlockedPeriods` are stored as **JSON on one row**, not as child tables.

| | JSON on the row (today) | Child table `OfferAvailabilityRule` |
|---|---|---|
| Simplicity | one row, atomic, no joins | more tables, more code |
| "Which offers are open Saturday 14:00 in Ufa?" | **cannot be answered by the database** — load every candidate's JSON, evaluate in C# | an indexable query |
| Matters at | thousands of offers per city — the storefront search hot path | — |

For rental-first, city by city, that query *is* the product eventually. But at five offers it is
nothing, and rebuilding storage before it hurts is the same mistake in the other direction.

**Recommendation — keep JSON, isolate the evaluation.** Put every "is this offer open at this
instant?" decision behind one function (`OfferAvailability.IsOpenAt(settings, instant)`) with
one set of tests, the way offer visibility is meant to be one predicate. Then moving the storage
to a child table later is one file, and today's callers never learn it happened. What must not
happen is the evaluation being re-spelled in checkout, readiness, the storefront and the console
separately — that is the 22-site visibility problem, one layer down.

## Smaller things, for when the file is open anyway

- `OfferVisibility.VisibilityMode` and both tables' `Status` are **magic strings**, unlike the rest
  of the model, which uses typed enums with storage-value extensions. Convert when touched.
- `OfferAvailabilitySettings` and `OfferVisibility` each carry their own `Status` and `UpdatedAt`
  for the same offer. Defensible — season and hours are different owners — but worth knowing they
  can disagree.
- `SlotIntervalMinutes` is a slot-path concept (experience/training). For rental it is inert;
  leave it, per the slot-path deferral.

## What to do now

1. Add `Days` to `OfferAvailabilityWindow`, defaulting to every day. Additive, no migration of
   meaning.
2. Extract `IsOpenAt` as the single evaluation point and give it the tests.
3. Nothing else. Revisit the JSON column when a city search is slow, not before.
