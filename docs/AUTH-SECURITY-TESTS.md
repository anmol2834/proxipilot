# Authentication & Session Security Testing — ProxiPilot

## 1. Overview

ProxiPilot enforces a security-first authentication model featuring native bcrypt password hashing, server-backed session tracking, Redis single-use OTP caching, rate-limited resends, attempt-limited lockout, and multi-device independent session lifecycles.

## 2. Test Scenarios (`server/tests/test_auth_security.py`)

| Test Name | Security Property Verified | Mechanism |
|---|---|---|
| `test_signup_and_otp_generation` | Account creation & challenge generation | Generates 6-digit numeric OTP with 10-minute Redis TTL and 45s cooldown key |
| `test_otp_verification_success_and_single_use` | Single-use OTP burn & replay defense | Immediate deletion from Redis on success; replay returns `400 Bad Request` |
| `test_wrong_otp_and_lockout_after_max_attempts` | Brute-force defense | Increments attempt counter in DB; 5th failed attempt locks challenge |
| `test_otp_resend_cooldown` | Email spam prevention | Rapid resend within 45 seconds returns `429 Too Many Requests` |
| `test_signin_credentials_and_rejections` | Credential security & enumeration defense | Invalid password returns generic 401; unknown email returns generic 401 |
| `test_signout_and_session_revocation` | Session revocation | Signout marks DB session `revoked_at` and removes Redis session cache |
| `test_multi_device_login_independence` | Independent multi-device sessions | Device A signout revokes Session A without terminating Device B Session B |

## 3. Execution & Verification

Run automated auth security suite:
```bash
python -m pytest tests/test_auth_security.py -v
```
All 7 test cases pass cleanly with 0 failures and 0 warnings.
