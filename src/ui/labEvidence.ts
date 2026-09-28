/**
 * ui/labEvidence.ts — file what the learner just did as evidence for the lab.
 *
 * Lifted out of the old IAM Console so Active Directory Users and Computers,
 * which replaces it, keeps producing the same evidence: every successful action
 * is filed against the lab's current step, labelled the way the console
 * labelled it ("Created user: alex.morgan"), so step progress and the debrief
 * are unchanged.
 */
import { evidenceStore } from '@/stores';
import { mkEvidenceId } from '@/domain';
import type { Evidence, Lab } from '@/domain';

export function recordLabEvidence(
  kind: Evidence['kind'],
  label: string,
  fallbackStepId = 's1',
): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    __lab?: { get?(): Lab | null };
    __labState?: { stepIndex: number };
  };
  const lab = w.__lab?.get?.() ?? null;
  const stepIdx = w.__labState?.stepIndex ?? 0;
  const ev: Evidence = {
    id: mkEvidenceId(),
    labId: lab?.id ?? ('unknown' as never),
    stepId: lab?.steps[stepIdx]?.id ?? fallbackStepId,
    kind,
    capturedAt: Date.now(),
    label,
    payload: {},
  };
  evidenceStore.getState().add(ev);
}
