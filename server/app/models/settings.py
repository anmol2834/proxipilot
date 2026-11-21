"""Per-user and per-workspace settings: one row per (owner, setting key).

The definitions (keys, types, defaults) live in ``app.contracts.settings_registry``. These tables
only hold values. ``is_customized`` separates a value somebody chose from a provisioned default, so
a later change of a default can follow through to everyone who never changed it.

Provisioning is transactional and path-independent: a ``before_flush`` listener adds the default
rows for every new ``User`` / ``Organization`` in the same flush that inserts it. Every signup path
(password, Google, Microsoft, invites, tests, future paths) is covered without calling anything,
and a failed signup rolls its settings back with it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, event, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import Organization, User


class UserSetting(Base, TimestampMixin):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[Any] = mapped_column(JSONB, nullable=False)
    is_customized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    updated_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Only used so the unit of work inserts the user before its settings (ids may be assigned at flush).
    user: Mapped["User"] = relationship("User", lazy="raise")


class WorkspaceSetting(Base, TimestampMixin):
    __tablename__ = "workspace_settings"

    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"),
                                           primary_key=True)
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[Any] = mapped_column(JSONB, nullable=False)
    is_customized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    updated_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    organization: Mapped["Organization"] = relationship("Organization", lazy="raise")


@event.listens_for(Session, "before_flush")
def _provision_default_settings(session: Session, flush_context, instances) -> None:
    """Give every new user / workspace its default settings in the same transaction."""
    from app.contracts.settings_registry import SettingScope, defaults
    from app.models.organization import Organization, User

    new = list(session.new)
    users = [o for o in new if isinstance(o, User)]
    orgs = [o for o in new if isinstance(o, Organization)]
    if not users and not orgs:
        return
    if users:
        user_defaults = defaults(SettingScope.USER)
        for u in users:
            session.add_all([UserSetting(user=u, key=k, value=v) for k, v in user_defaults.items()])
    if orgs:
        ws_defaults = defaults(SettingScope.WORKSPACE)
        for o in orgs:
            session.add_all([WorkspaceSetting(organization=o, key=k, value=v) for k, v in ws_defaults.items()])
