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
  /** Page language: floor captions and messages are in it. */
  locale: Locale;
}

// A gallery recording has no project card: the HUD shows the author and the project, the link
// leads to the author's gallery if it is public.
function projectOf(shared: SharedRecording, locale: Locale): BuildProject {
  return {
    name: UI_TEXT.sharedRecording.project[locale](shared.owner, shared.record.projectId),
    url: shared.galleryPublic ? galleryUrl(shared.owner, locale) : undefined,
  };
}

/**
 * Factory of a gallery recording: the recording comes from the API in the browser and plays on the
 * same floor as the project journal recordings. While it is missing, a message in the field says
 * why.
 * @param {Props} props Component props.
 * @param {Locale} props.locale Page language.
 * @returns {JSX.Element} The factory with the HUD, or a message.
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
