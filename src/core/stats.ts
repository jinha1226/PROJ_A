import type { Actor, Element, ByproductInst, Slot, WeaponDef, WeaponInst } from './types';
import { FISTS } from '../data/weapons';
import { SLOTS } from './types';

/** 장착된 부산물 전부 */
export function allByproducts(a: Actor): ByproductInst[] {
  const out: ByproductInst[] = [];
  for (const s of SLOTS) for (const r of a.slots[s]) if (r) out.push(r);
  return out;
}

/** 피격 부위 가중치: 몸 40 · 팔 25 · 다리 20 · 감각 15 */
export const HIT_WEIGHT: Record<Slot, number> = { body: 40, arm: 25, leg: 20, sense: 15 };

/** 부위의 최대 슈트 장갑 = 프레임 기본값 + (몸이면) 몸 부산물 장갑. 'fragile' 저주가 있으면 그 부위 절반 */
export function partArmorMax(a: Actor, slot: Slot): number {
  let max = a.partArmorBase[slot];
  for (const r of a.slots[slot]) {
    if (!r || r.dormant) continue;
    if (slot === 'body') max += r.def.stats.integrity ?? 0;
  }
  if (a.slots[slot].some((r) => r?.def.curse?.kind === 'fragile')) max = Math.floor(max / 2);
  return max;
}

/** 부위 파손: 장갑이 있던 부위가 0이 됨 */
export function isBroken(a: Actor, slot: Slot): boolean {
  return partArmorMax(a, slot) > 0 && a.partArmor[slot] <= 0;
}

/** 부산물 효과 배율: 절전 0, 파손된 부위면 절반(녹의 신 2단계는 온전), 강화 단계당 +15% */
export function byproductFactor(r: ByproductInst, broken = false): number {
  if (r.dormant) return 0;
  const base = 1 + r.upgrade * 0.15;
  return broken ? base * 0.5 : base;
}

export interface Stats {
  maxHp: number;
  damage: number;
  attackCost: number;
  moveCost: number;
  dodge: number;
  sight: number;
  burden: number;
  burdenCap: number;
  /** 지금 손에 든 무기 (없으면 맨주먹) */
  weapon: WeaponDef;
  range: number;
  armor: number; // 현재 슈트 장갑 총합
  armorMax: number;
  attune: Record<Element, number>;
  elementKinds: number;
}

export function computeStats(a: Actor, fullWhenDamaged = false): Stats {
  let hp = a.baseHp,
    dodge = 0,
    sight = 7,
    moveBonus = 0,
    burden = 0,
    armor = 0,
    heavy = 0;
  let bestDmg = 0,
    otherDmg = 0,
    attackCost = 100;
  const attune: Record<Element, number> = { fire: 0, cold: 0, lightning: 0, impact: 0 };
  let armorMax = 0;
  for (const slot of SLOTS) {
    armor += Math.max(0, a.partArmor[slot]);
    armorMax += partArmorMax(a, slot);
  }
  for (const r of allByproducts(a)) {
    const st = r.def.stats;
    burden += st.burden + (r.def.curse?.kind === 'heavy' ? 4 : 0);
    const f = byproductFactor(r, !fullWhenDamaged && isBroken(a, r.def.slot));
    if (f === 0) continue;
    hp += (st.hp ?? 0) * f;
    dodge += (st.dodge ?? 0) * f;
    sight += st.sight ?? 0;
    moveBonus += (st.moveBonus ?? 0) * f;
    if (r.def.curse?.kind === 'heavy') heavy += 15;
    if (st.damage) {
      const d = st.damage * f;
      if (d > bestDmg) {
        otherDmg += bestDmg;
        bestDmg = d;
        attackCost = st.attackCost ?? 100;
      } else otherDmg += d;
    }
    for (const e of r.def.elements) attune[e]++;
  }
  // 무기를 든 액터(플레이어): 무기 피해 + 팔 부산물의 공격 보조(30%).
  // 무기가 없는 몬스터: 팔 부산물이 곧 타고난 공격 (발톱·주먹 등).
  const held = heldWeapon(a);
  let damage: number;
  let weapon: WeaponDef = FISTS;
  if (held || a.isPlayer) {
    weapon = held?.def ?? FISTS;
    damage = a.baseDamage + weapon.damage + (bestDmg + otherDmg) * 0.3;
    attackCost = weapon.attackCost;
    burden += weapon.burden;
  } else {
    damage = a.baseDamage + bestDmg + otherDmg * 0.25;
  }
  const over = Math.max(0, burden - a.burdenCap);
  dodge -= over * 3;
  const elementKinds = (Object.values(attune) as number[]).filter((n) => n > 0).length;
  return {
    maxHp: Math.round(hp),
    damage: Math.round(damage),
    weapon,
    range: weapon.range,
    attackCost,
    moveCost: Math.max(50, 100 - Math.round(moveBonus) + heavy),
    dodge: Math.max(0, Math.min(45, Math.round(dodge))),
    sight,
    burden,
    burdenCap: a.burdenCap,
    armor,
    armorMax,
    attune,
    elementKinds,
  };
}

export function slotCount(a: Actor, s: Slot) {
  return a.slots[s].length;
}

/** 지금 손에 든 무기 */
export function heldWeapon(a: Actor): WeaponInst | null {
  return a.hands[a.activeHand] ?? null;
}
