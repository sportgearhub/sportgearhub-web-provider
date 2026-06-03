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
  OnboardingResponse,
  Resource,
  ResourceImage,
  AvailabilityProfile,
  CapacitySlot,
  AvailabilityDiagnostics,
  ResourceInventorySummary,
  ResourceUnit,
  ResourceVariant,
  VariantAllocation,
  PricingPolicy,
  PricingQuotePreview,
  PricingDiagnostics,
  RentalTier,
  ProviderPolicy,
  PayoutContract,
  PolicyDiagnostics,
  PolicyDeposit,
  Offer,
  OfferAvailability,
  OfferAvailabilityWindow,
  OfferAvailabilityBlockedPeriod,
  OfferVariantExposure,
  OfferReadiness,
  OfferRoutability,
  OfferPublishability,
  OfferVisibility,
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
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const AUTH_APP = import.meta.env.VITE_AUTH_APP || 'crm';
const AUTH_CLIENT_ID = import.meta.env.VITE_AUTH_CLIENT_ID || 'sportgearhub-provider';
const PROVIDER_AUTH_SCOPE = import.meta.env.VITE_PROVIDER_AUTH_SCOPE || 'openid profile email roles offline_access provider_api';
const TOKEN_STORAGE_KEY = 'sportgearhub.provider.oidc';
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
  requiresPassword: boolean;
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
  variantExposureMode?: string;
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
  appliesTo: string[];
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
  registeredAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  cityId: string | null;
  city: string | null;
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
    variantExposureMode: offer.variantExposureMode,
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

