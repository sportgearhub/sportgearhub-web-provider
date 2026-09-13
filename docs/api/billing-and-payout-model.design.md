# Billing & Payout Model — Target Design (Draft)

> Status: **partially implemented.** The keystone (Invoice, InvoiceLine, ProviderTariff,
> PaymentMethod) is built and migrated. The accrual/payout layer is still design-only.
> Production payment flow still uses `SettlementPlan` + residual-commission until retired.

## Scope decision: one booking = one provider

A booking is always with **a single provider**. A customer who needs items from two
providers creates **two bookings → two invoices → two payments**; cross-provider baskets
are a checkout concern, never a data-model one. Add-ons (e.g. a helmet with a bike) are
**extra items within the same single-provider booking**, not other providers.

This removes per-provider attribution from inside an invoice: the **whole invoice is one
provider**, and lines only distinguish **items** (main item vs. add-ons).

## Why this exists

Today's money model has three gaps:

1. **Commission is a residual, not a tariff** — no fee schedule, no per-item breakdown a
   provider can see, no markup-vs-commission concept.
2. **No provider balance, no scheduled payout** — payouts fire one-at-a-time by hand.
3. **No commercial document** — `Booking` + `PaymentIntent` carry money implicitly; there's
   nothing immutable to show, audit, or compute economics from.

Backbone: an immutable **Invoice** (one provider, itemized **lines**), feeding append-only
**accruals** into a per-provider **deal bucket**, drained by a **scheduled payout**.

```
Booking ─1:1─ Invoice ─1:N─ PaymentIntent (attempts, ≤1 paid)
                 │ (one provider)
                 └─ InvoiceLine[]   (rental / deposit / fees, tagged per item: OfferId/Sku)

ProviderDeal (per provider — the T-Bank money bucket)
   ▲ fill                              ▼ drain
DealAccrual[]  (append-only)      PayoutBatch ─1:N─ PayoutExecution
   at return → +earned               scheduled job        (recipient snapshot + payout fee HERE)
   refund    → −amount
   deduction → +clawback
```

Legend below: **🟢 built**, **🟡 designed (not built)**, **⚪ exists already in code**.

---

## Part 1 — Invoice & lines (🟢 built)

- **Invoice** is immutable and **single-provider**: what was agreed and charged at sale.
- Post-sale changes (refund, damage deduction) are **accruals**, never invoice edits.
- **Provider payable** is computed (`accruals − adjustments`), never a stored snapshot.

### 🟢 `Invoice` (`payments` schema)
| Field | Type | Purpose |
|---|---|---|
| Id | Guid | PK |
| BookingId | Guid (unique) | 1:1 with `Booking` |
| UserId | Guid | customer |
| **ProviderId** | Guid | the single provider — attribution |
| InvoiceNumber | string (unique) | `INV-9001` |
| Status | string | `issued`/`paid`/`settled`/`cancelled`/`refunded` |
| Currency | string | `RUB` |
| CustomerTotalAmount | decimal | what the customer pays |
| IssuedAt, CreatedAt, UpdatedAt | DateTimeOffset | |
| Lines | `List<InvoiceLine>` | nav, cascade |

### 🟢 `InvoiceLine` — one charge, tagged with its item
| Field | Type | Purpose |
|---|---|---|
| Id | Guid | PK |
| InvoiceId | Guid (FK) | parent |
| OfferId | Guid? | **which item** — main offer or add-on offer |
| ResourceVariantId | Guid? | rental unit |
| Sku | string? | variant code — unit-economics grouping key |
| LineType | enum | `rental`/`deposit`/`platform_fee`/`payment_fee`/`vat` |
| Bearer | enum? | `customer`/`provider`/`platform` (null for rental/deposit) |
| PayeeType | enum | `provider`/`provider_hold`/`platform`/`gateway` |
| Description | string | display only |
| Quantity | int | |
| UnitAmount | decimal | per unit |
| Amount | decimal | line total, frozen at sale |
| TaxRate | decimal? | VAT etc. |
| SourceLineId | Guid? | fee line → its rental line |
| CreatedAt | DateTimeOffset | |

