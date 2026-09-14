/**
 * labs/registry.ts — Single source of truth for all 26 labs.
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
import { LAB_14 } from './lab14';
import { LAB_15 } from './lab15';
import { LAB_16 } from './lab16';
import { LAB_17 } from './lab17';
import { LAB_18 } from './lab18';
import { LAB_19 } from './lab19';
import { LAB_20 } from './lab20';
import { LAB_21 } from './lab21';
import { LAB_22 } from './lab22';
import { LAB_23 } from './lab23';
import { LAB_24 } from './lab24';
import { LAB_25 } from './lab25';
import { LAB_26 } from './lab26';

import type { Lab } from '@/domain';
import { generatedLabsStore } from '@/stores/generatedLabsStore';

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
  LAB_14,
  LAB_15,
  LAB_16,
  LAB_17,
  LAB_18,
  LAB_19,
  LAB_20,
  LAB_21,
  LAB_22,
  LAB_23,
  LAB_24,
  LAB_25,
  LAB_26,
] as const;

export const findLab = (id: string): Lab | undefined =>
  LAB_REGISTRY.find((l) => l.id === id) ??
  generatedLabsStore.getState().labs.find((l) => l.id === id);
