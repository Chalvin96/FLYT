from __future__ import annotations

import re

from pydantic import ValidationError

from flyt.content.exceptions import LessonImportError, LessonPacketError
from flyt.content.schemas import (
    Block,
    CalloutBlock,
    ExampleBlock,
    ExamplesBlock,
    HeadingBlock,
    LessonCatalog,
    LessonPacket,
    ListBlock,
    ParagraphBlock,
    ReadingBlock,
    RuleBlock,
    Spans,
    TableBlock,
    duplicate_values,
)

K_REQUEST_NOTE_ANCHOR_RE = re.compile(
    r"^(?:practice[\s_-]?request|request)\s*:", re.IGNORECASE
)


def parse_lesson_packet_or_raise(data: object) -> LessonPacket:
    try:
        return LessonPacket.model_validate(data)
    except ValidationError as exc:
        raise LessonPacketError(_format_validation_error(exc)) from exc


def parse_lesson_catalog_or_raise(data: object) -> LessonCatalog:
    try:
        return LessonCatalog.model_validate(data)
    except ValidationError as exc:
        raise LessonImportError(_format_validation_error(exc)) from exc


def validate_packet_graph_or_raise(packet: LessonPacket) -> None:
    """Reject duplicate IDs and dangling authored references within a packet."""
    objective_ids = [objective.id for objective in packet.objectives]
    section_ids = [section.id for section in packet.sections]
    exercise_ids = [exercise.id for exercise in packet.exercises]
    errors = _duplicate_id_errors(packet, objective_ids, section_ids, exercise_ids)
    errors.extend(_objective_reference_errors(packet, set(objective_ids)))
    errors.extend(
        _content_reference_errors(
            packet,
            known_sections=set(section_ids),
            known_exercises=set(exercise_ids),
        )
    )
    errors.extend(
        _practice_group_reference_errors(
            packet,
            known_objectives=set(objective_ids),
            known_exercises=set(exercise_ids),
        )
    )
    errors.extend(_dialogue_errors(packet))
    errors.extend(_request_note_errors(packet))
    errors.extend(_audio_reference_errors(packet))

    if errors:
        raise LessonPacketError(
            f"packet {packet.id!r} graph errors: " + "; ".join(errors)
        )


def _duplicate_id_errors(
    packet: LessonPacket,
    objective_ids: list[str],
    section_ids: list[str],
    exercise_ids: list[str],
) -> list[str]:
    errors = [
        f"duplicate objective id {objective_id!r}"
        for objective_id in duplicate_values(objective_ids)
    ]
    errors.extend(
        f"duplicate section id {section_id!r}"
        for section_id in duplicate_values(section_ids)
    )
    errors.extend(
        f"duplicate exercise id {exercise_id!r}"
        for exercise_id in duplicate_values(exercise_ids)
    )

    blocks = [
        block for section in packet.sections for block in _walk_blocks(section.blocks)
    ]
    public_ids = [block.id for block in blocks]
    public_ids.extend(
        item.id
        for block in blocks
        if isinstance(block, ExamplesBlock)
        for item in block.items
    )
    errors.extend(
        f"duplicate block or example id {public_id!r}"
        for public_id in duplicate_values(public_ids)
    )
    return errors


def _objective_reference_errors(
    packet: LessonPacket, known_objectives: set[str]
) -> list[str]:
    errors = [
        f"duplicate practice group id {group_id!r}"
        for group_id in duplicate_values(group.id for group in packet.practice_groups)
    ]
    for section in packet.sections:
        errors.extend(
            f"section {section.id!r} references unknown objective {referenced!r}"
            for referenced in section.objective_ids
            if referenced not in known_objectives
        )
    errors.extend(
        f"exercise {exercise.id!r} references unknown objective "
        f"{exercise.objective_id!r}"
        for exercise in packet.exercises
        if exercise.objective_id not in known_objectives
    )
    return errors


