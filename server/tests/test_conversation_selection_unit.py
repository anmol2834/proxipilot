"""Conversation selection: which presented item the customer chose (pure logic, any business)."""

from app.services.conversation_selection import PresentedItem, match_presented_item, resolve_selection

# A generic presented list (any domain): options share their family words.
ITEMS = [
    PresentedItem("e1", "DAHD0001", "Automatic Industrial Jet Hand Dryer Silver 1800W"),
    PresentedItem("e2", "DAHD0002", "Black ABS Jet Hand Dryer Brushless Motor"),
    PresentedItem("e3", "DAHD0003", "Mini High Speed Hand Dryer With Brushless Motor"),
]
LAPTOPS = [
    PresentedItem("l1", "LT-100", "ProBook 14 Intel i5 16GB 512GB SSD"),
    PresentedItem("l2", "LT-200", "ProBook 15 Intel i7 16GB 1TB SSD"),
]


def test_selection_by_distinguishing_words():
    assert match_presented_item("Okay so i want automatic industrial jet hand dryer.", ITEMS).entity_id == "e1"
    assert match_presented_item("I'll take the black ABS one", ITEMS).entity_id == "e2"
    assert match_presented_item("the i7 15 inch probook please", LAPTOPS).entity_id == "l2"


def test_family_words_alone_select_nothing():
    assert match_presented_item("Do you have more hand dryers?", ITEMS) is None
    assert match_presented_item("I want a jet hand dryer", ITEMS) is None


def test_ambiguous_mentions_select_nothing():
    # "brushless motor" is shared by two options: not a selection.
    assert match_presented_item("the brushless motor one", ITEMS) is None


def test_exact_code_selects():
    assert match_presented_item("Please quote DAHD0003 for 10 units", ITEMS).entity_id == "e3"


def test_selection_persists_across_follow_ups():
    msgs = ["Inquiry about 1800W jet hand dryers", "Okay so i want automatic industrial jet hand dryer.",
            "Now tell me how can i place the order?", "I want 5 qty and best discount also."]
    sel = resolve_selection(msgs, ITEMS)
    assert sel.item.entity_id == "e1" and sel.named_in_current is False


def test_changing_the_selection():
    msgs = ["I want automatic industrial jet hand dryer", "Actually make it the mini high speed one"]
    assert resolve_selection(msgs, ITEMS).item.entity_id == "e3"


def test_asking_for_alternatives_clears_selection_unless_item_named():
    msgs = ["I want automatic industrial jet hand dryer", "Can you show me some other options?"]
    assert resolve_selection(msgs, ITEMS, current_requests_alternatives=True) is None
    msgs = ["show me hand dryers", "Okay so i want automatic industrial jet hand dryer."]
    sel = resolve_selection(msgs, ITEMS, current_requests_alternatives=True)  # planner misread as more-options
    assert sel.item.entity_id == "e1" and sel.named_in_current


def test_no_presented_items_no_selection():
    assert resolve_selection(["I want the silver one"], []) is None
