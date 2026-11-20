# Knowledge Data Model & Validation Schemas

## 1. Discriminated Union Architecture
Knowledge records are modeled as a discriminated union based on the `category` property. Every record inherits standard audit metadata:

```typescript
export interface BaseKnowledgeItem {
  id: string;
  organizationId: string;
  category: ConcreteKnowledgeCategory;
  type: KnowledgeItemType;
  title: string;
  subtitle?: string;
  content: string;
  status: KnowledgeStatus;
  source: KnowledgeSource;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}
```

---

## 2. Category-Specific Models

### 2.1 Products & Services (Includes Pricing)
```typescript
export interface ProductServiceKnowledgeItem extends BaseKnowledgeItem {
  category: "products-services";
  type: "Service" | "Product";
  pricing: string;          // Formatted price or tier
  currency: string;         // e.g. "USD"
  availability: string;     // e.g. "Immediate", "By appointment"
  warranty?: string;        // e.g. "90 days warranty on parts"
  serviceRegions?: string;  // e.g. "Greater Metro Area"
}
```

### 2.2 Policies
```typescript
export interface PolicyKnowledgeItem extends BaseKnowledgeItem {
  category: "policies";
  type: "Policy";
  policyType: string;
  effectiveDate?: string;
  expirationDate?: string;
}
```

### 2.3 Support & FAQs
```typescript
export interface FAQKnowledgeItem extends BaseKnowledgeItem {
  category: "support-faqs";
  type: "FAQ";
  question: string;
  answer: string;
  tags?: string[];
}
```

### 2.4 Offers & Promotions
```typescript
export interface OfferKnowledgeItem extends BaseKnowledgeItem {
  category: "offers-promotions";
  type: "Offer";
  discountAmount?: string;
  promoCode?: string;
  validUntil?: string;
}
```

### 2.5 Processes & Timelines
```typescript
export interface ProcessTimelineKnowledgeItem extends BaseKnowledgeItem {
  category: "processes-timelines";
  type: "Process";
  trigger?: string;   // e.g. "After the PO is received"
  timeline?: string;  // e.g. "Within 24 working hours"
  steps?: string;
}
```

### 2.6 Company Info
```typescript
export interface CompanyInfoKnowledgeItem extends BaseKnowledgeItem {
  category: "company-info";
  type: "Information";
  industry?: string;
  founded?: string;
  missionStatement?: string;
}
```

---

## 3. Zod Validation Schemas (`knowledge.schemas.ts`)
Each category has a dedicated Zod schema for type-safe validation in both client forms and API endpoints:
- `productServiceSchema`
- `contactSchema`
- `policySchema`
- `faqSchema`
- `offerSchema`
- `operationSchema`
- `locationSchema`
- `brandCommunicationSchema`
- `companyInfoSchema`
