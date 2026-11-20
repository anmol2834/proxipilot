"""Follow-up calendar arithmetic: exact UTC instants, DST, workweek, advance notice, ambiguity.

Pure functions, frozen clocks; no database, no model, no provider.
"""

from datetime import date, datetime, time, timezone

import pytest

from app.services.followups import timing as tm
from app.services.followups.contracts import Timing

UTC = timezone.utc
IST = tm.resolve_zone("Asia/Kolkata")
CAL = tm.Calendar(zone=IST)                      # Mon-Fri, 10:00 default, 09:00-18:00 window
CADENCE = {"hot": 1, "warm": 3, "cold": 7, "unknown": 3}


def utc(*a):
    return datetime(*a, tzinfo=UTC)


# ---------------------------------------------------------------- time zones
@pytest.mark.parametrize("raw,expected", [
    ("Asia/Kolkata", "Asia/Kolkata"),
    ("Asia/Kolkata (GMT +5:30)", "Asia/Kolkata"),          # legacy workspace value
    ("  Europe/London ", "Europe/London"),
    ("IST", "Asia/Kolkata"),
    ("GMT+5:30", "UTC+05:30"),
    ("UTC-04:00", "UTC-04:00"),
    ("+05:45", "UTC+05:45"),
    ("GMT", "GMT"),                                         # a valid IANA zone itself
    ("Z", "UTC"),
])
def test_zone_normalisation(raw, expected):
    assert tm.resolve_zone(raw).name == expected


@pytest.mark.parametrize("raw", ["CST", "Mars/Olympus", "", None, "sometime"])
def test_ambiguous_or_unknown_zones_are_not_guessed(raw):
    assert tm.resolve_zone(raw) is None


def test_tenant_zone_falls_back_to_documented_default():
    assert tm.tenant_zone(None, "garbage").name == "Asia/Kolkata"
    assert tm.tenant_zone("Asia/Kolkata (GMT +5:30)").name == "Asia/Kolkata"


# ---------------------------------------------------------------- DST
def test_dst_gap_moves_forward_by_the_gap():
    ny = tm.resolve_zone("America/New_York")
    inst, note = tm.local_instant(date(2026, 3, 8), time(2, 30), ny)   # 02:30 does not exist
    assert note == "dst_gap_shifted" and inst == utc(2026, 3, 8, 7, 30)   # = 03:30 EDT


def test_dst_fold_takes_first_occurrence():
    ny = tm.resolve_zone("America/New_York")
    inst, note = tm.local_instant(date(2026, 11, 1), time(1, 30), ny)  # 01:30 happens twice
    assert note == "dst_fold_first" and inst == utc(2026, 11, 1, 5, 30)  # = 01:30 EDT


def test_normal_wall_time_has_no_note():
    inst, note = tm.local_instant(date(2026, 12, 15), time(15, 0), IST)
    assert note is None and inst == utc(2026, 12, 15, 9, 30)


# ---------------------------------------------------------------- Kavya worked example
def test_kavya_due_and_advance_notice_exact_instants():
    t = Timing(kind="customer_commitment", local_date=date(2026, 12, 15), local_time=time(15, 0),
               timezone="IST", precision="instant", phrase="15 December 2026 ... 3 PM IST")
    sent = utc(2026, 12, 1, 6, 0)                         # Tue 1 Dec, 11:30 IST
    res = tm.resolve_due(t, cal=CAL, anchor=sent, now=sent, decision="schedule", temperature="hot",
                         cadence_days=CADENCE)
    assert res.due_at == utc(2026, 12, 15, 9, 30) and res.source == "customer_date" and res.external_ok
    assert res.precision == "instant" and res.zone_name == "Asia/Kolkata"
    notice, mode = tm.compute_notice(res.due_at, cal=CAL, notice_days=1, now=sent)
    assert mode == "advance" and notice == utc(2026, 12, 14, 4, 30)      # Mon 14 Dec 10:00 IST
    assert notice.astimezone(IST.tz).strftime("%a %H:%M") == "Mon 10:00"


def test_kavya_reschedule_to_jan_8_same_time():
    t = Timing(kind="customer_commitment", local_date=date(2027, 1, 8), local_time=time(15, 0), timezone="IST",
               precision="instant")
    now = utc(2026, 12, 3, 6, 0)
    res = tm.resolve_due(t, cal=CAL, anchor=now, now=now, decision="schedule", temperature="hot", cadence_days=CADENCE)
    assert res.due_at == utc(2027, 1, 8, 9, 30)
    notice, mode = tm.compute_notice(res.due_at, cal=CAL, notice_days=1, now=now)
    assert notice == utc(2027, 1, 7, 4, 30) and mode == "advance"              # Thu 7 Jan 10:00 IST


def test_notice_inside_window_is_sent_once_now():
    now = utc(2026, 12, 14, 8, 0)                       # Mon 13:30 IST, after the 10:00 notice slot
    notice, mode = tm.compute_notice(utc(2026, 12, 15, 9, 30), cal=CAL, notice_days=1, now=now)
    assert mode == "timely" and notice == now


def test_notice_merges_when_it_would_not_precede_due():
    due, _ = tm.local_instant(date(2026, 12, 15), time(9, 0), IST)
    now = utc(2026, 12, 1)
    assert tm.compute_notice(due, cal=CAL, notice_days=0, now=now) == (None, "merged")
    assert tm.compute_notice(utc(2026, 11, 30), cal=CAL, notice_days=1, now=now) == (None, "merged")  # past due


