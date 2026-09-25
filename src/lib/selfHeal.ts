// Automatic recovery helpers. Everything here runs in the browser and costs nothing:
// no external monitoring service, just retrying, reloading stale code and resetting state.

const RELOAD_KEY = 'selfheal:lastReload';
const RELOAD_COOLDOWN_MS = 30_000;

/** Errors that mean the browser is running code from an older deploy. A reload fixes them. */
export function isStaleAssetError(err: unknown): boolean {
  const msg = String((err as Error)?.message || err || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading (CSS )?chunk \d+ failed|Unable to preload CSS/i.test(msg);
}

/** Reloads the page, but never more than once per cooldown, so a real bug can't cause a reload loop. */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* storage blocked: still allow one reload */
  }
  window.location.reload();
  return true;
}

let installed = false;

export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    // A <script>/<link> for an old hashed asset 404'd after a redeploy.
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
      const src = (target as HTMLScriptElement).src || (target as HTMLLinkElement).href || '';
      if (src.includes('/assets/')) reloadOnce();
      return;
    }
    if (isStaleAssetError(event.error || event.message)) reloadOnce();
    else console.error('[self-heal] uncaught error:', event.error || event.message);
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    if (isStaleAssetError(event.reason)) {
      event.preventDefault();
      reloadOnce();
      return;
    }
    console.error('[self-heal] unhandled promise rejection:', event.reason);
  });

  // Vite fires this when a lazy chunk fails to preload.
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadOnce();
  });
}
