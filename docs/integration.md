# Sportgearhub Web Provider Console API Integration

This is the provider-console integration contract for `sportgearhub-web-provider-console`.

**The generated spec wins over this file.** `docs/api-swagger.json` is the provider document exported from
the running API (`/swagger/provider/swagger.json`); everything below is intent and background, and parts of it
predate the current surface. Where they disagree, follow the spec.

Copies of the API repo docs, fetched from `sportgearhub-api/docs`:

- `docs/api/provider-api.md` — the route index the API team maintains
- `docs/api/sign-in-provider-onboarding.md` — sign-in and onboarding flow
- `docs/api/offer-fulfillment-model.design.md` — offer/fulfillment model
- `docs/api/billing-and-payout-model.design.md` — billing and payout model
- `docs/provider-console-api-surface.v1.md` — original surface design (kept for product intent)

### Surface Changes This File Predates

- **Variants are gone.** No `/resources/{id}/variants*`. Inventory is `/resources/{id}/units`, and
  allocation moved to `/resources/{id}/allocation`.
- **No resource availability calendar.** `/resources/{id}/availability-calendar` does not exist; schedule is
  offer-level (`/offers/{id}/availability`, with `availability_windows` and `blocked_periods`) plus
  `/resources/{id}/slots` for slot-based capacity.
- **No resource-level pricing or policy write.** Both are offer-level
  (`/offers/{id}/pricing-policy`, `/offers/{id}/policy`); the resource exposes read-only
  `*-diagnostics` endpoints only.
- **Rent duration left availability.** `min_rent_hours`/`max_rent_hours` are gone. Offer availability
  carries `slot_interval_minutes`; session length is the offer's own `duration_hours`, and rental
  pricing bands live in the pricing policy's `rental_tiers`.

## Wire Format

Request and response bodies are **snake_case** in both directions (`{"city_id": "...", "access_token": "..."}`).
Case matching relaxes letter case only, not the separator, so camelCase keys do not bind. This app converts
once at the HTTP boundary in `src/lib/case-convert.ts` and stays camelCase internally; the fields listed in
`DATA_KEYED_MAP_FIELDS` there hold maps keyed by data (locale codes, attribute keys) and are passed through
untouched. That list is matched against the value too: `attributes` is a data-keyed map when written
(`{"frame_size": "M"}`) but a contract-shaped array when read (the category attribute schema), and arrays are
always converted.

## Core Rules

- `ProviderResource` is the provider-owned operational root.
- `Offer` is commercial packaging and discovery, not execution truth.
- Inventory units are the operational truth for physical equipment rental.
- Availability, pricing, and policy are resource-first setup modules.
- Offer activation is not the same as runtime booking readiness.
- Routability is diagnostics, not booking-time availability truth.
- The provider console must not call internal/admin API routes.

## Environment And Auth

Configure per environment:

- API authority
- web origin
- OIDC client id: `sportgearhub-provider`
- callback route: `/auth/callback`
- scopes: `openid profile email offline_access roles provider_api`

Provider API calls may use either:

- cookie session calls with `credentials: "include"`
- bearer calls with `Authorization: Bearer <access_token>`

New web code must use `/api/v1/*` routes. Do not add new calls to legacy `/api/auth/*`, `/api/development/*`, or `/api/provider-console/*` aliases.

## Route Index

### Platform

```http
GET /health
GET /swagger
GET /api/v1/catalog/cities
GET /api/v1/addresses/ru/suggestions
POST /api/v1/addresses/ru/geolocate
GET /api/v1/payment-reference/sbp-members
```

### Auth

There are no passwords. A session starts from a one-time code mailed to the address, or from a
passcode on a device the user has already trusted.

```http
POST /api/v1/auth/email/start            # { email, app, delivery_mode: "code" }
POST /api/v1/auth/email/verify-code      # { email, code } -> tokens | registration_required
POST /api/v1/auth/email/complete-registration
GET  /api/v1/auth/registration-invitations/{token}
POST /api/v1/auth/register
POST /api/v1/auth/magic-sign-in
POST /api/v1/auth/session-login
POST /api/v1/auth/login                  # authorization_code / refresh_token only
GET  /api/v1/auth/me
GET  /api/v1/auth/provider-memberships
POST /api/v1/auth/signout
POST /api/v1/auth/email/verify
POST /api/v1/auth/email/verification
GET  /api/v1/development/emails
GET  /connect/authorize
POST /connect/token
GET  /connect/userinfo
```

### Passcode (trusted device)

```http
GET    /api/v1/auth/passcode/policy      # { length, max_attempts, max_devices_per_user }
POST   /api/v1/auth/devices              # { client_id, platform, name, passcode } -> { device_id, device_secret }
GET    /api/v1/auth/devices
POST   /api/v1/auth/devices/passcode     # { device_id, device_secret, current_passcode, new_passcode }
DELETE /api/v1/auth/devices/{deviceId}
POST   /api/v1/auth/passcode/sign-in     # { device_id, device_secret, passcode, client_id } -> tokens
```

`device_secret` is 256 bits returned **once** at enrolment; store it in this browser and never send it
anywhere but `/auth/passcode/sign-in` and `/auth/devices/passcode`. The sign-in request deliberately
carries no email or user id — the account comes from the device row, which is what stops a short passcode
from being sprayed at a leaked address list. Five wrong passcodes revoke the device permanently (never
the account); on `auth.device_not_trusted` or `auth.passcode_locked`, drop the local secret and fall back
to an emailed code. Never validate the passcode client-side — that hands back the attempt counter.

### Provider Onboarding

```http
GET   /api/v1/provider-onboarding/options
GET   /api/v1/provider-onboarding/current
POST  /api/v1/provider-onboarding/current
PATCH /api/v1/provider-onboarding/current/profile
POST  /api/v1/provider-onboarding/current/submit
GET   /api/v1/provider-onboarding/banks/ru/lookup
```

### Provider Console

