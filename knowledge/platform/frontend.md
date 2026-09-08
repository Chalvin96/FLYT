# Frontend boundaries

Keep request serialization in `src/api/<capability>.ts`, server-state keys and caching in `src/hooks/<capability>/queries.ts`, screen state in pages/routes, and local interaction hooks beside their operation. Shared package entrypoints remain deliberate public boundaries; app-local pure re-export barrels are unnecessary.

Infinite queries include filters in keys but pass page numbers through `pageParam`; merge pages before grouping and keep loaded data visible on later-page errors. Mutations preserve navigation-before-cache-clear ordering and invalidate only affected reads.

The active review session treats its issued-card snapshot as session-owned state:
window focus and reconnect do not refetch it. Re-entering review refetches before
building a queue so resolved cache data cannot reopen as a completed session.
Initial issuance failures remain visible with an explicit retry action, and leaving
the session invalidates the due-card summary for the next start.

TanStack route files and generated route trees are framework entrypoints. Tests use MSW at the network boundary, and responsive/accessibility behavior belongs at browser/page boundaries. React Doctor is a ratchet; lower legitimate counts rather than hiding findings.
