/**
 * three/touchController.ts — on-screen touch controls for mobile devices.
 *
 * Renders a left virtual joystick (WASD equivalent), a right look zone, a
 * center "Interact" button (E equivalent), and a top-right "Menu" button
 * (replaces the desktop "Labs" pill). All elements use `touch-action: none`
 * to prevent browser scrolling/zoom and meet the 44x44px tap-target minimum.
 *
 * Activated only when `isTouchDevice()` returns true. Pointer-lock is never
 * requested on touch devices.
 */
import type { PlayerController } from './player';

export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
  );
}

interface JoystickState {
  active: boolean;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
}

export class TouchController {
  private player: PlayerController;
  private container: HTMLDivElement;
  private joystick: HTMLDivElement;
  private joystickKnob: HTMLDivElement;
  private interactBtn: HTMLButtonElement;
  private menuBtn: HTMLButtonElement;
  private lookZone: HTMLDivElement;
  private joystickState: JoystickState = { active: false, originX: 0, originY: 0, currentX: 0, currentY: 0 };
  private lookLast: { x: number; y: number } | null = null;
  private rafId: number | null = null;

  constructor(player: PlayerController, onMenu: () => void) {
    this.player = player;
    this.container = this.buildContainer();
    this.joystick = this.container.querySelector('.tc-joystick') as HTMLDivElement;
    this.joystickKnob = this.container.querySelector('.tc-joystick-knob') as HTMLDivElement;
    this.interactBtn = this.container.querySelector('.tc-interact') as HTMLButtonElement;
    this.menuBtn = this.container.querySelector('.tc-menu') as HTMLButtonElement;
    this.lookZone = this.container.querySelector('.tc-look') as HTMLDivElement;

    this.bindJoystick();
    this.bindLook();
    this.bindInteract();
    this.bindMenu(onMenu);

    document.body.appendChild(this.container);
    this.startTick();
  }

  destroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.container.remove();
  }

  /* ------------------------------------------------------------------ */
  /* DOM construction                                                   */
  /* ------------------------------------------------------------------ */

  private buildContainer(): HTMLDivElement {
    const root = document.createElement('div');
    root.id = 'touch-controller';
    root.style.cssText = `
      position: fixed; inset: 0; pointer-events: none; z-index: 50;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    root.innerHTML = `
      <div class="tc-look"
           style="position:absolute;top:0;right:0;width:50%;height:100%;
                  pointer-events:auto;touch-action:none;background:transparent;">
      </div>
      <div class="tc-joystick"
           style="position:absolute;bottom:24px;left:24px;width:120px;height:120px;
                  border-radius:50%;background:rgba(78,201,176,0.18);
                  border:2px solid rgba(78,201,176,0.5);pointer-events:auto;
                  touch-action:none;display:flex;align-items:center;justify-content:center;">
        <div class="tc-joystick-knob"
             style="width:48px;height:48px;border-radius:50%;
                    background:rgba(78,201,176,0.7);pointer-events:none;
                    transition:transform 0.05s;">
        </div>
      </div>
      <button class="tc-interact" aria-label="Interact (E)"
              style="position:absolute;bottom:36px;left:50%;transform:translateX(-50%);
                     width:64px;height:64px;border-radius:50%;
                     background:rgba(78,201,176,0.9);color:#0e1116;border:none;
                     font-size:24px;font-weight:700;pointer-events:auto;
                     touch-action:none;cursor:pointer;
                     box-shadow:0 2px 8px rgba(0,0,0,0.4);min-width:64px;min-height:64px;">
        E
      </button>
      <button class="tc-menu" aria-label="Open labs menu"
              style="position:absolute;top:12px;right:12px;
                     min-width:48px;min-height:48px;padding:0 14px;
                     background:rgba(27,31,36,0.92);color:#4ec9b0;
                     border:1px solid #2d343d;border-radius:6px;
                     font-size:12px;pointer-events:auto;touch-action:none;
                     cursor:pointer;font-weight:600;">
        ☰ LABS
      </button>
    `;
    return root;
  }

  /* ------------------------------------------------------------------ */
  /* Joystick (WASD)                                                    */
  /* ------------------------------------------------------------------ */

  private bindJoystick(): void {
    const el = this.joystick;
    const setKey = (code: string, down: boolean) => this.player.setKey(code, down);

    const handleMove = (clientX: number, clientY: number) => {
      if (!this.joystickState.active) return;
      this.joystickState.currentX = clientX;
      this.joystickState.currentY = clientY;
    };
    const start = (clientX: number, clientY: number) => {
      this.joystickState.active = true;
      this.joystickState.originX = clientX;
      this.joystickState.originY = clientY;
      this.joystickState.currentX = clientX;
      this.joystickState.currentY = clientY;
    };
    const end = () => {
      this.joystickState.active = false;
      this.joystickKnob.style.transform = 'translate(0, 0)';
      setKey('KeyW', false);
      setKey('KeyS', false);
      setKey('KeyA', false);
      setKey('KeyD', false);
    };

    el.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      if (t) start(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (t) handleMove(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }

  /* ------------------------------------------------------------------ */
  /* Look zone                                                          */
  /* ------------------------------------------------------------------ */

  private bindLook(): void {
    const el = this.lookZone;
    el.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      if (t) this.lookLast = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (!t || !this.lookLast) return;
      const dx = t.clientX - this.lookLast.x;
      const dy = t.clientY - this.lookLast.y;
      this.player.setLookDelta(dx, dy);
      this.lookLast = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchend', () => { this.lookLast = null; });
  }

  /* ------------------------------------------------------------------ */
  /* Interact button                                                    */
  /* ------------------------------------------------------------------ */

  private bindInteract(): void {
    this.interactBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.player.activate();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Menu button                                                        */
  /* ------------------------------------------------------------------ */

  private bindMenu(onMenu: () => void): void {
    this.menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      onMenu();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Per-frame joystick → key translation                              */
  /* ------------------------------------------------------------------ */

  private startTick(): void {
    const tick = () => {
      if (this.joystickState.active) {
        const dx = this.joystickState.currentX - this.joystickState.originX;
        const dy = this.joystickState.currentY - this.joystickState.originY;
        const radius = 40; // deadzone + max deflection in pixels
        const len = Math.sqrt(dx * dx + dy * dy);
        const clamped = Math.min(len, radius);
        const angle = Math.atan2(dy, dx);
        // Move the knob visually
        this.joystickKnob.style.transform =
          `translate(${Math.cos(angle) * clamped}px, ${Math.sin(angle) * clamped}px)`;
        // Translate to WASD
        const nx = dx / Math.max(len, 1);
        const ny = dy / Math.max(len, 1);
        const threshold = 0.4;
        this.player.setKey('KeyW', ny < -threshold);
        this.player.setKey('KeyS', ny >  threshold);
        this.player.setKey('KeyA', nx < -threshold);
        this.player.setKey('KeyD', nx >  threshold);
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
