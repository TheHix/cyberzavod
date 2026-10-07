import { describe, expect, it } from "vitest";
import { notFoundFilesOf } from "./nginx.ts";

describe("notFoundFilesOf", () => {
  it("берёт файлы из map для $not_found_page", () => {
    const config = [
      "map $uri $not_found_page {",
      "    ~^/ru/ /ru/404/index.html;",
      "    default /404.html;",
      "}",
      "server { error_page 404 $not_found_page; }",
    ].join("\n");

    const files = notFoundFilesOf(config);

    expect(files).toEqual(["/ru/404/index.html", "/404.html"]);
  });

  it("бросает ошибку, если map нет", () => {
    const act = () => notFoundFilesOf("server { error_page 404 /404.html; }");

    expect(act).toThrow("$not_found_page");
  });
});
