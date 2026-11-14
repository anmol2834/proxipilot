"""Unit tests for the lexical (keyword / SKU) retrieval branch — no network, no DB."""

import re

from app.services.retrieval_router.lexical_retriever import _singular, _word_pattern, tokenize_query


def _py(pattern: str) -> str:
    # PostgreSQL ARE word anchors -> Python regex word boundaries
    return pattern.replace(r"\m", r"\b").replace(r"\M", r"\b")


def test_customer_filler_words_are_dropped():
    toks = tokenize_query("Hi, do you sell grab bars? What is the price and availability please")
    assert toks == ["grab", "bar"]


def test_codes_kept_whole_and_split():
    toks = tokenize_query("price of DAHD63-MOTOR-PCB")
    assert toks[:4] == ["dahd63-motor-pcb", "dahd63", "motor", "pcb"]


def test_plural_folding_only_for_words():
    assert _singular("bars") == "bar"
    assert _singular("batteries") == "battery"
    assert _singular("brushes") == "brush"
    assert _singular("glass") == "glass"
    assert _singular("ss") == "ss"
    assert _singular("dahd0080s") == "dahd0080s"  # codes untouched


def test_patterns_prefix_for_long_tokens_whole_word_for_short():
    title = "dahd0080 sensor ss 1.6mm dahd63-motor-pcb grab bars"
    assert re.search(_py(_word_pattern("dahd")), title)        # partial model code
    assert re.search(_py(_word_pattern("bar")), title)         # singular matches plural
    assert re.search(_py(_word_pattern("dahd63-motor-pcb")), title)
    assert not re.search(_py(_word_pattern("s")), "glass")    # short token: whole word only
    assert not re.search(_py(_word_pattern("ar")), title)      # no mid-word matches


def test_regex_metacharacters_are_escaped():
    pat = _word_pattern("1.6mm")
    assert re.search(_py(pat), "thickness 1.6mm")
    assert not re.search(_py(pat), "thickness 1x6mm")


def test_plain_words_do_not_prefix_match_longer_words():
    # "dust" must not reach "dustbin", nor "out" reach "outdoor" (descriptive questions).
    assert not re.search(_py(_word_pattern("dust")), "outdoor dustbin 10l")
    assert not re.search(_py(_word_pattern("out")), "outdoor dustbin 10l")
    assert re.search(_py(_word_pattern("dust")), "dust buster mat")
    assert re.search(_py(_word_pattern("tile")), "carpet tiles")          # plural ending
    assert re.search(_py(_word_pattern("brush")), "toilet brushes")       # -es plural
    assert re.search(_py(_word_pattern("dahd")), "dahd0080 sensor")      # letters into model no.
    assert re.search(_py(_word_pattern("dsdr1")), "dsdr108 dryer")       # code token: prefix
