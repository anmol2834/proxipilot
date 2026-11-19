"""Only human-written business mail is stored and answered. Real examples from production plus the
usual machine-sent families; genuine customer mail (including tricky cases) must still pass."""

import asyncio

import pytest

from app.services import mail_authenticity as ma
from app.services.email_filter import EmailCategory, EmailFilterService

F = EmailFilterService()
GMAIL_ID = "<CAJ+abc123=xyz@mail.gmail.com>"


def run(from_, subject, body, *, labels=("INBOX",), headers=None, existing=False, own_domain="example-business.com"):
    h = {"from": from_, "subject": subject, **(headers or {})}
    meta = F.classify_metadata_sync(label_ids=list(labels), headers=h, tenant_id="t",
                                    is_existing_conversation=existing, own_domain=own_domain)
    res = F.classify_body(body_text=body, subject=subject, from_header=from_, metadata_result=meta, headers=h,
                          label_ids=list(labels), is_existing_conversation=existing, own_domain=own_domain)
    return res


# --------------------------------------------------------------------------- the two production incidents

def test_proxipilot_verification_code_is_rejected():
    res = run("ProxiPilot <hello@proxipilot.com>", "123456 is your ProxiPilot verification code",
              "Verify your email Use this code to finish creating your ProxiPilot account. Your code: 123456 "
              "It expires in 10 minutes. Never share this code with anyone; ProxiPilot will never ask you for it. "
              "If you didn't try to sign up for ProxiPilot, you can ignore this email.")
    assert not res.should_store and res.category == EmailCategory.SECURITY_OR_FINANCIAL_NOTICE


def test_chatgpt_login_code_from_noreply_is_rejected():
    res = run("OpenAI <noreply@tm.openai.com>", "Your temporary ChatGPT login code",
              "Your temporary ChatGPT login code Enter this temporary verification code to continue: 182795. "
              "ChatGPT Log-in Code Hi there, We noticed a suspicious log-in on your account.")
    assert not res.should_store


# --------------------------------------------------------------------------- machine-sent families

@pytest.mark.parametrize("from_,subject,body,labels,headers", [
    ("Bank <alerts@hdfcbank.net>", "Transaction alert", "Your OTP is 482913 for the transaction. Do not share it.",
     ("INBOX",), {}),
    ("Brand <news@brand.com>", "Big Diwali sale - 40% off", "Shop now! Limited time. Unsubscribe | View in browser",
     ("INBOX", "CATEGORY_PROMOTIONS"), {}),
    ("Brand <hello@brand.com>", "New arrivals for you", "Hi there, new arrivals just dropped. Shop now. Unsubscribe.",
     ("INBOX",), {"list-unsubscribe": "<https://brand.com/u>", "feedback-id": "1:2:3:ses"}),
    ("Store <orders@store.com>", "Your order #4821 has shipped", "Hi, your order has shipped. Track it here.",
     ("INBOX", "CATEGORY_UPDATES"), {}),
    ("Colleague <colleague@partner.com>", "Automatic reply: Out of office", "I am away until Monday.",
     ("INBOX",), {"auto-submitted": "auto-replied"}),
    ("Rahul <rahul@growthagency.io>", "Quick question",
     "Hi there, just following up on my last email. We help brands like yours triple leads. "
     "Worth a quick 15-min call this week? Grab a slot: https://calendly.com/rahul/15min",
     ("INBOX",), {"x-mailer": "lemlist"}),
    ("Digest <digest@platform.com>", "Your weekly digest", "Top stories this week ... Manage preferences. Unsubscribe.",
     ("INBOX",), {"list-id": "<digest.platform.com>", "precedence": "bulk"}),
    ("SaaS <team@saas.io>", "Welcome to SaaS!", "Thanks for signing up. Here is how to get started. "
     "© 2026 SaaS Inc. All rights reserved. Unsubscribe", ("INBOX",), {"x-sg-eid": "abc"}),
])
def test_machine_sent_mail_is_rejected(from_, subject, body, labels, headers):
    assert not run(from_, subject, body, labels=labels, headers=headers).should_store


# --------------------------------------------------------------------------- genuine human mail passes

