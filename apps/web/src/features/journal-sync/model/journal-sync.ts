// Связь журнала сборки с цехом. Это разные виджеты и друг друга они не знают: цех
// подключает свою сцену, журнал читает, до какой речи дошла сцена, и просит перемотку.

import { atom, type ReadableAtom } from "nanostores";

/** Промпт или реплика записи: `index` — номер среди таких же, с нуля, как у реплик цеха. */
export type Speech =
  | { readonly kind: "prompt"; readonly index: number }
  | { readonly kind: "message"; readonly index: number };

/** То, что журналу нужно от цеха: до какой речи дошла сцена и как перемотать к речи. */
export interface JournalScene {
  /** Последний промпт или реплика, начавшиеся к моменту сцены. */
  readonly $speech: ReadableAtom<Speech | null>;
  /** Перематывает сцену к началу речи. */
  seekToSpeech(speech: Speech): void;
}

interface Connection {
  readonly scene: JournalScene;
  readonly unsubscribe: () => void;
}

const $currentSpeech = atom<Speech | null>(null);
let connection: Connection | null = null;

/** Речь, до которой дошёл подключённый цех; `null` — речи ещё не было или цеха нет. */
export const $sceneSpeech: ReadableAtom<Speech | null> = $currentSpeech;

/**
 * Сравнивает речи по смыслу, а не по ссылке: пропсы острова Astro приходят через Solid-стор
 * и ссылке не равны.
 * @param {Speech | null} current Речь, до которой дошла сцена, или `null`.
 * @param {Speech} candidate Речь записи журнала.
 * @returns {boolean} Совпадают ли вид и номер.
 */
export function isSameSpeech(current: Speech | null, candidate: Speech): boolean {
  return current !== null && current.kind === candidate.kind && current.index === candidate.index;
}

/**
 * Подключает цех к журналу: переносит его `$speech` в `$sceneSpeech` и запоминает сцену для
 * перемотки. Новое подключение заменяет прежнее.
 * @param {JournalScene} scene Сцена цеха.
 * @returns {() => void} Отключение: сбрасывает речь и забывает сцену, если она всё ещё эта.
 */
export function connectScene(scene: JournalScene): () => void {
  connection?.unsubscribe();
  const own: Connection = {
    scene,
    unsubscribe: scene.$speech.subscribe((speech) => $currentSpeech.set(speech)),
  };
  connection = own;
  return () => {
    own.unsubscribe();
    if (connection !== own) return;
    connection = null;
    $currentSpeech.set(null);
  };
}

/**
 * Просит подключённый цех перемотать сцену к речи; без цеха ничего не делает.
 * @param {Speech} speech Промпт или реплика записи.
 */
export function seekScene(speech: Speech): void {
  connection?.scene.seekToSpeech(speech);
}
