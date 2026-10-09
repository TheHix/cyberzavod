import type { ReadableAtom } from "nanostores";
import { createSignal, onCleanup, onMount, type Accessor } from "solid-js";

/**
 * A Nano Stores store value as a Solid signal. Unlike `useStore` from `@nanostores/solid`, the
 * value is not copied into a Solid store via reconcile: objects are returned as is and are not
 * mutated in place, since core frames share objects with the script and mutation would corrupt it.
 * @template T
 * @param {ReadableAtom<T>} store Nano Stores store.
 * @returns {Accessor<T>} Current store value; updates along with it.
 */
export function useStoreValue<T>(store: ReadableAtom<T>): Accessor<T> {
  const [value, setValue] = createSignal(store.get());

  onCleanup(store.listen((next) => setValue(() => next)));

  return value;
}

/**
 * A store value that until the island is mounted stays the value the page was built with. For a
 * store shared between islands: another island may change it before this one hydrates, and
 * hydration over markup built from a different value breaks.
 * @template T
 * @param {ReadableAtom<T>} store Nano Stores store.
 * @param {T} builtValue Store value at build time.
 * @returns {Accessor<T>} The value at build time until mounted, then the current store value.
 */
export function useHydratedStoreValue<T>(store: ReadableAtom<T>, builtValue: T): Accessor<T> {
  const value = useStoreValue(store);
  const [isMounted, setMounted] = createSignal(false);

  onMount(() => setMounted(true));

  return () => (isMounted() ? value() : builtValue);
}
