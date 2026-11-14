"""Reply Policy Gate & Disposition Engine — Phase 7.

Determines the final operational disposition of an email draft according to:
1. Validation outcome (zero critical violations permitted).
2. Package action context and escalation signals.
3. Conversational closure detection.
4. Tenant-specific auto-send policies.
"""

from __future__ import annotations

from typing import Optional, Tuple

from app.contracts.evidence_package import MinimalEvidencePackage, PackageStatus
from app.contracts.reply_planner import (
    ReplyDisposition,
    ReplyValidationReport,
    StructuredReplyDraft,
    ValidationIssueSeverity,
)
from app.core.logging import logger


class ReplyPolicyGate:
    """Evaluates validated drafts and package context to determine final sending disposition."""

    def evaluate_disposition(
        self,
        draft: Optional[StructuredReplyDraft],
        validation_report: ReplyValidationReport,
        package: MinimalEvidencePackage,
        allow_auto_send: bool = True,
    ) -> Tuple[ReplyDisposition, Optional[str], Optional[str]]:
        """Determine final ReplyDisposition along with human review / clarification reason.

        Returns:
            Tuple of (ReplyDisposition, human_review_reason, clarification_reason)
        """
        # 1. Critical Validation Failures -> REJECTED or HUMAN_REVIEW
        has_critical = any(
            issue.severity == ValidationIssueSeverity.CRITICAL for issue in validation_report.issues
        )
        if has_critical:
            critical_msgs = "; ".join(
                f"{i.issue_code}: {i.description}"
                for i in validation_report.issues
                if i.severity == ValidationIssueSeverity.CRITICAL
            )
            logger.warning(
                "Draft rejected by policy gate due to critical validation issues",
                tenant_id=package.tenant_id,
                package_id=package.package_id,
                issues=critical_msgs,
            )
            return (
                ReplyDisposition.HUMAN_REVIEW,
                f"Factual/Safety validation failed: {critical_msgs}",
                None,
            )

        # 2. Mandatory Human Review / Escalation Required
        if package.action_context.requires_human_escalation:
            reason = (
                package.action_context.escalation_reason
                or "Unsupported knowledge category or operational workflow requires human triage."
            )
            return ReplyDisposition.HUMAN_REVIEW, reason, None

        if package.package_status == PackageStatus.PARTIAL_EVIDENCE and package.action_context.unsupported_categories:
            cats = ", ".join(package.action_context.unsupported_categories)
            reason = f"Partial response generated; unconfigured categories ({cats}) routed for human review."
            return ReplyDisposition.HUMAN_REVIEW, reason, None

        # 3. Conversational Closure Detected (when no active missing parameters) -> NO_REPLY_REQUIRED
        if draft and draft.closure_detected:
            return (
                ReplyDisposition.NO_REPLY_REQUIRED,
                None,
                None,
            )

        if package.package_status == PackageStatus.NO_RETRIEVAL_REQUIRED and not (draft and draft.body_text):
            return (
                ReplyDisposition.NO_REPLY_REQUIRED,
                None,
                None,
            )

        # 4. Clarification / Missing Action Parameters
        has_missing_params = bool(
            package.contextual_reference and package.contextual_reference.missing_parameters
        )
        if (
            package.package_status == PackageStatus.NEEDS_CLARIFICATION
            or (draft and draft.clarification_question)
            or (package.contextual_reference and package.contextual_reference.is_ambiguous)
            or has_missing_params
        ):
            reason = (
                (draft.clarification_question if draft else None)
                or package.action_context.clarification_prompt
                or "Customer inquiry contains material ambiguity or missing parameters requiring clarification."
            )
            return ReplyDisposition.CLARIFY, None, reason

        # 5. Partial Evidence Handling
        if package.package_status == PackageStatus.PARTIAL_EVIDENCE:
            return ReplyDisposition.PARTIAL_RESPONSE, None, None

        # 6. Complete, Validated Sendable Draft
        if validation_report.is_sendable and allow_auto_send:
            return ReplyDisposition.SEND, None, None

        # Default fallback to human review for review queues
        return (
            ReplyDisposition.HUMAN_REVIEW,
            "Auto-send not permitted by current tenant policy; draft queued for human approval.",
            None,
        )


# Global singleton
reply_policy_gate = ReplyPolicyGate()
