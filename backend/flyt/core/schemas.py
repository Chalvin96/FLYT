from datetime import datetime
from typing import Annotated

from pydantic import Field
from pydantic import PlainSerializer

from flyt.libs.utils.date import to_utc_aware

K_POSTGRES_INTEGER_MAX = 2_147_483_647

type DatabaseId = Annotated[int, Field(ge=1, le=K_POSTGRES_INTEGER_MAX)]
type UtcDatetime = Annotated[
    datetime, PlainSerializer(to_utc_aware, return_type=datetime, when_used="json")
]
