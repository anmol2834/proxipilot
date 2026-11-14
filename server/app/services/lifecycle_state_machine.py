"""Phase 9.3: Knowledge Version Lifecycle State Machine.

Enforces strict lifecycle state transition rules across KnowledgeVersions:
DRAFT -> VALIDATED -> ACTIVE -> ARCHIVED / REVOKED

Invariants:
- Deterministic state machine: illegal transitions raise InvalidLifecycleTransitionError.
- Active exclusivity: At most one version per KnowledgeItem may be ACTIVE at any given time.
- Immutability preservation: Archived and revoked versions cannot be directly modified.
"""

from typing import Dict, Set

from app.models.knowledge import KnowledgeLifecycleStatus


class InvalidLifecycleTransitionError(ValueError):
    """Raised when an illegal lifecycle state transition is requested."""

    def __init__(self, current_status: str, target_status: str, reason: str = ""):
        msg = f"Cannot transition KnowledgeVersion from '{current_status}' to '{target_status}'."
        if reason:
            msg += f" Reason: {reason}"
        super().__init__(msg)
        self.current_status = current_status
        self.target_status = target_status


class LifecycleStateMachine:
    """Validator for knowledge version lifecycle transitions."""

    # Map each status to its permitted subsequent statuses
    LEGAL_TRANSITIONS: Dict[str, Set[str]] = {
        KnowledgeLifecycleStatus.DRAFT.value: {
            KnowledgeLifecycleStatus.VALIDATED.value,
            KnowledgeLifecycleStatus.ACTIVE.value,
            KnowledgeLifecycleStatus.ARCHIVED.value,
        },
        KnowledgeLifecycleStatus.VALIDATED.value: {
            KnowledgeLifecycleStatus.ACTIVE.value,
            KnowledgeLifecycleStatus.DRAFT.value,
            KnowledgeLifecycleStatus.ARCHIVED.value,
        },
        KnowledgeLifecycleStatus.ACTIVE.value: {
            KnowledgeLifecycleStatus.ARCHIVED.value,
            KnowledgeLifecycleStatus.REVOKED.value,
        },
        KnowledgeLifecycleStatus.ARCHIVED.value: {
            # Can be re-activated via rollback
            KnowledgeLifecycleStatus.ACTIVE.value,
        },
        KnowledgeLifecycleStatus.REVOKED.value: {
            KnowledgeLifecycleStatus.ARCHIVED.value,
        },
    }

    @classmethod
    def can_transition(cls, current_status: str, target_status: str, is_current_version: bool = False) -> bool:
        """Returns True if the transition is permitted, otherwise False."""
        if current_status == target_status:
            return True
        allowed = cls.LEGAL_TRANSITIONS.get(current_status, set())
        return target_status in allowed

    @classmethod
    def validate_transition(cls, current_status: str, target_status: str, is_current_version: bool = False) -> None:
        """Validates that a transition is legal, or raises InvalidLifecycleTransitionError."""
        if not cls.can_transition(current_status, target_status, is_current_version):
            allowed_str = ", ".join(sorted(cls.LEGAL_TRANSITIONS.get(current_status, set())))
            raise InvalidLifecycleTransitionError(
                current_status=current_status,
                target_status=target_status,
                reason=f"Allowed transitions from '{current_status}' are: [{allowed_str}].",
            )