```http
GET   /api/v1/provider/activity-options
GET   /api/v1/provider/fulfillment-locations
POST  /api/v1/provider/fulfillment-locations
PATCH /api/v1/provider/fulfillment-locations/{fulfillmentLocationId}

GET    /api/v1/provider/resource-categories
GET    /api/v1/provider/resource-categories/{resourceType}/{categorySlug}/attributes
GET    /api/v1/provider/resources
POST   /api/v1/provider/resources
GET    /api/v1/provider/resources/{resourceId}
PATCH  /api/v1/provider/resources/{resourceId}
POST   /api/v1/provider/resources/{resourceId}/archive
DELETE /api/v1/provider/resources/{resourceId}
GET    /api/v1/provider/resources/{resourceId}/images
POST   /api/v1/provider/resources/{resourceId}/images

GET   /api/v1/provider/resources/{resourceId}/variants
POST  /api/v1/provider/resources/{resourceId}/variants
GET   /api/v1/provider/resources/{resourceId}/variants/{variantId}
PATCH /api/v1/provider/resources/{resourceId}/variants/{variantId}
POST  /api/v1/provider/resources/{resourceId}/variants/{variantId}/archive
GET   /api/v1/provider/resources/{resourceId}/variants/{variantId}/allocation
PUT   /api/v1/provider/resources/{resourceId}/variants/{variantId}/allocation
GET   /api/v1/provider/resources/{resourceId}/variants/{variantId}/diagnostics

GET   /api/v1/provider/resources/{resourceId}/inventory-summary
GET   /api/v1/provider/resources/{resourceId}/units
POST  /api/v1/provider/resources/{resourceId}/units
PATCH /api/v1/provider/resources/{resourceId}/units/{unitId}
POST  /api/v1/provider/resources/{resourceId}/units/{unitId}/archive

GET  /api/v1/provider/resources/{resourceId}/availability-profile
PUT  /api/v1/provider/resources/{resourceId}/availability-profile
GET  /api/v1/provider/resources/{resourceId}/availability-calendar
PUT  /api/v1/provider/resources/{resourceId}/availability-calendar
GET  /api/v1/provider/resources/{resourceId}/availability-diagnostics
GET  /api/v1/provider/resources/{resourceId}/slots
POST /api/v1/provider/resources/{resourceId}/slots
PATCH /api/v1/provider/resources/{resourceId}/slots/{slotId}
POST /api/v1/provider/resources/{resourceId}/slots/{slotId}/close

GET  /api/v1/provider/resources/{resourceId}/pricing-policy
PUT  /api/v1/provider/resources/{resourceId}/pricing-policy
GET  /api/v1/provider/resources/{resourceId}/pricing-diagnostics
POST /api/v1/provider/pricing/quote-preview

GET  /api/v1/provider/policy-profile
PUT  /api/v1/provider/policy-profile
GET  /api/v1/provider/resources/{resourceId}/policy
PUT  /api/v1/provider/resources/{resourceId}/policy
GET  /api/v1/provider/resources/{resourceId}/policy-diagnostics
POST /api/v1/provider/policy/effective-preview

GET  /api/v1/provider/offers
POST /api/v1/provider/offers
GET  /api/v1/provider/offers/authoring-options
GET  /api/v1/provider/offers/{offerId}
GET  /api/v1/provider/offers/{offerId}/readiness
PATCH /api/v1/provider/offers/{offerId}
POST /api/v1/provider/offers/{offerId}/activate
POST /api/v1/provider/offers/{offerId}/deactivate
POST /api/v1/provider/offers/{offerId}/archive
GET  /api/v1/provider/offers/{offerId}/visibility
PUT  /api/v1/provider/offers/{offerId}/visibility
GET  /api/v1/provider/offers/{offerId}/pricing-policy
PUT  /api/v1/provider/offers/{offerId}/pricing-policy
POST /api/v1/provider/offers/{offerId}/pricing-summary-preview
GET  /api/v1/provider/offers/{offerId}/policy
PUT  /api/v1/provider/offers/{offerId}/policy
POST /api/v1/provider/offers/{offerId}/policy-summary-preview
GET  /api/v1/provider/offers/{offerId}/variant-exposure
PUT  /api/v1/provider/offers/{offerId}/variants/{variantId}/exposure
PUT  /api/v1/provider/offers/{offerId}/variant-exposure-mode
GET  /api/v1/provider/offers/{offerId}/routability
GET  /api/v1/provider/offers/routability
GET  /api/v1/provider/resources/{resourceId}/routability-impact

GET  /api/v1/provider/acquiring-connections
POST /api/v1/provider/acquiring-connections
GET  /api/v1/provider/acquiring-connections/{connectionId}
POST /api/v1/provider/acquiring-connections/{connectionId}/submit-onboarding
GET  /api/v1/provider/acquiring-connections/{connectionId}/recipient-routes
GET  /api/v1/provider/acquiring-connections/{connectionId}/deal-binding
GET  /api/v1/provider/acquiring-connections/{connectionId}/routability

GET  /api/v1/provider/bookings
GET  /api/v1/provider/bookings/{bookingId}
GET  /api/v1/provider/fulfillment
GET  /api/v1/provider/bookings/{bookingId}/fulfillment
POST /api/v1/provider/bookings/{bookingId}/handover
POST /api/v1/provider/bookings/{bookingId}/return
POST /api/v1/provider/bookings/{bookingId}/complete
POST /api/v1/provider/bookings/{bookingId}/report-issue

GET    /api/v1/provider/providers/{providerId}/members
GET    /api/v1/provider/providers/{providerId}/members/options
POST   /api/v1/provider/providers/{providerId}/members/invitations
GET    /api/v1/provider/providers/{providerId}/members/invitations
PUT    /api/v1/provider/providers/{providerId}/members/{membershipId}/role
DELETE /api/v1/provider/providers/{providerId}/members/{membershipId}
```

## Error Contract

Most API business/auth failures return problem JSON with a stable `code`.

```json
{
  "type": "about:blank",
  "title": "Пароль должен содержать не менее 8 символов.",
  "status": 400,
  "detail": "Пароль должен содержать не менее 8 символов.",
  "instance": "/api/v1/auth/register",
  "code": "auth.password_too_short"
}
```

Frontend rules:

- branch on `code`, not localized text
- keep `status`, `title`, `detail`, `code`
- show `title` or `detail` when no better field-level copy exists
- handle `401` by routing to sign-in
- handle `403` by showing forbidden/provider-access state
- treat `404` on setup GET endpoints as "not configured yet" only when this document says so

## Auth And Provider Access Flow

Provider console has two phases:

- pre-provider user: auth, email verification, provider onboarding
- provider member: provider workspace access after approval creates `ProviderMembership`
- payout setup is admin-side after approval; approval creates a payout contract in review from the onboarding requisites

Do not grant provider access in frontend state. Use:

```http
GET /api/v1/auth/me
GET /api/v1/auth/provider-memberships
```

Routing:

- signed out -> auth screens
- signed in, no provider membership -> provider onboarding
- membership exists -> provider shell/provider switcher
- provider API returns `403` -> forbidden state and refresh memberships

### Email Start

```http
POST /api/v1/auth/email/start
```

```json
{
  "email": "ivan@example.com",
  "app": "crm"
}
```

Behavior:

- unknown email -> registration invitation email
- known email -> magic sign-in email
- always show generic "check email" copy on success
- development helper: `GET /api/v1/development/emails`

### Registration Invitation

```http
GET /api/v1/auth/registration-invitations/{token}
POST /api/v1/auth/register
```

```json
{
  "token": "registration_invitation_token",
  "name": "Ivan",
  "surname": "Petrov",
  "password": "StrongPassword123!"
}
```

Token owns the email. Do not let user edit it.

`GET /api/v1/auth/registration-invitations/{token}` returns:

```json
{
  "email": "ivan@example.com",
  "expiresAt": "2026-05-27T08:14:07Z",
  "requiresPassword": true
}
```

After successful registration, immediately request a provider-console token with the same email/password via
`POST /api/v1/auth/login` password grant. `POST /api/v1/auth/register` does not return an access token.

### Magic Sign-In

```http
POST /api/v1/auth/magic-sign-in
```

```json
{
  "token": "magic_sign_in_token"
}
```

After success:

1. `GET /api/v1/auth/me`
2. `GET /api/v1/auth/provider-memberships`

### Session Login

```http
POST /api/v1/auth/session-login
```

```json
{
  "email": "ivan@example.com",
  "password": "strong-password"
}
```

Use this endpoint for JSON browser-session login. Do not send JSON credentials to `/api/v1/auth/login`; that route is token/password grant style.

### Password Reset

```http
POST /api/v1/auth/password/forgot
POST /api/v1/auth/password/reset
```

```json
{
  "email": "ivan@example.com",
  "app": "crm"
}
```

```json
{
  "token": "token-from-email-link",
  "newPassword": "new-strong-password"
}
```

## Onboarding Flow

Pre-provider onboarding belongs to `/api/v1/provider-onboarding/*`, not `/api/v1/provider/*`.

Flow:

1. Load cities, onboarding options, and current onboarding.
2. If current onboarding is `not_started`, show the basic provider registration wizard.
3. Wizard continue creates the onboarding draft with `POST /api/v1/provider-onboarding/current`.
4. If current onboarding is `draft` or `changes_requested`, show the full onboarding forms.
5. Full onboarding forms update the draft with `PATCH /api/v1/provider-onboarding/current/profile`.
6. Only the full onboarding review screen calls `POST /api/v1/provider-onboarding/current/submit`.
7. Wait for internal review.
8. After approval, refresh memberships and enter provider shell.

Routing states:

- `not_started`: basic wizard
- `draft`: full onboarding forms
- `changes_requested`: full onboarding forms with review feedback
- `submitted` / `in_review`: review waiting screen
- `approved` plus provider membership: provider shell

Do not call `/submit` from the basic wizard. `/submit` means "send completed onboarding to platform review",
not "continue from wizard".

```http
GET  /api/v1/catalog/cities
GET  /api/v1/provider-onboarding/options
GET  /api/v1/provider-onboarding/current
POST /api/v1/provider-onboarding/current
PATCH /api/v1/provider-onboarding/current/profile
POST /api/v1/provider-onboarding/current/submit
GET  /api/v1/provider-onboarding/banks/ru/lookup?bic={bic}
```

