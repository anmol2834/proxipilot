"""Transactional (system) email: verification and password-reset codes.

Delivery modes (TransactionalEmailSettings, EMAIL_DELIVERY):
- smtp:   standard-library SMTP in a worker thread, for any SMTP provider.
- twilio: Twilio Email REST API (POST https://comms.twilio.com/v1/Emails, HTTP Basic with an
          API key SID + secret). The From domain must be authenticated in Twilio Email > Domains.
With EMAIL_DELIVERY=log nothing is sent.
"""

from __future__ import annotations

import asyncio
import html
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from typing import Literal, Optional

import httpx

from app.core.config import get_transactional_email_settings
from app.core.logging import logger

CodePurpose = Literal["EMAIL_VERIFICATION", "PASSWORD_RESET"]

BRAND_BLUE = "#3562F5"
INK = "#0F172A"
MUTED = "#64748B"


# Tests swap this for httpx.MockTransport.
_TWILIO_TRANSPORT: Optional[httpx.AsyncBaseTransport] = None


class EmailDeliveryError(RuntimeError):
    """Raised when an email could not be handed to the SMTP server."""


def _mask(address: str) -> str:
    """j***@example.com — enough to trace a delivery without logging the full address."""
    local, _, domain = address.partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"


def build_message(
    to: str,
    subject: str,
    text: str,
    html_body: str,
    reply_to: Optional[str] = None,
) -> EmailMessage:
    cfg = get_transactional_email_settings()
    msg = EmailMessage()
    msg["From"] = formataddr((cfg.email_from_name, cfg.email_from_address))
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=False)
    domain = cfg.email_from_address.partition("@")[2] or "proxipilot.com"
    msg["Message-ID"] = make_msgid(domain=domain)
    if reply_to or cfg.email_reply_to:
        msg["Reply-To"] = reply_to or cfg.email_reply_to
    # Transactional mail: tell auto-responders not to reply.
    msg["Auto-Submitted"] = "auto-generated"
    msg.set_content(text)
    msg.add_alternative(html_body, subtype="html")
    return msg


def _send_smtp(msg: EmailMessage) -> None:
    cfg = get_transactional_email_settings()
    context = ssl.create_default_context()
    try:
        if cfg.smtp_security == "ssl":
            server: smtplib.SMTP = smtplib.SMTP_SSL(
                cfg.smtp_host, cfg.smtp_port, timeout=cfg.smtp_timeout_seconds, context=context
            )
        else:
            server = smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=cfg.smtp_timeout_seconds)
        with server:
            server.ehlo()
            if cfg.smtp_security == "starttls":
                server.starttls(context=context)
                server.ehlo()
            if cfg.smtp_username:
                server.login(cfg.smtp_username, cfg.smtp_password)
            server.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        raise EmailDeliveryError(f"SMTP delivery failed: {exc.__class__.__name__}: {exc}") from exc


async def _send_twilio(to: str, subject: str, text: str, html_body: str) -> str:
    """Send through the Twilio Email API; returns Twilio's operation id."""
    cfg = get_transactional_email_settings()
    payload = {
        "from": {"address": cfg.email_from_address, "name": cfg.email_from_name},
        "to": [{"address": to}],
        "content": {"subject": subject, "html": html_body, "text": text},
    }
    try:
        async with httpx.AsyncClient(
            timeout=cfg.smtp_timeout_seconds, transport=_TWILIO_TRANSPORT
        ) as client:
            res = await client.post(
                cfg.twilio_email_api_url,
                json=payload,
                auth=(cfg.twilio_api_key_sid, cfg.twilio_api_key_secret),
            )
    except httpx.HTTPError as exc:
        raise EmailDeliveryError(f"Twilio Email request failed: {exc.__class__.__name__}: {exc}") from exc
    if res.status_code not in (200, 201, 202):
        raise EmailDeliveryError(f"Twilio Email rejected the message: HTTP {res.status_code}: {res.text[:300]}")
    try:
        return str(res.json().get("operationId", ""))
    except ValueError:
        return ""


