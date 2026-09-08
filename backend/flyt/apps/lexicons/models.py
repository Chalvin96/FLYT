from enum import Enum as PyEnum
from uuid import UUID
from uuid import uuid4

from sqlalchemy import JSON
from sqlalchemy import Boolean
from sqlalchemy import Enum
from sqlalchemy import ForeignKey
from sqlalchemy import Index
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import UniqueConstraint
from sqlalchemy import Uuid
from sqlalchemy import func
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from flyt.core.base import BaseModel
from flyt.core.base import DateTimeMixin


class LemmaPos(PyEnum):
    NOUN = "noun"
    ADJECTIVE = "adjective"
    VERB = "verb"
    ADVERB = "adverb"
    PREPOSITION = "preposition"
    CONJUNCTION = "conjunction"
    PRONOUN = "pronoun"
    DETERMINER = "determiner"
    INTERJECTION = "interjection"
    NUMERAL = "numeral"
    UNKNOWN = "unknown"


class Lemma(BaseModel, DateTimeMixin):
    __tablename__ = "lexicon_lemmas"

    uuid: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        unique=True,
        nullable=False,
        default=uuid4,
        index=True,
    )
    source_article_id: Mapped[int | None] = mapped_column(
        Integer, index=True, nullable=True
    )
    source_lemma_id: Mapped[int | None] = mapped_column(
        Integer, index=True, nullable=True
    )
    word: Mapped[str] = mapped_column(String, index=True)
    pos: Mapped[LemmaPos] = mapped_column(
        Enum(
            LemmaPos,
            name="lemmapos",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
            validate_strings=True,
        )
    )
    hgno: Mapped[int] = mapped_column(Integer)
    is_sub_article: Mapped[bool] = mapped_column(Boolean, default=False)
    primary_translation: Mapped[str | None] = mapped_column(Text, nullable=True)
    cross_reference_article_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    cross_reference_word: Mapped[str | None] = mapped_column(Text, nullable=True)
    ipa: Mapped[str | None] = mapped_column(Text, nullable=True)
    intonation: Mapped[str | None] = mapped_column(String(1), nullable=True)
    ipa_approximate: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    audio_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    frequency_rank: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )
    frequency_ambiguous: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )

    definitions = relationship(
        "Definition",
        back_populates="lemma",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    word_forms = relationship(
        "WordForm",
        back_populates="lemma",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    see_also = relationship(
        "SeeAlso",
        back_populates="lemma",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="SeeAlso.ordinal",
    )

    __table_args__ = (
        # Identity of a lemma is its Ordbøkene (article, lemma id). (word, pos,
        # hgno) is NOT unique — the same (word, pos, hgno) can name two distinct
        # senses (e.g. legg "fold" vs "setting hair", both NOUN hgno 3) — so the
        # old constraint silently dropped real senses. source_lemma_id alone is
        # also not unique (reused across homograph articles); the pair is.
        UniqueConstraint(
            "source_article_id", "source_lemma_id", name="uq_lemma_article_source_id"
        ),
        # Plain btree (the `index=True` above) doesn't serve LIKE 'prefix%' under this
        # DB's non-C collation - a separate varchar_pattern_ops index is required for
        # suggestion/autocomplete prefix scans to use an index instead of a seq scan.
        Index(
            "ix_lexicon_lemmas_word_pattern",
            "word",
            postgresql_ops={"word": "varchar_pattern_ops"},
        ),
    )

    def __str__(self):
        return self.word


class WordForm(BaseModel, DateTimeMixin):
    __tablename__ = "lexicon_word_forms"

    lemma_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lexicon_lemmas.id"), index=True
    )
    form: Mapped[str] = mapped_column(String, index=True)
    tags_json: Mapped[list] = mapped_column(JSON, default=list)
    ipa: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    ipa_approximate: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    lemma = relationship("Lemma", back_populates="word_forms", lazy="selectin")

    __table_args__ = (
        Index(
            "ix_lexicon_word_forms_form_pattern",
            "form",
            postgresql_ops={"form": "varchar_pattern_ops"},
        ),
        Index(
            "ix_lexicon_word_forms_form_lower",
            func.lower(form),
        ),
    )

    def __str__(self):
        return self.form


class Definition(BaseModel, DateTimeMixin):
    __tablename__ = "lexicon_definitions"

    uuid: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        unique=True,
        nullable=False,
        default=uuid4,
        index=True,
    )
    lemma_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lexicon_lemmas.id"), index=True
    )
    definition: Mapped[str] = mapped_column(Text)
    translation: Mapped[str] = mapped_column(Text, nullable=False)
    translation_source: Mapped[str | None] = mapped_column(String, nullable=True)
    examples_json: Mapped[list] = mapped_column(JSON, default=list)

    lemma = relationship("Lemma", back_populates="definitions", lazy="selectin")

    def __str__(self):
        return self.definition


class SeeAlso(BaseModel, DateTimeMixin):
    """A related-lemma link (se/sjå/jamfør pointer with a target article_id).

    Resolved to a concrete lemma at read time via ``Lemma.source_article_id``
    so dangling targets (not yet imported) still carry their stored word.
    """

    __tablename__ = "lexicon_lemma_see_also"

    lemma_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lexicon_lemmas.id", ondelete="CASCADE"), index=True
    )
    target_article_id: Mapped[int] = mapped_column(Integer)
    target_word: Mapped[str] = mapped_column(Text)
    relation: Mapped[str] = mapped_column(String)
    ordinal: Mapped[int] = mapped_column(Integer)

    lemma = relationship("Lemma", back_populates="see_also", lazy="selectin")

    def __str__(self):
        return f"{self.relation} {self.target_word}"
