import type {
  Provider,
  AuthUser,
  ProviderMembership,
  ProviderMember,
  ProviderMemberInvitationResult,
  ProviderMemberOptions,
  ProviderInvitation,
  CatalogCity,
  ProviderLocation,
  DashboardResponse,
  Resource,
  ResourceImage,
  CapacitySlot,
  AvailabilityDiagnostics,
  ResourceInventorySummary,
  ResourceUnit,
  ResourceUnitInput,
  ResourceVariant,
  VariantAllocation,
  PricingPolicy,
  PricingQuotePreview,
  PricingDiagnostics,
  PayoutContract,
  OfferPolicy,
  OfferPolicyInput,
  Offer,
  OfferAvailability,
  OfferAvailabilityWindow,
  OfferAvailabilityBlockedPeriod,
  OfferReadiness,
  OfferRoutability,
  OfferPublishability,
  OfferVisibility,
  OfferInfoSection,
  OfferInfoSections,
  OfferAuthoringOptions,
  BookingListItem,
  BookingDetail,
  BookingStatus,
  FulfillmentCommandResult,
  AcquiringConnection,
  AcquiringDealBinding,
  AcquiringOnboardingPayload,
  AcquiringRecipientRoute,
  AcquiringRoutability,
  StorefrontEditSession,
  StorefrontSettings,
  StorefrontSettingsPatch,
  ResourceStatus,
  OfferStatus,
  StockBalancePreview,
  StockBalanceApplyResult,
} from '../types';

import { keysToCamel, keysToSnake } from './case-convert';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const AUTH_APP = import.meta.env.VITE_AUTH_APP || 'crm';
const AUTH_CLIENT_ID = import.meta.env.VITE_AUTH_CLIENT_ID || 'sportgearhub-provider';
const PROVIDER_AUTH_SCOPE = import.meta.env.VITE_PROVIDER_AUTH_SCOPE || 'openid profile email roles offline_access provider_api';
const TOKEN_STORAGE_KEY = 'sportgearhub.provider.oidc';
const DEVICE_STORAGE_KEY = 'sportgearhub.provider.device';
const PROVIDER_BASE_URL = '/api/v1/provider';
const REQUIRED_AUTH_SCOPES = PROVIDER_AUTH_SCOPE.split(/\s+/);

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type ApiUser = {
  id?: string;
  userId?: string;
  email?: string | null;
  name?: string | null;
  surname?: string | null;
  roles?: string[];
  role?: string;
  emailVerified?: boolean;
};

type RegistrationInvitationContext = {
  email: string;
  expiresAt: string;
};

