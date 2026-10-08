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
    otherBuilds: {
      en: "Below are the reference projects the floor built from scratch. Builds of other projects are in the galleries of Cyberzavod users.",
      ru: "Ниже — эталонные проекты, которые цех собрал с нуля. Сборки других проектов — в галереях пользователей Киберзавода.",
    },
    tokens: {
      en: { one: "token", other: "tokens" },
      ru: { one: "токен", few: "токена", many: "токенов" },
    },
    prompts: {
      en: { one: "prompt", other: "prompts" },
      ru: { one: "промпт", few: "промпта", many: "промптов" },
    },
    builds: {
      en: { one: "build", other: "builds" },
      ru: { one: "сборка", few: "сборки", many: "сборок" },
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
    sharedRecordingTitle: { en: "Recording from a gallery", ru: "Запись из галереи" },
    sharedRecordingDescription: {
      en: "A build recording shared from the Cyberzavod CLI: the floor of AI agents plays it back.",
      ru: "Запись сборки, опубликованная из CLI Киберзавода: её проигрывает цех ИИ-агентов.",
    },
    galleriesTitle: { en: "Galleries", ru: "Галереи" },
    galleriesDescription: {
      en: "Open galleries of Cyberzavod users: build recordings of their projects on the floor of AI agents.",
      ru: "Открытые галереи пользователей Киберзавода: записи сборок их проектов в цехе ИИ-агентов.",
    },
    statsTitle: { en: "Analytics", ru: "Аналитика" },
    cabinetTitle: { en: "Your account", ru: "Личный кабинет" },
    cabinetDescription: {
      en: "Your Cyberzavod gallery: open or close it, see your build recordings and remove the ones you no longer need.",
      ru: "Ваша галерея Киберзавода: открыть или закрыть её, посмотреть записи сборок и удалить лишние.",
    },
    statsDescription: {
      en: "Reference projects side by side — time, tokens, reworks and human input per build — and where the process stalls across open galleries.",
      ru: "Эталонные проекты рядом — время, токены, возвраты и участие человека на сборку — и где процесс буксует в открытых галереях.",
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
  /** Страница «не найдено». */
  notFound: {
    title: { en: "Page not found", ru: "Страница не найдена" },
    label: { en: "404", ru: "404" },
    heading: { en: "There is no such machine on this floor", ru: "Такого станка в цехе нет" },
    text: {
      en: "The page may have moved or the address has a typo. The floor is still running — head back to it.",
      ru: "Возможно, страница переехала или в адресе опечатка. Цех работает как прежде — возвращайтесь в него.",
    },
    toFloor: { en: "Back to the floor", ru: "Вернуться в цех" },
  },
  /** Запись сборки: она не переводится, язык оригинала подписан. */
  recording: {
    language: {
      en: (language: string) => `recorded in ${language}`,
      ru: (language: string) => `язык записи: ${language}`,
    },
  },
  /** Запись из галереи по секретной ссылке: пока её нельзя показать — почему. */
  sharedRecording: {
    loading: { en: "Loading the recording…", ru: "Загружаем запись…" },
    missing: {
      en: "There is no such recording: the link has a typo or the author has removed it.",
      ru: "Такой записи нет: в ссылке опечатка или автор её убрал.",
    },
    broken: {
      en: "The recording did not pass the check — this floor cannot play it.",
      ru: "Запись не прошла проверку — этот цех не может её проиграть.",
    },
    failed: {
      en: "Could not load the recording — try reloading the page.",
      ru: "Не удалось загрузить запись — попробуйте обновить страницу.",
    },
    // Карточки проекта у записи из галереи нет: автор и id проекта, как репозиторий на GitHub.
    project: {
      en: (owner: string, project: string) => `${owner} / ${project}`,
      ru: (owner: string, project: string) => `${owner} / ${project}`,
    },
  },
  /** Данные из API на страницах галерей и аналитики: пока их нельзя показать — почему. */
  remote: {
    loading: { en: "Loading…", ru: "Загружаем…" },
    broken: {
      en: "The server's answer did not pass the check.",
      ru: "Ответ сервера не прошёл проверку.",
    },
    failed: {
      en: "Could not load the data — try reloading the page.",
      ru: "Не удалось загрузить данные — попробуйте обновить страницу.",
    },
  },
  /** Галереи: общий список и галерея автора с бейджем. */
  gallery: {
    listHeading: { en: "Open galleries", ru: "Открытые галереи" },
    listIntro: {
      en: "Authors share build recordings from the CLI with cyberzavod share. A gallery is listed here once its author opens it.",
      ru: "Авторы публикуют записи сборок из CLI командой cyberzavod share. Галерея попадает сюда, когда автор её откроет.",
    },
    noGalleries: { en: "No open galleries yet.", ru: "Открытых галерей пока нет." },
    authorHeading: {
      en: (login: string) => `${login}'s gallery`,
      ru: (login: string) => `Галерея ${login}`,
    },
    noRecordings: { en: "No recordings in this gallery yet.", ru: "В галерее пока нет записей." },
    missing: {
      en: "This gallery is private or does not exist.",
      ru: "Эта галерея закрыта или её нет.",
    },
    updated: {
      en: (date: string) => `updated ${date}`,
      ru: (date: string) => `обновлена ${date}`,
    },
    allGalleries: { en: "All galleries", ru: "Все галереи" },
    badgeHeading: { en: "Badge for README", ru: "Бейдж для README" },
    badgeHint: {
      en: "Paste this line into your project's README: the badge shows the number of builds and links to this gallery.",
      ru: "Вставьте строку в README проекта: бейдж показывает число сборок и ведёт в эту галерею.",
    },
    badgeAlt: {
      en: (login: string) => `Cyberzavod badge: builds of ${login}`,
      ru: (login: string) => `Бейдж Киберзавода: сборки ${login}`,
    },
    copyLabels: {
      en: { idle: "Copy Markdown", copied: "Copied", failed: "Could not copy" },
      ru: { idle: "Копировать Markdown", copied: "Скопировано", failed: "Не удалось скопировать" },
    },
  },
  /** Вход через GitHub: кнопка в меню и в панели записей, сообщение о неудачном входе. */
  account: {
    signIn: { en: "Sign in with GitHub", ru: "Войти через GitHub" },
    // Подпись плитки меню: полная в узкую плитку не помещается, она — в доступном имени и `title`.
    signInShort: { en: "Sign in", ru: "Войти" },
    // Видимая подпись — логин; он входит в доступное имя (WCAG 2.5.3).
    cabinetLabel: {
      en: (login: string) => `${login} — your account`,
      ru: (login: string) => `${login} — личный кабинет`,
    },
    ownGallery: {
      en: "Your own gallery is managed in your account on the site.",
      ru: "Своей галереей управляют в личном кабинете на сайте.",
    },
    signInFailed: {
      en: "Could not sign in with GitHub — please try again.",
      ru: "Не удалось войти через GitHub, попробуйте ещё раз.",
    },
  },
  /** Личный кабинет: своя галерея, записи и подсказка про CLI. */
  cabinet: {
    heading: { en: "Your account", ru: "Личный кабинет" },
    guestIntro: {
      en: "Sign in with GitHub to manage your gallery: open or close it, see your recordings and remove the ones you no longer need.",
      ru: "Войдите через GitHub, чтобы управлять своей галереей: открыть или закрыть её, посмотреть записи и удалить лишние.",
    },
    signOut: { en: "Sign out", ru: "Выйти" },
    galleryHeading: { en: "Gallery", ru: "Галерея" },
    visibilityLabel: { en: "Gallery visibility", ru: "Видимость галереи" },
    private: { en: "Private", ru: "Закрыта" },
    public: { en: "Public", ru: "Открыта" },
    privateHint: {
      en: "Only those who have a link can see your recordings.",
      ru: "Записи видят только те, у кого есть ссылка.",
    },
    publicHint: {
      en: "The gallery is in the list of galleries on the site and counts towards the analytics.",
      ru: "Галерея есть в списке галерей на сайте и входит в аналитику.",
    },
    galleryPage: { en: "Gallery page", ru: "Страница галереи" },
    recordingsHeading: { en: "Recordings", ru: "Записи" },
    usage: {
      en: (count: number, limit: number) => `${count} of ${limit}`,
      ru: (count: number, limit: number) => `${count} из ${limit}`,
    },
    noRecordings: { en: "No recordings in your gallery yet.", ru: "В галерее пока нет записей." },
    delete: { en: "Delete", ru: "Удалить" },
    deleteLabel: {
      en: (title: string) => `Delete “${title}”`,
      ru: (title: string) => `Удалить «${title}»`,
    },
    deleteQuestion: {
      en: "Delete this recording? Its link will stop working.",
      ru: "Удалить запись? Ссылка на неё перестанет работать.",
    },
    cancel: { en: "Cancel", ru: "Отмена" },
    changeFailed: {
      en: "Could not save the change — please try again.",
      ru: "Не удалось сохранить изменение, попробуйте ещё раз.",
    },
    cliHeading: { en: "Recordings from your project", ru: "Записи из проекта" },
    shareHint: {
      en: "Recordings are uploaded from the project with this command; id is the file name in sessions/ of the journal:",
      ru: "Записи загружаются из проекта командой; id — имя файла в sessions/ журнала:",
    },
    loginHint: {
      en: "Before that, sign in to the CLI:",
      ru: "Перед этим войдите в CLI:",
    },
  },
  /** Аналитика по записям открытых галерей. */
  stats: {
    heading: { en: "Build analytics", ru: "Аналитика сборок" },
    intro: {
      en: "Builds from open galleries: where the process stalls, how many tokens it takes and when a human is called.",
      ru: "Сборки из открытых галерей: где процесс буксует, сколько уходит токенов и когда зовут человека.",
    },
    empty: {
      en: "There are no builds in open galleries yet — nothing to count.",
      ru: "В открытых галереях пока нет сборок — считать нечего.",
    },
    builds: { en: "Builds", ru: "Сборки" },
    authors: { en: "Authors", ru: "Авторы" },
    returnsHeading: { en: "Reworks by stage", ru: "Возвраты по этапам" },
    interventionsHeading: { en: "Interventions by reason", ru: "Вмешательства по причинам" },
    outcomesHeading: { en: "Build outcomes", ru: "Исходы сборок" },
    succeeded: { en: "succeeded", ru: "успешно" },
    failed: { en: "failed", ru: "с ошибкой" },
    none: { en: "None so far.", ru: "Пока не было." },
  },
  /** Панель «Проект»: итоги сборок проекта и сами сборки по порядку задач. */
  projectPanel: {
    totalsHeading: { en: "Totals", ru: "Итоги" },
    buildsHeading: { en: "Builds in task order", ru: "Сборки по порядку задач" },
    builds: { en: "Builds", ru: "Сборки" },
    duration: { en: "Total time", ru: "Общее время" },
    durationPerBuild: { en: "Per build on average", ru: "В среднем на сборку" },
    tokens: { en: "Total tokens", ru: "Токены всего" },
    reworks: { en: "Reworks", ru: "Возвраты" },
    withoutReworks: {
      en: (clean: number, builds: number) => `${clean} of ${builds} without reworks`,
      ru: (clean: number, builds: number) => `без возвратов ${clean} из ${builds}`,
    },
    human: { en: "Human input", ru: "Участие человека" },
    interventions: {
      en: { one: "intervention", other: "interventions" },
      ru: { one: "вмешательство", few: "вмешательства", many: "вмешательств" },
    },
  },
  /** Аналитика: сравнение эталонных проектов при сборке сайта и раздел открытых галерей. */
  statsSections: {
    referenceHeading: { en: "Reference projects", ru: "Эталонные проекты" },
    referenceIntro: {
      en: "Projects the floor built from scratch with the same process, compared per build. Counted from the build recordings on this site.",
      ru: "Проекты, которые цех собрал с нуля по одному процессу, — в пересчёте на сборку. Посчитано по записям сборок на этом сайте.",
    },
    durationPerBuild: { en: "Time per build on average", ru: "Время в среднем на сборку" },
    tokensPerBuild: { en: "Tokens per build on average", ru: "Токены в среднем на сборку" },
    reworksPerBuild: { en: "Reworks per build", ru: "Возвраты на сборку" },
    human: {
      en: "Human input: prompts and interventions",
      ru: "Участие человека: промпты и вмешательства",
    },
    galleriesHeading: { en: "Open galleries", ru: "Открытые галереи" },
  },
  /** Галереи: примеры — эталонные проекты сайта над галереями пользователей. */
  examples: {
    heading: { en: "Examples", ru: "Примеры" },
    intro: {
      en: "Reference projects the floor built from scratch: every build can be watched on the floor.",
      ru: "Эталонные проекты, которые цех собрал с нуля: каждую сборку можно посмотреть в цехе.",
    },
    userGalleriesHeading: { en: "User galleries", ru: "Галереи пользователей" },
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
  /** Серия сборок на главной и странице проекта: место сборки в HUD и журнал текущей сборки. */
  series: {
    buildOf: {
      en: (number: number, count: number) => `build ${number} of ${count}`,
      ru: (number: number, count: number) => `сборка ${number} из ${count}`,
    },
    journalLoading: { en: "Loading the build log…", ru: "Загружаем журнал сборки…" },
    journalMissing: {
      en: "The log of this build was not found — try reloading the page.",
      ru: "Журнал этой сборки не нашёлся — попробуйте обновить страницу.",
    },
    journalBroken: {
      en: "The log of this build did not pass the check.",
      ru: "Журнал этой сборки не прошёл проверку.",
    },
    journalFailed: {
      en: "Could not load the build log — try reloading the page.",
      ru: "Не удалось загрузить журнал сборки — попробуйте обновить страницу.",
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
