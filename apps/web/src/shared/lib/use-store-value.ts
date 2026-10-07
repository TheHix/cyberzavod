import type { ReadableAtom } from "nanostores";
import { createSignal, onCleanup, type Accessor } from "solid-js";

/**
 * Значение стора Nano Stores как сигнал Solid. В отличие от `useStore` из `@nanostores/solid`,
 * значение не перекладывается в Solid-стор через reconcile: объекты отдаются как есть и не
 * правятся на месте — кадры ядра делят объекты со сценарием, и правка на месте портила бы его.
 * @template T
 * @param {ReadableAtom<T>} store Стор Nano Stores.
 * @returns {Accessor<T>} Текущее значение стора; обновляется вместе с ним.
 */
export function useStoreValue<T>(store: ReadableAtom<T>): Accessor<T> {
  const [value, setValue] = createSignal(store.get());

  onCleanup(store.listen((next) => setValue(() => next)));

  return value;
}