type ApiResource = {
  resourceId?: string;
  providerId?: string;
  resourceType?: string;
  status?: string;
  capacityMode?: string;
  category?: {
    slug?: string | null;
    title?: string | null;
  } | null;
  title?: string | null;
  mediaPreviewUrl?: string | null;
  readiness?: unknown;
  publishabilityImpact?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

type ApiOffer = {
  offerId?: string;
  offerType?: string;
  status?: string;
  primaryResourceId?: string;
  bookingFlowType?: string;
  title?: string | null;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  mediaPreviewUrl?: string | null;
  canonicalOfferId?: string | null;
  publishability?: OfferPublishability | null;
  executionLink?: Record<string, unknown> | null;
  location?: Record<string, unknown> | null;
  locationRef?: Offer['locationRef'];
  fulfillmentLocationId?: string | null;
  meetupLocation?: Record<string, unknown> | null;
  locationSummary?: Record<string, unknown> | null;
  visibility?: OfferVisibility | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ResourceCategory = {
  categoryId: string;
  slug: string;
  title: string;
  titles: Record<string, string>;
  resourceType: string;
  capacityMode: string;
  status: string;
  sortOrder: number;
};

export type EquipmentCategory = ResourceCategory & {
  label: string;
  labels: Record<string, string>;
};

export type EquipmentAttributeAllowedValue = {
  allowedValueId: string;
  valueKey: string;
  valueString?: string | null;
  valueDecimal?: number | null;
  valueInt?: number | null;
  valueBool?: boolean | null;
  label: string;
  labels: Record<string, string>;
  sortOrder: number;
};

export type EquipmentAttributeVisibilityCondition = {
  attributeKey: string;
  allowedValueKeys: string[];
};

export type EquipmentAttribute = {
  attributeId: string;
  key: string;
  label: string;
  labels: Record<string, string>;
  valueType: string;
  unit?: string | null;
  unitLabel?: string | null;
  referenceType?: string | null;
  requiredOn: string[];
  /** @deprecated removed from the API — kept optional for back-compat. */
  appliesTo?: string[];
  helpText?: string | null;
  helpTexts?: Record<string, string>;
  visibleWhen: EquipmentAttributeVisibilityCondition[];
  filterable: boolean;
  comparable: boolean;
  searchable: boolean;
  sortOrder: number;
  allowedValues: EquipmentAttributeAllowedValue[];
};

export type EquipmentAttributeSchema = {
  category: EquipmentCategory | ResourceCategory;
  attributes: EquipmentAttribute[];
};

export type ResourceAttributeValue = {
  key: string;
  valueType: string;
  /** Canonical value — what to send back on edit (brand id, "18", "mountain"). */
  value: string;
  /** Human-readable label to show; fall back to `value` when null. */
  displayValue?: string | null;
};

export type ResourceAttributes = {
  resourceId: string;
  attributes: ResourceAttributeValue[];
};

export type EquipmentBrandSuggestion = {
  brandId: string;
  canonicalName: string;
  status: string;
  confidence: number;
  matchKind: string;
};

export type EquipmentBrand = {
  brandId: string;
  canonicalName: string;
  status: string;
  website?: string | null;
  countryCode?: string | null;
};

export type CreateEquipmentBrandResponse = {
  status: string;
  brand: EquipmentBrand;
  matches: EquipmentBrandSuggestion[];
};

type OidcTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
};

type SimpleTokenResponse = {
  // "authenticated" carries the tokens; "registration_required" carries a short-lived registrationToken
  // for an email that has no account yet.
  status: 'authenticated' | 'registration_required';
  accessToken: string;
  refreshToken: string;
  registrationToken?: string | null;
};

type StoredOidcToken = OidcTokenResponse & {
  obtained_at: number;
  expires_at: number;
  scope: string;
};

export type OnboardingChecklistValue = 'missing' | 'ready';
export type OnboardingStatus =
  | 'not_started'
  | 'draft'
  | 'changes_requested'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'accepted'
  | 'rejected'
  | 'cancelled';

export type ProviderOnboardingDraft = {
  displayName: string | null;
  legalName: string | null;
  legalCountryCode: string | null;
  legalForm: string | null;
  taxationSystem: string | null;
  taxNumber: string | null;
  registrationNumber: string | null;
  branchNumber: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  description: string | null;
  acquiringProvider: string | null;
  payoutSchedule: string | null;
  chiefExecutive: ProviderOnboardingChiefExecutive | null;
  payoutDraft: ProviderOnboardingPayoutDraft | null;
};

export type ProviderOnboardingChiefExecutive = {
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  position: string | null;
  citizenship: string | null;
};

export type ProviderOnboardingChiefExecutivePrefill = ProviderOnboardingChiefExecutive & {
  source: string | null;
};

export type ProviderOnboardingPayoutDraft = {
  mode: string | null;
  beneficiaryName: string | null;
  bankName: string | null;
  bik: string | null;
  bankAccount: string | null;
  correspondentAccount: string | null;
  displayBankName: string | null;
  phone: string | null;
  sbpMemberId: string | null;
};

export type ProviderOnboarding = {
  applicationId: string | null;
  providerId: string | null;
  status: OnboardingStatus;
  review: {
    reasonCode: string | null;
    message: string | null;
    reviewedAt: string | null;
  } | null;
  checklist: {
    profile: OnboardingChecklistValue;
    legal: OnboardingChecklistValue;
    finance: OnboardingChecklistValue;
  } | null;
  draft: ProviderOnboardingDraft | null;
  updatedAt: string;
};

export type OnboardingLegalFormOption = {
  value: string;
  label: string;
  requiredLegalIdentityFields: Array<keyof ProviderOnboardingDraft>;
};

export type ProviderOnboardingOptions = {
  legalCountries: Array<{ value: string; label: string }>;
  legalForms: OnboardingLegalFormOption[];
  taxationSystems: Array<{ value: string; label: string; supportedLegalForms?: string[] | null }>;
  acquiringProviders: Array<{
    value: string;
    label: string;
    description?: string | null;
    available?: boolean;
    requiresPayoutSchedule?: boolean;
    requiresProviderCredentials?: boolean;
  }>;
  payoutSchedules: Array<{
    value: string;
    label: string;
    cadence?: string | null;
    settlementDelayDays?: number | null;
    payoutDaysOfMonth?: number[] | null;
    platformTransferFeePercent?: number | null;
  }>;
  payoutModes?: Array<{
    value: string;
    label: string;
    description?: string | null;
    supportedLegalForms?: string[] | null;
    requiredFields?: string[] | null;
    bankPayoutFee?: {
      percent: number | null;
      minimumAmount: number | null;
      currency: string | null;
    } | null;
    available?: boolean;
  }>;
};

export type SbpMemberReference = {
  sbpMemberId: string;
  displayBankName: string;
  bankName: string;
};

export type SbpMembersReferenceResponse = {
  source: string;
  items: SbpMemberReference[];
};

export type RuAddressSuggestion = {
  value: string;
  unrestrictedValue: string;
  postalCode: string | null;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  settlement: string | null;
  street: string | null;
  house: string | null;
  block: string | null;
  flat: string | null;
  fiasId: string | null;
  kladrId: string | null;
  geoLat: string | null;
  geoLon: string | null;
};

export type RuAddressSuggestionsResponse = {
  source: string;
  suggestions: RuAddressSuggestion[];
};

export type RuAddressGeolocatePayload = {
  lat: number;
  lon: number;
  count?: number;
  radiusMeters?: number;
  language?: string;
};

export type RuBankLookupResponse = {
  source: string;
  value: string;
  unrestrictedValue: string | null;
  bic: string | null;
  swift: string | null;
  swifts: string[];
  inn: string | null;
  branchNumber: string | null;
  registrationNumber: string | null;
  correspondentAccount: string | null;
  paymentName: string | null;
  shortName: string | null;
  paymentCity: string | null;
  opfType: string | null;
  address: string | null;
  unrestrictedAddress: string | null;
  stateStatus: string | null;
};

export type RuLegalIdentityLookupResponse = {
  source: string;
  legalCountryCode: string;
  legalForm: string | null;
  legalName: string | null;
  taxNumber: string | null;
  registrationNumber: string | null;
  branchNumber: string | null;
  registeredAddress: string | null;
  chiefExecutivePrefill: ProviderOnboardingChiefExecutivePrefill | null;
};

function normalizeUser(user: ApiUser): AuthUser {
  const roles = user.roles ?? (user.role ? [user.role] : ['User']);
  const email = user.email ?? '';
  const name = user.name && user.surname ? `${user.name} ${user.surname}` : user.name ?? email;

  return {
    id: user.userId ?? user.id ?? email,
    email,
    name,
    role: roles[0] ?? 'User',
    roles,
    emailVerified: user.emailVerified,
  };
}

function normalizeResource(resource: ApiResource): Resource {
  const resourceId = resource.resourceId ?? '';
  const title = resource.title ?? 'Untitled resource';
  const status = ['active', 'inactive', 'archived', 'draft'].includes(resource.status ?? '')
    ? resource.status as ResourceStatus
    : 'draft';
  const updatedAt = resource.updatedAt ?? new Date().toISOString();
  const resourceType = resource.resourceType ?? 'equipment';
  const category = resource.category?.slug
    ? {
      slug: resource.category.slug,
      title: resource.category.title ?? resource.category.slug,
    }
    : null;

  return {
    resourceId,
    providerId: resource.providerId,
    resourceType,
    capacityMode: resource.capacityMode,
    category,
    status,
    title,
    readiness: (resource.readiness ?? {
      capabilityValid: false,
      availabilityReady: false,
      pricingReady: false,
      policyReady: false,
      variantReady: false,
      offerAuthoringReady: false,
      errors: [],
    }) as Resource['readiness'],
    publishabilityImpact: (resource.publishabilityImpact ?? {
      publishable: false,
      reasonCodes: [],
    }) as Resource['publishabilityImpact'],
    createdAt: resource.createdAt,
    updatedAt,
    id: resourceId,
    slug: resourceId,
    categoryId: category?.slug ?? resourceType,
    categoryName: category?.title ?? (resourceType === 'equipment' ? 'Equipment' : resourceType),
    mediaPreviewUrl: resource.mediaPreviewUrl ?? null,
    variantCount: 0,
  };
}

function normalizeOffer(offer: ApiOffer): Offer {
  const offerId = offer.offerId ?? '';
  const status = ['active', 'inactive', 'archived', 'draft'].includes(offer.status ?? '')
    ? offer.status as OfferStatus
    : 'draft';
  const title = offer.title ?? 'Новое предложение';
  const publishability = offer.publishability ?? {
    status: 'not_publishable',
    reason: 'publishability_not_checked',
  };
  const price = typeof offer.price === 'number' ? offer.price : undefined;

  return {
    offerId,
    offerType: offer.offerType ?? 'equipment_rental',
    status,
    primaryResourceId: offer.primaryResourceId ?? '',
    bookingFlowType: offer.bookingFlowType ?? 'standard_rental',
    title,
    description: offer.description ?? undefined,
    location: offer.location ?? null,
    locationRef: offer.locationRef ?? undefined,
    fulfillmentLocationId: offer.fulfillmentLocationId ?? readFulfillmentLocationId(offer),
    meetupLocation: offer.meetupLocation ?? null,
    locationSummary: offer.locationSummary ?? null,
    visibility: offer.visibility ?? undefined,
    price: offer.price ?? null,
    currency: offer.currency ?? 'RUB',
    mediaPreviewUrl: offer.mediaPreviewUrl ?? null,
    canonicalOfferId: offer.canonicalOfferId ?? undefined,
    publishability,
    executionLink: offer.executionLink ?? undefined,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt ?? new Date().toISOString(),
    id: offerId,
    slug: offerId,
    resourceId: offer.primaryResourceId ?? '',
    resourceTitle: offer.primaryResourceId ?? '',
    basePrice: price,
    durationUnit: 'day',
    durationValue: 1,
    isPublishable: publishability.status === 'publishable',
    publishabilityIssues: publishability.status === 'publishable' ? [] : [publishability.reason].filter(Boolean),
  };
}

function readFulfillmentLocationId(offer: ApiOffer) {
  const fromSummary = offer.locationSummary?.fulfillmentLocation;
  if (fromSummary && typeof fromSummary === 'object') {
    const id = (fromSummary as Record<string, unknown>).fulfillmentLocationId;
    if (typeof id === 'string') return id;
  }

  const legacyId = offer.location?.providerLocationId;
  return typeof legacyId === 'string' ? legacyId : null;
}

function loadStoredToken(): StoredOidcToken | null {
  try {
    const rawToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!rawToken) return null;

    const token = JSON.parse(rawToken) as Partial<StoredOidcToken>;
    if (!token.access_token || !token.expires_at) return null;

    return token as StoredOidcToken;
  } catch {
    return null;
  }
}

