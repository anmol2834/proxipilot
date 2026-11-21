"""Settings registry — the single source of truth for every user and workspace setting.

How it works
------------
* Every setting is declared once here: key, scope, type, allowed values and default.
* A new user gets one ``user_settings`` row per USER setting, and a new workspace gets one
  ``workspace_settings`` row per WORKSPACE setting, in the same transaction that creates them
  (see ``app.models.settings``). Nothing else has to remember to do it.
* Adding a setting = adding one ``SettingDefinition`` below. New users/workspaces get it at
  creation; existing ones get it from the idempotent reconcile that runs at API start-up
  (``app.services.settings_store.reconcile_defaults``). No migration is needed per setting.
* Changing a default updates every row that still holds the default (``is_customized = false``);
  a value someone chose is never overwritten.
* Never delete a definition that has shipped: set ``deprecated=True`` instead. Deprecated keys are
  not provisioned for new owners, are hidden from the API and are never written; old rows stay.
* Keys are permanent identifiers (``area.name``, lower snake case). Renaming one is a new setting.

What is deliberately NOT here (single ownership — each fact has exactly one home):
* Follow-ups & AI tab → ``followup_policies`` (its own table, API and validation).
* Default response tone / language / time zone → ``workspace_preferences``.
* Company facts → Company Info (``company_info_profiles``).
* Two-factor authentication → authentication state (enrollment), not a preference.
* Billing records (legal name, tax id, PO number, payment methods, invoices) → records, not settings.
* Deletion-dialog options → parameters of an action, not stored preferences.

This module only stores and validates settings. The behaviour behind each setting is implemented
separately, setting by setting, when it is wired in.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Iterable, List, Optional, Tuple


class SettingScope(str, Enum):
    USER = "user"            # one value per person, follows them across workspaces
    WORKSPACE = "workspace"  # one value per organization


class SettingKind(str, Enum):
    BOOL = "bool"
    INT = "int"
    ENUM = "enum"            # one of ``choices`` (str or int values)
    STRING = "string"


class SettingValidationError(ValueError):
    """A value does not satisfy its definition (message is safe to show to the user)."""


@dataclass(frozen=True)
class SettingDefinition:
    key: str
    scope: SettingScope
    kind: SettingKind
    default: Any
    label: str
    description: str = ""
    tab: str = ""                                   # Settings page tab the control lives on
    choices: Tuple[Any, ...] = ()                   # ENUM only
    minimum: Optional[int] = None                   # INT only
    maximum: Optional[int] = None                   # INT only
    max_length: int = 500                           # STRING only
    edit_permission: Optional[str] = None           # WORKSPACE: RBAC key needed to change it
    introduced: str = "2026-11-21"                  # when it was added (audit trail)
    deprecated: bool = False
    tags: Tuple[str, ...] = field(default_factory=tuple)

    # ---- validation -------------------------------------------------------------------------
    def validate(self, value: Any) -> Any:
        """Return the normalized value or raise SettingValidationError."""
        if self.kind is SettingKind.BOOL:
            if isinstance(value, bool):
                return value
            raise SettingValidationError(f"{self.label} must be on or off.")
        if self.kind is SettingKind.INT:
            if isinstance(value, bool) or not isinstance(value, int):
                raise SettingValidationError(f"{self.label} must be a whole number.")
            if self.minimum is not None and value < self.minimum:
                raise SettingValidationError(f"{self.label} must be at least {self.minimum}.")
            if self.maximum is not None and value > self.maximum:
                raise SettingValidationError(f"{self.label} must be at most {self.maximum}.")
            return value
        if self.kind is SettingKind.ENUM:
            # bool is an int subclass: never let True/False match 1/0 choices.
            if isinstance(value, bool) or value not in self.choices:
                allowed = ", ".join(str(c) for c in self.choices)
                raise SettingValidationError(f"{self.label} must be one of: {allowed}.")
            return value
        if self.kind is SettingKind.STRING:
            if not isinstance(value, str):
                raise SettingValidationError(f"{self.label} must be text.")
            cleaned = "".join(ch for ch in value if ch == "\n" or ch >= " ").strip()
            if len(cleaned) > self.max_length:
                raise SettingValidationError(f"{self.label} must be at most {self.max_length} characters.")
            return cleaned
        raise SettingValidationError(f"{self.label} has an unsupported type.")  # pragma: no cover

    def is_valid(self, value: Any) -> bool:
        try:
            self.validate(value)
            return True
        except SettingValidationError:
            return False

    def describe(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {"key": self.key, "scope": self.scope.value, "type": self.kind.value,
                               "default": self.default, "label": self.label, "description": self.description,
                               "tab": self.tab}
        if self.choices:
            out["choices"] = list(self.choices)
        if self.minimum is not None:
            out["minimum"] = self.minimum
        if self.maximum is not None:
            out["maximum"] = self.maximum
        if self.edit_permission:
            out["edit_permission"] = self.edit_permission
        return out


_U, _W = SettingScope.USER, SettingScope.WORKSPACE
_ADMIN = "organization.update"

# ---------------------------------------------------------------------------------------------
# Definitions. Defaults that would make the product act on its own (send customer email, delete
# data) are OFF until their behaviour is implemented and an admin turns them on.
# ---------------------------------------------------------------------------------------------
SETTINGS: Tuple[SettingDefinition, ...] = (
    # ---- General → delivery channels (per person) ----
    SettingDefinition("notifications.mobile_push", _U, SettingKind.BOOL, True, "Mobile push notifications",
                      "Push notifications when the workspace needs attention.", tab="general"),
    SettingDefinition("notifications.desktop", _U, SettingKind.BOOL, True, "Desktop notifications",
                      "Desktop notifications when the workspace needs attention.", tab="general"),
    SettingDefinition("notifications.email", _U, SettingKind.BOOL, False, "Email notifications",
                      "Email digest and priority-thread notices.", tab="general"),
    # ---- General → automation (workspace) ----
    SettingDefinition("automation.auto_send_enabled", _W, SettingKind.BOOL, False, "Automatic email dispatch",
                      "Send approved AI replies and scheduled emails without a manual click.",
                      tab="general", edit_permission=_ADMIN, tags=("customer_facing",)),
    # ---- Preferences → AI drafting (workspace) ----
    SettingDefinition("ai.draft_confidence_threshold", _W, SettingKind.ENUM, 85, "Draft confidence threshold",
                      "Minimum confidence (%) before the copilot prepares a draft automatically.",
                      tab="preferences", choices=(70, 85, 90), edit_permission=_ADMIN),
    # ---- Preferences → inbox (per person) ----
    SettingDefinition("inbox.density", _U, SettingKind.ENUM, "comfortable", "Conversation list density",
                      tab="preferences", choices=("comfortable", "compact")),
    SettingDefinition("inbox.auto_advance", _U, SettingKind.ENUM, "next_thread", "Auto-advance after send or archive",
                      tab="preferences", choices=("next_thread", "previous_thread", "return_to_list")),
    SettingDefinition("inbox.keyboard_shortcuts", _U, SettingKind.BOOL, True, "Keyboard shortcuts",
                      "E to archive, R to reply, J/K to move between threads.", tab="preferences"),
    # ---- Billing → usage safeguards (workspace) ----
    SettingDefinition("billing.credit_cutoff_enabled", _W, SettingKind.BOOL, True, "Monthly credit usage ceiling",
                      "Pause AI operations once the monthly credit ceiling is reached.",
                      tab="billing", edit_permission=_ADMIN),
    SettingDefinition("billing.credit_usage_ceiling", _W, SettingKind.ENUM, 2500, "Monthly credit ceiling",
                      tab="billing", choices=(2500, 5000, 10000, 25000, 50000), edit_permission=_ADMIN),
    SettingDefinition("billing.credit_cutoff_action", _W, SettingKind.ENUM, "pause_all", "Action at the ceiling",
                      tab="billing", choices=("pause_all", "pause_outbound", "alert_admin"), edit_permission=_ADMIN),
    SettingDefinition("billing.budget_alert_enabled", _W, SettingKind.BOOL, True, "Monthly budget alert",
                      "Email admins when 85% of the monthly credit allowance is used.",
                      tab="billing", edit_permission=_ADMIN),
    SettingDefinition("billing.spend_cap_enabled", _W, SettingKind.BOOL, True, "Monthly spend cap",
                      "Stop billable auto top-ups once the monthly total exceeds the cap.",
                      tab="billing", edit_permission=_ADMIN),
    SettingDefinition("billing.spend_cap_amount", _W, SettingKind.INT, 150, "Monthly spend cap amount",
                      "In the billing display currency.", tab="billing", minimum=20, maximum=1_000_000,
                      edit_permission=_ADMIN),
    SettingDefinition("billing.display_currency", _W, SettingKind.ENUM, "USD", "Billing display currency",
                      tab="billing", choices=("USD", "EUR", "GBP", "INR"), edit_permission=_ADMIN),
    # ---- Security ----
    SettingDefinition("security.session_timeout_minutes", _W, SettingKind.ENUM, 1440, "Idle session timeout",
                      "Sign out sessions after this many idle minutes.", tab="security",
                      choices=(15, 30, 60, 240, 720, 1440), edit_permission=_ADMIN),
    SettingDefinition("security.signin_alerts", _U, SettingKind.BOOL, True, "New sign-in alerts",
                      "Email me when my account signs in from a new device or location.", tab="security"),
    # ---- Data & Privacy (workspace) ----
    SettingDefinition("privacy.customer_email_retention", _W, SettingKind.ENUM, "indefinite",
                      "Customer email retention", tab="data-privacy",
                      choices=("30d", "60d", "90d", "180d", "1y", "2y", "indefinite"), edit_permission=_ADMIN,
                      tags=("destructive",)),
    SettingDefinition("privacy.ai_draft_retention_days", _W, SettingKind.ENUM, 30, "AI draft & reasoning log retention",
                      tab="data-privacy", choices=(7, 14, 30, 90), edit_permission=_ADMIN, tags=("destructive",)),
    SettingDefinition("privacy.auto_purge_trash_enabled", _W, SettingKind.BOOL, False, "Auto-purge trash after 30 days",
                      tab="data-privacy", edit_permission=_ADMIN, tags=("destructive",)),
    SettingDefinition("privacy.auto_delete_inactive_enabled", _W, SettingKind.BOOL, False,
                      "Auto-delete inactive conversations", tab="data-privacy", edit_permission=_ADMIN,
                      tags=("destructive",)),
    SettingDefinition("privacy.auto_delete_inactive_days", _W, SettingKind.ENUM, 90, "Inactive after (days)",
                      tab="data-privacy", choices=(30, 60, 90, 180, 365), edit_permission=_ADMIN),
)


# ---------------------------------------------------------------------------------------------
# Lookups (built once at import; the registry is immutable at runtime)
# ---------------------------------------------------------------------------------------------
def _check_registry(defs: Iterable[SettingDefinition]) -> Dict[str, SettingDefinition]:
    import re

    by_key: Dict[str, SettingDefinition] = {}
    for d in defs:
        if not re.fullmatch(r"[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+", d.key) or len(d.key) > 128:
            raise ValueError(f"settings registry: bad key {d.key!r}")
        if d.key in by_key:
            raise ValueError(f"settings registry: duplicate key {d.key!r}")
        if not d.is_valid(d.default):
            raise ValueError(f"settings registry: default of {d.key!r} is invalid")
        if d.scope is SettingScope.USER and d.edit_permission:
            raise ValueError(f"settings registry: user setting {d.key!r} cannot need a workspace permission")
        by_key[d.key] = d
    return by_key


BY_KEY: Dict[str, SettingDefinition] = _check_registry(SETTINGS)


def definitions(scope: SettingScope, include_deprecated: bool = False) -> List[SettingDefinition]:
    return [d for d in SETTINGS if d.scope is scope and (include_deprecated or not d.deprecated)]


def defaults(scope: SettingScope) -> Dict[str, Any]:
    """{key: default} for the active settings of a scope (what a new owner is provisioned with)."""
    return {d.key: d.default for d in definitions(scope)}


def fingerprint(scope: SettingScope) -> str:
    """Stable hash of a scope's active keys and defaults (changes whenever provisioning would)."""
    raw = json.dumps(defaults(scope), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
