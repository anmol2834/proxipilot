export type KnowledgeCategory =
  | "all"
  | "company-info"
  | "products-services"
  | "contacts"
  | "policies"
  | "support-faqs"
  | "offers-promotions"
  | "operations"
  | "locations"
  | "brand-communication";

export type ConcreteKnowledgeCategory = Exclude<KnowledgeCategory, "all">;

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
  | "Contact"
  | "Offer"
  | "Information"
  | "FAQ"
  | "Process"
  | "Guideline";

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

export interface ContactKnowledge extends BaseKnowledgeItem {
  category: "contacts";
  type: "Contact";
  role?: string;
  department?: string;
  email?: string;
  phone?: string;
  location?: string;
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

export interface OperationKnowledge extends BaseKnowledgeItem {
  category: "operations";
  type: "Process";
  sopTitle?: string;
  turnaroundTime?: string;
}

export interface LocationKnowledge extends BaseKnowledgeItem {
  category: "locations";
  type: "Information";
  address?: string;
  city?: string;
  coverageRadius?: string;
  hours?: string;
}

export interface BrandCommunicationKnowledge extends BaseKnowledgeItem {
  category: "brand-communication";
  type: "Guideline";
  tone?: string;
  preferredTerms?: string;
  avoidedTerms?: string;
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
  | ContactKnowledge
  | PolicyKnowledge
  | FAQKnowledge
  | OfferKnowledge
  | OperationKnowledge
  | LocationKnowledge
  | BrandCommunicationKnowledge
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
