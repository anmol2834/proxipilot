"""Standardized Backend Error Contracts.

Rules:
- Stable machine-readable error codes.
- No internal stack traces leaked to clients.
- Always include request_id for distributed tracing.
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """Universal API error response contract."""

    code: str = Field(description="Stable machine-readable error code (e.g. TENANT_NOT_FOUND)")
    message: str = Field(description="Human-readable error explanation")
    request_id: str = Field(description="Unique request tracing ID")
    details: Dict[str, Any] = Field(default_factory=dict, description="Contextual validation details")
