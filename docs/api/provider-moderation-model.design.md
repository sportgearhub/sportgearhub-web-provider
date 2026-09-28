# Provider Moderation Model — Register First, Publish After Review (PROPOSAL)

> **Partly superseded** by [seller-onboarding-redesign.design.md](seller-onboarding-redesign.design.md):
> the register-first, publish-after-review principle below stands, but `ProviderModerationState`
> is replaced there by a `manual_review_passed` fact feeding computed capabilities.
>
> Status: **proposed, not implemented.** Captured from the 2026-09-13 design discussion.
> No code or schema changes have been made. Reference model: WB Seller / Ozon Seller,
> where a seller works in the console from day one under a
> «Продажи приостановлены — магазин находится на модерации» banner.

## Problem

A provider cannot enter the platform at all until an admin approves them. Approval is not a
gate in front of publishing — it is the gate in front of *existing*.

The proof is in one method. `ProviderProfileService.ApproveOnboardingAsync` is where the
`Provider` row is first created, and `EnsureOwnerMembershipAsync` is called on the line below:

```csharp
// ProviderProfileService.cs:333-337 — inside the approve path
provider = CreateProviderFromApplication(application);
_dbContext.Providers.Add(provider);
AddProviderContact(provider.ProviderId, "email", application.ContactEmail);
AddProviderContact(provider.ProviderId, "phone", application.ContactPhone);
await EnsureOwnerMembershipAsync(provider.ProviderId, application.ApplicantUserId, cancellationToken);
```

No provider row → no membership → no `ProviderAccessContext` → no CRM. The applicant fills a
form and then waits, with nothing to do and nothing to look at. Every hour of review latency
is an hour the provider cannot spend building their catalogue, and the catalogue is the thing
we actually want from them.

And at the far end there is no brake at all: `CreateProviderFromApplication` leaves
`OperatingState` at its default `Active`, so the instant approval lands, everything the
provider does is publicly live.

## Core insight

One fact — *does a `Provider` row exist?* — is currently answering three unrelated questions:

| Question | Should be answered by | Today |
|---|---|---|
| May this person use the CRM? | membership | provider row exists |
| Is this business allowed to trade? | operating state | provider row exists |
| May customers see their offers? | moderation verdict | provider row exists |

All three flip at the same instant because they are the same bit. Splitting them is the whole
design; everything below follows from it.

## Proposed model

Two persisted axes, one computed.

### 1. `ProviderModerationState` (new)

The review verdict. Denormalised onto `Provider` for query speed; the
`ProviderOnboardingApplication` stays the case record with its existing
`ProviderOnboardingApplicationStatus`, review actor, reason code and timestamps.

| Value | Meaning |
|---|---|
| `Unsubmitted` | Row exists, CRM works, nothing submitted for review yet |
| `PendingReview` | Submitted, awaiting a verdict |
| `ChangesRequested` | Sent back with reasons; provider edits and resubmits |
| `Approved` | Publishable |
| `Rejected` | Terminal for this application |

Two fields, not one: the application status is the *case*, the provider state is the
*current answer*. A provider with three historical applications has one moderation state.

### 2. `ProviderOperatingState` (exists, keep)

`Active` / `Suspended` / `Archived`. Post-approval lifecycle — fraud hold, provider pausing
for the winter, wind-down. Orthogonal to moderation: a shop can be approved *and* suspended.
Do not overload it with moderation, or "never reviewed" and "banned for fraud" become the
same value.

### 3. Visibility — computed, never stored

```
visible(offer) ==
    offer.Status          == OfferStatus.Active
 && provider.Moderation   == ProviderModerationState.Approved
 && provider.Operating    == ProviderOperatingState.Active
```

Stored visibility is a cache that goes stale the moment a provider is suspended. Compute it.

## Offers keep their own lifecycle

The important consequence, and the one easiest to get wrong: **do not force offers to `Draft`
during moderation, and do not add a moderation value to `OfferStatus`.**

A provider under review sets offers to `Active` exactly as they would after approval. `Active`
means *the provider intends this to be live*. Whether a customer can see it is the predicate
above. On approval the whole staged catalogue goes live in one transition — nothing to
re-activate, no second round of provider work after the verdict.

This is precisely the WB/Ozon behaviour and the reason their sellers can be productive during
review. It also keeps `OfferStatus` about the offer instead of about the shop.

## What works before approval

| Capability | Before approval | Rationale |
|---|---|---|
| CRM sign-in, dashboard | ✅ | The point of the change |
| Resources, units, locations | ✅ | The work we want done early |
| Offers, pricing, policies, media | ✅ | Staged, not visible |
| Mark an offer `Active` | ✅ | Intent, not publication |
| Invite team members | ✅ | Invitee inherits the same gate |
| Onboarding application + docs | ✅ | This is what gets reviewed |
| T-Bank shop registration | ✅ | Part of the review checklist |
| Appear in catalogue / search / storefront | ❌ | Gated |
| Accept bookings or checkout | ❌ | Gated — see below |
| Receive payouts | ❌ | Requires approved requisites |

