import pytest

from flyt.apps.reading.import_service import derive_title


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Hei på deg. En norsk tekst følger.", "Hei på deg."),
        ("Dr. Hansen kom hjem. Han var trett.", "Dr. Hansen kom hjem."),
        ("Kl. 8 starter vi. Så går vi hjem.", "Kl. 8 starter vi."),
        ("Vi så f.eks. Hansen i dag. Han vinket.", "Vi så f.eks. Hansen i dag."),
        ("Dette er en setning. Ærlig talt.", "Dette er en setning."),
        ("Kommer du? Vi venter!", "Kommer du?"),
        (
            "Dette er\nen setning med flere linjer. Neste setning.",
            "Dette er en setning med flere linjer.",
        ),
        (
            "En liten by ved fjorden våkner langsomt til en ny og vakker morgen med sol.",
            "En liten by ved fjorden våkner langsomt til en ny og vakker…",
        ),
        ("Et lite hus uten punktum", "Et lite hus uten punktum"),
        ("", "Imported text"),
        ("a" * 60, "a" * 60),
        ("a" * 70, "a" * 70),
        ("a" * 70 + " et ord til.", "a" * 70 + "…"),
        ("a" * 250, "a" * 199 + "…"),
    ],
)
def test_default_title_given_pasted_text_expect_shortened_first_sentence(
    text: str, expected: str
) -> None:
    assert derive_title(text) == expected
