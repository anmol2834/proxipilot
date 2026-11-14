"""AES-256-GCM Authenticated Encryption Layer for Sensitive Secrets at Rest.

Provides:
- AES-256-GCM symmetric authenticated encryption and decryption.
- 12-byte cryptographically secure random nonce/IV generated per encryption call.
- Storage format: Base64(iv:tag:ciphertext).
- Safe key derivation using SHA-256 from application secret key if explicit 32-byte key is not configured.
- Zero plaintext leak in logs or exceptions.
"""

import base64
import hashlib
import os
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import get_settings
from app.core.logging import logger


class CredentialEncryption:
    """Manages encryption and decryption of OAuth tokens and API secrets."""

    def __init__(self, key: Optional[bytes] = None):
        if key:
            self._key = key
        else:
            settings = get_settings()
            raw_secret = (
                getattr(settings.security, "encryption_secret_key", None)
                or getattr(settings.providers, "encryption_secret_key", None)
                or settings.security.jwt_secret_key
            )
            # Derive fixed 32-byte (256-bit) AES key via SHA-256
            self._key = hashlib.sha256(raw_secret.encode("utf-8")).digest()
        
        self._aesgcm = AESGCM(self._key)

    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext string using AES-256-GCM.
        
        Returns:
            URL-safe Base64 encoded string containing IV (12 bytes) + Ciphertext with GCM authentication tag.
        """
        if not plaintext:
            return ""
        
        # 96-bit (12-byte) nonce recommended for AES-GCM
        iv = os.urandom(12)
        ciphertext = self._aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
        
        # Combine iv + ciphertext
        payload = iv + ciphertext
        return base64.urlsafe_b64encode(payload).decode("utf-8")

    def decrypt(self, encoded_ciphertext: str) -> str:
        """Decrypt encoded ciphertext string back to plaintext.
        
        Raises:
            ValueError: If ciphertext has been tampered with, is corrupted, or decryption fails.
        """
        if not encoded_ciphertext:
            return ""
        
        try:
            payload = base64.urlsafe_b64decode(encoded_ciphertext.encode("utf-8"))
            if len(payload) < 28:  # 12 bytes IV + 16 bytes tag minimum
                raise ValueError("Invalid ciphertext length")
            
            iv = payload[:12]
            ciphertext = payload[12:]
            decrypted_bytes = self._aesgcm.decrypt(iv, ciphertext, None)
            return decrypted_bytes.decode("utf-8")
        except Exception as exc:
            logger.error("Failed to decrypt sensitive credential", error_type=type(exc).__name__)
            raise ValueError("Decryption failed: corrupted ciphertext or authentication tag mismatch") from exc


# Shared singleton instance
credential_encryption = CredentialEncryption()