let authToken: StoredOidcToken | null = typeof window === 'undefined' ? null : loadStoredToken();

function storeToken(token: OidcTokenResponse, scope: string) {
  const obtainedAt = Date.now();
  authToken = {
    ...token,
    obtained_at: obtainedAt,
    expires_at: obtainedAt + token.expires_in * 1000,
    scope,
  };

  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(authToken));
  } catch {
    // In private or restricted storage contexts, keep the token for this tab only.
  }
}

function jwtExpiresIn(jwt: string): number {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp === 'number') return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
  } catch {
    // ignore malformed JWT
  }
  return 3600;
}

function storeSimpleToken({ accessToken, refreshToken }: SimpleTokenResponse) {
  storeToken({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: jwtExpiresIn(accessToken),
    refresh_token: refreshToken,
  }, PROVIDER_AUTH_SCOPE);
}

export type PasscodePolicy = {
  length: number;
  maxAttempts: number;
  maxDevicesPerUser: number;
};

export type TrustedDeviceEnrolment = {
  deviceId: string;
  // 256 bits of server-generated entropy, shown exactly once. This — not the short passcode — is what
  // makes the credential strong, so it lives here and never leaves the browser.
  deviceSecret: string;
  name: string;
  platform: string;
};

export type TrustedDeviceSummary = {
  deviceId: string;
  name: string;
  platform: string;
  createdAt: string;
  lastUsedAt: string;
};

function storeDevice(device: TrustedDeviceEnrolment) {
  try {
    window.localStorage.setItem(
      DEVICE_STORAGE_KEY,
      JSON.stringify({ deviceId: device.deviceId, deviceSecret: device.deviceSecret }));
  } catch {
    // Without storage the device cannot be remembered; sign-in falls back to an emailed code.
  }
}

function loadStoredDevice(): { deviceId: string; deviceSecret: string } | null {
  try {
    const raw = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!raw) return null;

    const device = JSON.parse(raw) as Partial<{ deviceId: string; deviceSecret: string }>;
    return device.deviceId && device.deviceSecret
      ? { deviceId: device.deviceId, deviceSecret: device.deviceSecret }
      : null;
  } catch {
    return null;
  }
}

function clearStoredDevice() {
  try {
    window.localStorage.removeItem(DEVICE_STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

function clearStoredToken() {
  authToken = null;
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Storage may be unavailable; in-memory token state is already cleared.
  }
}

function tokenHasRequiredScopes(token: StoredOidcToken) {
  const scopes = new Set((token.scope || '').split(/\s+/).filter(Boolean));
  return REQUIRED_AUTH_SCOPES.every(scope => scopes.has(scope));
}

async function oidcTokenRequest(body: URLSearchParams, scope: string) {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(
      res.status,
      err.error_description || err.error || err.message || err.title || `API error ${res.status}`,
      err.code
    );
  }

  const token = await res.json() as OidcTokenResponse;
  storeToken(token, scope);
  return token;
}

async function refreshGrant(token: StoredOidcToken) {
  if (!token.refresh_token) {
    clearStoredToken();
    return null;
  }

  const scope = PROVIDER_AUTH_SCOPE;

  try {
    return await oidcTokenRequest(new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: AUTH_CLIENT_ID,
      refresh_token: token.refresh_token,
      scope,
    }), scope);
  } catch {
    clearStoredToken();
    return null;
  }
}

