export type UserRole = 'provider_manager' | 'rental_staff' | 'partner_ops' | string;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roles: string[];
  emailVerified?: boolean;
  phone?: string | null;
  phoneVerified?: boolean;
}

export type ProviderStatus =
  | 'draft'
  | 'pending_review'
  | 'changes_requested'
  | 'rejected'
  | 'active'
  | 'suspended'
  | 'archived'
  | string;

export type SellerKind = 'self_employed' | 'sole_proprietor' | 'company' | string;

/** One row of the cabinet picker: a provider the user belongs to, as /auth/me lists it. */
export interface ProviderSummary {
  providerId: string;
  displayName: string;
  kind: SellerKind | null;
  status: ProviderStatus;
  role: string;
}

export interface PendingInvitation {
  invitationId: string;
  providerId: string;
  providerDisplayName: string;
  role: string;
  expiresAt: string;
}

/** Everything the console needs to decide where to land, from the one bootstrap call. */
export interface Session {
  user: AuthUser;
  providers: ProviderSummary[];
  pendingInvitations: PendingInvitation[];
}

export interface ProviderMemberRoleOption {
  value: string;
  label: string;
  description?: string | null;
}

export interface ProviderMemberOptions {
  roles: ProviderMemberRoleOption[];
}

export interface ProviderMember {
  membershipId: string;
  userId: string;
  providerId: string;
  name: string;
  surname: string;
  phone: string | null;
  email: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export type ProviderInvitationStatus = 'pending' | 'accepted' | 'expired' | string;

export interface ProviderInvitation {
  invitationId: string;
  providerId: string;
  phone: string;
  role: string;
  status: ProviderInvitationStatus;
  invitedByUserId: string;
  invitedByName: string;
  invitedByPhone: string | null;
  sentAt: string;
  expiresAt: string;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderMemberInvitationResult {
  accepted: boolean;
  message: string;
}

export interface CatalogCity {
  cityId: string;
  name: string;
  countryCode?: string | null;
  timezone?: string | null;
}

export interface ProviderLocation {
  fulfillmentLocationId: string;
  locationId: string;
  providerId?: string;
  cityId: string;
  cityName?: string;
  name: string;
  address: string;
  type: 'pickup' | 'service_area' | string;
  status: string;
  isDefaultPickup: boolean;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  updatedAt?: string;
}

// ─── Provider / Profile ──────────────────────────────────────────────────────


export interface ProviderReviewSummary {
  reviewId: string;
  openedAt: string;
  decidedAt: string | null;
  verdict: 'approved' | 'changes_requested' | 'rejected' | string | null;
  message: string | null;
}

export interface Provider {
  providerId: string;
  displayName: string;
  description: string | null;
  address: string | null;
  slug: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: ProviderStatus;
  latestReview: ProviderReviewSummary | null;
  createdAt: string;
  updatedAt: string;
}

export type ReadinessItemStatus = 'ready' | 'missing' | 'awaiting_registration' | string;

export interface ProviderReadinessItem {
  key: 'profile' | 'seller_profile' | 'payout' | string;
  status: ReadinessItemStatus;
  hint: string | null;
}

export interface ProviderReadiness {
  providerId: string;
  status: ProviderStatus;
  canSubmit: boolean;
  isPublic: boolean;
  canBePaid: boolean;
  items: ProviderReadinessItem[];
  latestReview: ProviderReviewSummary | null;
}

export interface SellerPerson {
  lastName: string;
  firstName: string;
  middleName: string | null;
}

export interface SellerDirector extends SellerPerson {
  position: string;
}

export interface SellerBusinessDetails {
  legalName: string;
  registrationNumber: string;
  legalAddress: string;
  taxationSystem: string;
  vatRate: string;
  director: SellerDirector;
}

/** One shape switched on `kind`: `person` for a самозанятый, `business` for ИП and organisations, `company` on top for organisations. */
export interface SellerProfile {
  sellerProfileId: string;
  kind: SellerKind;
  inn: string;
  person: SellerPerson | null;
  business: SellerBusinessDetails | null;
  company: { kpp: string } | null;
  updatedAt: string;
}

export interface SellerProfileInput {
  kind: SellerKind;
  inn: string;
  taxationSystem?: string;
  vatRate?: string;
  person?: { lastName: string; firstName: string; middleName?: string | null };
}

export interface LegalIdentityLookup {
  legalCountryCode: string;
  legalForm: string | null;
  legalName: string | null;
  taxNumber: string | null;
  registrationNumber: string | null;
  branchNumber: string | null;
  address: string | null;
  chiefExecutivePrefill: { firstName: string | null; lastName: string | null; middleName: string | null; position: string | null } | null;
}

export interface Agreement {
  number: number;
  acceptedAt: string;
  status: 'accepted' | 'active' | 'terminated' | string;
  activatedAt: string | null;
  terminatedAt: string | null;
}

export type PayoutMethod = 'sbp' | 'bank_account' | string;

export interface PayoutDetails {
  method: PayoutMethod;
  hasDetails: boolean;
  status: string | null;
  registered: boolean;
  beneficiaryName: string | null;
  phone: string | null;
  sbpMemberId: string | null;
  bankName: string | null;
  account: string | null;
  bik: string | null;
  correspondentAccount: string | null;
  updatedAt: string | null;
}

export interface PayoutDetailsInput {
  method: PayoutMethod;
  phone?: string;
  sbpMemberId?: string;
  bankName?: string;
  account?: string;
  bik?: string;
  correspondentAccount?: string;
}

export type PayoutMode = 't_bank_bank_account' | 't_bank_sbp_individual' | string;
export type PayoutContractStatus = 'review' | 'setting_up' | 'active' | 'rejected' | 'blocked' | string;

export interface PayoutBankRequisites {
  account?: string | null;
  bankName?: string | null;
  bik?: string | null;
  correspondentAccount?: string | null;
}

export interface PayoutContract {
  contractId: string;
  providerId: string;
  payoutMode: PayoutMode;
  contractNumber?: number | null;
  currency: string;
  startsOn?: string | null;
  status: PayoutContractStatus;
  bankRequisites?: PayoutBankRequisites | null;
  sbpPayout?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface StorefrontSettings {
  providerId: string;
  slug: string | null;
  host: string | null;
  enabled: boolean;
  publicName: string | null;
  description: string | null;
  provider?: {
    providerId: string;
    slug?: string | null;
    displayName?: string | null;
    description?: string | null;
    legalName?: string | null;
    legalCountryCode?: string | null;
    legalForm?: string | null;
    taxationSystem?: string | null;
    inn?: string | null;
    kpp?: string | null;
    ogrn?: string | null;
    registeredAddress?: string | null;
    cityId?: string | null;
    address?: string | null;
    contacts?: StorefrontContact[];
  } | null;
  theme: {
    primaryColor: string | null;
    accentColor: string | null;
  };
  contacts: StorefrontContact[];
  seo: {
    title: string | null;
    description: string | null;
  };
  updatedAt: string | null;
}

export interface StorefrontContact {
  type: string;
  value: string;
  isPrimary: boolean;
}

export type StorefrontSettingsPatch = Partial<Pick<StorefrontSettings, 'enabled' | 'publicName' | 'description'>> & {
  theme?: Partial<StorefrontSettings['theme']>;
  contacts?: StorefrontContact[];
  seo?: Partial<StorefrontSettings['seo']>;
};

export interface StorefrontEditSession {
  previewUrl: string;
  expiresAt: string;
}

export interface DashboardCounts {
  totalResources: number;
  activeResources: number;
  totalOffers: number;
  activeOffers: number;
  draftOffers: number;
  totalBookings: number;
  upcomingBookings: number;
  activeAcquiringConnections: number;
}

export interface DashboardWorkQueue {
  bookingsNeedingAction: number;
  pendingHandovers: number;
  pendingReturns: number;
  pendingCompletions: number;
  openFulfillmentIssues: number;
  openSupportIncidents: number;
}

export interface DashboardAlert {
  key: string;
  severity: 'info' | 'warning' | 'error';
  status: 'open' | 'resolved';
  title: string;
  actionCode?: string;
  hint?: string;
}

export interface DashboardResponse {
  providerId: string;
  displayName: string;
  readiness: ProviderReadiness;
  counts: DashboardCounts;
  workQueue: DashboardWorkQueue;
  alerts: DashboardAlert[];
  updatedAt: string;
}



// ─── Legacy shape kept for mock data / existing UI components ─────────────────

export interface DashboardStats {
  activeBookings: number;
  pendingHandovers: number;
  pendingReturns: number;
  totalRevenueMTD: number;
  currency: string;
  catalogReadiness: number;
  openIssues: number;
}

// ─── Resources ───────────────────────────────────────────────────────────────

export type ResourceStatus = 'active' | 'inactive' | 'archived' | 'draft';

export interface ResourceReadiness {
  capabilityValid: boolean;
  availabilityReady: boolean;
  pricingReady: boolean;
  policyReady: boolean;
  variantReady: boolean;
  offerAuthoringReady: boolean;
  errors: string[];
}

export interface PublishabilityImpact {
  publishable: boolean;
  reasonCodes: string[];
}

export interface Resource {
  resourceId: string;
  resourceType: string;
  capacityMode?: string;
  category?: {
    slug: string;
    title: string;
  } | null;
  status: ResourceStatus;
  title: string;
  readiness: ResourceReadiness;
  publishabilityImpact: PublishabilityImpact;
  updatedAt: string;
  providerId?: string;
  createdAt?: string;
  /** kept for backward-compat with existing UI components */
  id: string;
  slug?: string;
  categoryId: string;
  categoryName: string;
  description?: string;
  imageUrl?: string;
  mediaPreviewUrl?: string | null;
  variantCount?: number;
}

export interface ResourceImage {
  imageId: string;
  resourceId: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
  sortOrder: number;
  createdAt: string;
}

// ─── Availability ─────────────────────────────────────────────────────────────

export interface OfferAvailabilityWindow {
  startsOn: string;
  endsOn: string;
  dailyOpensAt: string;
  dailyClosesAt: string;
}

export interface OfferAvailabilityBlockedPeriod {
  startsOn: string;
  endsOn: string;
  reasonCode: string | null;
}

export interface OfferAvailability {
  settingsId: string | null;
  offerId: string;
  timezone: string;
  availabilityWindows: OfferAvailabilityWindow[];
  blockedPeriods: OfferAvailabilityBlockedPeriod[];
  /** Booking step for slot-based offers; null when the offer is not slotted. */
  slotIntervalMinutes: number | null;
  status: string;
  updatedAt: string | null;
}

export interface ResourceUnit {
  unitId: string;
  resourceId: string;
  inventoryCode?: string | null;
  notes?: string | null;
  status: string;
  conditionStatus?: string | null;
  externalReferenceCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ResourceUnitInput = {
  inventoryCode?: string | null;
  notes?: string | null;
  status?: string | null;
  conditionStatus?: string | null;
  externalReferenceCode?: string | null;
};

export interface ResourceInventorySummary {
  resourceId: string;
  totalUnits: number;
  availableUnits: number;
  readyUnits: number;
  maintenanceUnits: number;
  damagedUnits: number;
  inUseUnits: number;
  retiredUnits: number;
  lostUnits: number;
  updatedAt: string;
}

export type StockBalanceAction = 'none' | 'create' | 'retire' | 'partial_retire' | 'error';

export interface StockBalancePreviewRow {
  sku: string;
  label: string;
  currentBalance: number;
  targetBalance: number;
  delta: number;
  action: StockBalanceAction;
  warning: string | null;
  error: string | null;
}

export interface StockBalancePreview {
  rows: StockBalancePreviewRow[];
  hasWarnings: boolean;
  hasErrors: boolean;
}

export interface StockBalanceApplyRow {
  sku: string;
  label: string;
  previousBalance: number;
  newBalance: number;
  unitsCreated: number;
  unitsRetired: number;
  warning: string | null;
}

export interface StockBalanceApplyResult {
  rows: StockBalanceApplyRow[];
  hasWarnings: boolean;
}

// ─── Variants ─────────────────────────────────────────────────────────────────

export interface NormalizedAttribute {
  key: string;
  value: string;
}

export interface ResourceAllocation {
  allocationId: string;
  resourceId: string;
  /** `dedicated_units` counts ready units; `shared_inventory` uses `baseQuantity` as the capacity. */
  allocationMode: string;
  baseQuantity: number | null;
  allocationRules: ResourceAllocationRules | null;
  status: string;
  updatedAt: string;
}

export interface ResourceAllocationRules {
  maxPerBooking?: number | null;
  maxConcurrent?: number | null;
  sharedPoolCode?: string | null;
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

export interface RentalTier {
  upToHours: number;
  price: number;
  label?: string | null;
}

export interface UnitRules {
  baseAmount: number;
  unit: string;
  minimumUnits: number;
  maximumUnits: number;
}

export interface AdjustmentRule {
  code?: string | null;
  type?: string | null;
  percent?: number | null;
  amount?: number | null;
  appliesWhen?: string | null;
  isRequired?: boolean | null;
}

export interface PricingPolicy {
  pricingPolicyId?: string;
  pricingMode?: string;
  currency?: string;
  baseAmount?: number | null;
  unitRules?: UnitRules;
  adjustmentRules?: AdjustmentRule[];
  rentalTiers?: RentalTier[] | null;
  multiDayRate?: number | null;
  status: string;
  readiness?: Record<string, unknown>;
  publishabilityImpact?: PublishabilityImpact | { status?: string; reason?: string };
  /** kept for backward-compat with existing UI */
  id?: string;
  resourceId?: string;
  offerId?: string;
  label?: string;
  basePrice?: number;
  adjustments?: PricingAdjustment[];
  updatedAt?: string;
}

export interface PricingAdjustment {
  id: string;
  type: 'percentage' | 'fixed';
  amount: number;
  condition: string;
  label: string;
}

export interface PricingQuotePreview {
  baseAmount: number;
  adjustments: unknown[];
  subtotal: number;
  taxes: number;
  fees: number;
  totalPrice: number;
  depositAmount: number;
  totalHoldAmount: number;
  currency: string;
}

export interface PricingDiagnostics {
  resourceId?: string;
  offerId?: string | null;
  pricingReady: boolean;
  quoteable: boolean;
  summaryReady: boolean;
  errors: string[];
  warnings: string[];
  publishabilityImpact?: PublishabilityImpact | Array<{ key: string; value: string | null }>;
  checkedAt?: string;
}

// ─── Policy ───────────────────────────────────────────────────────────────────

export interface PolicyRuleset {
  leadTimeHours?: number;
  cancellationWindowHours?: number;
  isCancellationAllowed?: boolean;
  noShowChargePercent?: number;
  deposit?: PolicyDeposit;
  checkInGraceMinutes?: number;
  assuranceMode?: string;
  weatherException?: boolean;
  minimumAge?: number;
  [key: string]: unknown;
}

export type PolicyDeposit =
  | { unit: 'none' }
  | { unit: 'percentage'; value: number }
  | { unit: 'fixed_amount'; value: number; currency: string };

export interface OfferCancellationTier {
  thresholdHoursBeforeStart: number;
  refundPercent: number;
}

/** Offer-level policy override (GET/PUT /offers/{offerId}/policy). */
export interface OfferPolicy {
  policyOverrideId?: string;
  ownerType?: string;
  ownerId?: string;
  leadTimeHours?: number | null;
  cancellationTiers?: OfferCancellationTier[] | null;
  isCancellationAllowed?: boolean | null;
  noShowChargePercent?: number | null;
  deposit?: PolicyDeposit | null;
  readiness?: Record<string, unknown>;
  publishabilityImpact?: PublishabilityImpact;
  updatedAt?: string;
}

export interface OfferInfoSection {
  kind: string;
  items: string[];
}

export interface OfferInfoSections {
  sections: OfferInfoSection[];
}

export type OfferPolicyInput = {
  leadTimeHours?: number | null;
  cancellationTiers?: OfferCancellationTier[] | null;
  isCancellationAllowed?: boolean | null;
  noShowChargePercent?: number | null;
  deposit?: PolicyDeposit | null;
};

export interface ProviderPolicy {
  ownerType?: string;
  ownerId?: string;
  policyScope: string;
  ruleset?: PolicyRuleset;
  status: string;
  leadTimeHours?: number;
  isCancellationAllowed?: boolean;
  noShowChargePercent?: number;
  checkInGraceMinutes?: number;
  assuranceMode?: string;
  weatherException?: boolean;
  minimumAge?: number;
  readiness?: Record<string, unknown>;
  publishabilityImpact?: PublishabilityImpact;
  deposit: PolicyDeposit;
  /** kept for backward-compat with existing UI */
  id: string;
  resourceId?: string;
  label: string;
  cancellationWindowHours: number;
  cancellationRefundPercent: number;
  lateReturnFeeEnabled: boolean;
  damageDepositRequired: boolean;
  additionalNotes?: string;
  updatedAt: string;
}

export interface PolicyDiagnostics {
  validationReady: boolean;
  summaryReady: boolean;
  errors: string[];
  warnings: string[];
  publishabilityImpact: PublishabilityImpact;
}

// ─── Offers ───────────────────────────────────────────────────────────────────

export type OfferStatus = 'draft' | 'active' | 'inactive' | 'archived';

export interface LocationRef {
  city?: string | null;
  countryCode?: string | null;
  country?: string | null;
  region?: string | null;
  address?: string | null;
  house?: string | null;
}

export interface IncludedItem {
  label: string;
}

export interface MediaRefs {
  coverUrl?: string;
  gallery?: string[];
}

export interface OfferPublishability {
  status: 'publishable' | 'not_publishable' | 'blocked' | string;
  reason: string;
}

export interface OfferReadinessSection {
  code: string;
  status: 'ready' | 'blocked' | 'pending' | 'warning' | string;
  title?: string | null;
  message: string;
  reasonCodes?: string[];
}

export interface OfferReadiness {
  offerId?: string;
  providerId?: string;
  primaryResourceId?: string;
  status: 'ready' | 'blocked' | 'pending' | 'warning' | string;
  customerVisibleNow: boolean;
  bookingSetupReady: boolean;
  sections: OfferReadinessSection[];
  checkedAt?: string;
}

export interface OfferVisibility {
  visibilityMode: 'always_visible' | 'seasonal' | 'hidden' | string;
  visibleFrom: string | null;
  visibleUntil: string | null;
  status: string;
}

export interface Offer {
  offerId: string;
  offerType: string;
  status: OfferStatus;
  primaryResourceId: string;
  bookingFlowType: string;
  title: string;
  subtitle?: string;
  description?: string;
  locationRef?: LocationRef;
  location?: Record<string, unknown> | null;
  fulfillmentLocationId?: string | null;
  meetupLocation?: Record<string, unknown> | null;
  locationSummary?: Record<string, unknown> | null;
  visibility?: OfferVisibility;
  includedItems?: IncludedItem[];
  requiredItems?: IncludedItem[];
  mediaRefs?: MediaRefs;
  pricingSummary?: Record<string, unknown>;
  policySummary?: Record<string, unknown>;
  price?: number | null;
  mediaPreviewUrl?: string | null;
  publishability: OfferPublishability;
  executionLink?: Record<string, unknown>;
  updatedAt: string;
  createdAt?: string;
  /** kept for backward-compat with existing UI */
  id: string;
  slug?: string;
  resourceId?: string;
  resourceTitle?: string;
  basePrice?: number;
  currency?: string;
  durationUnit?: 'hour' | 'day' | 'week';
  durationValue?: number;
  isPublishable?: boolean;
  publishabilityIssues?: string[];
  readiness?: OfferReadiness;
}

export interface OfferVariantExposure {
  offerId?: string;
  resourceVariantId?: string;
  isRequiredForBooking: boolean;
  displayLabelOverride?: string | null;
  visibilityStatus: string;
  sortOrder?: number | null;
}

export interface OfferRoutability {
  publishable: boolean;
  offerStatus: string;
  status: string;
  routable: boolean;
  resolutionReady: boolean;
  availabilityReady: boolean;
  pricingReady: boolean;
  policyReady: boolean;
  capabilityValid: boolean;
  variantReady: boolean;
  reasonCodes: string[];
  warnings: string[];
  issues: string[];
  checkedAt: string;
}

export interface OfferAuthoringOption {
  value: string;
  title: string;
  description: string | null;
  isDefault: boolean;
  isActive?: boolean;
}

export interface OfferAuthoringOptions {
  offerTypes: OfferAuthoringOption[];
  bookingFlowTypes: OfferAuthoringOption[];
  pricingModes: OfferAuthoringOption[];
  defaults: {
    offerType: string;
    bookingFlowType: string;
    pricingMode?: string;
  };
  resourceCompatibility: {
    resourceId: string;
    resourceType: string;
    capacityMode: string;
    recommendedOfferTypes: string[];
    defaultOfferType: string;
  } | null;
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'pending_fulfillment';

export interface CustomerSummary {
  fullName: string;
  [key: string]: unknown;
}

export interface BookingListItem {
  bookingId: string;
  bookingNumber: string;
  offerId: string;
  offerTitle: string;
  bookingType: string;
  customerSummary: CustomerSummary;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  quantity: number;
  fulfillmentSummary?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BookingDetail {
  bookingId: string;
  bookingNumber: string;
  status: BookingStatus;
  statusReason?: string;
  offer?: Record<string, unknown>;
  customerSummary: CustomerSummary;
  schedule?: Record<string, unknown>;
  selectionSummary?: Record<string, unknown>;
  assuranceSummary?: Record<string, unknown>;
  fulfillment?: {
    status: string;
    completionAllowed: boolean;
    issueReportingAllowed: boolean;
  };
  providerPolicySummary?: Record<string, unknown>;
  support?: { correlationRef: string };
}

/** Legacy shape kept for existing UI components that use the old Booking interface */
export interface Booking {
  id: string;
  ref: string;
  status: BookingStatus;
  customer: BookingCustomer;
  selection: BookingSelection;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface BookingCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface BookingSelection {
  offerId: string;
  offerTitle: string;
  resourceId: string;
  resourceTitle: string;
  variantId?: string;
  variantTitle?: string;
  quantity: number;
  startDate: string;
  endDate?: string;
  durationLabel: string;
}

// ─── Fulfillment ──────────────────────────────────────────────────────────────

export type FulfillmentStatus =
  | 'pending_handover'
  | 'active'
  | 'pending_return'
  | 'completed'
  | 'issue_reported';

export interface FulfillmentItem {
  bookingId: string;
  bookingRef: string;
  status: FulfillmentStatus;
  customer: BookingCustomer;
  selection: BookingSelection;
  handoverAt?: string;
  returnAt?: string;
  completedAt?: string;
  issueReportedAt?: string;
  notes?: string;
}

export interface FulfillmentCommandResult {
  booking: {
    bookingId: string;
    bookingNumber: string;
    fulfillmentStage: string;
    support?: { correlationRef: string };
  };
  result: {
    status: 'accepted' | 'rejected';
    reasonCode: string | null;
  };
}

// ─── Acquiring ────────────────────────────────────────────────────────────────

export interface AcquiringConnection {
  connectionId: string;
  providerId?: string;
  acquiringProvider: string;
  status: string;
  shopCode?: string | null;
  onboardingStatus?: string;
  onboardingSnapshot?: {
    snapshotPresent: boolean;
    snapshotVersion?: number | null;
    integrationProvider?: string | null;
    chiefExecutivePresent: boolean;
    founderCount: number;
    submittedAt?: string | null;
  };
  routing?: {
    routeStatus: string;
    paymentRecipientId?: string | null;
    levelOfConfidence?: string | null;
  };
  dealBinding?: {
    status: string;
    mode?: string | null;
    dealId?: string | null;
    createDealWithType?: string | null;
  };
  routability?: AcquiringRoutability;
  diagnostics?: Record<string, unknown> | null;
  paymentRouteable?: boolean;
  createdAt?: string;
  updatedAt: string;
}

export interface AcquiringRoutability {
  connectionId: string;
  paymentRouteable: boolean;
  connectionStatus: string;
  shopCodePresent: boolean;
  terminalReady: boolean;
  recipientRouteReady: boolean;
  dealBindingReady: boolean;
  reasonCodes: string[];
  diagnostics?: Record<string, unknown> | null;
  checkedAt: string;
}

export interface AcquiringRecipientRoute {
  routeId: string;
  connectionId: string;
  routeScope: string;
  routeStatus: string;
  paymentRecipientId?: string | null;
  levelOfConfidence?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcquiringDealBinding {
  bindingId: string;
  routeId: string;
  status: string;
  mode: string;
  dealId?: string | null;
  createDealWithType?: string | null;
  diagnostics?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcquiringOnboardingPayload {
  legalProfile: {
    legalEntityName: string;
    legalName?: string;
    taxpayerNumber: string;
    registrationNumber: string;
    registeredAddress: string;
  };
  contactProfile: {
    surname?: string;
    name?: string;
    patronymic?: string;
    email: string;
    phone: string;
    position: string;
  };
  businessProfile?: {
    billingDescriptor?: string;
    shortName?: string;
    siteUrl?: string;
    okved?: string;
    registrationDepartment?: string;
    registrationDate?: string;
    actualAddress?: string;
    comment?: string | null;
  };
  chiefExecutive?: Record<string, unknown> | null;
  founders?: Record<string, unknown>[];
  settlementProfile: {
    mode?: string;
    bankName: string;
    bankAccount: string;
    correspondentAccount: string;
    bik: string;
    beneficiaryName: string;
    phone?: string;
    sbpMemberId?: string | null;
    displayBankName?: string;
  };
}
