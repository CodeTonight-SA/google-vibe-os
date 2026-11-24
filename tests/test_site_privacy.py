from html.parser import HTMLParser
from pathlib import Path
import re

import pytest


PAGE = Path(__file__).resolve().parents[1] / "site" / "privacy.html"


def collapse(text):
    return " ".join(text.split())


class PrivacyParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text = []
        self.elements = []
        self.links = []
        self.open_elements = []
        self.open_links = []
        self.ignored = []

    def handle_starttag(self, tag, attrs):
        if tag in {"style", "script"}:
            self.ignored.append(tag)
        if self.ignored:
            return
        if tag in {"h1", "p", "li"}:
            self.open_elements.append((tag, []))
        if tag == "a":
            self.open_links.append((dict(attrs).get("href", ""), []))

    def handle_endtag(self, tag):
        if self.ignored:
            if tag == self.ignored[-1]:
                self.ignored.pop()
            return
        for index in range(len(self.open_elements) - 1, -1, -1):
            if self.open_elements[index][0] == tag:
                name, chunks = self.open_elements.pop(index)
                self.elements.append((name, collapse("".join(chunks))))
                break
        if tag == "a" and self.open_links:
            href, chunks = self.open_links.pop()
            self.links.append((href, collapse("".join(chunks))))

    def handle_data(self, data):
        if self.ignored:
            return
        self.text.append(data)
        for _, chunks in self.open_elements + self.open_links:
            chunks.append(data)


@pytest.fixture(scope="module")
def page():
    source = PAGE.read_text(encoding="utf-8")
    parser = PrivacyParser()
    parser.feed(source)
    parser.close()
    parser.visible = collapse("".join(parser.text))
    parser.raw = collapse(source)
    return parser


def test_limited_use_disclosure(page):
    assert "including the Limited Use requirements" in page.visible, "Missing Limited Use disclosure"
    assert ("https://developers.google.com/terms/api-services-user-data-policy", "Google User Data Policy") in page.links, "Missing Google User Data Policy link"


def test_date_and_page_frame(page):
    assert "Last updated: 24 November 2026" in page.visible, "Missing updated policy date"
    assert all("26 December 2025" not in text for text in (page.visible, page.raw)), "Old policy date remains"
    assert ("h1", "Privacy Policy") in page.elements, "Missing Privacy Policy heading"
    assert any(href == "/" and "Back to Googol Vibe" in text for href, text in page.links), "Missing back link"
    assert any(href == "https://codetonight.co.za" for href, _ in page.links), "Missing footer link"


def test_google_services_and_access(page):
    for service in ("Gmail", "Google Calendar", "Google Drive", "Google Tasks"):
        assert service in page.visible, f"Missing {service} disclosure"
    assert "read-only" in page.visible, "Missing read-only access disclosure"
    assert any(tag == "li" and "Gmail" in text and "read-only" in text for tag, text in page.elements), "Missing Gmail read-only item"
    assert any(tag == "li" and "Google Tasks" in text and "read and write" in text for tag, text in page.elements), "Missing Google Tasks read and write item"


def test_third_parties_named(page):
    for service in ("Formspree", "Anthropic", "Sentry"):
        assert service in page.visible, f"Missing {service} disclosure"


def test_ai_training_statement(page):
    statements = [text for tag, text in page.elements if tag in {"p", "li"} and ("artificial intelligence" in text or "machine learning" in text)]
    assert statements, "Missing AI training statement"
    assert any(re.search(r"\btrain\b", text) and re.search(r"\bnot\b", text) for text in statements), "Missing explicit denial of AI training"


def test_choices_and_contact(page):
    assert any(href.startswith("https://myaccount.google.com/permissions") for href, _ in page.links), "Missing Google access removal link"
    addresses = {href[len("mailto:"):].split("?", 1)[0] for href, _ in page.links if href.startswith("mailto:")}
    assert len(addresses) == 1, "Missing single contact email address"
    assert re.fullmatch(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", next(iter(addresses))), "Missing valid contact email address"


def test_old_claims_removed(page):
    for claim in (
        "nothing to delete",
        "You control the OAuth application",
        "We do not collect, store, or transmit your personal data",
        "OAuth 2.0 credentials that you create in your own Google Cloud project",
    ):
        assert all(claim not in text for text in (page.visible, page.raw)), f"Obsolete claim remains: {claim}"
