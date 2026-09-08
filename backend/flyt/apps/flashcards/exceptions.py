from flyt.core.exceptions import DomainException


class FlashcardError(DomainException):
    pass


class DeckNotFoundError(FlashcardError):
    def __init__(self, message: str = "Deck not found"):
        super().__init__(message, "DECK_NOT_FOUND")


class CardNotFoundError(FlashcardError):
    def __init__(self, message: str = "User card not found"):
        super().__init__(message, "CARD_NOT_FOUND")


class InvalidReviewRatingError(FlashcardError):
    def __init__(self, message: str = "Invalid review rating"):
        super().__init__(message, "INVALID_REVIEW_RATING")


class InvalidReviewOutcomeError(FlashcardError):
    def __init__(
        self,
        message: str = "Only speak and write exercises can finish without a grade",
    ):
        super().__init__(message, "INVALID_REVIEW_OUTCOME")


class DefinitionNotDeckableError(FlashcardError):
    def __init__(self, message: str = "Definition not found or not available for deck"):
        super().__init__(message, "NOT_FOUND")


class LemmaNotDeckableError(FlashcardError):
    def __init__(self, message: str = "Lemma is not available for deck"):
        super().__init__(message, "LEMMA_NOT_DECKABLE")
