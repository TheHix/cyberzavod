/**
 * Agent names in the interface, by the `agent` field of the record source. These are product
 * names, so they are not translated (as `LOCALE_NAMES`); an agent missing here is shown as is.
 */
export const AGENT_NAMES: Readonly<Record<string, string>> = {
  claude: "Claude Code",
  codex: "Codex CLI",
};
