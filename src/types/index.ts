export type UserRole = 'provider_manager' | 'rental_staff' | 'partner_ops' | string;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roles: string[];
  emailVerified?: boolean;
}

export interface ProviderMembership {
  providerId: string;
  displayName: string;
  role: string;
  operatingState: string;
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
  email: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export type ProviderInvitationStatus = 'pending' | 'accepted' | 'expired' | string;

export interface ProviderInvitation {
  invitationId: string;
  providerId: string;
  email: string;
  role: string;
  status: ProviderInvitationStatus;
  invitedByUserId: string;
  invitedByName: string;
  invitedByEmail: string | null;
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

export interface OperatingState {
  overallStatus: string;
  onboardingStatus: string;
  lifecycleState?: string;
  moderationStatus?: string;
  capabilityStatus: string;
  settlementStatus: string;
  resourceReadiness: string;
  commercialReadiness: string;
  diagnostics: Record<string, unknown>;
}

export interface Provider {
  providerId: string;
  displayName: string;
  slug?: string | null;
  legalName?: string;
  contactEmail: string;
  contactPhone?: string;
  city?: string;
  addressLine?: string;
  description?: string;
  operatingState: OperatingState;
  onboardingStatus?: string;
  lifecycleState?: string;
  moderationStatus?: string;
  updatedAt: string;
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
  operatingState: OperatingState;
  counts: DashboardCounts;
  workQueue: DashboardWorkQueue;
  alerts: DashboardAlert[];
  updatedAt: string;
}

export interface OnboardingChecklistItem {
  key: string;
  status: string;
  label: string;
  details?: string;
}

export interface OnboardingResponse {
  providerId: string;
  status: string;
  lifecycleState: string;
  moderationStatus: string;
  checklist: OnboardingChecklistItem[];
  nextActions: string[];
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
  reasonCode: string;
}

export interface OfferAvailability {
  settingsId: string;
  offerId: string;
  timezone: string;
  availabilityWindows: OfferAvailabilityWindow[];
  blockedPeriods: OfferAvailabilityBlockedPeriod[];
  minRentHours: number;
  maxRentHours: number;
  status: string;
  updatedAt: string;
}

export interface AvailabilityProfile {
  profileId: string;
  resourceId: string;
  availabilityMode: string;
  timezone: string;
  bookingHorizonDays: number | null;
  status: string;
  readiness?: Record<string, unknown>;
  publishabilityImpact?: Record<string, unknown>;
  updatedAt: string;
  /** kept for backward-compat with existing UI */
  id: string;
  resourceTitle?: string;
  minAdvanceBookingHours?: number;
  maxAdvanceBookingDays?: number;
  defaultCapacity?: number;
}

export interface RecurringRule {
  dayOfWeek: string | null;
  startsAtLocal: string | null;
  endsAtLocal: string | null;
  capacity: number | null;
}

export interface BlockedPeriod {
  startsAt: string | null;
  endsAt: string | null;
  reasonCode: string | null;
}

export interface AvailabilityException {
  date?: string | null;
  isClosed?: boolean | null;
  opensAtLocal?: string | null;
  closesAtLocal?: string | null;
  capacity?: number | null;
}

export interface AvailabilityCalendar {
  calendarId?: string;
  resourceId?: string;
  timezone: string;
  recurringRules: RecurringRule[];
  blockedPeriods: BlockedPeriod[];
  exceptions: AvailabilityException[];
  updatedAt: string;
}

export interface CapacitySlot {
  slotId: string;
  resourceId: string;
  startsAt: string;
  endsAt: string;
  totalCapacity: number;
  reservedCapacity: number;
  availableCapacity: number;
  status: string;
  title?: string | null;
  meetingPoint?: string | null;
  createdAt?: string;
  bookingSubjectRef?: {
    resourceId: string;
    resourceType: string;
    bookingSubjectStatus: string;
  };
  updatedAt: string;
}

export interface AvailabilityDiagnostics {
  resourceId?: string;
  availabilityReady: boolean;
  bookingRoutable: boolean;
  modeValid: boolean;
  errors: string[];
  warnings: string[];
  publishabilityImpact?: PublishabilityImpact | Array<{ key: string; value: string | null }>;
  checkedAt?: string;
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

export interface ResourceVariantInventorySummary {
  resourceVariantId: string;
  sku: string;
  label: string;
  status: string;
  totalUnits: number;
  availableUnits: number;
  readyUnits: number;
  maintenanceUnits: number;
  damagedUnits: number;
  updatedAt: string;
}

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
  classifiedUnits: number;
  unclassifiedUnits: number;
  variants: ResourceVariantInventorySummary[];
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

export interface ResourceVariant {
  variantId: string;
  resourceId: string;
  sku: string;
  label: string;
  status: 'active' | 'inactive' | 'archived';
  attributes: Record<string, string>;
  normalizedAttributes?: NormalizedAttribute[];
  sortOrder: number;
  updatedAt: string;
  /** kept for backward-compat with existing UI */
  id: string;
  title: string;
  stock?: number;
  createdAt?: string;
}

export interface VariantAllocation {
  allocationMode: string;
  baseQuantity: number;
  allocationRules: {
    sharedPoolCode?: string;
    maxPerBooking?: number;
    maxConcurrent?: number;
  };
  status: string;
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

export interface OfferInclusions {
  included: string[];
  excluded: string[];
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
  canonicalOfferId?: string;
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
