// Gallery login check: the token is read from disk, no network needed. Login is only needed to
// publish recordings, so its absence is not an error.

import { CommandError } from "../errors.ts";
import { failed, notice, passed, type MachineCheck } from "./check.ts";

/**
 * The gallery token is saved; no file is a notice, a broken file is an error. The token is not
 * printed.
 */
export const galleryCheck: MachineCheck = {
  id: "gallery",
  run: async (machine, messages) => {
    const { gallery } = messages.doctor;

    try {
      const token = await machine.credentials.read();

      if (token === undefined) {
        return notice({ summary: gallery.notSignedIn, hint: gallery.signIn });
      }

      return passed(gallery.signedIn);
    } catch (err) {
      if (err instanceof CommandError) {
        return failed({ problem: gallery.corrupt, fix: gallery.signInAgain });
      }

      throw err;
    }
  },
};
