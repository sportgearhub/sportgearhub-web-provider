# Seller Console — Flows From Sign-In To Trading (PROPOSAL, v2)

> Status: **design, nothing built.** v2 after walking through Ozon Seller's registration
> (screens: «Выберите компанию» → «Пройдите регистрацию» → «Данные о компании» → welcome).
> Where v2 changes [provider-onboarding-api.design.md](provider-onboarding-api.design.md) it
> says so in the last section. Screen copy is Russian because that is what ships.

## Vocabulary — `provider` everywhere in code; «кабинет» is screen copy

| Layer | Word |
|---|---|
| API, data, client models | **Provider** — the noun stays; a customer books from a provider, and `/providers/{id}/offers` reads right |
| Screen copy (RU) | **кабинет** — «Выберите кабинет», «Добавить кабинет»; neutral for самозанятый / ИП / ООО |
| Legal party | **Продавец** — `seller_profile` |
| Team | **Команда** — `provider_membership` |
| Contract | **Договор № … от …** — `seller_agreement`, see [seller-agreement.design.md](seller-agreement.design.md) |

## Principle: the token carries `sub`, the console bootstraps from `/auth/me`

The access token already carries only the subject. Everything the console needs to decide where
to land comes from **one call**:

```jsonc
GET /api/v1/auth/me
{
  "user": { "id": "…", "name": "Айгиз", "surname": "Искужин", "phone": "+7927…", "phone_verified": true,
            "email": null, "email_verified": false, "platform_role": null },
  "providers": [
    { "provider_id": "…", "display_name": "Прокат Солнечный", "kind": "sole_proprietor", "status": "active",  "role": "owner" },
    { "provider_id": "…", "display_name": "Айгиз Искужин",     "kind": "self_employed",   "status": "draft",   "role": "owner" }
  ],
  "pending_invitations": [
    { "invitation_id": "…", "provider_display_name": "Байк-Центр", "role": "manager", "expires_at": "…" }
  ]
}
```

(`/connect/userinfo` stays OIDC-shaped and untouched.)

**As built:** the user fields stay at the top level of the response rather than under a `user`
key — the console already reads `/auth/me` that way — with `providers[]` and
`pending_invitations[]` added beside them.

## The journey

```
 1 Phone sign-in → 2 Which provider? → 3 Guided creation (3 screens) → 4 Checklist → 5 Review → 6 Trade + team
```

## 1 · Phone sign-in — already built

Phone → MTS ID push, SMS fallback → (first time) name → (new device) passcode → `/auth/me`.
Same account as the customer app; no "seller registration" exists as a separate thing.

## 2 · Which provider? — «Выберите кабинет»

The Ozon «Выберите компанию» screen, with our statuses.

```
 ┌────────────────────────────────────────────┐
 │  Выберите кабинет                          │
 │  ┌──────────────────────────────────────┐  │
 │  │ 👤 Айгиз Искужин  ·  +7 (927) ***-62 │  │   ← who is signed in (phone, not email)
 │  └──────────────────────────────────────┘  │
 │  ◉ Прокат Солнечный      ИП · владелец     │
 │  ○ Айгиз Искужин         самозанятый ·     │
 │                          Черновик          │
 │  ── Приглашения ──────────────────────     │
 │  ✉ «Байк-Центр» приглашает вас как         │
 │     менеджера              [Принять]       │
 │                                            │
 │  + Добавить кабинет                        │
 │  [ Выйти ]                     [ Далее ]   │
 └────────────────────────────────────────────┘
```

| `providers` | `pending_invitations` | Behaviour |
|---|---|---|
| 0 | 0 | skip the list, go straight to 3 · guided creation |
| 0 | >0 | this screen with only the invitation block and «Добавить кабинет» |
| 1 | 0 | skip the screen, enter the provider |
| otherwise | | this screen; last-used provider preselected (remembered per device, never per account) |

Rows carry a status badge (`Черновик`, `На проверке`, `Нужны правки`, `Отклонён`,
`Приостановлен`, `В архиве`; `active` shows nothing) so a person with three providers sees
which one needs them. The header inside the console repeats the provider name with a switcher
back to this screen; deep links carry `providerId` in the URL and a non-member gets
«У вас нет доступа к этому кабинету» plus the switcher.

## 3 · Guided creation — «Добавить кабинет», three screens

