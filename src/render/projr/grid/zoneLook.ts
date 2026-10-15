import type { HemisphereLight } from 'three';
import { zoneOf, type ZoneId } from '../sim';

/** What sets a zone apart at pixel size: ambient light, a tint over the stone, the colour of its fires, its floor litter. */
export interface ZoneLook { color: string; intensity: number; density: number; tint: string; torch: string; flame: string; decal: string }

const LOOKS: Record<ZoneId, ZoneLook> = {
  // dark, but never so dark the floor and foes cannot be read: the hero's own light and torches carry the scene
  // the pack's own sandstone and grey floor show through; a zone only leans its stone and light a little
  // (MODEL 0) 조명 개편: 차갑고 어두운 주변광 + 따뜻한 횃불의 대비. 돌의 입체감은 그림자와 대비가 만든다
  cave: { color: '#7a9cc8', intensity: 1.05, density: 0.6, tint: '#f2ece2', torch: '#ff9a4a', flame: '#ffc070', decal: '#3a3c3e' },
  crypt: { color: '#7588cc', intensity: 1.0, density: 1, tint: '#c4cce0', torch: '#8fb4ff', flame: '#c0d4ff', decal: '#d8d2c0' },
  ruins: { color: '#7aa894', intensity: 1.05, density: 1, tint: '#d4dec2', torch: '#7ff0c0', flame: '#b0ffe0', decal: '#3e6a32' },
};

export const zoneLook = (floor: number): ZoneLook => LOOKS[zoneOf(Math.max(1, floor)).id];

/** Apply the zone's ambient light and return its look, torch density and light budget. */
export function applyZoneLook(hemi: HemisphereLight, floor: number, mobile: boolean): ZoneLook & { lights: number } {
  const look = zoneLook(floor);
  hemi.color.set(look.color);
  // light from below too, so the sides of columns and props never sink to black
  hemi.groundColor.set('#1d2028');
  hemi.intensity = look.intensity;
  // the light count never changes between zones (three.js recompiles every material when it does); only torch models thin out
  return { ...look, lights: mobile ? 3 : 6 };
}
