# Seller console integration

For the developers building `sportgearhub-web-provider`.

Start here, not in the OpenAPI document. `docs/api/openapi/seller.json` is generated and mechanically
accurate — every path, every field, every status code — and it is silent on everything that matters
when you actually wire a screen: which call comes first, what a value means, when a field turns
read-only, and what to do when a call fails. That is what this page is for.

Where the two disagree, the spec is right about shapes and this page is right about rules. If you
find a rule here that the API does not honour, that is a bug — report it.

Every error code the API can return, with its status and cause, is in
[`docs/api/errors.md`](../errors.md). It is generated from the source and a test fails when it
drifts, so you never have to read our code to find out what `seller.not_ready` means.

---

## Conventions that hold everywhere

**snake_case, both directions.** Request bodies, response bodies, query parameters, path
placeholders. Case is relaxed on the way in (`City_Id` binds) but the separator is not: `cityId`
will **not** bind to `city_id`. Send snake_case.

**Dictionary keys are data, not contract.** Keys inside an object map — attribute keys, locale
codes — are never renamed. `attributes` is `{"bike_type": "road"}` and stays exactly that.

**`seller_id` in the path is checked against your session.** Every `/api/v1/sellers/{seller_id}/…`
call resolves the seller from the route and verifies your membership. Passing another seller's id
gets a 403, not somebody else's data. There is no ambient "current seller" — always send the id.

**Errors have one shape.**

```json
{
  "title": "Недостаточно прав для выполнения действия.",
  "status": 403,
  "detail": "Недостаточно прав для выполнения действия.",
  "instance": "/api/v1/sellers/29ae.../products",
  "code": "forbidden"
}
```

Branch on `code`, never on `title` — the title is Russian prose meant for a person and will be
reworded. Validation failures look different, because they name fields:

```json
{
  "status_code": 400,
  "message": "One or more validation errors occurred.",
  "code": "bad_request",
  "errors": {
    "attributes": ["attributes must be an object of attribute key to value, for example {\"bike_type\":\"road\"}"]
  }
}
```

**Money is a JSON number**, in roubles, two decimals at most. Not minor units, not a string.

**Timestamps are ISO 8601 with an offset** (`2026-09-30T14:03:22+05:00`). Times of day without a
date are `HH:mm:ss`. Dates without a time are `YYYY-MM-DD`.

---

## Signing in

Both a phone number and an email are credentials. A seller who registered with one can add the other
from inside a session and then sign in with either. There is no primary and no secondary.

### The pattern

Every channel follows the same three steps: **start** → **verify-code** → you are in, or you are
asked to finish registering.

```
POST /api/v1/auth/phone/start        { "phone": "+79279383562" }
POST /api/v1/auth/phone/verify-code  { "verification_id": "…", "code": "123456" }
```

```
POST /api/v1/auth/email/start        { "email": "seller@example.com" }
POST /api/v1/auth/email/verify-code  { "verification_id": "…", "code": "123456" }
```

`start` answers with a `verification_id` — carry it into `verify-code`. It does **not** tell you
whether the contact is known; that would let anyone enumerate our sellers. You find out from
`verify-code`.

`verify-code` answers one of two ways:

- **Known contact** — tokens, and you are signed in.
- **Unknown contact** — a `registration_token` and nothing else. The person is new. Send them to the
  registration form and finish with `complete-registration`:

```
POST /api/v1/auth/phone/complete-registration
{
  "registration_token": "…",
  "name": "Иван",
  "surname": "Петров",
  "birthday": "1990-04-17"
}
```

`birthday` is **required** and always has been stored — it was simply never asked for on this
surface, which is why old rows read `0001-01-01`. It must be a real past date and not more than 120
years ago.

### Adding the other contact

From inside a session, same OTP shape, different route:

```
POST /api/v1/auth/email/attach/start    { "email": "seller@example.com" }
POST /api/v1/auth/email/attach/confirm  { "verification_id": "…", "code": "123456" }
```

and `/api/v1/auth/phone/attach/{start,confirm}` for the other direction.

If the contact already belongs to **another** account, the attach is **refused**. It does not merge
accounts and it does not move the contact. Show the refusal and let the person sort out which account
they meant.

### The session

