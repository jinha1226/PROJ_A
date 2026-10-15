import type { Actor, Color, Element, ByproductInst, OptionId, Slot, WeaponDef, WeaponInst } from './types';
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

/** 부위의 최대 슈트 장갑 = 슈트 기본값 + (몸이면) 몸 부산물 장갑. 'fragile' 저주가 있으면 그 부위 절반 */
export function partArmorMax(a: Actor, slot: Slot): number {
  let max = a.partArmorBase[slot] + (a.suitMods?.[slot].armor ?? 0);
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

/** 색 레벨당 그 색 무기의 피해 증가 */
export const COLOR_STEP = 0.12;

/** 무기의 색 레벨: 색이 둘이면 높은 쪽 */
export function colorLevel(a: Actor, w: WeaponDef): number {
  if (!a.colors) return 0;
  return Math.max(0, ...w.colors.map((c: Color) => a.colors![c]));
}

/** 색 레벨 배율 (무기 피해) */
export function colorMult(a: Actor, w: WeaponDef): number {
  return 1 + COLOR_STEP * colorLevel(a, w);
}

export interface Stats {
  maxHp: number;
  damage: number;
  attackCost: number;
  moveCost: number;
  dodge: number;
  sight: number;
  /** 지금 손에 든 무기 (없으면 맨주먹) */
  weapon: WeaponDef;
  range: number;
  armor: number; // 현재 슈트 장갑 총합
  armorMax: number;
  attune: Record<Element, number>;
  elementKinds: number;
}

export function computeStats(a: Actor): Stats {
  let hp = a.baseHp,
    // 플레이어 슈트 기본 회피 5% (적은 다리·감각 부산물로)
    dodge = a.isPlayer ? 8 : 0,
    sight = a.injections?.focus ? 9 : 7,
    // 플레이어 슈트 기본 이동: 비용 75 (1.3칸/턴). 적은 다리 부산물로
    moveBonus = (a.isPlayer ? 25 : 0) + (a.injections?.haste ? 25 : 0),
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
    const f = byproductFactor(r, isBroken(a, r.def.slot));
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
    // 무기 피해에 그 색의 레벨 배율 (맨주먹은 화력)
    damage = (a.baseDamage + weapon.damage + (bestDmg + otherDmg) * 0.3) * colorMult(a, weapon);
    attackCost = weapon.attackCost;
  } else {
    damage = a.baseDamage + bestDmg + otherDmg * 0.25;
  }
  const elementKinds = (Object.values(attune) as number[]).filter((n) => n > 0).length;
  // 플레이어 슈트 파손 불이익: 팔 공격 −20%, 다리 이동 비용 +30%, 감각 시야 −2 (몸은 받는 피해 +20%, 감각은 치명타 무효: game.ts)
  let moveCost = Math.max(50, 100 - Math.round(moveBonus) + heavy);
  if (a.isPlayer) {
    if (isBroken(a, 'arm')) damage *= 0.8;
    if (isBroken(a, 'leg')) moveCost = Math.round(moveCost * 1.3);
    if (isBroken(a, 'sense')) sight -= 2;
  }
  return {
    maxHp: Math.round(hp),
    damage: Math.round(damage),
    weapon,
    range: weapon.range,
    attackCost,
    moveCost,
    dodge: Math.max(0, Math.min(45, Math.round(dodge))),
    sight,
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

/** 탄창·충전 수 (추가 탄창 옵션 +3) */
export function magOf(w: WeaponInst): number {
  return w.def.mag === undefined ? 0 : w.def.mag + (w.options.includes('extraAmmo') ? 3 : 0);
}

/** 무기의 모든 옵션: 떨어질 때 붙은 것 + 부산물 부여 */
export function allOptions(w: WeaponInst): OptionId[] {
  return w.infusion ? [...w.options, ...w.infusion.options] : w.options;
}
