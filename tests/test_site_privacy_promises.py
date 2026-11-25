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

# A tripwire for the common wordings, not a proof. A statement (not a
# question) that mentions the user's data contradicts the promises when one of
# its clauses names CodeTonight (or "our servers") and a verb that moves, keeps
# or reads the data, with no negation in that clause. Clauses are judged one by
# one, so "not sold to advertisers, but uploaded to CodeTonight" is still found
# (AGORA's sittings on #43 found each of these wordings).
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
_CLAUSE_BREAK = re.compile(r"(?i)[;:]|,?\s+\b(?:but|and|while|whereas|however|although)\b")
_WHO = re.compile(r"(?i)\bCodeTonight\b|\bour servers?\b")
_WHAT = re.compile(r"(?i)\b(?:data|Gmail|mail|messages|calendar|Drive|files|tokens?)\b")
_MOVES = re.compile(
    r"(?i)\b(?:receiv\w*|stor(?:e|es|ed|ing)|collect\w*|upload\w*|sen(?:d|ds|t|ding)"
    r"|keeps?|kept|cop(?:y|ies|ied)|reads?|sees?|seen|views?|access\w*|process\w*"
    r"|shar(?:e|es|ed|ing))\b")
_NEGATION = re.compile(r"(?i)\b(?:not|no|never|nothing|none|neither|nor|without)\b|n['’]t\b")


def _admits(clause: str) -> bool:
    return bool(_WHO.search(clause) and _MOVES.search(clause) and not _NEGATION.search(clause))


def contradictions(text: str) -> list:
    """Statements that say CodeTonight receives, keeps or reads the user's data."""
    return [s for s in _SENTENCE_END.split(text)
            if not s.rstrip().endswith("?") and _WHAT.search(s)
            and any(_admits(clause) for clause in _CLAUSE_BREAK.split(s))]


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
        "Your data is not sold to advertisers, but it is uploaded to CodeTonight.",
        "CodeTonight reads your mail to rank it.",
    ):
        assert contradictions(claim), claim


def test_the_check_leaves_a_denial_alone():
    for denial in (
        "It is not sent to CodeTonight.",
        "Your data is never sent to CodeTonight.",
        "No data is sent to CodeTonight.",
        "CodeTonight runs no server that receives your Google data.",
        "CodeTonight doesn’t store your mail.",
        "Is my data sent to CodeTonight? No.",
        "No person at CodeTonight reads your Google data.",
    ):
        assert not contradictions(denial), denial