def _content_reference_errors(
    packet: LessonPacket,
    *,
    known_sections: set[str],
    known_exercises: set[str],
) -> list[str]:
    errors: list[str] = []
    seen_references: set[tuple[str, str]] = set()
    referenced_sections: set[str] = set()
    referenced_exercises: set[str] = set()
    for reference in packet.content:
        key = (reference.kind, reference.id)
        if key in seen_references:
            errors.append(f"duplicate content reference {reference.id!r}")
            continue
        seen_references.add(key)
        if reference.kind == "section":
            if reference.id in known_sections:
                referenced_sections.add(reference.id)
            else:
                errors.append(f"content references unknown section {reference.id!r}")
        elif reference.id in known_exercises:
            referenced_exercises.add(reference.id)
        else:
            errors.append(f"content references unknown exercise {reference.id!r}")
    errors.extend(
        f"section {section_id!r} missing from content"
        for section_id in sorted(known_sections - referenced_sections)
    )
    errors.extend(
        f"exercise {exercise_id!r} missing from content"
        for exercise_id in sorted(known_exercises - referenced_exercises)
    )
    return errors


def _practice_group_reference_errors(
    packet: LessonPacket,
    *,
    known_objectives: set[str],
    known_exercises: set[str],
) -> list[str]:
    errors: list[str] = []
    enrolled: set[str] = set()
    for group in packet.practice_groups:
        if group.objective_id not in known_objectives:
            errors.append(
                f"practice group {group.id!r} references unknown objective "
                f"{group.objective_id!r}"
            )
        for exercise_id in group.exercise_ids:
            if exercise_id not in known_exercises:
                errors.append(
                    f"practice group {group.id!r} references unknown exercise "
                    f"{exercise_id!r}"
                )
            elif exercise_id in enrolled:
                errors.append(
                    f"exercise {exercise_id!r} belongs to more than one practice group"
                )
            else:
                enrolled.add(exercise_id)
    errors.extend(
        f"exercise {exercise_id!r} does not belong to a practice group"
        for exercise_id in sorted(known_exercises - enrolled)
    )
    return errors


def _format_validation_error(exc: ValidationError) -> str:
    error = exc.errors(include_url=False)[0]
    path = ""
    for item in error["loc"]:
        path += (
            f"[{item}]"
            if isinstance(item, int)
            else (f".{item}" if path else str(item))
        )
    message = error["msg"].removeprefix("Value error, ")
    return f"{path or 'root'}: {message}"


def _walk_blocks(blocks: list[Block]):
    for block in blocks:
        yield block
        if isinstance(block, CalloutBlock):
            yield from _walk_blocks(block.blocks)


def _dialogue_errors(packet: LessonPacket) -> list[str]:
    errors: list[str] = []
    next_turn: dict[str, int] = {}
    for section in packet.sections:
        for block in _walk_blocks(section.blocks):
            if not isinstance(block, ReadingBlock):
                continue
            dialogue_id = block.dialogue_id
            speaker_id = block.speaker_id
            speaker_name = block.speaker_name
            turn_index = block.turn_index
            if (
                dialogue_id is None
                and speaker_id is None
                and speaker_name is None
                and turn_index is None
            ):
                continue
            if (
                dialogue_id is None
                or speaker_id is None
                or speaker_name is None
                or turn_index is None
            ):
                errors.append(
                    f"reading block {block.id!r} has partial dialogue metadata; "
                    "provide dialogue_id, speaker_id, speaker_name, and "
                    "turn_index together or omit them all"
                )
                continue
            if not speaker_id.strip() or not speaker_name.strip():
                errors.append(
                    f"reading block {block.id!r} has dialogue_id without speaker metadata"
                )
            expected = next_turn.get(dialogue_id, 1)
            if turn_index != expected:
                errors.append(
                    f"dialogue {dialogue_id!r} turn ordering breaks at block "
                    f"{block.id!r}: expected turn_index {expected}, got {turn_index}"
                )
            else:
                next_turn[dialogue_id] = expected + 1
    return errors


def _span_text(spans: Spans) -> str:
    return "".join(span.value for span in spans).strip()