def test_monday_due_notice_lands_on_previous_friday():
    due, _ = tm.local_instant(date(2026, 12, 14), time(15, 0), IST)    # Monday
    notice, mode = tm.compute_notice(due, cal=CAL, notice_days=1, now=utc(2026, 12, 1))
    assert notice.astimezone(IST.tz).date() == date(2026, 12, 11) and mode == "advance"   # Friday


# ---------------------------------------------------------------- workweek & cadence
def test_customer_promised_weekend_date_is_not_silently_moved():
    t = Timing(kind="customer_commitment", local_date=date(2026, 12, 19), local_time=None, precision="date")  # Sat
    now = utc(2026, 12, 14)
    res = tm.resolve_due(t, cal=CAL, anchor=now, now=now, decision="schedule", temperature="warm", cadence_days=CADENCE)
    assert res.due_at.astimezone(IST.tz).date() == date(2026, 12, 19)
    assert "non_workday_kept" in res.notes and "default_local_time" in res.notes
    assert res.due_at.astimezone(IST.tz).time() == time(10, 0)


def test_ai_window_on_weekend_moves_to_next_workday():
    t = Timing(kind="ai_window", local_date=date(2026, 12, 19), precision="window")
    now = utc(2026, 12, 14)
    res = tm.resolve_due(t, cal=CAL, anchor=now, now=now, decision="defer", temperature="warm", cadence_days=CADENCE)
    assert res.due_at.astimezone(IST.tz).date() == date(2026, 12, 21) and "moved_to_workday" in res.notes


@pytest.mark.parametrize("temp,expected_day", [("hot", 21), ("warm", 23), ("cold", 29)])
def test_cadence_counts_business_days(temp, expected_day):
    sent = utc(2026, 12, 18, 6, 0)                      # Friday
    res = tm.resolve_due(Timing(kind="cadence"), cal=CAL, anchor=sent, now=sent, decision="schedule",
                         temperature=temp, cadence_days=CADENCE)
    assert res.source == "cadence" and res.due_at.astimezone(IST.tz).date() == date(2026, 12, expected_day)


def test_cadence_never_lands_in_the_past_after_downtime():
    sent = utc(2026, 12, 1, 6, 0)
    now = utc(2026, 12, 20, 6, 0)                       # processed 19 days late (Sunday)
    res = tm.resolve_due(Timing(kind="cadence"), cal=CAL, anchor=sent, now=now, decision="schedule",
                         temperature="hot", cadence_days=CADENCE)
    assert res.due_at > now and "rolled_forward" in res.notes
    assert res.due_at.astimezone(IST.tz).date() == date(2026, 12, 21)


def test_no_decision_no_timing_means_no_due():
    sent = utc(2026, 12, 1)
    res = tm.resolve_due(Timing(kind="none"), cal=CAL, anchor=sent, now=sent, decision="none", temperature="hot",
                         cadence_days=CADENCE)
    assert res.due_at is None                            # a Hot label alone never schedules


# ---------------------------------------------------------------- ambiguity & safety
def test_ambiguous_numeric_date_holds_with_alternatives():
    t = Timing(kind="customer_commitment", phrase="around 03/04", ambiguous=True,
               alternatives=["2027-03-04", "2027-04-03"])
    now = utc(2026, 12, 1)
    res = tm.resolve_due(t, cal=CAL, anchor=now, now=now, decision="schedule", temperature="warm", cadence_days=CADENCE)
    assert res.due_at is None and not res.external_ok and res.review_reason == "ambiguous_date"
    assert res.alternatives == ["2027-03-04", "2027-04-03"]


def test_unrecognised_stated_zone_holds_external_contact():
    t = Timing(kind="customer_request", local_date=date(2026, 12, 15), local_time=time(15, 0), timezone="CST")
    now = utc(2026, 12, 1)
    res = tm.resolve_due(t, cal=CAL, anchor=now, now=now, decision="schedule", temperature="hot", cadence_days=CADENCE)
    assert res.due_at is not None and not res.external_ok and res.review_reason == "unrecognized_timezone"


def test_customer_stated_zone_wins_over_tenant_zone():
    t = Timing(kind="customer_request", local_date=date(2026, 12, 15), local_time=time(15, 0),
               timezone="Europe/London")
    now = utc(2026, 12, 1)
    res = tm.resolve_due(t, cal=CAL, anchor=now, now=now, decision="schedule", temperature="hot", cadence_days=CADENCE)
    assert res.due_at == utc(2026, 12, 15, 15, 0) and res.zone_name == "Europe/London"


def test_date_in_the_past_requires_review():
    t = Timing(kind="customer_commitment", local_date=date(2026, 11, 1))
    now = utc(2026, 12, 1)
    res = tm.resolve_due(t, cal=CAL, anchor=now, now=now, decision="schedule", temperature="hot", cadence_days=CADENCE)
    assert not res.external_ok and res.review_reason in ("date_before_message", "date_in_past")


def test_send_window():
    assert tm.in_send_window(utc(2026, 12, 15, 9, 30), CAL)            # Tue 15:00 IST
    assert not tm.in_send_window(utc(2026, 12, 15, 14, 0), CAL)        # Tue 19:30 IST
    assert not tm.in_send_window(utc(2026, 12, 19, 6, 0), CAL)         # Saturday
    assert tm.next_send_window(utc(2026, 12, 18, 14, 0), CAL) == utc(2026, 12, 21, 3, 30)  # Mon 09:00 IST
