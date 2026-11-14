"""Automated Tests for Google Cloud Pub/Sub OIDC Token Authentication.

Tests:
1. Valid Google-signed OIDC JWT token accepted with matching audience and service account.
2. Missing or malformed Authorization header rejected.
3. Expired token rejected.
4. Token with invalid issuer (not accounts.google.com) rejected.
5. Token with mismatched audience rejected.
6. Token with mismatched service account identity rejected.
7. Token with unknown key ID (kid) rejected.
"""

import time
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from jose import jwt

from app.services.pubsub_auth import GooglePubSubAuthVerifier


# Generate a persistent RSA keypair for testing
_private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)
_public_key = _private_key.public_key()

_pem_private = _private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
).decode("utf-8")

_TEST_KID = "test-google-key-id-001"
_TEST_AUDIENCE = "https://api.proxipilot.com/api/v1/webhooks/gmail/pubsub"
_TEST_SERVICE_ACCOUNT = "pubsub-push@proxipilot-prod.iam.gserviceaccount.com"


def _generate_test_token(
    kid: str = _TEST_KID,
    iss: str = "https://accounts.google.com",
    aud: str = _TEST_AUDIENCE,
    email: str = _TEST_SERVICE_ACCOUNT,
    exp_offset_sec: int = 3600,
) -> str:
    """Generate a signed JWT token matching Google OIDC format."""
    now = int(time.time())
    payload = {
        "iss": iss,
        "aud": aud,
        "sub": "google-user-1234567890",
        "email": email,
        "email_verified": True,
        "iat": now,
        "exp": now + exp_offset_sec,
    }
    return jwt.encode(payload, _pem_private, algorithm="RS256", headers={"kid": kid})


def _build_test_verifier() -> GooglePubSubAuthVerifier:
    """Build a GooglePubSubAuthVerifier preloaded with the test RSA public key."""
    verifier = GooglePubSubAuthVerifier()
    # Convert public key to JWK dict
    from jose.jwk import RSAKey
    jwk_dict = RSAKey(key=_pem_private, algorithm="RS256").to_dict()
    jwk_dict["kid"] = _TEST_KID
    jwk_dict["use"] = "sig"
    jwk_dict["alg"] = "RS256"
    # Remove private components from JWK dict
    public_jwk = {k: v for k, v in jwk_dict.items() if k not in ("d", "p", "q", "dp", "dq", "qi")}

    verifier._cached_jwks = {"keys": [public_jwk]}
    verifier._jwks_fetched_at = time.time()
    return verifier


@pytest.mark.asyncio
async def test_valid_oidc_token_accepted():
    """Verify that a legitimate Google OIDC token validates successfully."""
    verifier = _build_test_verifier()
    token = _generate_test_token()
    auth_header = f"Bearer {token}"

    claims = await verifier.verify_token(
        auth_header=auth_header,
        expected_audience=_TEST_AUDIENCE,
        expected_service_account=_TEST_SERVICE_ACCOUNT,
    )

    assert claims["iss"] == "https://accounts.google.com"
    assert claims["aud"] == _TEST_AUDIENCE
    assert claims["email"] == _TEST_SERVICE_ACCOUNT


@pytest.mark.asyncio
async def test_missing_or_malformed_auth_header_rejected():
    """Verify that missing, empty, or malformed auth headers raise ValueError."""
    verifier = _build_test_verifier()

    with pytest.raises(ValueError, match="Missing or malformed Authorization header"):
        await verifier.verify_token(auth_header=None)

    with pytest.raises(ValueError, match="Missing or malformed Authorization header"):
        await verifier.verify_token(auth_header="Basic user:pass")

    with pytest.raises(ValueError, match="Empty Bearer token"):
        await verifier.verify_token(auth_header="Bearer ")


@pytest.mark.asyncio
async def test_expired_token_rejected():
    """Verify that an expired Google OIDC token is rejected."""
    verifier = _build_test_verifier()
    expired_token = _generate_test_token(exp_offset_sec=-60)  # Expired 60s ago

    with pytest.raises(ValueError, match="(?i)expired"):
        await verifier.verify_token(
            auth_header=f"Bearer {expired_token}",
            expected_audience=_TEST_AUDIENCE,
        )


@pytest.mark.asyncio
async def test_invalid_issuer_rejected():
    """Verify that a token with an unauthorized issuer is rejected."""
    verifier = _build_test_verifier()
    forged_token = _generate_test_token(iss="https://attacker-identity.com")

    with pytest.raises(ValueError, match="Invalid token issuer"):
        await verifier.verify_token(
            auth_header=f"Bearer {forged_token}",
            expected_audience=_TEST_AUDIENCE,
        )


@pytest.mark.asyncio
async def test_mismatched_audience_rejected():
    """Verify that a token for a different audience/service is rejected."""
    verifier = _build_test_verifier()
    wrong_aud_token = _generate_test_token(aud="https://other-service.com/webhook")

    with pytest.raises(ValueError, match="Audience mismatch"):
        await verifier.verify_token(
            auth_header=f"Bearer {wrong_aud_token}",
            expected_audience=_TEST_AUDIENCE,
        )


@pytest.mark.asyncio
async def test_mismatched_service_account_rejected():
    """Verify that a token from an unauthorized service account is rejected."""
    verifier = _build_test_verifier()
    wrong_sa_token = _generate_test_token(email="unauthorized-sa@evil-project.iam.gserviceaccount.com")

    with pytest.raises(ValueError, match="Service account mismatch"):
        await verifier.verify_token(
            auth_header=f"Bearer {wrong_sa_token}",
            expected_audience=_TEST_AUDIENCE,
            expected_service_account=_TEST_SERVICE_ACCOUNT,
        )


@pytest.mark.asyncio
async def test_unknown_key_id_rejected():
    """Verify that a token signed with an unknown kid is rejected."""
    verifier = _build_test_verifier()
    unknown_kid_token = _generate_test_token(kid="unknown-kid-999")

    with pytest.raises(ValueError, match="Unknown Google signing key ID"):
        await verifier.verify_token(
            auth_header=f"Bearer {unknown_kid_token}",
            expected_audience=_TEST_AUDIENCE,
        )
