// 우리 게임 상태·이벤트를 PROJ_R 렌더러가 읽는 GridState·GEvent 모양으로 옮기는 어댑터.
// 렌더러(./projr)는 손대지 않고, 이 파일에서만 둘을 잇는다.
import type { Game } from '../core/game';
import { Tile as LvTile, type Level } from '../core/dungeon';
import { heldWeapon } from '../core/stats';
import type { Actor, GameEvent, WeaponInst } from '../core/types';
import type { Cell, Ent, FloorItem, FoeKind, GEvent, GridMap, GridSim, GridState, Hero, Tile, TileFx, Weapon, WeaponGroup } from './projr/sim';

/** 우리 무기 → PROJ_R 무기 모양 */
const WEAPON_LOOK: Record<string, WeaponGroup> = {
  pistol: 'pistol',
  dagger: 'dagger',
  longsword: 'sword',
  knight_sword: 'sword',
  spear: 'spear',
  mace: 'mace',
  greataxe: 'axe',
  ogre_club: 'axe',
};

const gear = (w: WeaponInst | null | undefined): Weapon | null => (w ? { group: WEAPON_LOOK[w.def.id] ?? 'sword' } : null);

/** 적의 외형 종류: 마네킹 하나를 색·크기·무기로 구분한다 */
function foeKind(a: Actor): FoeKind {
  if (a.boss) return 'champion';
  if (a.elite) return 'brute';
  if (a.ai === 'ranged') {
    const el = a.slots.arm.find((r) => r?.def.active)?.def.active?.element;
    return el === 'fire' || el === 'lightning' ? 'mage' : 'archer';
  }
  if (a.ai === 'skirmisher') return 'ghoul';
  return a.baseHp >= 25 ? 'brute' : 'minion';
}

export const actorId = (g: Game, id: number | undefined): string | undefined =>
  id === undefined ? undefined : id === g.player.id ? 'hero' : `a${id}`;

export class Bridge {
  readonly sim: GridSim;
  private level: Level | null = null;
  private map!: GridMap;
  /** 이 층에서 죽은 적: 게임은 목록에서 빼지만, 렌더러에는 죽은 채로 계속 넘긴다 (HP 바·시체) */
  private graves = new Map<string, Ent>();
  private lastFoes: Ent[] = [];

  constructor(private game: Game) {
    this.sim = { s: this.build() };
  }

  /** 층이 바뀌면 GridMap을 새로 만든다 (렌더러는 map 객체가 바뀐 것으로 새 층을 안다) */
  private buildMap(lv: Level): GridMap {
    const tiles: Tile[] = Array.from(lv.tiles, (t) => (t === LvTile.Floor ? 'floor' : 'wall'));
    const exit = lv.exit;
    return {
      w: lv.w,
      h: lv.h,
      tiles,
      rooms: lv.rooms.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
      start: { x: lv.startX, y: lv.startY },
      // 출구는 계단으로 그린다 (보급 지점으로 내려가는 길)
      exits: [],
      stairs: { x: exit.x, y: exit.y },
      chests: [],
      spawns: [],
      barrels: [],
      traps: [],
    };
  }

  private build(): GridState {
    const g = this.game;
    if (this.level !== g.level) {
      this.level = g.level;
      this.map = this.buildMap(g.level);
      this.graves.clear();
      this.lastFoes = [];
    }
    const live = g.actors.filter((a) => a.faction === 'enemy').map((a) => this.ent(a));
    const ids = new Set(live.map((e) => e.id));
    for (const e of this.lastFoes) if (!ids.has(e.id) && !this.graves.has(e.id)) this.graves.set(e.id, { ...e, alive: false, hp: 0 });
    for (const e of live) if (!e.alive) this.graves.delete(e.id);
    this.lastFoes = live;
    const lv = g.level;
    const visible = new Set<number>();
    for (let i = 0; i < lv.visible.length; i++) if (lv.visible[i]) visible.add(i);
    return {
      time: g.player.time / 100,
      map: this.map,
      hero: this.hero(),
      foes: [...live, ...this.graves.values()],
      chests: [],
      seen: lv.explored,
      visible,
      closedExits: [],
      floorItems: this.items(),
      run: { floor: g.zone * 4 + g.floor + 1 },
      tiles: this.tiles(),
      barrels: [],
      telegraphs: [],
      traps: [],
      lore: { colors: {} },
    };
  }

  private ent(a: Actor): Ent {
    const g = this.game;
    const st = g.st(a);
    return {
      id: actorId(g, a.id)!,
      kind: foeKind(a),
      pos: { x: a.x, y: a.y },
      hp: Math.max(0, a.hp),
      maxHp: st.maxHp,
      nextAt: a.time / 100,
      alive: !a.dead,
      awake: a.awake,
      group: 0,
      elite: a.elite || a.boss,
      marked: a.marked,
      status: { burn: a.statuses.burn ? 1 : 0, freeze: a.statuses.slow ? 1 : 0, poison: 0 },
    };
  }

