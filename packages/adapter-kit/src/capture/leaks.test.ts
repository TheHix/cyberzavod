import { describe, expect, it } from "vitest";
import { findLeaks } from "./leaks.ts";

describe("findLeaks", () => {
  it.each([
    ["Зайти на сервер 203.0.113.7", "ip-address"],
    ["Сервер 2001:db8:85a3::8a2e:370:7334", "ipv6-address"],
    ["Написать на someone@example.org", "email"],
    ["Зайти как deploy@myvps", "server-login"],
    ["Подставить ghp_0123456789abcdefABCDEF", "token"],
    ["Токен Actions ghs_0123456789abcdefABCDEF", "token"],
    ["Ключ sk_live_0123456789abcdef", "token"],
    ["Токен npm_0123456789abcdefghijABCDEFGHIJ012345", "token"],
    ["База postgres://app:secret@db:5432/app", "url-password"],
    ["Заголовок eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig", "token"],
    ["-----BEGIN OPENSSH PRIVATE KEY-----", "private-key"],
    ["Положить файл в /Users/someone/projects", "user-path"],
  ])("находит в «%s»: %s", (text, kind) => {
    const leaks = findLeaks(text);

    expect(leaks).toEqual([kind]);
  });

  it.each([
    "Определить стиль кода",
    "У @param тип в фигурных скобках",
    "Пакет @cyberzavod/core без зависимостей",
    "Версия Go 1.27, Node 24",
    "Ширина строки — 100 знаков",
    "Обновить vite@8.3.2 и docker/login-action@v4.6.0",
    "Порты привязаны к 127.0.0.1",
    "Документация на example.com/home/docs",
    "Время на шкале 1:02:05",
    "Хранилище pnpm в npm_config_store_dir",
    "Подключение postgres://db:5432/app без пароля",
  ])("ничего не находит в «%s»", (text) => {
    const leaks = findLeaks(text);

    expect(leaks).toEqual([]);
  });
});
