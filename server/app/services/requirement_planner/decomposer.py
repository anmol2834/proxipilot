"""Multi-Intent Requirement Decomposer — Phase 3.

Decomposes complex, multi-intent emails into discrete, independent PlannedRequirement
objects spanning all 6 ProxiPilot Knowledge Dashboard categories:
1. Company Info (incl. the company's contact details, address and hours)
2. Products & Services
3. Policies
4. Support & FAQs
5. Offers & Promotions
6. Processes & Timelines

Supports 10+ independent requirements per email with explicit dependencies,
structured filters, category routing, and bounded resource limits.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid

from app.contracts.requirement_plan import (
    EntityResolutionStatus,
    IntentType,
    PlannedEntity,
    PlannedFilter,
    PlannedRange,
    PlannedRequirement,
    RetrievalStrategy,
)
from app.contracts.retrieval_capability import FilterOperator
from app.core.logging import logger
from app.services.context_resolver import ContextEnvelope
from app.services.requirement_planner.preprocessor import PreprocessedEmail


# Segment-level "process / timeline" wording (generic; no business vocabulary).
_PROCESS_TIMELINE_SEGMENT = re.compile(
    r"\bhow\s+(?:long|soon)\b|\bhow\s+many\s+(?:working\s+|business\s+)?(?:days|hours|weeks)\b|\bby\s+when\b"
    r"|\blead[\s-]?times?\b|\bturn[\s-]?around\b|\btat\b|\beta\b|\bestimated\s+delivery\b|\bdelivery\s+to\b"
    r"|\b(?:processing|confirmation|dispatch|delivery|shipping|transit|approval|response|refund)\s+(?:time|timelines?|period|days)\b"
    r"|\b(?:order|po|purchase\s+order)\s+confirmation\b"
    r"|\bafter\s+(?:the\s+|our\s+|my\s+)?(?:po|purchase\s+order|payment|order|approval)\b"
    r"|\bwhat\s+happens\s+(?:next|after)\b|\bnext\s+steps?\b|\bkitne\s+din\b|\bkab\s+tak\b",
    re.IGNORECASE,
)


class MultiIntentDecomposer:
    """Deterministic, category-aware multi-intent decomposition engine."""

    # Category classification patterns
    CATEGORY_PATTERNS = [
        (
            "products_services",
            re.compile(
                r"(?:model[s]?|product[s]?|service[s]?|package[s]?|laptop[s]?|device[s]?|catalogue|catalog|"
                r"priced|under\s+[₹rs\.]*|budget|cost|quote|eligible\s+model)",
                re.IGNORECASE,
            ),
        ),
        (
            "policies",
            re.compile(
                r"(?:warranty(?:\s+policy|\s+terms|\s+claim)?|return\s+policy|cancellation\s+policy|"
                r"refund\s+policy|exchange\s+policy|replacement\s+policy|official\s+policy|terms\s+and\s+conditions)",
                re.IGNORECASE,
            ),
        ),
        (
            "support_faqs",
            re.compile(
                r"(?:overheating|troubleshoot|error\s+code|technical\s+issue|not\s+working|"
                r"laptop\s+issue|problem|failure|defect|rattling|noise|support\s+faq|how\s+to\s+fix)",
                re.IGNORECASE,
            ),
        ),
        (
            "offers_promotions",
            re.compile(
                r"(?:offer|promotion[s]?|discount[s]?|promo\s+code|coupon|deal[s]?|"
                r"festive\s+offer|cashback|bulk\s+discount|applies\s+to\s+this)",
                re.IGNORECASE,
            ),
        ),
        (
            "processes_timelines",
            re.compile(
                r"(?:delivery\s+timeline[s]?|delivery\s+to|shipping\s+time|estimated\s+delivery|lead\s+time|"
                r"turnaround|confirmation\s+time|order\s+confirmation|after\s+(?:the\s+)?(?:po|purchase\s+order|payment)|"
                r"dispatch|processing\s+time|how\s+long|how\s+many\s+days|installation\s+process|"
                r"how\s+does\s+installation\s+work|fulfillment\s+procedure|next\s+steps?|what\s+happens\s+(?:next|after))",
                re.IGNORECASE,
            ),
        ),
        (
            "company_info",
            re.compile(
                r"(?:about\s+(?:your\s+)?company|legal\s+name|business\s+profile|company\s+profile|"
                r"official\s+website|headquarters|management|business\s+type|certifications|"
                r"contact(?:\s+details|\s+number|\s+person)?|phone\s+number|email\s+address|"
                r"office\s+location|store\s+location|address|where\s+are\s+you\s+located|"
                r"operating\s+hours|working\s+hours|business\s+hours)",
                re.IGNORECASE,
            ),
        ),
    ]

    @classmethod
    def decompose(
        cls,
        text: str,
        preprocessed: Optional[PreprocessedEmail] = None,
        envelope: Optional[ContextEnvelope] = None,
        fallback_intent: IntentType = IntentType.PRODUCT_DISCOVERY,
        fallback_category: str = "products_services",
    ) -> List[PlannedRequirement]:
        """Decompose incoming email text into an array of independent PlannedRequirement objects."""
        if not text or not text.strip():
            return []

        clean_text = cls._strip_non_request_text(text.strip()) or text.strip()
        segments = cls._split_into_requirement_segments(clean_text)

        requirements: List[PlannedRequirement] = []
        product_req_id: Optional[str] = None

        for idx, segment in enumerate(segments):
            seg_text = segment.strip().rstrip(".,;")
            if not seg_text or len(seg_text) < 4:
                continue

            # Identify category and intent
            cat, intent, strategy = cls._classify_segment(seg_text)

            # Extract numeric constraints/ranges
            p_range, p_filters = cls._extract_segment_constraints(seg_text, preprocessed)

            req_id = f"req_{idx + 1}_{cat[:4]}"
            req = PlannedRequirement(
                requirement_id=req_id,
                intent=intent,
                category=cat,
                description=seg_text,
                query_text=seg_text,
                entities=cls._extract_segment_entities(seg_text),
                filters=p_filters,
                range_semantics=p_range,
                requested_attributes=cls._infer_requested_attributes(cat, seg_text),
                retrieval_strategy=strategy,
                dependencies=[],
                requested_count=cls._infer_requested_count(cat, seg_text),
            )

            requirements.append(req)

        requirements = cls._merge_product_discovery(requirements)

        # Resolve primary product requirement ID (preferring requirement with price/range constraints)
        prod_reqs = [r for r in requirements if r.category == "products_services"]
        primary_prod = next((r for r in prod_reqs if r.range_semantics), prod_reqs[0] if prod_reqs else None)
        if primary_prod:
            for req in requirements:
                if req.category in ("policies", "support_faqs", "offers_promotions") and req.requirement_id != primary_prod.requirement_id:
                    if primary_prod.requirement_id not in req.dependencies:
                        req.dependencies.append(primary_prod.requirement_id)

        # If zero segments matched distinct categories, fallback to single requirement
        if not requirements:
            single_range = None
            single_filters = []
            if preprocessed and preprocessed.ranges:
                r0 = preprocessed.ranges[0]
                single_range = PlannedRange(
                    field="price",
                    min_value=r0.min_value,
                    max_value=r0.max_value,
                    currency=r0.currency or "INR",
                )
                if r0.max_value is not None:
                    single_filters.append(
                        PlannedFilter(
                            field="price",
                            operator=FilterOperator.LTE,
                            value=r0.max_value,
                        )
                    )

            requirements.append(
                PlannedRequirement(
                    requirement_id="req_1_main",
                    intent=fallback_intent,
                    category=fallback_category,
                    description=clean_text[:200],
                    query_text=clean_text[:300],
                    entities=[],
                    filters=single_filters,
                    range_semantics=single_range,
                    requested_attributes=["price", "name", "description"],
                    retrieval_strategy=RetrievalStrategy.HYBRID,
                    dependencies=[],
                    requested_count=5,
                )
            )

        return requirements

    _GREETING_RE = re.compile(
        r"^(?:hi|hello|hey|hii+|dear|greetings|good\s+(?:morning|afternoon|evening)|namaste|respected)\b[^.?!]{0,40}[,!.:]?$",
        re.IGNORECASE)
    _SIGNOFF_RE = re.compile(
        r"^(?:(?:best|kind|warm|warmest|with)\s+regards|regards|thanks(?:\s*(?:&|and)\s*regards)?|thank\s+you(?:\s+so\s+much)?|"
        r"many\s+thanks|sincerely|yours\s+(?:sincerely|faithfully|truly)|cheers|best(?:\s+wishes)?|thx|ty)[\s,.!-]*$",
        re.IGNORECASE)
    _QUOTE_START_RE = re.compile(r"^(?:on\s.+wrote:|-{2,}\s*original message\s*-{2,}|from:\s.+|>)", re.IGNORECASE)
    _LIST_LINE_RE = re.compile(r"^(?:\d+[.)]|[•\-\*])\s+")

    @classmethod
    def _strip_non_request_text(cls, text: str) -> str:
        """Keep only what the customer is asking: drop greeting lines, the sign-off and
        everything after it (signature, name), quoted earlier mail; re-join soft-wrapped
        lines so one sentence is one segment. Bullet / numbered lines stay separate."""
        lines = [ln.rstrip() for ln in text.replace(chr(13) + chr(10), chr(10)).split(chr(10))]
        kept: List[str] = []
        for ln in lines:
            st = ln.strip()
            if cls._QUOTE_START_RE.match(st):
                break
            if cls._SIGNOFF_RE.match(st):
                break
            if not kept and not st:
                continue
            if cls._GREETING_RE.match(st) and not any(k.strip() for k in kept):
                continue
            kept.append(st)
        paragraphs: List[str] = []
        cur: List[str] = []
        for st in kept + [""]:
            if not st:
                if cur:
                    paragraphs.append(" ".join(cur))
                    cur = []
                continue
            if cls._LIST_LINE_RE.match(st) and cur:
                paragraphs.append(" ".join(cur))
                cur = []
            cur.append(st)
        return chr(10).join(p for p in paragraphs if p.strip())

    @classmethod
    def _merge_product_discovery(cls, requirements: List[PlannedRequirement]) -> List[PlannedRequirement]:
        """Plain product-discovery segments of one email describe ONE need ("I want X ... suggest
        models ... share prices"). Merge them into a single requirement so a sentence that
        merely continues the request is never retrieved as an independent product search."""
        disc = [r for r in requirements if r.category == "products_services" and r.intent == IntentType.PRODUCT_DISCOVERY]
        if len(disc) <= 1:
            return requirements
        head = disc[0]
        merged = head.model_copy(deep=True)
        merged.query_text = " ".join(r.query_text for r in disc if r.query_text)[:600]
        merged.description = merged.query_text[:300]
        for r in disc[1:]:
            merged.entities.extend(r.entities)
            merged.filters.extend(r.filters)
            merged.range_semantics = merged.range_semantics or r.range_semantics
            merged.requested_count = max(merged.requested_count, r.requested_count)
            for a in r.requested_attributes:
                if a not in merged.requested_attributes:
                    merged.requested_attributes.append(a)
        out: List[PlannedRequirement] = []
        for r in requirements:
            if r is head:
                out.append(merged)
            elif r in disc:
                continue
            else:
                out.append(r)
        return out

    @classmethod
    def _split_into_requirement_segments(cls, text: str) -> List[str]:
        """Split text on punctuation, bullet points, and coordinated clauses."""
        # 1. First split by lines or numbered lists
        raw_chunks = re.split(r"(?:\r?\n+|\d+\.\s+|[•\-\*]\s+)", text)
        segments: List[str] = []

        # Split connectors like ", and ", ", share ", ", tell me ", ", explain ", ", check ", ", provide "
        clause_splitter = re.compile(
            r",\s*(?=(?:and\s+)?(?:share|tell\s+me|compare|explain|check|provide|give\s+me|what\s+is|who\s+handles|is\s+there|show\s+me)\b)",
            re.IGNORECASE,
        )

        for chunk in raw_chunks:
            chunk = chunk.strip()
            if not chunk:
                continue

            # Split on question marks and periods followed by space/capital
            sentences = re.split(r"(?<=[?!])\s+|(?<=\.)\s+(?=[A-Z])", chunk)
            for s in sentences:
                s = s.strip()
                if not s:
                    continue

                # Split on comma-separated imperative/interrogative clauses
                sub_clauses = clause_splitter.split(s)
                for sc in sub_clauses:
                    sc = sc.strip()
                    if sc and len(sc) >= 4:
                        segments.append(sc)

        return segments

    @classmethod
    def _classify_segment(cls, text: str) -> Tuple[str, IntentType, RetrievalStrategy]:
        """Classify a text segment into target category, intent, and retrieval strategy."""
        text_lower = text.lower()

        # Check in priority order
        if any(w in text_lower for w in ("warranty", "guarantee")):
            return "policies", IntentType.WARRANTY_QUESTION, RetrievalStrategy.HYBRID

        if any(w in text_lower for w in ("return policy", "cancellation policy", "refund policy", "exchange policy")):
            return "policies", IntentType.POLICY_QUESTION, RetrievalStrategy.HYBRID

        # Processes & Timelines: "after the PO, what is the confirmation time?", lead / dispatch /
        # delivery / processing times, "how long", "what happens next".
        if _PROCESS_TIMELINE_SEGMENT.search(text_lower):
            return "processes_timelines", IntentType.ORDER_OR_DELIVERY_QUESTION, RetrievalStrategy.HYBRID

        # The company's own contact details live in Company Info.
        if any(w in text_lower for w in ("contact", "retailer contact", "sales contact", "billing contact", "who handles",
                                         "phone number", "email address")):
            return "company_info", IntentType.SERVICE_LOOKUP, RetrievalStrategy.EXACT_LOOKUP

        if any(w in text_lower for w in ("offer", "promotion", "discount", "coupon", "special deal")):
            return "offers_promotions", IntentType.PRICE_QUERY, RetrievalStrategy.HYBRID

        if any(w in text_lower for w in ("overheating", "troubleshoot", "issue", "problem", "error code", "not working", "fix")):
            return "support_faqs", IntentType.SUPPORT_ISSUE, RetrievalStrategy.SEMANTIC_DISCOVERY

        if any(w in text_lower for w in ("service-center", "service center", "location", "office address", "store address",
                                         "where are you", "operating hours", "working hours", "business hours")):
            return "company_info", IntentType.SERVICE_LOOKUP, RetrievalStrategy.EXACT_LOOKUP

        if any(w in text_lower for w in ("installation process", "operating procedure", "how to install")):
            return "processes_timelines", IntentType.SUPPORT_ISSUE, RetrievalStrategy.HYBRID

        if any(w in text_lower for w in ("about your company", "legal name", "company profile", "official website")):
            return "company_info", IntentType.CATALOGUE_REQUEST, RetrievalStrategy.SEMANTIC_DISCOVERY

        if any(w in text_lower for w in ("compare", "versus", "vs", "difference")):
            return "products_services", IntentType.PRODUCT_COMPARISON, RetrievalStrategy.HYBRID

        # Default to products & services
        return "products_services", IntentType.PRODUCT_DISCOVERY, RetrievalStrategy.HYBRID

    @classmethod
    def _extract_segment_constraints(
        cls,
        text: str,
        preprocessed: Optional[PreprocessedEmail],
    ) -> Tuple[Optional[PlannedRange], List[PlannedFilter]]:
        """Extract exact numeric boundaries, price ranges, and filters from segment text."""
        p_range: Optional[PlannedRange] = None
        p_filters: List[PlannedFilter] = []

        # Check "under ₹70,000" or "below 50,000" or "less than 70000"
        under_match = re.search(r"(?:under|below|less\s+than|upto|up\s+to)\s*[₹rs\.]*\s*([0-9,]+)", text, re.IGNORECASE)
        if under_match:
            try:
                max_val = float(under_match.group(1).replace(",", ""))
                p_range = PlannedRange(
                    field="price",
                    min_value=None,
                    max_value=max_val,
                    is_max_inclusive=True,
                    currency="INR",
                )
                p_filters.append(
                    PlannedFilter(
                        field="price",
                        operator=FilterOperator.LTE,
                        value=max_val,
                    )
                )
            except Exception:
                pass

        # Check "between 500 and 1500"
        between_match = re.search(r"between\s*[₹rs\.]*\s*([0-9,]+)\s*(?:and|to|-)\s*[₹rs\.]*\s*([0-9,]+)", text, re.IGNORECASE)
        if between_match:
            try:
                min_val = float(between_match.group(1).replace(",", ""))
                max_val = float(between_match.group(2).replace(",", ""))
                p_range = PlannedRange(
                    field="price",
                    min_value=min_val,
                    max_value=max_val,
                    is_min_inclusive=True,
                    is_max_inclusive=True,
                    currency="INR",
                )
                p_filters.append(
                    PlannedFilter(
                        field="price",
                        operator=FilterOperator.BETWEEN,
                        value={"min": min_val, "max": max_val, "currency": "INR"},
                    )
                )
            except Exception:
                pass

        return p_range, p_filters

    @classmethod
    def _extract_segment_entities(cls, text: str) -> List[PlannedEntity]:
        """Extract explicit domain entities from segment text."""
        entities: List[PlannedEntity] = []

        # Check location mentions (e.g. "Mumbai", "Delhi", "Bangalore")
        loc_match = re.search(r"\b(?:to|in|at)\s+(Mumbai|Delhi|Bangalore|Bengaluru|Hyderabad|Chennai|Pune|Kolkata|Ahmedabad)\b", text, re.IGNORECASE)
        if loc_match:
            loc_name = loc_match.group(1).capitalize()
            entities.append(
                PlannedEntity(
                    entity_type="location",
                    original_text=loc_match.group(0),
                    canonical_value=loc_name,
                    resolution_status=EntityResolutionStatus.RESOLVED,
                )
            )

        # Check role mentions
        if "bulk order" in text.lower():
            entities.append(
                PlannedEntity(
                    entity_type="department",
                    original_text="bulk orders",
                    canonical_value="bulk_orders_sales",
                    resolution_status=EntityResolutionStatus.RESOLVED,
                )
            )

        # Check product type mentions (e.g. "laptop", "ac", "refrigerator")
        for prod_type in ("laptop", "computer", "phone", "refrigerator", "appliance", "ac", "washing machine"):
            if prod_type in text.lower():
                entities.append(
                    PlannedEntity(
                        entity_type="product_category",
                        original_text=prod_type,
                        canonical_value=prod_type,
                        resolution_status=EntityResolutionStatus.RESOLVED,
                    )
                )
                break

        return entities

    @classmethod
    def _infer_requested_attributes(cls, category: str, text: str) -> List[str]:
        """Infer required output attributes based on category and question."""
        if category == "products_services":
            return ["name", "price", "sku", "description", "warranty"]
        elif category == "policies":
            return ["policy_name", "details", "effective_from", "effective_until"]
        elif category == "support_faqs":
            return ["question", "answer", "category", "topic"]
        elif category == "offers_promotions":
            return ["title", "discount_percentage", "coupon_code", "valid_until"]
        elif category == "processes_timelines":
            return ["process_name", "trigger", "timeline", "steps", "conditions"]
        elif category == "company_info":
            return ["legal_name", "description", "website", "phone", "email", "address", "business_hours"]
        return ["title", "details"]

    @classmethod
    def _infer_requested_count(cls, category: str, text: str) -> int:
        """Assign sensible default requested result count."""
        if category in ("policies", "company_info"):
            return 1
        return 3
