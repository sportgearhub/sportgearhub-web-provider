# Seller Agreement — Numbered Contract, Accepted In The Cabinet

> Status: **built.** `SellerAgreement` carries the number from the
> `seller.seller_agreement_number_seq` sequence, and `/api/v1/sellers/{sellerId}/agreement` accepts
> it. The status line below said «nothing built» until 2026-09-30, long after it was.
>
> One thing worth knowing: dropping the old `provider` schema took that sequence with it, and the
> column default that read it. An accepted agreement would have failed on a null number until it was
> restored on 2026-09-30.
> From reading Ozon's «Договор для Продавцов товаров на
> Платформе Ozon» (`artifacts/ozon/public_agreement.md`, edition of 22.10.2026, 2,633 lines) and
> what our own payout code already does with a contract number. This document is about the
> **mechanics** — what is stored, when the number is born, where it flows. The **text** of our
> agreement is a lawyer's deliverable; the section "What the text must settle" is the brief.

## What Ozon's agreement is, structurally

| Element | Ozon | What it tells us |
|---|---|---|
| Legal shape | agency (гл. 52 ГК РФ), commission (гл. 51), paid services (гл. 39); a **framework** contract (ст. 429.1); explicitly **not public** (ст. 426) | the same shape fits a rental marketplace: we act *за счёт Продавца*, take payments on their instruction, remit minus our fee. "Not public" is what lets a platform refuse a seller. |
| Subject | Ozon sells goods *за счёт Продавца*, contracts acquiring on the seller's behalf, issues чеки/УПД for them; rights and duties under the sale arise **directly with the seller** (ст. 1005) | we are not a party to the rental itself — the rental contract is customer ↔ provider; we are the agent that lists, books, collects and remits |
| Parts | this text + «Общие условия сотрудничества» + Регламенты; **hyperlinks are part of the contract** | our agreement can be short and point to regulations we already have as data: cancellation tiers, fulfillment rules, quality expectations |
| Editions | each edition has an effective date, is **published in advance**, changes are unilateral with **45 / 15-day notice** depending on what worsens for the seller | store the accepted edition; publish the next one before it applies; no re-click on every change |
| Activation | «Активация ЛК» is the platform's decision after registration; a refused potential seller may dispute within **7 days**, otherwise the contract is not concluded | our review. Acceptance happens before activation; activation is what makes it bind. `reopen` after `reject` is the dispute path. |
| Payouts | weekly settlement period → 14 days for returns/corrections → payout within 7 business days → fixed **payment day (Wednesday)**; monthly reconciliation | the schedule is a **term of the agreement**, not a per-seller setting — which confirms dropping `PayoutSchedule` from `Provider` |
| Suspension | unilateral, for quality metrics or defective goods | our `suspend`; the reason belongs in the review log |
| Disputes | pre-trial claims; 15 days for sanctions/visibility claims, 30 for the rest; sanctions lifted within 48 h if the claim is upheld | a support/claims process, not a table — but the review log is where "why" lives |
| Receipts | Ozon issues чеки and УПД **on the seller's behalf** and puts its own support phone on them | the fiscal question we still owe a lawyer (see brief) |

The contract number itself is not in this text — it lives in «Общие условия» and in the cabinet:
**«Договор № … от …» appears on the cabinet's documents page the moment the seller accepts,** and
that number is what the seller's bank, accountant and our payout descriptors refer to.

## What we already do — and why it is not enough

`ProviderPayoutContract` is, in fact, the contract: `ContractNumber` (int), `StartsOn`, `Status`
(`draft · active · blocked · suspended · superseded`) — and it *also* carries `PayoutMode` with
SBP / bank-requisite child rows. The number already flows into T-Bank:

```
BillingDescriptor = "SGH-{ContractNumber:D10}"
PaymentDetails    = "Перевод средств по договору № {n} от {StartsOn:dd.MM.yyyy} по Реестру Операций от ${date}. Сумма комиссии …"
```

Three defects:

1. **The number is allocated as `MAX + 1`** in two different services — a race, and the two copies
   can drift.
2. **Two things in one row.** The contract (number, date, who accepted, which edition) and the
   payout instructions (SBP phone / bank account) have different lifetimes: requisites change
   without a new contract; a new legal party needs a new contract with the same requisites
   possible. `superseded`/`blocked`/`suspended` describe payout ability, not the contract.
3. **No evidence of acceptance.** Nothing records that a person clicked, when, which text, from
   where — which is the one thing a dispute about the contract needs.

## The model

Two tables replace `ProviderPayoutContract` + its two child tables. Names are `snake_case`
(project-wide decision, see the API design).

### `provider.seller_agreements` — the contract, one per legal party

```
id · provider_id · seller_profile_id
number                 bigint, from sequence seller_agreement_number_seq  — the «№»
accepted_at            timestamptz            — the «от dd.MM.yyyy»
accepted_by_user_id · accepted_ip · accepted_user_agent
activated_at           timestamptz?            — set by the review's `approve`
terminated_at          timestamptz? · termination_reason text?
```

- **Status is derived**, never stored: `terminated_at` → *terminated*; `activated_at` → *active*;
  else *accepted (awaiting activation)*. Same discipline as readiness.
- **Born at the click.** Screen 3.3 «Готово» of the guided flow inserts this row; the seller
  profile carries no consent columns. The number exists from that second, so the cabinet's
  documents page can show «Договор № 1042 от 23.09.2026» before review is even started —
  exactly Ozon's behaviour.
