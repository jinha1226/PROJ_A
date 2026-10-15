import type { WeaponDef, WeaponTrait } from '../core/types';

// 기본 무기 9종: 렌더러에 모델이 있는 모양마다 하나. (데드셀의 무기·인챈트에서 착안했으나 이름과 효과는 이 게임의 슈트·부산물 체계로 다시 만들었다)
// 피해·속도·사거리만 다르고 ★ 고유 효과는 없다
// (방패의 막기, 지팡이의 원소 튐처럼 그 무기를 정의하는 동작만 남긴다). ★는 부산물을 넣어서 얻는다 (design.md 4.5).
export const WEAPONS: WeaponDef[] = [
  { id: 'dagger', name: '단검', family: 'melee', grade: 'common', colors: ['power'], damage: 5, attackCost: 80, range: 1 },
  { id: 'longsword', name: '장검', family: 'melee', grade: 'common', colors: ['power'], damage: 8, attackCost: 100, range: 1 },
  { id: 'greataxe', name: '양손 도끼', family: 'melee', grade: 'common', colors: ['power'], damage: 12, attackCost: 140, range: 1 },
  { id: 'spear', name: '창', family: 'melee', grade: 'common', colors: ['power', 'survival'], damage: 8, attackCost: 100, range: 1 },
  { id: 'mace', name: '철퇴', family: 'melee', grade: 'common', colors: ['survival'], damage: 9, attackCost: 110, range: 1 },
  { id: 'shield', name: '방패', family: 'melee', grade: 'common', colors: ['survival'], trait: 'block', damage: 3, attackCost: 100, range: 1 },
  { id: 'bow', name: '활', family: 'bow', grade: 'common', colors: ['tactics'], damage: 6, attackCost: 125, range: 8 },
  { id: 'staff', name: '원소 지팡이', family: 'magic', grade: 'common', colors: ['tactics'], trait: 'arcane', element: 'impact', damage: 4, attackCost: 100, range: 5, mag: 4, recharge: 3 },
  { id: 'pistol', name: '권총', family: 'gun', grade: 'common', colors: ['tactics'], damage: 5, attackCost: 110, range: 6, mag: 6 },
];

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
/** 무기 없는 손 */
export const FISTS: WeaponDef = { id: 'fists', name: '맨주먹', family: 'melee', grade: 'common', colors: ['power'], damage: 2, attackCost: 100, range: 1 };

/** 정예 무기: 피해 배율 */
export const ELITE_DAMAGE = 1.25;

/** ★ 효과 설명 */
export const TRAIT_TEXT: Record<WeaponTrait, string> = {
  ambush: '나를 보지 못한 적(잠든·기절·빙결)에게 치명타',
  sadist: '맞은 적에게 출혈. 이미 출혈·중독인 적은 출혈 +1턴, 치명타',
  combo3: '같은 적을 연속으로 칠 때 3번째마다 치명타',
  balanced: '같은 적을 연속으로 칠수록 +15%씩 쌓이고(최대 +60%), 5번째부터 치명타',
  grudge: '직전 적의 차례에 맞았다면 치명타',
  desperate: '슈트 부위가 하나라도 파손됐거나 체력 50% 미만이면 치명타',
  execute: '대상 체력 40% 미만이면 치명타',
  pierce: '대상 뒤의 적도 찌르고, 둘을 함께 맞히면 둘 다 치명타',
  harpoon: '맞은 적을 1칸 밀침. 대상 뒤가 벽·물체로 막혀 있으면 치명타',
  fourth: '이 무기로 4번째 공격마다 치명타',
  nutcracker: '기절·빙결한 적에게 치명타',
  cleave: '주변의 다른 적에게도 절반. 주변에 적이 3명 이상이면 치명타',
  torch: '맞은 적에게 화상 (치명타 없음)',
  block: '어느 손에 있든 공격을 25% 막음. 막으면 다음 공격 치명타',
  smash: '맞은 적을 밀침. 막히면 2턴 기절',
  giant: '정예·보스에게 치명타',
  flawless: '슈트의 모든 부위 장갑이 가득하면 치명타',
  pyreBlade: '불붙은 적에게 치명타',
  lastShot: '탄창의 마지막 한 발은 치명타',
  scatter: '대상과 그 옆의 적 둘까지 60%. 붙어 있는 적에게 치명타',
  steady: '대기·재장전한 다음 공격 치명타',
  marksman: '4칸 이상 떨어진 적에게 치명타',
  pointBlank: '붙어 있는 적에게 치명타',
  repeater: '둔화·빙결한 적에게 치명타',
  knives: '맞은 적에게 출혈',
  pyro: '맞은 적에게 화상. 기름 묻은 적에게 치명타',
  frost: '맞은 적 둔화, 이미 둔화면 빙결',
  storm: '옆의 적 둘에게 절반이 튐',
  arcane: '원소를 남기고 옆의 적 하나에게 절반이 튐. 원소는 부여한 부산물을 따른다(없으면 충격)',
};

