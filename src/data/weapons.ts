import type { WeaponDef, WeaponTrait } from '../core/types';

// 무기 = 고유 효과(치명타 조건 등) + 색 + 옵션 0~2개. 데드셀 무기를 턴제로 각색했다. 색 배율은 7단계에서.
export const WEAPONS: WeaponDef[] = [
  // ── 근접 ──
  { id: 'dagger', name: '암살자의 단검', family: 'melee', grade: 'common', colors: ['power'], trait: 'ambush', damage: 5, attackCost: 80, range: 1, burden: 1 },
  { id: 'longsword', name: '장검', family: 'melee', grade: 'common', colors: ['power'], trait: 'combo3', damage: 8, attackCost: 100, range: 1, burden: 2 },
  { id: 'balanced', name: '균형 잡힌 검', family: 'melee', grade: 'common', colors: ['power'], trait: 'balanced', damage: 7, attackCost: 100, range: 1, burden: 2 },
  { id: 'grudge', name: '원한의 검', family: 'melee', grade: 'common', colors: ['power', 'survival'], trait: 'grudge', damage: 8, attackCost: 100, range: 1, burden: 2 },
  { id: 'desperate', name: '필사의 검', family: 'melee', grade: 'common', colors: ['power'], trait: 'desperate', damage: 9, attackCost: 100, range: 1, burden: 2 },
  { id: 'hatchet', name: '처형 손도끼', family: 'melee', grade: 'common', colors: ['power'], trait: 'execute', damage: 8, attackCost: 100, range: 1, burden: 2 },
  { id: 'spear', name: '전쟁용 창', family: 'melee', grade: 'common', colors: ['power', 'survival'], trait: 'pierce', damage: 8, attackCost: 100, range: 1, burden: 2 },
  { id: 'harpoon', name: '작살', family: 'melee', grade: 'common', colors: ['survival'], trait: 'harpoon', damage: 7, attackCost: 100, range: 1, burden: 2 },
  { id: 'mace', name: '철퇴', family: 'melee', grade: 'common', colors: ['survival'], trait: 'fourth', damage: 9, attackCost: 110, range: 1, burden: 3 },
  { id: 'nutcracker', name: '호두까개', family: 'melee', grade: 'common', colors: ['survival'], trait: 'nutcracker', damage: 9, attackCost: 110, range: 1, burden: 3 },
  { id: 'greataxe', name: '양손 도끼', family: 'melee', grade: 'common', colors: ['power'], trait: 'cleave', damage: 12, attackCost: 140, range: 1, burden: 4 },
  { id: 'sadist', name: '가학성애자의 비수', family: 'melee', grade: 'common', colors: ['power'], trait: 'sadist', damage: 5, attackCost: 80, range: 1, burden: 1 },
  { id: 'torch', name: '횃불', family: 'melee', grade: 'common', colors: ['power'], trait: 'torch', damage: 5, attackCost: 90, range: 1, burden: 1 },
  { id: 'shield', name: '방패', family: 'melee', grade: 'common', colors: ['survival'], trait: 'block', damage: 3, attackCost: 100, range: 1, burden: 2 },
  { id: 'ogre_club', name: '오우거 몽둥이', family: 'melee', grade: 'holy', colors: ['survival'], trait: 'smash', damage: 15, attackCost: 140, range: 1, burden: 5 },
  { id: 'knight_sword', name: '묘지기 기사의 장검', family: 'melee', grade: 'holy', colors: ['power', 'survival'], trait: 'combo3', damage: 11, attackCost: 100, range: 1, burden: 2 },
  // 고유 무기: 보스·정예가 떨어뜨린다
  { id: 'giantkiller', name: '거인살해자', family: 'melee', grade: 'holy', unique: true, colors: ['power'], trait: 'giant', damage: 10, attackCost: 100, range: 1, burden: 3 },
  { id: 'flawless', name: '완전무결', family: 'melee', grade: 'holy', unique: true, colors: ['power'], trait: 'flawless', damage: 10, attackCost: 100, range: 1, burden: 2 },
  { id: 'pyre_blade', name: '화형 집행자의 검', family: 'melee', grade: 'holy', unique: true, colors: ['power'], trait: 'pyreBlade', damage: 9, attackCost: 100, range: 1, burden: 2 },
  // ── 총기 (우주선 무기고) ──
  { id: 'pistol', name: '권총', family: 'gun', grade: 'common', colors: ['tactics'], trait: 'lastShot', damage: 5, attackCost: 110, range: 6, mag: 6, burden: 1 },
  { id: 'shotgun', name: '산탄총', family: 'gun', grade: 'common', colors: ['power'], trait: 'scatter', damage: 6, attackCost: 120, range: 3, mag: 2, burden: 3 },
  { id: 'rifle', name: '소총', family: 'gun', grade: 'common', colors: ['tactics'], trait: 'steady', damage: 9, attackCost: 130, range: 9, mag: 3, burden: 3 },
  // ── 활 (현지) ──
  { id: 'longbow', name: '명사수의 활', family: 'bow', grade: 'common', colors: ['tactics'], trait: 'marksman', damage: 6, attackCost: 125, range: 8, burden: 2 },
  { id: 'infantry_bow', name: '보병용 활', family: 'bow', grade: 'common', colors: ['tactics'], trait: 'pointBlank', damage: 5, attackCost: 100, range: 5, burden: 2 },
  { id: 'repeater', name: '연사 쇠뇌', family: 'bow', grade: 'common', colors: ['tactics'], trait: 'repeater', damage: 4, attackCost: 90, range: 5, mag: 5, burden: 2 },
  { id: 'knives', name: '투척 단검', family: 'bow', grade: 'common', colors: ['tactics', 'power'], trait: 'knives', damage: 4, attackCost: 80, range: 4, mag: 3, recharge: 2, burden: 1 },
  // ── 원소 지팡이 (현지): 충전식, 재장전 없음 ──
  { id: 'fire_staff', name: '화염 지팡이', family: 'magic', grade: 'common', colors: ['tactics'], trait: 'pyro', element: 'fire', damage: 4, attackCost: 100, range: 5, mag: 4, recharge: 3, burden: 1 },
  { id: 'frost_staff', name: '서리 지팡이', family: 'magic', grade: 'common', colors: ['tactics'], trait: 'frost', element: 'cold', damage: 4, attackCost: 100, range: 5, mag: 4, recharge: 3, burden: 1 },
  { id: 'storm_staff', name: '폭풍 지팡이', family: 'magic', grade: 'common', colors: ['tactics'], trait: 'storm', element: 'lightning', damage: 4, attackCost: 100, range: 5, mag: 4, recharge: 3, burden: 1 },
];

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
/** 무기 없는 손 */
export const FISTS: WeaponDef = { id: 'fists', name: '맨주먹', family: 'melee', grade: 'common', colors: ['power'], damage: 2, attackCost: 100, range: 1, burden: 0 };