Basic wizard draft creation:

```http
POST /api/v1/provider-onboarding/current
```

```json
{
  "displayName": "Sportgearhub - все для людей",
  "cityId": "00000000-0000-0000-0000-000000000100",
  "legalCountryCode": "RU",
  "legalForm": "sole_proprietor",
  "taxationSystem": "usn",
  "taxNumber": "024803896842"
}
```

Draft creation response:

```json
{
  "applicationId": "0c0aaab4-34ca-44e7-82cf-9057be84dbe9",
  "providerId": null,
  "status": "draft",
  "checklist": {
    "profile": "missing",
    "legal": "ready",
    "finance": "missing"
  },
  "draft": {
    "displayName": "Sportgearhub - все для людей",
    "legalName": "Индивидуальный предприниматель Искужин Айгиз Ирикович",
    "legalCountryCode": "RU",
    "legalForm": "sole_proprietor",
    "taxationSystem": "usn",
    "taxNumber": "024803896842",
    "registrationNumber": "326028000044859",
    "branchNumber": null,
    "registeredAddress": "Республика Башкортостан, Уфимский район, Зубовский, с Зубово",
    "contactEmail": null,
    "contactPhone": null,
    "cityId": "00000000-0000-0000-0000-000000000100",
    "address": null,
    "description": null,
    "acquiringProvider": "t_bank_multishop",
    "payoutSchedule": null,
    "payoutDraft": null
  },
  "review": null,
  "updatedAt": "2026-05-27T09:28:00.094884+00:00"
}
```

After this response, route to full onboarding forms because `status` is `draft`.

The API rejects duplicate provider legal identity during draft create/update. If
`legalCountryCode + taxNumber` already belongs to an active provider or active onboarding application,
the response is `409` with `code: "provider_onboarding.tax_number_already_registered"`. Treat this as
"provider already exists or is under review": do not start a second onboarding for a changed
`self_employed`/`sole_proprietor` legal form.

Full onboarding profile patch:

```http
PATCH /api/v1/provider-onboarding/current/profile
```

```json
{
  "contactEmail": "provider@example.com",
  "contactPhone": "+79990000000",
  "address": "ул. Ленина, 1",
  "description": "Прокат велосипедов и SUP",
  "payoutSchedule": "daily",
  "payoutDraft": {
    "mode": "t_bank_bank_account",
    "beneficiaryName": "Индивидуальный предприниматель Искужин Айгиз Ирикович",
    "bankName": "ПАО СБЕРБАНК",
    "bik": "044525225",
    "bankAccount": "40802810900000000001",
    "correspondentAccount": "30101810400000000225",
    "displayBankName": "Сбербанк"
  }
}
```

For `legalForm: "self_employed"`, show SBP payout form instead:

```json
{
  "contactEmail": "provider@example.com",
  "contactPhone": "+79990000000",
  "address": "ул. Ленина, 1",
  "description": "Прокат SUP",
  "payoutSchedule": "daily",
  "payoutDraft": {
    "mode": "t_bank_sbp_individual",
    "beneficiaryName": "Искужин Айгиз Ирикович",
    "phone": "+79990000000",
    "displayBankName": "Т-Банк",
    "sbpMemberId": "100000000111"
  }
}
```

Response uses the same `ProviderOnboardingResponse` shape. Enable final review submit only when:

```json
{
  "checklist": {
    "profile": "ready",
    "legal": "ready",
    "finance": "ready"
  }
}
```

Final review submit:

```http
POST /api/v1/provider-onboarding/current/submit
```

```json
{}
```

Success response:

```json
{
  "applicationId": "0c0aaab4-34ca-44e7-82cf-9057be84dbe9",
  "providerId": null,
  "status": "submitted",
  "checklist": {
    "profile": "ready",
    "legal": "ready",
    "finance": "ready"
  },
  "draft": {
    "displayName": "Sportgearhub - все для людей",
    "legalName": "Индивидуальный предприниматель Искужин Айгиз Ирикович",
    "legalCountryCode": "RU",
    "legalForm": "sole_proprietor",
    "taxationSystem": "usn",
    "taxNumber": "024803896842",
    "registrationNumber": "326028000044859",
    "branchNumber": null,
    "registeredAddress": "Республика Башкортостан, Уфимский район, Зубовский, с Зубово",
    "contactEmail": "provider@example.com",
    "contactPhone": "+79990000000",
    "cityId": "00000000-0000-0000-0000-000000000100",
    "address": "ул. Ленина, 1",
    "description": "Прокат велосипедов и SUP",
    "acquiringProvider": "t_bank_multishop",
    "payoutSchedule": "daily",
    "payoutDraft": {
      "mode": "t_bank_bank_account",
      "beneficiaryName": "Индивидуальный предприниматель Искужин Айгиз Ирикович",
      "bankName": "ПАО СБЕРБАНК",
      "bik": "044525225",
      "bankAccount": "40802810900000000001",
      "correspondentAccount": "30101810400000000225",
      "displayBankName": "Сбербанк"
    }
  },
  "review": null,
  "updatedAt": "2026-05-27T09:40:00.000000+00:00"
}
```

Quick marketplace-style draft creation can ask only:

- INN / `taxNumber`
- legal form / `legalForm`
- taxation system / `taxationSystem`
- shop name / `displayName`
- city / `cityId`

Current onboarding finance rules:

- only `acquiringProvider: "t_bank_multishop"` is available now
- `t_bank_multishop` means Sportgearhub's T-Bank multishop rail
- payout schedule and payout draft are required for `t_bank_multishop`, but they are collected after the basic wizard in the full onboarding forms
- payout schedule options currently contain only `daily`; do not show weekly delayed payout choices yet
- payout mode is legal-form specific:
  - `self_employed` -> `payoutDraft.mode: "t_bank_sbp_individual"`
  - `sole_proprietor` / `company` -> `payoutDraft.mode: "t_bank_bank_account"`
- payout fee is legal-form/payout-mode specific and comes from `payoutModes[].bankPayoutFee`, not from `payoutSchedules`

Bank lookup by BIC:

```http
GET /api/v1/provider-onboarding/banks/ru/lookup?bic=044525225
```

```json
{
  "source": "dadata",
  "value": "ПАО СБЕРБАНК",
  "unrestrictedValue": "ПАО СБЕРБАНК",
  "bic": "044525225",
  "swift": "SABRRUMM",
  "swifts": ["SABRRUMM"],
  "inn": "7707083893",
  "branchNumber": "773601001",
  "registrationNumber": "1481",
  "correspondentAccount": "30101810400000000225",
  "paymentName": "ПАО СБЕРБАНК",
  "shortName": "СБЕРБАНК",
  "paymentCity": "г Москва",
  "opfType": "BANK",
  "address": "г Москва, ул Вавилова, д 19",
  "unrestrictedAddress": "117312, г Москва, ул Вавилова, д 19",
  "stateStatus": "ACTIVE"
}
```

If lookup returns `404`, keep manual bank entry available. DaData bank lookup is an enrichment helper; it does not
save onboarding state until the frontend sends `payoutDraft` in the onboarding patch.

SBP payout bank options:

```http
GET /api/v1/payment-reference/sbp-members
```

```json
{
  "source": "t_bank",
  "items": [
    {
      "sbpMemberId": "100000000004",
      "displayBankName": "Т-Банк",
      "bankName": "T-Bank"
    }
  ]
}
```

Use this endpoint for onboarding and future payout settings pages. For `legalForm: "self_employed"`, frontend
stores the selected `sbpMemberId` and `displayBankName` inside `payoutDraft`.

Payout schedules:

```json
[
  {
    "value": "daily",
    "label": "Ежедневно",
    "cadence": "daily",
    "settlementDelayDays": 0,
    "payoutDaysOfMonth": null,
    "platformTransferFeePercent": 0
  }
]
```

Payout mode fees:

