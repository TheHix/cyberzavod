import type { ReadableAtom } from "nanostores";
import { createSignal, onCleanup, type Accessor } from "solid-js";

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
