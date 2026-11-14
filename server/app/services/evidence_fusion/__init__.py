"""Evidence Fusion & Verification Service Package — Phase 5.

Exports the primary service interface, normalizer, grouper, matcher,
context evaluator, and fact verifier.
"""

from app.services.evidence_fusion.context_evaluator import ContextualReplyEvaluator
from app.services.evidence_fusion.grouper import RequirementGroupDefinition, RequirementGrouper
from app.services.evidence_fusion.matcher import TargetEntityMatcher
from app.services.evidence_fusion.normalizer import CandidateNormalizer
from app.services.evidence_fusion.service import EvidenceFusionService, evidence_fusion_service
from app.services.evidence_fusion.verifier import EvidenceFactVerifier

__all__ = [
    "EvidenceFusionService",
    "evidence_fusion_service",
    "CandidateNormalizer",
    "RequirementGrouper",
    "RequirementGroupDefinition",
    "TargetEntityMatcher",
    "ContextualReplyEvaluator",
    "EvidenceFactVerifier",
]