```json
[
  {
    "value": "t_bank_bank_account",
    "label": "На расчетный счет",
    "supportedLegalForms": ["sole_proprietor", "company"],
    "requiredFields": ["mode", "beneficiaryName", "bankName", "bik", "bankAccount", "correspondentAccount"],
    "bankPayoutFee": {
      "percent": 0.5,
      "minimumAmount": null,
      "currency": "RUB"
    }
  },
  {
    "value": "t_bank_sbp_individual",
    "label": "СБП самозанятого",
    "supportedLegalForms": ["self_employed"],
    "requiredFields": ["mode", "beneficiaryName", "phone", "displayBankName", "sbpMemberId"],
    "bankPayoutFee": {
      "percent": 1.5,
      "minimumAmount": 30,
      "currency": "RUB"
    }
  }
]
```

Onboarding location rule:

- `registeredAddress` is legal identity data
- `address` is a simple provider profile field during onboarding
- pickup/return/service counters are provider fulfillment locations after approval

## Cities, Addresses, And Fulfillment Locations

Cities are the platform source of truth for supported service cities.

```http
GET /api/v1/catalog/cities
```

Address helpers are suggestions only. They do not create cities, providers, fulfillment locations, offers, or booking truth.

```http
GET  /api/v1/addresses/ru/suggestions?query={query}&count={count}
POST /api/v1/addresses/ru/geolocate
```

Reverse geocoding request:

```json
{
  "lat": 55.878,
  "lon": 37.653,
  "count": 10,
  "radiusMeters": 100,
  "language": "ru",
  "division": "ADMINISTRATIVE"
}
```

Shared address response:

```json
{
  "source": "dadata",
  "suggestions": [
    {
      "value": "г Москва, ул Сухонская, д 11",
      "unrestrictedValue": "127642, г Москва, ул Сухонская, д 11",
      "postalCode": "127642",
      "country": "Россия",
      "countryCode": "RU",
      "region": "г Москва",
      "city": "г Москва",
      "settlement": null,
      "street": "ул Сухонская",
      "house": "д 11",
      "block": null,
      "flat": null,
      "fiasId": "8f6e4b9b-...",
      "kladrId": "77000000000268400",
      "geoLat": "55.8782557",
      "geoLon": "37.65372"
    }
  ]
}
```

Address helper rules:

- coverage is Russia only
- call suggestions after at least 3 typed characters
- call reverse geocoding from explicit map actions, not every map movement
- empty success is `{ "source": "dadata", "suggestions": [] }`
- store provider-confirmed coordinates from `geoLat` and `geoLon` as numeric `latitude` and `longitude`
- do not treat DaData `city` text as platform city truth; use `cityId` from `/api/v1/catalog/cities`

Provider fulfillment locations are reusable operational centers: shops, warehouses, rental issue centers, pickup points, return/check-in points, and staffed counters. They are not offer meetup/activity-start places.

```http
GET   /api/v1/provider/fulfillment-locations
POST  /api/v1/provider/fulfillment-locations
PATCH /api/v1/provider/fulfillment-locations/{fulfillmentLocationId}
```

Create:

```json
{
  "cityId": "00000000-0000-0000-0000-000000000100",
  "name": "Пункт выдачи на Ленина",
  "address": "ул. Ленина, 1",
  "type": "pickup",
  "isDefaultPickup": true,
  "latitude": 56.838011,
  "longitude": 60.597465,
  "description": null
}
```

Response:

```json
{
  "fulfillmentLocationId": "00000000-0000-0000-0000-000000000101",
  "providerId": "00000000-0000-0000-0000-000000000010",
  "cityId": "00000000-0000-0000-0000-000000000100",
  "cityName": "Екатеринбург",
  "name": "Пункт выдачи на Ленина",
  "address": "ул. Ленина, 1",
  "type": "pickup",
  "status": "active",
  "isDefaultPickup": true,
  "latitude": 56.838011,
  "longitude": 60.597465,
  "description": null,
  "updatedAt": "2026-05-18T10:00:00Z"
}
```

Current type values:

- `pickup`
- `service_area`

Frontend display rules:

- show fulfillment locations in provider setup and rental equipment offer forms
- use them for pickup/return or issue-center selection
- do not ask for working days yet; working hours and holiday policy are not implemented in this API contract
- use offer meetup locations for beaches, piers, parks, route starts, or SUP board meeting points

## Rental Readiness Flow

This is the main flow for equipment rental, such as bicycles, SUP boards, skis, tents, rods, and yoga mats.

Minimum customer-visible rental setup:

1. resource is `equipment / inventory / active`
2. resource has category
3. resource has active variants
4. resource has active ready inventory units assigned to variants
5. resource has active availability profile
6. resource or offer has active pricing policy
7. active provider/resource/offer policy chain exists
8. active offer exists with `offerType: "rental"`
9. offer has a fulfillment location, a meetup location, or both
10. offer visibility makes it visible today or in the intended season
11. offer routability is acceptable for checkout

Local data note from the API repo inspection:

- active offers may be hidden by seasonal visibility
- inventory availability profile alone does not prove there are rentable units
- marketplace/media projections may lag resource setup; provider UI should use provider responses and diagnostics

## Resources

### Categories And Activities

```http
GET /api/v1/provider/activity-options?resourceType=equipment&locale=ru-RU
GET /api/v1/provider/resource-categories?resourceType=equipment&activity=water_sports&locale=ru-RU
GET /api/v1/provider/resource-categories/equipment/bicycle/attributes?locale=ru-RU
```

Activity is a navigation facet. Category owns the variant attribute schema.

Seeded equipment categories:

- `bicycle`
- `sup_board`
- `tent`
- `skis`
- `fishing_rod`
- `yoga_mat`

Seeded activity examples:

- `water_sports`
- `cycling`
- `camping`
- `winter_sports`
- `tourism`
- `fitness`

### Create Resource

```http
POST /api/v1/provider/resources
```

```json
{
  "resourceType": "equipment",
  "capacityMode": "inventory",
  "category": "bicycle",
  "title": "Велосипед Stels Miss 6500"
}
```

Rules:

- `equipment` uses `inventory`
- `experience` and `service` use `scheduled_slot`
- do not send base capacity for inventory resources
- category is optional at transport level, but required for useful provider UI and marketplace aggregation

### Resource Read/Update

```http
GET   /api/v1/provider/resources
GET   /api/v1/provider/resources/{resourceId}
PATCH /api/v1/provider/resources/{resourceId}
POST  /api/v1/provider/resources/{resourceId}/archive
DELETE /api/v1/provider/resources/{resourceId}
```

Patch:

```json
{
  "title": "Велосипеды Stels Miss 6500",
  "category": "bicycle",
  "status": "active"
}
```

Delete behavior:

- `204`: removed
- `404`: missing or not accessible
- `409`: linked to downstream records; offer archive instead

### Images

```http
GET  /api/v1/provider/resources/{resourceId}/images
POST /api/v1/provider/resources/{resourceId}/images
GET  /api/v1/media/provider-resource-images/{imageId}
```

Upload:

- `multipart/form-data`
- field name: `files`
- max 10 files by default
- accepted: `image/jpeg`, `image/png`, `image/webp`

Do not construct image URLs manually. Use response `url` and `mediaPreviewUrl`.

## Variants

Variants are stable operational classifications under one resource.

```http
GET   /api/v1/provider/resources/{resourceId}/variants
POST  /api/v1/provider/resources/{resourceId}/variants
GET   /api/v1/provider/resources/{resourceId}/variants/{variantId}
PATCH /api/v1/provider/resources/{resourceId}/variants/{variantId}
POST  /api/v1/provider/resources/{resourceId}/variants/{variantId}/archive
```

Create:

```json
{
  "variantKey": "STELS-MISS-6500-M-26",
  "label": "M / 26\" / 160-175 см",
  "attributes": {
    "brand_name": "Stels",
    "model": "Miss 6500",
    "frame_size": "m",
    "wheel_size_in": "26",
    "rider_height_min_cm": "160",
    "rider_height_max_cm": "175"
  },
  "sortOrder": 1,
  "status": "active"
}
```

List supports:

```http
GET /api/v1/provider/resources/{resourceId}/variants?status=active&attributes.frame_size=m&sort=sortOrder,label
```

Frontend rules:

