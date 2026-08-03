// The routing rules live in public/intent.js so the page and the run share one
// copy — see the note there. This module stays as the server's import path for
// them, because everything server-side already reaches for ./router.js and
// moving that would be churn for no gain.
export { routeQuestion, routeReasons, AGENT_META } from "../public/intent.js";