> No `ProviderId` on the line — it's on the invoice (one provider). Item identity
> (`OfferId`/`ResourceVariantId`/`Sku`) is on the line because an invoice can hold several
> items (main + add-ons). Per-item economics = `GROUP BY Sku`.

### 🟢 Enums
- `InvoiceLineType`: `rental, deposit, platform_fee, payment_fee, vat`
- `FeeBearer`: `customer, provider, platform`
- `PayeeType`: `provider, provider_hold, platform, gateway`

### Add-ons (future — no schema change needed)
An add-on = **more lines on the same invoice**, same provider, its own `OfferId`/`Sku`
(helmet `rental` + optional helmet `deposit` + its fee lines). Today: build single-item
invoices; the line model is already add-on-shaped.

---

## Part 2 — Fees: bearer, rate source, placement

### a) Bearer — markup vs. commission

| Bearer | Customer pays | Provider receives | Aka |
|---|---|---|---|
| `customer` | price **+ fee** | clean price | markup |
| `provider` | price | price **− fee** | commission (**default** for `platform_fee`) |

Commission default → clean customer pricing. `Bearer` is per-line, so markup stays possible
without migration. (We avoid Airbnb's split-fee asymmetry — opaque for a new marketplace.)

### b) Rate source (🟢 built configs)

```
ProviderTariff   (provider schema)   ProviderId, PlatformFeeRate (0.05), EffectiveFrom, Status
PaymentMethod    (payments schema)   Method ("sbp"), AcquiringFeeRate (0.007), Status
```

- **`platform_fee`** rate is per-provider → `ProviderTariff`.
- **`payment_fee`** (SBP acquiring) is per payment method → `PaymentMethod`. SBP is a
  **payment method**, not a per-provider term.
- Lines store the **computed amount snapshotted at sale**; rate config can change later
  without altering past invoices.

### c) Placement — fee lives where it's incurred and becomes known

| Event | Fee | Lives on |
|---|---|---|
| Collection (customer pays) | `payment_fee` (SBP acquiring) | Invoice line |
| Sale (invoice issued) | `platform_fee` | Invoice line |
| Payout (transfer to provider) | `payout_fee` | `PayoutExecution` (actual amount) |

Never put a payout-based fee on the immutable invoice — its real amount depends on the
actual transfer and would drift from what T-Bank charges.

### Deposit-acquiring nuance
Deposits are fee-free in settlement (returned in full), but T-Bank acquiring is charged on
the **full collection incl. deposit**. The delta is a platform cost — mitigated by using an
**authorization/hold** for deposits instead of a capture. Open item.

---

## Part 3 — Deal bucket, accruals & scheduled payout (🟡 designed)

The T-Bank deal **is** a money bucket. Model fill and drain as append-only facts.
With one-provider invoices, **one invoice → one provider → one accrual** (no per-provider
split inside an invoice).

```
🟡 ProviderDeal   ProviderId, DealId (T-Bank handle), Status
🟡 DealAccrual    ProviderId, DealId, InvoiceId, Amount, Type(rental|refund|deduction), AccruedAt
🟡 PayoutSchedule ProviderId, Cadence(daily|weekly(dow)|manual), MinAmount, NextRunAt
🟡 PayoutBatch    ProviderId, DealId, ScheduledFor, TotalAmount, Status
   ⚪→🟡 PayoutExecution  Amount, payout_fee, recipient snapshot, ExternalPayoutRef, PaidAt
```

### Rules
- **Balance** = `Σ DealAccrual − Σ PayoutBatch(settled|pending)`. A query, not a row.
- **Bucket keyed by `ProviderId`**, `DealId` rides along (survives deal-strategy migration).
- **Accrual at equipment return**, not payment — provider isn't paid until gear is back and
  deposit resolved.
- Split timestamps: accrual `AccruedAt` (fill) vs payout `PaidAt` (drain).
- **Scheduled `BackgroundService`** (not built): wake on cadence → providers with
  `NextRunAt ≤ now` and `balance ≥ MinAmount` → one `PayoutBatch` per provider → one T-Bank
  payout. Batching respects the **15 payouts/day** cap (see
  [payout-limits-and-deal-strategy.md](integrations/t-bank-acquiring/payout-limits-and-deal-strategy.md)).
- `payout_fee` computed here on the actual transfer.

### Dissolves
- **`SettlementPlan` removed** — accruals replace its recomputed split.
- **`PayoutRecipientSnapshot`** lives **only on `PayoutExecution`**; recipient resolved live
  at batch time.

---

## Worked example — bike rental with a (future) helmet add-on

Provider A: bike rental **2000**, deposit **5000**, tariff **5%**. SBP **0.7%**, payout
**0.5%**. (Helmet add-on shown as the future extra lines.)

### Config
```
ProviderTariff  A: PlatformFeeRate=0.05
PaymentMethod   sbp: AcquiringFeeRate=0.007
```

### Invoice (today — single item)
```
Invoice INV-9001  provider=A  bookingId=bk-1  Status=issued  CustomerTotalAmount=7000
  line  type          payee          offer  sku       amount  source
   1    rental         provider       off-A  BIKE-29   2000    —
   2    deposit        provider_hold  off-A  BIKE-29   5000    —
   3    platform_fee   platform       off-A  BIKE-29    100    #1   (5% × 2000)
   4    payment_fee    gateway        off-A  BIKE-29     14    #1   (0.7% × 2000)
```

### With a helmet add-on later (same invoice, same provider — just more rows)
```
   5    rental         provider       off-H  HELM-M     300    —
   6    deposit        provider_hold  off-H  HELM-M     500    —
   7    platform_fee   platform       off-H  HELM-M      15    #5
   8    payment_fee    gateway        off-H  HELM-M     2.1    #5
```

### Lifecycle (single item)
```
paid     → money in deal D-A; deposit held; nothing accrued
return   → refund deposit 5000 → customer
           DealAccrual +1886.00 (2000 − 100 − 14)  → D-A
payout   → PayoutExecution: amount 1886.00, payout_fee 9.43, net 1876.57
           recipient resolved live from provider's SBP config
```

### Per-item unit economics
```sql
SELECT Sku,
  SUM(Amount) FILTER (WHERE LineType='rental')       AS revenue,
  SUM(Amount) FILTER (WHERE LineType='platform_fee') AS platform_fee,
  SUM(Amount) FILTER (WHERE LineType='payment_fee')  AS payment_fee
FROM InvoiceLines l JOIN Invoices i ON i.Id=l.InvoiceId
WHERE i.ProviderId=@A GROUP BY Sku;
-- BIKE-29 | 2000 | 100 | 14      HELM-M | 300 | 15 | 2.1   (add-on rolls up separately)
```

---

## Status & next steps

- **🟢 Built & migrated:** `Invoice` (single-provider), `InvoiceLine` (item-tagged),
  `ProviderTariff`, `PaymentMethod` + 3 enums + DbContext + one forward migration.
- **🟡 Next:** `PaymentIntent.InvoiceId`; then `ProviderDeal`/`DealAccrual`/`PayoutSchedule`/
  `PayoutBatch`; then the scheduled `BackgroundService`; then retire `SettlementPlan`.
- **Invariants:** invoice immutable & single-provider; accruals append-only; balance is a
  sum; recipient snapshot only on `PayoutExecution`; item identity on the line via `Sku`.

## Open items
- `LineType`/`PayeeType`/`Bearer` — final closed enum sets.
- Deposit: capture vs. authorization/hold (decides deposit-acquiring cost).
- Whether accruals replace `LedgerEntryRecord` or feed it.
- Add-on pricing model (own rental/deposit lines) — when the feature is built.