- render forms from category attribute schema
- send attributes as `{ "attribute_key": "value" }`
- do not ask for `variantType`
- do not store category per variant
- backend schema enforcement is still partial; frontend should validate from schema

## Inventory Units

Units are physical rentable items. They apply to `equipment / inventory` resources only.

```http
GET   /api/v1/provider/resources/{resourceId}/inventory-summary
GET   /api/v1/provider/resources/{resourceId}/units
POST  /api/v1/provider/resources/{resourceId}/units
PATCH /api/v1/provider/resources/{resourceId}/units/{unitId}
POST  /api/v1/provider/resources/{resourceId}/units/{unitId}/archive
```

Quick add:

```json
{
  "resourceVariantId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
  "inventoryCode": "BIKE-0001",
  "displayName": null,
  "status": "active",
  "conditionStatus": "ready",
  "externalReferenceCode": null
}
```

Rules:

- active unit must have `resourceVariantId`
- `inventoryCode` is provider-scoped human identity
- send explicit codes such as `BIKE-0001`; do not rely on generated codes for Cyrillic titles
- a unit counts as ready only when `status: "active"`, assigned to variant, and `conditionStatus: "ready"`

Inventory summary is the CRM source for setup counters:

- total units
- active units
- ready units
- maintenance/damaged/inactive/retired/lost units
- classified/unclassified units
- per-variant unit counts

## Availability

Availability belongs to the resource.

Mode rule:

- `equipment / inventory` -> `availabilityMode: "inventory"`
- `service` or `experience / scheduled_slot` -> `availabilityMode: "scheduled_slot"`
- do not call calendar/slot endpoints for inventory resources

### Profile

```http
GET /api/v1/provider/resources/{resourceId}/availability-profile
PUT /api/v1/provider/resources/{resourceId}/availability-profile
GET /api/v1/provider/resources/{resourceId}/availability-diagnostics
```

Use `404` on GET as "not configured yet".

```json
{
  "availabilityMode": "inventory",
  "timezone": "Asia/Yekaterinburg",
  "bookingHorizonDays": 30,
  "status": "active"
}
```

For inventory resources, availability profile is necessary but capacity comes from inventory units.

### Calendar And Slots

Only for `scheduled_slot` resources.

```http
GET  /api/v1/provider/resources/{resourceId}/availability-calendar
PUT  /api/v1/provider/resources/{resourceId}/availability-calendar
GET  /api/v1/provider/resources/{resourceId}/slots
POST /api/v1/provider/resources/{resourceId}/slots
PATCH /api/v1/provider/resources/{resourceId}/slots/{slotId}
POST /api/v1/provider/resources/{resourceId}/slots/{slotId}/close
```

Calendar:

```json
{
  "timezone": "Asia/Yekaterinburg",
  "recurringRules": [
    {
      "dayOfWeek": "saturday",
      "startsAtLocal": "10:00",
      "endsAtLocal": "12:00",
      "capacity": 8
    }
  ],
  "blockedPeriods": [],
  "exceptions": []
}
```

Slot:

```json
{
  "startsAt": "2026-06-15T10:00:00+05:00",
  "endsAt": "2026-06-15T12:00:00+05:00",
  "totalCapacity": 8,
  "status": "open",
  "title": "Утренняя прогулка",
  "meetingPoint": "Пункт проката на Ленина"
}
```

Current provider UI should keep scheduled-slot flows behind capability/feature gating until experience/service offer authoring is enabled end to end.

## Pricing

Pricing belongs to resource by default. Offer pricing is an override, not the normal path.

### Resource Pricing

```http
GET /api/v1/provider/resources/{resourceId}/pricing-policy
PUT /api/v1/provider/resources/{resourceId}/pricing-policy
GET /api/v1/provider/resources/{resourceId}/pricing-diagnostics
```

Use `404` on GET as "not configured yet".

```json
{
  "pricingMode": "per_unit_time",
  "currency": "RUB",
  "baseAmount": 500,
  "adjustmentRules": [],
  "status": "active"
}
```

Accepted `pricingMode` values:

- `fixed`
- `per_unit_time`
- `per_participant`
- `tiered`
- `dynamic`

Accepted status values:

- `active`
- `superseded`
- `archived`

Provider-facing saves default to `active`; do not send `draft`.

### Offer Pricing Override

```http
GET /api/v1/provider/offers/{offerId}/pricing-policy
PUT /api/v1/provider/offers/{offerId}/pricing-policy
POST /api/v1/provider/offers/{offerId}/pricing-summary-preview
POST /api/v1/provider/pricing/quote-preview
```

Quote preview:

```json
{
  "offerId": "40000000-0000-4000-8000-000000000001",
  "resourceId": null,
  "selectionContext": {
    "startAt": "2026-06-15T10:00:00+05:00",
    "endAt": "2026-06-15T12:00:00+05:00",
    "quantity": 1,
    "variantSelection": [],
    "bookingOptions": []
  }
}
```

Frontend rules:

- default rental UI should create resource pricing, not offer pricing
- use offer pricing only for promo/package/special commercial cases
- previews are not reservations and not booking guarantees

## Policy

Policy is authored business-rule truth. It is not freeform frontend copy.

Inheritance:

1. provider default policy
2. resource override
3. offer override

### Provider Default

```http
GET /api/v1/provider/policy-profile
PUT /api/v1/provider/policy-profile
```

Use `404` on GET as "not configured yet".

```json
{
  "policyScope": "default",
  "leadTimeHours": 2,
  "cancellationWindowHours": 24,
  "isCancellationAllowed": true,
  "noShowChargePercent": 100,
  "deposit": {
    "unit": "none",
    "value": 0,
    "currency": null
  },
  "checkInGraceMinutes": 15,
  "assuranceMode": "none",
  "weatherException": false,
  "minimumAge": 18,
  "helmetRequired": null,
  "status": "active"
}
```

Deposit values:

- `unit: "none"`: no deposit; `value` should be `0`
- `unit: "percentage"`: deposit is calculated from booking total, for example `{ "unit": "percentage", "value": 20 }`
- `unit: "fixed_amount"`: fixed deposit amount, for example `{ "unit": "fixed_amount", "value": 1000, "currency": "RUB" }`

The API no longer accepts `depositPercent`; send `deposit`.

### Resource Override

```http
GET /api/v1/provider/resources/{resourceId}/policy
PUT /api/v1/provider/resources/{resourceId}/policy
GET /api/v1/provider/resources/{resourceId}/policy-diagnostics
```

Use `404` on GET as "uses provider default".

```json
{
  "overrideScope": "eligibility",
  "minimumAge": 16,
  "helmetRequired": true,
  "status": "active"
}
```

### Offer Override

```http
GET /api/v1/provider/offers/{offerId}/policy
PUT /api/v1/provider/offers/{offerId}/policy
POST /api/v1/provider/offers/{offerId}/policy-summary-preview
POST /api/v1/provider/policy/effective-preview
```

Use offer overrides only when a commercial offer differs from provider/resource rules.

Effective preview:

```json
{
  "ownerType": "resource",
  "ownerId": "0a1a0000-0000-4000-8000-000000000101"
}
```

Policy options endpoint does not exist yet. Keep MVP policy labels/defaults local in the frontend.

## Payment Route Setup

Payment route setup has a provider-facing onboarding part and an internal/operator activation part.

Provider web only collects payout/onboarding data and shows readiness. It does not activate T-Bank connections,
recipient routes, or deal bindings.

Provider-facing routes:

```http
GET  /api/v1/provider/acquiring-connections
POST /api/v1/provider/acquiring-connections
GET  /api/v1/provider/acquiring-connections/{connectionId}
POST /api/v1/provider/acquiring-connections/{connectionId}/submit-onboarding
GET  /api/v1/provider/acquiring-connections/{connectionId}/recipient-routes
GET  /api/v1/provider/acquiring-connections/{connectionId}/deal-binding
GET  /api/v1/provider/acquiring-connections/{connectionId}/routability
```

### Onboarding Finance Setup

Before provider approval, payout data is collected on the provider onboarding draft.

Options:

