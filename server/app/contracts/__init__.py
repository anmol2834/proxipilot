"""Contracts Package — Typed API Request/Response Schemas.

All Pydantic V2 request/response contracts for the ProxiPilot API.

Modules:
- errors.py: Universal error response schema
- events.py: Canonical domain event envelope and registry
- pagination.py: Cursor-based pagination request/response generics
- ai.py: AI pipeline typed payload contracts
- rag.py: Qdrant vector payload and retrieval contracts
- knowledge.py: Knowledge taxonomy, canonical schemas, and category registry
- data_quality.py: Phase 8.4 row quality, normalization, and deduplication contracts
- persistence.py: Phase 8.5 bulk canonical persistence outcome contracts
"""

from app.contracts.knowledge import (
    CanonicalFieldDefinition,
    CategoryDefinition,
    KnowledgeCategoryError,
    KnowledgeCategoryRegistry,
    KnowledgeInvalidCategoryError,
    KnowledgeValidationError,
    ValidationResult,
    category_registry,
    normalize_category_key,
)

__all__ = [
    "CanonicalFieldDefinition",
    "CategoryDefinition",
    "KnowledgeCategoryError",
    "KnowledgeCategoryRegistry",
    "KnowledgeInvalidCategoryError",
    "KnowledgeValidationError",
    "ValidationResult",
    "category_registry",
    "normalize_category_key",
    "QualityRowStatus",
    "RowQualitySeverity",
    "RowQualityErrorCode",
    "RowQualityIssueDTO",
    "NormalizedRecordDTO",
    "BatchQualityResultDTO",
    "DatasetQualitySummaryDTO",
    "PersistenceOutcome",
    "RecordPersistenceResultDTO",
    "BatchPersistenceResultDTO",
    "ImportPersistenceSummaryDTO",
    "PersistenceBatchConfig",
    "SemanticChunkDTO",
    "SemanticMetadataDTO",
    "SemanticDocumentDTO",
    "ProjectionBatchSummaryDTO",
]

from app.contracts.data_quality import (
    BatchQualityResultDTO,
    DatasetQualitySummaryDTO,
    NormalizedRecordDTO,
    QualityRowStatus,
    RowQualityErrorCode,
    RowQualityIssueDTO,
    RowQualitySeverity,
)

from app.contracts.persistence import (
    BatchPersistenceResultDTO,
    ImportPersistenceSummaryDTO,
    PersistenceBatchConfig,
    PersistenceOutcome,
    RecordPersistenceResultDTO,
)

from app.contracts.semantic_projection import (
    ProjectionBatchSummaryDTO,
    SemanticChunkDTO,
    SemanticDocumentDTO,
    SemanticMetadataDTO,
)

from app.contracts.retrieval_result import (
    CoverageAssessment,
    EvidenceProvenance,
    FactVerificationStatus,
    FollowUpActions,
    PlanReferenceDTO,
    RetrievalResult,
    RetrievalStatus,
    RetrievalStrategyUsed,
    RetrievedEvidenceItem,
    SourceExecutionMetadata,
    VerificationAssessment,
    VerifiedPricingEvidence,
)

from app.contracts.evidence_fusion import (
    ActionWorkflowContext,
    CandidateRole,
    ConflictRecord,
    EvidenceOverallStatus,
    RequirementCoverageStatus,
    RequirementEvidenceGroup,
    RequirementType,
    VerifiedCandidate,
    VerifiedEvidenceResult,
    VerifiedFact,
)

from app.contracts.evidence_package import (
    ContextualReference,
    EvidenceExcerpt,
    EvidenceFactType,
    FactTemporalStatus,
    MinimalEvidencePackage,
    MissingInformationSignal,
    MissingSignalType,
    PackageActionContext,
    PackageBudgetMetrics,
    PackageStatus,
    PackagedFact,
    RequirementActionGuidance,
    RequirementEvidencePackage,
)

from app.contracts.reply_planner import (
    ClaimEvidenceMapping,
    GroundingType,
    ReplyDisposition,
    ReplyPlan,
    ReplyValidationReport,
    RequirementCoverageEvaluation,
    RequirementDisposition,
    StructuredReplyDraft,
    ValidationIssue,
    ValidationIssueSeverity,
)
