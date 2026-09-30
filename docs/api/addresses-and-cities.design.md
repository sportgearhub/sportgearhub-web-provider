# Addresses And Cities

> Status: **built 2026-09-24, then changed on 2026-09-30.** How a пункт проката gets an address, what
> we validate, and where cities come from.
>
> What this document still gets right: the address registry lookup, the ФИАС id as the join key, and
> the decision that an operator types an address rather than picking a city. What changed after it was
> written, and is **not** corrected in the body below:
>
> - `provider_fulfillment_locations` is now `seller.fulfillment_locations`, and
>   `ProviderLocationService` is `SellerLocationService`
> - `address_fias_id` is **required**, not optional — a пункт that cannot say where it is is not a
>   пункт. Latitude and longitude stay optional and an operator can correct the map pin
> - the city's `timezone` column is **gone**, not merely unused: the interface knows the viewer's zone
> - cities are curated and seeded by hand. They are no longer created as a side effect of resolving an
>   address
> - a пункт now carries opening hours and schedule exceptions as `jsonb`, which this document
>   anticipated as later work

## Where an address appears

| Place | What it is | Who provides it |
|---|---|---|
| **Пункт проката** (`provider_fulfillment_locations`) | where gear is handed over: the only address the product *acts on* — catalogue city, map pin, distance | the seller |
| Seller profile `legal_address` | the registry's юридический адрес; goes to the bank, never to a customer | Dadata, from the ИНН |
| Provider profile `address` | free text shown on the storefront | the seller; display only, no logic |

Everything below is about the first one.

## What happens today, and why it is fragile

The console shows registry suggestions, the seller picks one, and the console sends **the text**.
The API then asks the registry *again* with that text, takes the first hit and reads its city.

- The second lookup can land on a different suggestion than the one the seller picked.
- Nothing checks the address is precise enough to hand gear over at — "Уфа, ул. Ленина" passes.
- The city is matched **by name** against a hand-seeded list, so a village, «Санкт-Петербург»
  vs «г Санкт-Петербург», or a town nobody seeded fails with «город не поддерживается».
- A pin dropped on the map and an address typed by hand are indistinguishable from a picked one.

## Proposal: send what was selected, resolve by id, validate at the level that matters

### 1. The console sends an identity, not a string

The registry gives every suggestion a stable **FIAS id**. The address input keeps it as hidden
state next to the label; editing the text after a selection clears it. The map picker
reverse-geocodes the pin (`/addresses/ru/geolocate`, already there) and yields a suggestion
the same way. So the request is one of:

```jsonc
{ "address_fias_id": "…", "address": "г Уфа, ул Ленина, д 1", "name": "…", "latitude": 54.73, "longitude": 55.97 }   // picked, pin optional
{ "latitude": 54.7388, "longitude": 55.9721, "name": "Пляж Солнечный, у причала" }                                   // pin only
```

Free text with neither id nor pin is refused: `422 location.address_not_selected` — «Выберите
адрес из подсказок или укажите точку на карте». The seller cannot save something the registry
never saw.

### 2. The API resolves the id once and keeps the canonical record

`FindAddress(fias_id)` (or `Geolocate(lat, lon)` for a pin) returns the structured address. We
store, on the пункт:

| Column | From |
|---|---|
| `address` | `unrestricted_value` — the registry's spelling, not the seller's |
| `address_fias_id` | `fias_id` |
| `address_level` | `fias_level` (4 city · 6 settlement · 7 street · 8 house) |
| `latitude`, `longitude` | the seller's pin, else the registry's `geo_lat/geo_lon` when `qc_geo ≤ 1` (house / nearest house) |
| `city_id` | the city whose FIAS is `city_fias_id ?? settlement_fias_id` (see §3) |

### 3. Validation — three rules, all about handing gear over

1. **Resolvable**: the id must resolve in the registry (or the pin must reverse-geocode).
2. **Precise enough**: a house-level address (`fias_level = 8`) stands on its own. A street or
   lower without a house — a beach, a park, a pier — is fine **only with a pin** the seller placed;
   the pin is the address then, and `name` is the human label («Пляж Солнечный, у причала»).
   City- or settlement-level alone is refused: «Уточните адрес до дома или укажите точку на карте».
3. **In a city**: the record must carry `city_fias_id` or `settlement_fias_id`. The registry
   always has one for anything below region level; if it does not, the address is not one a
   customer can travel to.

Nothing else. Working hours, contact phone and the like are separate concerns and already
absent from the model.

## Cities: keyed by FIAS, born from the first пункт

`cities` used to be a hand-seeded list matched by name. Now:

- **`cities.fias_id`** (required, unique) is the only key. Names are not a key: the registry has
  three «Москва» (the capital and two villages), «Киров» twice, «Благовещенск» twice — a
  name-match would file a seller from one under the other. The two seeded rows were back-filled
  by migration `CityFiasIdRequired` with ids confirmed against the live registry on 2026-09-24
  (Уфа `7339e834-…`, Екатеринбург `2763c110-…`); the migration refuses to run while any row is
  still without an id.
