# Provider Onboarding — API Design

> Status: **built in stages on `rental-first-simplification`.** Done: `snake_case` database,
> `ProviderStatus` + `provider_reviews` + the `seller_profiles` hierarchy + `seller_agreements`,
> `POST /providers`, seller profile, readiness, submit, admin review queue/actions/history, the
> T-Bank re-point, path-scoped console routes (`/api/v1/providers/{providerId}/…`, membership
> checked in the gate), `/auth/me` as the console bootstrap (`providers[]` with kind/status/role
> and `pending_invitations[]`; `/auth/provider-memberships` is gone). Still to come:
> `provider_payout_details` replacing the payout-contract tables (readiness reads the old tables
> until then). Every JSON key is `snake_case`. `provider` stays the noun.
>
> Read the endpoint table below with `/api/v1/provider/` → `/api/v1/providers/{providerId}/`.
> Public provider reviews moved out of the console prefix to
> `/api/v1/public/providers/{providerId}/reviews`.
>
> The seller-profile response is a single shape switched on `kind` — `person` for a самозанятый,
> `business` for ИП and organisations (director included), `company` (just the КПП) on top for
> organisations — rather than polymorphic types. A client still gets only the sections that exist.

## The shape in one paragraph

A seller presses "start selling" and a `Provider` exists immediately, as a draft. From then on
the console is a set of **sections** the seller fills in any order — profile, seller (legal)
profile, payout — and one **readiness** call that says what is still missing and whether the
provider may submit for review. Submitting moves the provider's **one status** forward and opens
a **review record**; an admin's verdict closes the record and moves the status again. What
customers can see is `status == active` and nothing else. There is no application object, no
copy step, no second state machine, and **no new columns on `Provider`**.

## Data model

**Decision — `snake_case` in the database, project-wide.** `EFCore.NamingConventions`
(`UseSnakeCaseNamingConvention()`) applied to the whole model in one rename migration at the
start of this build, so the new tables are born `snake_case` and the old ones catch up. C#
stays PascalCase; Postgres identifiers stop needing quotes.

### `Provider` — what changes

| Column | Change | Why |
|---|---|---|
| `OperatingState` → `Status` | **extend, not add** — `draft · pending_review · changes_requested · rejected · active · suspended · archived` | one lifecycle; `active` means reviewed and trading. The three existing values keep their storage strings, so no row changes. |
| `CreatedFromOnboardingApplicationId` | **drop** | the application is gone |
| `LegalName`, `LegalCountryCode`, `LegalForm`, `TaxationSystem`, `TaxNumber`, `RegistrationNumber`, `BranchNumber` | **drop** → `SellerProfile` | the legal party is not the storefront |
| `AcquiringProvider`, `PayoutSchedule` | **drop** | read by nothing outside the onboarding service; T-Bank is the only acquirer and the connection row already names it |

Keeps: `ProviderId`, `DisplayName`, `Description`, `Address`, `Slug`.

### `provider_reviews` — new, append-only, one row per review cycle

```
provider.provider_reviews   id · provider_id · opened_at · decided_at? · decided_by_user_id? · verdict? · message?
                            verdict: approved · changes_requested · rejected
```

A seller's submit **opens** a row; an admin's verdict **closes** it. An admin asking an already
active provider for changes opens and closes one in the same step. The seller's console shows the
latest row (its message is "why"); the admin console shows the whole history. Current state is
never derived from this table — it is read from `Provider.Status`, which every catalog query
already filters on. This is the shape Shopify and Airbnb use: state on the entity, decisions in
a log.

### `seller_profiles` — new, table-per-type, one profile per provider, for good

```
provider.seller_profiles                 id · provider_id (unique) · kind · inn (unique) · created_at · updated_at
├─ self_employed_seller_profiles         last_name · first_name · middle_name?      — the tax record's name, prefilled from the account
└─ business_seller_profiles              legal_name · registration_number (ОГРН/ОГРНИП) · legal_address · taxation_system · vat_rate
                                         kpp? · director_last_name · director_first_name · director_middle_name? · director_position
```

Two concrete types, three tables. ИП and organisations share one table: the only differences are
that an ИП has no КПП (nullable) and its "director" is the entrepreneur — which is exactly what
the registry returns as `fio`. `kind` is stored (`self_employed · sole_proprietor · company`) and
the T-Bank code asks `profile is BusinessSellerProfile`.

**Decision — kind and ИНН are immutable (the Ozon rule).** `PUT …/seller-profile` changes only
what the seller decides: taxation system and VAT rate, or a самозанятый's name. A different
kind or ИНН is `409 seller.kind_immutable` / `seller.inn_immutable`, and the answer is "create
another provider". So there is no versioning, no `replaced_at`, and the agreement always points at
the one profile.

**Decision — `ProviderLegalForm` is renamed `SellerKind`** (`self_employed · sole_proprietor ·
company`) and becomes the JSON discriminator. Same three values, honest name.

### Removed

