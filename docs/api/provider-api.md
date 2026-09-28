# Provider API

Provider console API surface. Console routes live under **`/api/v1/providers/{providerId}/`** — the
provider is named in the path, the gate checks the caller's membership in it (or the platform
admin role), and a person may belong to several. Requires `Authorization: Bearer <token>` scoped to
`provider_api`. Everything is `snake_case` on the wire.

---

## Bootstrap and cabinets

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/auth/me` | Who is signed in, `providers[]` (kind, status, role) and `pending_invitations[]` — the console's one bootstrap call |
| `POST` | `/api/v1/provider-invitations/accept` | Accept an invitation addressed to the caller's verified phone (`{invitation_id}`) |
| `POST` | `/api/v1/providers` | Create a draft provider with its seller profile and accepted agreement (`{seller, display_name?, description?}`) |
| `GET` | `/api/v1/providers/seller-lookup?inn=` | Registry preview for the creation flow |

---

## Lifecycle (`/api/v1/providers/{providerId}/…`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `…/profile` | Profile with `status` and `latest_review` |
| `PATCH` | `…/profile` | Name, description, address, slug, contacts |
| `GET` | `…/seller-profile` | The legal party: `kind`, `inn`, `person` / `business` / `company` sections |
| `PUT` | `…/seller-profile` | Taxation system, VAT rate, or a самозанятый's name — kind and ИНН are immutable |
| `GET` | `…/seller-profile/lookup?inn=` | Registry preview |
| `GET` | `…/payout` | Payout method (dictated by the kind), requisites, whether the bank registered them |
| `PUT` | `…/payout` | `{method: "sbp", phone, sbp_member_id, bank_name}` or `{method: "bank_account", account, bik, bank_name, correspondent_account?}` |
| `GET` | `…/readiness` | The checklist: `can_submit`, `is_public`, `can_be_paid`, items |
| `POST` | `…/submit-for-review` | `draft`/`changes_requested` → `pending_review`; `409` when not ready |
| `GET` | `…/agreement` | «Договор № … от …» |
| `GET` | `…/dashboard` | Readiness plus counts |

Statuses: `draft · pending_review · changes_requested · rejected · active · suspended · archived`.
Only `active` providers are public.

---

## Members

| Method | Path | Purpose |
|---|---|---|
| `GET` | `…/members` | Member list |
| `GET` | `…/members/options` | Role options |
| `POST` | `…/members/invitations` | Invite by phone (`{phone, role}`) |
| `GET` | `…/members/invitations` | Invitation list |
| `PUT` | `…/members/{membershipId}/role` | Update member role |
| `DELETE` | `…/members/{membershipId}` | Remove member |

---


## Resources

| Method | Path | Purpose |
|---|---|---|
| `GET` | `…/resource-categories` | Category list |
| `GET` | `…/activity-options` | Activity options |
| `GET` | `…/resources` | Resource list |
| `POST` | `…/resources` | Create resource |
| `GET` | `…/resources/{resourceId}` | Resource detail |
| `PATCH` | `…/resources/{resourceId}` | Update resource |
| `DELETE` | `…/resources/{resourceId}` | Delete resource |
| `GET` | `…/resources/{resourceId}/images` | Resource images |
| `POST` | `…/resources/{resourceId}/images` | Upload image |

### Resource diagnostics (read-only, aggregates offer-level truth)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `…/resources/{resourceId}/pricing-diagnostics` | Pricing readiness |

---


## Offers

| Method | Path | Purpose |
|---|---|---|
| `GET` | `…/offers` | Offer list |
| `POST` | `…/offers` | Create offer |
| `GET` | `…/offers/{offerId}` | Offer detail |
| `PATCH` | `…/offers/{offerId}` | Update offer |
| `POST` | `…/offers/{offerId}/activate` | Activate |
| `POST` | `…/offers/{offerId}/deactivate` | Deactivate |
| `POST` | `…/offers/{offerId}/archive` | Archive |
| `GET` | `…/offers/{offerId}/readiness` | Publishability readiness |

### Offer-level configuration (pricing, policy)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `…/offers/{offerId}/pricing-policy` | Pricing policy |
| `PUT` | `…/offers/{offerId}/pricing-policy` | Upsert pricing policy |
| `POST` | `…/offers/{offerId}/pricing-summary-preview` | Preview pricing summary |
| `GET` | `…/offers/{offerId}/policy` | Policy override |
| `PUT` | `…/offers/{offerId}/policy` | Upsert policy override |
| `GET` | `…/offers/{offerId}/routability` | Offer routability status |

---

## Bookings & Fulfillment

| Method | Path | Purpose |
|---|---|---|
| `GET` | `…/bookings` | Booking list |
| `GET` | `…/bookings/{bookingId}` | Booking detail |
| `GET` | `…/bookings/{bookingId}/fulfillment` | Fulfillment detail |
| `GET` | `…/fulfillment` | Fulfillment queue |
| `POST` | `…/bookings/{bookingId}/handover` | Confirm handover to customer |
| `POST` | `…/bookings/{bookingId}/return` | Confirm return from customer |
| `POST` | `…/bookings/{bookingId}/complete` | Complete fulfillment |
| `POST` | `…/bookings/{bookingId}/report-issue` | Report fulfillment issue |

---

## Acquiring & Payouts

One resource per provider. There is no connection to create or contract to list: what the seller
states goes to `…/payout`, and where the money actually goes is the payout destination.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `…/payout` | Payout method, requisites, whether the bank has taken them |
| `PUT` | `…/payout` | Save the requisites for the method the seller kind dictates |

---

## Storefront

| Method | Path | Purpose |
|---|---|---|
| `GET` | `…/storefront` | Storefront config |
| `PATCH` | `…/storefront` | Update storefront |

---

## Boundaries

- Availability, pricing, and policy are configured at **offer level** — not resource level
- Resource diagnostics are **read-only aggregations** — they summarize offer-level configuration for readiness views
- Provider APIs must never expose internal booking workflow, ledger truth, or payment internals
- Provider scope is the path: `/providers/{providerId}` is checked against the caller's memberships on every request