- **One agreement per provider, because one legal party per provider.** Kind and ИНН are fixed
  at creation; a different legal party is a different provider with its own agreement and number.
  Nothing is ever replaced.
- **Acceptance evidence** follows Stripe Connect's `tos_acceptance` (`date`, `ip`, `user_agent`):
  who, when, from where. Nothing more.
- **Which edition was accepted is not stored — it is derived.** The text lives in
  `sportgearhub-docs`, published from git, with a change log of editions and their effective
  dates. "The edition in force on `accepted_at`" is a lookup in that table, and git history
  proves what the text said on any day. This is exactly what Ozon does: the cabinet shows
  «Договор № … от …» and links to the docs site. The API neither reads nor stores edition
  metadata; the cabinet's documents card links to `/docs/legal/providers/provider-agreement`
  through the docs registry, the same way the privacy policy is linked today.

### `provider.provider_payout_details` — where the money goes, one current row per provider

```
id · provider_id
method                 sbp | bank_account       — must match the seller kind (self-employed → sbp; business → bank_account)
beneficiary_name       text
-- sbp
phone · sbp_member_id · display_bank_name
-- bank_account
account · bik · bank_name · correspondent_account?
registered_at          timestamptz?             — the bank accepted it (SBP recipient active / T-Bank shop has a code)
updated_at
```

Changing requisites edits this row; the agreement is untouched. `payout_ready` = the row's
method-specific fields are filled; `can_be_paid` = `registered_at` is set.

### `payout_recipient_snapshots` gains two columns

`agreement_number` and `agreement_accepted_at`, captured with the requisites at payout time.
Every payout can then reproduce its own назначение платежа years later, whatever has changed.

## Where the number flows

```
seller_agreements.number ─┬─▶ cabinet · Документы: «Договор № 1042 от 23.09.2026, редакция от 01.10.2026 · PDF»
                          ├─▶ T-Bank multisplit shop:  BillingDescriptor = "SGH-0000001042"
                          │                            PaymentDetails    = "Перевод средств по договору № 1042 от 23.09.2026 по Реестру Операций от ${date} …"
                          ├─▶ SBP payout to a самозанятый: purpose "Выплата по договору № 1042 от 23.09.2026"
                          ├─▶ monthly agent report / акт header (the отчётный документ Ozon's §2 describes)
                          └─▶ payout_recipient_snapshots — frozen per payout
```

The T-Bank formats above are the ones in code (`ProviderPayoutRegistrationService`), and
`seller_agreements` is their one source.

## Cabinet screens it adds

- **Guided flow, screen 3.3**: the consent line becomes a real checkbox linking to the docs —
  «Принимаю условия Договора для провайдеров» — and «Готово» is the acceptance. Nothing else
  changes on that screen.
- **Документы** page in the cabinet: the agreement card («Договор № 1042 от 23.09.2026», link to
  the docs) and — later — monthly reports. Owner-only, like Продавец and Выплаты.
- **Admin**: the review card shows «Договор № 1042 от … · редакция …»; `approve` stamps
  `activated_at`; `reject` stamps `terminated_at` with `activation_refused`; `reopen` clears it.

## Migration

- Create `seller_agreements`, `provider_payout_details`; add the two snapshot columns.
- Copy each `ProviderPayoutContract` into a `seller_agreements` row (`number`, `accepted_at =
  StartsOn`, `terms_version = "legacy"`, `activated_at = CreatedAt` for `active` contracts) and its
  requisites into `provider_payout_details`. Both providers in production are test data, but the
  copy is mechanical, so do it rather than reason about it.
- Set the sequence to `MAX(number) + 1`; drop the three old tables.

## What the text must settle (brief for the lawyer)

1. **Shape**: agency for rental bookings + acquiring on the provider's behalf; framework
   (ст. 429.1); not public (ст. 426); the rental contract is customer ↔ provider.
2. **Receipts (54-ФЗ) — settled on our side:** T-Bank Multisplit does not fiscalise, so the
   platform issues every customer чек itself through АТОЛ Онлайн, as agent, with the provider as
   supplier (name, ИНН, phone) and the provider's VAT rate. Consequences for the model:
   `business_seller_profiles.vat_rate` (`none · vat5 · vat7 · vat10 · vat20`; self-employed is
   always `none`), and the text must carry the provider's поручение to issue чеки and their
   liability for the rate. Two questions remain for the lawyer: whose phone goes on the чек
   (Ozon prints its own support line), and whether a самозанятый must still register the payout
   in «Мой налог». The receipt *flows* (приход on payment, возврат прихода on refund, what
   happens on partial retention) are the next design document, `fiscalization.design.md`.
3. **Payout schedule and payment day** as terms — the reason `PayoutSchedule` leaves the model.
4. **Activation and refusal**: acceptance ≠ activation; a refused seller's dispute window (7
   days at Ozon) and what "not concluded" means for anything they entered.
5. **Editions and notice periods** (45 / 15 days at Ozon), and which changes need re-acceptance.
6. **Suspension grounds** and the pre-trial claims procedure and its clocks.
7. **Cancellation and refund tiers** as a regulation the agreement points to — we already
   store them per offer (`PolicyCancellationTiers`); the text should say the tiers in the
   cabinet are the binding ones.

## Related

- provider-console-flows.design.md (the deleted provider-console-flows design, removed 2026-09-30) — screen 3.3 is the acceptance
- provider-onboarding-api.design.md (the deleted provider-onboarding-api design, removed 2026-09-30) — `payout` endpoints now write `provider_payout_details`; `approve` activates the agreement
- `sportgearhub-docs/docs/legal/providers/` — the drafted texts and the change log of editions
