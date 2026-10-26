import pytest

from flyt.apps.story_generation.output import parse_generation_output


@pytest.mark.parametrize(
    "raw",
    [
        '{"title":"En katt","text":"Katten kom hjem."}',
        '```\n{"title":"En katt","text":"Katten kom hjem."}\n```',
        '```json\n{"title":"En katt","text":"Katten kom hjem."}\n```',
        '```json\r\n{"title":"En katt","text":"Katten kom hjem."}\r\n```',
        'Her er historien:\n{"title":"En katt","text":"Katten kom hjem."}',
        'Her er historien:\n{"title":"En katt","text":"Katten kom hjem."}\nGod lesing!',
    ],
)
def test_parse_generation_output_given_wrapped_json_expect_title_and_prose(
    raw: str,
) -> None:
    output = parse_generation_output(raw)

    assert output.title == "En katt"
    assert output.text == "Katten kom hjem."


@pytest.mark.parametrize(
    "raw",
    [
        '{"title":"En katt","text":""}',
        '{"title":"En katt","text":" \\r\\n\\t "}',
        '{"title":"En katt","text":"**__**"}',
        '{"title":"En katt","content":"Katten kom hjem."}',
        '{"title":"En katt","text":"Katten kom',
        '```json\r\n{"title":"En katt","text":"Katten kom',
        'Her er historien:\n{"title":"En katt","content":"Katten kom hjem."}',
    ],
)
def test_parse_generation_output_given_invalid_structured_output_expect_failure(
    raw: str,
) -> None:
    with pytest.raises(ValueError):
        parse_generation_output(raw)


def test_parse_generation_output_given_plain_prose_expect_normalized_text_without_title() -> (
    None
):
    output = parse_generation_output("  **Katten** kom hjem.\r\n\r\nDen sov.  ")

    assert output.title is None
    assert output.text == "Katten kom hjem.\n\nDen sov."