Ozon's «Пройдите регистрацию» → «Данные о компании» → welcome, adapted. The provider is
**created at the end of screen 2**, when the legal party is confirmed — not at the first click
and not at the end. A provider whose kind is unknown has no payout method and no checklist
shape, so the kind and ИНН are the first facts; everything after them can be «укажу позже».

### 3.1 · «Кто вы?»

```
 Форма ведения бизнеса
   ○ Самозанятый
   ○ ИП — индивидуальный предприниматель
   ○ Организация — ООО, АО и другие юрлица          ← one `company` kind; Dadata tells us the ОПФ

 ☐ У меня ещё нет ИП или самозанятости
   ┌───────────────────────────────────────────────────────────────┐
   │ Без ИП или самозанятости продавать не получится.              │
   │ Самозанятость оформляется за 10 минут в приложении «Мой налог»│
   │ или на Госуслугах.                          [Как оформить →]  │
   └───────────────────────────────────────────────────────────────┘
                                                        [ Далее ]
```

Unlike Ozon we do not register ИП/ООО for the seller (their partner flow). The checkbox exists
so the person is told *before* typing an ИНН they do not have. The hint is copy, not a feature.

### 3.2 · «Данные продавца» — one ИНН, the registry does the rest

```
 Самозанятый                         ИП / Организация
 ─────────────────                   ──────────────────────────────────────────
 ИНН (12 цифр)                       ИНН (12 для ИП · 10 для организации)
 Фамилия   ┐ prefilled from the       ↓ Dadata
 Имя       │ account, editable —     ┌────────────────────────────────────────┐
 Отчество  ┘ the legal party's name  │ ООО «Пример»                           │
                                      │ ОГРН 1027700132195 · КПП 770701001    │
 Система налогообложения: НПД (fixed) │ 119021, Москва, ул. …                 │
                                      │ Директор: Иванов И.И.                 │
                                      └────────────────────────────────────────┘
                                      Система налогообложения  [УСН ▾]        ← the registry does not say; the seller does
                        [ Назад ]  [ Далее ]
```

- ИНН is checksum-validated client-side and again on the server.
- Errors are decisions for the seller, never silent fixes: `seller.legal_identity_not_found`
  («ИНН не найден в реестре»), `seller.kind_mismatch` («По этому ИНН зарегистрировано ООО, а вы
  выбрали ИП»), `seller.inn_already_used` («Этот продавец уже подключён» — one legal party, one
  provider, as on Ozon and WB).
- Самозанятый: no registry to ask today; the checksum is the check. ФНС's public NPD-status
  check is the later addition, on the same save.
- **The kind and ИНН never change after this screen** — the Ozon rule. A person whose business
  changes form creates another cabinet; the old one keeps its history.
- **«Далее» creates the provider**: draft `Provider`, owner membership, the seller profile —
  all in one request. From here on the person can leave and come back; the row exists.

### 3.3 · «О вашем прокате» — Ozon's «Данные о компании»

```
 Название кабинета     [ Прокат Петрова          ]   ← prefilled: short legal name, or ФИО
 ☐ Укажу позже                                        ← keeps the prefill
 Коротко о вас         [ Велосипеды и самокаты в Уфе ]   optional

 Нажимая «Готово», вы принимаете условия договора для продавцов
 и даёте согласие на обработку персональных данных.
                        [ Назад ]  [ Готово ]
```

Ozon's category / experience / item-count questions are omitted: we have nowhere honest to
store them and nothing that would read them. Name and a line of description are what the
catalogue and the reviewer actually use.

**«Готово» is the acceptance of the seller agreement.** It inserts a `seller_agreements` row —
number from a sequence, who clicked, when, from where — and the cabinet can show
«Договор № 1042 от 23.09.2026» from that second, before any review. Which edition applied is
the docs' change log, looked up by date, as on Ozon. The seller profile
carries no consent columns. Details, and where the number flows (T-Bank descriptors, SBP
purpose, reports), are in [seller-agreement.design.md](seller-agreement.design.md).

### 3.4 · Welcome → the provider

«Кабинет создан. Осталось три шага до каталога» — straight into the checklist.

## 4 · Inside the provider — the checklist («настройка»)

Shopify's setup guide rather than a wizard: every line is a page the seller can revisit, and the
list is computed from what is saved (`GET …/readiness`), never from "steps completed".

