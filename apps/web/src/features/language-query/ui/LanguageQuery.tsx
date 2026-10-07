import { onMount } from "solid-js";
import { withSearch } from "../lib/with-search.ts";

/**
 * Остров без своей разметки для страниц, данные которых — в параметрах адреса (`/r/?id=…`,
 * `/gallery/?user=…`): переносит параметры в ссылки на другие языки, чтобы переключатель вёл
 * на ту же запись или галерею. Страница собирается заранее и параметров не знает; без JS ссылка
 * ведёт на страницу без них.
 * @returns {null} Своей разметки нет.
 */
export function LanguageQuery(): null {
  onMount(() => {
    const search = window.location.search;

    if (search === "") return;

    for (const link of document.querySelectorAll<HTMLAnchorElement>("a[hreflang]")) {
      const href = link.getAttribute("href");

      if (href !== null) link.setAttribute("href", withSearch(href, search));
    }
  });

  return null;
}
