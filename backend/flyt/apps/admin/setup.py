from starlette.requests import Request
from starlette_admin.contrib.sqla import Admin
from starlette_admin.contrib.sqla import ModelView

from flyt.apps.admin.auth import AdminAuthProvider
from flyt.apps.flashcards.models import CardPool
from flyt.apps.lessons.models import Lesson
from flyt.apps.lessons.models import LessonRelease
from flyt.apps.lessons.models import UserLessonProgress
from flyt.apps.lexicons.models import Definition
from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import SeeAlso
from flyt.apps.lexicons.models import WordForm
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import ReadingGroup
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.models import UserStory
from flyt.apps.users.models import User
from flyt.core.config import settings
from flyt.core.db import async_engine


K_DEFAULT_FORM_EXCLUDED_FIELDS = ("created_at", "updated_at", "uuid")
DEFAULT_ADMIN_MODELS = (
    Lemma,
    WordForm,
    Definition,
    SeeAlso,
    LessonRelease,
    Lesson,
)
K_RELATED_ADMIN_MODELS = (
    UserLessonProgress,
    CardPool,
    ReadingGroup,
    StoryPage,
    UserStory,
)


class DefaultAdminView(ModelView):
    exclude_fields_from_create = K_DEFAULT_FORM_EXCLUDED_FIELDS
    exclude_fields_from_edit = K_DEFAULT_FORM_EXCLUDED_FIELDS

    def can_delete(self, request: Request) -> bool:
        return False


class RelatedAdminView(DefaultAdminView):
    add_to_menu = False

    def __init__(self, model) -> None:
        self.fields = tuple(column.key for column in model.__mapper__.column_attrs)
        super().__init__(model)


class StoryAdminView(ModelView):
    exclude_fields_from_edit = (
        "id",
        "uuid",
        "slug",
        "title",
        "cefr_level",
        "content",
        "word_count",
        "reading_group_id",
        "reading_group",
        "pages",
        "user_stories",
        "created_at",
        "updated_at",
        "text_annotations_json",
    )

    def can_create(self, request: Request) -> bool:
        return False


class UserAdminView(ModelView):
    exclude_fields_from_edit = (
        "id",
        "uuid",
        "email",
        "display_name",
        "avatar_url",
        "last_login",
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
    for related_model in K_RELATED_ADMIN_MODELS:
        admin.add_view(RelatedAdminView(related_model))


def add_specialized_views(admin: Admin) -> None:
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
