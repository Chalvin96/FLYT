from eval import normalize_text, word_errors


def test_normalize_text_given_punctuation_and_case_expect_words() -> None:
    assert normalize_text("Dette, er TEST!") == ["dette", "er", "test"]


def test_word_errors_given_identical_words_expect_zero() -> None:
    words = ["dette", "er", "norsk"]

    assert word_errors(words, words) == 0


def test_word_errors_given_substitution_expect_one() -> None:
    assert word_errors(["dette", "er", "norsk"], ["dette", "var", "norsk"]) == 1
