# Sign-In And Seller Onboarding Flow

Rewritten 2026-09-30. The previous version drew an `OnboardingApplication` that a review turned into
a provider, over `/provider-onboarding/*` routes and an email OTP sign-in. None of that exists: the
phone is the identity, the seller is created first, and review gates publishing rather than creation.

## Signing in

The phone number is the identity and the only way in. Email is a contact that can be attached
afterwards, never a way to sign in.

```mermaid
flowchart TD
    U[User] --> A[Enter phone number]
    A --> B[POST /auth/phone/start]
    B --> C[Enter code from SMS]
    C --> D[POST /auth/phone/verify-code]
    D --> E{Known user?}
    E -->|No| F[POST /auth/phone/complete-registration]
    E -->|Yes| G[Tokens issued]
    F --> G
    G --> H[GET /auth/me]
    H --> I[Sellers this person belongs to, and pending invitations]
```

A trusted device may then sign in with a passcode instead of an SMS code, via
`/auth/passcode/sign-in`.

## Becoming a seller

Register first, publish after review. The seller row exists as soon as it is created, so the console
is usable immediately; what review gates is being visible to customers and being paid.

```mermaid
flowchart TD
    A[GET /auth/me] --> B{Belongs to a seller?}
    B -->|Invited| C[POST /seller-invitations/accept]
    B -->|No| D[GET /sellers/seller-lookup by ИНН]
    D --> E[POST /sellers]
    E --> F[Seller created, owner membership granted]
    C --> F
    F --> G[PATCH profile and seller-profile]
    G --> H[POST payout requisites]
    H --> I[POST agreement acceptance]
    I --> J[GET readiness]
    J -->|Incomplete| G
    J -->|Complete| K[POST submit-for-review]
    K --> L[Internal review]
    L -->|Changes requested| G
    L -->|Approved| M[Seller is public and payable]
    M --> N[Create products and pickup points]
    N --> O[Receive bookings]
```

`GET /sellers/{sellerId}/readiness` is the console's checklist: it says what is still missing and
whether the seller can submit, be published, and be paid. It computes from facts rather than storing
a state.

## Where the details are

The routes above are abbreviated; the full contract is in
[`../api/openapi/seller.json`](../api/openapi/seller.json). The decisions behind the flow are in
[`../phone-first-auth.design.md`](../phone-first-auth.design.md) and
[`../seller-onboarding-redesign.design.md`](../seller-onboarding-redesign.design.md).