export const TRAIT_TEXT: Record<WeaponTrait, string> = {
  ambush: '잠들었거나 기절·빙결한 적에게 치명타',
  combo3: '같은 적을 연속으로 칠 때 3번째마다 치명타',
  balanced: '같은 적을 연속으로 칠수록 +15%(최대 +60%), 5번째부터 치명타',
  grudge: '직전 적의 차례에 맞았다면 치명타',
  desperate: '내 체력 50% 미만이면 치명타',
  execute: '대상 체력 40% 미만이면 치명타',
  pierce: '대상 뒤의 적도 찌르고, 둘을 함께 맞히면 둘 다 치명타',
  harpoon: '맞은 적을 밀침. 대상 뒤가 막혀 있으면 치명타',
  fourth: '이 무기로 4번째 공격마다 치명타',
  nutcracker: '기절·빙결한 적에게 치명타',
  cleave: '주변의 다른 적에게도 절반. 주변에 적이 3명 이상이면 치명타',
  sadist: '맞은 적에게 출혈. 출혈·중독 적에게 치명타',
  torch: '맞은 적에게 화상 (치명타 없음)',
  block: '어느 손에 있든 공격을 25% 막음. 막으면 다음 공격 치명타',
  smash: '맞은 적을 밀침. 막히면 2턴 기절',
  giant: '정예·보스에게 치명타',
  flawless: '3턴 동안 피해를 받지 않았으면 치명타',
  pyreBlade: '불붙은 적에게 치명타',
  lastShot: '탄창의 마지막 한 발은 치명타',
  scatter: '대상과 그 옆의 적 둘까지 60%. 붙어 있는 적에게 치명타',
  steady: '대기·재장전한 다음 사격 치명타',
  marksman: '4칸 이상 떨어진 적에게 치명타',
  pointBlank: '붙어 있는 적에게 치명타',
  repeater: '둔화·빙결한 적에게 치명타',
  knives: '맞은 적에게 출혈. 2턴마다 1회 충전',
  pyro: '맞은 적에게 화상. 기름 묻은 적에게 치명타. 3턴마다 1회 충전',
  frost: '맞은 적 둔화, 이미 둔화면 빙결. 3턴마다 1회 충전',
  storm: '옆의 적 둘에게 절반이 튐. 3턴마다 1회 충전',
};
