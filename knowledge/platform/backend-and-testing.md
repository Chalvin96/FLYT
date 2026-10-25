# Backend data access

Relationship loading is explicit. Use lazy raise by default and write-only for unbounded
collections. Read a write-only collection with a bounded query. When the parent can be
deleted, use passive deletes with a matching foreign-key cascade.

Choose eager loads per query for the rows authorization, business rules, and the
response need. Defer large columns the response does not show.

Test ORM-backed responses from rows reloaded after expunging the session or in a new
session, so the identity map cannot hide a missing eager load. Lazy raise prevents
attribute access from loading implicitly, but flush may still load relationships for
delete cascades; exercise deletes with unloaded relationships.

Tests use the dedicated local PostgreSQL database and an isolated Redis service. The
database fixture rejects non-local hosts and database names without a test marker.
Exercise public boundaries and real cache or transaction effects instead of relying
only on implementation mocks.
