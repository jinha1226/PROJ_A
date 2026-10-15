import type { WeaponDef, WeaponTrait } from '../core/types';

// 무기 = 계열 특성 + 색 + 옵션 0~2개. 색은 7단계(색 성장)에서 피해 배율이 붙는다.
export const WEAPONS: WeaponDef[] = [
  // ── 총기 (우주선 무기고) ──
  { id: 'pistol', name: '권총', family: 'gun', grade: 'common', colors: ['tactics'], damage: 5, attackCost: 110, range: 6, mag: 6, burden: 1 },
  // ── 활 (현지) ──
  { id: 'longbow', name: '장궁', family: 'bow', grade: 'common', colors: ['tactics'], trait: 'fresh', damage: 6, attackCost: 125, range: 7, burden: 2 },
  // ── 원소 지팡이 (현지): 충전식, 재장전 없음 ──
  { id: 'fire_staff', name: '화염 지팡이', family: 'magic', grade: 'common', colors: ['tactics'], trait: 'arcane', element: 'fire', damage: 4, attackCost: 100, range: 5, mag: 4, recharge: 3, burden: 1 },
  { id: 'frost_staff', name: '서리 지팡이', family: 'magic', grade: 'common', colors: ['tactics'], trait: 'arcane', element: 'cold', damage: 4, attackCost: 100, range: 5, mag: 4, recharge: 3, burden: 1 },
  { id: 'storm_staff', name: '폭풍 지팡이', family: 'magic', grade: 'common', colors: ['tactics'], trait: 'arcane', element: 'lightning', damage: 4, attackCost: 100, range: 5, mag: 4, recharge: 3, burden: 1 },
  // ── 근접 (현지 무기) ──
  { id: 'dagger', name: '단검', family: 'melee', grade: 'common', colors: ['power'], trait: 'ambush', damage: 5, attackCost: 80, range: 1, burden: 1 },
  { id: 'longsword', name: '장검', family: 'melee', grade: 'common', colors: ['power'], trait: 'parry', damage: 8, attackCost: 100, range: 1, burden: 2 },
  { id: 'spear', name: '창', family: 'melee', grade: 'common', colors: ['power', 'survival'], trait: 'pierce', damage: 8, attackCost: 100, range: 1, burden: 2 },
  { id: 'mace', name: '철퇴', family: 'melee', grade: 'common', colors: ['survival'], trait: 'smash', damage: 9, attackCost: 110, range: 1, burden: 3 },
  { id: 'greataxe', name: '양손 도끼', family: 'melee', grade: 'common', colors: ['power'], trait: 'cleave', damage: 12, attackCost: 140, range: 1, burden: 4 },
  { id: 'shield', name: '방패', family: 'melee', grade: 'common', colors: ['survival'], trait: 'block', damage: 3, attackCost: 100, range: 1, burden: 2 },
  { id: 'knight_sword', name: '묘지기 기사의 장검', family: 'melee', grade: 'holy', colors: ['power', 'survival'], trait: 'parry', damage: 11, attackCost: 100, range: 1, burden: 2 },
  { id: 'ogre_club', name: '오우거 몽둥이', family: 'melee', grade: 'holy', colors: ['survival'], trait: 'smash', damage: 15, attackCost: 140, range: 1, burden: 5 },
];

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
/** 무기 없는 손 */
export const FISTS: WeaponDef = { id: 'fists', name: '맨주먹', family: 'melee', grade: 'common', colors: ['power'], damage: 2, attackCost: 100, range: 1, burden: 0 };

export const TRAIT_TEXT: Record<WeaponTrait, string> = {
  ambush: '기습: 잠들었거나 기절·빙결한 적에게 치명타',
  parry: '패링: 근접 공격을 20% 확률로 쳐냄',
  cleave: '휩쓸기: 주변의 다른 적에게도 절반 피해',
  pierce: '관통: 대상 바로 뒤의 적도 찌름',
  smash: '강타: 맞은 적을 1칸 밀침. 막히면 기절',
  block: '막기: 어느 손에 있든 공격을 25% 확률로 막고, 막으면 다음 공격 치명타',
  fresh: '첫 발: 상처 없는 적에게 치명타',
  arcane: '원소: 원소를 남기고 옆의 적 하나에게 절반이 튐',
};
