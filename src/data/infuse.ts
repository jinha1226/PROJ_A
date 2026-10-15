import type { ByproductDef, Element, OptionId, Slot, WeaponTrait } from '../core/types';
import { STAR_TRAITS } from './weapons';

// 부산물 → 강화 규칙. 부산물마다 정하지 않고 원소·부위·등급으로 뽑는다 (새 몬스터도 바로 쓸 수 있게).

const ELEMENT_OPTION: Record<Element, OptionId> = { fire: 'fire', cold: 'cold', lightning: 'lightning', impact: 'impact' };
const SLOT_OPTION: Record<Slot, OptionId> = { body: 'riposte', arm: 'bleed', leg: 'ambush', sense: 'aim' };

/** 무기에 부여할 때 붙는 옵션 */
export function infuseOptions(d: ByproductDef): OptionId[] {
  const el = d.elements[0];
  const out: OptionId[] = [];
  // 일반: 옵션 1개. 정예·금지: ★(starOf)와 함께 옵션 1개, 금지는 저주로 광기
  out.push(el ? ELEMENT_OPTION[el] : SLOT_OPTION[d.slot]);
  if (d.grade === 'forbidden') out.push('frenzy');
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

/**
 * 정예·보스(금지) 부산물이 무기에 주는 ★ 고유 효과.
 * 몬스터·부산물 목록을 확정하기 전까지는 부산물 id로 정해지는 임시 배정이다 (design.md 4.5: 몬스터 생김새에 맞춰 다시 정한다).
 */
export function starOf(d: ByproductDef): WeaponTrait | undefined {
  if (d.grade === 'common') return undefined;
  let h = 0;
  for (const ch of d.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return STAR_TRAITS[h % STAR_TRAITS.length];
}