/** ★ 칭호: 그 싸움 방식을 하는 사람의 칭호. 무기 이름 앞에 붙는다 (예: 암습자의 도끼) */
export const TRAIT_NAME: Partial<Record<WeaponTrait, string>> = {
  ambush: '암습자의', sadist: '도살자의', combo3: '검무가의', balanced: '수련자의', grudge: '복수자의', desperate: '광전사의', giant: '도전자의', flawless: '근위병의',
  pyreBlade: '화형관의', execute: '처형인의', cleave: '투사의', pierce: '창기병의', harpoon: '포경꾼의', fourth: '대장장이의', nutcracker: '쇄빙꾼의',
  marksman: '저격수의', pointBlank: '척후병의', repeater: '덫사냥꾼의', pyro: '방화범의', frost: '서리술사의', storm: '뇌술사의', lastShot: '도박사의', steady: '파수꾼의',
};

/** 부산물이 주는 ★ 후보 (방패 막기·지팡이 원소 튐은 기본 무기의 동작이라 제외) */
export const STAR_TRAITS = Object.keys(TRAIT_NAME) as WeaponTrait[];

/** 원거리 무기에서만 의미가 있는 ★ */
export const RANGED_TRAITS = new Set<WeaponTrait>(['lastShot', 'marksman', 'pointBlank']);

/** 맞는 짝: 이 ★를 이 기본 무기에 넣으면 고유 이름이 붙는다 (힘의 차이는 없다. 어느 무기에 넣어도 손해가 없게) */
export const SIGNATURE: Partial<Record<WeaponTrait, { weapon: string; name: string }>> = {
  ambush: { weapon: 'dagger', name: '그림자 바늘' },
  sadist: { weapon: 'dagger', name: '혈흔 단도' },
  combo3: { weapon: 'longsword', name: '세 박자' },
  balanced: { weapon: 'longsword', name: '백련검' },
  grudge: { weapon: 'longsword', name: '보복의 칼날' },
  desperate: { weapon: 'longsword', name: '벼랑 끝' },
  giant: { weapon: 'longsword', name: '하극상' },
  flawless: { weapon: 'longsword', name: '순백' },
  pyreBlade: { weapon: 'longsword', name: '잿불검' },
  execute: { weapon: 'greataxe', name: '단두 도끼' },
  cleave: { weapon: 'greataxe', name: '회오리 도끼' },
  pierce: { weapon: 'spear', name: '꿰뚫개' },
  harpoon: { weapon: 'spear', name: '포경 작살' },
  fourth: { weapon: 'mace', name: '단조 망치' },
  nutcracker: { weapon: 'mace', name: '쇄빙 망치' },
  marksman: { weapon: 'bow', name: '먼 별' },
  pointBlank: { weapon: 'bow', name: '숨결 활' },
  repeater: { weapon: 'bow', name: '덫사냥 활' },
  pyro: { weapon: 'staff', name: '잿더미 지팡이' },
  frost: { weapon: 'staff', name: '서리꽃 지팡이' },
  storm: { weapon: 'staff', name: '뇌명 지팡이' },
  lastShot: { weapon: 'pistol', name: '막탄' },
  steady: { weapon: 'pistol', name: '숨 멈춤' },
};
