# Agent Operating Rules

## 1. Repository-first reasoning

Before changing code:

1. Read `AGENTS.md`.
2. Read `DESIGN.md` for UI/frontend work.
3. Inspect the target route/component and its nearest related components.
4. Search the repository for existing implementations before inventing new ones.
5. Inspect relevant types, server actions, database queries, and utilities before changing behavior.
6. For framework behavior, verify against the installed version/docs rather than relying on memory.

Never assume a file, route, component, API, database column, or utility exists.
Search first.

## 2. No speculative architecture

Do not introduce a new abstraction, library, pattern, route, API, database field,
or component when an existing repository pattern can satisfy the task.

Prefer:
- existing components
- existing utilities
- existing server actions
- existing data access patterns
- existing types
- existing design tokens

Only create something new when the repository does not already provide a suitable mechanism.

## 3. Change the smallest surface possible

For a requested change:

- modify only files required for the behavior
- do not refactor unrelated code
- do not rename existing APIs without necessity
- do not "clean up" nearby code unless required
- do not replace working patterns with personal preferences

Keep the diff narrow.

## 4. Requirements before implementation

Translate the request into explicit acceptance criteria before coding.

Example:

Task:
"Add supplier search."

Acceptance criteria:
- search input exists on the supplier page
- query parameter is preserved
- results are filtered by the actual supplier data
- empty state is handled
- loading/error behavior follows existing patterns
- existing layout/design system remains unchanged

If the request is ambiguous, identify the ambiguity instead of inventing behavior.

## 5. Evidence rule

Every non-trivial implementation decision should be grounded in one of:

- existing repository code
- existing types
- existing database/schema definitions
- existing tests
- framework documentation available in the installed version
- explicit user requirements

Do not invent APIs, database columns, routes, props, or framework behavior.

## 6. Implementation discipline

Implement one coherent change at a time.

After each meaningful change:

1. inspect the resulting code
2. run the narrowest relevant verification
3. fix failures
4. only then continue

Do not stack multiple speculative fixes.

## 7. Verification is mandatory

Before declaring a task complete, run the relevant checks.

Typical checks:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

Use the smallest sufficient set while iterating, but run the full appropriate validation before completion.

Never claim something works without verification.

## 8. Stop conditions

Stop coding when:

- acceptance criteria are satisfied
- relevant checks pass
- no known requirement remains

Do not continue refactoring after the requested behavior is complete.

## 9. UI rules

For frontend work, `DESIGN.md` is the source of truth.

Do not:
- invent colors
- invent typography
- add new icon libraries
- introduce pill-shaped UI where prohibited
- invent dashboard routes
- invent fake statistics
- duplicate layout/navigation behavior

Prefer existing components and semantic design tokens.

## 10. Database rules

For Supabase/database work:

- inspect existing migrations/schema before writing queries
- verify actual column names and relationships
- do not infer schema from UI labels
- do not modify production-facing schema without explicit need
- prefer migrations over ad-hoc schema assumptions

## 11. Git discipline

For substantial work:

1. inspect the current branch/status
2. keep the change isolated
3. create a focused commit/PR
4. describe what changed and what was verified

Never rewrite unrelated history or overwrite unrelated work.

## 12. Agent response format

Before implementation, briefly state:

### Understanding
What the task actually requires.

### Evidence
What existing code/docs establish.

### Plan
The smallest implementation plan.

After implementation, state:

### Changed
Files/behavior changed.

### Verified
Commands/tests run and their results.

### Remaining
Only unresolved issues or explicit assumptions.
