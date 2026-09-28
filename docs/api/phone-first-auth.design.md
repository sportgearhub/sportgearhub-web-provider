# Phone-First Authentication — What Signs In, What Is Just a Contact (DECIDED)

> Status: **implemented on branch `rental-first-simplification`, 2026-09-23.** Records the
> decision and its consequences; the code is the reference for details.

## The decision

**The phone number is the identity and the only way in.** Proof is the existing phone flow —
MTS ID push through Verificahub, falling back to an SMS code — and the trusted-device passcode
for repeat sign-ins. **Email is a profile attribute**: optional, attached after sign-in, proved by
a one-time code, used for receipts and notifications. It is never a way in.

This is the model the audience already lives in — Ozon, Avito and Яндекс are phone-as-identity —
and it fits a product used at a rental counter and on a beach, where nobody wants a mailbox.

## What went, and why each was a liability rather than a redundancy

| Removed | Why it had to go |
|---|---|
| Email OTP sign-in, magic links, verification links, email registration | A second identity path, which the admin console used and the CRM half-used; two doors means the weaker one is the real one |
| `RegisterByPhoneAsync` + `/auth/phone/register` | Created an account with `PhoneVerified = false` and no code sent — anyone could register any number |
| Invitation acceptance by emailed token | Created an account with `EmailVerified = true` from a link alone; whoever held the link was the invitee |
| Google / Yandex OAuth, `ExternalAuthProviders` | Disabled in production, three seed rows, a whole OpenIddict client and settings surface for nothing |
| `/api/auth/*` route aliases (nine) | Every client already calls `/api/v1/*` |

## Invitations, redesigned

Addressed to a number, not delivered to it:

1. The inviter enters a phone and a role. One open invitation per number per provider;
   inviting again refreshes it. Open for seven days.
2. The invitee signs in with that phone the ordinary way.
3. `GET /api/v1/provider-invitations/pending` lists what is waiting for their verified number.
4. `POST /api/v1/provider-invitations/accept { invitation_id }` joins — allowed only when the
   signed-in account's verified phone is the invited one.

No token, no message, no account creation. The only thing that proves a number is the sign-in,
so that is the only thing an invitation trusts.

## What stays

- `User.Email` / `EmailVerified`, and the attach/change-email codes over SMTP.
- `Verifications` for phone sign-in and email attachment; `TrustedDevices` and the passcode.
- Admin bootstrap by **email or phone** — it already supported both.

## Consequences that are decisions, not code

- **Both production admin accounts have no phone.** Grant `Admin` to the phone-verified account,
  or set `AdminBootstrap__Phone`. Until then the admin console has no way in.
- **The admin console must adopt the phone screens** (`authApi.ts` still calls the removed email
  endpoints and a `/auth/login` that never existed). The CRM already has them; its leftover email
  calls and its email-based invitation screens are dead and should be removed.
- `ExternalOAuth__*` keys in production configuration are now unused.

## Open

- Rate limiting per number and per IP on `/auth/phone/start`.
- Session and device revocation when a user changes their phone.
- SMS cost visibility — every fallback is a paid message.
