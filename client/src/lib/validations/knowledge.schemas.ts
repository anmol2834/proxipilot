import { z } from "zod";

export const baseKnowledgeSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters."),
  excerpt: z.string().min(5, "Summary excerpt must be at least 5 characters."),
  status: z.enum(["Published", "Draft", "Archived", "Processing", "Needs review"]).default("Published"),
  source: z.enum(["Manual", "Website", "Document", "Imported", "Integration"]).default("Manual"),
  content: z.string().optional(),
});

export const productServiceSchema = baseKnowledgeSchema.extend({
  category: z.literal("products-services").default("products-services"),
  pricing: z.string().optional(),
  currency: z.string().default("USD"),
  warranty: z.string().optional(),
  serviceRegions: z.string().optional(),
  supportedModels: z.string().optional(),
});

export const contactSchema = baseKnowledgeSchema.extend({
  category: z.literal("contacts").default("contacts"),
  role: z.string().optional(),
  department: z.string().optional(),
  email: z.string().email("Please provide a valid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  location: z.string().optional(),
});

export const policySchema = baseKnowledgeSchema.extend({
  category: z.literal("policies").default("policies"),
  policyType: z.string().optional(),
  effectiveDate: z.string().optional(),
  conditions: z.string().optional(),
});

export const faqSchema = baseKnowledgeSchema.extend({
  category: z.literal("support-faqs").default("support-faqs"),
  question: z.string().optional(),
  answer: z.string().optional(),
  relatedService: z.string().optional(),
});

export const offerSchema = baseKnowledgeSchema.extend({
  category: z.literal("offers-promotions").default("offers-promotions"),
  discount: z.string().optional(),
  validUntil: z.string().optional(),
  code: z.string().optional(),
});

export const operationSchema = baseKnowledgeSchema.extend({
  category: z.literal("operations").default("operations"),
  sopTitle: z.string().optional(),
  turnaroundTime: z.string().optional(),
});

export const locationSchema = baseKnowledgeSchema.extend({
  category: z.literal("locations").default("locations"),
  address: z.string().optional(),
  city: z.string().optional(),
  coverageRadius: z.string().optional(),
  hours: z.string().optional(),
});

export const brandCommunicationSchema = baseKnowledgeSchema.extend({
  category: z.literal("brand-communication").default("brand-communication"),
  tone: z.string().optional(),
  preferredTerms: z.string().optional(),
  avoidedTerms: z.string().optional(),
});

export const companyInfoSchema = baseKnowledgeSchema.extend({
  category: z.literal("company-info").default("company-info"),
  missionStatement: z.string().optional(),
  foundedYear: z.string().optional(),
  headquarters: z.string().optional(),
});