`GET /api/v1/auth/me` is the user, not the seller: identity, contacts, and the memberships this
person holds. It does **not** carry pending invitations — those are a seller concern and live at
`GET /api/v1/seller-invitations/pending`.

A person can hold memberships in several sellers. The console picks one and puts its id in every
path.

---

## Onboarding a seller

This is the longest flow in the console and the one most worth reading before building.

```
POST /api/v1/sellers                       create the seller, choose the kind
PUT  …/{seller_id}/seller-profile          the legal party
GET  …/{seller_id}/agreement               the terms, and whether they are accepted
PUT  …/{seller_id}/payout                  where money goes
POST …/{seller_id}/fulfillment-locations   at least one pickup point
GET  …/{seller_id}/readiness               what is still missing
POST …/{seller_id}/submit-for-review       hand it to an administrator
```

`GET …/readiness` is the screen's source of truth for "what is left". Drive your checklist from it
rather than tracking completeness yourself — it knows about requirements you do not.

### `kind`, and why the spec cannot tell you the shape

This is the one place the generated document actively misleads. `LegalIdentityRequest` appears in
`seller.json` as an abstract object with a single `inn` property and **no discriminator mapping on
the request side**. It looks as though `inn` is all you send. It is not.

The request body's shape depends on `kind`, and `kind` is required. Three values:

| `kind` | Who | Where the legal facts come from |
|---|---|---|
| `self_employed` | самозанятый | Nowhere — no registry to read. They type their own name. |
| `sole_proprietor` | ИП | The state registry, by ИНН. |
| `company` | организация | The state registry, by ИНН. |

**`self_employed`** — they *are* the legal party, so they supply the name on their tax record. There
is no director, because they hold no office.

```json
PUT /api/v1/sellers/{seller_id}/seller-profile
{
  "kind": "self_employed",
  "inn": "123456789012",
  "person": {
    "surname": "Петров",
    "name": "Иван",
    "patronymic": "Сергеевич"
  }
}
```

**`sole_proprietor`** and **`company`** — everything about the legal party is read from the registry
by ИНН. What the seller actually chooses is how they are taxed, and the registry does not report
that, so `taxation_system` is required. `vat_rate` is optional and means `none` when omitted.

```json
PUT /api/v1/sellers/{seller_id}/seller-profile
{
  "kind": "company",
  "inn": "7701234567",
  "taxation_system": "usn_income",
  "vat_rate": "none"
}
```

The two business kinds send identical fields today. Keep them distinct in your code anyway: an
organisation has a КПП and a director who is a different person, and the responses already differ.

`inn` is 12 digits for a person or ИП, 10 for an organisation.

**Prefilling the form.** `GET …/{seller_id}/seller-profile/lookup` asks the registry by the ИНН the
seller typed and returns what it found — legal name, registration number, address, and a
`chief_executive_prefill` for the director fields. Use it to fill the form; the seller still confirms
and submits. A lookup that finds nothing is not an error, it is an empty answer.

### The response, and reading it back

Responses **are** properly discriminated — `kind` is the discriminator and maps to exactly one shape
each. A field that cannot apply is **absent**, not null:

- `self_employed` carries `person`, and no `director`.
- `sole_proprietor` carries `legal_name`, `registration_number`, `legal_address`, `taxation_system`,
  `vat_rate`, `director`.
- `company` carries all of those **plus `kpp`**.

```json
{
  "legal_identity_id": "…",
  "kind": "company",
  "inn": "7701234567",
  "legal_name": "ООО «Прокат»",
  "registration_number": "1234567890123",
  "legal_address": "…",
  "taxation_system": "usn_income",
  "vat_rate": "none",
  "kpp": "770101001",
  "director": { "surname": "Петров", "name": "Иван", "patronymic": "Сергеевич", "position": "Генеральный директор" }
}
```

Switch on `kind` before touching anything beyond `legal_identity_id`, `inn` and `kind`. Do not
assume a field is there because the previous seller had it.

### The seller's own state machine

| Status | What it means | What the console shows |
|---|---|---|
| `draft` | Being filled in | The checklist from `readiness` |
| `pending_review` | Handed to an administrator | Read-only, "waiting" |
| `changes_requested` | Sent back with a message | The message, and the form open again |
| `active` | Selling | The full console |
| `suspended` | Stopped by an administrator | Read-only, with the reason |

