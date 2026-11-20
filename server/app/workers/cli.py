"""Unified CLI Runner for ProxiPilot Background Workers.

Usage:
    python -m app.workers.cli --worker ai
    python -m app.workers.cli --worker email
    python -m app.workers.cli --worker automation
"""

import argparse
import asyncio
import sys
from app.core.logging import logger, setup_logging
from app.workers.ai_worker import AiWorker
from app.workers.automation_worker import AutomationWorker
from app.workers.email_worker import EmailWorker
from app.workers.followup_worker import FollowupWorker, OutboxRelayRunner, SchedulerRunner
from app.workers.import_worker import KnowledgeImportWorker
from app.workers.knowledge_embedding_worker import KnowledgeEmbeddingWorker

WORKERS = {
    "ai": AiWorker,
    "email": EmailWorker,
    "automation": AutomationWorker,
    "knowledge_import": KnowledgeImportWorker,
    "knowledge_indexer": KnowledgeEmbeddingWorker,
    "followup": FollowupWorker,
    "followup_scheduler": SchedulerRunner,
    "outbox_relay": OutboxRelayRunner,
}


def parse_args():
    parser = argparse.ArgumentParser(description="ProxiPilot Background Worker Runner")
    parser.add_argument(
        "--worker",
        type=str,
        required=True,
        choices=list(WORKERS.keys()),
        help="Worker service to boot",
    )
    return parser.parse_args()


async def main():
    args = parse_args()
    setup_logging(json_format=True)
    worker_cls = WORKERS[args.worker]

    logger.info("Starting background worker", worker_type=args.worker)
    worker = worker_cls()
    await worker.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Worker process exited via KeyboardInterrupt.")
        sys.exit(0)
