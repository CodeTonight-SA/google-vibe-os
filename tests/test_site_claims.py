from pathlib import Path

PAGE = Path(__file__).resolve().parents[1] / "site" / "index.html"


def page():
    return PAGE.read_text(encoding="utf-8")


def test_page_drops_the_mcp_server_claim():
    assert "built-in mcp servers" not in page().lower()


def test_page_drops_the_no_telemetry_claim():
    assert "no telemetry" not in page().lower()


def test_ai_card_is_the_optional_assistant():
    assert "Optional AI assistant" in page()


def test_privacy_card_names_no_codetonight_server():
    assert "No CodeTonight server sees your data" in page()


def test_setup_step_two_lists_all_four_apis():
    assert "Enable the Gmail, Calendar, Drive and Tasks APIs" in page()


def test_setup_readme_link_uses_the_accent_colour():
    assert 'README.md" style="color: var(--accent);">README</a>' in page()
