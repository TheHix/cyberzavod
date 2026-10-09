#!/usr/bin/env node
// CLI entry point. Through `pnpm cyberzavod` pnpm runs the script from the install root, so the
// calling directory comes from INIT_CWD, which pnpm and npm set to the directory they were run
// from.

import { runCli } from "../cli.ts";

process.exitCode = await runCli(
  process.argv.slice(2),
  process.env.INIT_CWD ?? process.cwd(),
  process.env,
);
