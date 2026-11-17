"""AI Reply Copilot: an isolated, conversation-scoped drafting workspace (never sends email)."""

from app.services.reply_copilot.contracts import CopilotOperation, CopilotRequest, CopilotResult
from app.services.reply_copilot.service import ReplyCopilotService, ThreadNotFound, reply_copilot_service

__all__ = ["CopilotOperation", "CopilotRequest", "CopilotResult", "ReplyCopilotService", "ThreadNotFound",
           "reply_copilot_service"]
