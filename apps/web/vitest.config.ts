/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// Site tests run through Astro's Vite config: the same @/… aliases work as in the build.
// CSS is empty in tests by default; tokens.css is needed as text, the site icons are built from it.
export default getViteConfig({
  test: { include: ["src/**/*.{test,spec}.{ts,tsx}"], css: { include: [/tokens\.css/] } },
});
