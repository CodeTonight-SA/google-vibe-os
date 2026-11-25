"""The website's privacy promises stay true as the pages change.

A forward anchor (google-vibe-os#33, from the council's review of #32): it
passes on today's pages and fails if an edit drops a promise that CodeTonight
never receives the user's Google data, or adds a sentence claiming that it does.
"""

import html
import re
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / "site"


def _text(page: str) -> str:
    raw = (SITE / page).read_text(encoding="utf-8")
    raw = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", raw)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", raw)))


PRIVACY_PROMISES = [
    "CodeTonight runs no server that receives your Google data",
    "it is not sent to CodeTonight",
    "CodeTonight does not receive this data",
    "No person at CodeTonight reads your Google data",
]

# Affirmative claims that would contradict those promises.
CONTRADICTIONS = re.compile(
    r"(?i)\b(?:(?<!not )sent to (?:CodeTonight|our servers?)|(?<!not )stored on (?:CodeTonight's|our) servers?"
    r"|CodeTonight (?:stores|collects|receives) your|we (?:store|collect|keep) your (?:Google|mail|email))"
)


def test_the_privacy_page_keeps_every_promise():
    text = _text("privacy.html")
    for promise in PRIVACY_PROMISES:
        assert promise in text, f"the privacy page lost: {promise!r}"


def test_the_home_page_keeps_its_promise():
    assert "No CodeTonight server sees your data" in _text("index.html")


def test_no_page_claims_that_codetonight_receives_the_data():
    for page in ("privacy.html", "index.html"):
        found = CONTRADICTIONS.findall(_text(page))
        assert not found, f"{page} now says {found}"


def test_the_contradiction_check_catches_a_planted_claim():
    # The check must be able to fail: a planted affirmative claim is found.
    planted = "Your mail is sent to CodeTonight for processing."
    assert CONTRADICTIONS.search(planted)
    assert not CONTRADICTIONS.search("it is not sent to CodeTonight")
