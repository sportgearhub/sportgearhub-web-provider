# Provider API

Provider console API surface. All routes under `/api/v1/provider/`. Requires `Authorization: Bearer <token>` scoped to `provider_api`.

---

## Onboarding

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/provider-onboarding/current` | Start onboarding |
| `GET` | `/provider-onboarding/current` | Get onboarding state |
| `PATCH` | `/provider-onboarding/current/profile` | Update onboarding profile |
| `POST` | `/provider-onboarding/current/submit` | Submit for review |
| `GET` | `/provider-onboarding/legal-identity/ru/lookup` | INN/KPP lookup (Dadata) |

---

## Profile & Members

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/provider/profile` | Provider profile |
| `PATCH` | `/provider/profile` | Update profile |
| `GET` | `/provider/operating-state` | Operating state |
| `GET` | `/provider/dashboard` | Dashboard summary |
| `GET` | `/provider/members` | Member list |
| `POST` | `/provider/members/invitations` | Invite member |
| `PUT` | `/provider/members/{membershipId}/role` | Update member role |
| `DELETE` | `/provider/members/{membershipId}` | Remove member |

---

## Resources

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/provider/resource-categories` | Category list |
| `GET` | `/provider/activity-options` | Activity options |
| `GET` | `/provider/resources` | Resource list |
| `POST` | `/provider/resources` | Create resource |
| `GET` | `/provider/resources/{resourceId}` | Resource detail |
| `PATCH` | `/provider/resources/{resourceId}` | Update resource |
| `DELETE` | `/provider/resources/{resourceId}` | Delete resource |
| `GET` | `/provider/resources/{resourceId}/images` | Resource images |
| `POST` | `/provider/resources/{resourceId}/images` | Upload image |

### Resource diagnostics (read-only, aggregate offer-level truth)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/provider/resources/{resourceId}/availability-diagnostics` | Availability readiness |
| `GET` | `/provider/resources/{resourceId}/pricing-diagnostics` | Pricing readiness |
| `GET` | `/provider/resources/{resourceId}/variant-diagnostics` | Variant readiness |
| `GET` | `/provider/resources/{resourceId}/policy-diagnostics` | Policy readiness |

---

## Variants

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/provider/resources/{resourceId}/variants` | Variant list |
| `POST` | `/provider/resources/{resourceId}/variants` | Create variant |
| `GET` | `/provider/resources/{resourceId}/variants/{variantId}` | Variant detail |
| `PATCH` | `/provider/resources/{resourceId}/variants/{variantId}` | Update variant |
| `POST` | `/provider/resources/{resourceId}/variants/{variantId}/archive` | Archive variant |
| `GET` | `/provider/resources/{resourceId}/variants/{variantId}/allocation` | Variant allocation |
| `PUT` | `/provider/resources/{resourceId}/variants/{variantId}/allocation` | Upsert allocation |

---

## Offers

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/provider/offers` | Offer list |
| `POST` | `/provider/offers` | Create offer |
| `GET` | `/provider/offers/{offerId}` | Offer detail |
| `PATCH` | `/provider/offers/{offerId}` | Update offer |
| `POST` | `/provider/offers/{offerId}/activate` | Activate |
| `POST` | `/provider/offers/{offerId}/deactivate` | Deactivate |
| `POST` | `/provider/offers/{offerId}/archive` | Archive |
| `GET` | `/provider/offers/{offerId}/readiness` | Publishability readiness |
| `GET` | `/provider/offers/{offerId}/visibility` | Visibility settings |
| `PUT` | `/provider/offers/{offerId}/visibility` | Update visibility |

### Offer-level configuration (availability, pricing, policy, variants)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/provider/offers/{offerId}/availability` | Availability settings (`status: not_configured` if unset) |
| `PUT` | `/provider/offers/{offerId}/availability` | Upsert availability settings |
| `GET` | `/provider/offers/{offerId}/pricing-policy` | Pricing policy |
| `PUT` | `/provider/offers/{offerId}/pricing-policy` | Upsert pricing policy |
| `POST` | `/provider/offers/{offerId}/pricing-summary-preview` | Preview pricing summary |
| `GET` | `/provider/offers/{offerId}/policy` | Policy override |
| `PUT` | `/provider/offers/{offerId}/policy` | Upsert policy override |
| `POST` | `/provider/offers/{offerId}/policy-summary-preview` | Preview policy summary |
| `GET` | `/provider/offers/{offerId}/variant-exposure` | Variant exposure settings |
| `PUT` | `/provider/offers/{offerId}/variant-exposure-mode` | Update exposure mode |
| `PUT` | `/provider/offers/{offerId}/variants/{variantId}/exposure` | Update variant exposure |
| `GET` | `/provider/offers/{offerId}/routability` | Offer routability status |

---

## Provider-level Policy

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/provider/policy-profile` | Provider default policy |
| `PUT` | `/provider/policy-profile` | Upsert provider policy |
| `GET` | `/provider/resources/{resourceId}/policy` | Resource policy override |
| `PUT` | `/provider/resources/{resourceId}/policy` | Upsert resource policy override |
| `POST` | `/provider/policy/effective-preview` | Effective policy chain preview |

---

## Bookings & Fulfillment

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/provider/bookings` | Booking list |
| `GET` | `/provider/bookings/{bookingId}` | Booking detail |
| `GET` | `/provider/bookings/{bookingId}/fulfillment` | Fulfillment detail |
| `GET` | `/provider/fulfillment` | Fulfillment queue |
| `POST` | `/provider/bookings/{bookingId}/handover` | Confirm handover to customer |
| `POST` | `/provider/bookings/{bookingId}/return` | Confirm return from customer |
| `POST` | `/provider/bookings/{bookingId}/complete` | Complete fulfillment |
| `POST` | `/provider/bookings/{bookingId}/report-issue` | Report fulfillment issue |

---

## Acquiring & Payouts

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/provider/acquiring-connections` | Acquiring connection list |
| `POST` | `/provider/acquiring-connections` | Create acquiring connection |
| `GET` | `/provider/acquiring-connections/{connectionId}` | Connection detail |
| `GET` | `/provider/acquiring-connections/routability` | Payout routability |
| `GET` | `/provider/payout-contracts` | Payout contracts |
| `GET` | `/provider/recipient-routes` | Recipient routes |

---

## Storefront

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/provider/storefront` | Storefront config |
| `PATCH` | `/provider/storefront` | Update storefront |

---

## Boundaries

- Availability, pricing, and policy are configured at **offer level** — not resource level
- Resource diagnostics are **read-only aggregations** — they summarize offer-level configuration for readiness views
- Provider APIs must never expose internal booking workflow, ledger truth, or payment internals
- Provider scope is enforced on all queries — a provider can only access their own resources/offers/bookings
