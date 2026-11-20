"""Conversation intelligence & follow-ups (AI #2 assessment mode, planning, reminders, gated customer email).

Modules
-------
flags      rollout flags (assessment / shadow / reminders / customer-send kill switch)
contracts  strict, versioned AI #2 decision contract + validator (no business vocabulary)
timing     pure calendar arithmetic: time zones, business days, DST, advance notice
assessor   builds as-of-message context and calls AI #2 (no draft, no send)
engine     atomic, revision-fenced application of a decision; suppression; occurrences
gate       the authoritative customer-send gate (re-evaluated on fresh state)
composer   grounded customer follow-up text (only when customer email is permitted)
notify     internal team notice rendering + per-recipient fan-out
scheduler  leased due scans: advance notice, due notice, gated customer send
triggers   transactional-outbox enqueue + new-message fence (called inside ingestion txns)
"""
