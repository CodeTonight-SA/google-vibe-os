"""What the website says about the user's data stays reviewed.

Every sentence on every page in site/ that mentions the user's data (mail,
calendar, files, tokens and the like) must match the reviewed list below, word
for word, whoever it names as the subject. A new, changed or removed sentence,
or a new page, fails the test until a person reads it and updates REVIEWED; the
failure prints the sentences found, ready to paste. This replaces a word-pattern
tripwire that each review found a new way past (google-vibe-os#43, #45, #47): a
list does not have to guess what a sentence means.
"""

import html
import re
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / "site"

# A block-level tag ends a sentence. <br> does not: it can sit mid-sentence.
_BLOCK_END = re.compile(
    r"(?i)</(?:p|h[1-6]|li|div|section|header|footer|td|th|dt|dd|blockquote|summary|button|form|label)>")
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
_WHAT = re.compile(r"(?i)\b(?:data|Gmail|mail|e-?mails?|messages|calendar|Drive|files|tokens?|information)\b")

REVIEWED = {
    "index.html": [
        'A premium desktop dashboard that brings Gmail, Calendar, Drive & Tasks together in one '
        'beautiful interface.',
        'Gmail, Calendar, Drive, and Tasks in one cohesive interface.',
        'Ask about your mail, calendar, files and tasks with your own Anthropic API key.',
        'No CodeTonight server sees your data.',
        'Enable the Gmail, Calendar, Drive and Tasks APIs.',
        'Leave your name and email, and we will send you an invitation with the download and the '
        'sign-in steps.',
        'Email',
        'We use your email only to send your beta invitation.',
        'We will email your invitation.',
    ],
    "privacy.html": [
        'CodeTonight runs no server that receives your Google data, and never receives your sign-in tokens.',
        'Either way, your data goes directly between your Mac and Google.',
        'Your name, email address and profile picture, to show who is signed in.',
        'Gmail, Google Calendar and Google Drive: read-only.',
        'Where your data is kept',
        'The app fetches your Google data from Google straight to your Mac; it is not sent to CodeTonight.',
        'Your sign-in token is stored on your Mac in ~/.googol-vibe/tokens/, encrypted with the '
        'macOS keychain when it is available.',
        'Other files on your Mac:',
        'When you ask it something, your message and the Google data it fetches to answer (for '
        "example email text, calendar events, Drive file names and tasks) are sent to Anthropic's "
        "API under your own key, and Anthropic's terms apply to that data.",
        'CodeTonight does not receive this data.',
        'A report contains the error details, the app version and the operating system; the app '
        'removes email addresses, user names and network details before it sends one.',
        'Google API Services User Data Policy',
        'The use of information received from Google Workspace scopes will adhere to the Google '
        'User Data Policy, including the Limited Use requirements.',
        'We use your Google data only to provide the features you see in the app.',
        'We do not sell it, transfer it to advertising platforms or data brokers, or use it for advertising.',
        'No person at CodeTonight reads your Google data.',
        'When you join the beta on this website, the name and email address you type, and '
        'anything you write in the optional box, are sent to Formspree, a form service, which '
        'passes them to CodeTonight.',
        "Sign out in the app: this asks Google to end the app's access and deletes the token from your Mac.",
        'To have your beta sign-up deleted, email us at the contact address below.',
    ],
}


def sentences(raw: str) -> list:
    """The sentences of an HTML page as a reader sees them; a block-level tag also ends a sentence.

    A removed inline tag leaves a space, so a space before punctuation is dropped
    ("tokens/</code>, encrypted" reads "tokens/, encrypted", google-vibe-os#50).
    """
    raw = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", raw)
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", _BLOCK_END.sub("\x00", raw))))
    text = re.sub(r" ([,.;:!?])", r"\1", text)
    return [s.strip() for block in text.split("\x00") for s in _SENTENCE_END.split(block) if s.strip()]


def data_sentences(raw: str) -> list:
    """Sentences that mention the user's data, whatever their subject."""
    return [s for s in sentences(raw) if _WHAT.search(s)]


def test_every_page_has_a_reviewed_list():
    assert sorted(p.name for p in SITE.glob("*.html")) == sorted(REVIEWED), (
        "a page was added or removed in site/; give it a REVIEWED entry")


def test_the_pages_say_exactly_the_reviewed_things_about_your_data():
    for page, reviewed in REVIEWED.items():
        found = data_sentences((SITE / page).read_text(encoding="utf-8"))
        # Compared in page order and with repeats, so a duplicated, deleted or
        # moved sentence fails too (google-vibe-os#50).
        added = [s for s in found if s not in reviewed]
        removed = [s for s in reviewed if s not in found]
        assert found == reviewed, (
            f"{page}: read these sentences about your data, then update REVIEWED, in page order. "
            f"New or changed: {added}. Gone: {removed}. Everything found, to paste: {found}")


def test_a_removed_inline_tag_leaves_no_space_before_punctuation():
    assert sentences("<p>Kept in <code>~/x/</code>, encrypted.</p>") == ["Kept in ~/x/, encrypted."]


def test_a_new_statement_about_the_data_needs_review_whatever_its_wording():
    # Wordings the old pattern tripwire let through (google-vibe-os#43, #45, #47).
    for claim in (
        "Your mail is uploaded to CodeTonight.",
        "CodeTonight stores your mail without encrypting it.",
        "Your data is not only stored by CodeTonight but also sold.",
        "We store your Gmail messages.",
        "Your messages are uploaded to the company's servers.",
    ):
        assert data_sentences(f"<p>{claim}</p>") == [claim], claim
    assert data_sentences("<p>We store your<br>Gmail messages.</p>") == ["We store your Gmail messages."]


def test_a_heading_or_a_button_never_joins_the_next_sentence():
    raw = ("<h2>Join the beta</h2><p>We use your email only to send your beta invitation.</p>"
           "<form><button>Join the beta</button></form><p>We will email your invitation.</p>")
    assert data_sentences(raw) == [
        "We use your email only to send your beta invitation.", "We will email your invitation."]