`POST …/submit-for-review` refuses with `seller.not_ready` while anything required is missing, and
with `seller.transition_not_allowed` from a status that cannot submit. Both are 409 — do not treat
them as "try again".

---

## Pickup points

A **пункт проката** is the only address that does anything: it is where gear is handed over, it puts
the seller in a city, and it is what a product points at.

**The seller types an address; they do not pick a city.** You send the address text, the API asks the
address registry, and the city is resolved from FIAS. This matters for your form design — there is no
city dropdown to populate, and `GET /api/v1/catalog/cities` is **not** for this. That endpoint lists
cities where something is currently rentable, for the *customer* app's picker; a new seller with no
products would find it empty.

```json
POST /api/v1/sellers/{seller_id}/fulfillment-locations
{
  "name": "Прокат на Ленина",
  "address": "г Уфа, ул Ленина, д 10",
  "address_fias_id": "…",
  "latitude": 54.7351,
  "longitude": 55.9587
}
```

Send `address_fias_id` when you have one from `POST /api/v1/addresses/ru/geolocate` — it is exact.
Otherwise send `address` text and the API resolves it.

The address must reach a house or carry a map pin. City- or settlement-level alone is refused with
`location.address_imprecise` — "Уточните адрес до дома или укажите точку на карте". The other
refusals are `location.address_not_found`, `location.city_unresolved` and `location.city_not_supported`
(an administrator has deactivated that city).

### Opening hours

```json
PUT /api/v1/sellers/{seller_id}/fulfillment-locations/{fulfillment_location_id}/schedule
{
  "working_hours": [
    { "day": "monday", "opens_at": "09:00:00", "closes_at": "20:00:00" },
    { "day": "saturday", "opens_at": "10:00:00", "closes_at": "18:00:00" }
  ],
  "exceptions": [
    { "from": "2026-12-31", "to": "2027-01-02", "reason": "Новогодние праздники" },
    { "from": "2026-11-04", "to": "2026-11-04", "opens_at": "12:00:00", "closes_at": "16:00:00" }
  ]
}
```

A `PUT` replaces the whole schedule — send every day you are open, not just the one that changed. A
day absent from `working_hours` is closed. An exception with no `opens_at`/`closes_at` is a closed
day; with them, it overrides that day's hours.

`GET` on the same path reads it back in the same shape, so the form round-trips.

---

## Products

### The lifecycle

```
POST   …/products                      → draft
       fill: attributes, price, photos, cancellation policy, pickup point
POST   …/products/{id}/submit-for-review → pending_review
       an administrator decides
                                       → active   (selling)
                                       → changes_requested  (with a message)
                                       → rejected
POST   …/products/{id}/deactivate      active → paused
POST   …/products/{id}/activate        paused → active
POST   …/products/{id}/archive         → archived
DELETE …/products/{id}                 only while nothing references it
```

Creating a product gives you a **draft**, never something on sale. `submit-for-review` is refused
until every section is filled, and the response tells you which are not.

`GET …/products/{id}` carries a `sections` array — one entry per part of the card, each with
`is_complete` and a Russian `missing` sentence when it is not:

```json
"sections": [
  { "key": "basics",     "title": "Название и категория", "is_complete": true,  "missing": null },
  { "key": "photos",     "title": "Фотографии",           "is_complete": false, "missing": "Добавьте хотя бы одну фотографию." },
  { "key": "inventory",  "title": "Количество",           "is_complete": true,  "missing": null },
  { "key": "pricing",    "title": "Цена",                 "is_complete": true,  "missing": null },
  { "key": "policy",     "title": "Условия отмены",       "is_complete": true,  "missing": null },
  { "key": "location",   "title": "Где забирать",         "is_complete": true,  "missing": null },
  { "key": "attributes", "title": "Характеристики",       "is_complete": true,  "missing": null }
]
```

Render that directly. It is the same computation `submit-for-review` uses, so a card whose sections
are all complete will be accepted.

> **A card that is `active` can still be edited, and the edit goes live without review.** That is a
> known gap: the approval covers the card as it was approved. A draft-and-review mechanism is
> designed but not built — see `docs/product-drafts.design.md`. Until it lands, do not build UI that
> promises "your change will be reviewed".

### Creating and patching

