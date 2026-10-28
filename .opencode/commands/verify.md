---
description: Verify the running app with next-dev-loop
---

Load the `next-dev-loop` skill and verify that $ARGUMENTS works at runtime.

Steps:

1. Confirm `next dev` is running by reading `.next/dev/lock`. If it is not
   running, start it with `pnpm dev` and wait for the ready line. Never start a
   second dev server.
2. Use the `next-devtools` MCP tools for the framework view: `get_errors`,
   `get_compilation_issues`, and `compile_route` for the route under test.
3. Use `agent-browser` for the browser view: open the route, check the rendered
   output and console errors, and capture desktop (1440px) and mobile (390px)
   screenshots when layout matters.
4. Report failures with the file and line that likely caused them, plus the
   exact command output or screenshot path that shows the problem.