## The dangerous gap: checkout is a separate door

Catalogue filtering is not enough. `CheckoutBookingService.cs:88` gates on the offer alone:

```csharp
if (offer.Status != OfferStatus.Active)
```

A direct link to an offer id from an unmoderated shop would book and take money. The provider
predicate must be enforced at **every** boundary that resolves an offer for a customer, not
just the ones that list offers:

- `StorefrontCatalogService` (listing + slug lookup)
- `OfferQueryService` (single offer by id)
- `StorefrontCheckoutService`
- `CheckoutBookingService` (the commit)

Storefront slug lookup for an unapproved provider should answer **404, not 403** — a 403
confirms the shop exists and leaks the pipeline.

## Centralise the predicate before flipping the gate

**Status (branch `rental-first-simplification`): done.** The predicate is `PublicVisibility` in `Infrastructure/Offers`: offer `Active` ∧ provider `Active`, two terms, applied at every customer-facing read and at the checkout commit. The moderation term will be one more clause in that one place.

The visibility rule is currently spelled out by hand across the codebase:

```
provider.OperatingState == Active   →  7 sites
offer.Status == OfferStatus.Active  → 15 sites
```

Twenty-two places that must agree, in a rule that is about to gain a third term. Adding
moderation to twenty-two hand-written `.Where()` clauses guarantees one gets missed, and the
one that gets missed is a shop that publishes without review.

Extract one expression first — an EF-translatable predicate (`ProviderVisibility.IsPublic`)
plus a queryable extension used by every public read. That refactor changes no behaviour and
is verifiable on its own. Then the moderation term is **one line in one file**.

## Re-moderation

Changing what was reviewed should re-open review. Changing what was not should not.

| Change | Effect |
|---|---|
| INN / OGRN / legal form / legal name | Re-review |
| Bank requisites, payout contract | Re-review |
| New offers, prices, media, locations | No review |

Open question — **does re-review delist?** WB and Ozon keep the shop selling while a requisite
change is reviewed. Hard-gating means a typo in a bank account silently kills a live
catalogue. Recommendation: keep selling, flag the case, and let an admin suspend explicitly if
something is wrong. That is what `OperatingState.Suspended` is for, and it is why the two axes
are separate.

## Edge cases that bite

- **Bookings in flight when a shop is suspended.** Honour what is already paid for; block new
  checkouts. Visibility is a *listing* rule, not a retroactive cancellation.
- **Never-submitted providers.** `Unsubmitted` has no timer. Without a nudge and an expiry
  these accumulate as permanent half-shops.
- **Rejection.** Terminal for the application, not for the person. Decide whether a rejected
  applicant may open a new application, and whether there is a cooldown — otherwise rejection
  is a revolving door.
- **Approval must be an event, not a toggle.** Record who approved, when, against which
  application revision. A boolean cannot answer "why is this shop live?" six months later.
- **Team invitations sent before approval.** Fine, and useful — but the invitee lands in the
  same gated CRM, so the banner must be provider-scoped, not user-scoped.
- **Search index.** If offers are ever indexed out-of-band, approval must trigger a reindex;
  the predicate only protects live queries.

## Migration and rollout

Ordering matters — the centralisation step has to land before the gate moves, or the flip is
twenty-two edits instead of one.

1. **Add the axis.** `ProviderModerationState` column + enum, backfill **every existing
   provider to `Approved`**. No behaviour change: they were all live already.
2. **Centralise visibility.** Replace the 22 hand-written filters with one predicate. Pure
   refactor, no behaviour change, independently testable.
3. **Add the moderation term** to that one predicate. Still no behaviour change — everyone is
   `Approved`.
4. **Move creation to registration.** `CreateProviderFromApplication` +
   `EnsureOwnerMembershipAsync` move out of the approve path into registration; new providers
   start `Unsubmitted`. Approval becomes a state transition instead of a constructor. This is
   the step that changes behaviour, and by now it is the only one.
5. **CRM affordances.** Provider-scoped banner, and blocked actions that explain themselves
   rather than failing — a disabled "Publish" that says why beats a 403.
6. **Re-moderation triggers** on legal and settlement changes.

Steps 1–3 are shippable with no user-visible change, which means the risky step ships alone.

## Open decisions

1. Does a requisites change delist, or keep selling and flag? (Recommendation: keep selling.)
2. Auto-approve returning providers who already passed review under another legal entity?
3. Shop-level moderation only, or item-level later? The predicate has room for an offer-level
   term; the state machine does not need one yet.
4. Cooldown after rejection, and who can lift it?
5. Should `Unsubmitted` expire, and after how long?