```json
POST /api/v1/sellers/{seller_id}/products
{
  "title": "Прокат горного велосипеда",
  "description": "…",
  "category": "bicycle",
  "group_name": "Горные велосипеды Trek",
  "quantity": 3,
  "fulfillment_location_id": "5b86cc64-…",
  "booking_approval": "instant",
  "attributes": { "bike_type": "mountain", "frame_size": "19" }
}
```

`PATCH` on the same resource takes the same fields, all optional. **`null` means "leave alone", not
"clear".** The one deliberate exception is `group_name`: an empty string `""` takes the card out of
its group, `null` leaves the grouping as it is.

Category is patchable. It was not until 2026-09-30, and getting it wrong at creation meant deleting
the card and losing its price, photos and reviews with it. Changing it changes which attributes the
card may carry.

Price, cancellation policy, photos and description sections each have their own endpoint. They are
separate entities with their own history, not fields of the card.

### `group_name` — how the storefront collapses cards

Cards of one seller sharing a `group_name` show on the storefront as **one** card, the rest as
variants inside it. Empty means the card stands alone.

The list row tells you everything you need to render that grouping without a second call:

- `group_name` — the group, or null
- `group_size` — how many cards share it (1 when ungrouped)
- `is_group_face` — whether this is the one the storefront shows

The face is the oldest card of the group, smallest id breaking a tie — the same rule the storefront
uses, computed the same way, so the seller sees what the customer will.

### `booking_approval` — the two ways a card can be booked

| Value | What happens when a customer books |
|---|---|
| `instant` | Straight to payment. The default. |
| `seller_confirms` | The booking waits in `awaiting_seller_confirmation`. **No money is taken.** |

`GET …/products/authoring-options` returns both with Russian labels and descriptions for your picker,
and marks the default. Read it rather than hard-coding the two.

An unknown value is a 400. It is never silently coerced to `instant` — a seller who asked for
confirmation and did not get it would find out from the first customer who had already paid.

Switching an existing card does **not** move bookings already made. Requests already waiting keep
waiting; switching to `instant` does not auto-confirm them.

### Attributes

Two shapes, and they are **not** the same. This has bitten the console already.

**Reading** gives you a list of objects, because the console needs to know how to render each one:

```json
GET /api/v1/sellers/{seller_id}/products/{product_id}/attributes
{
  "product_id": "…",
  "attributes": [
    { "key": "bike_type",  "value_type": "enum",      "value": "mountain", "display_value": "Горный" },
    { "key": "frame_size", "value_type": "decimal",   "value": "19",       "display_value": null },
    { "key": "brand",      "value_type": "reference", "value": "forward",  "display_value": "Forward" }
  ]
}
```

- `value_type` is one of `string`, `integer`, `decimal`, `boolean`, `enum`, `reference` — pick the
  input control from it.
- `value` is the canonical form, and **the exact string you send back**.
- `display_value` is the human label for `enum` and `reference`; `null` when `value` is already
  presentable.

**Writing** takes a flat map of key to value:

```json
PUT /api/v1/sellers/{seller_id}/products/{product_id}/attributes
{
  "attributes": {
    "bike_type": "mountain",
    "frame_size": "19",
    "brand": "forward"
  }
}
```

**Do not send the read response back.** Spreading that array into an object produces
`{"0": {"key": "bike_type", …}, "brand": "…"}`, which is refused — an entry there would be stored
under the key `0`, which is not an attribute, and the card would silently disagree with what you
showed. Map it: each entry's `key` becomes the property name, each entry's `value` becomes the value.

A number or a boolean is accepted and coerced to its string form, so `"model_year": 2025` is fine.
An object or an array as a value is refused, with a message naming the key.

`PUT` replaces **all** attributes: what you send is what the card has. Sending half of them and
getting a merge with the old ones is a good way never to learn what the card actually says.

**What may be set** comes from the category:

```
GET /api/v1/sellers/{seller_id}/product-categories
GET /api/v1/sellers/{seller_id}/product-categories/{category_slug}/attributes
```

The response is `{ "category": { … }, "attributes": [ … ] }`. Each attribute carries:

