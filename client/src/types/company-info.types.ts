/** Company Info editor — mirrors server/app/contracts/company_info.py and services/company_info.py. */

export type SharedFactKey =
  | "company_name"
  | "website"
  | "industry"
  | "description"
  | "industries_served"
  | "offerings_summary"
  | "customer_types";

export type ContactPurpose = "general" | "sales" | "support" | "booking" | "billing" | "other";
export type ContactChannel = "email" | "phone" | "whatsapp" | "form" | "link";
export type BranchKind = "office" | "store" | "warehouse" | "service_center" | "factory" | "other";
export type VisitPolicy = "walk_in" | "appointment_only" | "no_visits" | "unknown";
export type HoursScope = "opening" | "support" | "other";
export type ServiceMode = "online" | "in_person" | "on_site" | "hybrid";
export type EnquiryKind = "booking" | "demo" | "quote" | "other";
export type NotApplicableSection =
  | "branches"
  | "hours"
  | "coverage"
  | "enquiry_links"
  | "contact_routes"
  | "languages";

export interface ContactRoute {
  id?: string;
  purpose: ContactPurpose;
  label?: string | null;
  channel: ContactChannel;
  value: string;
  branch_id?: string | null;
  note?: string | null;
}

export interface Branch {
  id?: string;
  name: string;
  kind: BranchKind;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postal_code?: string | null;
  map_url?: string | null;
  timezone?: string | null;
  hours_note?: string | null;
  visit_policy: VisitPolicy;
  pickup_note?: string | null;
}

export interface HoursEntry {
  id?: string;
  scope: HoursScope;
  label?: string | null;
  days: string;
  open?: string | null;
  close?: string | null;
  closed: boolean;
  branch_id?: string | null;
  note?: string | null;
}

export interface EnquiryLink {
  id?: string;
  kind: EnquiryKind;
  label?: string | null;
  url: string;
}

export interface CompanyFacts {
  public_name: string | null;
  legal_name: string | null;
  founded_year: number | null;
  timezone: string | null;
  hours: HoursEntry[];
  holiday_note: string | null;
  visit_policy: VisitPolicy;
  appointment_note: string | null;
  service_modes: ServiceMode[];
  coverage_areas: string[];
  coverage_note: string | null;
  shipping_note: string | null;
  languages: string[];
  contact_routes: ContactRoute[];
  branches: Branch[];
  enquiry_links: EnquiryLink[];
  not_applicable: NotApplicableSection[];
}

export interface SharedFact<T = string | null> {
  value: T;
  owner: "organization" | "business_profile";
  shared: boolean;
}

export type IndexState = "ready" | "indexing" | "delayed" | "not_published";

export interface CompanyInfoState {
  revision: number;
  permissions: { edit_company_facts: boolean; edit_shared_facts: boolean };
  shared: {
    company_name: SharedFact;
    website: SharedFact;
    industry: SharedFact;
    description: SharedFact;
    industries_served: SharedFact;
    offerings_summary: SharedFact;
    customer_types: SharedFact<string[]>;
  };
  facts: CompanyFacts;
  suggestions: {
    timezone?: { value: string; from: string };
    languages?: { value: string[]; from: string };
  };
  ai_can_share: { section: string; text: string }[];
  index: { state: IndexState; version_number: number | null; saved_at: string | null; indexed_at?: string | null };
  legacy_items: number;
  saved?: boolean;
}

export interface CompanyInfoSaveRequest {
  revision: number;
  shared?: Partial<Record<SharedFactKey, string | string[] | null>>;
  facts?: Partial<CompanyFacts>;
  share?: Partial<Record<SharedFactKey, boolean>>;
}
