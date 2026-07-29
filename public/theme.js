// Applies the stored theme before first paint.
//
// This has to be a classic, synchronous script in <head>. A module script is
// deferred by spec, so it always runs after the document has been parsed — by
// which time the browser has already painted a frame in the wrong theme, which
// is the flash. It cannot be inline either: the page is served with
// script-src 'self', which blocks inline script.
(function () {
  try {
    var stored = localStorage.getItem("compliance-theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
    // With nothing stored the attribute is deliberately left off, so the
    // prefers-color-scheme rules in the stylesheet decide and the first paint
    // is already correct.
  } catch (error) {
    // Storage can be unavailable in a private window; the stylesheet default
    // is a perfectly good answer.
  }
})();