  private hero(): Hero {
    const g = this.game;
    const p = g.player;
    const st = g.st(p);
    return {
      id: 'hero',
      kind: 'hero',
      pos: { x: p.x, y: p.y },
      hp: Math.max(0, p.hp),
      maxHp: st.maxHp,
      nextAt: p.time / 100,
      alive: !p.dead,
      awake: true,
      group: 0,
      shield: p.shield,
      status: { burn: p.statuses.burn ? 1 : 0, freeze: p.statuses.slow ? 1 : 0, poison: 0 },
      suit: p.engravings.map((e) => e.name),
      gear: { hands: [gear(p.hands[0]), gear(p.hands[1])], active: p.activeHand === 1 ? 1 : 0 },
      exitTime: 0,
    };
  }

  /** 바닥: 부산물은 떠 있는 수정(정예·금지는 금색), 무기는 무기 모양 */
  private items(): FloorItem[] {
    const g = this.game;
    const lv = g.level;
    const out: FloorItem[] = [];
    for (const [i, items] of g.ground) {
      if (!items.length || !lv.explored[i]) continue;
      const it = items[items.length - 1]!;
      const pos = { x: i % lv.w, y: (i / lv.w) | 0 };
      out.push(
        it.kind === 'weapon'
          ? { pos, item: { kind: 'weapon', group: WEAPON_LOOK[it.def.id] ?? 'sword' } }
          : { pos, item: { kind: 'stone', id: it.def.grade === 'common' ? 'byproduct' : 'guardian' } },
      );
    }
    return out;
  }

  /** 지형 효과: 불길은 불, 얼음·전류는 김으로 */
  private tiles(): TileFx[] {
    const g = this.game;
    const lv = g.level;
    const now = g.player.time / 100;
    const out: TileFx[] = [];
    for (const [i, t] of lv.terrain) {
      out.push({ pos: { x: i % lv.w, y: (i / lv.w) | 0 }, kind: t.kind === 'flame' ? 'fire' : 'steam', until: now + t.turns });
    }
    return out;
  }

  /** 상태를 다시 채운다. 층이 바뀌었으면 map 객체도 바뀐다 */
  update(): void {
    this.sim.s = this.build();
  }

  /** 우리 이벤트 → PROJ_R 이벤트 */
  convert(events: GameEvent[]): GEvent[] {
    const g = this.game;
    const out: GEvent[] = [];
    const id = (n?: number) => actorId(g, n);
    const cell = (x?: number, y?: number): Cell | undefined => (x === undefined || y === undefined ? undefined : { x, y });
    const heroGroup = () => gear(heldWeapon(g.player))?.group;
    for (const e of events) {
      const t = e.t ?? g.player.time / 100;
      switch (e.type) {
        case 'move':
          out.push({ t, type: 'move', src: id(e.actor), to: cell(e.x, e.y) });
          break;
        case 'attack':
          out.push({ t, type: 'bump', src: id(e.actor), dst: id(e.target), group: e.actor === g.player.id ? heroGroup() : undefined });
          break;
        case 'shoot':
          out.push({ t, type: 'shoot', src: id(e.actor), dst: id(e.target), to: cell(e.tx, e.ty), group: 'pistol', text: 'pistol' });
          break;
        case 'reload':
          out.push({ t, type: 'reload', src: id(e.actor) });
          break;
        case 'damage':
          out.push({ t, type: 'hit', src: id(e.actor), dst: id(e.target), amount: e.amount });
          break;
        case 'dodge':
          out.push(e.target === g.player.id ? { t, type: 'dodge', text: Math.random() < 0.5 ? 'L' : 'R' } : { t, type: 'miss', dst: id(e.target) });
          break;
        case 'death':
          out.push({ t, type: 'die', dst: id(e.actor) });
          break;
        case 'trigger':
          out.push({ t, type: 'engrave', src: id(e.actor), text: e.text });
          break;
        case 'levelup':
          out.push({ t, type: 'levelUp', amount: g.plevel });
          break;
        case 'alert':
          out.push({ t, type: 'alarm' });
          break;
        case 'fx': {
          const to = cell(e.tx, e.ty);
          if (e.fx === 'blast' || e.fx === 'overload' || e.fx === 'combo') {
            const at = cell(e.x, e.y);
            if (at) out.push({ t, type: 'explode', to: at });
          } else if ((e.fx === 'line' || e.fx === 'chain' || e.fx === 'shards') && to) {
            // 효과가 날아가는 선: 대상이 있으면 그 액터까지
            const target = g.actorAt(to.x, to.y);
            out.push({ t, type: 'shoot', from: cell(e.x, e.y), to, dst: target ? id(target.id) : undefined, text: 'chain' });
          }
          break;
        }
      }
    }
    return out;
  }
}
