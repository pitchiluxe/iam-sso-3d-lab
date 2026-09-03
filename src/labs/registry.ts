/**
 * labs/registry.ts — Single source of truth for all 10 labs.
 * Imported by the conductor and the lab-selection UI.
 */
import { LAB_01 } from './lab01';
import { LAB_02 } from './lab02';
import { LAB_03 } from './lab03';
import { LAB_04 } from './lab04';
import { LAB_05 } from './lab05';
import { LAB_06 } from './lab06';
import { LAB_07 } from './lab07';
import { LAB_08 } from './lab08';
import { LAB_09 } from './lab09';
import { LAB_10 } from './lab10';
import { LAB_11 } from './lab11';
import { LAB_12 } from './lab12';
import { LAB_13 } from './lab13';

import type { Lab } from '@/domain';

export const LAB_REGISTRY: ReadonlyArray<Lab> = [
  LAB_01,
  LAB_02,
  LAB_03,
  LAB_04,
  LAB_05,
  LAB_06,
  LAB_07,
  LAB_08,
  LAB_09,
  LAB_10,
  LAB_11,
  LAB_12,
  LAB_13,
] as const;

export const findLab = (id: string): Lab | undefined => LAB_REGISTRY.find((l) => l.id === id);
