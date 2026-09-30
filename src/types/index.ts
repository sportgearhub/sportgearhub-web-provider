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

/** Who is signed in and which cabinets they belong to. Invitations are fetched separately. */
export interface Session {
  user: AuthUser;
  providers: ProviderSummary[];
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

/** A пункт проката: an address (from the registry) or a pin; the city is derived by the API. */
export interface ProviderLocation {
  fulfillmentLocationId: string;
  locationId: string;
  providerId?: string;
  cityId: string;
  cityName?: string;
  name: string;
  address: string;
  addressFiasId?: string | null;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
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

export interface DashboardCounts {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
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





// ─── Pricing ──────────────────────────────────────────────────────────────────

export interface RentalTier {
  upToHours: number;
  price: number;
  label?: string | null;
}

// ─── Policy ───────────────────────────────────────────────────────────────────

export interface OfferInfoSection {
  kind: string;
  items: string[];
}

export interface OfferInfoSections {
  sections: OfferInfoSection[];
}

// ─── Offers ───────────────────────────────────────────────────────────────────

/**
 * The API's own vocabulary. `paused` is the seller's switch («Отключить»); `suspended` is the
 * platform's, and only the platform can lift it, so the console offers no control for it.
 */
export type OfferStatus = 'draft' | 'active' | 'paused' | 'suspended' | 'archived';

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
  fulfillmentLocationId?: string | null;
  meetupLocation?: Record<string, unknown> | null;
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

export interface OfferAuthoringOption {
  value: string;
  title: string;
  description: string | null;
  isDefault: boolean;
  isActive?: boolean;
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'pending_fulfillment';

/** Everything the API is willing to say about the customer outside a booking's own page. */
export interface CustomerSummary {
  customerId: string | null;
  fullName: string | null;
  phone: string | null;
  email: string | null;
}

export interface FulfillmentSummary {
  status: string | null;
  completionAllowed: boolean | null;
  issueReportingAllowed: boolean | null;
  notes: string | null;
}

export interface BookingListItem {
  bookingId: string;
  bookingNumber: string;
  productId: string;
  productTitle: string;
  bookingType: string;
  customerSummary: CustomerSummary | null;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  quantity: number;
  fulfillmentSummary: FulfillmentSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingDetail {
  bookingId: string;
  bookingNumber: string;
  status: BookingStatus;
  statusReason?: string;
  customerSummary: CustomerSummary | null;
  schedule?: Record<string, unknown>;
  selectionSummary?: Record<string, unknown>;
  assuranceSummary?: Record<string, unknown>;
  fulfillment?: {
    status: string;
    completionAllowed: boolean;
    issueReportingAllowed: boolean;
    notes: string | null;
  };
  support?: { correlationRef: string };
}

// ─── Fulfillment ──────────────────────────────────────────────────────────────

/**
 * Where a booking stands, derived by the API from the timestamps it holds. A rental sits at `active`
 * for the whole hire — that is the stage that accepts a return — and at `returned` it is waiting to
 * be closed out.
 */
export type FulfillmentStage =
  | 'pending_handover'
  | 'active'
  | 'returned'
  | 'completed'
  | 'issue_reported';

/**
 * A queue row as the API sends it now: the booking, what stage it is at, and which of the three
 * moves it will accept. The customer and the product are looked up from the booking, not repeated
 * here.
 */
export interface FulfillmentItem {
  bookingId: string;
  bookingNumber: string;
  bookingType: string;
  fulfillmentStage: FulfillmentStage;
  handoverAllowed: boolean;
  returnAllowed: boolean;
  completionAllowed: boolean;
  productId: string;
  startAt: string;
  endAt: string;
  quantity: number;
  updatedAt: string;
}

export interface FulfillmentCommandResult {
  booking: {
    bookingId: string;
    bookingNumber: string;
    fulfillmentStage: FulfillmentStage;
    support?: { correlationRef: string };
  };
  result: {
    status: 'accepted' | 'rejected';
    reasonCode: string | null;
  };
}


// ─── Product ──────────────────────────────────────────────────────────────────
// The catalogue unit. Resource, variant and offer collapsed into this on 2026-09-30; a booking
// points straight at a product, and a "variant" is now just a group name several products share.

export type ProductStatus = 'draft' | 'pending_review' | 'active' | 'inactive' | 'archived' | string;

export interface ProductCategoryRef {
  categoryId?: string;
  slug: string;
  name?: string;
}

export interface ProductSummary {
  productId: string;
  status: ProductStatus;
  title: string;
  category: ProductCategoryRef | null;
  quantity: number;
  price: number | null;
  mediaPreviewUrl: string | null;
  fulfillmentLocationId: string | null;
  updatedAt: string;
}

export interface Product extends ProductSummary {
  description: string | null;
  groupName?: string | null;
  infoSections?: OfferInfoSection[];
  createdAt?: string;
}

export interface ProductCategory {
  categoryId: string;
  slug: string;
  name: string;
  activities: { slug: string; name: string }[];
  status: string;
  sortOrder: number;
  /** Tree position, when the API sends one. */
  parentId?: string | null;
}

export interface ProductAttributes {
  productId: string;
  attributes: Record<string, string>;
}

export interface ProductImage {
  imageId: string;
  productId: string;
  originalFileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  url: string;
  sortOrder: number;
  createdAt?: string;
}

export interface ProductPricingPolicy {
  pricingPolicyId?: string;
  productId?: string;
  pricingMode: string;
  baseAmount: number | null;
  rentalTiers: RentalTier[] | null;
  status: string;
}

export interface ProductCancellationTier {
  thresholdHoursBeforeStart: number;
  refundPercent: number;
}

/** A deposit is an amount or a share, so it carries its own unit. */
export interface ProductDeposit {
  unit: string;
  value: number;
}

export interface ProductPolicy {
  productPolicyId?: string;
  productId?: string;
  leadTimeHours: number | null;
  cancellationTiers: ProductCancellationTier[] | null;
  isCancellationAllowed: boolean;
  noShowChargePercent: number | null;
  deposit: ProductDeposit | null;
  updatedAt?: string;
}

export interface ProductAuthoringOptions {
  bookingFlowTypes: OfferAuthoringOption[];
  pricingModes: OfferAuthoringOption[];
  defaults: { bookingFlowType?: string };
}

/** A pickup point's week. A day absent from `workingHours` is a day closed. */
export interface WorkingHours {
  day: string;
  opensAt: string;
  closesAt: string;
}

/** A dated override: no times means closed for the whole range. */
export interface ScheduleException {
  from: string;
  to: string;
  opensAt?: string | null;
  closesAt?: string | null;
  reason?: string | null;
}

export interface LocationSchedule {
  fulfillmentLocationId: string;
  workingHours: WorkingHours[];
  exceptions: ScheduleException[];
}

export interface RoutabilityIssue {
  code: string;
  severity: string;
  domain: string;
  message: string;
  affectedProductId?: string | null;
}

/** Whether a product can actually take a booking, and what is stopping it if not. */
export interface ProductRoutability {
  productId: string;
  sellerId: string;
  publishable: boolean;
  productStatus: string;
  status: string;
  routable: boolean;
  resolutionReady: boolean;
  pricingReady: boolean;
  policyReady: boolean;
  capabilityValid: boolean;
  inventoryReady: boolean;
  reasonCodes: string[];
  warnings: string[];
  issues: RoutabilityIssue[];
  checkedAt: string;
}

/** How the price reads on a customer-facing card ("от 700 ₽ / сутки"). */
export interface ProductPricingSummary {
  productId: string;
  displayMode: string;
  displayAmount: number | null;
  displayUnit: string | null;
  note: string | null;
  generatedAt: string;
}

export interface QuotePreview {
  quotePreviewId?: string;
  productId: string;
  baseAmount: number;
  adjustments?: unknown[];
  subtotal: number;
  taxes?: number | null;
  fees?: number | null;
  totalPrice: number;
  prepaidServiceAmount?: number | null;
  depositAmount?: number | null;
  totalHoldAmount?: number | null;
  generatedAt?: string;
  expiresAt?: string;
}

/**
 * An invitation as /seller-invitations/pending reports it: authoritative about status and expiry,
 * and it names who sent it — but not the cabinet, which the session carries.
 */
export interface SellerInvitation {
  invitationId: string;
  sellerId: string;
  sellerDisplayName: string;
  phone: string;
  role: string;
  status: string;
  invitedByName: string | null;
  invitedByPhone: string | null;
  sentAt: string;
  expiresAt: string;
}

/**
 * The second axis the category tree cannot express: a tent, a rod, skis and a SUP board are four
 * branches and one activity. A product inherits its activities from its category.
 */
export interface ActivityOption {
  activityId: string;
  slug: string;
  name: string;
  sortOrder: number;
}
