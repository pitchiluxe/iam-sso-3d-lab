/**
 * three/materials.ts — cached material palettes per zone.
 *
 * Returns cached THREE.Material instances so the same GPU texture is reused
 * across meshes within a zone and across zone rebuilds.
 */
import * as THREE from 'three';
import type { ZoneId } from './zones';

interface Palette {
  floor: THREE.Material;
  wall: THREE.Material;
  accent: THREE.Material;
  desk: THREE.Material;
  screen: THREE.Material;
  screenOff: THREE.Material;
  chair: THREE.Material;
  rack: THREE.Material;
  signBg: THREE.Material;
  [key: string]: THREE.Material;
}

/** All palettes, lazily initialized. */
const cache = new Map<ZoneId, Palette>();

const COMMON = {
  screenOff: new THREE.MeshStandardMaterial({ color: '#0d1014', emissive: '#0d1014', emissiveIntensity: 0 }),
};

function mkPalette(z: ZoneId): Palette {
  switch (z) {
    case 'sec-ops':
      return {
        floor:   new THREE.MeshStandardMaterial({ color: '#141820', roughness: 0.95 }),
        wall:    new THREE.MeshStandardMaterial({ color: '#1a2030', roughness: 0.9 }),
        accent:  new THREE.MeshStandardMaterial({ color: '#4ec9b0', roughness: 0.4, emissive: '#003d35', emissiveIntensity: 0.5 }),
        desk:    new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.7, metalness: 0.3 }),
        screen:  new THREE.MeshStandardMaterial({ color: '#001a14', emissive: '#f48771', emissiveIntensity: 0.8 }),
        screenOff: COMMON.screenOff,
        chair:   new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.8, metalness: 0.2 }),
        rack:    new THREE.MeshStandardMaterial({ color: '#0d1014', roughness: 0.5, metalness: 0.6 }),
        signBg:  new THREE.MeshStandardMaterial({ color: '#f48771', roughness: 0.5 }),
      };
    case 'hr':
      return {
        floor:   new THREE.MeshStandardMaterial({ color: '#f5e6d0', roughness: 0.95 }),
        wall:    new THREE.MeshStandardMaterial({ color: '#fff5e0', roughness: 0.9 }),
        accent:  new THREE.MeshStandardMaterial({ color: '#d7ba7d', roughness: 0.4, emissive: '#3d2e10', emissiveIntensity: 0.3 }),
        desk:    new THREE.MeshStandardMaterial({ color: '#c9a96e', roughness: 0.8 }),
        screen:  new THREE.MeshStandardMaterial({ color: '#1a1000', emissive: '#d7ba7d', emissiveIntensity: 0.8 }),
        screenOff: COMMON.screenOff,
        chair:   new THREE.MeshStandardMaterial({ color: '#8b7355', roughness: 0.9 }),
        rack:    new THREE.MeshStandardMaterial({ color: '#3b3020', roughness: 0.7 }),
        signBg:  new THREE.MeshStandardMaterial({ color: '#d7ba7d', roughness: 0.5 }),
      };
    case 'help-desk':
      return {
        floor:   new THREE.MeshStandardMaterial({ color: '#e8eef4', roughness: 0.95 }),
        wall:    new THREE.MeshStandardMaterial({ color: '#f0f4f8', roughness: 0.9 }),
        accent:  new THREE.MeshStandardMaterial({ color: '#4ec9b0', roughness: 0.4, emissive: '#003d35', emissiveIntensity: 0.4 }),
        desk:    new THREE.MeshStandardMaterial({ color: '#d0d8e4', roughness: 0.7 }),
        screen:  new THREE.MeshStandardMaterial({ color: '#001a14', emissive: '#4ec9b0', emissiveIntensity: 0.9 }),
        screenOff: COMMON.screenOff,
        chair:   new THREE.MeshStandardMaterial({ color: '#4ec9b0', roughness: 0.8 }),
        rack:    new THREE.MeshStandardMaterial({ color: '#c0c8d4', roughness: 0.7 }),
        signBg:  new THREE.MeshStandardMaterial({ color: '#4ec9b0', roughness: 0.5 }),
      };
    case 'finance':
      return {
        floor:   new THREE.MeshStandardMaterial({ color: '#3b2e1e', roughness: 0.9 }),
        wall:    new THREE.MeshStandardMaterial({ color: '#4a3828', roughness: 0.9 }),
        accent:  new THREE.MeshStandardMaterial({ color: '#c9a96e', roughness: 0.3, emissive: '#3d2e10', emissiveIntensity: 0.3 }),
        desk:    new THREE.MeshStandardMaterial({ color: '#5c3d28', roughness: 0.8, metalness: 0.1 }),
        screen:  new THREE.MeshStandardMaterial({ color: '#1a1000', emissive: '#c9a96e', emissiveIntensity: 0.9 }),
        screenOff: COMMON.screenOff,
        chair:   new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.8, metalness: 0.3 }),
        rack:    new THREE.MeshStandardMaterial({ color: '#2d2018', roughness: 0.7 }),
        signBg:  new THREE.MeshStandardMaterial({ color: '#c9a96e', roughness: 0.4 }),
      };
    case 'engineering':
      return {
        floor:   new THREE.MeshStandardMaterial({ color: '#1a2030', roughness: 0.95 }),
        wall:    new THREE.MeshStandardMaterial({ color: '#232840', roughness: 0.9 }),
        accent:  new THREE.MeshStandardMaterial({ color: '#90b8ff', roughness: 0.4, emissive: '#001a40', emissiveIntensity: 0.5 }),
        desk:    new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.7 }),
        screen:  new THREE.MeshStandardMaterial({ color: '#001428', emissive: '#90b8ff', emissiveIntensity: 0.9 }),
        screenOff: COMMON.screenOff,
        chair:   new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.8 }),
        rack:    new THREE.MeshStandardMaterial({ color: '#141820', roughness: 0.5, metalness: 0.4 }),
        signBg:  new THREE.MeshStandardMaterial({ color: '#90b8ff', roughness: 0.5 }),
      };
    case 'app-center':
      return {
        floor:   new THREE.MeshStandardMaterial({ color: '#0e1820', roughness: 0.95 }),
        wall:    new THREE.MeshStandardMaterial({ color: '#141c24', roughness: 0.9 }),
        accent:  new THREE.MeshStandardMaterial({ color: '#4ec9b0', roughness: 0.3, emissive: '#003d35', emissiveIntensity: 0.7 }),
        desk:    new THREE.MeshStandardMaterial({ color: '#1a2030', roughness: 0.7, metalness: 0.3 }),
        screen:  new THREE.MeshStandardMaterial({ color: '#001a14', emissive: '#4ec9b0', emissiveIntensity: 1.0 }),
        screenOff: COMMON.screenOff,
        chair:   new THREE.MeshStandardMaterial({ color: '#1a2030', roughness: 0.8, metalness: 0.2 }),
        rack:    new THREE.MeshStandardMaterial({ color: '#141820', roughness: 0.5, metalness: 0.5 }),
        signBg:  new THREE.MeshStandardMaterial({ color: '#4ec9b0', roughness: 0.4 }),
      };
    case 'reception':
      return {
        floor:   new THREE.MeshStandardMaterial({ color: '#e8dcc8', roughness: 0.7 }),
        wall:    new THREE.MeshStandardMaterial({ color: '#f0e8d8', roughness: 0.9 }),
        accent:  new THREE.MeshStandardMaterial({ color: '#c9a96e', roughness: 0.3, emissive: '#3d2e10', emissiveIntensity: 0.3 }),
        desk:    new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.8 }),
        screen:  new THREE.MeshStandardMaterial({ color: '#1a1000', emissive: '#c9a96e', emissiveIntensity: 0.8 }),
        screenOff: COMMON.screenOff,
        chair:   new THREE.MeshStandardMaterial({ color: '#8b7355', roughness: 0.9 }),
        rack:    new THREE.MeshStandardMaterial({ color: '#3b3020', roughness: 0.7 }),
        signBg:  new THREE.MeshStandardMaterial({ color: '#c9a96e', roughness: 0.4 }),
      };
    default: // iam-ops (also default)
      return {
        floor:   new THREE.MeshStandardMaterial({ color: '#1b1f24', roughness: 0.95 }),
        wall:    new THREE.MeshStandardMaterial({ color: '#232830', roughness: 0.9 }),
        accent:  new THREE.MeshStandardMaterial({ color: '#4ec9b0', roughness: 0.5, emissive: '#0a3a32', emissiveIntensity: 0.4 }),
        desk:    new THREE.MeshStandardMaterial({ color: '#3b3f48', roughness: 0.7 }),
        screen:  new THREE.MeshStandardMaterial({ color: '#0a3a32', emissive: '#4ec9b0', emissiveIntensity: 0.8 }),
        screenOff: COMMON.screenOff,
        chair:   new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.8 }),
        rack:    new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.5, metalness: 0.4 }),
        signBg:  new THREE.MeshStandardMaterial({ color: '#4ec9b0', roughness: 0.5 }),
      };
  }
}

export function getPalette(zone: ZoneId): Palette {
  let p = cache.get(zone);
  if (!p) { p = mkPalette(zone); cache.set(zone, p); }
  return p;
}

