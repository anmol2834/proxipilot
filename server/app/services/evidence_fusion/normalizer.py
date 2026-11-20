"""Candidate Normalizer — Phase 5: Candidate Fusion & Evidence Verification.

Normalizes candidates from disparate sources (PostgreSQL canonical records,
Qdrant semantic hits, and Phase 4 RetrievalResult evidence items) into a unified,
strongly-typed VerifiedCandidate and extracts atomic VerifiedFact items.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, Union

from app.contracts.evidence_fusion import (
    CandidateRole,
    VerifiedCandidate,
    VerifiedFact,
)
from app.contracts.retrieval_result import (
    EvidenceProvenance,
    FactVerificationStatus,
    RetrievedEvidenceItem,
    VerifiedPricingEvidence,
)
from app.core.logging import logger
from app.models.knowledge import KnowledgeItem, KnowledgeVersion
from app.services.retrieval_router.semantic_retriever import SemanticCandidateHit


# Company contact attributes -> contact facts. support/sales addresses are company emails too.
_CONTACT_FACT_FIELDS = (
    ("email", "contact_email"), ("support_email", "contact_email"), ("sales_email", "contact_email"),
    ("phone", "contact_phone"), ("support_phone", "contact_phone"),
    ("contact_person", "contact_contact_person"), ("department", "contact_department"),
    ("escalation_tier", "contact_escalation_tier"),
    ("address", "contact_address"), ("headquarters", "contact_address"),
    ("business_hours", "contact_business_hours"),
)
_CONTACT_ATTRS = {f for f, _ in _CONTACT_FACT_FIELDS} - {"department", "escalation_tier"}


def provides_contact_details(candidate: Any) -> bool:
    """A candidate that can answer 'how do I reach you': a contact card, or a Company Info record
    that actually carries an email, phone, address or business hours."""
    if getattr(candidate, "candidate_role", None) == CandidateRole.CONTACT_CARD:
        return True
    if (getattr(candidate, "category", "") or "").lower() != "company_info":
        return False
    attrs = getattr(candidate, "attributes", None) or {}
    return any(attrs.get(k) for k in _CONTACT_ATTRS)


class CandidateNormalizer:
    """Normalizes heterogeneous retrieval candidates into uniform representations."""

    @classmethod
    def normalize_retrieved_item(
        cls,
        item: RetrievedEvidenceItem,
        raw_score: float = 0.0,
    ) -> VerifiedCandidate:
        """Convert a Phase 4 RetrievedEvidenceItem into a Phase 5 VerifiedCandidate."""
        role = cls.infer_candidate_role(
            category=item.category,
            title=item.title,
            description=item.description,
            attributes=item.attributes,
        )

        cand_id = f"cand_{item.entity_id}_{item.provenance.version_id or 'v1'}"

        return VerifiedCandidate(
            candidate_id=cand_id,
            entity_id=item.entity_id,
            requirement_ids=list(item.requirement_ids or []),
            near_match_for=getattr(item, "near_match_for", None),
            rank_tier=int(getattr(item, "rank_tier", 0) or 0),
            tenant_id=item.provenance.tenant_id or "",
            external_identity_key=item.external_identity_key,
            title=item.title,
            description=item.description,
            candidate_role=role,
            category=item.category,
            service_area=item.service_area,
            pricing=item.pricing,
            warranty=item.warranty,
            sla=item.sla,
            attributes=item.attributes or {},
            semantic_passages=list(item.semantic_passages or []),
            provenance=item.provenance,
            verification_status=item.verification_status,
            relevance_score=item.relevance_score or raw_score,
            composite_score=item.relevance_score or raw_score,
            retrieval_path=item.retrieval_path,
            satisfied_constraints=list(item.satisfied_constraints or []),
            unmet_constraints=list(item.unmet_constraints or []),
        )

    @classmethod
    def normalize_db_record(
        cls,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        semantic_passages: Optional[List[str]] = None,
        semantic_score: float = 0.0,
        path: str = "exact_structured",
    ) -> VerifiedCandidate:
        """Convert a raw PostgreSQL KnowledgeItem & KnowledgeVersion pair."""
        canonical = version.canonical_data or {}
        role = cls.infer_candidate_role(
            category=item.category,
            title=item.title,
            description=item.description,
            attributes=canonical,
        )

        pricing_dto = None
        if "pricing" in canonical and isinstance(canonical["pricing"], dict):
            p = canonical["pricing"]
            base = float(p.get("base_price") or p.get("total_price") or 0.0)
            visit = float(p.get("visit_diagnostic_charge") or 0.0)
            parts = float(p.get("estimated_parts_cost") or 0.0)
            disc = float(p.get("discount_percentage") or 0.0)
            tax = float(p.get("tax_percentage") or 0.0)
            total = float(p.get("total_price") or p.get("calculated_total") or base)

            pricing_dto = VerifiedPricingEvidence(
                currency=str(p.get("currency") or "INR"),
                base_price=base,
                visit_diagnostic_charge=visit,
                estimated_parts_cost=parts,
                discount_percentage=disc,
                tax_percentage=tax,
                calculated_total=total,
                commercial_price_type=str(p.get("pricing_type") or "fixed"),
                pricing_notes=p.get("notes"),
                qualifying_statement=f"Authoritative price breakdown from {item.title}.",
            )

        provenance = EvidenceProvenance(
            source_system="postgresql",
            source_id=version.source_id,
            source_type=item.source_type,
            version_id=version.id,
            authority_level=(version.authority_level or "imported_data").lower(),
            authority_score=0.9 if (version.authority_level or "").lower() == "approved_policy" else 0.85,
            effective_from=version.effective_from.isoformat() if version.effective_from else None,
            effective_until=version.effective_until.isoformat() if version.effective_until else None,
            temporal_status="current",
            tenant_id=item.tenant_id,
        )

        cand_id = f"cand_{item.id}_{version.id}"
        ext_key = item.external_identity_key or canonical.get("sku") or canonical.get("service_code")

        return VerifiedCandidate(
            candidate_id=cand_id,
            entity_id=item.id,
            tenant_id=item.tenant_id,
            external_identity_key=ext_key,
            title=item.title,
            description=item.description,
            candidate_role=role,
            category=item.category,
            service_area=canonical.get("service_area"),
            pricing=pricing_dto,
            warranty=canonical.get("warranty"),
            sla=canonical.get("sla"),
            attributes=canonical,
            semantic_passages=semantic_passages or [],
            provenance=provenance,
            verification_status=FactVerificationStatus.VERIFIED,
            relevance_score=semantic_score,
            composite_score=semantic_score + 100.0,
            retrieval_path=path,
            satisfied_constraints=[],
            unmet_constraints=[],
        )

    @classmethod
    def infer_candidate_role(
        cls,
        category: Optional[str],
        title: Optional[str] = None,
        description: Optional[str] = None,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> CandidateRole:
        """Infer the specialized enterprise role of a candidate."""
        cat_lower = (category or "").lower().strip()
        text_corpus = f"{title or ''} {description or ''} {str(attributes or '')}".lower()

        if cat_lower in ("policies", "terms_of_service", "warranty_policies"):
            return CandidateRole.POLICY_DOCUMENT

        if cat_lower in ("products_services", "products", "services", "catalog", "offers_promotions", "offers"):
            return CandidateRole.PRODUCT_SERVICE

        if cat_lower == "processes_timelines":
            return CandidateRole.PROCESS_TIMELINE

        if cat_lower == "operational_availability":
            return CandidateRole.OPERATIONAL_AVAILABILITY

        if cat_lower == "company_info":
            return CandidateRole.GENERAL_KNOWLEDGE

        # If it has explicit pricing or SKU in canonical attributes, it is a product/service
        if attributes and (attributes.get("pricing") or attributes.get("price") or attributes.get("base_price") or attributes.get("sku")):
            return CandidateRole.PRODUCT_SERVICE

        if (
            cat_lower in ("support_faqs", "troubleshooting", "technician_guides")
            or any(kw in text_corpus for kw in (
                "troubleshoot", "rattling noise", "cooling failure", "error code",
                "compressor", "leakage", "steps to resolve", "diagnostic", "technician guide"
            ))
        ):
            return CandidateRole.TROUBLESHOOTING_GUIDE

        if any(kw in text_corpus for kw in ("availability", "slot", "appointment window", "technician schedule")):
            return CandidateRole.OPERATIONAL_AVAILABILITY

        return CandidateRole.PRODUCT_SERVICE

    @classmethod
    def extract_atomic_facts(cls, candidate: VerifiedCandidate) -> List[VerifiedFact]:
        """Extract atomic, verified fact records from a candidate for audit lineage."""
        facts: List[VerifiedFact] = []

        # Pricing Fact
        if candidate.pricing:
            facts.append(
                VerifiedFact(
                    attribute_name="price",
                    entity_id=candidate.entity_id,
                    external_identity_key=candidate.external_identity_key,
                    typed_value=candidate.pricing.calculated_total,
                    currency_or_unit=candidate.pricing.currency,
                    source_system=candidate.provenance.source_system,
                    source_version_id=candidate.provenance.version_id,
                    authority_level=candidate.provenance.authority_level,
                    authority_score=candidate.provenance.authority_score,
                    verification_status=candidate.verification_status,
                    effective_from=candidate.provenance.effective_from,
                    effective_until=candidate.provenance.effective_until,
                )
            )

        # Warranty Fact
        if candidate.warranty:
            facts.append(
                VerifiedFact(
                    attribute_name="warranty",
                    entity_id=candidate.entity_id,
                    external_identity_key=candidate.external_identity_key,
                    typed_value=candidate.warranty,
                    source_system=candidate.provenance.source_system,
                    source_version_id=candidate.provenance.version_id,
                    authority_level=candidate.provenance.authority_level,
                    authority_score=candidate.provenance.authority_score,
                    verification_status=candidate.verification_status,
                )
            )

        # SLA Fact
        if candidate.sla:
            facts.append(
                VerifiedFact(
                    attribute_name="sla",
                    entity_id=candidate.entity_id,
                    external_identity_key=candidate.external_identity_key,
                    typed_value=candidate.sla,
                    source_system=candidate.provenance.source_system,
                    source_version_id=candidate.provenance.version_id,
                    authority_level=candidate.provenance.authority_level,
                    authority_score=candidate.provenance.authority_score,
                    verification_status=candidate.verification_status,
                )
            )

        # Requirement-fit notes from the retrieval eligibility layer (e.g. "listed size 1200 mm is
        # close to the requested 1219.2 mm; exact fit must be confirmed", or "16GB RAM not
        # stated; unverified"). They let the reply state caveats instead of claiming a fit.
        for note in (candidate.attributes or {}).get("match_notes") or []:
            if isinstance(note, str) and note.strip():
                facts.append(
                    VerifiedFact(
                        attribute_name="fit_note",
                        entity_id=candidate.entity_id,
                        external_identity_key=candidate.external_identity_key,
                        typed_value=note.strip(),
                        source_system=candidate.provenance.source_system,
                        source_version_id=candidate.provenance.version_id,
                        authority_level=candidate.provenance.authority_level,
                        authority_score=candidate.provenance.authority_score,
                        verification_status=candidate.verification_status,
                    )
                )

        # Contact Details (Company Info is the home of the company's contact details)
        if provides_contact_details(candidate):
            attrs = candidate.attributes or {}
            for field, fact_name in _CONTACT_FACT_FIELDS:
                if field in attrs and attrs[field]:
                    facts.append(
                        VerifiedFact(
                            attribute_name=fact_name,
                            entity_id=candidate.entity_id,
                            external_identity_key=candidate.external_identity_key,
                            typed_value=attrs[field],
                            source_system=candidate.provenance.source_system,
                            source_version_id=candidate.provenance.version_id,
                            authority_level=candidate.provenance.authority_level,
                            authority_score=candidate.provenance.authority_score,
                            verification_status=candidate.verification_status,
                        )
                    )

        # Troubleshooting Advice
        if candidate.candidate_role == CandidateRole.TROUBLESHOOTING_GUIDE:
            facts.append(
                VerifiedFact(
                    attribute_name="troubleshooting_guidance",
                    entity_id=candidate.entity_id,
                    external_identity_key=candidate.external_identity_key,
                    typed_value=candidate.semantic_passages[0] if candidate.semantic_passages else candidate.title,
                    source_system=candidate.provenance.source_system,
                    source_version_id=candidate.provenance.version_id,
                    authority_level=candidate.provenance.authority_level,
                    authority_score=candidate.provenance.authority_score,
                    verification_status=candidate.verification_status,
                )
            )

        # Policy Document
        if candidate.candidate_role == CandidateRole.POLICY_DOCUMENT:
            facts.append(
                VerifiedFact(
                    attribute_name="policy_statement",
                    entity_id=candidate.entity_id,
                    external_identity_key=candidate.external_identity_key,
                    typed_value=candidate.semantic_passages[0] if candidate.semantic_passages else candidate.title,
                    source_system=candidate.provenance.source_system,
                    source_version_id=candidate.provenance.version_id,
                    authority_level=candidate.provenance.authority_level,
                    authority_score=candidate.provenance.authority_score,
                    verification_status=candidate.verification_status,
                )
            )

        return facts
