/**
 * ui/desktopBus.ts — lets a window inside the main VM open another desktop
 * app (the AD Lab and the Portfolio open DC01 and CLIENT01) without holding
 * a reference to the desktop, and without an import cycle.
 */
export const OPEN_APP_EVENT = 'desktop:open-app';

/** Open (or focus) a desktop app by id. */
export function openDesktopApp(id: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_APP_EVENT, { detail: id }));
}
