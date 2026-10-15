import type { ByproductDef, Element, OptionId, Slot } from '../core/types';

// 부산물 → 강화 규칙. 부산물마다 정하지 않고 원소·부위·등급으로 뽑는다 (새 몬스터도 바로 쓸 수 있게).

const ELEMENT_OPTION: Record<Element, OptionId> = { fire: 'fire', cold: 'cold', lightning: 'lightning', impact: 'impact' };
const SLOT_OPTION: Record<Slot, OptionId> = { body: 'riposte', arm: 'bleed', leg: 'ambush', sense: 'aim' };
/** 원소 없는 정예 부산물의 두 번째 옵션 */
const SLOT_SECOND: Record<Slot, OptionId> = { body: 'fullHp', arm: 'bleedDmg', leg: 'despair', sense: 'critDmg' };

/** 무기에 부여할 때 붙는 옵션 */
export function infuseOptions(d: ByproductDef): OptionId[] {
  const el = d.elements[0];
  const out: OptionId[] = [];
  if (d.grade === 'common') out.push(el ? ELEMENT_OPTION[el] : SLOT_OPTION[d.slot]);
  else {
    if (el) out.push(ELEMENT_OPTION[el], SLOT_OPTION[d.slot]);
    else out.push(SLOT_OPTION[d.slot], SLOT_SECOND[d.slot]);
    if (d.grade === 'forbidden') out.push('frenzy');
  }
  return out;
}

/** 슈트에 부여할 때: 그 부위 장갑 최대치 증가와 원소 저항 */
export function suitInfusion(d: ByproductDef): { slot: Slot; armor: number; resist: Element[] } {
  return { slot: d.slot, armor: { common: 2, holy: 3, forbidden: 4 }[d.grade], resist: [...d.elements] };
}

/** 부위마다 슈트 부여 최대 횟수 */
export const SUIT_INFUSE_MAX = 3;
/** 원소 저항: 부여한 원소 하나당 그 원소 피해 감소, 상한 */
export const RESIST_STEP = 0.2;
export const RESIST_CAP = 0.6;
