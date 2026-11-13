export type Lang = 'ar' | 'en';
export type L10n = { ar: string; en: string };

export type Role = 'seeker' | 'owner' | 'company' | 'marketer' | 'admin' | 'supervisor';
export type AdvertiserType = 'owner' | 'company' | 'marketer';
export type PropertyType = 'apartment' | 'villa' | 'floor' | 'land' | 'office' | 'shop';
export type Deal = 'sale' | 'rent';
export type Availability = 'available' | 'sold' | 'rented';
export type ListingStatus = 'active' | 'paused' | 'under_review' | 'closed';
export type Identity = 'simulated_verified' | 'unidentified';
export type PoiCat = 'masjid' | 'school_middle' | 'school_high' | 'university' | 'hospital' | 'pharmacy' | 'gym' | 'park' | 'mall';

export interface District { id: string; name: L10n; lat: number; lng: number }

export interface Advertiser {
  id: string;
  type: AdvertiserType;
  name: L10n;
  license: string | null;      // FAL licence (simulated)
  verified: 'verified' | 'pending' | 'rejected';
  joined: string;
}

export interface User { id: string; name: L10n; role: Role; advertiserId?: string }

/** Simulated Riyadh Municipality spatial record (never real data). */
export interface LandRecord { code: string; districtId: string; area: number; lat: number; lng: number }

/** The underlying physical property. Separate from its ads. */
export interface Property {
  id: string;
  landCode: string | null;
  identity: Identity;
  type: PropertyType;
  districtId: string;
  lat: number; lng: number;
  area: number;
  rooms: number;
  baths: number;
  features: string[];
  availability: Availability;
}

/** One advertiser's ad for a property. */
export interface Listing {
  id: string;
  propertyId: string;
  advertiserId: string;
  deal: Deal;
  price: number;               // SAR; rent is per year
  title: L10n;
  desc: L10n;
  imageSeed: number;
  status: ListingStatus;
  featured: boolean;
  views: number;
  adLicense: string;           // simulated REGA ad licence no.
  createdAt: string;
  closedReason?: Availability;
}

export interface Poi { id: string; cat: PoiCat; name: L10n; lat: number; lng: number }

export interface Message { id: string; from: string; text: string; at: string }
export interface Conversation { id: string; listingId: string; seekerId: string; advertiserId: string; messages: Message[] }

export interface StatusRequest {
  id: string; propertyId: string; listingId: string; advertiserId: string;
  outcome: 'sold' | 'rented'; value: number; state: 'pending' | 'approved' | 'rejected'; at: string; reviewedBy?: string;
}
export interface StatusHistory { id: string; propertyId: string; from: Availability; to: Availability; by: string; at: string; note: string }
export interface DuplicateAttempt { id: string; advertiserId: string; landCode: string; existingListingId: string; at: string }
export interface Transaction { id: string; propertyId: string; listingId: string; advertiserId: string; value: number; commission: number; rule: string; at: string }
export interface Notice { id: string; to: string; text: L10n; at: string; read: boolean }
export interface Report { id: string; listingId: string; by: string; reason: string; at: string; open: boolean }

export type PayMethod = 'mada' | 'visa' | 'mastercard' | 'applepay' | 'stcpay';
export interface PayItem { label: L10n; amount: number; note?: L10n }
/** A simulated payment (booking deposit or rent payment). No real money moves in this prototype. */
export interface Payment {
  id: string; receiptNo: string; listingId: string; propertyId: string; advertiserId: string; payerId: string;
  kind: 'sale_deposit' | 'rent_payment'; installments?: number;
  items: PayItem[]; vat: number; total: number;
  method: PayMethod; last4?: string;
  payerName: string; payerIdLast4: string; payerPhone: string;
  status: 'paid'; at: string;
}

export interface State {
  version: number;
  lang: Lang;
  currentUserId: string;
  users: User[];
  advertisers: Advertiser[];
  landRegistry: LandRecord[];
  properties: Property[];
  listings: Listing[];
  conversations: Conversation[];
  favorites: Record<string, string[]>;   // userId -> propertyIds
  statusRequests: StatusRequest[];
  history: StatusHistory[];
  duplicates: DuplicateAttempt[];
  transactions: Transaction[];
  notices: Notice[];
  reports: Report[];
  adminLog: { id: string; by: string; action: string; at: string }[];
  payments: Payment[];
}