```http
GET /api/v1/provider-onboarding/options
GET /api/v1/payment-reference/sbp-members
GET /api/v1/provider-onboarding/banks/ru/lookup?bic={bic}
```

Current option rules:

- `acquiringProvider`: only `t_bank_multishop`
- `payoutSchedule`: only `daily`
- `legalForm: "self_employed"` uses `payoutDraft.mode: "t_bank_sbp_individual"`
- `legalForm: "sole_proprietor"` and `legalForm: "company"` use `payoutDraft.mode: "t_bank_bank_account"`

Patch onboarding finance for ИП/ООО:

```http
PATCH /api/v1/provider-onboarding/current/profile
```

```json
{
  "payoutSchedule": "daily",
  "payoutDraft": {
    "mode": "t_bank_bank_account",
    "beneficiaryName": "ИП Иванов Иван Иванович",
    "bankName": "ПАО СБЕРБАНК",
    "bik": "044525225",
    "bankAccount": "40802810000000000000",
    "correspondentAccount": "30101810400000000225"
  }
}
```

Patch onboarding finance for self-employed:

```json
{
  "payoutSchedule": "daily",
  "payoutDraft": {
    "mode": "t_bank_sbp_individual",
    "beneficiaryName": "Иванов Иван Иванович",
    "phone": "+79990000000",
    "displayBankName": "T-Bank",
    "sbpMemberId": "100000000004"
  }
}
```

Onboarding response shape:

```json
{
  "applicationId": "0c0aaab4-34ca-44e7-82cf-9057be84dbe9",
  "providerId": null,
  "status": "draft",
  "checklist": {
    "profile": "ready",
    "legal": "ready",
    "finance": "ready"
  },
  "draft": {
    "displayName": "Sportgearhub - все для людей",
    "legalName": "ИП Иванов Иван Иванович",
    "legalCountryCode": "RU",
    "legalForm": "sole_proprietor",
    "taxationSystem": "usn",
    "taxNumber": "667100000000",
    "registrationNumber": "326667100000000",
    "branchNumber": null,
    "registeredAddress": "620000, Екатеринбург, Ленина 1",
    "contactEmail": "owner@example.ru",
    "contactPhone": "+79990000000",
    "cityId": "edededed-eded-eded-eded-ededededed01",
    "address": null,
    "description": null,
    "chiefExecutive": {
      "firstName": "Иван",
      "lastName": "Иванов",
      "middleName": "Иванович",
      "position": "Индивидуальный предприниматель",
      "citizenship": "Россия"
    },
    "acquiringProvider": "t_bank_multishop",
    "payoutSchedule": "daily",
    "payoutDraft": {
      "mode": "t_bank_bank_account",
      "beneficiaryName": "ИП Иванов Иван Иванович",
      "bankName": "ПАО СБЕРБАНК",
      "bik": "044525225",
      "bankAccount": "40802810000000000000",
      "correspondentAccount": "30101810400000000225",
      "displayBankName": null,
      "phone": null,
      "sbpMemberId": null
    }
  },
  "review": null,
  "updatedAt": "2026-05-29T06:00:00Z"
}
```

### Acquiring Connection Draft

After onboarding is approved and provider exists, provider web can fetch/create the connection draft.

Create connection. `acquiringProvider` may be omitted; backend defaults to `t_bank_multishop`.

```json
{
  "acquiringProvider": "t_bank_multishop"
}
```

Connection response shape:

```json
{
  "connectionId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "providerId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "acquiringProvider": "t_bank_multishop",
  "status": "draft",
  "shopCode": null,
  "payoutTarget": {
    "type": "t_bank_shop",
    "status": "draft",
    "targetId": "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "shopCode": null,
    "displayBankName": "ПАО СБЕРБАНК",
    "phone": null,
    "sbpMemberId": null
  },
  "onboardingDraft": {
    "draftPresent": false,
    "chiefExecutivePresent": false,
    "founderCount": 0,
    "lastSentToBankAt": null
  },
  "routing": {
    "routeStatus": "missing",
    "paymentRecipientId": null,
    "levelOfConfidence": null
  },
  "dealBinding": {
    "status": "missing",
    "mode": null,
    "dealId": null,
    "createDealWithType": null
  },
  "routability": {
    "connectionId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "paymentRouteable": false,
    "connectionStatus": "draft",
    "shopCodePresent": false,
    "terminalReady": false,
    "recipientRouteReady": false,
    "dealBindingReady": false,
    "reasonCodes": ["connection_not_active", "recipient_route_missing", "deal_binding_missing"],
    "diagnostics": null,
    "checkedAt": "2026-05-27T06:00:00Z"
  },
  "diagnostics": null,
  "createdAt": "2026-05-27T06:00:00Z",
  "updatedAt": "2026-05-27T06:00:00Z"
}
```

For self-employed providers, `payoutTarget` is SBP-specific:

```json
{
  "type": "t_bank_sbp_individual",
  "status": "draft",
  "targetId": "cccccccc-cccc-cccc-cccc-cccccccccccc",
  "shopCode": null,
  "displayBankName": "T-Bank",
  "phone": "+79990000000",
  "sbpMemberId": "100000000004"
}
```

### Submit T-Bank Shop Onboarding

Submit is an action. It does not accept payload.

```http
POST /api/v1/provider/acquiring-connections/{connectionId}/submit-onboarding
```

Request has no body.

Provider web does not submit T-Bank shop registration data anymore. Payout setup and T-Bank registration are
admin-side. This action only moves the provider-visible connection toward review when the provider explicitly asks
for setup review.

Submit response is `ProviderAcquiringConnectionResponse`. Expected state after provider submission:

```json
{
  "connectionId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "providerId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "acquiringProvider": "t_bank_multishop",
  "status": "pending_review",
  "shopCode": null,
  "payoutTarget": {
    "type": "t_bank_shop",
    "status": "pending_review",
    "targetId": "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "shopCode": null,
    "displayBankName": "Банк",
    "phone": null,
    "sbpMemberId": null
  },
  "onboardingDraft": {
    "draftPresent": true,
    "chiefExecutivePresent": true,
    "founderCount": 0,
    "lastSentToBankAt": null
  },
  "routing": {
    "routeStatus": "missing",
    "paymentRecipientId": null,
    "levelOfConfidence": null
  },
  "dealBinding": {
    "status": "missing",
    "mode": null,
    "dealId": null,
    "createDealWithType": null
  },
  "routability": {
    "connectionId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "paymentRouteable": false,
    "connectionStatus": "pending_review",
    "shopCodePresent": false,
    "terminalReady": false,
    "recipientRouteReady": false,
    "dealBindingReady": false,
    "reasonCodes": ["connection_not_active", "shop_code_missing", "recipient_route_missing", "deal_binding_missing"],
    "diagnostics": null,
    "checkedAt": "2026-05-29T06:00:00Z"
  },
  "diagnostics": null,
  "createdAt": "2026-05-29T06:00:00Z",
  "updatedAt": "2026-05-29T06:00:00Z"
}
```

### Read Recipient Routes

```http
GET /api/v1/provider/acquiring-connections/{connectionId}/recipient-routes
```

```json
[
  {
    "routeId": "dddddddd-dddd-dddd-dddd-dddddddddddd",
    "connectionId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "routeScope": "provider_default",
    "routeStatus": "active",
    "paymentRecipientId": null,
    "levelOfConfidence": "bank_confirmed",
    "createdAt": "2026-05-29T06:00:00Z",
    "updatedAt": "2026-05-29T06:00:00Z"
  }
]
```

Provider web reads this for diagnostics only. Route creation/activation is internal-only.

### Read Deal Binding

```http
GET /api/v1/provider/acquiring-connections/{connectionId}/deal-binding
```

```json
{
  "bindingId": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  "routeId": "dddddddd-dddd-dddd-dddd-dddddddddddd",
  "status": "active",
  "mode": "create_deal_with_type",
  "dealId": null,
  "createDealWithType": "safe_deal",
  "diagnostics": null,
  "createdAt": "2026-05-29T06:00:00Z",
  "updatedAt": "2026-05-29T06:00:00Z"
}
```

### Read Routability