| Field | Use |
|---|---|
| `key` | The property name to send in the write map |
| `name`, `hint` | Russian label and helper text for the field |
| `value_type` | Which input control: `string` · `integer` · `decimal` · `boolean` · `enum` · `reference` |
| `unit`, `unit_label` | `mm` and «мм» — the suffix beside the input |
| `is_required` | Blocks `submit-for-review` when empty |
| `min_value`, `max_value` | Numeric bounds, when they apply |
| `min_length`, `max_length` | Text bounds, when they apply |
| `group_key`, `group_name` | Which section of the form this belongs in |
| `sort_order` | Order within the group |
| `filterable` | Whether the storefront offers it as a filter |
| `allowed_values` | For `enum`: `value_key` to send, `name` to show, `sort_order` |

Keys and `value_key`s are Latin identifiers we seed — never localised text — so comparing them in
code is safe. The labels are always separate fields.

A value outside its bounds, or an enum value not in `allowed_values`, is a 400. An enum value is
normalised to the dictionary's spelling, so `"Mountain"` comes back as `"mountain"`.

### The list

Filter, sort and page are one RSQL query string. This replaced a call that returned every card the
seller had, with a price and a photo query for each.

```
GET /api/v1/sellers/{seller_id}/products
      ?filter=status==active
      &filter=status==active;title=contains=велосипед
      &sort=-updated_at
      &page=1
      &pageSize=20
```

The response is an envelope, not an array:

```json
{
  "items": [ … ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 57,
    "total_pages": 3,
    "has_previous_page": false,
    "has_next_page": true
  }
}
```

`total_items` counts the whole matching set, not the page — that is what your pager needs.

**`filter`** is RSQL. The operators that matter:

| Operator | Meaning | Example |
|---|---|---|
| `==` | equals | `status==active` |
| `!=` | not equals | `status!=archived` |
| `=gt=` `=ge=` `=lt=` `=le=` | ordering | `quantity=ge=1` |
| `=in=` `=out=` | set | `status=in=(active,paused)` |
| `=contains=` | substring | `title=contains=велосипед` |
| `=starts=` `=ends=` | prefix, suffix | `title=starts=Прокат` |
| `;` | and | `status==active;quantity=ge=1` |
| `,` | or | `status==active,status==paused` |
| `(` `)` | grouping | `(status==active,status==paused);quantity=ge=1` |

The substring operator is `=contains=`. It is not `=like=`.

Quote a value containing spaces or the syntax characters: `title=contains="горный велосипед"`.
URL-encode the whole string.

**Allowed fields** — an unlisted field is a 400 naming it, not a 500:

`product_id` · `title` · `status` · `quantity` · `group_name` · `booking_approval` · `category_id` ·
`fulfillment_location_id` · `created_at` · `updated_at`

Both spellings work — `updated_at` and `updatedAt` — so you can pass back the name you read out of
the response. Everything filterable is also sortable, and everything filterable is **in the row**:
we do not offer a filter for a column you cannot show.

**`sort`** is a comma-separated list of **fields**. Direction is a `-` prefix on the field, not a
separate token.

```
sort=-updated_at              newest first
sort=-updated_at,title        newest first, ties broken by title ascending
sort=title                    ascending
```

**`sort=updated_at,desc` is wrong** and answers `Sort field 'desc' is not allowlisted` — the comma
starts a second field, so `desc` is read as a field name. This is not the Spring Data
`field,direction` convention. There is no `asc`/`desc` keyword anywhere in this API.

Default is title ascending, then id. The trailing id is not decoration: without it a page can repeat
or drop a card when two share a title.

**`pageSize`** defaults to 20 and is capped at 100.

### The two slices a filter cannot express

Everything you would reach for a status with is a filter:

```
?filter=status==active
?filter=status=in=(paused,suspended)
?filter=status==pending_review
```

Two questions are not about the card's own columns, so they have their own endpoints:

```
GET /sellers/{seller_id}/products/needs-attention      no photo, or no active price,
                                                       or no cancellation terms, or no pickup point
GET /sellers/{seller_id}/products/ready-to-publish     everything filled in, not yet on sale
```

Both are ordinary lists — `filter`, `sort`, `page`, `pageSize` all work on them, so
`needs-attention?filter=status==active` is "on sale and still missing something".

**`needs_attention` is a condition, not a status.** A card can be on sale *and* missing a photo, so
it appears in both. Counting the two and expecting them to partition the catalogue will not work.

