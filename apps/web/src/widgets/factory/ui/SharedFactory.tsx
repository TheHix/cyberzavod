import { onMount, Show, type JSX } from "solid-js";
import { briefOf } from "@cyberzavod/core";
import { galleryUrl, type SharedRecording } from "@/entities/gallery";
import { $sharedRecording, noticeOf, openSharedRecording } from "@/features/shared-recording";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { languageNoteOf } from "@/shared/lib/language-note.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { Panel } from "@/shared/ui";
import type { BuildProject } from "../lib/build-project.ts";
import { Factory } from "./Factory.tsx";

interface Props {
  /** Язык страницы: на нём подписи цеха и сообщения. */
  locale: Locale;
}

// Карточки проекта у записи из галереи нет: в HUD — автор и проект, ссылка — на галерею автора,
// если она открыта.
function projectOf(shared: SharedRecording, locale: Locale): BuildProject {
  return {
    name: UI_TEXT.sharedRecording.project[locale](shared.owner, shared.record.projectId),
    url: shared.galleryPublic ? galleryUrl(shared.owner, locale) : undefined,
  };
}

/**
 * Цех записи из галереи: запись приходит из API в браузере и проигрывается тем же цехом, что
 * записи журнала проекта. Пока её нет — сообщение в поле, почему.
 * @param {Props} props Свойства компонента.
 * @param {Locale} props.locale Язык страницы.
 * @returns {JSX.Element} Цех с HUD или сообщение.
 */
export function SharedFactory(props: Props): JSX.Element {
  const state = useStoreValue($sharedRecording);
  const shared = () => {
    const current = state();

    return current.status === "ready" ? current.value : undefined;
  };

  onMount(() => void openSharedRecording(window.location.search));

  return (
    <Show
      when={shared()}
      fallback={
        <Panel label={UI_TEXT.pages.floor[props.locale]}>
          <p>{noticeOf(state(), props.locale)}</p>
        </Panel>
      }
    >
      {(ready) => (
        <Factory
          locale={props.locale}
          recording={briefOf(ready().record)}
          project={projectOf(ready(), props.locale)}
          languageNote={languageNoteOf(ready().record.data.language, props.locale)}
        />
      )}
    </Show>
  );
}