async function getAccessToken() {
  if (!authToken) return null;

  const refreshSkewMs = 30_000;
  if (tokenHasRequiredScopes(authToken) && authToken.expires_at - refreshSkewMs > Date.now()) {
    return authToken.access_token;
  }

  const refreshed = await refreshGrant(authToken);
  return refreshed?.access_token ?? null;
}

type ApiRequestInit = RequestInit & { auth?: boolean };

const inFlightGetRequests = new Map<string, Promise<unknown>>();

async function request<T>(path: string, options: ApiRequestInit = {}): Promise<T> {
  const { auth = true, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  const accessToken = auth ? await getAccessToken() : null;
  const method = (fetchOptions.method ?? 'GET').toUpperCase();

  if (fetchOptions.body && !headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (typeof fetchOptions.body === 'string' && headers.get('Content-Type')?.includes('application/json')) {
    try {
      fetchOptions.body = JSON.stringify(keysToSnake(JSON.parse(fetchOptions.body)));
    } catch {
      // Not a JSON object literal — send it through unchanged.
    }
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const canDedupe = method === 'GET' && !fetchOptions.body;
  const requestKey = canDedupe
    ? `${auth ? accessToken ?? 'cookie' : 'public'}:${method}:${path}`
    : '';

  if (canDedupe && inFlightGetRequests.has(requestKey)) {
    return inFlightGetRequests.get(requestKey) as Promise<T>;
  }

  const promise = (async () => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      credentials: accessToken ? 'omit' : 'include',
      ...fetchOptions,
      method,
      headers,
    });
    if (!res.ok) {
      const err = keysToCamel<{ message?: string; title?: string; code?: string }>(
        await res.json().catch(() => ({ message: res.statusText })));
      if (auth && res.status === 401) {
        clearStoredToken();
      }
      throw new ApiError(res.status, err.message || err.title || `API error ${res.status}`, err.code);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return keysToCamel<T>(await res.json());
  })();

  if (canDedupe) {
    inFlightGetRequests.set(requestKey, promise);
    promise.finally(() => inFlightGetRequests.delete(requestKey));
  }

  return promise;
}

function providerRequest<T>(path: string, options: RequestInit = {}) {
  return request<T>(`${PROVIDER_BASE_URL}${path}`, options);
}

const lookupRuBankByBic = (bic: string) =>
  request<RuBankLookupResponse>('/api/v1/public/suggestions/bank-by-bic', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ bic }),
  });

export const authApi = {
  startEmailFlow: (email: string) =>
    request<void>('/api/v1/auth/email/start', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, app: AUTH_APP }),
    }),
  registrationInvitation: (token: string) =>
    request<RegistrationInvitationContext>(`/api/v1/auth/registration-invitations/${encodeURIComponent(token)}`, {
      auth: false,
    }),
  magicSignIn: async (token: string) => {
    storeSimpleToken(await request<SimpleTokenResponse>('/api/v1/auth/magic-sign-in', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ token }),
    }));
  },
  // Sign-in step 1: ask for a one-time code by email.
  requestCode: (email: string) =>
    request<void>('/api/v1/auth/email/start', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, app: AUTH_APP, deliveryMode: 'code' }),
    }),
  // Sign-in step 2: exchange the code for a session. An unknown email comes back as
  // registration_required with a short-lived token instead of a session.
  verifyCode: async (email: string, code: string) => {
    const result = await request<SimpleTokenResponse>('/api/v1/auth/email/verify-code', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, code }),
    });

    if (result.status === 'registration_required') {
      return { status: 'registration_required' as const, registrationToken: result.registrationToken! };
    }

    storeSimpleToken(result);
    return { status: 'authenticated' as const, user: normalizeUser(await request<ApiUser>('/api/v1/auth/me')) };
  },
  completeRegistration: async (data: {
    token: string;
    name: string;
    surname: string;
    phone: string;
    birthday?: string;
  }) => {
    storeSimpleToken(await request<SimpleTokenResponse>('/api/v1/auth/email/complete-registration', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(data),
    }));
    return normalizeUser(await request<ApiUser>('/api/v1/auth/me'));
  },
  me: async () => normalizeUser(await request<ApiUser>('/api/v1/auth/me')),
  register: async (data: { token?: string; name: string; surname: string; email?: string; phone: string }) => {
    storeSimpleToken(await request<SimpleTokenResponse>('/api/v1/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ ...data, app: AUTH_APP }),
    }));
  },
  verifyEmail: async (token: string) => {
    storeSimpleToken(await request<SimpleTokenResponse>('/api/v1/auth/email/verify', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ token }),
    }));
  },
  resendVerification: (email: string) =>
    request<void>('/api/v1/auth/email/verification', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, app: AUTH_APP }),
    }),
  acceptProviderInvitation: async (data: { token: string; name: string; surname: string }) => {
    storeSimpleToken(await request<SimpleTokenResponse>('/api/v1/provider-invitations/accept', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(data),
    }));
  },
  // --- trusted device / passcode ---
  passcodePolicy: () =>
    request<PasscodePolicy>('/api/v1/auth/passcode/policy', { auth: false }),
  enrolDevice: async (passcode: string, name: string) => {
    const device = await request<TrustedDeviceEnrolment>('/api/v1/auth/devices', {
      method: 'POST',
      body: JSON.stringify({ clientId: AUTH_CLIENT_ID, platform: 'web', name, passcode }),
    });
    storeDevice(device);
    return device;
  },
  // The sign-in request carries no email or user id on purpose: the account comes from the device row,
  // so a leaked address list cannot be sprayed with "1234".
  passcodeSignIn: async (passcode: string) => {
    const device = loadStoredDevice();
    if (!device) throw new ApiError(401, 'Это устройство не доверено.', 'auth.device_not_trusted');

    try {
      storeSimpleToken(await request<SimpleTokenResponse>('/api/v1/auth/passcode/sign-in', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          deviceId: device.deviceId,
          deviceSecret: device.deviceSecret,
          passcode,
          clientId: AUTH_CLIENT_ID,
        }),
      }));
    } catch (error) {
      // The device is gone for good on these — drop the local secret so the UI falls back to email codes.
      if (error instanceof ApiError
        && (error.code === 'auth.device_not_trusted' || error.code === 'auth.passcode_locked')) {
        clearStoredDevice();
      }
      throw error;
    }

    return normalizeUser(await request<ApiUser>('/api/v1/auth/me'));
  },
  listDevices: () => request<{ devices: TrustedDeviceSummary[] }>('/api/v1/auth/devices').then(r => r.devices),
  changePasscode: (currentPasscode: string, newPasscode: string) => {
    const device = loadStoredDevice();
    if (!device) throw new ApiError(401, 'Это устройство не доверено.', 'auth.device_not_trusted');

    return request<void>('/api/v1/auth/devices/passcode', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: device.deviceId,
        deviceSecret: device.deviceSecret,
        currentPasscode,
        newPasscode,
      }),
    });
  },
  forgetDevice: async (deviceId: string) => {
    await request<void>(`/api/v1/auth/devices/${deviceId}`, { method: 'DELETE' });
    if (loadStoredDevice()?.deviceId === deviceId) clearStoredDevice();
  },
  hasTrustedDevice: () => loadStoredDevice() !== null,
  forgetLocalDevice: clearStoredDevice,

  signout: async () => {
    try {
      await request<void>('/api/v1/auth/signout', { method: 'POST' });
    } finally {
      clearStoredToken();
    }
  },
  providerMemberships: async () =>
    (await request<{ memberships: ProviderMembership[] }>('/api/v1/auth/provider-memberships')).memberships,
  googleStart: () => `${API_BASE_URL}/api/v1/auth/oauth/google/start`,
  yandexStart: () => `${API_BASE_URL}/api/v1/auth/oauth/yandex/start`,
  devEmails: () => `${API_BASE_URL}/api/v1/development/emails`,
};

