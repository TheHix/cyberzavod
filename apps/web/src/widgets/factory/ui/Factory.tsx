import { untrack, type JSX } from "solid-js";
import { type BriefSessionRecord } from "@cyberzavod/core";
import type { Locale } from "@/shared/i18n/locale.ts";
import type { BuildProject } from "../lib/build-project.ts";
import { createFactoryModel } from "../model/factory.ts";
import { FactoryFloor } from "./FactoryFloor.tsx";

interface Props {
  recording: BriefSessionRecord;
  /** Page language: floor, HUD and bubble captions are in it. */
  locale: Locale;
  /**
   * The project that was built, in the HUD; a link to its page or the author's gallery, if any.
   */
  project: BuildProject;
  /**
   * Note about the recording's original language; absent if the recording is in the page language.
   */
  languageNote: string | undefined;
  /** Level of the heading with the build name; by default the main page heading. */
  titleLevel?: "h1" | "h2" | undefined;
}

/**
 * A live full-screen factory that plays one build recording: workers at machines, running with the
 * part, the foreman's office, prompts, interventions and messages above the speakers, the build
 * HUD on the right with a project link. The graphics load only in the browser.
 * @param {Props} props Component props.
 * @param {BriefSessionRecord} props.recording The build recording the floor plays.
 * @param {Locale} props.locale Page language.
 * @param {BuildProject} props.project The project that was built.
 * @param {string | undefined} props.languageNote Note about the recording's original language.
 * @param {"h1" | "h2"} [props.titleLevel] Level of the heading with the build name.
 * @returns {JSX.Element} The factory with the HUD.
 */
export function Factory(props: Props): JSX.Element {
  // The island's recording does not change: the model is created once.
  const model = createFactoryModel(untrack(() => props.recording));

  return (
    <FactoryFloor
      model={model}
      locale={props.locale}
      project={props.project}
      languageNote={props.languageNote}
      position={undefined}
      titleLevel={props.titleLevel ?? "h1"}
    />
  );
}
