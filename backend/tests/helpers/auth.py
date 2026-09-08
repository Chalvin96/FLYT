from httpx import AsyncClient

from flyt.apps.users.models import User
from flyt.apps.users.services import AuthService
from flyt.core.config import settings


async def authenticate(client: AsyncClient, user: User) -> None:
    auth = AuthService()
    token = auth.create_access_token(data={"sub": str(user.uuid)})
    client.cookies.set(settings.ACCESS_COOKIE_NAME, token)
