/** The 6 knowledge categories. One is always selected on the Knowledge page (no "all" view). */
export type KnowledgeCategory =
  | "products-services"
  | "company-info"
  | "policies"
  | "support-faqs"
  | "offers-promotions"
  | "processes-timelines";

/** Kept as an alias for existing imports: every category is concrete now. */
export type ConcreteKnowledgeCategory = KnowledgeCategory;

/** The 6 knowledge categories, in display order (Products & Services first). */
export const KNOWN_CATEGORIES = [
  "products-services",
  "company-info",
  "policies",
  "support-faqs",
  "offers-promotions",
  "processes-timelines",
] as const satisfies readonly KnowledgeCategory[];

/** Selected when the Knowledge page opens without a (valid) ?category= in the URL. */
export const DEFAULT_KNOWLEDGE_CATEGORY: KnowledgeCategory = "products-services";

export function isKnowledgeCategory(value: unknown): value is KnowledgeCategory {
  return typeof value === "string" && (KNOWN_CATEGORIES as readonly string[]).includes(value);
}

export type KnowledgeStatus =
  | "Published"
  | "Draft"
  | "Archived"
  | "Processing"
  | "Needs review";

export type KnowledgeSource =
  | "Manual"
  | "Website"
  | "Document"
  | "Imported"
  | "Integration";

export type KnowledgeItemType =
  | "Service"
  | "Policy"
  | "Offer"
  | "Information"
  | "FAQ"
  | "Process";

export interface BaseKnowledgeItem {
  id: string;
  organizationId: string;
  category: KnowledgeCategory;
  type: KnowledgeItemType;
  title: string;
  excerpt: string;
  status: KnowledgeStatus;
  source: KnowledgeSource;
  version: number;
  updatedAt: string; // e.g. "Sep 12, 2024"
  updatedBy: string; // e.g. "You"
  content?: string;
  tags?: string[];
}

export interface ProductServiceKnowledge extends BaseKnowledgeItem {
  category: "products-services";
  type: "Service";
  pricing?: string;
  currency?: string;
  commercialPriceType?: "fixed" | "estimate" | "starting_price" | "quote_required" | "not_specified";
  warranty?: string;
  serviceRegions?: string;
  supportedModels?: string;
}

export interface PolicyKnowledge extends BaseKnowledgeItem {
  category: "policies";
  type: "Policy";
  policyType?: string;
  effectiveDate?: string;
  conditions?: string;
}

export interface FAQKnowledge extends BaseKnowledgeItem {
  category: "support-faqs";
  type: "FAQ";
  question?: string;
  answer?: string;
  relatedService?: string;
}

export interface OfferKnowledge extends BaseKnowledgeItem {
  category: "offers-promotions";
  type: "Offer";
  discount?: string;
  validUntil?: string;
  code?: string;
}

export interface ProcessTimelineKnowledge extends BaseKnowledgeItem {
  category: "processes-timelines";
  type: "Process";
  trigger?: string;
  timeline?: string;
  steps?: string;
}

export interface CompanyInfoKnowledge extends BaseKnowledgeItem {
  category: "company-info";
  type: "Information";
  missionStatement?: string;
  foundedYear?: string;
  headquarters?: string;
}

export type KnowledgeItem =
  | ProductServiceKnowledge
  | PolicyKnowledge
  | FAQKnowledge
  | OfferKnowledge
  | ProcessTimelineKnowledge
  | CompanyInfoKnowledge;

export type KnowledgeSortOption =
  | "updated-desc"
  | "updated-asc"
  | "title-asc"
  | "title-desc"
  | "status";

export interface KnowledgeFilters {
  category: KnowledgeCategory;
  search: string;
  status?: KnowledgeStatus | "All";
  type?: KnowledgeItemType | "All";
  source?: KnowledgeSource | "All";
  sort: KnowledgeSortOption;
  page: number;
  pageSize: number;
}
