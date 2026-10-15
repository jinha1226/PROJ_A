import { Game } from '../src/core/game';
import type { ByproductInst, GroundItem, WeaponInst } from '../src/core/types';
import { heldWeapon, magOf } from '../src/core/stats';

// 시뮬레이터용 단순 봇
export function botStep(g: Game): boolean {
  const p = g.player;
  switch (g.mode) {
    case 'dead':
    case 'won':
      return false;
    case 'levelup': {
      // 지금 든 무기들의 색 중 가장 많이 겹치는 색을 키운다
      const count = { power: 0, tactics: 0, survival: 0 };
      for (const w of p.hands) for (const c of w?.def.colors ?? []) count[c]++;
      const best = (Object.keys(count) as (keyof typeof count)[]).sort((a, b) => count[b] - count[a] || p.colors![a] - p.colors![b])[0]!;
      g.chooseColor(best);
      return true;
    }
    case 'rest': {
      if (g.restService === 'shop') {
        g.buyFlask();
        for (let i = g.shop.length - 1; i >= 0; i--) if (g.shop[i].price <= g.ash) g.buy(i);
      } else g.reforge(p.activeHand, 0);
      for (const r of [...g.restItems]) tryTake(g, r) || (r.kind === 'byproduct' && useByproduct(g, r));
      g.leaveRest();
      return true;
    }
  }
  const s = g.st(p);
  const enemies = g.visibleEnemies();
  if (enemies.length) {
    if (p.hp < s.maxHp * 0.35 && g.flask > 0) return g.useFlask();
    // 주사제: 맞고 있는 게 없으면 하나
    const bi = p.belt!.findIndex((c) => c && !p.injections![c.def.id]);
    if (bi >= 0 && !Object.keys(p.injections!).length) return g.useInjection(bi);
    const near = enemies.reduce((a, b) => (dist(p, a) <= dist(p, b) ? a : b));
    // 무기: 붙으면 근접 무기로, 떨어져 있으면 총으로
    const d = dist(p, near);
    const held = heldWeapon(p);
    const other = p.hands[1 - p.activeHand];
    const ranged = (w: WeaponInst | null | undefined) => !!w && w.def.range > 1;
    if (d <= 1 && ranged(held) && other && !ranged(other)) return g.swapWeapon();
    if (d >= 3 && !ranged(held) && ranged(other) && other!.ammo > 0) return g.swapWeapon();
    if (ranged(held) && d > 1) {
      // 원소 지팡이는 재장전이 없다: 충전이 비면 다가가서 다른 손으로
      if (held!.def.mag !== undefined && held!.ammo <= 0 && !held!.def.recharge) return g.reload();
      if (d <= held!.def.range && g.shoot(near.x, near.y)) return true;
    }
    if (d <= 1) {
      if (g.move(Math.sign(near.x - p.x), Math.sign(near.y - p.y))) return true;
    }
    const dir = g.stepToward(near.x, near.y);
    if (dir !== 'done' && g.move(dir[0], dir[1])) return true;
    return g.wait();
  }
  const held = heldWeapon(p);
  if (held?.def.mag !== undefined && !held.def.recharge && held.ammo < magOf(held)) return g.reload();
  const here = g.groundHere();
  for (const r of here) {
    if (tryTake(g, r)) return true;
    if (r.kind === 'byproduct') return useByproduct(g, r);
  }
  const dir = g.autoExploreDir();
  if (dir === 'enemy') return g.wait();
  if (dir !== 'done') return g.move(dir[0], dir[1]);
  const ex = g.level.exit;
  if (p.x === ex.x && p.y === ex.y) return g.descend() || g.wait();
  const st = g.stepToward(ex.x, ex.y);
  if (st === 'done') return g.wait();
  return g.move(st[0], st[1]);
}

/** 줍기: 무기는 빈 손이나 더 센 근접 무기와 교체 (부산물은 분해) */
export function tryTake(g: Game, r: GroundItem): boolean {
  if (r.kind === 'byproduct') return false;
  if (r.kind === 'consumable') return g.pickConsumable(r);
  const hands = g.player.hands;
  let i = hands.findIndex((w) => !w);
  if (i < 0) i = hands.findIndex((w) => w && w.def.range <= 1 && r.def.range <= 1 && w.def.damage < r.def.damage);
  return i >= 0 && g.takeWeapon(r, i);
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** 부산물: 든 무기에 부여 칸이 비었으면 무기에, 아니면 슈트에, 슈트 부위가 찼으면 분해 */
function useByproduct(g: Game, r: ByproductInst): boolean {
  const p = g.player;
  if (p.hands[p.activeHand] && !p.hands[p.activeHand]!.infusion) return g.infuseWeapon(r, p.activeHand);
  return g.infuseSuit(r) || g.dismantle(r);
}
