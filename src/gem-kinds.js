// What each gem produces, read from the gem catalogue the interface uses.
//
// The catalogue lives in public/ because the browser renders it; the server
// needs the same answer and must not keep a second copy that can drift. So it
// imports the one list, and this module exists only to narrow it to the field
// the orchestrator cares about.
import { GEMS } from "../public/gems.js";

export const GEM_KINDS = Object.freeze(Object.fromEntries(GEMS.map((gem) => [gem.id, gem.kind])));
