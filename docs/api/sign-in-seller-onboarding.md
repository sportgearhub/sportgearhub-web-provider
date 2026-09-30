# Sign-In And Seller Onboarding Flow

Rewritten 2026-09-30. The previous version drew an `OnboardingApplication` that a review turned into
a provider, over `/provider-onboarding/*` routes and an email OTP sign-in. None of that exists: the
phone is the identity, the seller is created first, and review gates publishing rather than creation.

## Signing in

The phone number and the email address are both credentials. Whichever one someone joined with, they
can add the other from inside their session and then sign in with either — see
[`../two-ways-in-auth.design.md`](../two-ways-in-auth.design.md).

```mermaid
flowchart TD
    U[User] --> A{Phone or email}
    A -->|Phone| B[POST /auth/phone/start]
    A -->|Email| C[POST /auth/email/start]
    B --> D[Enter code from SMS]
    C --> E[Enter code from the mailbox]
    D --> F[POST /auth/phone/verify-code]
    E --> G[POST /auth/email/verify-code]
    F --> H{Known contact?}
    G --> H
    H -->|No| I[complete-registration for that channel]
    H -->|Yes| J[Tokens issued]
    I --> J
    J --> K[GET /auth/me]
    K --> L[Sellers this person belongs to, and pending invitations]
```

A trusted device may then sign in with a passcode instead of a code, via `/auth/passcode/sign-in`.

The second contact is added from inside the session and proved the same way: `attach/start` then
`attach/confirm`, on `/auth/phone/` or `/auth/email/`.

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
