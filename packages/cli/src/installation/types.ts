// What the running Cyberzavod version brings with it.

import type { HarnessFiles } from "@cyberzavod/core";

/** Installation texts in the form the build embeds them. */
export interface Assets {
  harness: HarnessFiles;
  /** Templates by file name. */
  templates: Readonly<Record<string, string>>;
}
