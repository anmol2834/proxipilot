"""Catalogue-level counts quoted from the verified catalogue overview are grounded claims.

Production case (2026-11-14): "How many products do you have?" -> the draft said "5,103 unique
products across 140 categories" (both numbers from the live catalogue overview), yet validation
failed with UNGROUNDED_CLAIM, forcing a redraft (~5 s) and human review.
"""

from app.contracts.evidence_package import MinimalEvidencePackage, PackageStatus
from app.contracts.reply_planner import ClaimEvidenceMapping, GroundingType, StructuredReplyDraft
from app.services.reply_planner.validator import DeterministicReplyValidator, _numbers_grounded_in

OVERVIEW = (
    "- Active products in the official catalogue (unique product codes): 5,103\n"
    "- Main brands: DOLPHY INDIA PVT LTD. (4,502), DOLPHIN E-COMMERCE (471), MARZEL (125)\n"
    "- Product categories (140 in total; largest first): Spare Parts (1,795), Hand Dryer (75)\n"
    '- Exact number of catalogue items matching "air curtain": 40'
)


def _draft(*claims: str) -> StructuredReplyDraft:
    return StructuredReplyDraft(
        subject="Re: Enquiry", body_text="Hi,\n\n" + " ".join(claims), body_html="<p>x</p>",
        claims=[ClaimEvidenceMapping(claim_statement=c, grounding_type=GroundingType.FACT) for c in claims],
    )


def _package() -> MinimalEvidencePackage:
    return MinimalEvidencePackage(
        tenant_id="org_t", thread_id="thr", message_id="msg", context_revision=1, fusion_id="fus",
        package_status=PackageStatus.NO_EVIDENCE, requirements=[],
    )


def _ungrounded(report) -> list:
    return [i for i in report.issues if i.issue_code == "UNGROUNDED_CLAIM"]


def test_production_case_counts_from_overview_pass():
    draft = _draft("The official product catalogue currently lists 5,103 unique products.",
                   "We offer products across 140 product categories.")
    report, _ = DeterministicReplyValidator().validate_draft(draft, _package(), verified_context=OVERVIEW)
    assert not _ungrounded(report)
    assert all(c.is_verified for c in draft.claims)


def test_without_overview_the_same_claim_is_still_rejected():
    report, _ = DeterministicReplyValidator().validate_draft(
        _draft("The official product catalogue currently lists 5,103 unique products."), _package())
    assert _ungrounded(report)


def test_invented_number_is_rejected_even_with_overview():
    report, _ = DeterministicReplyValidator().validate_draft(
        _draft("The official product catalogue currently lists 6,000 unique products."),
        _package(), verified_context=OVERVIEW)
    assert _ungrounded(report)


def test_helper_rules():
    assert _numbers_grounded_in("We have 40 air curtain models", OVERVIEW)
    assert _numbers_grounded_in("Hand dryers: 75 models; 5103 products overall", OVERVIEW)  # separators ignored
    assert not _numbers_grounded_in("We have 41 air curtain models", OVERVIEW)               # one wrong number
    assert not _numbers_grounded_in("Each unit costs ₹40", OVERVIEW)                          # money never from counts
    assert not _numbers_grounded_in("The price is 75 rupees", OVERVIEW)
    assert not _numbers_grounded_in("We stock many products", OVERVIEW)                       # no number, no proof
    assert not _numbers_grounded_in("5,103 products", "")
