// Aplikacja na telefon (PWA): service worker, przycisk „Zainstaluj”, wykrycie trybu pełnoekranowego.
let deferred = null;
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const canInstall = () => !!deferred;
export async function install() {
  if (!deferred) return false;
  deferred.prompt();
  const r = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }));
  deferred = null; dispatchEvent(new Event('pj-install'));
  return r.outcome === 'accepted';
}
export function setupPWA() {
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; dispatchEvent(new Event('pj-install')); });
  addEventListener('appinstalled', () => { deferred = null; dispatchEvent(new Event('pj-install')); });
  // tylko na prawdziwej stronie (https / localhost), nie w podglądzie w ramce
  const ok = 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && window.top === window;
  if (ok) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}
