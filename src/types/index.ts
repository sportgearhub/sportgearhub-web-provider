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

/**
 * The three legal shapes a cabinet can have. Closed on purpose: it is the discriminant of
 * SellerProfile and SellerProfileInput, and `| string` on a discriminant turns a union the
 * compiler can check into three optional fields it cannot.
 */
export type SellerKind = 'self_employed' | 'sole_proprietor' | 'company';

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

/** A person in the cabinet. The API identifies them by e-mail; it does not send a phone. */
export interface ProviderMember {
  membershipId: string;
  userId: string;
  sellerId: string;
  name: string;
  surname: string;
  email: string | null;
  role: string;
  createdAt: string;
}

export type ProviderInvitationStatus = 'pending' | 'accepted' | 'expired' | string;

/** The cabinet's outbox: whom we invited, and where each one stands. */
export interface ProviderInvitation {
  invitationId: string;
  sellerId: string;
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
  sellerId: string;
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
  sellerId: string;
  status: ProviderStatus;
  canSubmit: boolean;
  isPublic: boolean;
  canBePaid: boolean;
  items: ProviderReadinessItem[];
  latestReview: ProviderReviewSummary | null;
}

/** The API's own field names for a natural person — not last/first/middle. */
export interface SellerPerson {
  surname: string;
  name: string;
  patronymic: string | null;
}

export interface SellerDirector extends SellerPerson {
  position: string;
}

/** The registry's record of a business. Flat on the response — there is no `business` object. */
export interface SellerRegistryFacts {
  legalName: string;
  registrationNumber: string;
  legalAddress: string;
  taxationSystem: string;
  vatRate: string;
  director: SellerDirector;
}

/** What every legal identity carries, whatever shape it has. */
interface SellerIdentityBase {
  legalIdentityId: string;
  inn: string;
}

/**
 * The seller's legal identity: a different payload per kind, discriminated by `kind`, with a field
 * that cannot apply **absent** rather than null.
 *
 * A самозанятый types their own name — there is no registry to read and no office they hold. ИП and
 * organisations are read from the state registry by ИНН, and the human being is the director. Only
 * an organisation has a КПП. The registry's fields sit flat on the response; there is no `business`
 * object to reach through.
 */
export type SellerProfile =
  | (SellerIdentityBase & { kind: 'self_employed'; person: SellerPerson })
  | (SellerIdentityBase & SellerRegistryFacts & { kind: 'sole_proprietor' })
  | (SellerIdentityBase & SellerRegistryFacts & { kind: 'company'; kpp: string });

/** The natural person this kind keeps: their own name, or the director's. */
export function sellerPerson(profile: SellerProfile): SellerPerson | null {
  return profile.kind === 'self_employed' ? profile.person : profile.director;
}

/** The registry's facts, for the kinds that have a registry entry. */
export function sellerRegistry(profile: SellerProfile): SellerRegistryFacts | null {
  return profile.kind === 'self_employed' ? null : profile;
}

export function sellerKpp(profile: SellerProfile): string | null {
  return profile.kind === 'company' ? profile.kpp : null;
}

/** «Иванов Иван Иванович», or an em dash when this kind names nobody. */
export function sellerPersonName(profile: SellerProfile): string {
  const person = sellerPerson(profile);
  if (!person) return '—';
  return [person.surname, person.name, person.patronymic].filter(Boolean).join(' ');
}

/**
 * What is sent to create or change a legal identity — a different payload per kind, like the
 * response, and a separate type from it because a request is not a response.
 *
 * A самозанятый gives their name; nothing else about them is registered anywhere. ИП and
 * organisations give only the ИНН and how they are taxed: the registry supplies the name, the
 * address and the director, and anything the client sent for those would be overwritten.
 */
export type SellerProfileInput =
  | { kind: 'self_employed'; inn: string; person: { surname: string; name: string; patronymic?: string | null } }
  | { kind: 'sole_proprietor'; inn: string; taxationSystem: string; vatRate?: string }
  | { kind: 'company'; inn: string; taxationSystem: string; vatRate?: string };

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

/** GET/PUT /payout. */
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
  sellerId: string;
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

/** The booking's own status. Handover progress is separate — see FulfillmentSummary. */
export type BookingStatus =
  | 'awaiting_seller_confirmation'
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'reversed'
  | 'failed';