```http
GET /api/v1/provider/acquiring-connections/{connectionId}/routability
```

```json
{
  "connectionId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "paymentRouteable": true,
  "connectionStatus": "active",
  "shopCodePresent": true,
  "terminalReady": true,
  "recipientRouteReady": true,
  "dealBindingReady": true,
  "reasonCodes": [],
  "diagnostics": {
    "activeDefaultRouteCount": 1,
    "activeDealBindingCount": 1,
    "shopCode": "123456789",
    "terminalKeyRef": "tbank-default-terminal"
  },
  "checkedAt": "2026-05-29T06:00:00Z"
}
```

Frontend rules:

- web-provider can create a `t_bank_multishop` connection draft and submit onboarding data
- web-provider cannot activate the connection in V1
- web-provider cannot create or activate recipient routes in V1
- web-provider cannot create or activate deal bindings in V1
- `routeScope` is internal and defaults to `provider_default` for MVP
- for ИП/ООО partner payout, operator/bank setup uses `partnerId` / `shopCode`
- for SBP/phone payout, setup uses `paymentRecipientId`
- T-Bank confirmation is still needed before requiring `paymentRecipientId` for registered ИП/ООО partner payouts
- show `payment_route` readiness and acquiring `routability.reasonCodes` as setup blockers
- after onboarding submission, show review/operator setup state until `paymentRouteable` becomes `true`
- do not invent route/deal setup UI; those commands are internal-only today

## Offers

Offer authoring must load options from API.

```http
GET /api/v1/provider/offers/authoring-options
GET /api/v1/provider/offers/authoring-options?primaryResourceId={resourceId}
```

Current active offer type for provider authoring is `rental`. `service` and `experience` may appear but can be inactive.

### Create

```http
POST /api/v1/provider/offers
```

```json
{
  "primaryResourceId": "0a1a0000-0000-4000-8000-000000000101",
  "offerType": "rental",
  "bookingFlowType": "direct_checkout",
  "variantExposureMode": "all_active_variants",
  "title": "Прокат велосипеда Stels Miss 6500",
  "description": "Почасовой прокат велосипеда.",
  "fulfillmentLocationId": "edededed-eded-eded-eded-ededededed11"
}
```

Meetup/activity-start place:

```json
{
  "meetupLocation": {
    "cityId": "edededed-eded-eded-eded-ededededed01",
    "title": "Пляж Солнечный",
    "address": "Пляж Солнечный, причал 2",
    "house": null,
    "latitude": 56.852,
    "longitude": 60.612
  }
}
```

Hybrid rental plus activity-start offer:

```json
{
  "primaryResourceId": "0a1a0000-0000-4000-8000-000000000101",
  "offerType": "rental",
  "bookingFlowType": "direct_checkout",
  "variantExposureMode": "all_active_variants",
  "title": "SUP board rental with lake meetup",
  "description": "Pick up from the issue center or meet at the pier.",
  "fulfillmentLocationId": "edededed-eded-eded-eded-ededededed11",
  "meetupLocation": {
    "cityId": "edededed-eded-eded-eded-ededededed01",
    "title": "Пляж Солнечный",
    "address": "Пляж Солнечный, причал 2",
    "latitude": 56.852,
    "longitude": 60.612
  }
}
```

Selected variants:

```json
{
  "primaryResourceId": "0a1a0000-0000-4000-8000-000000000101",
  "offerType": "rental",
  "bookingFlowType": "direct_checkout",
  "variantExposureMode": "selected_variants_only",
  "title": "Прокат взрослого велосипеда",
  "selectedVariants": [
    {
      "variantId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
      "visibilityStatus": "visible",
      "sortOrder": 0
    }
  ]
}
```

Rules:

- send option `value`, never localized title
- `selectedVariants` is accepted only with `selected_variants_only`
- selected variants must belong to the primary resource
- `fulfillmentLocationId` must reference one of the provider's active fulfillment locations
- `meetupLocation.cityId` must be a supported platform city
- `meetupLocation` requires `cityId` and at least `title` or `address`
- offer can have fulfillment location, meetup location, or both
- omitting `fulfillmentLocationId` or `meetupLocation` on patch leaves existing value unchanged
- current V1 does not expose an explicit clear/delete operation for existing offer locations
- do not send legacy `location`
- if API rejects offer type as disabled, refresh authoring options and block submit
- offers are created `active` by default; there is no required publish step after creation
- public/customer visibility still depends on offer visibility, routability, and checkout validation

Provider and public offer reads expose a purpose-aware location summary for display:

```json
{
  "locationSummary": {
    "primaryPurpose": "mixed",
    "fulfillmentLocation": {
      "purpose": "pickup_return",
      "fulfillmentLocationId": "edededed-eded-eded-eded-ededededed11",
      "cityId": "edededed-eded-eded-eded-ededededed01",
      "title": "Пункт выдачи на Ленина",
      "country": "Россия",
      "region": "Свердловская область",
      "city": "Екатеринбург",
      "address": "ул. Ленина, 1",
      "house": null,
      "latitude": 56.838011,
      "longitude": 60.597465,
      "timezone": "Asia/Yekaterinburg"
    },
    "meetupLocation": {
      "purpose": "meetup",
      "fulfillmentLocationId": null,
      "cityId": "edededed-eded-eded-eded-ededededed01",
      "title": "Пляж Солнечный",
      "country": "Россия",
      "region": "Свердловская область",
      "city": "Екатеринбург",
      "address": "Пляж Солнечный, причал 2",
      "house": null,
      "latitude": 56.852,
      "longitude": 60.612,
      "timezone": "Asia/Yekaterinburg"
    }
  }
}
```

`primaryPurpose` values:

- `pickup_return`: show the fulfillment location as the main customer-visible place
- `meetup`: show the meetup/activity-start place as the main customer-visible place
- `mixed`: show both, for example issue center plus SUP board meetup point

### Edit And Variant Exposure

```http
GET   /api/v1/provider/offers
GET   /api/v1/provider/offers/{offerId}
PATCH /api/v1/provider/offers/{offerId}
GET   /api/v1/provider/offers/{offerId}/variant-exposure
PUT   /api/v1/provider/offers/{offerId}/variant-exposure-mode
PUT   /api/v1/provider/offers/{offerId}/variants/{variantId}/exposure
```

Patch:

```json
{
  "title": "Прокат велосипеда Stels Miss 6500",
  "description": "Обновленное описание",
  "fulfillmentLocationId": "edededed-eded-eded-eded-ededededed11",
  "meetupLocation": null
}
```

Exposure:

```json
{
  "isRequiredForBooking": true,
  "displayLabelOverride": null,
  "visibilityStatus": "visible",
  "sortOrder": 0
}
```

Exposure response:

```json
[
  {
    "offerId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "resourceVariantId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "isRequiredForBooking": true,
    "displayLabelOverride": null,
    "visibilityStatus": "visible",
    "sortOrder": 0,
    "updatedAt": "2026-05-27T06:00:00Z"
  }
]
```

Variant exposure rules:

- allowed `variantExposureMode`: `all_active_variants`, `selected_variants_only`
- allowed `visibilityStatus`: `visible`, `hidden`, `unavailable`
- selected exposure rows are valid only when offer mode is `selected_variants_only`
- selected-variant readiness requires at least one row with `visibilityStatus: "visible"`
- switching to `all_active_variants` does not clear existing exposure rows; rows are ignored while the mode is all-active
- for rental variant selection, send `isRequiredForBooking: true` unless a future optional add-on flow is explicitly introduced

### Visibility

```http
GET /api/v1/provider/offers/{offerId}/visibility
PUT /api/v1/provider/offers/{offerId}/visibility
```

If no visibility row exists, API returns an `always_visible` default projection.

```json
{
  "visibilityMode": "always_visible",
  "visibleFrom": null,
  "visibleUntil": null,
  "status": "active"
}
```

Seasonal:

```json
{
  "visibilityMode": "seasonal",
  "visibleFrom": "2026-05-01",
  "visibleUntil": "2026-08-31",
  "status": "active"
}
```

Accepted `visibilityMode`:

- `always_visible`
- `seasonal`
- `hidden`

Important: an active seasonal offer is invisible outside its date window.

### Lifecycle, Visibility, And Routability

```http
GET  /api/v1/provider/offers/{offerId}/readiness
POST /api/v1/provider/offers/{offerId}/activate
POST /api/v1/provider/offers/{offerId}/deactivate
POST /api/v1/provider/offers/{offerId}/archive
GET  /api/v1/provider/offers/{offerId}/routability
GET  /api/v1/provider/offers/routability
GET  /api/v1/provider/resources/{resourceId}/routability-impact
```

Lifecycle request:

```json
{
  "reasonCode": "provider_requested"
}
```

Readiness:

```json
{
  "offerId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "providerId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "primaryResourceId": "cccccccc-cccc-cccc-cccc-cccccccccccc",
  "status": "blocked",
  "customerVisibleNow": false,
  "bookingSetupReady": false,
  "sections": [
    {
      "code": "inventory",
      "status": "blocked",
      "title": "Inventory",
      "message": "Add at least one active ready inventory unit assigned to a variant.",
      "reasonCodes": ["ready_inventory_missing"]
    }
  ],
  "checkedAt": "2026-05-27T06:00:00Z"
}
```

Readiness section statuses:

- `ready`
- `warning`
- `blocked`
- `not_applicable`

Frontend behavior:

- Offers are created active by default.
- Do not show a required "publish" step after offer creation.
- Use `GET /readiness` for the setup checklist and primary "can customers rent this now?" state.
- Use `publishability` and `executionLink` from `GET /offers` or `GET /offers/{offerId}` for setup state.
- Use `activate` only to resume an inactive offer.
- Use `deactivate` to pause an offer.
- Use `visibility` to control marketplace display windows.
- Use `routability` as a diagnostics/details view when the UI needs to explain booking/payment blockers.

Do not present `active` as "customers can book now" unless visibility is currently active and routability is acceptable.

## Bookings

Provider booking API is a read/operations projection, not booking workflow authority.

```http
GET /api/v1/provider/bookings
GET /api/v1/provider/bookings/{bookingId}
```

Filters:

- `status`
- `dateFrom`
- `dateTo`
- `offerId`
- `resourceId`

Summary fields:

- `bookingId`
- `bookingNumber`
- `offerId`
- `offerTitle`
- `bookingType`
- `customerSummary`
- `status`
- `startAt`
- `endAt`
- `quantity`
- `fulfillmentSummary`
- `createdAt`
- `updatedAt`

Frontend rules:

- hide payment/ledger internals
- show customer contact only for provider-relevant fulfillment
- do not implement provider direct refund/cancellation unless a dedicated API exists

## Fulfillment

Fulfillment is the operational handover/return/completion layer.

```http
GET  /api/v1/provider/fulfillment
GET  /api/v1/provider/bookings/{bookingId}/fulfillment
POST /api/v1/provider/bookings/{bookingId}/handover
POST /api/v1/provider/bookings/{bookingId}/return
POST /api/v1/provider/bookings/{bookingId}/complete
POST /api/v1/provider/bookings/{bookingId}/report-issue
```

Queue filters:

- `fulfillmentStage`
- `dateFrom`
- `dateTo`
- `offerId`
- `resourceId`

Handover:

```json
{
  "handedOverAt": "2026-06-15T10:00:00+05:00",
  "note": "Выдано клиенту",
  "handoverMetadata": [
    { "key": "staff", "value": "ivan" }
  ]
}
```

Return:

```json
{
  "returnedAt": "2026-06-15T12:00:00+05:00",
  "conditionSummary": [
    { "key": "condition", "value": "ready" }
  ],
  "note": "Возврат без повреждений"
}
```

Complete:

```json
{
  "completedAt": "2026-06-15T12:10:00+05:00",
  "note": "Заказ закрыт"
}
```

Issue:

```json
{
  "reasonCode": "equipment_damaged",
  "description": "Повреждена ручка тормоза",
  "evidenceRefs": []
}
```

Frontend rules:

- use `handoverAllowed`, `returnAllowed`, `completionAllowed` flags
- show confirmation before state-changing actions
- do not infer settlement/refund outcome from fulfillment state

## Provider Members

Provider member management is owner-only. It changes provider access, not provider profile, resource, offer, booking, payment, or ledger truth.

```http
GET    /api/v1/provider/providers/{providerId}/members
GET    /api/v1/provider/providers/{providerId}/members/options
POST   /api/v1/provider/providers/{providerId}/members/invitations
GET    /api/v1/provider/providers/{providerId}/members/invitations
PUT    /api/v1/provider/providers/{providerId}/members/{membershipId}/role
DELETE /api/v1/provider/providers/{providerId}/members/{membershipId}
```

Options:

```json
{
  "roles": [
    {
      "value": "owner",
      "label": "Владелец",
      "description": "Полный доступ к провайдеру и управлению участниками.",
      "sortOrder": 10
    },
    {
      "value": "manager",
      "label": "Менеджер",
      "description": "Управление операциями, ресурсами, предложениями и бронированиями.",
      "sortOrder": 20
    },
    {
      "value": "staff",
      "label": "Сотрудник",
      "description": "Операционная работа с заказами, выдачей и возвратом.",
      "sortOrder": 30
    },
    {
      "value": "finance",
      "label": "Финансы",
      "description": "Доступ к финансовым и выплатным разделам.",
      "sortOrder": 40
    }
  ]
}
```

Invite:

```json
{
  "email": "staff@example.com",
  "role": "staff"
}
```

Change role:

```json
{
  "role": "staff"
}
```

Role values:

- `owner`
- `manager`
- `staff`
- `finance`

Frontend rules:

- send role values as strings, preferably lowercase
- `Staff` is accepted by the API, but UI constants should stay lowercase
- do not remove or demote the last owner; API enforces this too

## CRM Implementation Checklist

### Foundations

- [ ] typed API client with credentials and bearer support
- [ ] centralized problem JSON normalization
- [ ] auth guard
- [ ] provider access guard using memberships
- [ ] forbidden and onboarding routing states
- [ ] dev email outbox helper hidden outside development

### Auth And Onboarding

- [ ] email-start screen
- [ ] registration invitation screen
- [ ] magic sign-in callback
- [ ] session login
- [ ] forgot/reset password
- [ ] current user loader
- [ ] provider membership loader
- [ ] onboarding current/options forms
- [ ] submit/review state

### Provider Setup

- [ ] fulfillment locations CRUD
- [ ] activity/category selector
- [ ] resource create/edit/archive/delete
- [ ] image upload/gallery
- [ ] category schema-driven variant forms
- [ ] inventory unit quick add and edit
- [ ] inventory summary and per-variant counts

### Rental Publication

- [ ] availability profile form
- [ ] resource pricing policy form
- [ ] provider default policy form
- [ ] optional resource policy override
- [ ] offer authoring options loader
- [ ] offer create/edit
- [ ] variant exposure picker
- [ ] offer location picker
- [ ] offer visibility editor
- [ ] offer readiness checklist from `GET /offers/{offerId}/readiness`
- [ ] publishability and execution link display from offer list/detail
- [ ] pause/resume/archive actions
- [ ] routability diagnostics details

### Operations

- [ ] booking list/detail
- [ ] fulfillment queue
- [ ] handover action
- [ ] return action
- [ ] completion action
- [ ] issue report action

## Current Known Gaps And Frontend Handling

- Provider dashboard/profile/operating-state endpoints from the product brief are not fully available yet; build dashboard from available resources, offers, routability, bookings, and fulfillment projections.
- Experience/service offer authoring is not fully active for provider authoring; keep scheduled-slot experience UI gated until API enables it end to end.
- Marketplace aggregation endpoints are thinner than provider setup data; do not expect provider UI setup counters to match public marketplace cards one-to-one yet.
- Policy options endpoint does not exist; keep MVP labels/defaults local.
- Availability diagnostics for inventory prove profile setup, not real stock; show ready inventory units separately.
- Active seasonal offers are invisible outside `visibleFrom` / `visibleUntil`; show this explicitly in offer status UI.
