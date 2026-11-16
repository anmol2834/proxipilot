"""Asynchronous Enterprise Gmail REST API Client.

Features:
- High-performance connection pooling via HttpClientManager.
- Automated proactive and reactive OAuth access token refresh with AES-256-GCM re-encryption.
- Automatic REAUTH_REQUIRED transition on Google 'invalid_grant' revocation.
- Exponential backoff with jitter on HTTP 429 (quota exceeded) and 5xx transient failures.
- Specialized exception hierarchy:
    - GmailHistoryExpiredException: For HTTP 404 on history.list (triggers recovery full sync)
    - GmailReauthRequiredException: For revoked/invalid refresh credentials
    - GmailRateLimitException: For HTTP 429
    - GmailApiException: For generic provider errors
"""

import asyncio
from datetime import datetime, timezone
import random
from typing import Any, Dict, List, Optional, Tuple, cast
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.crypto import credential_encryption
from app.core.http_client import http_client_manager
from app.core.logging import logger
from app.core.redis import redis_manager
from app.models.integration import (
    ConnectedIntegrationAccount,
    ConnectionHealthStatus,
    IntegrationStatus,
    OAuthCredentialMetadata,
)


class GmailApiException(Exception):
    """Base exception for Gmail API failures."""

    def __init__(self, message: str, status_code: Optional[int] = None, details: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class GmailHistoryExpiredException(GmailApiException):
    """Raised when Gmail returns HTTP 404 for a startHistoryId that is no longer available.
    
    This is the expected signal to trigger full mailbox synchronization recovery.
    """
    pass


class GmailReauthRequiredException(GmailApiException):
    """Raised when Google rejects the refresh token (revoked permission, account deleted, password change)."""
    pass


class GmailRateLimitException(GmailApiException):
    """Raised on HTTP 429 or quota limit exhaustion."""
    pass


class GmailClient:
    """Enterprise client for Google OAuth and Gmail v1 REST API."""

    TOKEN_URL = "https://oauth2.googleapis.com/token"
    BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me"

    def __init__(self):
        self.settings = get_settings()

    async def get_valid_access_token(
        self,
        account: ConnectedIntegrationAccount,
        db: AsyncSession,
    ) -> str:
        """Retrieve a valid access token for the account, refreshing it if expired or expiring soon."""
        now = datetime.now(timezone.utc)

        # 1. Check if existing access token is present and still valid (with 5-minute safety buffer)
        if account.access_token_encrypted and account.token_expires_at:
            try:
                exp_dt = datetime.fromisoformat(account.token_expires_at)
                # If valid for at least another 5 minutes, use it
                if (exp_dt - now).total_seconds() > 300:
                    return credential_encryption.decrypt(account.access_token_encrypted)
            except Exception as e:
                logger.warning("Failed to parse token_expires_at, forcing refresh", error=str(e))

        # 2. Token is missing, expired, or near expiry — execute refresh
        if not account.refresh_token_encrypted:
            account.status = IntegrationStatus.REAUTH_REQUIRED.value
            account.connection_status = ConnectionHealthStatus.REAUTH_REQUIRED.value
            account.last_error_code = "NO_REFRESH_TOKEN"
            account.last_error_at = now.isoformat()
            await db.commit()
            try:
                await redis_manager.client.delete(f"gmail:account_cache:{account.email_address}")
            except Exception:
                pass
            raise GmailReauthRequiredException(
                "No refresh token available for Gmail account. Reauthorization required."
            )

        refresh_token = credential_encryption.decrypt(account.refresh_token_encrypted)
        client_id = self.settings.providers.get_effective_gmail_client_id()
        client_secret = self.settings.providers.get_effective_gmail_client_secret()

        client = http_client_manager.client
        payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }

        try:
            resp = await client.post(
                self.TOKEN_URL,
                data=payload,
                timeout=self.settings.providers.gmail_api_timeout,
            )
        except Exception as net_err:
            logger.error("Network error during Gmail token refresh", error=str(net_err))
            raise GmailApiException(f"Network error refreshing Gmail token: {net_err}") from net_err

        if resp.status_code != 200:
            err_body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            err_code = err_body.get("error", "")
            err_desc = err_body.get("error_description", resp.text)

            logger.error(
                "Google token refresh failed",
                status_code=resp.status_code,
                error=err_code,
                description=err_desc,
                account_id=account.id,
            )

            # Check for permanent Google revocation
            if resp.status_code in (400, 401) and err_code in ("invalid_grant", "unauthorized_client"):
                account.status = IntegrationStatus.REAUTH_REQUIRED.value
                account.connection_status = ConnectionHealthStatus.REAUTH_REQUIRED.value
                account.last_error_code = err_code or "INVALID_GRANT"
                account.last_error_at = now.isoformat()
                await db.commit()
                try:
                    await redis_manager.client.delete(f"gmail:account_cache:{account.email_address}")
                except Exception:
                    pass
                raise GmailReauthRequiredException(
                    f"Gmail authorization has been revoked or expired: {err_desc}"
                )
            
            raise GmailApiException(
                f"Failed to refresh Gmail token: {err_desc}",
                status_code=resp.status_code,
                details=err_body,
            )

        data = resp.json()
        new_access_token: str = str(data["access_token"])
        expires_in = data.get("expires_in", 3600)
        from datetime import timedelta
        new_expires_dt = now + timedelta(seconds=expires_in)

        # Re-encrypt and persist
        account.access_token_encrypted = credential_encryption.encrypt(new_access_token)
        account.token_expires_at = new_expires_dt.isoformat()
        
        # Load or update metadata refresh count
        res = await db.execute(
            select(OAuthCredentialMetadata).where(OAuthCredentialMetadata.integration_account_id == account.id)
        )
        meta = res.scalar_one_or_none()
        if meta:
            meta.token_refresh_count += 1
            meta.last_refresh_error = None

        await db.commit()
        logger.info("Gmail access token refreshed successfully", account_id=account.id)
        return new_access_token

    async def _execute_with_retry(
        self,
        method: str,
        url: str,
        access_token: str,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
        max_retries: int = 4,
    ) -> httpx.Response:
        """Execute Google API HTTP request with exponential backoff and jitter."""
        client = http_client_manager.client
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        }

        base_backoff = 1.0
        for attempt in range(max_retries + 1):
            try:
                resp = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json_body,
                    timeout=self.settings.providers.gmail_api_timeout,
                )

                # History 404 (History expired/outdated)
                if resp.status_code == 404 and "history" in url:
                    raise GmailHistoryExpiredException(
                        "Gmail historyId is outdated or expired (HTTP 404). Full sync recovery required.",
                        status_code=404,
                    )

                # Rate limit (429) or transient 5xx
                if resp.status_code in (429, 500, 502, 503, 504):
                    if attempt < max_retries:
                        jitter = random.uniform(0.1, 0.5)
                        backoff = (base_backoff * (2 ** attempt)) + jitter
                        # Respect Retry-After if provided
                        retry_after = resp.headers.get("Retry-After")
                        if retry_after and retry_after.isdigit():
                            backoff = max(float(retry_after), backoff)
                        
                        logger.warning(
                            "Gmail API rate limited or transient error, retrying...",
                            status_code=resp.status_code,
                            attempt=attempt + 1,
                            backoff_seconds=round(backoff, 2),
                        )
                        await asyncio.sleep(backoff)
                        continue
                    
                    if resp.status_code == 429:
                        raise GmailRateLimitException(
                            f"Gmail API rate limit exceeded: {resp.text}",
                            status_code=429,
                        )
                    raise GmailApiException(
                        f"Gmail API server error: {resp.status_code} {resp.text}",
                        status_code=resp.status_code,
                    )

                return resp

            except (httpx.TimeoutException, httpx.NetworkError) as net_err:
                if attempt < max_retries:
                    backoff = (base_backoff * (2 ** attempt)) + random.uniform(0.1, 0.3)
                    logger.warning("Gmail network error, retrying...", error=str(net_err), attempt=attempt + 1)
                    await asyncio.sleep(backoff)
                    continue
                raise GmailApiException(f"Gmail network failure after {max_retries} retries: {net_err}") from net_err

        raise GmailApiException("Unexpected loop exit in execute_with_retry")

    async def watch_user(self, access_token: str, topic_name: str) -> Dict[str, Any]:
        """Register Google Cloud Pub/Sub push notifications via users.watch().
        
        Returns:
            Dict containing 'historyId' and 'expiration' (epoch ms as string).
        """
        url = f"{self.BASE_URL}/watch"
        body = {
            "topicName": topic_name,
            "labelIds": ["INBOX"],  # Watch changes to Inbox
        }
        resp = await self._execute_with_retry("POST", url, access_token, json_body=body)
        if resp.status_code != 200:
            raise GmailApiException(
                f"users.watch() failed: {resp.text}", status_code=resp.status_code
            )
        return cast(Dict[str, Any], resp.json())

    async def stop_watch(self, access_token: str) -> bool:
        """Stop Pub/Sub push notifications via users.stop()."""
        url = f"{self.BASE_URL}/stop"
        try:
            resp = await self._execute_with_retry("POST", url, access_token)
            return resp.status_code in (200, 204)
        except Exception as exc:
            logger.warning("Failed to stop Gmail watch registration", error=str(exc))
            return False

    async def get_profile(self, access_token: str) -> Dict[str, Any]:
        """Fetch primary mailbox profile information (emailAddress, historyId, messagesTotal)."""
        url = f"{self.BASE_URL}/profile"
        resp = await self._execute_with_retry("GET", url, access_token)
        if resp.status_code != 200:
            raise GmailApiException(f"get_profile failed: {resp.text}", status_code=resp.status_code)
        return cast(Dict[str, Any], resp.json())

    async def list_history(
        self,
        access_token: str,
        start_history_id: str,
        page_token: Optional[str] = None,
        max_results: int = 100,
        label_id: str = "INBOX",
    ) -> Dict[str, Any]:
        """Fetch mailbox history changes since startHistoryId, scoped to a label.

        Args:
            label_id: Restrict history to changes affecting this label.
                      Defaults to 'INBOX' so only true inbox changes are processed.
                      This prevents Promotions / Updates / Social category events
                      from reaching the ingestion pipeline.

        Raises:
            GmailHistoryExpiredException: If startHistoryId is unavailable/outdated (HTTP 404).
        """
        url = f"{self.BASE_URL}/history"
        params: Dict[str, Any] = {
            "startHistoryId": start_history_id,
            "maxResults": max_results,
            # Only fetch messageAdded events for the INBOX label.
            # This means:
            # - Messages that Gmail routes directly to Promotions/Updates/Social
            #   never appear in history.list results, so they skip ingestion entirely.
            # - labelsAdded events are excluded (we don't need them — the filter
            #   pipeline's label check handles any that somehow still arrive).
            "labelId": label_id,
            "historyTypes": "messageAdded",
        }
        if page_token:
            params["pageToken"] = page_token

        resp = await self._execute_with_retry("GET", url, access_token, params=params)
        if resp.status_code != 200:
            raise GmailApiException(f"list_history failed: {resp.text}", status_code=resp.status_code)
        return cast(Dict[str, Any], resp.json())

    async def list_messages(
        self,
        access_token: str,
        query: Optional[str] = None,
        max_results: int = 50,
        page_token: Optional[str] = None,
        label_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Fetch list of message IDs matching query or in inbox.

        Args:
            query: Gmail search query. Defaults to 'in:inbox' if None, ensuring
                   only genuine inbox messages are fetched during full sync.
                   Promotions, Updates, Social and Spam categories are excluded.
            label_ids: Optional explicit label filter (e.g. ["INBOX"]).
        """
        url = f"{self.BASE_URL}/messages"
        # Default to inbox Primary category: prevents full-sync from pulling Promotions,
        # Updates, Social, job alert digests, shipping notifications, etc.
        effective_query = query if query is not None else "in:inbox category:primary"
        params: Dict[str, Any] = {
            "maxResults": max_results,
            "q": effective_query,
        }
        if label_ids:
            # Repeated param: Gmail API accepts multiple labelIds
            params["labelIds"] = label_ids
        if page_token:
            params["pageToken"] = page_token

        resp = await self._execute_with_retry("GET", url, access_token, params=params)
        if resp.status_code != 200:
            raise GmailApiException(f"list_messages failed: {resp.text}", status_code=resp.status_code)
        return cast(Dict[str, Any], resp.json())

    async def get_message(
        self,
        access_token: str,
        message_id: str,
        msg_format: str = "full",
    ) -> Dict[str, Any]:
        """Fetch detailed message payload."""
        url = f"{self.BASE_URL}/messages/{message_id}"
        params = {"format": msg_format}
        resp = await self._execute_with_retry("GET", url, access_token, params=params)
        if resp.status_code != 200:
            raise GmailApiException(f"get_message failed: {resp.text}", status_code=resp.status_code)
        return cast(Dict[str, Any], resp.json())

    async def get_message_metadata(
        self,
        access_token: str,
        message_id: str,
        header_fields: Optional[List[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Fetch message with format=metadata and specific headers only.

        Approximately 10x cheaper than format=full since no body is returned.
        Returns None if message is unavailable (404 — deleted/trashed mid-sync).

        Args:
            access_token: Valid OAuth2 access token.
            message_id: Gmail message ID.
            header_fields: Header names to include. Defaults to a minimal set.
        """
        if header_fields is None:
            header_fields = [
                "From", "To", "Date", "Subject",
                "Message-ID", "In-Reply-To", "References",
                "Content-Type", "Precedence", "List-Id",
                "List-Unsubscribe", "List-Post", "List-Help",
                "List-Archive", "Auto-Submitted",
            ]
        url = f"{self.BASE_URL}/messages/{message_id}"
        params: Dict[str, Any] = {
            "format": "metadata",
            "metadataHeaders": ",".join(header_fields),
        }
        try:
            client = http_client_manager.client
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            }
            resp = await client.get(
                url,
                headers=headers,
                params=params,
                timeout=self.settings.providers.gmail_api_timeout,
            )
            if resp.status_code == 404:
                # Message deleted / trashed between history notification and fetch
                return None
            if resp.status_code != 200:
                logger.warning(
                    "Metadata fetch non-200",
                    message_id=message_id,
                    status=resp.status_code,
                )
                return None
            return cast(Dict[str, Any], resp.json())
        except Exception as exc:
            logger.warning(
                "Error fetching message metadata, treating as unavailable",
                message_id=message_id,
                error=str(exc),
            )
            return None

    async def get_messages_batch(
        self,
        access_token: str,
        message_ids: List[str],
        msg_format: str = "full",
        batch_size: int = 25,
        header_fields: Optional[List[str]] = None,
    ) -> Dict[str, Optional[Dict[str, Any]]]:
        """Fetch multiple messages concurrently in bounded batches.

        Returns a dict mapping message_id → payload_dict | None.
        None means the message is unavailable (404 — deleted/trashed).

        Args:
            access_token: Valid OAuth2 access token.
            message_ids: List of Gmail message IDs to fetch.
            msg_format: "full" or "metadata". Default "full".
            batch_size: Max concurrent requests per batch. Default 25.
            header_fields: Only used when msg_format="metadata".
        """
        results: Dict[str, Optional[Dict[str, Any]]] = {}

        async def _fetch_one(msg_id: str) -> Tuple[str, Optional[Dict[str, Any]]]:
            """Fetch a single message, returning (id, payload) or (id, None) on 404."""
            try:
                if msg_format == "metadata":
                    payload = await self.get_message_metadata(access_token, msg_id, header_fields)
                else:
                    url = f"{self.BASE_URL}/messages/{msg_id}"
                    params: Dict[str, Any] = {"format": msg_format}
                    client = http_client_manager.client
                    headers = {
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/json",
                    }
                    resp = await client.get(
                        url,
                        headers=headers,
                        params=params,
                        timeout=self.settings.providers.gmail_api_timeout,
                    )
                    if resp.status_code == 404:
                        return msg_id, None
                    if resp.status_code == 429:
                        # Back-pressure: wait and retry once
                        await asyncio.sleep(2.0)
                        resp = await client.get(
                            url, headers=headers, params=params,
                            timeout=self.settings.providers.gmail_api_timeout,
                        )
                    if resp.status_code != 200:
                        logger.warning(
                            "Batch message fetch non-200",
                            message_id=msg_id,
                            status=resp.status_code,
                        )
                        return msg_id, None
                    payload = resp.json()
                return msg_id, payload
            except Exception as exc:
                logger.warning(
                    "Batch message fetch exception, treating as unavailable",
                    message_id=msg_id,
                    error=str(exc),
                )
                return msg_id, None

        # Process in bounded batches to avoid thundering-herd against Gmail quota
        for i in range(0, len(message_ids), batch_size):
            batch = message_ids[i : i + batch_size]
            tasks = [_fetch_one(mid) for mid in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=False)
            for msg_id, payload in batch_results:
                results[msg_id] = payload

        logger.info(
            "Batch message fetch complete",
            total=len(message_ids),
            format=msg_format,
            batch_size=batch_size,
            fetched=sum(1 for v in results.values() if v is not None),
            unavailable=sum(1 for v in results.values() if v is None),
        )
        return results

    async def send_message(
        self,
        access_token: str,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
        from_email: Optional[str] = None,
        thread_id: Optional[str] = None,
        in_reply_to_header: Optional[str] = None,
        references_header: Optional[str] = None,
        auto_submitted: bool = False,
    ) -> Dict[str, Any]:
        """Send an email message via Gmail v1 REST API.

        Constructs an RFC 2822 compliant MIME message, base64url-encodes it,
        and posts to /messages/send preserving the thread ID and RFC reply headers.
        """
        import base64
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("alternative")
        msg["To"] = to_email
        if from_email:
            msg["From"] = from_email
        msg["Subject"] = subject

        if in_reply_to_header:
            msg["In-Reply-To"] = in_reply_to_header
        if references_header:
            msg["References"] = references_header
        if auto_submitted:
            # RFC 3834: mark machine-sent replies so other automated responders (including another
            # tenant's ProxiPilot, or out-of-office rules) never answer them -> no reply loops.
            msg["Auto-Submitted"] = "auto-replied"
            msg["X-Auto-Response-Suppress"] = "All"

        # Attach text part
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
        if body_html:
            msg.attach(MIMEText(body_html, "html", "utf-8"))

        raw_bytes = msg.as_bytes()
        raw_b64 = base64.urlsafe_b64encode(raw_bytes).decode("utf-8").rstrip("=")

        payload: Dict[str, Any] = {"raw": raw_b64}
        if thread_id:
            payload["threadId"] = thread_id

        client = http_client_manager.client
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        url = f"{self.BASE_URL}/messages/send"
        resp = await client.post(
            url,
            headers=headers,
            json=payload,
            timeout=self.settings.providers.gmail_api_timeout,
        )

        if resp.status_code == 429:
            # Back-pressure: wait and retry once
            await asyncio.sleep(2.0)
            resp = await client.post(
                url,
                headers=headers,
                json=payload,
                timeout=self.settings.providers.gmail_api_timeout,
            )

        if resp.status_code not in (200, 201):
            logger.error(
                "Gmail send_message failed",
                status_code=resp.status_code,
                response=resp.text,
                to_email=to_email,
                thread_id=thread_id,
            )
            raise GmailApiException(
                f"Failed to send email via Gmail (HTTP {resp.status_code}): {resp.text}",
                status_code=resp.status_code,
            )

        res_json = resp.json()
        logger.info(
            "Gmail message sent successfully",
            provider_message_id=res_json.get("id"),
            provider_thread_id=res_json.get("threadId"),
            to_email=to_email,
        )
        return cast(Dict[str, Any], res_json)


# Shared singleton instance
gmail_client = GmailClient()
