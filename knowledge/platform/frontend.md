# Frontend boundaries

Use the URL for shareable state and query hooks for server state. Keep local interaction
state near the component that owns it.

Use React context only for state shared across routes or components far apart in the
tree, or for a compound component's private channel. Use props or children when they can
carry the value. Mount the provider at the lowest level that matches the state lifetime.

A required context starts with a null default, and its hook throws when no provider is
present. Behavior that varies by caller, such as exercise retry mode, comes from a
parent prop or an operation registry entry.

API timestamps carry the UTC `Z` suffix. The shared date parser also accepts
offset-free values as UTC. Display times and calendar boundaries in UTC.

Include selection filters in infinite-query keys and pass page cursors through
pageParam. Merge pages before grouping, and keep loaded results visible if a later page
fails.

Each review start creates a new navigation identity, so starting again on the same
session URL resets the local queue. Leaving a session invalidates due-card queries
without refetching the finished issued snapshot.

The lesson session owns completion persistence. It saves when completion begins and
offers an explicit retry after failure; callers do not add a second persistence effect.
Unit-test HTTP requests use Axios's fetch adapter so MSW's Node interceptor can see them.
Check responsive and accessibility behavior at page or browser boundaries.
Account deletion navigates away before clearing the query cache; preserve that order.

React Doctor is pinned to version 0.9.18 and its sanctioned scan arguments. The baseline
sets per-rule warning limits; a version mismatch fails because counts from different
analyzers are not comparable. When a rule improves, lower its baseline.
