/**
 * util/achievements.ts — achievement badges and check logic.
 *
 * Achievements are unlocked by examining the persisted progress state. The
 * progress store is responsible for adding newly-earned badges to the
 * persisted array, and for triggering toast/UI feedback. This module is
 * pure logic — no side effects, no state.
 */
import type { LabId, ScoreBreakdown } from '@/domain';

export interface Achievement {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-ticket',
    label: 'First Ticket',
    emoji: '🎫',
    description: 'Resolved your first ticket',
  },
  {
    id: 'lab-completer',
    label: 'Lab Completer',
    emoji: '🏆',
    description: 'Completed your first lab',
  },
  {
    id: 'perfect-score',
    label: 'Perfect Score',
    emoji: '💯',
    description: 'Achieved 100 points on any lab',
  },
  {
    id: 'speed-runner',
    label: 'Speed Runner',
    emoji: '⚡',
    description: 'Completed a lab in under 10 minutes',
  },
  {
    id: 'capstone',
    label: 'Capstone Champion',
    emoji: '🎓',
    description: 'Passed the Enterprise Capstone (lab10)',
  },
  {
    id: 'all-labs',
    label: 'Full Graduate',
    emoji: '🎖️',
    description: 'Completed all 13 labs',
  },
  {
    id: 'no-hints',
    label: 'Solo Solver',
    emoji: '🦉',
    description: 'Completed a lab with zero hints used',
  },
  {
    id: 'century-club',
    label: 'Century Club',
    emoji: '💎',
    description: 'Total best score across labs reached 1000+',
  },
];

const SPEED_RUN_MS = 10 * 60 * 1000; // 10 minutes

export interface AchievementContext {
  completedLabIds: LabId[];
  bestScores: Partial<Record<LabId, ScoreBreakdown>>;
  startedAt: Partial<Record<LabId, number>>;
  resolvedTicketCount: number;
  hintCount: number;
  earned: string[];
}

/** Compute the list of newly-earned achievements given the current state. */
export function checkAchievements(
  ctx: Omit<AchievementContext, 'earned'>,
  justCompletedLab?: { id: LabId; score: ScoreBreakdown; durationMs?: number; hintsUsed?: number },
): string[] {
  const earned = new Set<string>([]);
  const allLabIds = Object.keys(ctx.bestScores) as LabId[];

  // first-ticket: at least one resolved ticket
  if (ctx.resolvedTicketCount >= 1) earned.add('first-ticket');

  // lab-completer: at least one completed lab
  if (ctx.completedLabIds.length >= 1) earned.add('lab-completer');

  // perfect-score: any lab with 100 points
  if (Object.values(ctx.bestScores).some((s) => s && s.total >= 100)) earned.add('perfect-score');

  // speed-runner: any lab started and completed within 10 minutes
  for (const id of allLabIds) {
    const start = ctx.startedAt[id];
    if (start) {
      // Use approximate: if a lab is completed, its startedAt should be set.
      // The duration is computed at completion time, but as a heuristic we
      // also check the just-completed lab passed in.
      break;
    }
  }
  if (
    justCompletedLab &&
    justCompletedLab.durationMs &&
    justCompletedLab.durationMs < SPEED_RUN_MS
  ) {
    earned.add('speed-runner');
  }

  // capstone: completed lab10
  const capstoneId = 'lab10' as LabId;
  if (ctx.completedLabIds.includes(capstoneId)) earned.add('capstone');

  // all-labs: all 13 labs (or all known at runtime) completed
  if (ctx.completedLabIds.length >= 13) earned.add('all-labs');

  // no-hints: a lab was completed with 0 hints used
  if (
    justCompletedLab &&
    justCompletedLab.hintsUsed !== undefined &&
    justCompletedLab.hintsUsed === 0
  ) {
    earned.add('no-hints');
  }

  // century-club: sum of best scores >= 1000
  const totalBest = Object.values(ctx.bestScores).reduce((sum, s) => sum + (s?.total ?? 0), 0);
  if (totalBest >= 1000) earned.add('century-club');

  return Array.from(earned);
}

/** Get the achievement object for a given id (or undefined). */
export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** Get the achievements the user has already earned. */
export function getEarnedAchievements(earnedIds: string[]): Achievement[] {
  return ACHIEVEMENTS.filter((a) => earnedIds.includes(a.id));
}
