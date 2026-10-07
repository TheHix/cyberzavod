#!/usr/bin/env node
// Точка входа CLI. Через `pnpm cyberzavod` pnpm запускает скрипт из корня установки, поэтому
// каталог вызова берётся из INIT_CWD, который pnpm и npm ставят в каталог, откуда их запустили.

import { runCli } from "../cli.ts";

process.exitCode = await runCli(process.argv.slice(2), process.env.INIT_CWD ?? process.cwd());
