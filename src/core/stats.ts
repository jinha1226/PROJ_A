import type { Actor, Element, RelicInst, Slot } from './types';
import { SLOTS } from './types';

/** 장착된 부산물 전부 */
export function allRelics(a: Actor): RelicInst[] {
  const out: RelicInst[] = [];
  for (const s of SLOTS) for (const r of a.slots[s]) if (r) out.push(r);
  return out;
}

/** 부산물 효과 배율: 절전 0, 손상 절반(녹의 신 2단계는 온전), 강화 단계당 +15% */
export function relicFactor(r: RelicInst, fullWhenDamaged = false): number {
  if (r.dormant) return 0;
  const base = 1 + r.upgrade * 0.15;
  return r.damaged && !fullWhenDamaged ? base * 0.5 : base;
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
  armor: number; // 현재 장갑 내구 총합
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
  for (const r of allRelics(a)) {
    const st = r.def.stats;
    burden += st.burden + (r.def.curse?.kind === 'heavy' ? 4 : 0);
    const f = relicFactor(r, fullWhenDamaged);
    if (f === 0) continue;
    hp += (st.hp ?? 0) * f;
    dodge += (st.dodge ?? 0) * f;
    sight += st.sight ?? 0;
    moveBonus += (st.moveBonus ?? 0) * f;
    if (r.def.slot === 'body') armor += r.integrity;
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
  const over = Math.max(0, burden - a.burdenCap);
  dodge -= over * 3;
  const elementKinds = (Object.values(attune) as number[]).filter((n) => n > 0).length;
  return {
    maxHp: Math.round(hp),
    damage: Math.round(a.baseDamage + bestDmg + otherDmg * 0.25),
    attackCost,
    moveCost: Math.max(50, 100 - Math.round(moveBonus) + heavy),
    dodge: Math.max(0, Math.min(45, Math.round(dodge))),
    sight,
    burden,
    burdenCap: a.burdenCap,
    armor,
    attune,
    elementKinds,
  };
}

export function slotCount(a: Actor, s: Slot) {
  return a.slots[s].length;
}
