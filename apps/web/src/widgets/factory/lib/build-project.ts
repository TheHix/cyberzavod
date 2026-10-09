/**
 * Build project in the HUD: the name and an address if there is somewhere to lead: the project page
 * (`ProjectLink`) or the gallery of the recording's author; a recording from a private gallery has
 * no address.
 */
export interface BuildProject {
  readonly name: string;
  readonly url: string | undefined;
}