/** Everything the API is willing to say about the customer outside a booking's own page. */
export interface CustomerSummary {
  fullName: string;
  phone: string | null;
}

/** Enough of the card to show a booking row without opening it. */
export interface BookingProductSummary {
  productId: string;
  title: string;
  mediaPreviewUrl: string | null;
  categorySlug: string | null;
  categoryTitle: string | null;
  fulfillmentLocationId: string | null;
}

/** What confirm, decline and cancel answer. */
export interface BookingDecision {
  bookingId: string;
  status: BookingStatus;
  reasonCode: string | null;
  decidedAt: string;
}

/**
 * Handover progress, beside the booking's own status rather than blended into it.
 *
 * The three `*_allowed` flags are what a row's buttons are driven by: they are the same rules the
 * command endpoints enforce, so a button enabled here is accepted there. `handoverAllowed` is false
 * for anything not yet `confirmed`, which is how an unpaid booking and an unanswered request stay
 * un-handed-over without the console having to know the rule.
 */
export interface FulfillmentSummary {
  stage: FulfillmentStage;
  handoverAllowed: boolean;
  returnAllowed: boolean;
  completionAllowed: boolean;
  hasIssue: boolean;
}

export interface BookingListItem {
  bookingId: string;
  bookingNumber: string;
  bookingType: string;
  status: BookingStatus;
  product: BookingProductSummary;
  customer: CustomerSummary | null;
  startAt: string;
  endAt: string;
  quantity: number;
  fulfillment: FulfillmentSummary;
  createdAt: string;
  updatedAt: string;
}

/** The card as a booking's detail describes it — more than the list row carries. */
export interface BookingProductDetail extends BookingProductSummary {
  description: string | null;
  fulfillmentLocationName: string | null;
  fulfillmentLocationAddress: string | null;
}

/** The detail adds the e-mail; the list row deliberately leaves it out. */
export interface BookingCustomerDetail extends CustomerSummary {
  email: string | null;
}

export interface BookingSchedule {
  startAt: string;
  endAt: string;
  quantity: number;
}

/**
 * Handover state on the detail. Not the same shape as the list row's summary: this one answers
 * with a `status` and the two permissions it knows, and carries the operator's notes.
 */
export interface BookingFulfillmentState {
  status: string;
  completionAllowed: boolean;
  issueReportingAllowed: boolean;
  notes: string | null;
}

export interface PolicySummary {
  source: string;
  scope: string;
  status: string;
  previewStatus: string;
}

