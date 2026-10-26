from typing import Any

from starlette.requests import Request
from starlette_admin.contrib.sqla import Admin
from starlette_admin.contrib.sqla import ModelView
from starlette_admin.exceptions import FormValidationError

from flyt.apps.admin.auth import AdminAuthProvider
from flyt.apps.flashcards.models import CardPool
from flyt.apps.lessons.models import Lesson
from flyt.apps.lessons.models import LessonRelease
from flyt.apps.lessons.models import UserLessonProgress
from flyt.apps.lexicons.models import Definition
from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import LemmaAlias
from flyt.apps.lexicons.models import SeeAlso
from flyt.apps.lexicons.models import WordForm
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import ReadingGroup
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.models import UserStory
from flyt.apps.reading.services import ReadingService
from flyt.apps.users.models import User
from flyt.core.config import settings
from flyt.core.db import async_engine


K_DEFAULT_FORM_EXCLUDED_FIELDS: tuple[str, ...] = ("created_at", "updated_at", "uuid")
DEFAULT_ADMIN_MODELS = (
    Lemma,
    WordForm,
    Definition,
    SeeAlso,
)
K_COLUMN_ADMIN_MODELS = (
    LessonRelease,
    Lesson,
)
K_RELATED_ADMIN_MODELS = (
    UserLessonProgress,
    CardPool,
    LemmaAlias,
    ReadingGroup,
    UserStory,
)


class DefaultAdminView(ModelView):
    exclude_fields_from_create = K_DEFAULT_FORM_EXCLUDED_FIELDS
    exclude_fields_from_edit = K_DEFAULT_FORM_EXCLUDED_FIELDS

    def can_delete(self, request: Request) -> bool:
        return False


class ColumnAdminView(DefaultAdminView):
    def __init__(self, model) -> None:
        self.fields = tuple(column.key for column in model.__mapper__.column_attrs)
        super().__init__(model)


class RelatedAdminView(ColumnAdminView):
    add_to_menu = False


class StoryPageAdminView(RelatedAdminView):
    exclude_fields_from_edit = (*K_DEFAULT_FORM_EXCLUDED_FIELDS, "story_id")


class StoryAdminView(ModelView):
    exclude_fields_from_edit = (
        "id",
        "uuid",
        "slug",
        "title",
        "cefr_level",
        "word_count",
        "reading_group_id",
        "created_at",
        "updated_at",
        "text_annotations_json",
    )

    def __init__(self, model) -> None:
        self.fields = tuple(
            c.key for c in model.__mapper__.column_attrs if c.key != "content"
        )
        super().__init__(model)

    def can_create(self, request: Request) -> bool:
        return False

    async def before_edit(
        self, request: Request, data: dict[str, Any], obj: Story
    ) -> None:
        try:
            await ReadingService(request.state.session).set_story_ready(
                obj, obj.is_ready
            )
        except ValueError as error:
            raise FormValidationError({"is_ready": str(error)}) from error


class UserAdminView(ModelView):
    exclude_fields_from_edit = (
        "id",
        "uuid",
        "email",
        "display_name",
        "avatar_url",
        "last_login",
        "session_version",
        "created_at",
        "updated_at",
    )

    def can_create(self, request: Request) -> bool:
        return False

    def can_delete(self, request: Request) -> bool:
        return False


def add_default_views(admin: Admin) -> None:
    for model in DEFAULT_ADMIN_MODELS:
        admin.add_view(DefaultAdminView(model))
    for column_model in K_COLUMN_ADMIN_MODELS:
        admin.add_view(ColumnAdminView(column_model))
    for related_model in K_RELATED_ADMIN_MODELS:
        admin.add_view(RelatedAdminView(related_model))


def add_specialized_views(admin: Admin) -> None:
    admin.add_view(StoryPageAdminView(StoryPage))
    admin.add_view(StoryAdminView(Story))
    admin.add_view(UserAdminView(User))


def validate_admin_cookie_policy() -> None:
    if settings.ACCESS_COOKIE_SAMESITE == "none":
        msg = (
            "Admin UI requires ACCESS_COOKIE_SAMESITE to be 'lax' or 'strict'. "
            "starlette-admin does not add CSRF tokens, so SameSite='none' would "
            "leave admin POST actions CSRF-vulnerable."
        )
        raise RuntimeError(msg)


def create_admin() -> Admin:
    validate_admin_cookie_policy()
    admin = Admin(
        async_engine,
        title="Flyt Admin",
        auth_provider=AdminAuthProvider(),
        secret_key=settings.ADMIN_SESSION_SECRET,
    )
    add_default_views(admin)
    add_specialized_views(admin)
    return admin