async def send_email(to: str, subject: str, text: str, html_body: str) -> bool:
    """Send one email. Returns True if handed to the provider, False in log mode.
    Raises EmailDeliveryError if the provider refuses or cannot be reached."""
    cfg = get_transactional_email_settings()
    if cfg.email_delivery == "twilio":
        operation_id = await _send_twilio(to, subject, text, html_body)
        logger.info("Email sent", provider="twilio", to=_mask(to), subject=subject, operation_id=operation_id)
        return True
    if cfg.email_delivery != "smtp":
        logger.info("Email not sent (EMAIL_DELIVERY=log)", to=_mask(to), subject=subject)
        return False
    msg = build_message(to, subject, text, html_body)
    await asyncio.to_thread(_send_smtp, msg)
    logger.info("Email sent", to=_mask(to), subject=subject, message_id=msg["Message-ID"])
    return True


# ---------------------------------------------------------------------------
# Code emails
# ---------------------------------------------------------------------------

_COPY = {
    "EMAIL_VERIFICATION": {
        "subject": "{code} is your ProxiPilot verification code",
        "heading": "Verify your email",
        "intro": "Use this code to finish creating your ProxiPilot account.",
        "ignore": "If you didn’t try to sign up for ProxiPilot, you can ignore this email.",
    },
    "PASSWORD_RESET": {
        "subject": "Reset your ProxiPilot password",
        "heading": "Reset your password",
        "intro": "We received a request to reset the password for your ProxiPilot account. Enter this code to continue.",
        "ignore": "If you didn’t ask to reset your password, you can ignore this email. Your password won’t change.",
    },
}


def render_code_email(code: str, purpose: CodePurpose, expires_minutes: int = 10) -> tuple[str, str, str]:
    """Return (subject, text, html) for a 6-digit code email."""
    copy = _COPY[purpose]
    subject = copy["subject"].format(code=code)

    text = (
        f"{copy['heading']}\n\n"
        f"{copy['intro']}\n\n"
        f"Your code: {code}\n\n"
        f"It expires in {expires_minutes} minutes. Never share this code with anyone; "
        f"ProxiPilot will never ask you for it.\n\n"
        f"{copy['ignore']}\n\n"
        f"— ProxiPilot\n"
    )

    esc = html.escape
    html_body = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>{esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F6FB;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your code is {esc(code)}. It expires in {expires_minutes} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FB;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:16px;border:1px solid #E6E9F2;">
      <tr><td style="padding:28px 32px 0 32px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;">
        <div style="font-size:18px;font-weight:700;color:{INK};letter-spacing:-0.01em;">
          <span style="color:{BRAND_BLUE};">&#9650;</span>&nbsp;ProxiPilot
        </div>
      </td></tr>
      <tr><td style="padding:24px 32px 8px 32px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;">
        <h1 style="margin:0 0 10px 0;font-size:22px;line-height:1.3;color:{INK};font-weight:700;">{esc(copy['heading'])}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">{esc(copy['intro'])}</p>
      </td></tr>
      <tr><td style="padding:20px 32px;">
        <div style="background:#F3F6FF;border:1px solid #DCE4FF;border-radius:12px;padding:18px 12px;text-align:center;">
          <div style="font-family:SFMono-Regular,Consolas,Menlo,monospace;font-size:30px;line-height:1.2;font-weight:700;letter-spacing:8px;white-space:nowrap;color:{INK};">{esc(code)}</div>
          <div style="margin-top:8px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;color:{MUTED};">Expires in {expires_minutes} minutes</div>
        </div>
      </td></tr>
      <tr><td style="padding:0 32px 28px 32px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;">
        <p style="margin:0 0 10px 0;font-size:13px;line-height:1.6;color:{MUTED};">Never share this code with anyone. ProxiPilot will never ask you for it.</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:{MUTED};">{esc(copy['ignore'])}</p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0 0;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;color:#94A3B8;">ProxiPilot &middot; Operated by Cheldain</p>
  </td></tr>
</table>
</body>
</html>"""
    return subject, text, html_body


async def send_code_email(to: str, code: str, purpose: CodePurpose, expires_minutes: int = 10) -> bool:
    subject, text, html_body = render_code_email(code, purpose, expires_minutes)
    return await send_email(to, subject, text, html_body)