export const providerOnboardingApi = {
  options: () => request<ProviderOnboardingOptions>('/api/v1/provider-onboarding/options'),
  current: () => request<ProviderOnboarding>('/api/v1/provider-onboarding/current'),
  create: (data: Partial<ProviderOnboardingDraft> = {}) =>
    request<ProviderOnboarding>('/api/v1/provider-onboarding/current', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProfile: (data: Partial<ProviderOnboardingDraft>) =>
    request<ProviderOnboarding>('/api/v1/provider-onboarding/current/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  submit: () =>
    request<ProviderOnboarding>('/api/v1/provider-onboarding/current/submit', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  lookupRuLegalIdentity: (taxNumber: string, branchNumber?: string) => {
    const params = new URLSearchParams({ taxNumber });

    if (branchNumber) {
      params.set('branchNumber', branchNumber);
    }

    return request<RuLegalIdentityLookupResponse>(`/api/v1/provider-onboarding/legal-identity/ru/lookup?${params.toString()}`);
  },
  lookupRuBank: lookupRuBankByBic,
};

export const addressesApi = {
  ruSuggestions: (query: string, count = 10) =>
    request<RuAddressSuggestionsResponse>('/api/v1/public/suggestions/address', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ query, count }),
    }),
  ruGeolocate: (payload: RuAddressGeolocatePayload) =>
    request<RuAddressSuggestionsResponse>('/api/v1/addresses/ru/geolocate', {
      method: 'POST',
      body: JSON.stringify({
        count: 1,
        radiusMeters: 100,
        language: 'ru',
        ...payload,
      }),
    }),
};

export const publicSuggestionsApi = {
  lookupRuBank: lookupRuBankByBic,
  ruAddress: addressesApi.ruSuggestions,
};

export const paymentReferenceApi = {
  sbpMembers: () => request<SbpMembersReferenceResponse>('/api/v1/payment-reference/sbp-members'),
};

// ─── Profile & Dashboard ──────────────────────────────────────────────────────

export const dashboardApi = {
  get: () => providerRequest<DashboardResponse>('/dashboard'),
};

