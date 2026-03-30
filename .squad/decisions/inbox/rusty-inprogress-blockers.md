# Rusty Inbox: In-Progress Blockers

- Decision: blocked-task picker should allow blocker candidates with status `todo`, `inprogress`, or `blocked`.
- Rationale: users can legitimately wait on work that is already underway, so dependency selection should include active in-flight tasks, not just untouched todos.
- Guardrails: keep `done` and `cancelled` tasks out of blocker selection, and preserve existing unblock cleanup when a blocker transitions into a terminal state.