- **A city is created on demand** when an address resolves to a `city_fias_id` (or, failing
  that, a `settlement_fias_id`) the table does not have: `name`, `region`, `country_code`,
  transliterated unique `slug`, `is_active = true`, `timezone = null`. No admin step stands
  between a seller in a new town and their first listing — that is the rental-first rule. An
  admin can still set `is_active = false`, which hides the city from the customer app and blocks
  new пункты there (`location.city_not_supported`).
- A new city is a log line, nothing more.

The customer app's city list (`GET /catalog/cities`) is **active cities with at least one public
offer** — a query, not the table — so a city with a single draft provider does not appear as an
empty page.

**Timezone.** Not derived here. Availability windows will get their zone on the пункт (or the
offer schedule) when that is designed; the city's `timezone` column stays as it is for the seeded
rows and null for new ones.

**Villages and the two capitals.** A settlement without a city (`settlement_fias_id` only) is a
city row of its own — that is where the seller is. Москва and Санкт-Петербург arrive with
`city_fias_id` set like anywhere else.

## What this changes in the API

| Now | Proposed |
|---|---|
| `POST …/fulfillment-locations { address, name?, latitude?, longitude?, city_id? }` | `{ address_fias_id?, address?, name?, latitude?, longitude? }` — `city_id` override removed |
| second registry query by text | `FindAddress(fias_id)` / `Geolocate(pin)` |
| city by name | city by FIAS, auto-created |
| no precision check | rules 1–3 above |
| `AddressSuggestionResponse` without ids | add `city_fias_id`, `settlement_fias_id`, `fias_level`, `qc_geo`, `region_iso_code` — the client already exposes them |

Migrations: `AddressFiasIds` adds `cities.fias_id` and
`provider_fulfillment_locations.address_fias_id`; `CityFiasIdRequired` back-fills the seeded
cities and makes the key mandatory. Existing пункты keep working (no address id) and get one the
next time their address is changed.

Errors (all `422`): `location.address_not_selected` (neither id nor pin),
`location.address_not_found` (id unknown to the registry), `location.address_imprecise`
(street or coarser without a pin), `location.city_unresolved` (nothing known about the point),
`location.city_not_supported` (city switched off).

## Console

- `AddressAutocomplete` already hands back the whole suggestion; the form keeps `fiasId` and
  `geo` hidden and shows the label. Typing again clears the id and the save button says why.
- «На карте» returns the reverse-geocoded suggestion, not just a string, so a pin also carries
  an id when the registry knows the spot.
- The saved пункт shows the registry's spelling; the seller's `name` is what they see in lists.

## Settled

- The registry's coordinates are trusted at `qc_geo ≤ 1` (exact or nearest house); coarser ones
  are dropped and the seller's pin, when given, always wins.
- No "new city" notification; no city timezone derivation.

## Proposal: what a city row should hold

What is stored today is scraped off the *house* record that created the city: `name` and
`region` as they appear in that address. It works, but a city deserves its own registry record.
The registry has one — `FindAddress(city_fias_id)` returns the city object itself (level 4, or
level 6 for a settlement, or level 1 for Москва/Санкт-Петербург/Севастополь) with the fields a
city page needs. One extra registry call per *new city* — a rare event — and the row becomes:

| Column | From | Why |
|---|---|---|
| `fias_id` (key) | `city_fias_id ?? settlement_fias_id` | identity; already done |
| `name` | city object `city` / `settlement` | «Уфа» |
| `name_with_type` | `city_with_type` / `settlement_with_type` | «г Уфа», «деревня Москва» — disambiguates the three Москвы in lists and URLs |
| `kind` | `fias_level` (1/4 → city, 6 → settlement) | customer app can show towns and villages differently |
| `region`, `region_iso_code`, `region_fias_id` | `region_with_type`, `region_iso_code`, `region_fias_id` | grouping, «Уфа, Респ Башкортостан» in the picker, and the later timezone table keys on `region_iso_code` |
| `center_lat`, `center_lon` | city object `geo_lat/geo_lon` (qc_geo 4 = centre) | default map centre and «рядом со мной» distance without a second lookup |
| `slug` | transliterated, unique | URLs; kept |
| `is_active` | admin | kept |
| `timezone` | *not here* | belongs to the пункт's schedule; decided 2026-09-24 |

Not proposed: `kladr_id` (legacy, registry is moving to ГАР ids which Dadata already returns as
`fias_id`), `population` or ranking (order the picker by offer count instead), and any
hand-maintained city list — the table stays a cache of registry objects that sellers have
actually used, never a catalogue to curate.

Recommendation: do it now while the table has two rows. Add the six columns, fill them in the
same `FindOrCreateCityAsync` path (one `FindAddress` call for a new city), back-fill Уфа and
Екатеринбург in the migration from the same call, and show `name_with_type` + region in the
customer picker. Nothing in the console changes.
