# Backend and testing

Routers are HTTP composition; domain services flush persistent changes; routers, workers, and import commands commit explicit transaction phases. Session cleanup rolls back only uncommitted work, so an exception after a committed phase does not undo that phase. Workers use public service operations. Keep dependency direction one-way: schemas do not import graph validation, business modules do not import routers, and provider configuration stays in composition.

Use async SQLAlchemy and generated Alembic migrations. Never hand-write migrations. Tests use isolated databases, savepoints/factories, and stub providers; destructive tests may drop only their dedicated test database. An isolated Redis is required for worker/import tests.

Preserve commit-before-enqueue/publish, quota/content lock ordering, stale/retry semantics, table/enum/constraint names, and serialized arq function names. Focused tests should exercise public boundaries and real cache/transaction effects rather than implementation-only mocks.
