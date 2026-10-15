import type { ByproductDef, Element, OptionId, Slot, WeaponTrait } from '../core/types';
import { FIXED_STAR, STAR_TRAITS } from './weapons';

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

/** 원소의 반대 원소 (슈트 부위 칸의 약점) */
/** 원소 → 반대 원소 (슈트 칸의 약점) */
export const OPPOSITE: Record<Element, Element> = { fire: 'cold', cold: 'fire', lightning: 'impact', impact: 'lightning' };
/** 슈트 부위 칸: 원소 저항(능력치 계산의 attune), 반대 원소 약점, 무게 → 이동 비용 */
export const WEAKNESS_STEP = 0.25;
export const WEIGHT_MOVE = 2;

const EL_NAME: Record<Element, string> = { fire: '화염', cold: '냉기', lightning: '번개', impact: '충격' };

/** 슈트 부위 칸에 끼웠을 때의 장점과 대가 (부산물 수치에서 규칙으로) */
export function suitModule(d: ByproductDef): { pros: string[]; cons: string[] } {
  const st = d.stats;
  const pros: string[] = [];
  const cons: string[] = [];
  if (st.integrity) pros.push(`몸 장갑 +${st.integrity}`);
  if (st.hp) pros.push(`체력 +${st.hp}`);
  if (st.damage) pros.push(`공격 피해 +${Math.round(st.damage * 0.3)}`);
  if (st.moveBonus) pros.push(`이동 비용 −${st.moveBonus}`);
  if (st.dodge) pros.push(`회피 +${st.dodge}`);
  if (st.ac) pros.push(`AC +${st.ac}`);
  if (st.accuracy) pros.push(`명중 +${st.accuracy}`);
  if (st.sight) pros.push(`시야 +${st.sight}`);
  for (const e of d.elements) pros.push(`${EL_NAME[e]} 저항 +25%`);
  if (d.slot !== 'leg' && st.burden) cons.push(`무게: 이동 비용 +${st.burden * WEIGHT_MOVE}`);
  for (const e of d.elements) cons.push(`${EL_NAME[OPPOSITE[e]]} 약점 +${WEAKNESS_STEP * 100}%`);
  if (d.curse) cons.push(`저주: ${d.curse.text}`);
  return { pros, cons };
}

/**
 * 정예·보스(금지) 부산물이 무기에 주는 ★ 고유 효과.
 * 몬스터·부산물 목록을 확정하기 전까지는 부산물 id로 정해지는 임시 배정이다 (design.md 4.5: 몬스터 생김새에 맞춰 다시 정한다).
 */
export function starOf(d: ByproductDef): WeaponTrait | undefined {
  if (d.grade === 'common') return undefined;
  if (FIXED_STAR[d.id]) return FIXED_STAR[d.id];
  let h = 0;
  for (const ch of d.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return STAR_TRAITS[h % STAR_TRAITS.length];
}
