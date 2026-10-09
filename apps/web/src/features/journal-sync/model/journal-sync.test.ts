import { atom } from "nanostores";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  $sceneRecordingId,
  $sceneSpeech,
  connectScene,
  isSameSpeech,
  seekScene,
  type JournalScene,
  type Speech,
} from "./journal-sync.ts";

const FIRST_PROMPT: Speech = { kind: "prompt", index: 0 };
const FIRST_MESSAGE: Speech = { kind: "message", index: 0 };
const FIRST_INTERVENTION: Speech = { kind: "intervention", index: 0 };
const RECORDING_ID = "2026-10-07-79fd668f";
const NEXT_RECORDING_ID = "2026-10-07-79fd668f-2";

// Stub scene: the test sets the recording and speech, and sees seeking through the calls.
function stubScene(speech: Speech | null = null, recordingId = RECORDING_ID) {
  const $recordingId = atom(recordingId);
  const $speech = atom<Speech | null>(speech);
  const seekToSpeech = vi.fn<(speech: Speech) => void>();
  const scene: JournalScene = { $recordingId, $speech, seekToSpeech };

  return { scene, $recordingId, $speech, seekToSpeech };
}

const disconnects: (() => void)[] = [];

// Connects a scene and remembers the disconnect: the store is module-level, tests must not share
// a scene.
function connect(scene: JournalScene): () => void {
  const disconnect = connectScene(scene);

  disconnects.push(disconnect);

  return disconnect;
}

function disconnectAll(): void {
  for (const disconnect of disconnects.splice(0)) disconnect();
}

describe("connectScene", () => {
  afterEach(disconnectAll);

  it("переносит речь сцены в $sceneSpeech", () => {
    const { scene } = stubScene(FIRST_MESSAGE);

    connect(scene);

    expect($sceneSpeech.get()).toEqual(FIRST_MESSAGE);
  });

  it("следит за речью сцены", () => {
    const { scene, $speech } = stubScene();

    connect(scene);

    $speech.set(FIRST_PROMPT);

    expect($sceneSpeech.get()).toEqual(FIRST_PROMPT);
  });

  it("сбрасывает речь при отключении", () => {
    const { scene } = stubScene(FIRST_PROMPT);
    const disconnect = connect(scene);

    disconnect();

    expect($sceneSpeech.get()).toBeNull();
  });

  it("переносит запись сцены в $sceneRecordingId", () => {
    const { scene } = stubScene();

    connect(scene);

    expect($sceneRecordingId.get()).toBe(RECORDING_ID);
  });

  it("следит за сменой записи в сцене", () => {
    const { scene, $recordingId } = stubScene();

    connect(scene);

    $recordingId.set(NEXT_RECORDING_ID);

    expect($sceneRecordingId.get()).toBe(NEXT_RECORDING_ID);
  });

  it("сбрасывает запись при отключении", () => {
    const { scene } = stubScene();
    const disconnect = connect(scene);

    disconnect();

    expect($sceneRecordingId.get()).toBeNull();
  });

  it("перестаёт следить за сценой после отключения", () => {
    const { scene, $speech } = stubScene();
    const disconnect = connect(scene);

    disconnect();

    $speech.set(FIRST_PROMPT);

    expect($sceneSpeech.get()).toBeNull();
  });

  it("заменяет прежнюю сцену новой", () => {
    const older = stubScene(FIRST_PROMPT);
    const newer = stubScene(FIRST_MESSAGE);

    connect(older.scene);

    connect(newer.scene);
    older.$speech.set({ kind: "prompt", index: 5 });

    expect($sceneSpeech.get()).toEqual(FIRST_MESSAGE);
  });

  it("не сбрасывает новую сцену, когда отключают старую", () => {
    const older = stubScene(FIRST_PROMPT);
    const newer = stubScene(FIRST_MESSAGE);
    const disconnectOlder = connect(older.scene);

    connect(newer.scene);

    disconnectOlder();

    expect($sceneSpeech.get()).toEqual(FIRST_MESSAGE);
  });

  it("перематывает новую сцену после отключения старой", () => {
    const older = stubScene();
    const newer = stubScene();
    const disconnectOlder = connect(older.scene);

    connect(newer.scene);
    disconnectOlder();

    seekScene(RECORDING_ID, FIRST_PROMPT);

    expect(newer.seekToSpeech).toHaveBeenCalledWith(FIRST_PROMPT);
  });
});

describe("seekScene", () => {
  afterEach(disconnectAll);

  it("передаёт речь подключённой сцене", () => {
    const { scene, seekToSpeech } = stubScene();

    connect(scene);

    seekScene(RECORDING_ID, FIRST_MESSAGE);

    expect(seekToSpeech).toHaveBeenCalledExactlyOnceWith(FIRST_MESSAGE);
  });

  it("не перематывает сцену, которая проигрывает другую запись", () => {
    const { scene, $recordingId, seekToSpeech } = stubScene();

    connect(scene);
    $recordingId.set(NEXT_RECORDING_ID);

    seekScene(RECORDING_ID, FIRST_MESSAGE);

    expect(seekToSpeech).not.toHaveBeenCalled();
  });

  it("ничего не делает без сцены", () => {
    const act = () => seekScene(RECORDING_ID, FIRST_MESSAGE);

    expect(act).not.toThrow();
  });

  it("не трогает отключённую сцену", () => {
    const { scene, seekToSpeech } = stubScene();
    const disconnect = connect(scene);

    disconnect();

    seekScene(RECORDING_ID, FIRST_MESSAGE);

    expect(seekToSpeech).not.toHaveBeenCalled();
  });
});

describe("isSameSpeech", () => {
  it.each([
    [FIRST_PROMPT, { kind: "prompt", index: 0 }, true],
    [FIRST_PROMPT, { kind: "prompt", index: 1 }, false],
    [FIRST_PROMPT, FIRST_MESSAGE, false],
    [FIRST_INTERVENTION, { kind: "intervention", index: 0 }, true],
    [FIRST_INTERVENTION, { kind: "intervention", index: 1 }, false],
    [FIRST_INTERVENTION, FIRST_PROMPT, false],
    [FIRST_INTERVENTION, FIRST_MESSAGE, false],
    [null, FIRST_PROMPT, false],
  ] as const)("сравнивает %o и %o: %s", (current, candidate, expected) => {
    const same = isSameSpeech(current, candidate);

    expect(same).toBe(expected);
  });
});
