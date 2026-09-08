from flyt.apps.flashcards.models import FlashCard as FlashCardModel
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import LESSON_REVIEW_AUDIO_KEY
from flyt.apps.flashcards.schemas import FlashCardOperation
from flyt.apps.flashcards.schemas import serialize_flashcard


def test_serialize_flashcard_given_v4_operation_card_expect_canonical_payload():
    payload = {
        "kind": "exercise",
        "id": "ex-choose",
        "operation": "choose",
        "prompt": [{"kind": "text", "value": "Choose."}],
        "explanation": None,
        "payload": {
            "options": [{"option_id": "a", "text": "ja", "why": "Correct."}],
            "answer_id": "a",
        },
    }
    card = FlashCardModel(
        id=321,
        type=CardType.CHOOSE,
        payload_json=payload,
        schema_version="4.0",
    )

    serialized = serialize_flashcard(card)

    assert isinstance(serialized, FlashCardOperation)
    assert serialized.type == CardType.CHOOSE
    assert serialized.schema_version == "4.0"
    assert serialized.payload == payload


def test_serialize_flashcard_given_write_card_expect_private_prompt_removed_and_audio_resolved():
    payload = {
        "kind": "exercise",
        "id": "ex-write",
        "operation": "write",
        "prompt": [{"kind": "text", "value": "Write it."}],
        "explanation": None,
        "audio_id": "audio-write",
        "payload": {
            "response_language": "no",
            "judge_prompt": "Private instruction.",
            "criteria": [{"id": "c1", "instruction": "Use present tense."}],
        },
        LESSON_REVIEW_AUDIO_KEY: {
            "id": "audio-write",
            "url": "https://media.example.test/write.wav",
            "path": "audio/lessons/lesson-speak/audio-write.wav",
            "mime": "audio/wav",
            "status": "synthesized",
        },
    }
    card = FlashCardModel(
        id=322,
        type=CardType.WRITE,
        payload_json=payload,
        schema_version="4.0",
    )

    serialized = serialize_flashcard(card)

    assert isinstance(serialized, FlashCardOperation)
    assert LESSON_REVIEW_AUDIO_KEY not in serialized.payload
    assert "judge_prompt" not in serialized.payload["payload"]
    assert serialized.audio is not None
    assert serialized.audio.url == "https://media.example.test/write.wav"