`ProviderOnboardingApplications` (38 columns) and `ProviderOnboardingApplicationStatus` (7 values);
`ProviderPayoutSchedule`; `ProviderOperatingState` (absorbed into `ProviderStatus`);
`ProviderPayoutContract` + its SBP / bank-requisite children (split into `seller_agreements` and
`provider_payout_details`, see the agreement design). The go-live "hold" layer, which stored
nothing and returned constants.

## States

```
draft ──submit──▶ pending_review ──approve──▶ active ◀──activate/suspend──▶ suspended ──archive──▶ archived
  ▲                    │  │                      │
  │                    │  └──request_changes──▶ changes_requested ──submit──▶ pending_review
  │                    │                         ▲
  │                    │                         └──request_changes (re-moderation, admin)──── active
  └──reopen (admin)────┴──reject──▶ rejected
```

| Transition | Who | Writes |
|---|---|---|
| `submit` | seller, from `draft` or `changes_requested`, only when `can_submit` | opens a review row |
| `approve` · `request_changes` · `reject` | admin, from `pending_review` | closes the open row with the verdict |
| `request_changes` | admin, from `active` (re-moderation after e.g. a legal change) | opens **and** closes a row; the provider leaves the storefront until re-approved |
| `reopen` | admin, from `rejected` → `draft` | nothing |
| `suspend` · `activate` · `archive` | admin, `active ↔ suspended → archived` | nothing (operating lever, not a review) |

- A seller edits anything in any state. Editing after approval does **not** reopen review by
  itself; admins decide (suspend, or request changes).

### Predicates — computed, never stored

```
is_public(p)     = p.status == active                                        ← PublicVisibility.IsProviderPublic
can_submit(p)    = profile_complete && seller_profile_exists && p.status in {draft, changes_requested}
profile_complete = display_name && description
payout_ready(p)  = self-employed: SBP payout row with phone + bank
                   business:      bank requisites row with account + БИК
can_be_paid(p)   = is_public(p) && payout registered with the bank (SBP recipient active / T-Bank shop has a code)
```

`payout_ready` is shown in readiness but **does not block review** — a reviewer judges the
business, and bank registration is a separate admin-driven step that already exists.

## Endpoints

### Seller side

| Method · route | Body → Response | Notes |
|---|---|---|
| `POST /api/v1/providers` | `{display_name}` → `201 ProviderProfile` | any signed-in user; creates `Provider(draft)` + Owner membership. **Decision:** `409 provider.already_owned` if the user already has a membership — the console has no provider switcher (it resolves "the" provider only when there is exactly one). |
| `GET /api/v1/provider/profile` | → `ProviderProfile` | |
| `PATCH /api/v1/provider/profile` | `{display_name?, description?, address?, slug?, contact_email?, contact_phone?}` → `ProviderProfile` | trimmed to identity fields |
| `GET /api/v1/provider/seller-profile` | → `SellerProfile` \| `404` | |
| `PUT /api/v1/provider/seller-profile` | `{kind, inn, taxation_system?, vat_rate?, person?}` → `SellerProfile` | after creation only taxation system, VAT rate and a самозанятый's name may change; `kind`/`inn` must equal the stored ones (`409 seller.kind_immutable` / `seller.inn_immutable`). Registry facts come in at creation (`POST /providers`): `seller.inn_invalid`, `seller.legal_identity_not_found`, `seller.kind_mismatch`, `seller.inn_already_used`. |
| `GET /api/v1/provider/seller-profile/lookup?inn=` | → `SellerProfile` preview | Dadata, for showing the name before saving (moved from `/provider-onboarding/legal-identity/ru/lookup`) |
| `GET /api/v1/provider/payout` | → `PayoutDetails` \| `404` | |
| `PUT /api/v1/provider/payout` | `{method: "sbp", phone, sbp_member_id, bank_name}` or `{method: "bank_account", account, bik, bank_name, correspondent_account?}` → `PayoutDetails` | `method` must match the seller kind (`payout.method_not_allowed_for_kind`); writes `provider_payout_details` and, for a business, the T-Bank shop draft |
| `GET /api/v1/provider/agreement` | → `{number, accepted_at, status}` | the «Договор № … от …» card; created by the guided flow's «Готово». The text is a link to the docs site; editions are the docs' change log, nothing is stored about them. |
| `GET /api/v1/provider/readiness` | → `Readiness` | replaces `/provider/operating-state` |
| `POST /api/v1/provider/submit-for-review` | → `Readiness` | `409 provider.not_ready` with the readiness body; `409 provider.review_not_open` outside `draft/changes_requested` |
| `GET /api/v1/provider/dashboard` | → dashboard | embeds `readiness` instead of `operating_state` |

### Admin side

| Method · route | Body → Response |
|---|---|
| `GET /internal/providers/review-queue?status=pending_review` | `{provider_id, display_name, kind, inn, legal_name, opened_at}` per provider — default `pending_review`; also `changes_requested`, `rejected` |
| `GET /internal/providers/{id}/profile` · `/seller-profile` · `/readiness` | same contracts as the seller sees |
| `GET /internal/providers/{id}/reviews` | the full `ProviderReviews` history, newest first |
| `POST /internal/providers/{id}/actions` | `{action: "approve" \| "request_changes" \| "reject" \| "reopen" \| "suspend" \| "activate" \| "archive", message?}` → `ProviderProfile`. One transition table (above); `409 provider.transition_not_allowed` otherwise. |

