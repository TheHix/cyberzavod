// Связь журнала сборки с цехом. Это разные виджеты и друг друга они не знают: цех
// подключает свою сцену, журнал читает, какую запись она проигрывает и до какой речи дошла,
// и просит перемотку. Запись в цехе может смениться (серия сборок), поэтому речь журнала
// сверяется с ней по id записи.

import { atom, type ReadableAtom } from "nanostores";

/** Промпт, вмешательство или реплика записи: `index` — номер среди таких же, с нуля, как в цехе. */
export type Speech =
  | { readonly kind: "prompt"; readonly index: number }
  | { readonly kind: "intervention"; readonly index: number }
  | { readonly kind: "message"; readonly index: number };

/**
 * То, что журналу нужно от цеха: какую запись проигрывает сцена, до какой речи дошла и как
 * перемотать к речи.
 */
export interface JournalScene {
  /** id записи, которую сейчас проигрывает сцена. */
  readonly $recordingId: ReadableAtom<string>;
  /** Последний промпт, вмешательство или реплика, начавшиеся к моменту сцены. */
  readonly $speech: ReadableAtom<Speech | null>;
  /** Перематывает сцену к началу речи. */
  seekToSpeech(speech: Speech): void;
}

interface Connection {
  readonly scene: JournalScene;
  readonly unsubscribe: () => void;
}

const $currentRecordingId = atom<string | null>(null);
const $currentSpeech = atom<Speech | null>(null);
let connection: Connection | null = null;

/** id записи, которую проигрывает подключённый цех; `null` — цеха нет. */
export const $sceneRecordingId: ReadableAtom<string | null> = $currentRecordingId;

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

// Переносит запись и речь сцены в сторы журнала; отписка — одна на обе подписки.
function followScene(scene: JournalScene): () => void {
  const stopRecording = scene.$recordingId.subscribe((id) => $currentRecordingId.set(id));
  const stopSpeech = scene.$speech.subscribe((speech) => $currentSpeech.set(speech));

  return () => {
    stopRecording();
    stopSpeech();
  };
}

/**
 * Подключает цех к журналу: переносит его `$recordingId` и `$speech` в `$sceneRecordingId` и
 * `$sceneSpeech` и запоминает сцену для перемотки. Новое подключение заменяет прежнее.
 * @param {JournalScene} scene Сцена цеха.
 * @returns {() => void} Отключение: сбрасывает запись и речь и забывает сцену, если она всё
 *   ещё эта.
 */
export function connectScene(scene: JournalScene): () => void {
  connection?.unsubscribe();

  const own: Connection = { scene, unsubscribe: followScene(scene) };

  connection = own;

  return () => {
    own.unsubscribe();
    if (connection !== own) return;

    connection = null;
    $currentRecordingId.set(null);
    $currentSpeech.set(null);
  };
}

/**
 * Просит подключённый цех перемотать сцену к речи записи. Без цеха или если цех уже проигрывает
 * другую запись, ничего не делает: номер речи имеет смысл только внутри своей записи.
 * @param {string} recordingId id записи, к речи которой нужно перемотать.
 * @param {Speech} speech Промпт, вмешательство или реплика этой записи.
 */
export function seekScene(recordingId: string, speech: Speech): void {
  const scene = connection?.scene;

  if (scene === undefined) return;

  const isPlayingRecording = scene.$recordingId.get() === recordingId;

  if (isPlayingRecording) scene.seekToSpeech(speech);
}