```
 Настройка кабинета
 ✓ Продавец            ИП Петров И.И. · ИНН …                       (done by creation)
 ● Профиль             название ✓ · описание · адрес · телефон ✓    profile
   └ Почта для документов  [ ivan@… ]  → код из письма → ✓          required to submit for ИП/организации
 ● Выплаты             по типу продавца: СБП по телефону | расчётный счёт     payout
 ○ Точка выдачи        первая локация                              per-offer readiness, not review
 ○ Первое объявление   черновик                                    allowed before review
 ─────────────────────────────────────────────────────────────────
 [ Отправить на проверку ]   enabled when can_submit
```

- **Выплаты is derived, never chosen.** Самозанятый: телефон для СБП + банк. ИП/организация:
  расчётный счёт + БИК (bank name from БИК). Saved as the existing payout contract rows; the
  bank registration itself (T-Bank SBP recipient / multisplit shop) is triggered by an admin
  after approval, because it is the bank's own review and fails for reasons the seller cannot
  fix alone. `can_be_paid` tracks it.
- **Email** is asked here, once, verified by a code (`email/attach`), and is the only place email
  appears in the whole console. Required before submit for ИП/организации (acts and reports go
  to a mailbox), optional for самозанятые.
- `can_submit = seller_profile ∧ display_name ∧ description ∧ (business ⇒ email_verified) ∧ status ∈ {draft, changes_requested}`.
  Payout details do **not** gate review.

## 5 · Review

```
seller  [Отправить на проверку]  →  pending_review · review row opened · banner «Обычно за 1 рабочий день»
admin   review queue → card: профиль · продавец (registry data) · выплаты · история проверок
           approve → active · «Вы в каталоге» · offers already Active become visible
           request_changes → changes_requested · message above the checklist · [Отправить снова]
           reject → rejected · message · provider read-only · the person may create another
```

Everything built while waiting stays. Re-moderation (`request_changes` on an `active`
provider) removes it from the catalogue until re-approved; existing bookings are contracts and
are untouched.

## 6 · Trade — and bring the team

Invite by phone → the invitee signs in with that phone → sees the invitation on screen 2 →
accepts. Roles as today (владелец, менеджер, сотрудник, финансы); only an owner touches
продавец, выплаты and команда; there is always at least one owner; removal simply stops listing
the provider at the next launch.

## Edge cases that decide the design

| Case | Behaviour |
|---|---|
| Rents bikes as ИП, guides tours as самозанятый | two providers, two seller profiles, one account — why multi-provider exists |
| Same ИНН twice | `seller.inn_already_used`; one legal party = one provider |
| Rejected, tries again | new provider allowed; the rejected one stays read-only with its history |
| Abandons creation on 3.1 or 3.2 | nothing exists; on 3.3 → a draft provider exists, named by the prefill |
| Membership removed mid-session | next call `403` → back to screen 2 with «Доступ к кабинету закрыт» |
| Wants to change kind (самозанятый → ИП) | not possible in place — creates a new cabinet for the new legal party, as on Ozon; the old cabinet stays with its history |
| Two people share a shop laptop | last-used provider is per device only; never inferred from the account |

## What this changes in the API design

1. **Console routes are scoped by provider in the path:** `/api/v1/provider/…` →
   `/api/v1/providers/{providerId}/…`, authorised by membership (or platform admin) in the gate.
   Removes the "exactly one membership" hack. (`X-Provider-Id` header considered and rejected:
   hides the provider from URL and history in a browser app.)
2. **Creation carries the seller:** `POST /api/v1/providers` takes
   `{ seller: { kind, inn, taxation_system?, person?: {last_name, first_name, middle_name?} }, display_name?, description? }`
   and returns the provider; no second provider refusal. `PUT …/seller-profile` stays for
   later changes.
3. **`self_employed_seller_profiles` gets ФИО** (`last_name`, `first_name`, `middle_name?`) — the legal
   party's name as on the tax record, prefilled from the account, not the same field.
4. **Acceptance creates `seller_agreements`** (numbered from a sequence, edition, evidence) — not columns on the seller profile.
5. **`GET /auth/me` is the bootstrap** and carries `providers` (with `kind`, `status`, `role`) and
   `pending_invitations`; `/auth/provider-memberships` folds into it.
6. **`profile_complete` requires a verified email for business kinds.**
7. **All table and column names are `snake_case`** (project-wide, one rename migration; see the API design).
8. `company` is the only kind for юрлица (ООО, АО, ПАО, ПК…); the ОПФ is data from Dadata, not
   a kind.

Everything else in [provider-onboarding-api.design.md](provider-onboarding-api.design.md) stands;
its endpoint table should be read with `/provider/` → `/providers/{providerId}/`.
