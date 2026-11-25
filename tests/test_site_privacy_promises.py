"""What the website says about CodeTonight and the user's data stays reviewed.

Every sentence on the two pages that mentions CodeTonight (or "we", "us",
"our") together with the user's data must match the reviewed list below, word
for word. A new, changed or removed sentence fails the test until a person
reads it and updates REVIEWED. This replaces a word-pattern tripwire that each
review found a new way past (google-vibe-os#43, #45): a list does not have to
guess what a sentence means.
"""

import html
import re
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / "site"

_BLOCK_END = re.compile(
    r"(?i)</(?:p|h[1-6]|li|div|section|header|footer|td|th|dt|dd|blockquote|summary|button|form|label)>"
    r"|<br\s*/?>")
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
_WHO = re.compile(r"(?i)\b(?:CodeTonight|we|us|our)\b")
_WHAT = re.compile(r"(?i)\b(?:data|Gmail|mail|e-?mails?|messages|calendar|Drive|files|tokens?|information)\b")

REVIEWED = {
    "privacy.html": [
        "CodeTonight runs no server that receives your Google data, and never receives your sign-in tokens.",
        "The app fetches your Google data from Google straight to your Mac; it is not sent to CodeTonight.",
        "CodeTonight does not receive this data.",
        "We use your Google data only to provide the features you see in the app.",
        "We do not sell it, transfer it to advertising platforms or data brokers, or use it for advertising.",
        "No person at CodeTonight reads your Google data.",
        "When you join the beta on this website, the name and email address you type, and anything you write "
        "in the optional box, are sent to Formspree, a form service, which passes them to CodeTonight.",
        "To have your beta sign-up deleted, email us at the contact address below.",
    ],
    "index.html": [
        "No CodeTonight server sees your data.",
        "Leave your name and email, and we will send you an invitation with the download and the sign-in steps.",
        "We use your email only to send your beta invitation.",
        "We will email your invitation.",
    ],
}


def sentences(raw: str) -> list:
    """The sentences of an HTML page; a block-level tag also ends a sentence."""
    raw = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", raw)
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", _BLOCK_END.sub("\x00", raw))))
    return [s.strip() for block in text.split("\x00") for s in _SENTENCE_END.split(block) if s.strip()]


def data_sentences(raw: str) -> list:
    """Sentences that mention CodeTonight (or we, us, our) and the user's data."""
    return [s for s in sentences(raw) if _WHO.search(s) and _WHAT.search(s)]


def test_the_pages_say_exactly_the_reviewed_things_about_your_data():
    for page, reviewed in REVIEWED.items():
        found = data_sentences((SITE / page).read_text(encoding="utf-8"))
        added = [s for s in found if s not in reviewed]
        removed = [s for s in reviewed if s not in found]
        assert not added and not removed, (
            f"{page}: read these sentences about CodeTonight and your data, then update REVIEWED. "
            f"New or changed: {added}. Gone: {removed}.")


def test_a_new_statement_about_the_data_needs_review_whatever_its_wording():
    # Wordings the old pattern tripwire let through (google-vibe-os#43, #45).
    for claim in (
        "Your mail is uploaded to CodeTonight.",
        "CodeTonight stores your mail without encrypting it.",
        "Your data is not only stored by CodeTonight but also sold.",
        "We store your Gmail messages.",
        "CodeTonight’s servers keep copies of your emails.",
    ):
        assert data_sentences(f"<p>{claim}</p>") == [claim], claim


def test_a_heading_or_a_button_never_joins_the_next_sentence():
    raw = ("<h2>Join the beta</h2><p>We use your email only to send your beta invitation.</p>"
           "<form><button>Join the beta</button></form><p>We will email your invitation.</p>")
    assert data_sentences(raw) == [
        "We use your email only to send your beta invitation.", "We will email your invitation."]