Required *attributes* are not part of either: they live in `jsonb` behind a value converter and SQL
cannot check them. They still block publication — they are simply not in these two queries.

### Price

```json
PUT /api/v1/sellers/{seller_id}/products/{product_id}/pricing-policy
{
  "pricing_mode": "rental_tiers",
  "rental_tiers": [
    { "up_to_hours": 2,  "price": 500,  "label": "до 2 часов" },
    { "up_to_hours": 12, "price": 1200, "label": "полдня" },
    { "up_to_hours": 24, "price": 2000, "label": "сутки" }
  ],
  "status": "active"
}
```

`rental_tiers` is the only pricing mode — `GET …/products/authoring-options` confirms it and is worth
reading rather than assuming. Tiers are brackets: a rental of up to `up_to_hours` costs `price`. Keep
them ascending.

`POST …/products/{product_id}/pricing-summary-preview` renders what the customer will see. It takes
**no body** — everything it needs is in the path. Send no `Content-Type` and no payload.

### Cancellation policy

```json
PUT /api/v1/sellers/{seller_id}/products/{product_id}/policy
{
  "lead_time_hours": 2,
  "is_cancellation_allowed": true,
  "no_show_charge_percent": 50,
  "deposit": { "unit": "percent", "value": 20 }
}
```

`lead_time_hours` is how far ahead a booking must be made.

**`is_cancellation_allowed: false` now actually blocks a cancellation.** Until 2026-10-01 it was read
only to build the estimate shown to the customer: the customer saw «отмена недоступна» and the
cancellation went through anyway.

> **Refund tiers are gone for now.** `cancellation_tiers` was removed from this endpoint on
> 2026-10-01. A seller set «48h → 100%, 24h → 50%», the customer was faithfully told «cancel now, get
> 50% back», and the cancellation read none of it — a hard-coded 12-hour window decided whether it was
> allowed, and the refund was always the full amount. A customer at 30 hours was promised 50% and
> given 100%; a customer at 6 hours was refused outright, though the seller's own terms allowed it.
> A setting nothing honours is worse than no setting. **Cancelling now refunds everything**, deposit
> included, and tiers return with the code that will enforce them.

A booking can be cancelled until it **starts**, which replaced that 12-hour window. The old threshold
was written down nowhere, so neither side could predict it; the start of the rental is a boundary
both understand.

### Photos

`multipart/form-data`, the only endpoint on this surface that is not JSON:

```
POST /api/v1/sellers/{seller_id}/products/{product_id}/images
Content-Type: multipart/form-data
files: <one or more files>
```

`image/jpeg`, `image/png`, `image/webp`; 5 MB each; ten per card.

`GET` lists them, each with a `url` to render, an `image_id`, and a `sort_order`.

`PUT …/images/order` takes **every** image id of the card, in the order you want:
`{ "image_ids": ["…", "…"] }`. A partial list is refused — the endpoint sets positions, it does not
move one item. The first is the cover.

`DELETE …/images/{image_id}` removes one, file and row together.

**The card's `media_preview_url` is the first uploaded photo.** Some seeded cards carry a stock URL
in a column that nothing in the API writes; it is used only when a card has no photos at all. Upload
one and it is replaced. There is no endpoint to set that column and there should not be.

If an upload, a delete or a reorder fails with a 500 and not a 400, that is ours: report it. Until
2026-09-30 delete answered 404 for a photo that was plainly in the list, reorder answered 400 for a
complete and correct list, and uploads answered 403 «Недостаточно прав для выполнения действия» —
which read like the seller lacking permission and was really the API unable to write to disk.

### Description sections

```json
PUT /api/v1/sellers/{seller_id}/products/{product_id}/info-sections
{
  "sections": [
    { "kind": "included", "items": ["Велосипед", "Шлем", "Насос"] },
    { "kind": "excluded", "items": ["Замок", "Услуги инструктора"] }
  ]
}
```

A `PUT` replaces the lot.

---

## Bookings

### What the seller sees

```
GET /api/v1/sellers/{seller_id}/bookings?filter=status==awaiting_seller_confirmation&sort=-created_at
GET /api/v1/sellers/{seller_id}/bookings/active
GET /api/v1/sellers/{seller_id}/bookings/{booking_id}
```

