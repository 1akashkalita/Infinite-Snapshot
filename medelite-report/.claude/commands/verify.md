---
description: Run the quality gate and fix any failures at the root cause
---

Run the project's quality gate and drive it to fully green.

1. Run `npm run verify`. Read the full output and the PASS/FAIL summary — do
   not rely on a previous run.
2. If every check passes, report success and quote the PASS/FAIL summary as
   evidence. Stop.
3. If any check fails, fix the **root cause** — never paper over it:
   - **typecheck**: fix the types or the code. Do not silence errors with
     `any`, `as`, `@ts-ignore`, or `@ts-expect-error`.
   - **lint**: fix the code. Do not disable the rule or add blanket
     `eslint-disable` comments.
   - **format:check**: run `npm run format` to apply Prettier.
   - **test**: fix the code under test. NEVER weaken, skip (`.skip`), delete,
     or loosen an assertion to make a test pass. If a test is genuinely wrong,
     say so and explain why before touching it.
4. After each fix, re-run `npm run verify`. Repeat until it is fully green.
5. NEVER report the task as done while the gate is red. A "done" claim requires
   a fresh, fully-passing `npm run verify` as evidence.
