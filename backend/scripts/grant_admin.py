"""Promote a user to admin. One-off bootstrap for the first admin.

`User.email` is NOT unique, so promoting by email aborts if it matches zero or
multiple rows; use --uuid to disambiguate.

Usage:
  uv run python scripts/grant_admin.py --email you@example.com
  uv run python scripts/grant_admin.py --uuid 123e4567-e89b-12d3-a456-426614174000
"""

import argparse
import asyncio
from uuid import UUID

from sqlalchemy import select

from flyt.apps.users.models import User
from flyt.apps.users.types import UserRole
from flyt.core.db import AsyncSessionLocal


async def _resolve(db, email: str | None, uuid: str | None) -> User | None:
    if uuid is not None:
        return await db.scalar(select(User).where(User.uuid == UUID(uuid)))
    matches = (await db.scalars(select(User).where(User.email == email))).all()
    if len(matches) == 0:
        print(f"No user found with email {email!r}.")
        return None
    if len(matches) > 1:
        print(
            f"{len(matches)} users share email {email!r}; re-run with --uuid "
            f"to disambiguate: {[str(u.uuid) for u in matches]}"
        )
        return None
    return matches[0]


async def grant_admin(email: str | None, uuid: str | None) -> None:
    async with AsyncSessionLocal() as db:
        user = await _resolve(db, email, uuid)
        if user is None:
            return
        user.role = UserRole.ADMIN
        user.is_active = True
        await db.commit()
        print(f"Granted admin to {user.email} (uuid={user.uuid}).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Promote a user to admin.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--email", help="Email of the user to promote.")
    group.add_argument("--uuid", help="UUID of the user to promote (unambiguous).")
    args = parser.parse_args()
    asyncio.run(grant_admin(args.email, args.uuid))


if __name__ == "__main__":
    main()