Same envelope and same RSQL rules as the product list — including the sort syntax, where descending
is `-start_at` and never `start_at,desc`. Allowed fields: `booking_id` · `booking_number` · `status` ·
`product_id` · `start_at` · `end_at` · `quantity` · `total_price` · `created_at` · `updated_at`. Both
spellings again. Default order is `start_at` ascending, then id.

`filter` replaces four parameters that could not be combined, so a range and a status is now one
expression: `filter=status==confirmed;start_at=ge=2026-10-01T00:00:00Z`.

The **list row** carries enough to recognise a booking without opening it — the product with its
photo and category, the customer's name and phone, the window, the quantity, and the handover stage.
It deliberately omits the customer's **email**: a name identifies the booking and a phone reaches
them. The email is in the detail, which is opened on purpose.

Slices are filters, with one exception:

```
?filter=status==awaiting_seller_confirmation      waiting on you
?filter=status==pending                           waiting on the customer to pay
?filter=status=in=(cancelled,expired,failed)      closed without a rental
?filter=status==confirmed;start_at=ge=2026-10-02T00:00:00%2B05:00;start_at=lt=2026-10-03T00:00:00%2B05:00
                                                  handovers for one day — you supply the bounds
```

`GET /sellers/{seller_id}/bookings/active` is the exception: handed over and not yet returned. That
reads the fulfillment row, which `filter` does not reach.

### `status` is the booking's status

Not the handover's. It used to be a blend, where `completed` meant either a finished booking or a
returned item, and neither could be filtered in the database.

| `status` | Meaning |
|---|---|
| `awaiting_seller_confirmation` | A request on a `seller_confirms` card. Nothing charged. |
| `pending` | Waiting for the customer to pay. Holds the item for 15 minutes. |
| `confirmed` | Paid and live. |
| `completed` | Finished. |
| `cancelled` | Cancelled by someone. |
| `expired` | Nobody acted in time. |
| `reversed` · `failed` | Payment went wrong. |

Handover progress is beside it, in `fulfillment`:

```json
"fulfillment": {
  "stage": "pending_handover",
  "handover_allowed": true,
  "return_allowed": false,
  "completion_allowed": false,
  "has_issue": false
}
```

`stage` runs `pending_handover` → `active` → `returned` → `completed`, with `issue_reported` cutting
across. A booking that has not been touched yet has no fulfillment row at all, and reads
`pending_handover`.

The three `*_allowed` flags are what the row's buttons should be driven by. They are the same rules
the command endpoints enforce, so a button that is enabled here will be accepted there — and
`handover_allowed` is false for a booking that is not `confirmed`, which is how an unpaid booking and
an unanswered request stay un-handed-over.

> **There is no separate fulfillment queue.** `GET /sellers/{seller_id}/fulfillment` was removed on
> 2026-10-01. It read a table that only the first handover writes, so it answered `[]` to every call
> ever made to it, and its row carried a bare product id with no title or photo. Use the booking list
> with a `start_at` range for a day's handovers, or `GET .../bookings/active` for what is out right
> now; the row carries the product, the customer and the three flags above.

### Confirming and declining a request

Only for `awaiting_seller_confirmation`.

```
POST /api/v1/sellers/{seller_id}/bookings/{booking_id}/confirm
```

**No body.** Everything it needs is in the path.

```json
POST /api/v1/sellers/{seller_id}/bookings/{booking_id}/decline
{ "reason_code": "unavailable", "comment": "Этот размер рамы уже забрали." }
```

Both answer:

```json
{
  "booking_id": "…",
  "status": "pending",
  "reason_code": null,
  "decided_at": "2026-09-30T14:03:22+05:00"
}
```

**Confirm moves the booking to `pending`, not to `confirmed`.** It opens the customer's payment
window; it does not complete the booking. The customer still has to pay. Word your UI accordingly —
"заявка подтверждена, ждём оплату", not "бронь подтверждена".

Decline moves it to `cancelled` and releases the item. There is nothing to refund, because nothing
was charged.

Any other status answers **409 `booking.not_awaiting_confirmation`**. Treat that as "somebody already
handled this" — refresh the row, do not retry. It is what protects you from a double tap and from two
managers with the same request open.

