"""Communication Style Memory (Memory 2).

One row per (tenant, scope, scope_key):
  scope = 'company'  scope_key = '*'            — how the business writes overall
  scope = 'sender'   scope_key = mailbox email  — how one employee / mailbox writes

``stats``           deterministic profile learned from human-written sent emails
                    (greeting, sign-off, language, formality, length, phrases,
                    situation mix). Recomputed on rebuild.
``learned_guide``   short LLM-synthesised guide: tone and situational practices.
``overrides``       employee-set values (greeting, sign_off, language,
                    formality, max_words). Always win; never touched by a rebuild.
``employee_guide``  free-text rules written by authorised employees. Never touched by a rebuild.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
import uuid

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantAwareMixin


class StyleScope(str, Enum):
    COMPANY = "company"
    SENDER = "sender"


class StyleProfileStatus(str, Enum):
    ACTIVE = "active"
    INSUFFICIENT_DATA = "insufficient_data"
    DISABLED = "disabled"


class StyleProfile(Base, TenantAwareMixin):
    __tablename__ = "style_profiles"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"sp_{uuid.uuid4().hex}")
    scope: Mapped[str] = mapped_column(String(16), nullable=False)
    scope_key: Mapped[str] = mapped_column(String(320), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default=StyleProfileStatus.INSUFFICIENT_DATA.value)
    stats: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="JSON learned profile")
    learned_guide: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="JSON LLM guide")
    overrides: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="JSON employee overrides")
    employee_guide: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sample_fingerprint: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    source_watermark: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    computed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "scope", "scope_key", name="uq_style_profiles_scope"),
    )