@pytest.mark.parametrize("from_,subject,body,headers,existing", [
    ("Priya <buyer.one@gmail.com>", "Requirement: Paper Dispensers",
     "Dear Sales Team, We have a requirement for paper dispensers and would like your recommendations. "
     "Quantity: approx. 50 units. Location: Chennai. Could you please share the available models, "
     "specifications and finishes (ABS)? Regards Priya", {"message-id": GMAIL_ID}, False),
    ("Priya <buyer.one@gmail.com>", "Re: Requirement: Paper Dispensers", "can i get information of dsdr0112?",
     {"message-id": GMAIL_ID}, True),
    ("Priya <buyer.one@gmail.com>", "Re: Requirement: Paper Dispensers", "i want to buy 20 qty",
     {"message-id": GMAIL_ID}, True),
    ("Priya <buyer.one@gmail.com>", "Re: Requirement: Paper Dispensers", "Thanks a lot.", {}, True),
    ("Buyer <purchasing@buyer.com>", "Re: Quote for 500 units",
     "Hi, please confirm the invoice amount of 45,000 for 5000 units and verify the delivery date. Thanks, Ravi",
     {}, False),
    ("Ravi <ravi@buyer.com>", "Re: Quotation", "Just following up on my quotation request from last week - any update?",
     {"message-id": "<AB12@AM9PR01.prod.outlook.com>"}, True),
    ("Customer <customer@gmail.com>", "Enquiry", "Hello, do you have hand dryers in stock? Need 10.", {}, False),
    ("Asha <asha@client.com>", "Order enquiry", "Hi team, we want to order 200 soap dispensers. Please share price.",
     {"list-id": "<sales.example-business.com>", "precedence": "list", "x-google-group-id": "1234"}, False),
])
def test_genuine_human_mail_is_stored(from_, subject, body, headers, existing):
    res = run(from_, subject, body, headers=headers, existing=existing)
    assert res.should_store and res.category == EmailCategory.BUSINESS_CONVERSATION, res.reasons


def test_metadata_rejection_cannot_be_resurrected_by_inquiry_words():
    h = {"from": "Promo <deals@shop.com>", "subject": "Get a quote today - pricing inside"}
    meta = F.classify_metadata_sync(label_ids=["INBOX", "CATEGORY_PROMOTIONS"], headers=h, tenant_id="t")
    assert not meta.should_store
    res = F.classify_body(body_text="Please send us your enquiry for pricing", subject=h["subject"],
                          from_header=h["from"], metadata_result=meta)
    assert not res.should_store


def test_unclear_mail_is_left_for_the_second_opinion():
    res = run("Someone <someone@company.com>", "Document", "Attached.")
    assert res.category == EmailCategory.AMBIGUOUS


@pytest.mark.parametrize("addr,expected", [
    ("noreply@tm.openai.com", True), ("no-reply@x.com", True), ("do-not-reply@bank.com", True),
    ("MAILER-DAEMON@googlemail.com", True), ("bounces+123@sendgrid.net", True), ("jobs-noreply@linkedin.com", True),
    ("buyer.one@gmail.com", False),("sales@buyer.com", False), ("ravi.kumar@company.in", False),
])
def test_no_reply_addresses(addr, expected):
    assert ma.is_no_reply_address(addr) is expected


def test_second_opinion_fallbacks(monkeypatch):
    from app.services import gmail_sync, mail_human_check
    from app.services.email_filter import ClassificationResult, EmailDisposition

    unsure = ClassificationResult(category=EmailCategory.AMBIGUOUS,
                                  disposition=EmailDisposition.STORE_AND_RESOLVE_CONTEXT, confidence=0.5, score=0)
    risky = ClassificationResult(category=EmailCategory.AMBIGUOUS,
                                 disposition=EmailDisposition.STORE_AND_RESOLVE_CONTEXT, confidence=0.5, score=30)

    for verdict, base, stored in ((True, risky, True), (False, unsure, False), (None, unsure, True), (None, risky, False)):
        async def fake(*a, _v=verdict, **k):
            return _v
        monkeypatch.setattr(mail_human_check, "is_human_business_mail", fake)
        res = asyncio.run(gmail_sync._second_opinion(base, "a@b.com", "s", "b"))
        assert res.should_store is stored, (verdict, base.score)


# --------------------------------------------------------------------------- legacy golden dataset (generic senders)

