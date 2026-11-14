"""Requirement & Intent Planner Package.

Phase 3: Schema-Aware, High-Accuracy, High-Throughput Requirement Planning Architecture.
"""

from app.contracts.requirement_plan import (
    EntityResolutionStatus,
    IntentType,
    MissingDetail,
    PlannedComparison,
    PlannedEntity,
    PlannedFilter,
    PlannedRange,
    PlannedResultCount,
    PlannerProposalDTO,
    RequirementPlan,
    RetrievalStrategy,
    ValidationStatus,
)
from app.contracts.retrieval_capability import (
    AuthoritativeSource,
    CategoryCapability,
    FieldCapability,
    FilterOperator,
    RetrievalCapabilityCatalogue,
    build_retrieval_capability_catalogue,
)
from app.services.requirement_planner.planner import (
    OpenAIStructuredPlanner,
    openai_structured_planner,
)
from app.services.requirement_planner.preprocessor import (
    DeterministicPreprocessor,
    PreprocessedEmail,
    deterministic_preprocessor,
)
from app.services.requirement_planner.service import (
    RequirementPlannerService,
    requirement_planner_service,
)
from app.services.requirement_planner.validator import (
    DeterministicPlanValidator,
    deterministic_plan_validator,
)

__all__ = [
    "AuthoritativeSource",
    "CategoryCapability",
    "DeterministicPlanValidator",
    "DeterministicPreprocessor",
    "EntityResolutionStatus",
    "FieldCapability",
    "FilterOperator",
    "IntentType",
    "MissingDetail",
    "OpenAIStructuredPlanner",
    "PlannedComparison",
    "PlannedEntity",
    "PlannedFilter",
    "PlannedRange",
    "PlannedResultCount",
    "PlannerProposalDTO",
    "PreprocessedEmail",
    "RequirementPlan",
    "RequirementPlannerService",
    "RetrievalCapabilityCatalogue",
    "RetrievalStrategy",
    "ValidationStatus",
    "build_retrieval_capability_catalogue",
    "deterministic_plan_validator",
    "deterministic_preprocessor",
    "openai_structured_planner",
    "requirement_planner_service",
]
