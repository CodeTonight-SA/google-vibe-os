from html.parser import HTMLParser
from pathlib import Path

import pytest

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs, self.anchors, self.zones = [], [], []
        self.anchor = None

    def handle_starttag(self, tag, attrs):
        self.hrefs.extend(value or '' for name, value in attrs if name == 'href')
        attrs = dict(attrs)
        if tag in ('header', 'nav', 'section'):
            self.zones.append('hero' if tag == 'section' and 'hero' in (attrs.get('class') or '').split() else tag)
        if tag == 'a':
            self.anchor = [attrs.get('href') or '', '', tuple(self.zones)]

    def handle_data(self, data):
        if self.anchor is not None:
            self.anchor[1] += data

    def handle_endtag(self, tag):
        if tag == 'a' and self.anchor is not None:
            self.anchor[1] = ' '.join(self.anchor[1].split())
            self.anchors.append(self.anchor)
            self.anchor = None
        if tag in ('header', 'nav', 'section'):
            self.zones.pop()

@pytest.fixture
def page():
    source = (Path(__file__).resolve().parents[1] / 'site' / 'index.html').read_text(encoding='utf-8')
    parser = Links()
    parser.feed(source)
    parser.close()
    assert '#setup' in parser.hrefs
    return parser, ' '.join(source.split())

def test_no_release_download_links(page): assert not any('releases/tag/nightly' in href or 'releases/latest' in href for href in page[0].hrefs)

def test_no_closed_business_link(page): assert not any('enterkonsult' in href.lower() for href in page[0].hrefs)

def test_header_nav_links_to_the_beta(page): assert any(href == '#beta' and text == 'Join the beta' and 'header' in zones and 'nav' in zones for href, text, zones in page[0].anchors)

def test_hero_links_to_the_beta_and_the_readme(page): assert all(any((href == target if target == '#beta' else target in href) and 'hero' in zones for href, text, zones in page[0].anchors) for target in ('#beta', 'blob/main/README.md'))

def test_setup_step_builds_from_source(page): assert 'Build the app from the source code' in page[1]
