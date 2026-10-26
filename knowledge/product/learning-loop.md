# Learning loop

Lessons teach concepts, reading gives them authentic context, dictionary lookup explains
words, and review schedules recall. Saving a word can carry its reading sentence into
review. Starting a lesson adds its card pools without replacing existing learner state.

Feedback states whether an action is graded, pending, retryable, or unconfirmed. An
unavailable evaluation does not become a fabricated score.

Review startup distinguishes a failed queue request from a successful empty queue. Keep
the failure visible with an explicit retry; only a successful response can lead to the
empty or complete state.

Review completion shows the summary and the next step on one screen: "Continue
reviewing" while cards are due now, the Keep practicing options when the queue is empty.
It never reads as done for the day while learning cards are due later in the UTC day,
and a loading or failed queue refresh never claims the learner is caught up.
