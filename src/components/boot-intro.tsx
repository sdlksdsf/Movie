/**
 * The boot animation.
 *
 * This is deliberately a *server* component with its animation in CSS: it has
 * to be the first thing painted, before React hydrates and before a single
 * byte of JavaScript runs. Rendering it inside the client shell meant the
 * interface painted first and the title card then slammed in on top of it (or,
 * worse, never appeared at all because the state that showed it started
 * false).
 *
 * Rules the inline script enforces, before paint:
 *   • a session that has already seen it skips straight through (`nf.intro`)
 *   • the player routes (/watch, /play) never get a title card in front of a
 *     stream the visitor just asked for
 *   • reduced-motion visitors skip it
 *   • it plays exactly once per tab: the marker is written the moment we decide
 *     to show it, so a second mount cannot replay it
 */

const SCRIPT = `(function(){
  var el = document.getElementById('nf-boot');
  function kill(){
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
    document.documentElement.classList.add('nf-ready');
  }
  try {
    var seen = sessionStorage.getItem('nf.intro');
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var player = /^\\/(watch|play)(\\/|$)/.test(location.pathname);
    if (seen || calm || player) { kill(); return; }
    sessionStorage.setItem('nf.intro', '1');
  } catch (e) {
    /* private mode: still show it, the CSS timeout below cleans up */
  }
  window.setTimeout(kill, 2500);
})();`;

export function BootIntro() {
  return (
    <>
      <div id="nf-boot" aria-hidden="true">
        <span className="nf-boot-glow" />
        <span className="nf-boot-bars">
          <i />
          <i />
          <i />
        </span>
        <span className="nf-boot-word">NOFLIX</span>
        <span className="nf-boot-rule" />
      </div>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  );
}
