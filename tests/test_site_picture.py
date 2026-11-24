from pathlib import Path
import xml.etree.ElementTree as ElementTree

import pytest


SVG = Path(__file__).resolve().parents[1] / 'site' / 'screenshot.svg'


def text_elements():
    root = ElementTree.parse(SVG).getroot()
    return [el for el in root.iter() if el.tag.endswith('text')]


def joined_text():
    return '\n'.join(''.join(el.itertext()) for el in text_elements())


def test_svg_parses_with_original_canvas():
    root = ElementTree.parse(SVG).getroot()
    assert root.attrib['width'] == '960'
    assert root.attrib['height'] == '600'


def test_svg_keeps_43_text_elements():
    assert len(text_elements()) == 43


@pytest.mark.parametrize('forbidden', [
    'Discord',
    'Cole',
    'Formspree',
    'TLDR',
    'Gmail address changes',
    'ChatGPT',
    'Daily Development',
    'Standup',
    'Daily TODO',
    'Office',
])
def test_no_real_looking_text_remains(forbidden):
    assert forbidden not in joined_text()


@pytest.mark.parametrize('fake', ['Jane Example', 'example.com'])
def test_obvious_fakes_are_present(fake):
    assert fake in joined_text()
