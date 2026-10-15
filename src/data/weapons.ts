import type { WeaponDef } from '../core/types';

// 무기: 부산물과 별개로 손에 든다. 3단계에서는 근접과 총기만. 계열 특성·무기 효과·활·마법은 7단계.
export const WEAPONS: WeaponDef[] = [
  // ── 총기 (우주선 무기고) ──
  { id: 'pistol', name: '권총', family: 'gun', grade: 'common', damage: 5, attackCost: 110, range: 6, mag: 6, burden: 1 },
  // ── 근접 (현지 무기) ──
  { id: 'dagger', name: '단검', family: 'melee', grade: 'common', damage: 5, attackCost: 80, range: 1, burden: 1 },
  { id: 'longsword', name: '장검', family: 'melee', grade: 'common', damage: 8, attackCost: 100, range: 1, burden: 2 },
  { id: 'spear', name: '창', family: 'melee', grade: 'common', damage: 8, attackCost: 100, range: 1, burden: 2 },
  { id: 'mace', name: '철퇴', family: 'melee', grade: 'common', damage: 9, attackCost: 110, range: 1, burden: 3 },
  { id: 'greataxe', name: '양손 도끼', family: 'melee', grade: 'common', damage: 12, attackCost: 140, range: 1, burden: 4 },
  { id: 'knight_sword', name: '묘지기 기사의 장검', family: 'melee', grade: 'holy', damage: 11, attackCost: 100, range: 1, burden: 2 },
  { id: 'ogre_club', name: '오우거 몽둥이', family: 'melee', grade: 'holy', damage: 15, attackCost: 140, range: 1, burden: 5 },
];

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
/** 무기 없는 손 */
export const FISTS: WeaponDef = { id: 'fists', name: '맨주먹', family: 'melee', grade: 'common', damage: 2, attackCost: 100, range: 1, burden: 0 };
