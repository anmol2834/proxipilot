"""Reciprocal Rank Fusion: ranks, not raw (incomparable) scores, decide relevance."""
from app.services.retrieval_router.rank_fusion import RRF_K, ranked_ids, reciprocal_rank_fusion


def test_agreement_beats_a_single_list_winner():
    # "electric kettle for guest rooms": the lexical list's #1 is an intercom (rare words
    # "guest room"); kettles are top of the semantic list and also present lexically.
    semantic = ["kettle_a", "kettle_b", "kettle_c"]
    lexical = ["intercom", "kettle_b", "kettle_a"]
    f = reciprocal_rank_fusion([semantic, lexical])
    assert f["kettle_a"] > f["intercom"] and f["kettle_b"] > f["intercom"]
    assert max(f, key=f.get) in ("kettle_a", "kettle_b")


def test_normalised_and_bounded():
    f = reciprocal_rank_fusion([["x", "y"], ["x"]])
    assert f["x"] == 1.0                       # rank 1 in every list = best achievable
    assert 0 < f["y"] < 0.5
    assert reciprocal_rank_fusion([]) == {} and reciprocal_rank_fusion([[], []]) == {}


def test_single_list_and_duplicates():
    f = reciprocal_rank_fusion([["a", "a", "b"]])
    assert f["a"] == 1.0 and f["b"] == (1 / (RRF_K + 2)) / (1 / (RRF_K + 1))


def test_ranked_ids_orders_by_score_desc():
    assert ranked_ids([("a", 0.2), ("b", 0.9), ("c", None)]) == ["b", "a", "c"]


def test_weights_scale_a_lists_vote_and_stay_normalised():
    f = reciprocal_rank_fusion([["x"], ["x"]], weights=[1.0, 0.5])
    assert abs(f["x"] - 1.0) < 1e-12
    assert reciprocal_rank_fusion([["a"], ["b"]], weights=[1.0, 0.0]) == {"a": 1.0}


def test_blind_keyword_list_cannot_overturn_the_semantic_leader():
    # "small fridge for a hotel room": the catalogue never says "fridge", so the keyword list
    # ranks only "hotel room" items. One it shares with the semantic list's tail must not
    # beat the semantic #1 (the mini bar) through false "agreement".
    from app.services.retrieval_router.router import BLIND_LEXICAL_WEIGHT
    semantic = ["minibar_1", "minibar_2", "minibar_3"] + [f"x{i}" for i in range(12)] + ["room_dustbin"]
    lexical = ["note_pad", "room_dustbin", "intercom"]
    blind = reciprocal_rank_fusion([semantic, lexical], weights=[1.0, BLIND_LEXICAL_WEIGHT])
    assert max(blind, key=blind.get) == "minibar_1"
    # Same lists with a keyword branch that read every word: agreement does win (by design).
    full = reciprocal_rank_fusion([semantic, lexical])
    assert full["room_dustbin"] > full["minibar_1"]
