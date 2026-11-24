import re
from pathlib import Path


PAGE = (Path(__file__).resolve().parents[1] / "site" / "index.html").read_text()


def test_beta_section_has_form_and_privacy_link():
    section = re.search(r"<section\b[^>]*\bid\s*=\s*(['\"])beta\1[^>]*>.*?</section>", PAGE, re.S)
    assert section is not None
    assert re.search(r"<form\b[^>]*\bid\s*=\s*(['\"])beta-form\1", section.group())
    assert re.search(r"<a\b[^>]*\bhref\s*=\s*(['\"])privacy\.html\1", section.group())


def test_endpoint_defined_once_and_used_by_fetch():
    assert len(re.findall(r"\bconst\s+BETA_FORM_ENDPOINT\b", PAGE)) == 1
    endpoint = re.search(r"\bconst\s+BETA_FORM_ENDPOINT\s*=\s*(['\"])(.*?)\1", PAGE)
    assert endpoint is not None
    assert re.fullmatch(r"https://formspree\.io/f/[A-Za-z0-9]+", endpoint.group(2))
    assert re.search(r"\bfetch\s*\(\s*BETA_FORM_ENDPOINT\s*,", PAGE)
    assert not re.search(r"\bfetch\s*\(\s*['\"]", PAGE)
    assert PAGE.count("formspree.io/f/") == 1


def test_subject_names_the_beta():
    assert re.search(
        r"formData\.append\s*\(\s*(['\"])_subject\1\s*,\s*"
        r"(['\"])Googol Vibe beta \(Website\)\2\s*\)", PAGE
    )


def test_old_waitlist_ids_are_gone():
    ids = {value for _, value in re.findall(r"\bid\s*=\s*(['\"])(.*?)\1", PAGE)}
    assert not {"vibe-ai", "waitlist-form"} & ids
    assert {"waitlist-form-container", "waitlist-form-view"} <= ids
