"""CLI entrypoint for seeding E2E user state.

Usage (inside the e2e-backend container)::

    python scripts/seed_e2e.py

Requires ENV=e2e and a DATABASE_URL pointing at the flyt_e2e database.
"""

import asyncio

from flyt.apps.test_support.seed import seed_e2e_user_state
from flyt.core.db import AsyncSessionLocal


async def main() -> None:
    async with AsyncSessionLocal() as db:
        await seed_e2e_user_state(db)
    print("E2E user state seeded.")


if __name__ == "__main__":
    asyncio.run(main())
