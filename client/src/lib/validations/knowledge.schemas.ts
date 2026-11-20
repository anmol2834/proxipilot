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

export const processTimelineSchema = baseKnowledgeSchema.extend({
  category: z.literal("processes-timelines").default("processes-timelines"),
  trigger: z.string().optional(),
  timeline: z.string().optional(),
  steps: z.string().optional(),
});

export const companyInfoSchema = baseKnowledgeSchema.extend({
  category: z.literal("company-info").default("company-info"),
  missionStatement: z.string().optional(),
  foundedYear: z.string().optional(),
  headquarters: z.string().optional(),
});