/** A fiscal receipt the platform issued for this booking — the seller's proof it was rung up. */
export interface FiscalReceipt {
  receiptId: string;
  operation: string;
  status: string;
  total: number;
  fiscalDocumentNumber: string | null;
  fiscalSign: string | null;
  ofdReceiptUrl: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface BookingDetail {
  bookingId: string;
  bookingNumber: string;
  status: BookingStatus;
  statusReason: string | null;
  product: BookingProductDetail;
  customer: BookingCustomerDetail | null;
  schedule: BookingSchedule | null;
  selectionSummary: { bookingOptions: Record<string, unknown> | null } | null;
  fulfillment: BookingFulfillmentState;
  sellerPolicySummary: PolicySummary | null;
  support: { correlationRef: string } | null;
  receipts: FiscalReceipt[];
  createdAt: string;
  updatedAt: string;
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

/** GET /bookings/{id}/fulfillment — the full state of one booking's handover and return. */
export interface FulfillmentDetail {
  bookingId: string;
  bookingNumber: string;
  productId: string;
  fulfillmentStage: FulfillmentStage;
  handover: {
    handoverAllowed: boolean;
    handedOverAt: string | null;
    handedOverBy: string | null;
    note: string | null;
  };
  return: {
    returnAllowed: boolean;
    returnedAt: string | null;
    returnedBy: string | null;
    conditionSummary: Array<{ key: string; value: string }>;
    note: string | null;
  };
  completion: {
    completionAllowed: boolean;
    completedAt: string | null;
  };
  issueSummary: {
    reasonCode: string;
    description: string | null;
    evidenceRefs: string[];
    reportedAt: string;
    reportedBy: string | null;
  } | null;
  support: { correlationRef: string };
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


// ─── Paged lists ──────────────────────────────────────────────────────────────

/** What every list endpoint answers: the page, and where that page sits in the whole. */
export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface Paged<T> {
  items: T[];
  pagination: Pagination;
}

// ─── Product ──────────────────────────────────────────────────────────────────
// The catalogue unit. Resource, variant and offer collapsed into this on 2026-09-30; a booking
// points straight at a product, and a "variant" is now just a group name several products share.

/** The card's lifecycle, as the API names it.  is the seller's pause;  is the
 *  platform's, and only the platform lifts it. */
export type ProductStatus =
  | 'draft'
  | 'pending_review'
  | 'changes_requested'
  | 'rejected'
  | 'active'
  | 'paused'
  | 'suspended'
  | 'archived';

/** What a product says about its category in a list: the API sends the slug and a `title`. */
export interface ProductCategoryRef {
  slug: string;
  title: string;
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
  groupName: string | null;
  /** How many cards share this group, and whether this is the one that represents them. */
  groupSize: number;
  isGroupFace: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * One part of the card, as the API judges it. `missing` is a finished Russian sentence and
 * `is_complete` is the same computation submit-for-review runs, so this is rendered as sent rather
 * than re-derived here — a checklist that disagrees with the endpoint refusing the card is worse
 * than no checklist.
 */
export interface ProductSection {
  key: string;
  title: string;
  isComplete: boolean;
  missing: string | null;
}

/**
 * GET /products/{id}. Not the list row: the detail carries description, booking approval, the info
 * sections and the readiness breakdown, and it does not carry the list's grouping counters.
 */
export interface Product {
  productId: string;
  status: ProductStatus;
  title: string;
  description: string | null;
  category: ProductCategoryRef | null;
  quantity: number;
  price: number | null;
  mediaPreviewUrl: string | null;
  fulfillmentLocationId: string | null;
  groupName: string | null;
  bookingApproval: string;
  infoSections: OfferInfoSection[];
  sections: ProductSection[];
  createdAt: string;
  updatedAt: string;
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

/**
 * One saved characteristic, as the API reads it back: the canonical value plus something to show.
 * This is not what is sent — see ProductAttributesInput — and the two must not be confused, since
 * posting the read shape sends an array where a map is expected and the server stores the indices.
 */
export interface ProductAttributeValue {
  key: string;
  valueType: string;
  value: string | null;
  displayValue: string | null;
}

/** GET /products/{id}/attributes — an array, one entry per filled characteristic. */
export interface ProductAttributes {
  productId: string;
  attributes: ProductAttributeValue[];
}

/** PUT /products/{id}/attributes, and the `attributes` of create and patch — a flat map. */
export type ProductAttributesInput = Record<string, string | null>;

/** Read shape to write shape. Everything the server could not resolve a value for is dropped. */
export function toAttributeMap(attributes: ProductAttributeValue[] | null | undefined): Record<string, string> {
  return Object.fromEntries(
    (attributes ?? [])
      .filter(attribute => attribute.value != null && attribute.value !== '')
      .map(attribute => [attribute.key, attribute.value as string])
  );
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

/** GET /products/{id}/policy. */
export interface ProductPolicy {
  productPolicyId?: string;
  productId?: string;
  leadTimeHours: number | null;
  isCancellationAllowed: boolean;
  noShowChargePercent: number | null;
  deposit: ProductDeposit | null;
  updatedAt?: string;
}

/**
 * PUT /products/{id}/policy. Declared rather than derived from the response with Omit: the two are
 * separate schemas upstream and only happen to agree today, and a derived type cannot notice the
 * day they stop.
 */
export interface ProductPolicyInput {
  leadTimeHours: number | null;
  isCancellationAllowed: boolean | null;
  noShowChargePercent: number | null;
  deposit: ProductDeposit | null;
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
/**
 * Two questions, two shapes (api 53a30bf). This is «who invited me», from
 * /seller-invitations/pending: which cabinet, as whom, from whom, until when. Every row it
 * returns is open by definition, so it carries no status — see ProviderInvitation for the
 * cabinet's own outbox, where a row can also be accepted or spent.
 */
export interface PendingSellerInvitation {
  invitationId: string;
  sellerId: string;
  sellerDisplayName: string;
  role: string;
  invitedByName: string | null;
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
