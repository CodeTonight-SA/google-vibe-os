"""The website's privacy promises stay true as the pages change.

A forward anchor (google-vibe-os#33, from the council's review of #32): it
passes on today's pages and fails if an edit drops a promise that CodeTonight
never receives the user's Google data, or adds a sentence saying that it does.
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

# A sentence contradicts the promises when it names CodeTonight (or "our
# servers"), the user's data, and a verb that moves or keeps it, with no
# negation. It is judged per sentence, so a contradiction is found whatever
# its wording (AGORA's first sitting on #43 showed a fixed phrase list missing
# "uploaded to CodeTonight" and flagging "never sent to CodeTonight").
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
_WHO = re.compile(r"(?i)\bCodeTonight\b|\bour servers?\b")
_WHAT = re.compile(r"(?i)\b(?:data|Gmail|mail|messages|calendar|Drive|files|tokens?)\b")
_MOVES = re.compile(
    r"(?i)\b(?:receiv\w*|stor(?:e|es|ed|ing)|collect\w*|upload\w*|sen(?:d|ds|t|ding)"
    r"|keeps?|kept|cop(?:y|ies|ied))\b")
_NEGATION = re.compile(r"(?i)\b(?:not|no|never|nothing|none|neither|nor|without)\b|n['’]t\b")


def contradictions(text: str) -> list:
    """Sentences that say CodeTonight receives, keeps or moves the user's data."""
    return [s for s in _SENTENCE_END.split(text)
            if _WHO.search(s) and _WHAT.search(s) and _MOVES.search(s) and not _NEGATION.search(s)]


def test_the_privacy_page_keeps_every_promise():
    text = _text("privacy.html")
    for promise in PRIVACY_PROMISES:
        assert promise in text, f"the privacy page lost: {promise!r}"


def test_the_home_page_keeps_its_promise():
    assert "No CodeTonight server sees your data" in _text("index.html")


def test_no_page_says_that_codetonight_receives_the_data():
    for page in ("privacy.html", "index.html"):
        found = contradictions(_text(page))
        assert not found, f"{page} now says {found}"


def test_the_check_catches_a_contradiction_in_any_wording():
    for claim in (
        "Your mail is uploaded to CodeTonight.",
        "CodeTonight receives the data.",
        "CodeTonight’s servers store your Gmail messages.",
        "Your data is sent to CodeTonight for processing.",
    ):
        assert contradictions(claim), claim


def test_the_check_leaves_a_denial_alone():
    for denial in (
        "It is not sent to CodeTonight.",
        "Your data is never sent to CodeTonight.",
        "No data is sent to CodeTonight.",
        "CodeTonight runs no server that receives your Google data.",
        "CodeTonight doesn’t store your mail.",
    ):
        assert not contradictions(denial), denial
