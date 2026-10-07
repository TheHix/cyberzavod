import type { Translated } from "./locale.ts";

/**
 * Словарь интерфейса: группы по месту на странице, в каждой — подпись на всех языках. Язык, которого
 * не хватает у любой записи, не компилируется. Текст с параметрами — функция в каждом языке;
 * формы множественного числа — `PluralWords`. Содержимое страниц (гайды, карточки проектов,
 * записи) сюда не входит.
 */
export const UI_TEXT = {
  /** Боковое меню. */
  menu: {
    label: { en: "Menu", ru: "Меню" },
    home: {
      en: (name: string) => `${name} — floor`,
      ru: (name: string) => `${name} — цех`,
    },
    floor: { en: "Floor", ru: "Цех" },
    records: { en: "Builds", ru: "Записи" },
    journal: { en: "Log", ru: "Журнал" },
    project: { en: "Project", ru: "Проект" },
    guides: { en: "Guides", ru: "Гайды" },
    about: { en: "About", ru: "О заводе" },
    code: { en: "Code", ru: "Код" },
    // Видимая подпись плитки — код языка («RU»); он входит в доступное имя (WCAG 2.5.3).
    language: {
      en: (code: string, name: string) => `${code} — ${name}`,
      ru: (code: string, name: string) => `${code} — ${name}`,
    },
  },
  /** Заголовки и кнопки выезжающих панелей. */
  panels: {
    records: { en: "Build recordings", ru: "Записи сборок" },
    journal: { en: "Build log", ru: "Журнал сборки" },
    guides: { en: "Guides", ru: "Гайды" },
    about: { en: "About", ru: "О заводе" },
    close: { en: "Close", ru: "Закрыть" },
  },
  /** HUD цеха: счётчики сборки. */
  hud: {
    label: { en: "Build", ru: "Сборка" },
    time: { en: "Time", ru: "Время" },
    tokens: { en: "Tokens", ru: "Токены" },
    prompts: { en: "Prompts", ru: "Промпты" },
    reworks: { en: "Reworks", ru: "Возвраты" },
    interventions: { en: "Interventions", ru: "Вмешательства" },
  },
  /** Управление проигрыванием. */
  playback: {
    play: { en: "Play", ru: "Смотреть" },
    pause: { en: "Pause", ru: "Пауза" },
    scrubber: { en: "Build moment", ru: "Момент сборки" },
    elapsed: { en: "Time since build start", ru: "Время от начала сборки" },
    length: { en: "Build length", ru: "Длина сборки" },
    speed: { en: "Speed", ru: "Скорость" },
    speedLabel: { en: "Playback speed", ru: "Скорость проигрывания" },
  },
  /** Пузыри речи и полка речи: метки и раскрытие. */
  speech: {
    more: { en: "more", ru: "подробнее" },
    less: { en: "less", ru: "свернуть" },
    human: { en: "human", ru: "человек" },
    agent: { en: "agent", ru: "агент" },
    humanTo: {
      en: (recipient: string) => `human → ${recipient}`,
      ru: (recipient: string) => `человек → ${recipient}`,
    },
  },
  /** Журнал сборки. */
  journal: {
    empty: {
      en: "This build has no prompts, interventions or messages.",
      ru: "В этой сборке нет промптов, вмешательств и реплик.",
    },
    showOnFloor: { en: "show on floor", ru: "показать в цехе" },
    showOnFloorLabel: {
      en: (clock: string, route: string) => `Show on floor: ${clock}, ${route}`,
      ru: (clock: string, route: string) => `Показать в цехе: ${clock}, ${route}`,
    },
  },
  /** Списки записей и гайдов. */
  lists: {
    noRecordings: { en: "No builds yet.", ru: "Записей пока нет." },
    noGuides: { en: "No guides yet.", ru: "Гайдов пока нет." },
    tokens: {
      en: { one: "token", other: "tokens" },
      ru: { one: "токен", few: "токена", many: "токенов" },
    },
    prompts: {
      en: { one: "prompt", other: "prompts" },
      ru: { one: "промпт", few: "промпта", many: "промптов" },
    },
  },
  /** Карточка проекта. */
  project: {
    repo: { en: "Repository", ru: "Репозиторий" },
    website: { en: "Website", ru: "Сайт" },
  },
  /** Заголовки и тексты страниц. */
  pages: {
    floor: { en: "Floor", ru: "Цех" },
    homeHeading: {
      en: (name: string) => `${name} — a floor of AI agents`,
      ru: (name: string) => `${name} — цех ИИ-агентов`,
    },
    noBuilds: { en: "No builds yet.", ru: "Сборок пока нет." },
    projectTitle: {
      en: (name: string) => `Project “${name}”`,
      ru: (name: string) => `Проект «${name}»`,
    },
    recordingDescription: {
      en: (title: string) =>
        `How AI agents built “${title}”: the human's prompts, the foreman's and stations' messages, time and tokens.`,
      ru: (title: string) =>
        `Как ИИ-агенты собирали «${title}»: промпты человека, реплики мастера и станций, время и токены.`,
    },
  },
  /** Единицы длительности: «1 ч 05 мин», «1 h 05 min». */
  duration: {
    hour: { en: "h", ru: "ч" },
    minute: { en: "min", ru: "мин" },
    second: { en: "s", ru: "с" },
  },
  /** Остров цеха. */
  factory: {
    canvasLabel: {
      en: (title: string) => `The floor is playing the build “${title}”`,
      ru: (title: string) => `Цех проигрывает сборку «${title}»`,
    },
    starting: { en: "The floor is starting…", ru: "Цех запускается…" },
    failed: {
      en: "The floor failed to start — try reloading the page.",
      ru: "Цех не запустился — попробуйте обновить страницу.",
    },
  },
  /** Кнопка «копировать» у блоков кода: подписи по состояниям. */
  copy: {
    labels: {
      en: { idle: "Copy code", copied: "Copied", failed: "Could not copy" },
      ru: { idle: "Копировать код", copied: "Скопировано", failed: "Не удалось скопировать" },
    },
  },
  /** Панель «О заводе». */
  about: {
    how: {
      en: "The agent adapter (Claude Code is the first one) writes the session log, and the log becomes a record: stages, prompts, messages, time and tokens. The floor plays it back — each machine is a stage, workers hand the part over from hand to hand, and the foreman in the office hands out tasks and accepts reports.",
      ru: "Адаптер агента (первый — Claude Code) пишет журнал сессии, из него собирается запись: этапы, промпты, реплики, время и токены. Цех проигрывает её — каждый станок это этап, рабочие передают деталь из рук в руки, а мастер в своём кабинете раздаёт задания и принимает отчёты.",
    },
    code: { en: "Project code on GitHub", ru: "Код проекта на GitHub" },
    madeBy: { en: "Made by", ru: "Сделал" },
  },
} as const satisfies Readonly<Record<string, Readonly<Record<string, Translated<unknown>>>>>;
