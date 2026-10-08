// Страховка перед публикацией: то, что не должно уйти на сайт, но легко проскакивает
// при редактуре промптов. Главная проверка — человек; новый признак — новая строка в таблице.

/** Вид того, что не должно попасть на сайт; человеку его называет каталог сообщений. */
export type LeakKind =
  | "ip-address"
  | "ipv6-address"
  | "email"
  | "server-login"
  | "token"
  | "url-password"
  | "private-key"
  | "user-path";

const LEAK_PATTERNS: readonly { kind: LeakKind; pattern: RegExp }[] = [
  // Локальные 127.x и 0.0.0.0 не выдают ничего о серверах — пропускаем.
  { kind: "ip-address", pattern: /\b(?!127\.|0\.0\.0\.0\b)\d{1,3}(?:\.\d{1,3}){3}\b/ },
  // Пустые группы — сокращённая запись `2001:db8::1`.
  { kind: "ipv6-address", pattern: /\b(?:[\da-f]{0,4}:){3,7}[\da-f]{1,4}\b/i },
  // Домен верхнего уровня из букв: `vite@8.3.2` и `action@v4.6.0` — версии, а не адреса.
  { kind: "email", pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}\b/i },
  {
    kind: "server-login",
    pattern: /\b(?:root|admin|deploy|ubuntu|debian)@[\w.-]+/,
  },
  {
    kind: "token",
    pattern: /\b(?:gh[pousr]_|github_pat_|sk-|sk_live_|xox[abp]-|AKIA|AIza)[\w-]{8,}/,
  },
  // У npm-токена ровно 36 знаков после префикса: `npm_config_store_dir` — переменная, не токен.
  { kind: "token", pattern: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { kind: "url-password", pattern: /\b[a-z][\w+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i },
  // JWT: две base64url-части с точкой — тоже токен.
  { kind: "token", pattern: /\beyJ[\w-]{8,}\.[\w-]{8,}\./ },
  { kind: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  // Путь в начале слова, а не часть адреса вроде `example.com/home/docs`.
  { kind: "user-path", pattern: /(?<![\w.])\/(?:Users|home)\/[\w.-]+/ },
];

/**
 * Ищет в тексте для публикации то, что похоже на адрес, ключ или личный путь.
 * @param {string} text Текст, который попадёт на сайт.
 * @returns {LeakKind[]} Виды найденного без повторов; пустой список, если ничего не найдено.
 */
export function findLeaks(text: string): LeakKind[] {
  const kinds = LEAK_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ kind }) => kind);

  return [...new Set(kinds)];
}
