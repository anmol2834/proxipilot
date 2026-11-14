"""Structured Logging System for ProxiPilot.

Adheres to:
- Context-bound logging (request_id, tenant_id, trace_id)
- Automatic redaction of sensitive credentials (tokens, passwords, API keys)
- JSON output for production log ingestion (Datadog/CloudWatch/ELK)
- Human-readable colored output in local development
"""

import logging
import sys
from typing import Any, MutableMapping
import structlog

SENSITIVE_KEYS = {
    "password",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "api_key",
    "jwt_secret_key",
    "client_secret",
}


def censor_sensitive_data(
    logger: Any, method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """Redact sensitive fields from logging payloads."""
    for key, value in list(event_dict.items()):
        if any(s in key.lower() for s in SENSITIVE_KEYS):
            event_dict[key] = "[REDACTED]"
        elif isinstance(value, dict):
            for sub_key in list(value.keys()):
                if any(s in sub_key.lower() for s in SENSITIVE_KEYS):
                    value[sub_key] = "[REDACTED]"
    return event_dict


def setup_logging(json_format: bool = True, log_level: str = "INFO") -> None:
    """Configure structlog and standard logging."""
    level = getattr(logging, log_level.upper(), logging.INFO)
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=level)

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        censor_sensitive_data,
    ]

    if json_format:
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=shared_processors + [structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    for handler in logging.root.handlers:
        handler.setFormatter(formatter)

    # Suppress verbose noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


logger = structlog.get_logger("proxipilot")

