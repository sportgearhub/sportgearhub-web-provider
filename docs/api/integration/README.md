# Integration guides

One guide per web app. Written for the developers building them.

| Guide | App | Surface |
|---|---|---|
| [`app.md`](app.md) | `sportgearhub-web-app`, `sportgearhub-storefront-web` | Auth, catalogue, checkout, a customer's bookings |
| [`seller.md`](seller.md) | `sportgearhub-web-provider` | Auth, onboarding, products, bookings, team, payouts |
| [`admin.md`](admin.md) | `sportgearhub-web-admin` | The two review queues, catalogue schema, payments, payouts |

## Why these exist next to the OpenAPI documents

`../openapi/*.json` is generated from the code. It is mechanically accurate about every path, field
and status code, and it is silent on everything that decides whether your screen works:

- which call comes first, and what the second one needs from the first;
- what a value **means** — `confirm` moving a booking to `pending` rather than `confirmed`;
- when a field turns read-only, and what a status permits;
- what to do when a call fails, as opposed to what the failure is called;
- the bodies a generator cannot express — a shape that depends on a discriminator, an RSQL
  `filter` string, a flat attribute map, a multipart upload.

A generator cannot know any of that, so the guides carry it. Where the two disagree, the spec is
right about shapes and the guide is right about rules; a rule the API does not honour is a bug worth
reporting.

## What stays out

A field-by-field restatement of a body the generator already describes correctly, and lists of
routes. Three hand-written endpoint references were deleted on 2026-09-30 for having drifted into
describing routes that no longer existed — that is what a catalogue of signatures in Markdown turns
into. Prose about a decision does not rot the same way a copied signature does.

## Alongside

- [`../errors.md`](../errors.md) — every error code, status and cause. Generated from
  `ApiErrorCodes`, and a test fails when it drifts.
- [`../openapi/`](../openapi/) — the generated contract, one document per surface.
  [`../openapi/README.md`](../openapi/README.md) has the regeneration command.

## Keeping them true

Change an endpoint, and update its guide in the same commit — the same rule as regenerating the
specs. `AGENTS.md` says what belongs in a guide and what does not.