def _block_span_groups(block: Block) -> list[tuple[str, Spans]]:
    groups: list[tuple[str, Spans]] = []
    if isinstance(block, HeadingBlock | ParagraphBlock | ReadingBlock):
        groups = [(f"block {block.id!r}", block.spans)]
    elif isinstance(block, ListBlock):
        groups = [
            (f"block {block.id!r} item {index}", item)
            for index, item in enumerate(block.items)
        ]
    if isinstance(block, RuleBlock):
        return [(f"block {block.id!r}", block.statement)]
    if isinstance(block, ExampleBlock):
        return [(f"block {block.id!r}", block.no), (f"block {block.id!r}", block.en)]
    if isinstance(block, ExamplesBlock):
        return [
            (f"example item {item.id!r}", spans)
            for item in block.items
            for spans in (item.no, item.en)
        ]
    if isinstance(block, TableBlock):
        return [
            (f"block {block.id!r} header {index}", header)
            for index, header in enumerate(block.headers)
        ] + [
            (f"block {block.id!r} row {row} cell {cell}", spans)
            for row, cells in enumerate(block.rows)
            for cell, spans in enumerate(cells)
        ]
    return groups


def _request_note_errors(packet: LessonPacket) -> list[str]:
    """Reject authoring request notes left inside learner content.

    A paragraph that merely starts with a label like ``Purpose:`` is ordinary
    learner content; a standalone request/practice-request anchor is material
    addressed to the authoring pipeline and must never ship.
    """
    errors: list[str] = []
    for section in packet.sections:
        for block in _walk_blocks(section.blocks):
            for where, spans in _block_span_groups(block):
                if K_REQUEST_NOTE_ANCHOR_RE.match(_span_text(spans)):
                    errors.append(f"{where} carries an authoring request note")
    errors.extend(
        f"exercise {exercise.id!r} prompt carries an authoring request note"
        for exercise in packet.exercises
        if K_REQUEST_NOTE_ANCHOR_RE.match(_span_text(exercise.prompt))
    )
    return errors


def _audio_reference_errors(packet: LessonPacket) -> list[str]:
    audio_ids = [asset.id for asset in packet.media.audio]
    errors = [
        f"duplicate audio id {audio_id!r}" for audio_id in duplicate_values(audio_ids)
    ]
    known_audio = set(audio_ids)
    referenced_ids: set[str] = set()
    errors.extend(_block_audio_reference_errors(packet, known_audio, referenced_ids))
    errors.extend(_exercise_audio_reference_errors(packet, known_audio, referenced_ids))
    errors.extend(_unreferenced_synthesized_audio_errors(packet, referenced_ids))
    return errors


def _block_audio_reference_errors(
    packet: LessonPacket,
    known_audio: set[str],
    referenced_ids: set[str],
) -> list[str]:
    errors: list[str] = []
    for section in packet.sections:
        for block in _walk_blocks(section.blocks):
            referenced = getattr(block, "audio_id", None)
            if referenced is not None:
                referenced_ids.add(referenced)
                if referenced not in known_audio:
                    errors.append(
                        f"block {block.id!r} references unknown audio {referenced!r}"
                    )
            for item in getattr(block, "items", []):
                item_audio = getattr(item, "audio_id", None)
                if item_audio is not None:
                    referenced_ids.add(item_audio)
                    if item_audio not in known_audio:
                        errors.append(
                            f"example item {item.id!r} references unknown audio {item_audio!r}"
                        )
    return errors


def _exercise_audio_reference_errors(
    packet: LessonPacket,
    known_audio: set[str],
    referenced_ids: set[str],
) -> list[str]:
    errors: list[str] = []
    for exercise in packet.exercises:
        if exercise.audio_id is None:
            continue
        referenced_ids.add(exercise.audio_id)
        if exercise.audio_id not in known_audio:
            errors.append(
                f"exercise {exercise.id!r} references unknown audio "
                f"{exercise.audio_id!r}"
            )
    return errors


def _unreferenced_synthesized_audio_errors(
    packet: LessonPacket, referenced_ids: set[str]
) -> list[str]:
    return [
        f"synthesized audio {asset.id!r} is not referenced by learner content"
        for asset in packet.media.audio
        if asset.status == "synthesized" and asset.id not in referenced_ids
    ]
