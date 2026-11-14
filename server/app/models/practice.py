"""Organizational Experience Memory (Memory 5).

``org_practices`` — how the business actually operates: workflows, negotiation limits,
approval rules, complaint handling, exceptions and operational practices.

  origin  = employee  written by an authorised employee (active immediately)
          = learned   proposed by the system from real history (status 'suggested');
                      it becomes active only after an employee approves it.
  status  = active | suggested | disabled | archived

A matching active practice is given to the drafter; if it ``requires_approval`` or
``escalate_to_human`` the reply is routed to human review instead of auto-send.
"""

from typing import Optional
from enum import Enum
import uuid

from sqlalchemy import Boolean, Float, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantAwareMixin


class PracticeStatus(str, Enum):
    ACTIVE = "active"
    SUGGESTED = "suggested"
    DISABLED = "disabled"
    ARCHIVED = "archived"


class PracticeSituation(str, Enum):
    GENERAL = "general"
    COMPLAINT = "complaint"
    RETURN_REFUND = "return_refund"
    NEGOTIATION = "negotiation"
    QUOTATION = "quotation"
    ORDER = "order"
    PAYMENT = "payment"
    DELIVERY = "delivery"
    SUPPORT = "support"
    APPROVAL = "approval"


class OrgPractice(Base, TenantAwareMixin):
    __tablename__ = "org_practices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"op_{uuid.uuid4().hex}")
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    situation: Mapped[str] = mapped_column(String(32), nullable=False, default=PracticeSituation.GENERAL.value)
    trigger_keywords: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="JSON list")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    rules: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="JSON list of rule strings")
    exceptions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requires_approval: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    approver: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    escalate_to_human: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=PracticeStatus.ACTIVE.value)
    origin: Mapped[str] = mapped_column(String(16), nullable=False, default="employee")
    derived_key: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="JSON evidence summary")
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    updated_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "derived_key", name="uq_org_practices_derived_key"),
        Index("ix_org_practices_tenant_status", "tenant_id", "status"),
    )
