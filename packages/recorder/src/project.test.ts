import { describe, expect, it } from "vitest";
import { parseProjectConfig, ProjectConfigError } from "./project.ts";

function validProjectConfig(): Record<string, unknown> {
  return { id: "cyberzavod", factory: "0.1.0" };
}

describe("parseProjectConfig", () => {
  it("принимает корректный конфиг", () => {
    const raw = validProjectConfig();

    const config = parseProjectConfig(raw);

    expect(config).toEqual({ id: "cyberzavod", factory: "0.1.0" });
  });

  it("игнорирует неизвестные поля и не отдаёт их наружу", () => {
    const raw = { ...validProjectConfig(), title: "Киберзавод", extra: { nested: true } };

    const config = parseProjectConfig(raw);

    expect(config).toEqual({ id: "cyberzavod", factory: "0.1.0" });
  });

  it.each([null, "cyberzavod", 42, undefined])("отклоняет не объект %j", (raw) => {
    const act = () => parseProjectConfig(raw);

    expect(act).toThrow(ProjectConfigError);
  });

  it.each(["../demo", "demo/1", "", 7, undefined])("отклоняет id %j", (id) => {
    const raw = { ...validProjectConfig(), id };

    const act = () => parseProjectConfig(raw);

    expect(act).toThrow(/id/);
  });

  it.each(["", "  ", "0.1.0\n0.2.0", 1, undefined])("отклоняет factory %j", (factory) => {
    const raw = { ...validProjectConfig(), factory };

    const act = () => parseProjectConfig(raw);

    expect(act).toThrow(ProjectConfigError);
  });
});
