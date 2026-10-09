import { onMount } from "solid-js";
import { withSearch } from "../lib/with-search.ts";

/**
 * An island without its own markup for pages whose data is in the address parameters (`/r/?id=…`,
 * `/gallery/?user=…`): carries the parameters over to the links to other languages so the
 * switcher leads to the same recording or gallery. The page is built ahead of time and does not
 * know the parameters; without JS the link leads to the page without them.
 * @returns {null} No markup of its own.
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