Bank registration stays where it is: `/internal/providers/{id}/payout-contracts/…` and
`/internal/providers/{id}/t-bank/shop/…`.

### Removed (14)

`/api/v1/provider-onboarding/{current, current/submit, current/profile, options, legal-identity/ru/lookup}`,
`/api/v1/provider/operating-state`,
`/internal/provider-onboarding/{…, options, {id}, {id}/actions}`,
`/internal/providers/governance`, `/internal/providers/governance/options`,
`/internal/providers/{id}/go-live-readiness`, `/internal/providers/{id}/go-live/actions`,
`/internal/providers/{id}/operating-state` (GET — folded into readiness), `/internal/providers/{id}/governance/actions`.

## Contracts

```jsonc
// ProviderProfile
{
  "provider_id": "…", "display_name": "Прокат Солнечный", "description": "…", "address": "…", "slug": "sunny",
  "contact_email": "…", "contact_phone": "+7927…",
  "status": "changes_requested",
  "latest_review": { "opened_at": "…", "decided_at": "…", "verdict": "changes_requested", "message": "Укажите адрес точки выдачи" },
  "updated_at": "…"
}

// SellerProfile — discriminated on "kind"; a client gets only the fields that exist
{ "kind": "self_employed", "inn": "772…" }
{ "kind": "self_employed",   "inn": "772…", "person": { "last_name": "…", "first_name": "…", "middle_name": null } }
{ "kind": "sole_proprietor", "inn": "772…", "business": { "legal_name": "ИП Иванов И.И.", "registration_number": "3177…", "legal_address": "…",
                                                        "taxation_system": "usn", "vat_rate": "none", "director": { "last_name": "Иванов", "first_name": "Иван", "middle_name": null, "position": "Индивидуальный предприниматель" } } }
{ "kind": "company",         "inn": "7707083893", "business": { …, "director": { "position": "Генеральный директор", … } }, "company": { "kpp": "770701001" } }
// sections that do not apply are absent; a самозанятый is always without VAT, so `vat_rate` is not a field there

// Readiness
{
  "status": "draft",
  "can_submit": false,
  "is_public": false,
  "items": [
    { "key": "profile",        "status": "ready" },
    { "key": "seller_profile", "status": "missing" },
    { "key": "payout",         "status": "missing", "hint": "sbp" }      // hint = the method this kind must supply
  ]
}
```

## Migration — one forward migration, `ReplaceOnboardingWithSellerProfiles`

1. Rename `Providers.OperatingState` → `Status`. Storage strings are unchanged, so existing rows
   stay `active` — they were trading. No other change to the table's data.
2. Create `provider_reviews`, the three `seller_profiles` tables, `seller_agreements`, `provider_payout_details`; copy each `ProviderPayoutContract` into an agreement + payout-details pair, then drop the three old tables.
3. **Decision — no backfill.** Two providers exist and both are test data; their legal columns
   were never verified, and the model's promise is that nothing stored is unverified. They
   re-enter an ИНН. Their status stays `active`, so nothing disappears from the storefront.
4. Drop `ProviderOnboardingApplications` and the ten `Provider` columns.

## Code that goes / stays

| | |
|---|---|
| **Delete** | `ProviderOnboardingApplication`, its enum, 14 endpoints, ~1,100 of `ProviderProfileService`'s 1,557 lines, `ProviderOnboardingModels`, `ProviderGoLiveModels`, `ProviderGovernanceModels`, `ProviderOnboardingFlowRegressionTests` (537 lines, tests the old flow), `ProviderOnboardingAdminEndpointTests`, `ProviderGovernanceAdminEndpointTests` |
| **New** | `SellerProfile` hierarchy + `SellerKind`; `ProviderReview` + `ProviderStatus` (extends the old operating-state enum); `SellerAgreement` + `AgreementEdition` + `ProviderPayoutDetails`; `ProviderReadiness` (static predicates, like `PublicVisibility`); `SellerProfileService`; slimmed `ProviderProfileService`; 13 endpoints; one integration test that drives create → seller profile → payout → submit → review → public |
| **Re-pointed, not rewritten** | `ProviderAcquiringConnectionService` (2,000 lines): its 24 reads of `provider.Legal*` become reads of the seller profile; its flows are untouched |
| **Trimmed** | storefront public profile drops the legal fields (a storefront shows a name, not an ОГРН) |

## What this does not do (yet)

- **NPD status** of a самозанятый is not verified — Dadata has no registry for it; the ИНН is
  checksum-validated only. ФНС has a public NPD check that can be added behind the same `PUT`.
- **Multiple providers per user** — blocked at `POST /providers` until the console has a switcher.
- **Re-review after a legal change** — not triggered automatically; an admin uses
  `request_changes` on an active provider.

## Questions for you

1. One provider per user for now — agree?
2. Payout details typed by the seller in the console (`PUT /provider/payout`), bank registration
   still run by an admin — agree, or should registration be automatic on save?
3. Anything you want in the review queue beyond name, kind, ИНН, legal name, submitted-at?
