"""Regression (QA audit 2026-11-15): the fixed developer OTP must never work on a hosted
environment. Staging used to accept it (the check was `environment != "production"`)."""

from app.services.auth import accepts_dev_master_otp


def test_master_otp_only_in_local_dev_and_tests():
    assert accepts_dev_master_otp("development") and accepts_dev_master_otp("test")
    assert not accepts_dev_master_otp("staging")
    assert not accepts_dev_master_otp("production")
    assert not accepts_dev_master_otp("")
