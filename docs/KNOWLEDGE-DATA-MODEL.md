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

### 2.2 Contacts
```typescript
export interface ContactKnowledgeItem extends BaseKnowledgeItem {
  category: "contacts";
  type: "Contact";
  role: string;
  department?: string;
  email: string;
  phone?: string;
  location?: string;
}
```

### 2.3 Policies
```typescript
export interface PolicyKnowledgeItem extends BaseKnowledgeItem {
  category: "policies";
  type: "Policy";
  policyType: string;
  effectiveDate?: string;
  expirationDate?: string;
}
```

### 2.4 Support & FAQs
```typescript
export interface FAQKnowledgeItem extends BaseKnowledgeItem {
  category: "support-faqs";
  type: "FAQ";
  question: string;
  answer: string;
  tags?: string[];
}
```

### 2.5 Offers & Promotions
```typescript
export interface OfferKnowledgeItem extends BaseKnowledgeItem {
  category: "offers-promotions";
  type: "Offer";
  discountAmount?: string;
  promoCode?: string;
  validUntil?: string;
}
```

### 2.6 Operations
```typescript
export interface OperationKnowledgeItem extends BaseKnowledgeItem {
  category: "operations";
  type: "Process" | "Standard Operating Procedure";
  workflowOwner?: string;
}
```

### 2.7 Locations
```typescript
export interface LocationKnowledgeItem extends BaseKnowledgeItem {
  category: "locations";
  type: "Information";
  address: string;
  city: string;
  state?: string;
  businessHours?: string;
}
```

### 2.8 Brand & Communication
```typescript
export interface BrandCommunicationKnowledgeItem extends BaseKnowledgeItem {
  category: "brand-communication";
  type: "Guidelines";
  tone: string;
  preferredTerms?: string;
  avoidedTerms?: string;
}
```

### 2.9 Company Info
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
