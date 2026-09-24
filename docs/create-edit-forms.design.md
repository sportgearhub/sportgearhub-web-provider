# Create And Edit Forms

> Status: **built 2026-09-24** (`src/components/form/*`, `ResourceForm`, `OfferForm`). How the
> console's create/edit pages are shaped, and what was taken from Ozon Seller's «Создание товара».

## What Ozon does, and why it works

The screen a seller sees when adding a product (`seller.ozon.ru → Товары → Добавить товары`):

1. **One column, sections as headings, not cards.** «Информация о товаре», «Габариты и вес»,
   «Изображения» are `h2`s with fields stacked under them. The page is the container; there is
   no card inside a card. A narrow column (~400 px) keeps every label within the eye's reach of
   its box.
2. **Floating labels.** The label sits inside the box and floats to the top once there is a
   value. The form reads as a list of named boxes; nothing is above the box competing with the
   previous field's help text. Required fields carry `*` in the label.
3. **Help under the box, not tooltips.** «Штрихкод нужен для компенсации при утере» sits under
   the field in grey; errors take the same slot in red.
4. **Picker rows for choices with weight.** «Категория и тип ›» is a row with a chevron that
   opens a sheet with search — a dropdown would be too small for a tree with descriptions.
   Short enumerations (НДС) stay a select with `⌄`.
5. **Pairs on one line only when they are a pair.** «Предельная цена» / «Зачёркнутая цена»
   share a row; dimensions stack one per line despite being numbers — clarity over density.
6. **Images as a grid with the main tile larger**, plus explicit «Добавить фото».
7. **A two-step stepper** — «1 Информация о товаре · 2 Предварительный просмотр» — instead of a
   multi-page wizard. Step one is the whole form; step two is what the buyer will see.
8. **The bottom bar**: «Отмена» and «Заполнить больше» on the left, «Завершить создание» on
   the right. The required minimum finishes the job; everything optional is a click away and
   never blocks completion.

## What the console does now

`src/components/form/`:

| Piece | Ozon counterpart | Notes |
|---|---|---|
| `FloatingInput`, `FloatingTextarea` | the field | 56 px box, label floats, `suffix` for units (₽, ч), hint/error under |
| `FloatingSelect` | «НДС ⌄» | native select in the same box |
| `PickerRow` | «Категория и тип ›» | opens a sheet: search, one line per option with description, optional footer link |
| `FieldRow` | price pair | two (or three) fields on one line |
| `FormPage` / `FormSection` | page + `h2`s | `max-w-xl` column, sections spaced by rhythm, no cards |
| `FormStepper` | «1 · 2» | numbered; done steps are clickable |
| `ChoiceCards` | — | radio cards for a choice that needs a sentence (pricing mode, visibility) |
| `ActionBar` | bottom bar | fixed to the viewport bottom; left secondary, right primary, save error beside it |

**Позиция** (`ResourceForm`): «Информация о позиции» (Категория ›, Название) → «Характеристики»
(brand typeahead + model on one line, the category's fields two to a row, required from
`requiredOn`) → «Изображения» (main tile 2×2, then small tiles). Create: step 2 is the catalogue
card built from the form. Edit: no stepper, «Сохранить».

**Предложение** (`OfferForm`): «Информация о предложении» (Название, Инвентарь, Пункт проката ›
with «Добавить пункт проката» in the sheet's footer, Тип, Бронирование, Описание) → «Цена»
(mode as choice cards, then either one price with ₽ or the tier rows) → «Заполнить больше»
reveals «Информация для клиента», «Доступность», «Видимость». Create: step 2 is the client's
card — title, price lines, пункт, booking, lists, and a plain sentence about availability. The
former four-step wizard is gone: a seller who only knows the price and the пункт finishes in
one screen, and nothing optional stands in the way.

Validation runs once, on «Далее» / «Сохранить», marks fields inline and scrolls to the first
problem; sections hidden behind «Заполнить больше» open themselves when they hold an error.

## Not done yet

- **«Как создать …» help link** next to the title — waits for the docs site to have the page.
- `LocationsPage`'s inline form and the settings forms still use the old `Input`; move them to
  the kit when they are next touched.
- `StringListEditor`, `DateRangePicker`, `TimeSelect` keep their compact style inside the
  optional sections; a floating variant is a follow-up.