export const profileApi = {
  get: () => providerRequest<Provider>('/profile'),

  patch: (data: {
    displayName?: string;
    slug?: string;
    legalName?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    description?: string;
  }) => providerRequest<Provider>('/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  getOperatingState: () => providerRequest<Provider['operatingState']>('/operating-state'),

};

export const payoutContractsApi = {
  list: () => providerRequest<PayoutContract[]>('/payout-contracts'),
};

export const storefrontApi = {
  get: () => providerRequest<StorefrontSettings>('/storefront'),

  patch: (data: StorefrontSettingsPatch) =>
    providerRequest<StorefrontSettings>('/storefront', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  createEditSession: () =>
    providerRequest<StorefrontEditSession>('/storefront/edit-session', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

// ─── Cities & Provider Locations ─────────────────────────────────────────────

export const catalogApi = {
  cities: () => request<CatalogCity[]>('/api/v1/catalog/cities'),
};

export const locationsApi = {
  list: async () => (await providerRequest<Array<Omit<ProviderLocation, 'locationId'> & { locationId?: string }>>('/fulfillment-locations'))
    .map(location => ({
      ...location,
      locationId: location.locationId ?? location.fulfillmentLocationId,
    })),

  create: (data: {
    cityId: string;
    name: string;
    address: string;
    type: string;
    isDefaultPickup: boolean;
    latitude?: number | null;
    longitude?: number | null;
    description?: string | null;
  }) =>
    providerRequest<Omit<ProviderLocation, 'locationId'> & { locationId?: string }>('/fulfillment-locations', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(location => ({
      ...location,
      locationId: location.locationId ?? location.fulfillmentLocationId,
    })),

  patch: (
    fulfillmentLocationId: string,
    data: Partial<Pick<ProviderLocation, 'cityId' | 'name' | 'address' | 'type' | 'isDefaultPickup' | 'description' | 'latitude' | 'longitude'>>
  ) =>
    providerRequest<Omit<ProviderLocation, 'locationId'> & { locationId?: string }>(`/fulfillment-locations/${fulfillmentLocationId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then(location => ({
      ...location,
      locationId: location.locationId ?? location.fulfillmentLocationId,
    })),
};

export const providerMembersApi = {
  options: (providerId: string) =>
    providerRequest<ProviderMemberOptions>(`/providers/${encodeURIComponent(providerId)}/members/options`),

  listMembers: (providerId: string) =>
    providerRequest<ProviderMember[]>(`/providers/${encodeURIComponent(providerId)}/members`),

  invite: (providerId: string, data: { email: string; role: string }) =>
    providerRequest<ProviderMemberInvitationResult>(`/providers/${encodeURIComponent(providerId)}/members/invitations`, {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        role: data.role,
      }),
    }),

  listInvitations: (providerId: string) =>
    providerRequest<ProviderInvitation[]>(`/providers/${encodeURIComponent(providerId)}/members/invitations`),

  updateRole: (providerId: string, membershipId: string, role: string) =>
    providerRequest<ProviderMember>(
      `/providers/${encodeURIComponent(providerId)}/members/${encodeURIComponent(membershipId)}/role`,
      {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }
    ),

  remove: (providerId: string, membershipId: string) =>
    providerRequest<void>(`/providers/${encodeURIComponent(providerId)}/members/${encodeURIComponent(membershipId)}`, {
      method: 'DELETE',
    }),
};

// ─── Resources ────────────────────────────────────────────────────────────────

export const resourcesApi = {
  list: async () => (await providerRequest<ApiResource[]>('/resources')).map(normalizeResource),

  create: (data: {
    resourceType: string;
    capacityMode: string;
    category?: string;
    title: string;
    attributes?: Record<string, string>;
  }) => providerRequest<ApiResource>('/resources', { method: 'POST', body: JSON.stringify(data) }).then(normalizeResource),

  get: (resourceId: string) => providerRequest<ApiResource>(`/resources/${resourceId}`).then(normalizeResource),

  patch: (
    resourceId: string,
    data: { status?: ResourceStatus; title?: string; category?: string }
  ) =>
    providerRequest<ApiResource>(`/resources/${resourceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then(normalizeResource),

  archive: (resourceId: string, reasonCode: string) =>
    providerRequest<ApiResource>(`/resources/${resourceId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reasonCode }),
    }).then(normalizeResource),

  remove: (resourceId: string) =>
    providerRequest<void>(`/resources/${resourceId}`, {
      method: 'DELETE',
    }),

  getAttributes: (resourceId: string) =>
    providerRequest<ResourceAttributes>(`/resources/${resourceId}/attributes`),

  putAttributes: (resourceId: string, attributes: Record<string, string>) =>
    providerRequest<ResourceAttributes>(`/resources/${resourceId}/attributes`, {
      method: 'PUT',
      body: JSON.stringify({ attributes }),
    }),

  images: {
    list: (resourceId: string) =>
      providerRequest<ResourceImage[]>(`/resources/${resourceId}/images`),

    upload: (resourceId: string, files: File[]) => {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      return providerRequest<ResourceImage[]>(`/resources/${resourceId}/images`, {
        method: 'POST',
        body: formData,
      });
    },

    delete: (resourceId: string, imageId: string) =>
      providerRequest<void>(`/resources/${resourceId}/images/${imageId}`, { method: 'DELETE' }),

    reorder: (resourceId: string, imageIds: string[]) =>
      providerRequest<ResourceImage[]>(`/resources/${resourceId}/images/order`, {
        method: 'PUT',
        body: JSON.stringify({ imageIds }),
      }),
  },

  getRoutabilityImpact: (resourceId: string) =>
    providerRequest<{
      downstreamOfferCount: number;
      impactedOfferCount: number;
      status: string;
      dominantReasonCodes: string[];
      warnings: string[];
      issues: string[];
    }>(`/resources/${resourceId}/routability-impact`),
};

export const equipmentApi = {
  resourceCategories: (resourceType?: string, locale = 'ru-RU') => {
    const params = new URLSearchParams({ locale });
    if (resourceType) params.set('resourceType', resourceType);
    return providerRequest<ResourceCategory[]>(`/resource-categories?${params.toString()}`);
  },

  resourceCategoryAttributes: (resourceType: string, categorySlug: string, locale = 'ru-RU') =>
    providerRequest<EquipmentAttributeSchema>(
      `/resource-categories/${encodeURIComponent(resourceType)}/${encodeURIComponent(categorySlug)}/attributes?locale=${encodeURIComponent(locale)}`
    ),

  categories: (locale = 'ru-RU') =>
    providerRequest<EquipmentCategory[]>(`/equipment-categories?locale=${encodeURIComponent(locale)}`),

  categoryAttributes: (categorySlug: string, locale = 'ru-RU') =>
    providerRequest<EquipmentAttributeSchema>(
      `/equipment-categories/${encodeURIComponent(categorySlug)}/attributes?locale=${encodeURIComponent(locale)}`
    ),

  brandSuggestions: (query: string, category?: string) => {
    const params = new URLSearchParams({ query });
    if (category) params.set('category', category);
    return providerRequest<{ items: EquipmentBrandSuggestion[] }>(`/equipment-brands/suggestions?${params}`);
  },

  createBrand: (data: { name: string; category?: string | null; website?: string | null; countryCode?: string | null }) =>
    providerRequest<CreateEquipmentBrandResponse>('/equipment-brands', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Availability ─────────────────────────────────────────────────────────────

export const availabilityApi = {
  listSlots: (
    resourceId: string,
    params: { dateFrom?: string; dateTo?: string; status?: string } = {}
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && qs.set(k, v));
    const suffix = qs.size > 0 ? `?${qs.toString()}` : '';
    return providerRequest<CapacitySlot[]>(`/resources/${resourceId}/slots${suffix}`);
  },

  createSlot: (
    resourceId: string,
    data: {
      startsAt: string;
      endsAt: string;
      totalCapacity: number;
      status: string;
      title?: string | null;
      meetingPoint?: string | null;
      bookingSubjectRef?: CapacitySlot['bookingSubjectRef'];
    }
  ) =>
    providerRequest<CapacitySlot>(`/resources/${resourceId}/slots`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  patchSlot: (resourceId: string, slotId: string, data: Partial<CapacitySlot>) =>
    providerRequest<CapacitySlot>(`/resources/${resourceId}/slots/${slotId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  closeSlot: (resourceId: string, slotId: string, reasonCode?: string | null) =>
    providerRequest<CapacitySlot>(`/resources/${resourceId}/slots/${slotId}/close`, {
      method: 'POST',
      body: JSON.stringify({ reasonCode: reasonCode || null }),
    }),

  getDiagnostics: (resourceId: string) =>
    providerRequest<AvailabilityDiagnostics>(`/resources/${resourceId}/availability-diagnostics`),

  getInventorySummary: (resourceId: string) =>
    providerRequest<ResourceInventorySummary>(`/resources/${resourceId}/inventory-summary`),

  listUnits: (resourceId: string) =>
    providerRequest<ResourceUnit[]>(`/resources/${resourceId}/units`),

  createUnit: (resourceId: string, data: ResourceUnitInput) =>
    providerRequest<ResourceUnit>(`/resources/${resourceId}/units`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  patchUnit: (resourceId: string, unitId: string, data: ResourceUnitInput) =>
    providerRequest<ResourceUnit>(`/resources/${resourceId}/units/${unitId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  archiveUnit: (resourceId: string, unitId: string, reasonCode = 'provider_archived') =>
    providerRequest<ResourceUnit>(`/resources/${resourceId}/units/${unitId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reasonCode }),
    }),

  deleteUnit: (resourceId: string, unitId: string) =>
    providerRequest<void>(`/resources/${resourceId}/units/${unitId}`, {
      method: 'DELETE',
    }),
};

// ─── Variants ─────────────────────────────────────────────────────────────────

export const variantsApi = {
  list: (resourceId: string) =>
    providerRequest<ResourceVariant[]>(`/resources/${resourceId}/variants`),

  create: (
    resourceId: string,
    data: {
      sku: string;
      label: string;
      attributes: ResourceVariant['attributes'];
      sortOrder: number;
      status: string;
    }
  ) =>
    providerRequest<ResourceVariant>(`/resources/${resourceId}/variants`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (resourceId: string, variantId: string) =>
    providerRequest<ResourceVariant>(`/resources/${resourceId}/variants/${variantId}`),

  patch: (
    resourceId: string,
    variantId: string,
    data: Partial<Pick<ResourceVariant, 'label' | 'sku' | 'attributes' | 'sortOrder' | 'status'>>
  ) =>
    providerRequest<ResourceVariant>(`/resources/${resourceId}/variants/${variantId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  archive: (resourceId: string, variantId: string) =>
    providerRequest<ResourceVariant>(`/resources/${resourceId}/variants/${variantId}/archive`, {
      method: 'POST',
    }),

  getAllocation: (resourceId: string, variantId: string) =>
    providerRequest<VariantAllocation>(`/resources/${resourceId}/variants/${variantId}/allocation`),

  putAllocation: (resourceId: string, variantId: string, data: VariantAllocation) =>
    providerRequest<VariantAllocation>(`/resources/${resourceId}/variants/${variantId}/allocation`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getResourceDiagnostics: (resourceId: string) =>
    providerRequest<{
      resourceId?: string;
      variantReady: boolean;
      availabilityCompatible: boolean;
      pricingCompatible: boolean;
      bookingRoutable: boolean;
      errors: string[];
      warnings: string[];
      publishabilityImpact?: Array<{ key: string; value: string | null }>;
      checkedAt?: string;
    }>(`/resources/${resourceId}/variant-diagnostics`),
};

// ─── Pricing ──────────────────────────────────────────────────────────────────

export const pricingApi = {
  quotePreview: (data: {
    offerId?: string;
    resourceId?: string | null;
    selectionContext: {
      startAt: string;
      endAt: string;
      quantity: number;
    };
  }) =>
    providerRequest<PricingQuotePreview>('/pricing/quote-preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getOfferPolicy: (offerId: string) =>
    providerRequest<PricingPolicy>(`/offers/${offerId}/pricing-policy`),

  putOfferPolicy: (
    offerId: string,
    data: {
      pricingMode: string;
      currency: string;
      baseAmount?: number | null;
      rentalTiers?: PricingPolicy['rentalTiers'];
      multiDayRate?: number | null;
      minParticipants?: number | null;
      maxParticipants?: number | null;
      groupDiscountPercent?: number | null;
      groupDiscountMinParticipants?: number | null;
      status: string;
    }
  ) =>
    providerRequest<PricingPolicy>(`/offers/${offerId}/pricing-policy`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  offerPricingSummaryPreview: (offerId: string) =>
    providerRequest<Record<string, unknown>>(`/offers/${offerId}/pricing-summary-preview`, {
      method: 'POST',
    }),

  getResourceDiagnostics: (resourceId: string) =>
    providerRequest<PricingDiagnostics>(`/resources/${resourceId}/pricing-diagnostics`),
};

// ─── Policy ───────────────────────────────────────────────────────────────────

export const policyApi = {
  getOfferPolicy: (offerId: string) =>
    providerRequest<OfferPolicy>(`/offers/${offerId}/policy`),

  putOfferPolicy: (offerId: string, data: OfferPolicyInput) =>
    providerRequest<OfferPolicy>(`/offers/${offerId}/policy`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ─── Offers ───────────────────────────────────────────────────────────────────

export const offersApi = {
  list: async () => (await providerRequest<ApiOffer[]>('/offers')).map(normalizeOffer),

  authoringOptions: (primaryResourceId?: string) => {
    const params = new URLSearchParams();
    if (primaryResourceId) params.set('primaryResourceId', primaryResourceId);
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return providerRequest<OfferAuthoringOptions>(`/offers/authoring-options${suffix}`);
  },

  create: (data: {
    primaryResourceId: string;
    offerType: string;
    bookingFlowType: string;
    title: string;
    subtitle?: string;
    description?: string;
    fulfillmentLocationId?: string | null;
    meetupLocation?: Record<string, unknown> | null;
    locationRef?: Offer['locationRef'];
  }) => providerRequest<ApiOffer>('/offers', { method: 'POST', body: JSON.stringify(data) }).then(normalizeOffer),

  get: (offerId: string) => providerRequest<ApiOffer>(`/offers/${offerId}`).then(normalizeOffer),

  patch: (
    offerId: string,
    data: {
      title?: string;
      description?: string;
      fulfillmentLocationId?: string | null;
      meetupLocation?: Record<string, unknown> | null;
      locationRef?: Offer['locationRef'];
    }
  ) => providerRequest<ApiOffer>(`/offers/${offerId}`, { method: 'PATCH', body: JSON.stringify(data) }).then(normalizeOffer),

  activate: (offerId: string) =>
    providerRequest<ApiOffer>(`/offers/${offerId}/activate`, {
      method: 'POST',
      body: JSON.stringify({ reasonCode: 'provider_requested' }),
    }).then(normalizeOffer),

  deactivate: (offerId: string) =>
    providerRequest<ApiOffer>(`/offers/${offerId}/deactivate`, {
      method: 'POST',
      body: JSON.stringify({ reasonCode: 'provider_requested' }),
    }).then(normalizeOffer),

  archive: (offerId: string, reasonCode: string) =>
    providerRequest<ApiOffer>(`/offers/${offerId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reasonCode }),
    }).then(normalizeOffer),

  getRoutability: (offerId: string) =>
    providerRequest<OfferRoutability>(`/offers/${offerId}/routability`),

  listRoutability: () => providerRequest<OfferRoutability[]>('/offers/routability'),

  getReadiness: (offerId: string) =>
    providerRequest<OfferReadiness>(`/offers/${offerId}/readiness`),

  listReadiness: () => providerRequest<OfferReadiness[]>('/offers/readiness'),

  getVisibility: (offerId: string) =>
    providerRequest<OfferVisibility>(`/offers/${offerId}/visibility`),

  putVisibility: (offerId: string, data: OfferVisibility) =>
    providerRequest<OfferVisibility>(`/offers/${offerId}/visibility`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getInfoSections: (offerId: string) =>
    providerRequest<OfferInfoSections>(`/offers/${offerId}/info-sections`),

  putInfoSections: (offerId: string, sections: OfferInfoSection[]) =>
    providerRequest<OfferInfoSections>(`/offers/${offerId}/info-sections`, {
      method: 'PUT',
      body: JSON.stringify({ sections }),
    }),
};

// ─── Offer Availability ───────────────────────────────────────────────────────

export const offerAvailabilityApi = {
  get: (offerId: string) =>
    providerRequest<OfferAvailability>(`/offers/${offerId}/availability`),

  put: (
    offerId: string,
    data: {
      timezone: string;
      availabilityWindows: OfferAvailabilityWindow[];
      blockedPeriods: OfferAvailabilityBlockedPeriod[];
      minRentHours: number;
      maxRentHours: number;
      status: string;
    }
  ) =>
    providerRequest<OfferAvailability>(`/offers/${offerId}/availability`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ─── Bookings ─────────────────────────────────────────────────────────────────

export const bookingsApi = {
  list: (params: {
    status?: BookingStatus;
    dateFrom?: string;
    dateTo?: string;
    offerId?: string;
    resourceId?: string;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && qs.set(k, String(v)));
    return providerRequest<BookingListItem[]>(`/bookings?${qs}`);
  },

  get: (bookingId: string) => providerRequest<BookingDetail>(`/bookings/${bookingId}`),

  getFulfillment: (bookingId: string) =>
    providerRequest<Record<string, unknown>>(`/bookings/${bookingId}/fulfillment`),

  handover: (
    bookingId: string,
    data: {
      handedOverAt: string;
      note?: string;
      handoverMetadata?: { key: string; value: string }[];
    }
  ) =>
    providerRequest<FulfillmentCommandResult>(`/bookings/${bookingId}/handover`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  return: (
    bookingId: string,
    data: {
      returnedAt: string;
      conditionSummary?: { key: string; value: string }[];
      note?: string;
    }
  ) =>
    providerRequest<FulfillmentCommandResult>(`/bookings/${bookingId}/return`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  complete: (
    bookingId: string,
    data: {
      completedAt: string;
      note?: string;
    }
  ) =>
    providerRequest<FulfillmentCommandResult>(`/bookings/${bookingId}/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reportIssue: (
    bookingId: string,
    data: {
      reasonCode: string;
      description: string;
      evidenceRefs?: string[];
    }
  ) =>
    providerRequest<FulfillmentCommandResult>(`/bookings/${bookingId}/report-issue`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Fulfillment Queue ────────────────────────────────────────────────────────

export const fulfillmentApi = {
  getQueue: () => providerRequest<Record<string, unknown>[]>('/fulfillment'),
};

// ─── Acquiring ────────────────────────────────────────────────────────────────

export const acquiringApi = {
  list: () => providerRequest<AcquiringConnection[]>('/acquiring-connections'),

  create: (acquiringProvider?: string) =>
    providerRequest<AcquiringConnection>('/acquiring-connections', {
      method: 'POST',
      body: JSON.stringify(acquiringProvider ? { acquiringProvider } : {}),
    }),

  get: (connectionId: string) =>
    providerRequest<AcquiringConnection>(`/acquiring-connections/${connectionId}`),

  getRoutability: (connectionId: string) =>
    providerRequest<AcquiringRoutability>(`/acquiring-connections/${connectionId}/routability`),

  getRecipientRoutes: (connectionId: string) =>
    providerRequest<AcquiringRecipientRoute[]>(
      `/acquiring-connections/${connectionId}/recipient-routes`
    ),

  getDealBinding: (connectionId: string) =>
    providerRequest<AcquiringDealBinding>(
      `/acquiring-connections/${connectionId}/deal-binding`
    ),

  submitOnboarding: (connectionId: string, data: AcquiringOnboardingPayload) =>
    providerRequest<AcquiringConnection>(
      `/acquiring-connections/${connectionId}/submit-onboarding`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
};

// ─── Activity Options ─────────────────────────────────────────────────────────

export const activityOptionsApi = {
  list: () =>
    providerRequest<Array<{
      activityId: string;
      slug: string;
      title: string;
      titles: Record<string, string>;
      status: string;
      sortOrder: number;
    }>>('/activity-options'),
};

// ─── Stock Balance ────────────────────────────────────────────────────────────

export const stockBalanceApi = {
  downloadTemplate: async (): Promise<Blob> => {
    const accessToken = await getAccessToken();
    const headers = new Headers();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    const res = await fetch(
      `${API_BASE_URL}${PROVIDER_BASE_URL}/stock-balance`,
      { credentials: accessToken ? 'omit' : 'include', headers }
    );
    if (!res.ok) throw new ApiError(res.status, `Не удалось скачать шаблон`, undefined);
    return res.blob();
  },

  preview: (file: File): Promise<StockBalancePreview> => {
    const form = new FormData();
    form.append('file', file);
    return providerRequest<StockBalancePreview>('/stock-balance/preview', { method: 'POST', body: form });
  },

  apply: (file: File): Promise<StockBalanceApplyResult> => {
    const form = new FormData();
    form.append('file', file);
    return providerRequest<StockBalanceApplyResult>('/stock-balance', { method: 'POST', body: form });
  },
};

export type {
  Provider,
  ResourceStatus,
  OfferStatus,
};
