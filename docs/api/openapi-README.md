# OpenAPI Specs

Three documents, one per audience. The API builds them itself — see the `SwaggerDocument` calls in
`IServiceCollectionExtesions.cs` — and each one filters the endpoint list by route prefix, so a
console only sees the surface it is allowed to call.

| File | Document | Serves | Size |
|---|---|---|---|
| [`app.json`](app.json) | Sportgearhub App API | the customer app: auth, discovery, marketplace products, checkout, bookings | 46 paths · 48 operations |
| [`seller.json`](seller.json) | Sportgearhub Seller CRM API | the seller console: auth, onboarding, everything under `/api/v1/seller` | 78 paths · 94 operations |
| [`admin.json`](admin.json) | Sportgearhub Admin API | the internal console: auth and everything under `/internal` | 62 paths · 67 operations |

Auth (`/api/v1/auth`, `/connect`) is in all three, because all three sign in the same way.

## Regenerating

The specs are only served when Swagger is on, which it is in Development. Run the API against an
in-memory database with every integration disabled — never against live credentials — and fetch
each document. The signing key is only there to satisfy startup validation — generate a throwaway
one and delete it afterwards:

```bash
# A key that exists for the length of this shell and signs nothing real.
openssl genrsa 2048 | openssl rsa -outform DER | base64 | tr -d '\n' > /tmp/rsa.b64

ASPNETCORE_ENVIRONMENT=Development \
ASPNETCORE_URLS=http://127.0.0.1:5093 \
Database__Provider=InMemory Database__InMemoryDatabaseName=swagger \
AdminBootstrap__Enabled=false Dadata__Enabled=false \
Oidc__Jwt__SigningPrivateKeyBase64="$(cat /tmp/rsa.b64)" \
Oidc__Jwt__EncryptionSecret="swagger-only-not-a-real-secret-0123456789" \
dotnet run --project src/EbashIT.Sportgearhub.Api --no-launch-profile &

for d in app seller admin; do
  curl -s "http://127.0.0.1:5093/swagger/$d/swagger.json" \
    | python3 -m json.tool --no-ensure-ascii --indent 2 > docs/api/openapi/$d.json
done
```

A document that returns 500 is usually the schema generator refusing a type, not a broken endpoint;
the reason is in the API log, and one bad type takes the whole document with it. An abstract record
in the middle of a `[JsonPolymorphic]` hierarchy does exactly that — it has no discriminator of its
own, and `seller` and `admin` both failed outright until it was flattened away.

They are pretty-printed with two-space indentation so a regeneration diffs line by line instead of
showing one changed line of minified JSON.

## Reading them

Path parameters are snake_case in the spec (`{seller_id}`, `{product_id}`) because the serializer's
naming policy reaches route bindings too. Some routes mix both spellings, because the outer id is
bound from the route template and the inner from the request type. It is cosmetic: the URL you send
substitutes a value either way.

Request and response bodies are snake_case in both directions.
