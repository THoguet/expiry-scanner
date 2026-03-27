---
description: "Use when planning, coding, refactoring, testing, or documenting in this workspace. Enforces running bun run test:validate, forbids Vitest threshold edits, and requires precise documentation."
name: "Quality Guardrails"
applyTo: "**"
---

# Quality Guardrails

- Always validate changes by running `bun run test:validate` before finalizing implementation work.
- If `bun run test:validate` fails because coverage is too low, add or update tests until it passes.
- Never modify Vitest coverage thresholds to make coverage pass.
- Never edit coverage threshold values in `vitest.config.ts` as a workaround.
- Always provide precise documentation for changes:
  - State exactly what changed and where.
  - Include exact validation command(s) run and result(s).
  - Keep descriptions specific, actionable, and unambiguous.
