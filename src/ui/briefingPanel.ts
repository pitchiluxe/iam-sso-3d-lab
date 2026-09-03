/**
 * ui/briefingPanel.ts — DEPRECATED (content moved to objectivesWindow.ts inside the VM).
 *
 * The briefing panel was the floating left-side panel. Its content — lab objectives,
 * step details, evidence list, coaching focus, and tutor button — is now rendered
 * inside the desktop overlay VM as the "Objectives" window. The VM auto-opens when
 * the learner presses E on a workstation in the 3D scene.
 *
 * This stub exists only to avoid breaking the main.ts call site.
 * It does nothing: all briefing content is handled by the Objectives window.
 */
export function initBriefingPanel(): void {
  // No-op. Briefing content is now inside the VM desktop overlay
  // (src/ui/consoles/objectivesWindow.ts).
}
