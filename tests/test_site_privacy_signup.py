from pathlib import Path


PAGE = (Path(__file__).resolve().parents[1] / "site" / "privacy.html").read_text(encoding="utf-8")


def test_signup_sentence_names_the_website():
    assert "When you join the beta on this website" in PAGE


def test_signup_sentence_does_not_name_the_app():
    assert "or in the app" not in PAGE
