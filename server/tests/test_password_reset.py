"""Password reset flow: forgot-password -> verify code -> set new password.

Uses the real database with a throwaway @example.com user that is deleted afterwards.
Redis and the audit log are replaced with in-memory stand-ins, so no Redis is needed and
no audit rows are written.
"""

import asyncio
import time
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import delete, select

import app.services.auth as auth_module
from app.contracts.auth import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ResetPasswordVerifyRequest,
    VerifyOtpRequest,
)
from app.core.database import db_manager
from app.core.security import hash_password, verify_password
from app.models.auth import AuthenticationIdentity, EmailVerificationChallenge, Session as UserSession
from app.models.organization import User
from app.services.auth import auth_service


class FakeRedis:
    """Minimal async Redis with expiry, enough for the auth service."""

    def __init__(self):
        self.data: dict[str, tuple[str, float | None]] = {}

    def _live(self, key):
        item = self.data.get(key)
        if item and item[1] is not None and item[1] < time.monotonic():
            self.data.pop(key, None)
            return None
        return item

    async def get(self, key):
        item = self._live(key)
        return item[0] if item else None

    async def set(self, key, value, ex=None):
        self.data[key] = (str(value), time.monotonic() + ex if ex else None)
        return True

    async def ttl(self, key):
        item = self._live(key)
        if not item:
            return -2
        return -1 if item[1] is None else int(item[1] - time.monotonic())

    async def delete(self, *keys):
        return sum(1 for k in keys if self.data.pop(k, None) is not None)


@pytest.fixture
def fake_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(auth_module, "redis_manager", SimpleNamespace(client=fake))
    return fake


@pytest.fixture
def sent_emails(monkeypatch):
    """Capture code emails instead of sending them."""
    sent = []

    async def fake_send(to, code, purpose, expires_minutes=10):
        sent.append({"to": to, "code": code, "purpose": purpose})
        return True

    monkeypatch.setattr(auth_module, "send_code_email", fake_send)
    return sent


@pytest.fixture
def audit_calls(monkeypatch):
    calls = []

    async def record(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr(auth_module, "audit_service", SimpleNamespace(record=record))
    return calls


def _wrong_code(real: str) -> str:
    for candidate in ("000000", "999999", "111111"):
        if candidate not in (real, "123456"):
            return candidate
    raise AssertionError("unreachable")


@pytest.mark.asyncio
async def test_password_reset_end_to_end(fake_redis, audit_calls, sent_emails):
    db_manager.initialize()
    email = f"pytest_pwreset_{uuid.uuid4().hex[:10]}@example.com"
    user_id = f"usr_{uuid.uuid4().hex}"

    async with db_manager.session_factory() as db:
        user = User(
            id=user_id,
            email=email,
            full_name="Pytest Reset",
            hashed_password=hash_password("old-password-123"),
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.flush()
        db.add(
            UserSession(
                id=f"ses_{uuid.uuid4().hex}",
                user_id=user_id,
                jti=uuid.uuid4().hex,
                expires_at=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            )
        )
        await db.commit()

        try:
            # 1. Request a code (mixed-case email is normalised).
            started = await auth_service.request_password_reset(db, ForgotPasswordRequest(email=email.upper()))
            assert started.email == email
            code = await fake_redis.get(f"otp:{started.challenge_id}:code")
            assert code and len(code) == 6

            # The code is emailed (in the background) to the account's address.
            await asyncio.sleep(0.05)
            assert sent_emails == [{"to": email, "code": code, "purpose": "PASSWORD_RESET"}]

            # 2. Immediate second request is throttled.
            with pytest.raises(HTTPException) as e:
                await auth_service.request_password_reset(db, ForgotPasswordRequest(email=email))
            assert e.value.status_code == 429

            # 3. A reset code cannot be used to sign in via the signup verification endpoint.
            with pytest.raises(HTTPException) as e:
                await auth_service.verify_otp(
                    db, VerifyOtpRequest(email=email, challenge_id=started.challenge_id, otp=code)
                )
            assert e.value.status_code == 400

            # 4. Wrong code counts an attempt.
            with pytest.raises(HTTPException) as e:
                await auth_service.verify_password_reset(
                    db,
                    ResetPasswordVerifyRequest(email=email, challenge_id=started.challenge_id, otp=_wrong_code(code)),
                )
            assert e.value.status_code == 400

            # 5. Right code returns a single-use reset token; the code is burned.
            verified = await auth_service.verify_password_reset(
                db, ResetPasswordVerifyRequest(email=email, challenge_id=started.challenge_id, otp=code)
            )
            assert verified.reset_token
            with pytest.raises(HTTPException):
                await auth_service.verify_password_reset(
                    db, ResetPasswordVerifyRequest(email=email, challenge_id=started.challenge_id, otp=code)
                )

            # 6. Set the new password: old sessions are revoked and an audit event is recorded.
            done = await auth_service.reset_password(
                db, ResetPasswordRequest(reset_token=verified.reset_token, new_password="new-password-456")
            )
            assert done.email == email

            db.expire_all()
            fresh = (await db.execute(select(User).where(User.id == user_id))).scalar_one()
            assert verify_password("new-password-456", fresh.hashed_password)
            assert not verify_password("old-password-123", fresh.hashed_password)

            sessions = (await db.execute(select(UserSession).where(UserSession.user_id == user_id))).scalars().all()
            assert sessions and all(s.revoked_at and s.revocation_reason == "password_reset" for s in sessions)
            assert [c["action"].value for c in audit_calls] == ["PASSWORD_RESET"]

            # 7. The token cannot be reused.
            with pytest.raises(HTTPException) as e:
                await auth_service.reset_password(
                    db, ResetPasswordRequest(reset_token=verified.reset_token, new_password="another-pass-789")
                )
            assert e.value.status_code == 400
        finally:
            await db.rollback()
            await db.execute(delete(UserSession).where(UserSession.user_id == user_id))
            await db.execute(delete(EmailVerificationChallenge).where(EmailVerificationChallenge.user_id == user_id))
            await db.execute(delete(AuthenticationIdentity).where(AuthenticationIdentity.user_id == user_id))
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()


@pytest.mark.asyncio
async def test_unknown_email_gets_same_response_and_no_challenge(fake_redis, audit_calls, sent_emails):
    db_manager.initialize()
    email = f"pytest_nobody_{uuid.uuid4().hex[:10]}@example.com"
    async with db_manager.session_factory() as db:
        started = await auth_service.request_password_reset(db, ForgotPasswordRequest(email=email))
        assert started.challenge_id.startswith("chl_") and started.email == email

        stored = (
            await db.execute(select(EmailVerificationChallenge).where(EmailVerificationChallenge.id == started.challenge_id))
        ).scalar_one_or_none()
        assert stored is None

        # The decoy challenge behaves like a wrong code, not like "no such account".
        with pytest.raises(HTTPException) as e:
            await auth_service.verify_password_reset(
                db, ResetPasswordVerifyRequest(email=email, challenge_id=started.challenge_id, otp="654321")
            )
        assert e.value.status_code == 400
        assert "Invalid verification code" in e.value.detail

        # Unknown emails are throttled too, so the cooldown does not reveal which accounts exist.
        with pytest.raises(HTTPException) as e:
            await auth_service.request_password_reset(db, ForgotPasswordRequest(email=email))
        assert e.value.status_code == 429
        assert audit_calls == []
        await asyncio.sleep(0.05)
        assert sent_emails == []  # nothing is emailed for unknown addresses