async function passwordGrant(email: string, password: string) {
  return oidcTokenRequest(new URLSearchParams({
    grant_type: 'password',
    client_id: AUTH_CLIENT_ID,
    username: email,
    password,
    scope: PROVIDER_AUTH_SCOPE,
  }), PROVIDER_AUTH_SCOPE);
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
      const err = await res.json().catch(() => ({ message: res.statusText }));
      if (auth && res.status === 401) {
        clearStoredToken();
      }
      throw new ApiError(res.status, err.message || err.title || `API error ${res.status}`, err.code);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
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
  magicSignIn: async (token: string) =>
    normalizeUser(await request<ApiUser>('/api/v1/auth/magic-sign-in', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ token }),
    })),
  login: async (email: string, password: string) => {
    await passwordGrant(email, password);
    return normalizeUser(await request<ApiUser>('/api/v1/auth/me'));
  },
  me: async () => normalizeUser(await request<ApiUser>('/api/v1/auth/me')),
  register: async (data: { token?: string; name: string; surname: string; email?: string; password?: string }) =>
    normalizeUser(await request<ApiUser>('/api/v1/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ ...data, app: AUTH_APP }),
    })),
  verifyEmail: (token: string) =>
    request<void>('/api/v1/auth/email/verify', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ token }),
    }),
  resendVerification: (email: string) =>
    request<void>('/api/v1/auth/email/verification', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, app: AUTH_APP }),
    }),
  forgotPassword: (email: string) =>
    request<void>('/api/v1/auth/password/forgot', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, app: AUTH_APP }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<void>('/api/v1/auth/password/reset', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ token, newPassword }),
    }),
  acceptProviderInvitation: async (data: { token: string; name: string; surname: string; password: string }) =>
    normalizeUser(await request<ApiUser>('/api/v1/provider-invitations/accept', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(data),
    })),
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
    city?: string;
    addressLine?: string;
    description?: string;
  }) => providerRequest<Provider>('/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  getOperatingState: () => providerRequest<Provider['operatingState']>('/operating-state'),

  getOnboarding: () => providerRequest<OnboardingResponse>('/onboarding'),

  submitOnboarding: (note: string) =>
    providerRequest<OnboardingResponse>('/onboarding/submit', {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
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
  getProfile: (resourceId: string) =>
    providerRequest<AvailabilityProfile>(`/resources/${resourceId}/availability-profile`),

  putProfile: (
    resourceId: string,
    data: {
      availabilityMode: string;
      timezone: string;
      bookingHorizonDays: number;
      status: string;
    }
  ) =>
    providerRequest<AvailabilityProfile>(`/resources/${resourceId}/availability-profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

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

  createUnit: (
    resourceId: string,
    data: {
      resourceVariantId?: string | null;
      inventoryCode?: string | null;
      displayName?: string | null;
      status?: string | null;
      conditionStatus?: string | null;
      externalReferenceCode?: string | null;
    }
  ) => providerRequest<ResourceUnit>(`/resources/${resourceId}/units`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  patchUnit: (resourceId: string, unitId: string, data: Partial<ResourceUnit>) =>
    providerRequest<ResourceUnit>(`/resources/${resourceId}/units/${unitId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  archiveUnit: (resourceId: string, unitId: string, reasonCode = 'provider_archived') =>
    providerRequest<ResourceUnit>(`/resources/${resourceId}/units/${unitId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reasonCode }),
    }),
};

// ─── Variants ─────────────────────────────────────────────────────────────────

export const variantsApi = {
  list: (resourceId: string) =>
    providerRequest<ResourceVariant[]>(`/resources/${resourceId}/variants`),

  create: (
    resourceId: string,
    data: {
      variantKey: string;
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
    data: Partial<Pick<ResourceVariant, 'label' | 'variantKey' | 'attributes' | 'sortOrder' | 'status'>>
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

  getDiagnostics: (resourceId: string, variantId: string) =>
    providerRequest<Record<string, unknown>>(
      `/resources/${resourceId}/variants/${variantId}/diagnostics`
    ),
};

// ─── Pricing ──────────────────────────────────────────────────────────────────

export const pricingApi = {
  getResourcePolicy: (resourceId: string) =>
    providerRequest<PricingPolicy>(`/resources/${resourceId}/pricing-policy`),

  putResourcePolicy: (
    resourceId: string,
    data: {
      pricingMode: string;
      currency: string;
      baseAmount?: number | null;
      adjustmentRules: PricingPolicy['adjustmentRules'];
      rentalTiers?: PricingPolicy['rentalTiers'];
      multiDayRate?: number | null;
      status: string;
    }
  ) =>
    providerRequest<PricingPolicy>(`/resources/${resourceId}/pricing-policy`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getResourceDiagnostics: (resourceId: string) =>
    providerRequest<PricingDiagnostics>(`/resources/${resourceId}/pricing-diagnostics`),

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
      adjustmentRules: PricingPolicy['adjustmentRules'];
      rentalTiers?: PricingPolicy['rentalTiers'];
      multiDayRate?: number | null;
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
};

// ─── Policy ───────────────────────────────────────────────────────────────────

export const policyApi = {
  getProfile: () => providerRequest<ProviderPolicy>('/policy-profile'),

  putProfile: (data: {
    policyScope: string;
    status: string;
    leadTimeHours?: number;
    cancellationWindowHours?: number;
    isCancellationAllowed?: boolean;
    noShowChargePercent?: number;
    deposit?: PolicyDeposit;
    checkInGraceMinutes?: number;
    assuranceMode?: string;
    weatherException?: boolean;
    minimumAge?: number;
  }) =>
    providerRequest<ProviderPolicy>('/policy-profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getResourcePolicy: (resourceId: string) =>
    providerRequest<ProviderPolicy>(`/resources/${resourceId}/policy`),

  putResourcePolicy: (
    resourceId: string,
    data: {
      overrideScope: string;
      overrideRules: ProviderPolicy['ruleset'];
      status: string;
    }
  ) =>
    providerRequest<ProviderPolicy>(`/resources/${resourceId}/policy`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  offerPolicySummaryPreview: (offerId: string) =>
    providerRequest<Record<string, unknown>>(`/offers/${offerId}/policy-summary-preview`, {
      method: 'POST',
    }),

  getResourceDiagnostics: (resourceId: string) =>
    providerRequest<PolicyDiagnostics>(`/resources/${resourceId}/policy-diagnostics`),

  getOfferPolicy: (offerId: string) =>
    providerRequest<ProviderPolicy>(`/offers/${offerId}/policy`),

  putOfferPolicy: (
    offerId: string,
    data: {
      overrideScope: string;
      overrideRules: ProviderPolicy['ruleset'];
      status: string;
    }
  ) =>
    providerRequest<ProviderPolicy>(`/offers/${offerId}/policy`, {
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
    variantExposureMode?: string | null;
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

  checkPublishability: (offerId: string) =>
    providerRequest<OfferPublishability>(`/offers/${offerId}/check-publishability`, {
      method: 'POST',
    }),

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

  getVariantExposure: (offerId: string) =>
    providerRequest<OfferVariantExposure[]>(`/offers/${offerId}/variant-exposure`),

  putVariantExposureMode: (offerId: string, variantExposureMode: string) =>
    providerRequest<Offer>(`/offers/${offerId}/variant-exposure-mode`, {
      method: 'PUT',
      body: JSON.stringify({ variantExposureMode }),
    }),

  putVariantExposure: (
    offerId: string,
    variantId: string,
    data: Pick<OfferVariantExposure, 'isRequiredForBooking' | 'displayLabelOverride' | 'visibilityStatus' | 'sortOrder'>
  ) =>
    providerRequest<OfferVariantExposure>(`/offers/${offerId}/variants/${variantId}/exposure`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

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
      advanceNoticeHours: number;
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

export type {
  Provider,
  ResourceStatus,
  OfferStatus,
};