GOLDEN = [
    ("Job Alerts <jobalerts-noreply@linkedin.com>", "30+ new jobs in Bengaluru",
     "Your daily job alert. Click here to unsubscribe or manage preferences.", EmailCategory.PROMOTIONAL_BULK, False),
    ("Indeed <donotreply@jobalert.indeed.com>", "Senior Python Engineer jobs",
     "View new job opportunities. To opt-out click unsubscribe.", EmailCategory.PROMOTIONAL_BULK, False),
    ("Quora Digest <english-quora-digest@quora.com>", "What are top python libraries?",
     "Here are top stories for you. Manage your email preferences or unsubscribe.", EmailCategory.PROMOTIONAL_BULK, False),
    ("Neon <changelog@neon.tech>", "Neon Changelog: Serverless Postgres updates",
     "Read the latest release notes. You received this newsletter from Neon. Unsubscribe.", EmailCategory.PROMOTIONAL_BULK, False),
    ("ProPeers <no-reply@propeers.in>", "FREE Masterclass: System Design Live Tomorrow!",
     "Reserve your spot now. Limited seats available! Unsubscribe here.", EmailCategory.PROMOTIONAL_BULK, False),
    ("ProPeers <no-reply@propeers.in>", "Final Call: 50% discount ends tonight!",
     "Exclusive offer on our bootcamp. Shop now or view in browser. Click to unsubscribe.", EmailCategory.PROMOTIONAL_BULK, False),
    ("Shiprocket <info@net.shiprocket.in>", "Your package has been dispatched via Shiprocket",
     "Your order #849204 has shipped and is out for delivery.", EmailCategory.NON_CONVERSATIONAL_NOTIFICATION, False),
    ("The Derma Co <no-reply@thedermaco.com>", "Order #48291 confirmed",
     "Thank you for shopping with us! Your order #48291 has been placed.", EmailCategory.NON_CONVERSATIONAL_NOTIFICATION, False),
    ("Cursor Team <grok-bot@mail.cursor.com>", "Your Fast Request quota has been reset",
     "This is an automated notification that your monthly request limits have been reset.",
     EmailCategory.NON_CONVERSATIONAL_NOTIFICATION, False),
    ("Bank of Baroda <estatement@bankofbaroda.bank.in>", "e-Statement for your Account XXXX1234",
     "Dear Customer, please find attached your monthly bank statement.", EmailCategory.SECURITY_OR_FINANCIAL_NOTICE, False),
    ("Heroku Security <bot@notifications.heroku.com>", "Multi-factor authentication enabled on your account",
     "This is a security alert. If you did not initiate this change, please reset your password.",
     EmailCategory.SECURITY_OR_FINANCIAL_NOTICE, False),
    ("Customer A <customer.a@gmail.com>", "Need catalogue and pricing",
     "Hi team, please share me your product catalogue and price list for bulk wholesale orders. Thanks",
     EmailCategory.BUSINESS_CONVERSATION, True),
    ("Buyer Corp <purchasing@buyer.com>", "Re: Quote for 500 units",
     "Thank you for the update, we are ready to proceed with the purchase order.", EmailCategory.BUSINESS_CONVERSATION, True),
    ("Customer B <customer.b@gmail.com>", "Enquiry", "Hyyy", EmailCategory.BUSINESS_CONVERSATION, True),
    ("Customer B <customer.b@gmail.com>", "Hello", "Helloooooooo, is someone available to discuss pricing?",
     EmailCategory.BUSINESS_CONVERSATION, True),
]


@pytest.mark.parametrize("from_,subject,body,category,stored", GOLDEN)
def test_legacy_golden_dataset_still_holds(from_, subject, body, category, stored):
    """Same calls as the legacy golden test: metadata stage, then body stage without extra arguments."""
    h = {"from": from_, "subject": subject}
    meta = F.classify_metadata_sync(label_ids=["INBOX"], headers=h, tenant_id="t")
    res = F.classify_body(body_text=body, subject=subject, from_header=from_, metadata_result=meta)
    assert (res.category, res.should_store) == (category, stored), res.reasons


def test_out_of_office_is_an_automated_reply():
    h = {"from": "colleague@partner.com", "subject": "Automatic reply: Out of office", "auto-submitted": "auto-replied"}
    meta = F.classify_metadata_sync(label_ids=["INBOX"], headers=h, tenant_id="t")
    assert meta.category == EmailCategory.AUTOMATED_REPLY and not meta.should_store
