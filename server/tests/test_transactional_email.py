"""Transactional email: templates, headers, log mode, and real SMTP delivery to a local sink.

No external network or database: a tiny in-process SMTP server receives the messages.
"""

import email
import socket
import socketserver
import threading
from email import policy

import pytest

import app.services.transactional_email as te
from app.core.config import TransactionalEmailSettings


class _SmtpSink(socketserver.StreamRequestHandler):
    """Just enough SMTP to accept one message per DATA command."""

    def _send(self, line: str) -> None:
        self.wfile.write((line + "\r\n").encode())

    def handle(self) -> None:
        self._send("220 sink ready")
        mail_from, rcpts = None, []
        while True:
            raw = self.rfile.readline()
            if not raw:
                return
            cmd = raw.decode(errors="replace").strip()
            upper = cmd.upper()
            if upper.startswith(("EHLO", "HELO")):
                self._send("250-sink")
                self._send("250 AUTH PLAIN LOGIN")
            elif upper.startswith("AUTH PLAIN"):
                self.server.auth.append(cmd)
                self._send("235 ok")
            elif upper.startswith("MAIL FROM"):
                mail_from = cmd[10:]
                self._send("250 ok")
            elif upper.startswith("RCPT TO"):
                rcpts.append(cmd[8:])
                self._send("250 ok")
            elif upper == "DATA":
                self._send("354 end with .")
                lines = []
                while True:
                    line = self.rfile.readline()
                    if line in (b".\r\n", b".\n", b""):
                        break
                    lines.append(line[1:] if line.startswith(b"..") else line)
                self.server.messages.append((mail_from, rcpts[:], b"".join(lines)))
                rcpts.clear()
                self._send("250 queued")
            elif upper == "QUIT":
                self._send("221 bye")
                return
            else:
                self._send("250 ok")


@pytest.fixture
def smtp_sink():
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), _SmtpSink)
    server.daemon_threads = True
    server.messages, server.auth = [], []
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server
    server.shutdown()
    server.server_close()


def _use(monkeypatch, **env):
    cfg = TransactionalEmailSettings(**env)
    monkeypatch.setattr(te, "get_transactional_email_settings", lambda: cfg)
    return cfg


def test_templates_show_code_and_never_leak_it_into_reset_subject():
    subject, text, html_body = te.render_code_email("482916", "EMAIL_VERIFICATION")
    assert subject == "482916 is your ProxiPilot verification code"
    assert "482916" in text and "4 8 2 9 1 6" in html_body and "Expires in 10 minutes" in html_body

    subject, text, html_body = te.render_code_email("482916", "PASSWORD_RESET")
    assert "482916" not in subject
    assert "Reset your password" in html_body and "482916" in text
    assert "won’t change" in text


@pytest.mark.asyncio
async def test_log_mode_sends_nothing(monkeypatch, smtp_sink):
    _use(monkeypatch, EMAIL_DELIVERY="log", SMTP_HOST="127.0.0.1", SMTP_PORT=smtp_sink.server_address[1])
    assert await te.send_code_email("someone@example.com", "123456", "PASSWORD_RESET") is False
    assert smtp_sink.messages == []


@pytest.mark.asyncio
async def test_smtp_delivers_multipart_message_with_auth(monkeypatch, smtp_sink):
    _use(
        monkeypatch,
        EMAIL_DELIVERY="smtp",
        SMTP_HOST="127.0.0.1",
        SMTP_PORT=smtp_sink.server_address[1],
        SMTP_SECURITY="none",
        SMTP_USERNAME="apikey",
        SMTP_PASSWORD="secret-value",
        EMAIL_FROM_ADDRESS="no-reply@proxipilot.com",
        EMAIL_FROM_NAME="ProxiPilot",
        EMAIL_REPLY_TO="hello@proxipilot.com",
    )
    assert await te.send_code_email("Pat.Doe@example.com", "731205", "EMAIL_VERIFICATION") is True

    assert len(smtp_sink.messages) == 1 and smtp_sink.auth  # logged in
    mail_from, rcpts, raw = smtp_sink.messages[0]
    assert "no-reply@proxipilot.com" in mail_from and any("Pat.Doe@example.com" in r for r in rcpts)

    msg = email.message_from_bytes(raw, policy=policy.default)
    assert msg["Subject"] == "731205 is your ProxiPilot verification code"
    assert msg["From"] == "ProxiPilot <no-reply@proxipilot.com>"
    assert msg["Reply-To"] == "hello@proxipilot.com"
    assert msg["Auto-Submitted"] == "auto-generated"
    assert msg["Message-ID"].endswith("@proxipilot.com>")
    plain = msg.get_body(preferencelist=("plain",)).get_content()
    rich = msg.get_body(preferencelist=("html",)).get_content()
    assert "731205" in plain and "7 3 1 2 0 5" in rich


@pytest.mark.asyncio
async def test_smtp_failure_raises_delivery_error(monkeypatch):
    with socket.socket() as s:  # find a closed port
        s.bind(("127.0.0.1", 0))
        closed_port = s.getsockname()[1]
    _use(
        monkeypatch,
        EMAIL_DELIVERY="smtp",
        SMTP_HOST="127.0.0.1",
        SMTP_PORT=closed_port,
        SMTP_SECURITY="none",
        SMTP_TIMEOUT_SECONDS=2,
    )
    with pytest.raises(te.EmailDeliveryError):
        await te.send_code_email("someone@example.com", "123456", "PASSWORD_RESET")


def test_smtp_mode_requires_host():
    with pytest.raises(ValueError):
        TransactionalEmailSettings(EMAIL_DELIVERY="smtp", SMTP_HOST="")
