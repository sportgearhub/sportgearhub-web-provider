# OpenAPI Specs

Three documents, one per audience. The API builds them itself — see the `SwaggerDocument` calls in
`IServiceCollectionExtesions.cs` — and each one filters the endpoint list by route prefix, so a
console only sees the surface it is allowed to call.

| File | Document | Serves | Size |
|---|---|---|---|
| [`app.json`](app.json) | Sportgearhub App API | the customer app: auth, discovery, marketplace offers, checkout, bookings, storefronts | 50 paths · 52 operations |
| [`provider.json`](provider.json) | Sportgearhub Provider CRM API | the seller console: auth, onboarding, everything under `/api/v1/providers/{id}` | 83 paths · 101 operations |
| [`admin.json`](admin.json) | Sportgearhub Admin API | the internal console: auth and everything under `/internal` | 67 paths · 73 operations |

Auth (`/api/v1/auth`, `/connect`) is in all three, because all three sign in the same way.

## Regenerating

The specs are only served when Swagger is on, which it is in Development. Run the API against an
in-memory database with every integration disabled — never against live credentials — and fetch
each document:

```bash
ASPNETCORE_ENVIRONMENT=Development \
ASPNETCORE_URLS=http://127.0.0.1:5093 \
Database__Provider=InMemory Database__InMemoryDatabaseName=swagger \
AdminBootstrap__Enabled=false Dadata__Enabled=false \
Oidc__Jwt__SigningPrivateKeyBase64=<any RSA key> \
Oidc__Jwt__EncryptionSecret=<any string> \
dotnet run --project src/EbashIT.Sportgearhub.Api --no-launch-profile &

for d in app provider admin; do
  curl -s "http://127.0.0.1:5093/swagger/$d/swagger.json" \
    | python3 -m json.tool --no-ensure-ascii > docs/api/openapi/$d.json
done
```

They are pretty-printed with two-space indentation so a regeneration diffs line by line instead of
showing one changed line of minified JSON.

## Reading them

Path parameters are snake_case in the spec (`{provider_id}`, `{offer_id}`) because the serializer's
naming policy reaches route bindings too. Two routes are inconsistent — `/api/v1/providers/{providerId}/offers/{offer_id}`
mixes both — because the outer id is bound from the route template and the inner from the request
type. It is cosmetic: the URL you send substitutes a value either way.

Request and response bodies are snake_case in both directions.