**There is a deadline.** A request unanswered for **24 hours** expires on its own: the booking becomes
`expired`, the item is released, and the customer is told the seller did not answer. Show the age of a
request, or sellers will not know they are on a clock.

### Cancelling a booking

```json
POST /api/v1/sellers/{seller_id}/bookings/{booking_id}/cancel
{ "reason_code": "equipment_damaged", "comment": "Велосипед сломался, приносим извинения." }
```

**The customer is refunded in full, always** — whatever the hour, and even on a product whose
`is_cancellation_allowed` is false. Refund rules price a customer changing their mind; they have no
business charging a customer for a seller who cannot deliver. The `comment` reaches the customer by
email, so write it for them.

Before 2026-10-01 a seller could not cancel at all: cancellation matched on the customer's id, so it
existed only for them. Declining is available only *before* confirming — and gear breaks after.

Terminal bookings answer `already_terminal`, which is safe to have double-tapped.

### Handing over and taking back

```
POST …/bookings/{booking_id}/handover      { "handed_over_at": "…", "note": "…", "handover_metadata": [ … ] }
POST …/bookings/{booking_id}/return        { … }
POST …/bookings/{booking_id}/complete      { … }
POST …/bookings/{booking_id}/report-issue  { … }
GET  …/bookings/{booking_id}/fulfillment
```

`handover` is only allowed on a **confirmed** booking. An unpaid one, or a request the seller has not
answered, is refused. The fulfillment row is created by the first handover, so a booking with no row
is simply one that has not been handed over yet — not an error and not a missing record.

Each command answers with an `outcome`: `accepted`, `already_applied` (idempotent, safe to have
double-tapped), or `rejected` with a reason code. Read it rather than assuming success from a 200.

`GET …/bookings/{booking_id}/fulfillment` is the per-booking state, for a screen that needs the
handover and return notes, the condition summary and the issue summary without the whole booking. It
works before the first handover too, reporting `pending_handover` — until 2026-10-01 it answered 404
for any real booking, because the row it read did not exist yet.

---

## The team

```
GET    …/{seller_id}/members
GET    …/{seller_id}/members/options          roles you may assign
POST   …/{seller_id}/members/invitations      invite by phone or email
GET    …/{seller_id}/members/invitations      outstanding invitations
PUT    …/{seller_id}/members/{membership_id}/role
DELETE …/{seller_id}/members/{membership_id}
```

From the invitee's side: `GET /api/v1/seller-invitations/pending` and
`POST /api/v1/seller-invitations/accept`. Those are on the **user**, not the seller, which is why they
are not under `/sellers/{seller_id}` and why `auth/me` does not carry them.

Read `members/options` for the assignable roles rather than hard-coding them.

---

## Payouts

```
GET /api/v1/sellers/{seller_id}/payout
PUT /api/v1/sellers/{seller_id}/payout
GET /api/v1/payment-reference/sbp-members     bank list for the picker
```

Registration with the acquirer happens behind `PUT`. It can fail for reasons outside our control:
**422 `acquiring.shop_registration_failed`**, with what the bank said in `detail`. Show that text —
it usually names the field to correct — and let the seller retry.

---

## Reading a failure

`docs/api/errors.md` is the full list. The ones you will meet most:

| Status | `code` | What it actually means |
|---|---|---|
| 400 | `bad_request` | Your payload. Read `errors` — it names the field. |
| 401 | `unauthorized` | No session, or it expired. Re-authenticate. |
| 403 | `forbidden` | This seller is not yours. Not "missing a role". |
| 404 | `not_found` | Or it exists and is not in your scope — the two are deliberately indistinguishable. |
| 409 | `seller.not_ready` | Something required is still missing. Re-read `readiness`. |
| 409 | `seller.transition_not_allowed` | Wrong status for this action. Refresh. |
| 409 | `booking.not_awaiting_confirmation` | Already handled. Refresh the row. |
| 409 | `location.city_not_supported` | An administrator deactivated that city. |
| 400 | `location.address_imprecise` | Needs a house number or a map pin. |
| 500 | `internal_error` | Ours. The response carries nothing useful on purpose; tell us the time and the path and we will read the log. |

A 500 is always worth reporting, even if a retry works. Several of the bugs fixed this week were
found because somebody said "it answered 403 and that made no sense".
