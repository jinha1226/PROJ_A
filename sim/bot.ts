import { Game } from '../src/core/game';
import type { RelicInst } from '../src/core/types';

// 시뮬레이터용 단순 봇
export function botStep(g: Game): boolean {
  const p = g.player;
  switch (g.mode) {
    case 'dead':
    case 'won':
      return false;
    case 'levelup': {
      const c = g.levelChoices[0];
      g.chooseEngraving(c ? c.id : null, 0);
      return true;
    }
    case 'altar':
      g.acceptGod(true);
      return true;
    case 'rest': {
      if (g.restService === 'repair') g.restRepair();
      if (g.restService === 'engrave' && g.levelChoices[0]) g.chooseEngraving(g.levelChoices[0].id, 0);
      if (g.restService === 'shop') {
        g.buyKit();
        for (let i = g.shop.length - 1; i >= 0; i--) if (g.shop[i].price <= g.ash) g.buy(i);
      }
      for (const r of [...g.restItems]) tryGraft(g, r) || g.offer(r, 'repair');
      g.leaveRest();
      return true;
    }
  }
  const s = g.st(p);
  const enemies = g.visibleEnemies();
  if (enemies.length) {
    if (p.hp < s.maxHp * 0.35 && g.kits > 0) return g.useKit();
    const near = enemies.reduce((a, b) => (dist(p, a) <= dist(p, b) ? a : b));
    // 위급하면 봉헌으로 수리
    if (p.hp < s.maxHp * 0.25) {
      const fuel = [...p.slots.sense, ...p.slots.leg].find((r): r is RelicInst => !!r && !r.fixed);
      if (fuel) return g.offer(fuel, 'repair');
    }
    const actives = g.equippedActives(p);
    for (let i = 0; i < actives.length; i++) {
      const r = actives[i];
      if (r.cd > 0 || r.damaged || r.dormant) continue;
      const sp = r.def.active!;
      const d = dist(p, near);
      const ok = sp.form === 'sweep' ? d <= 1 : sp.form === 'nova' ? d <= 2 : d <= (sp.range ?? 1) && (sp.form !== 'dash' || d >= 2);
      if (ok && g.useActive(i, near.x, near.y)) return true;
    }
    if (dist(p, near) <= 1) {
      if (g.move(Math.sign(near.x - p.x), Math.sign(near.y - p.y))) return true;
    }
    const dir = g.stepToward(near.x, near.y);
    if (dir !== 'done' && g.move(dir[0], dir[1])) return true;
    return g.wait();
  }
  const here = g.groundHere();
  if (here.length) {
    const r = here[0];
    if (tryGraft(g, r)) return true;
    return g.offer(r, p.slots.body.some((b) => b?.damaged) ? 'repair' : 'cooldown');
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

export function tryGraft(g: Game, r: RelicInst): boolean {
  const arr = g.player.slots[r.def.slot];
  let idx = arr.findIndex((x) => !x);
  if (idx < 0) idx = arr.findIndex((x) => x && !x.fixed && (x.damaged || gradeVal(x) < gradeVal(r)));
  if (idx < 0) return false;
  return g.graft(r, idx, 'offer');
}
const gradeVal = (r: RelicInst) => ({ common: 0, holy: 1, forbidden: 2 })[r.def.grade] + (r.damaged ? -2 : 0);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

