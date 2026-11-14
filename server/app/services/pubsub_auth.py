"""Google Cloud Pub/Sub Push Authentication Verifier.

Features:
- Validates Google-signed OIDC JWTs for authenticated Cloud Pub/Sub push delivery.
- In-memory caching of Google JWKS certificates with automatic TTL refresh.
- Enforces issuer (https://accounts.google.com), expected audience, and authorized service account.
- Rejects malformed or unauthorized requests with HTTP 401.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import time
from typing import Any, Dict, List, Optional, cast

import httpx
from jose import jwt
from jose.exceptions import JWTError

from app.core.config import get_settings
from app.core.http_client import http_client_manager
from app.core.logging import logger

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"]
JWKS_CACHE_TTL_SECONDS = 3600  # 1 hour


class GooglePubSubAuthVerifier:
    """Verifier for Google Cloud Pub/Sub push OIDC JWT tokens."""

    def __init__(self):
        self._cached_jwks: Optional[Dict[str, Any]] = None
        self._jwks_fetched_at: float = 0.0
        self._lock = asyncio.Lock()

    async def get_jwks(self) -> Dict[str, Any]:
        """Fetch and cache Google public JWKS keys."""
        now = time.time()
        if self._cached_jwks and (now - self._jwks_fetched_at) < JWKS_CACHE_TTL_SECONDS:
            return self._cached_jwks

        async with self._lock:
            # Double-check after acquiring lock
            if self._cached_jwks and (time.time() - self._jwks_fetched_at) < JWKS_CACHE_TTL_SECONDS:
                return self._cached_jwks

            try:
                client = http_client_manager.client
                resp = await client.get(GOOGLE_JWKS_URL, timeout=10.0)
                if resp.status_code == 200:
                    data = cast(Dict[str, Any], resp.json())
                    self._cached_jwks = data
                    self._jwks_fetched_at = time.time()
                    return data
                else:
                    logger.error(
                        "Failed to fetch Google JWKS certificates",
                        status_code=resp.status_code,
                    )
            except Exception as exc:
                logger.error("Exception fetching Google JWKS certificates", error=str(exc))

            # If fetch failed but we have an old cache, fallback to old cache
            if self._cached_jwks:
                return self._cached_jwks
            return {"keys": []}

    async def verify_token(
        self,
        auth_header: Optional[str],
        expected_audience: Optional[str] = None,
        expected_service_account: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Verify the Bearer token in the Authorization header.

        Returns decoded claims dictionary on success.
        Raises ValueError with reason on verification failure.
        """
        if not auth_header or not auth_header.startswith("Bearer "):
            raise ValueError("Missing or malformed Authorization header")

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            raise ValueError("Empty Bearer token")

        # 1. Extract unverified headers to identify kid and alg
        try:
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")
        except Exception as exc:
            raise ValueError(f"Invalid JWT header: {exc}") from exc

        # 2. Match kid against Google JWKS
        jwks = await self.get_jwks()
        keys = jwks.get("keys", [])
        matched_key = next((k for k in keys if k.get("kid") == kid), None)

        if not matched_key:
            # Force cache refresh once in case of recent key rotation
            self._jwks_fetched_at = 0.0
            jwks = await self.get_jwks()
            matched_key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
            if not matched_key:
                raise ValueError(f"Unknown Google signing key ID (kid): {kid}")

        # 3. Cryptographically verify signature and standard claims
        try:
            claims = cast(
                Dict[str, Any],
                jwt.decode(
                    token,
                    matched_key,
                    algorithms=["RS256"],
                    options={
                        "verify_aud": False,  # We verify audience explicitly below
                        "verify_iss": False,  # We verify issuer explicitly below
                    },
                ),
            )
        except JWTError as jwt_err:
            raise ValueError(f"JWT cryptographic validation failed: {jwt_err}") from jwt_err

        # 4. Enforce Google Issuer
        issuer = claims.get("iss")
        if issuer not in GOOGLE_ISSUERS:
            raise ValueError(f"Invalid token issuer: {issuer}")

        # 5. Enforce Audience if configured
        if expected_audience:
            token_aud = claims.get("aud")
            if token_aud != expected_audience:
                raise ValueError(
                    f"Audience mismatch: expected '{expected_audience}', got '{token_aud}'"
                )

        # 6. Enforce Service Account Identity if configured
        if expected_service_account:
            token_email = claims.get("email")
            if token_email != expected_service_account:
                raise ValueError(
                    f"Service account mismatch: expected '{expected_service_account}', got '{token_email}'"
                )

        # 7. Check expiration
        exp = claims.get("exp")
        if exp and exp < time.time():
            raise ValueError("Token expired")

        return claims


pubsub_auth_verifier = GooglePubSubAuthVerifier()
