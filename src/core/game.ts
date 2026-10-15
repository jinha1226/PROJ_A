import { Rng } from './rng';
import { bfs, computeFov, DIRS8, generateBossLevel, generateLevel, hasLos, Level, linePoints } from './dungeon';
import { allRelics, computeStats, HIT_WEIGHT, isBroken, partArmorMax, relicFactor, type Stats } from './stats';
import type {
  Actor, EffectSpec, Element, EngravingDef, Faction, GameEvent, RelicDef, RelicInst, Slot, StatusKind, Trigger,
} from './types';
import { ELEMENT_NAME, SLOTS, SLOT_NAME } from './types';
import { DROP_POOL, RELIC_BY_ID } from '../data/relics';
import { ENGRAVING_BY_ID, ENGRAVING_POOL } from '../data/engravings';
import { FORM_NAME, FORM_RIDERS } from '../data/forms';
import { BODIES, GODS, ORIGINS } from '../data/start';
import { ENEMIES, ENEMY_BY_ID, ZONES, type EnemyTemplate } from '../data/enemies';

export type Mode = 'play' | 'levelup' | 'rest' | 'altar' | 'dead' | 'won';
export type OfferMode = 'strike' | 'retrigger' | 'cooldown' | 'repair';
export type RestService = 'shop' | 'reforge' | 'engrave';

export const OFFER_NAME: Record<OfferMode, string> = {
  strike: '큰 일격',
  retrigger: '각인 재발동',
  cooldown: '쿨다운 초기화',
  repair: '즉시 수리',
};
export const REST_NAME: Record<RestService, string> = {
  shop: '보급 상점',
  reforge: '개조대',
  engrave: '각인 기록기',
};

export const TRIGGER_CAP = 3; // 한 턴에 같은 각인 최대 3회
export const ENGRAVING_SLOTS = 8;
export const SHIELD_CAP = 25;
export const ALERT_THRESHOLDS = [160, 240, 310]; // 층에 머문 턴 수
export const MAX_KITS = 3;
const XP_TABLE = [0, 40, 80, 125, 175, 230, 290, 355, 425, 500];

interface Ctx {
  target?: Actor;
  element?: Element;
  x?: number;
  y?: number;
}

interface DamageOpts {
  dodgeable?: boolean;
  pierce?: boolean;
  label?: string;
  noTrigger?: boolean;
}

export interface RunStats {
  turns: number;
  kills: number;
  triggers: number;
  combos: number;
  offers: number;
  grafts: number;
  maxDepth: number;
  floorTurns: number[];
  damageDealt: number;
}

export class Game {
  rng: Rng;
  level!: Level;
  actors: Actor[] = [];
  player!: Actor;
  ground = new Map<number, RelicInst[]>();
  events: GameEvent[] = [];
  mode: Mode = 'play';

  zone = 0;
  floor = 0; // 0..2 일반, 3 = 보스층
  floorTurns = 0;
  alert = 0;
  worldTime = 0;
  xp = 0;
  plevel = 1;
  pendingLevelUps = 0;
  ash = 0;
  kits = 1;
  god?: { id: string; piety: number; grafted: boolean };
  levelChoices: EngravingDef[] = [];
  restService: RestService = 'shop';
  shop: { relic: RelicInst; price: number }[] = [];
  restItems: RelicInst[] = [];
  restUsed = false;
  stats: RunStats = { turns: 0, kills: 0, triggers: 0, combos: 0, offers: 0, grafts: 0, maxDepth: 0, floorTurns: [], damageDealt: 0 };

  private nextId = 1;
  private nextUid = 1;
  private depth = 0;
  private distCache: { key: number; dist: Int32Array } | null = null;

  constructor(public seed: string, public originId: string, public bodyId: string) {
    this.rng = Rng.fromString(seed);
    this.createPlayer();
    this.enterFloor();
  }

  // ───────────────────────── 생성 ─────────────────────────

  makeRelic(def: RelicDef | string): RelicInst {
    const d = typeof def === 'string' ? RELIC_BY_ID[def] : def;
    return { uid: this.nextUid++, def: d, dormant: false, fixed: false, cd: 0, upgrade: 0 };
  }

  private newActor(name: string, faction: Faction, hp: number, dmg: number, slots: Record<Slot, number>): Actor {
    const s = {} as Actor['slots'];
    for (const k of SLOTS) s[k] = new Array(slots[k]).fill(null);
    return {
      id: this.nextId++, name, faction, isPlayer: false, x: 0, y: 0, hp, baseHp: hp, baseDamage: dmg, slots: s,
      burdenCap: 99, partArmor: { body: 0, arm: 0, leg: 0, sense: 0 }, partArmorBase: { body: 0, arm: 0, leg: 0, sense: 0 }, engravings: [], engravingFires: new Map(), time: 0, shield: 0, statuses: {}, haste: 0,
      marked: false, dead: false, awake: false, dropChance: 0,
    };
  }

  private createPlayer() {
    const origin = ORIGINS.find((o) => o.id === this.originId)!;
    const body = BODIES.find((b) => b.id === this.bodyId)!;
    const p = this.newActor(ORIGINS.find((o) => o.id === this.originId)!.name, 'player', body.baseHp, 3, body.slots);
    p.isPlayer = true;
    p.awake = true;
    p.burdenCap = body.burdenCap;
    p.partArmorBase = { ...body.armor };
    const fixed = this.makeRelic(body.fixed.relic);
    fixed.fixed = true;
    p.slots[body.fixed.slot][0] = fixed;
    p.fixedSlot = { slot: body.fixed.slot, index: 0 };
    for (const id of [origin.relic, ...body.relics]) this.equipFree(p, this.makeRelic(id));
    p.engravings.push(ENGRAVING_BY_ID[origin.engraving]);
    this.player = p;
    this.recomputeBurden(p);
    this.fillArmor(p);
    p.hp = this.st(p).maxHp;
  }

  private equipFree(a: Actor, r: RelicInst): boolean {
    const arr = a.slots[r.def.slot];
    const i = arr.indexOf(null);
    if (i < 0) return false;
    arr[i] = r;
    return true;
  }

  private spawnEnemy(t: EnemyTemplate, x: number, y: number): Actor {
    const counts: Record<Slot, number> = { body: 0, arm: 0, leg: 0, sense: 0 };
    for (const id of t.relics) counts[RELIC_BY_ID[id].slot]++;
    const scale = 1 + this.floor * 0.08;
    const e = this.newActor(t.name, 'enemy', Math.round(t.hp * scale), t.baseDamage, counts);
    for (const id of t.relics) this.equipFree(e, this.makeRelic(id));
    if (t.engraving) e.engravings.push(ENGRAVING_BY_ID[t.engraving]);
    e.ai = t.ai;
    e.boss = t.boss;
    e.elite = t.id === 'inquisitor';
    e.templateId = t.id;
    e.dropChance = t.dropChance;
    e.x = x;
    e.y = y;
    this.fillArmor(e);
    e.hp = this.st(e).maxHp;
    e.time = this.player.time + this.rng.int(0, 60);
    this.actors.push(e);
    return e;
  }

  get isBossFloor() {
    return this.floor === 3;
  }

  get depthLabel() {
    return `${ZONES[this.zone].name} · ${this.isBossFloor ? '보스' : `${this.floor + 1}층`}`;
  }

  private enterFloor() {
    const p = this.player;
    this.ground.clear();
    this.actors = [p];
    this.floorTurns = 0;
    this.alert = 0;
    this.distCache = null;
    if (this.isBossFloor) {
      this.level = generateBossLevel();
    } else {
      let altarGod: string | undefined;
      if (!this.god && ((this.zone === 0 && this.floor === 1) || (this.zone === 1 && this.floor === 0))) {
        altarGod = GODS[(this.rng.int(0, GODS.length - 1) + this.zone) % GODS.length].id;
      }
      this.level = generateLevel(this.rng, { altarGod });
    }
    const lv = this.level;
    p.x = lv.startX;
    p.y = lv.startY;
    p.statuses = {};
    p.aura = undefined;
    const startRoom = lv.roomOf[lv.idx(p.x, p.y)];
    if (startRoom >= 0) lv.rooms[startRoom].visited = true;

    if (this.isBossFloor) {
      const boss = this.spawnEnemy(ENEMY_BY_ID[ZONES[this.zone].boss], 22, 12);
      boss.awake = false;
      if (this.zone === 1) {
        this.spawnEnemy(ENEMY_BY_ID.cinder_zealot, 20, 8);
        this.spawnEnemy(ENEMY_BY_ID.storm_choir, 20, 16);
      }
      this.log(`${boss.name}이(가) 투기장에서 기다린다.`, 'warn');
    } else {
      const pool = ENEMIES.filter((e) => e.zone.includes(this.zone + 1));
      const n = 6 + this.floor + this.zone * 2;
      const rooms = lv.rooms.filter((r) => r.id !== startRoom);
      for (let i = 0; i < n; i++) {
        const room = this.rng.pick(rooms);
        const pos = this.freeTileIn(room.x, room.y, room.w, room.h);
        if (!pos) continue;
        this.spawnEnemy(this.rng.weighted(pool, (t) => t.weight), pos[0], pos[1]);
      }
      // 잔해 더미: 무작위 부산물 2개
      for (let i = 0; i < 2; i++) {
        const room = this.rng.pick(rooms);
        const pos = this.freeTileIn(room.x, room.y, room.w, room.h);
        if (pos) this.dropItem(pos[0], pos[1], this.makeRelic(this.rollRelic()));
      }
    }
    this.worldTime = p.time;
    this.refreshFov();
    this.emit({ type: 'floor' });
    this.log(`— ${this.depthLabel} —`, 'floor');
  }

  private freeTileIn(x: number, y: number, w: number, h: number): [number, number] | null {
    for (let t = 0; t < 30; t++) {
      const px = this.rng.int(x, x + w - 1),
        py = this.rng.int(y, y + h - 1);
      if (this.level.isFloor(px, py) && !this.actorAt(px, py) && !this.level.featureAt(px, py)) return [px, py];
    }
    return null;
  }

  /** 드롭: 보유 각인의 원소 쪽으로 약 40% 기울임 */
  rollRelic(): RelicDef {
    const gradeW = this.zone === 0 ? { common: 72, holy: 24, forbidden: 4 } : { common: 50, holy: 40, forbidden: 10 };
    const grade = this.rng.weighted(['common', 'holy', 'forbidden'] as const, (g) => gradeW[g]);
    let pool = DROP_POOL.filter((r) => r.grade === grade);
    const want = new Set<Element>();
    for (const e of this.player.engravings) {
      if (e.effect.element) want.add(e.effect.element);
    }
    if (want.size && this.rng.chance(0.4)) {
      const biased = pool.filter((r) => r.elements.some((el) => want.has(el)));
      if (biased.length) pool = biased;
    }
    return this.rng.pick(pool);
  }

  dropItem(x: number, y: number, r: RelicInst) {
    const i = this.level.idx(x, y);
    const arr = this.ground.get(i) ?? [];
    r.dormant = false;
    arr.push(r);
    this.ground.set(i, arr);
  }

  /** 발밑의 부산물 (보급 지점에서는 보급 포드 바닥) */
  groundHere(): RelicInst[] {
    if (this.mode === 'rest') return this.restItems;
    return this.ground.get(this.level.idx(this.player.x, this.player.y)) ?? [];
  }

  // ───────────────────────── 조회 ─────────────────────────

  st(a: Actor): Stats {
    return computeStats(a, this.fullWhenDamaged(a));
  }

  /** 녹의 신 2단계: 파손된 부위의 부산물도 온전한 효과 */
  fullWhenDamaged(a: Actor) {
    return a.isPlayer && this.god?.id === 'rust' && this.godTier() >= 2;
  }

  actorAt(x: number, y: number): Actor | undefined {
    return this.actors.find((a) => !a.dead && a.x === x && a.y === y);
  }

  hostile(a: Actor, b: Actor) {
    return a.faction !== b.faction;
  }

  hostilesOf(a: Actor): Actor[] {
    return this.actors.filter((b) => !b.dead && this.hostile(a, b));
  }

  visibleEnemies(): Actor[] {
    const lv = this.level;
    return this.actors.filter((a) => !a.dead && a.faction === 'enemy' && lv.visible[lv.idx(a.x, a.y)]);
  }

  equippedActives(a: Actor): RelicInst[] {
    return a.slots.arm.filter((r): r is RelicInst => !!r && !!r.def.active);
  }

  engravingCap() {
    return ENGRAVING_SLOTS + (this.god?.id === 'furnace' && this.godTier() >= 3 ? 1 : 0);
  }

  godTier(): number {
    if (!this.god) return 0;
    const p = this.god.piety;
    return p >= 12 ? 3 : p >= 7 ? 2 : p >= 3 ? 1 : 0;
  }

  xpToNext() {
    return XP_TABLE[Math.min(this.plevel, XP_TABLE.length - 1)] + Math.max(0, this.plevel - XP_TABLE.length + 1) * 80;
  }

  /** 행동 순서 바: 다음 n번의 차례 예측 */
  turnOrder(n = 10): Actor[] {
    const lv = this.level;
    const list = this.actors.filter((a) => !a.dead && (a.isPlayer || lv.visible[lv.idx(a.x, a.y)]));
    const t = new Map(list.map((a) => [a, a.time]));
    const out: Actor[] = [];
    for (let i = 0; i < n && list.length; i++) {
      let best = list[0];
      for (const a of list) if (t.get(a)! < t.get(best)! || (t.get(a) === t.get(best) && a.isPlayer)) best = a;
      out.push(best);
      const s = this.st(best);
      t.set(best, t.get(best)! + Math.min(s.moveCost, s.attackCost) * (best.statuses.slow ? 1.5 : 1));
    }
    return out;
  }

  // ───────────────────────── 이벤트 ─────────────────────────

  emit(e: GameEvent) {
    this.events.push(e);
  }

  log(text: string, cls = '') {
    this.emit({ type: 'log', text, cls });
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ───────────────────────── 플레이어 행동 ─────────────────────────

  canAct() {
    return this.mode === 'play' && !this.player.dead;
  }

  move(dx: number, dy: number): boolean {
    if (!this.canAct()) return false;
    const p = this.player;
    const nx = p.x + dx,
      ny = p.y + dy;
    const lv = this.level;
    if (!lv.isFloor(nx, ny)) return false;
    if (dx && dy && (!lv.isFloor(p.x + dx, p.y) || !lv.isFloor(p.x, p.y + dy))) return false;
    const other = this.actorAt(nx, ny);
    if (other && this.hostile(p, other)) {
      this.basicAttack(p, other);
      this.endPlayerAction(this.st(p).attackCost);
      return true;
    }
    if (other) {
      other.x = p.x;
      other.y = p.y;
      this.emit({ type: 'move', actor: other.id, x: other.x, y: other.y });
    }
    this.stepActor(p, nx, ny);
    this.afterPlayerStep();
    this.endPlayerAction(this.st(p).moveCost);
    return true;
  }

  private afterPlayerStep() {
    const p = this.player;
    const lv = this.level;
    const room = lv.roomOf[lv.idx(p.x, p.y)];
    if (room >= 0 && !lv.rooms[room].visited) {
      lv.rooms[room].visited = true;
      this.gainXp(10);
    }
    this.fire(p, 'move', {});
    const items = this.groundHere();
    if (items.length) this.log(`발밑에 부산물: ${items.map((r) => r.def.name).join(', ')} — [G] 장착 / [F] 과부하`, 'item');
    const f = lv.featureAt(p.x, p.y);
    if (f?.kind === 'exit') this.log('출구다. [>] 보급 지점으로 이동한다.', 'item');
    if (f?.kind === 'altar' && !f.used && !this.god) this.mode = 'altar';
  }

  wait(): boolean {
    if (!this.canAct()) return false;
    this.fire(this.player, 'wait', {});
    this.endPlayerAction(100);
    return true;
  }

  /** 액티브 (팔 부산물 index) */
  useActive(armIndex: number, tx?: number, ty?: number): boolean {
    if (!this.canAct()) return false;
    const r = this.equippedActives(this.player)[armIndex];
    if (!r) return false;
    if (r.cd > 0) {
      this.log(`${r.def.name}: 쿨다운 ${r.cd}턴 남음`);
      return false;
    }
    if (r.dormant) {
      this.log(`${r.def.name}이(가) 절전 상태라 쓸 수 없다.`);
      return false;
    }
    const tgt = tx !== undefined && ty !== undefined ? { x: tx, y: ty } : undefined;
    if (!this.performActive(this.player, r, tgt)) return false;
    this.endPlayerAction(this.st(this.player).attackCost);
    return true;
  }

  useKit(): boolean {
    if (!this.canAct()) return false;
    if (this.kits <= 0) {
      this.log('응급 키트가 없다.');
      return false;
    }
    this.kits--;
    this.repairAll(this.player, 0.25);
    this.log('응급 키트: 부산물 수리, 체력 회복.', 'good');
    this.endPlayerAction(100);
    return true;
  }

  /** 과부하: 부산물을 태워 효과를 얻는다. 완전 파괴는 오직 여기서만. */
  offer(r: RelicInst, mode: OfferMode): boolean {
    if (this.mode !== 'play' && this.mode !== 'rest') return false;
    if (r.fixed) {
      this.log('고정 슬롯의 부산물은 과부하할 수 없다.');
      return false;
    }
    if (!this.detachRelic(r)) return false;
    const p = this.player;
    const furnace = this.god?.id === 'furnace';
    const mult = furnace && this.godTier() >= 1 ? 1.3 : 1;
    const el = r.def.elements[0];
    const gradeBonus = { common: 0, holy: 6, forbidden: 12 }[r.def.grade];
    this.stats.offers++;
    this.ash += { common: 2, holy: 4, forbidden: 6 }[r.def.grade];
    this.emit({ type: 'fx', fx: 'offer', x: p.x, y: p.y, element: el });
    this.log(`${r.def.name} 과부하 → ${OFFER_NAME[mode]}`, 'offer');
    const near = this.nearestHostile(p, 9);
    switch (mode) {
      case 'strike':
        if (near) this.dealDamage(p, near, Math.round((10 + gradeBonus + this.zone * 4) * mult), el, { label: '과부하 일격', pierce: true });
        else this.log('일격을 받을 적이 없다. 출력이 허공으로 흩어졌다.');
        break;
      case 'retrigger':
        for (const eng of p.engravings) this.runEngraving(p, eng, { target: near, element: el, x: near?.x, y: near?.y }, mult);
        break;
      case 'cooldown':
        for (const a of this.equippedActives(p)) a.cd = 0;
        break;
      case 'repair':
        this.repairAll(p, 0.2 * mult);
        break;
    }
    if (furnace) {
      this.god!.piety++;
      if (this.godTier() >= 2) this.heal(p, Math.round(this.st(p).maxHp * 0.08));
    }
    if (this.mode === 'play') this.endPlayerAction(100);
    return true;
  }

  /**
   * 장착: 바닥의 부산물을 slot[index]에 끼운다. 기존 부산물은 버리거나(drop) 과부하(태워서 쿨다운 초기화)한다.
   */
  graft(r: RelicInst, index: number, disposal: 'drop' | 'offer' = 'drop'): boolean {
    if (this.mode !== 'play' && this.mode !== 'rest') return false;
    const p = this.player;
    const arr = p.slots[r.def.slot];
    if (index < 0 || index >= arr.length) return false;
    const old = arr[index];
    const armorBefore = this.armorMaxes(p);
    if (old?.fixed) {
      this.log('고정 슬롯은 교체할 수 없다.');
      return false;
    }
    const ground = this.groundHere();
    const gi = ground.indexOf(r);
    if (gi < 0) return false;
    ground.splice(gi, 1);
    if (old) {
      arr[index] = null;
      if (disposal === 'drop') {
        if (this.mode === 'rest') this.restItems.push(old);
        else this.dropItem(p.x, p.y, old);
        if (this.god?.id === 'furnace') {
          this.god.piety = Math.max(0, this.god.piety - 2);
          this.log('용광로의 신이 버려진 부산물에 노한다. (신앙 -2)', 'bad');
        }
      } else {
        this.ash += 2;
        this.stats.offers++;
        for (const a of this.equippedActives(p)) a.cd = 0;
        this.log(`${old.def.name} 과부하 → 쿨다운 초기화`, 'offer');
        if (this.god?.id === 'furnace') this.god.piety++;
      }
      old.dormant = false;
    }
    arr[index] = r;
    r.cd = 0;
    this.stats.grafts++;
    if (this.god?.id === 'rust') {
      this.god.piety = Math.max(0, this.god.piety - 3);
      this.god.grafted = true;
      this.log('녹의 신이 새 부산물을 싫어한다. (신앙 -3)', 'bad');
    }
    this.recomputeBurden(p);
    this.syncArmor(p, armorBefore);
    this.log(`${SLOT_NAME[r.def.slot]} 슬롯에 ${r.def.name} 장착. 슈트가 부산물을 변환했다.`, 'good');
    this.emit({ type: 'loadout', actor: p.id });
    if (this.mode === 'play') this.endPlayerAction(100);
    return true;
  }

  /** 출구에서 보급 지점으로 */
  descend(): boolean {
    if (!this.canAct()) return false;
    const f = this.level.featureAt(this.player.x, this.player.y);
    if (f?.kind !== 'exit') {
      this.log('출구 위에서만 내려갈 수 있다.');
      return false;
    }
    if (this.isBossFloor && this.actors.some((a) => a.boss && !a.dead)) {
      this.log('보스가 살아있는 한 출구는 열리지 않는다.', 'warn');
      return false;
    }
    this.stats.floorTurns.push(this.floorTurns);
    this.gainXp(30);
    if (this.isBossFloor && this.zone === ZONES.length - 1) {
      this.mode = 'won';
      this.log('연료 결정을 모두 모았다. 우주선이 다시 떠오른다.', 'good');
      return true;
    }
    this.enterRest();
    return true;
  }

  private enterRest() {
    this.mode = 'rest';
    this.restUsed = false;
    this.restItems = [];
    const p = this.player;
    // 보급 지점에서는 항상 모든 부산물을 수리한다
    this.repairAll(p, this.god?.id === 'rust' && this.godTier() >= 3 ? 0.4 : 0.15);
    this.restService = this.rng.pick(['shop', 'reforge', 'engrave'] as const);
    if (this.restService === 'shop') {
      this.shop = [0, 1, 2].map(() => {
        const r = this.makeRelic(this.rollRelic());
        return { relic: r, price: { common: 5, holy: 10, forbidden: 14 }[r.def.grade] };
      });
    }
    if (this.restService === 'engrave') this.levelChoices = this.rollEngravings(3);
    if (this.god?.id === 'rust') {
      this.god.piety += 2;
      if (this.godTier() >= 1) {
        for (const r of allRelics(p)) r.upgrade = Math.min(3, r.upgrade + 1);
        this.log('녹의 신의 은총: 장착된 부산물이 단단해졌다.', 'good');
      }
    }
    this.log(`보급 지점: 부산물 수리 완료. ${REST_NAME[this.restService]}이(가) 열려 있다.`, 'floor');
  }

  buy(i: number): boolean {
    const s = this.shop[i];
    if (!s || this.mode !== 'rest' || this.ash < s.price) return false;
    this.ash -= s.price;
    this.shop.splice(i, 1);
    this.restItems.push(s.relic);
    this.log(`${s.relic.def.name}을(를) 샀다. 바닥에 놓였다.`, 'good');
    return true;
  }

  buyKit(): boolean {
    if (this.mode !== 'rest' || this.ash < 4 || this.kits >= MAX_KITS) return false;
    this.ash -= 4;
    this.kits++;
    return true;
  }

  reforge(r: RelicInst, el: Element): boolean {
    if (this.mode !== 'rest' || this.restService !== 'reforge' || this.restUsed) return false;
    const els = r.def.elements.length ? [el, ...r.def.elements.slice(1)] : [el];
    r.def = { ...r.def, elements: [...new Set(els)] };
    if (r.def.active) r.def.active = { ...r.def.active, element: el };
    this.restUsed = true;
    this.emit({ type: 'loadout', actor: this.player.id });
    this.log(`${r.def.name}을(를) ${ELEMENT_NAME[el]}(으)로 개조했다.`, 'good');
    return true;
  }

  leaveRest() {
    if (this.mode !== 'rest') return;
    this.mode = 'play';
    if (this.isBossFloor) {
      this.zone++;
      this.floor = 0;
    } else this.floor++;
    this.enterFloor();
    this.checkLevelUp();
  }

  acceptGod(accept: boolean) {
    const f = this.level.featureAt(this.player.x, this.player.y);
    if (f?.kind !== 'altar') {
      this.mode = 'play';
      return;
    }
    f.used = true;
    this.mode = 'play';
    if (accept) {
      this.god = { id: f.godId!, piety: 0, grafted: false };
      const g = GODS.find((x) => x.id === f.godId)!;
      this.log(`${g.name}을(를) 섬기기로 했다. ${g.law}`, 'good');
    }
  }

  /** 레벨업/각인사 선택. replace: 칸이 꽉 찼을 때 지울 각인 index */
  chooseEngraving(id: string | null, replace?: number) {
    const p = this.player;
    if (id) {
      const e = ENGRAVING_BY_ID[id];
      if (p.engravings.length >= this.engravingCap()) {
        if (replace === undefined) return false;
        const old = p.engravings.splice(replace, 1)[0];
        this.log(`각인 「${old.name}」을(를) 지웠다.`);
      }
      p.engravings.push(e);
      this.log(`각인 「${e.name}」을(를) 새겼다.`, 'good');
    }
    if (this.mode === 'levelup') {
      this.pendingLevelUps--;
      this.mode = 'play';
      this.checkLevelUp();
    } else if (this.mode === 'rest') {
      this.restUsed = true;
      this.levelChoices = [];
    }
    return true;
  }

  private rollEngravings(n: number): EngravingDef[] {
    const owned = new Set(this.player.engravings.map((e) => e.id));
    const pool = this.rng.shuffle(ENGRAVING_POOL.filter((e) => !owned.has(e.id)));
    return pool.slice(0, n);
  }

  private gainXp(n: number) {
    this.xp += n;
    while (this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.plevel++;
      this.pendingLevelUps++;
      const p = this.player;
      p.baseHp += 3;
      this.heal(p, Math.round(this.st(p).maxHp * 0.25));
      this.emit({ type: 'levelup' });
      this.log(`레벨 ${this.plevel}! 새 각인을 고를 수 있다.`, 'good');
    }
    this.checkLevelUp();
  }

  private checkLevelUp() {
    if (this.mode === 'play' && this.pendingLevelUps > 0 && !this.player.dead) {
      this.levelChoices = this.rollEngravings(3);
      this.mode = 'levelup';
    }
  }

  // ───────────────────────── 오토탐험 ─────────────────────────

  /** 다음 오토탐험 한 걸음. 적이 보이거나 할 일이 없으면 null */
  autoExploreDir(): [number, number] | 'done' | 'enemy' {
    if (this.visibleEnemies().length) return 'enemy';
    const lv = this.level;
    const p = this.player;
    const dist = bfs(lv, p.x, p.y, (x, y) => !!lv.explored[lv.idx(x, y)]);
    let best = -1,
      bestD = 1e9;
    for (let i = 0; i < dist.length; i++) {
      const d = dist[i];
      if (d <= 0 || d >= bestD) continue;
      const x = i % lv.w,
        y = (i / lv.w) | 0;
      let frontier = false;
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx,
          ny = y + dy;
        if (lv.inBounds(nx, ny) && !lv.explored[lv.idx(nx, ny)]) frontier = true;
      }
      const hasItem = (this.ground.get(i)?.length ?? 0) > 0;
      if (frontier || hasItem) {
        best = i;
        bestD = d;
      }
    }
    if (best < 0) return 'done';
    return this.stepToward(best % lv.w, (best / lv.w) | 0);
  }

  /** (x,y)를 향한 첫 걸음 (탐험된 칸만 통과) */
  stepToward(tx: number, ty: number): [number, number] | 'done' {
    const lv = this.level;
    const p = this.player;
    if (p.x === tx && p.y === ty) return 'done';
    const dist = bfs(lv, tx, ty, (x, y) => !!lv.explored[lv.idx(x, y)] || (x === p.x && y === p.y));
    let bd = dist[lv.idx(p.x, p.y)];
    if (bd < 0) return 'done';
    let dir: [number, number] | null = null;
    for (const [dx, dy] of DIRS8) {
      const nx = p.x + dx,
        ny = p.y + dy;
      if (!lv.isFloor(nx, ny)) continue;
      if (dx && dy && (!lv.isFloor(p.x + dx, p.y) || !lv.isFloor(p.x, p.y + dy))) continue;
      const d = dist[lv.idx(nx, ny)];
      if (d >= 0 && d < bd) {
        bd = d;
        dir = [dx, dy];
      }
    }
    return dir ?? 'done';
  }

  // ───────────────────────── 턴 진행 ─────────────────────────

  private endPlayerAction(cost: number) {
    const p = this.player;
    this.stats.turns++;
    p.time += this.actionCost(p, cost);
    this.refreshFov();
    this.runUntilPlayer();
    p.engravingFires.clear();
    this.refreshFov();
    this.checkLevelUp();
  }

  private actionCost(a: Actor, base: number) {
    let c = base;
    if (a.statuses.slow) c *= 1.5;
    if (a.haste) {
      c *= 1 - a.haste / 100;
      a.haste = 0;
    }
    return Math.max(20, Math.round(c));
  }

  private runUntilPlayer() {
    const p = this.player;
    for (let guard = 0; guard < 2000; guard++) {
      if (p.dead) return;
      // 월드 틱 (100 단위)
      let next: Actor = p;
      for (const a of this.actors) if (!a.dead && a.time < next.time) next = a;
      while (next.time >= this.worldTime + 100) {
        this.worldTime += 100;
        this.worldTick();
        if (p.dead) return;
      }
      if (next === p) return;
      this.actorTurn(next);
    }
  }

  private worldTick() {
    this.floorTurns++;
    const lv = this.level;
    // 보호막은 서서히 흩어진다 (대기로 미리 쌓아두기 방지)
    for (const a of this.actors) if (a.shield > 0) a.shield--;
    // 쿨다운
    for (const a of this.actors) if (!a.dead) for (const r of a.slots.arm) if (r && r.cd > 0) r.cd--;
    // 지형
    for (const [i, t] of lv.terrain) {
      const x = i % lv.w,
        y = (i / lv.w) | 0;
      const a = this.actorAt(x, y);
      if (a && a.faction !== t.faction) {
        if (t.kind === 'flame') this.dealDamage(null, a, t.power, 'fire', { label: '불길', noTrigger: true });
        else if (t.kind === 'current') this.dealDamage(null, a, t.power, 'lightning', { label: '전류', noTrigger: true });
        else if (t.kind === 'ice') this.addStatus(a, 'slow', 1);
      }
      if (--t.turns <= 0) lv.terrain.delete(i);
    }
    // 저주: 체력 흡수
    const p = this.player;
    if (allRelics(p).some((r) => r.def.curse?.kind === 'hpDrain' && !r.dormant)) {
      p.hp -= Math.max(1, Math.round(this.st(p).maxHp * 0.01));
      if (p.hp <= 0) this.kill(p, null);
    }
    // 소환물 수명
    for (const a of this.actors)
      if (a.lifetime !== undefined && !a.dead && --a.lifetime <= 0) {
        a.dead = true;
        this.emit({ type: 'death', actor: a.id, x: a.x, y: a.y });
      }
    // 경보 수준
    if (!this.isBossFloor) {
      const nextAlert = ALERT_THRESHOLDS.filter((t) => this.floorTurns >= t).length;
      if (nextAlert > this.alert) {
        this.alert = nextAlert;
        const msg = ['', '던전 어딘가에서 북소리가 울린다. (경보 1)', '순찰대가 깨어났다. 모두가 너를 찾는다. (경보 2)', '정예 순찰대가 끝없이 몰려온다! 출구로! (경보 3)'][this.alert];
        this.log(msg, 'warn');
        this.emit({ type: 'alert' });
        if (this.alert >= 2) for (const a of this.actors) a.awake = true;
        if (this.alert === 1) this.spawnPatrol(false);
      }
      if (this.alert >= 3 && this.floorTurns % 12 === 0) this.spawnPatrol(true);
    }
    this.actors = this.actors.filter((a) => !a.dead || a.isPlayer);
  }

  private spawnPatrol(elite: boolean) {
    const lv = this.level;
    const p = this.player;
    for (let t = 0; t < 60; t++) {
      const room = this.rng.pick(lv.rooms);
      const pos = this.freeTileIn(room.x, room.y, room.w, room.h);
      if (!pos || lv.visible[lv.idx(pos[0], pos[1])]) continue;
      if (Math.abs(pos[0] - p.x) + Math.abs(pos[1] - p.y) < 8) continue;
      const tpl = elite ? ENEMY_BY_ID.inquisitor : this.rng.weighted(ENEMIES.filter((e) => e.zone.includes(this.zone + 1)), (e) => e.weight);
      const e = this.spawnEnemy(tpl, pos[0], pos[1]);
      e.awake = true;
      return;
    }
  }

  private actorTurn(a: Actor) {
    a.engravingFires.clear();
    // 상태이상 처리
    if (a.statuses.burn) this.dealDamage(null, a, 2 + this.zone, 'fire', { label: '화상', noTrigger: true });
    if (a.dead) return;
    const stunned = !!a.statuses.stun;
    for (const k of Object.keys(a.statuses) as StatusKind[]) {
      if (--a.statuses[k]! <= 0) delete a.statuses[k];
    }
    if (a.aura && --a.aura.turns <= 0) a.aura = undefined;
    if (stunned) {
      a.time += 100;
      return;
    }
    const cost = a.ai === 'wraith' ? this.wraithAct(a) : this.enemyAct(a);
    a.time += this.actionCost(a, cost);
  }

  // ───────────────────────── AI ─────────────────────────

  private playerDist(): Int32Array {
    const p = this.player;
    const key = this.level.idx(p.x, p.y);
    if (this.distCache?.key !== key) this.distCache = { key, dist: bfs(this.level, p.x, p.y) };
    return this.distCache.dist;
  }

  private enemyAct(e: Actor): number {
    const p = this.player;
    const lv = this.level;
    const s = this.st(e);
    const target = this.chooseTarget(e);
    const cheb = target ? Math.max(Math.abs(target.x - e.x), Math.abs(target.y - e.y)) : 99;
    if (!e.awake) {
      if (cheb <= 8 && target && hasLos(lv, e.x, e.y, target.x, target.y)) {
        e.awake = true;
        if (e.boss) this.log(`${e.name}이(가) 깨어났다!`, 'warn');
      } else return 100;
    }
    if (!target) return 100;
    const los = hasLos(lv, e.x, e.y, target.x, target.y);
    // 보스: 체력 절반에서 증원
    if (e.boss && !e.summoned && e.hp < s.maxHp / 2) {
      e.summoned = true;
      for (let i = 0; i < 2; i++) {
        const pos = this.freeNear(e.x, e.y, 3);
        if (pos) this.spawnEnemy(this.rng.pick(ENEMIES.filter((t) => t.zone.includes(this.zone + 1))), pos[0], pos[1]).awake = true;
      }
      this.log(`${e.name}이(가) 종을 울려 시종들을 부른다!`, 'warn');
    }
    // 액티브
    for (const r of this.equippedActives(e)) {
      if (r.cd > 0 || r.dormant) continue;
      const sp = r.def.active!;
      const range = sp.range ?? 1;
      const ok =
        sp.form === 'sweep' ? cheb <= 1 :
        sp.form === 'nova' ? cheb <= 2 :
        sp.form === 'dash' ? cheb >= 2 && cheb <= range && los :
        cheb <= range && los;
      if (ok && this.rng.chance(e.boss ? 0.9 : 0.6)) {
        this.performActive(e, r, { x: target.x, y: target.y });
        return s.attackCost;
      }
    }
    if (cheb <= 1 && this.canStepDiag(e.x, e.y, target.x - e.x, target.y - e.y)) {
      this.basicAttack(e, target);
      return s.attackCost;
    }
    // 원거리형: 거리 유지
    if (e.ai === 'ranged' && cheb <= 2 && los) {
      const away = this.bestStep(e, (nx, ny) => -Math.max(Math.abs(nx - target.x), Math.abs(ny - target.y)));
      if (away) {
        this.stepActor(e, away[0], away[1]);
        return s.moveCost;
      }
    }
    // 접근
    let step: [number, number] | null;
    if (target === p) {
      const dist = this.playerDist();
      step = this.bestStep(e, (nx, ny) => dist[lv.idx(nx, ny)] < 0 ? 1e6 : dist[lv.idx(nx, ny)]);
    } else {
      step = this.bestStep(e, (nx, ny) => Math.max(Math.abs(nx - target.x), Math.abs(ny - target.y)));
    }
    if (step) {
      this.stepActor(e, step[0], step[1]);
      return s.moveCost;
    }
    return 100;
  }

  private wraithAct(w: Actor): number {
    const s = this.st(w);
    const foe = this.nearestHostile(w, 7);
    if (foe) {
      const cheb = Math.max(Math.abs(foe.x - w.x), Math.abs(foe.y - w.y));
      if (cheb <= 1) {
        this.basicAttack(w, foe);
        return s.attackCost;
      }
      const step = this.bestStep(w, (nx, ny) => Math.max(Math.abs(nx - foe.x), Math.abs(ny - foe.y)));
      if (step) this.stepActor(w, step[0], step[1]);
      return s.moveCost;
    }
    const p = this.player;
    if (Math.max(Math.abs(p.x - w.x), Math.abs(p.y - w.y)) > 2) {
      const step = this.bestStep(w, (nx, ny) => Math.max(Math.abs(nx - p.x), Math.abs(ny - p.y)));
      if (step) this.stepActor(w, step[0], step[1]);
    }
    return 100;
  }

  private chooseTarget(e: Actor): Actor | undefined {
    // 소환물이 가까우면 소환물을 노림
    let best: Actor | undefined;
    let bd = 1e9;
    for (const a of this.actors) {
      if (a.dead || !this.hostile(e, a)) continue;
      const d = Math.max(Math.abs(a.x - e.x), Math.abs(a.y - e.y)) + (a.isPlayer ? 0 : 1);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  private canStepDiag(x: number, y: number, dx: number, dy: number) {
    if (!dx || !dy) return true;
    return this.level.isFloor(x + dx, y) && this.level.isFloor(x, y + dy);
  }

  private bestStep(a: Actor, score: (x: number, y: number) => number): [number, number] | null {
    const cur = score(a.x, a.y);
    let best: [number, number] | null = null;
    let bs = cur;
    for (const [dx, dy] of DIRS8) {
      const nx = a.x + dx,
        ny = a.y + dy;
      if (!this.level.isFloor(nx, ny) || this.actorAt(nx, ny) || !this.canStepDiag(a.x, a.y, dx, dy)) continue;
      const sc = score(nx, ny) + (dx && dy ? 0.01 : 0);
      if (sc < bs) { bs = sc; best = [nx, ny]; }
    }
    return best;
  }

  private freeNear(x: number, y: number, r: number): [number, number] | null {
    for (let t = 0; t < 40; t++) {
      const nx = x + this.rng.int(-r, r),
        ny = y + this.rng.int(-r, r);
      if (this.level.isFloor(nx, ny) && !this.actorAt(nx, ny)) return [nx, ny];
    }
    return null;
  }

  private stepActor(a: Actor, x: number, y: number) {
    a.x = x;
    a.y = y;
    this.emit({ type: 'move', actor: a.id, x, y });
  }

  nearestHostile(a: Actor, range: number, exclude?: Set<Actor>): Actor | undefined {
    let best: Actor | undefined;
    let bd = 1e9;
    for (const b of this.actors) {
      if (b.dead || !this.hostile(a, b) || exclude?.has(b)) continue;
      const d = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      if (d > range || d >= bd) continue;
      if (!hasLos(this.level, a.x, a.y, b.x, b.y)) continue;
      bd = d;
      best = b;
    }
    return best;
  }

  // ───────────────────────── 전투 ─────────────────────────

  private basicAttack(a: Actor, t: Actor) {
    const s = this.st(a);
    const el = a.imbue;
    a.imbue = undefined;
    this.emit({ type: 'attack', actor: a.id, target: t.id });
    this.dealDamage(a, t, Math.max(1, Math.round(s.damage * this.dmgMult(a))), el, { dodgeable: true });
    this.fire(a, 'attack', { target: t.dead ? undefined : t, element: el, x: t.x, y: t.y });
  }

  /** 액티브 실행. 형태 × 원소 × 수치 */
  performActive(a: Actor, r: RelicInst, tgt?: { x: number; y: number }): boolean {
    const sp = r.def.active!;
    const el = sp.element;
    const power = Math.round(sp.power * this.factorOf(a, r) * this.dmgMult(a));
    const rider = el ? FORM_RIDERS[sp.form][el] : undefined;
    const label = `${r.def.name}·${FORM_NAME[sp.form]}`;
    const hitWith = (t: Actor, pw: number) => {
      this.dealDamage(a, t, pw, el, { label, dodgeable: sp.form === 'throw' });
      if (rider && !t.dead) this.applyEffect(a, rider(pw), { target: t, element: el, x: t.x, y: t.y }, label);
      else if (rider && t.dead) {
        const sp2 = rider(pw);
        if (sp2.kind === 'terrain' || sp2.kind === 'blast') this.applyEffect(a, sp2, { element: el, x: t.x, y: t.y }, label);
      }
    };
    const range = sp.range ?? 1;
    switch (sp.form) {
      case 'sweep':
      case 'nova': {
        const rad = sp.form === 'sweep' ? 1 : 2;
        this.emit({ type: 'fx', fx: 'blast', x: a.x, y: a.y, radius: rad, element: el });
        if (sp.unique === 'steam') for (const t of this.hostilesInRadius(a, a.x, a.y, rad)) this.dealDamage(a, t, Math.round(power / 2), 'cold', { label });
        for (const t of this.hostilesInRadius(a, a.x, a.y, rad)) hitWith(t, power);
        break;
      }
      case 'dash': {
        if (!tgt) return false;
        const t = this.actorAt(tgt.x, tgt.y);
        if (!t || !this.hostile(a, t)) {
          if (a.isPlayer) this.log('돌진할 적을 골라야 한다.');
          return false;
        }
        const path = linePoints(a.x, a.y, t.x, t.y, range);
        let last: [number, number] | null = null;
        for (const [x, y] of path) {
          if (x === t.x && y === t.y) break;
          if (!this.level.isFloor(x, y) || this.actorAt(x, y)) break;
          last = [x, y];
          if (el === 'fire') this.setTerrain(x, y, 'flame', Math.ceil(power / 3), 3, a.faction);
        }
        if (Math.max(Math.abs(t.x - a.x), Math.abs(t.y - a.y)) > range + 1) {
          if (a.isPlayer) this.log('너무 멀다.');
          return false;
        }
        if (last) this.stepActor(a, last[0], last[1]);
        if (Math.max(Math.abs(t.x - a.x), Math.abs(t.y - a.y)) <= 1) {
          this.emit({ type: 'fx', fx: 'line', x: a.x, y: a.y, tx: t.x, ty: t.y, element: el });
          this.dealDamage(a, t, power, el, { label });
          if (rider && el !== 'fire') this.applyEffect(a, rider(power), { target: t, element: el, x: t.x, y: t.y }, label);
        }
        break;
      }
      case 'throw':
      case 'bolt': {
        if (!tgt) return false;
        if (tgt.x === a.x && tgt.y === a.y) return false;
        const path = linePoints(a.x, a.y, tgt.x, tgt.y, sp.form === 'bolt' ? range : Math.min(range, Math.max(Math.abs(tgt.x - a.x), Math.abs(tgt.y - a.y))));
        let end: [number, number] = [a.x, a.y];
        for (const [x, y] of path) {
          if (!this.level.isFloor(x, y)) break;
          end = [x, y];
          const t = this.actorAt(x, y);
          if (t && this.hostile(a, t)) {
            hitWith(t, power);
            if (sp.form === 'throw') break;
          } else if (t && sp.form === 'throw') break;
        }
        this.emit({ type: 'fx', fx: 'line', x: a.x, y: a.y, tx: end[0], ty: end[1], element: el });
        if (sp.form === 'throw' && rider && !this.actorAt(end[0], end[1])) {
          const sp2 = rider(power);
          if (sp2.kind === 'terrain' || sp2.kind === 'blast') this.applyEffect(a, sp2, { element: el, x: end[0], y: end[1] }, label);
        }
        break;
      }
    }
    r.cd = sp.cooldown;
    if (r.def.curse?.kind === 'burnSelf') this.addStatus(a, 'burn', 2);
    if (a.isPlayer) this.log(`${label}!`, 'skill');
    const hitTarget = tgt ? this.actorAt(tgt.x, tgt.y) : undefined;
    this.fire(a, 'attack', { element: el, target: hitTarget && !hitTarget.dead ? hitTarget : this.nearestHostile(a, 2) });
    return true;
  }

  /** 적 피해 배율: 구역이 깊을수록 강해진다 */
  private dmgMult(a: Actor) {
    if (a.faction === 'player') return 1;
    return (a.boss || a.elite ? 0.8 : 0.6) + this.zone * 0.2 + this.floor * 0.04;
  }

  hostilesInRadius(a: Actor, x: number, y: number, r: number): Actor[] {
    return this.actors.filter((b) => !b.dead && this.hostile(a, b) && Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) <= r);
  }

  /** 피해 파이프라인: 회피 → 원소 친화 → 복합 반응 → 보호막 → 장갑(몸 부산물) → 체력 */
  dealDamage(src: Actor | null, t: Actor, amount: number, el: Element | undefined, opts: DamageOpts = {}) {
    if (t.dead || amount <= 0) return;
    const ts = this.st(t);
    if (opts.dodgeable) {
      const blindMiss = src?.statuses.blind ? 0.35 : 0;
      if (this.rng.next() < ts.dodge / 100 + blindMiss) {
        this.emit({ type: 'dodge', target: t.id, x: t.x, y: t.y });
        if (t.isPlayer) this.log(`${src?.name ?? '공격'}을(를) 피했다.`);
        return;
      }
    }
    let dmg = amount;
    let pierce = !!opts.pierce;
    if (src && el) dmg *= 1 + 0.08 * this.st(src).attune[el];
    if (el) dmg *= 1 - Math.min(0.45, 0.12 * ts.attune[el]);

    // 원소 복합 반응 (대상에 남은 다른 원소의 잔류와 섞임)
    let comboAura: Element | undefined;
    if (el && t.aura && t.aura.element !== el) {
      comboAura = t.aura.element;
      t.aura = undefined;
      const pair = new Set([el, comboAura]);
      this.stats.combos++;
      if (pair.has('fire') && pair.has('cold')) {
        this.comboFx(t, '증기 폭발');
        for (const b of this.actors.filter((b) => !b.dead && b.faction === t.faction && Math.max(Math.abs(b.x - t.x), Math.abs(b.y - t.y)) <= 2)) {
          this.addStatus(b, 'blind', 2);
          if (b !== t) this.dealDamage(src, b, Math.round(dmg * 0.6), undefined, { label: '증기 폭발', noTrigger: true });
        }
        this.emit({ type: 'fx', fx: 'blast', x: t.x, y: t.y, radius: 2, element: 'cold' });
      } else if (pair.has('fire') && pair.has('lightning')) {
        this.comboFx(t, '플라즈마');
        pierce = true;
        dmg *= 1.5;
      } else if (pair.has('lightning') && pair.has('cold')) {
        this.comboFx(t, '초전도');
        this.chainFrom(src, t, Math.round(dmg * 0.5), undefined, 3, true);
      } else if (pair.has('impact')) {
        const other = el === 'impact' ? comboAura : el;
        this.comboFx(t, `충돌·${ELEMENT_NAME[other]}`);
        this.addStatus(t, 'stun', 1);
        dmg *= 1.25;
      }
    } else if (el) {
      t.aura = { element: el, turns: 3 };
    }
    dmg = Math.max(1, Math.round(dmg));

    // 보호막
    if (t.shield > 0) {
      const absorbed = Math.min(t.shield, dmg);
      t.shield -= absorbed;
      dmg -= absorbed;
    }
    // 맞은 부위의 슈트 장갑이 먼저 받는다. 0이 되면 그 부위가 파손된다
    let overflow = dmg;
    if (!pierce && dmg > 0) {
      const part = this.rng.weighted(SLOTS, (k) => HIT_WEIGHT[k]);
      const before = t.partArmor[part];
      if (before > 0) {
        const take = Math.min(before, dmg);
        t.partArmor[part] -= take;
        overflow = dmg - take;
        if (t.partArmor[part] <= 0) this.breakPart(t, part);
      }
    }
    if (src?.isPlayer) this.stats.damageDealt += dmg;
    t.hp -= overflow;
    this.emit({ type: 'damage', target: t.id, amount: dmg, element: el, x: t.x, y: t.y, text: opts.label });
    if (t.isPlayer && src) this.log(`${src.name}의 ${opts.label ?? '공격'}: ${dmg}${el ? ` ${ELEMENT_NAME[el]}` : ''} 피해`, 'bad');

    if (el === 'fire' && !t.statuses.burn && this.rng.chance(0.4)) this.addStatus(t, 'burn', 2);
    if (el === 'cold') this.addStatus(t, 'slow', 1);
    if (t.hp <= 0) {
      this.kill(t, src);
    }

    // 피격: 행동하는 적(또는 아군)에게 맞았을 때만. 지형·화상 같은 지속 피해는 제외
    if (!opts.noTrigger && src && !t.dead) this.fire(t, 'hit', { target: src, element: el });
    if (!t.isPlayer) t.awake = true;
  }

  private comboFx(t: Actor, name: string) {
    this.emit({ type: 'fx', fx: 'combo', x: t.x, y: t.y, text: name });
    this.log(`⟡ ${name}!`, 'combo');
  }

  private breakPart(a: Actor, part: Slot) {
    this.emit({ type: 'loadout', actor: a.id });
    if (a.isPlayer) {
      const names = a.slots[part].filter((r): r is RelicInst => !!r).map((r) => r.def.name);
      this.log(`${SLOT_NAME[part]} 슈트 파손: ${names.length ? names.join(', ') + ' 효과 절반' : '부착된 부산물 없음'}.`, 'bad');
    }
    const maxHp = this.st(a).maxHp;
    if (a.hp > maxHp) a.hp = maxHp;
  }

  /** 부산물 효과 배율 (부위 파손 반영) */
  factorOf(a: Actor, r: RelicInst) {
    return relicFactor(r, !this.fullWhenDamaged(a) && isBroken(a, r.def.slot));
  }

  /** 모든 부위 장갑을 가득 채운다 */
  fillArmor(a: Actor) {
    for (const k of SLOTS) a.partArmor[k] = partArmorMax(a, k);
  }

  /** 장착이 바뀐 뒤: 늘어난 최대치만큼 채우고, 줄었으면 깎는다 */
  private syncArmor(a: Actor, before: Record<Slot, number>) {
    for (const k of SLOTS) {
      const max = partArmorMax(a, k);
      const delta = max - before[k];
      a.partArmor[k] = Math.max(0, Math.min(max, a.partArmor[k] + Math.max(0, delta)));
    }
  }

  private armorMaxes(a: Actor): Record<Slot, number> {
    return { body: partArmorMax(a, 'body'), arm: partArmorMax(a, 'arm'), leg: partArmorMax(a, 'leg'), sense: partArmorMax(a, 'sense') };
  }

  /** 가장 많이 깎인 부위부터 n만큼 수리 */
  repairArmor(a: Actor, n: number) {
    while (n > 0) {
      let worst: Slot | null = null;
      let ratio = 1;
      for (const k of SLOTS) {
        const max = partArmorMax(a, k);
        if (max <= 0 || a.partArmor[k] >= max) continue;
        const rr = a.partArmor[k] / max;
        if (rr < ratio) { ratio = rr; worst = k; }
      }
      if (!worst) return;
      const add = Math.min(n, partArmorMax(a, worst) - a.partArmor[worst]);
      a.partArmor[worst] += add;
      n -= add;
    }
  }

  private kill(t: Actor, src: Actor | null) {
    if (t.dead) return;
    t.dead = true;
    t.hp = 0;
    this.emit({ type: 'death', actor: t.id, x: t.x, y: t.y });
    if (t.isPlayer) {
      this.mode = 'dead';
      this.log('클론의 생체 신호가 끊겼다. 복제 포드가 다음 클론을 준비한다.', 'bad');
      return;
    }
    if (t.faction === 'enemy') {
      this.stats.kills++;
      this.log(`${t.name}을(를) 쓰러뜨렸다.`);
      // 실제로 쓰던 부산물 중 하나를 떨어뜨림
      const droppable = allRelics(t).filter((r) => !r.def.enemyOnly);
      if (droppable.length && this.rng.chance(t.dropChance)) {
        const r = this.rng.pick(droppable);
        r.dormant = false;
        r.cd = 0;
        this.dropItem(t.x, t.y, r);
        this.log(`잔해에서 ${r.def.name}이(가) 떨어졌다.`, 'item');
      }
      if (t.boss) {
        const loot = ZONES[this.zone].bossLoot;
        if (loot.length) this.dropItem(t.x, t.y, this.makeRelic(this.rng.pick(loot)));
        this.dropItem(t.x, t.y, this.makeRelic(this.rollRelic()));
        this.kits = Math.min(MAX_KITS, this.kits + 1);
        this.log('연료 결정을 회수했다. 출구가 열렸다.', 'good');
      }
      this.ash += 1;
    }
  }

  addStatus(a: Actor, s: StatusKind, turns: number) {
    if (a.dead) return;
    if (s === 'stun' && a.boss) turns = Math.min(turns, 1);
    a.statuses[s] = Math.max(a.statuses[s] ?? 0, turns);
  }

  heal(a: Actor, n: number) {
    const max = this.st(a).maxHp;
    a.hp = Math.min(max, a.hp + n);
  }

  repairAll(a: Actor, healFrac: number) {
    this.recomputeBurden(a);
    this.fillArmor(a);
    this.heal(a, Math.round(this.st(a).maxHp * healFrac));
    this.emit({ type: 'loadout', actor: a.id });
  }

  /** 부담이 넘치면 무작위 부산물이 절전된다 */
  recomputeBurden(a: Actor) {
    const rs = allRelics(a);
    for (const r of rs) r.dormant = false;
    const s = this.st(a);
    const over = s.burden - s.burdenCap;
    if (over > 0) {
      const cands = this.rng.shuffle(rs.filter((r) => !r.fixed));
      const n = Math.min(cands.length, Math.ceil(over / 5));
      for (let i = 0; i < n; i++) cands[i].dormant = true;
      if (a.isPlayer) this.log(`부담 초과(${s.burden}/${s.burdenCap}): ${cands.slice(0, n).map((r) => r.def.name).join(', ')}이(가) 절전되었다.`, 'warn');
    }
    const max = this.st(a).maxHp;
    if (a.hp > max) a.hp = max;
  }

  private detachRelic(r: RelicInst): boolean {
    const p = this.player;
    for (const s of SLOTS) {
      const i = p.slots[s].indexOf(r);
      if (i >= 0) {
        const before = this.armorMaxes(p);
        p.slots[s][i] = null;
        this.recomputeBurden(p);
        this.syncArmor(p, before);
        this.emit({ type: 'loadout', actor: p.id });
        return true;
      }
    }
    const g = this.groundHere();
    const gi = g.indexOf(r);
    if (gi >= 0) {
      g.splice(gi, 1);
      return true;
    }
    return false;
  }

  setTerrain(x: number, y: number, kind: 'flame' | 'ice' | 'current', power: number, turns: number, faction: Faction) {
    if (!this.level.isFloor(x, y)) return;
    this.level.terrain.set(this.level.idx(x, y), { kind, power, turns, faction });
  }

  // ───────────────────────── 효과 엔진 ─────────────────────────

  /** 트리거 발동: 각인 소유자의 조건에 맞는 각인을 모두 실행 (턴당 같은 각인 3회 상한) */
  fire(owner: Actor, trig: Trigger, ctx: Ctx) {
    if (owner.dead || !owner.engravings.length) return;
    for (const eng of owner.engravings) {
      if (eng.trigger !== trig) continue;
      this.runEngraving(owner, eng, ctx, 1);
    }
  }

  private runEngraving(owner: Actor, eng: EngravingDef, ctx: Ctx, mult: number) {
    const n = owner.engravingFires.get(eng.id) ?? 0;
    if (n >= TRIGGER_CAP || this.depth > 16) return;
    // 맞힐 대상이 없으면 발동하지 않는다 (적이 없을 때 이동만 해도 로그가 쏟아지는 것 방지)
    const needsTarget = eng.effect.target !== 'self' && ctx.x === undefined;
    if (needsTarget && !this.resolveTargets(owner, eng.effect, ctx).length) return;
    if (owner.isPlayer && !this.visibleEnemies().length && eng.effect.target === 'self' && eng.trigger === 'move') {
      // 전투 밖 이동: 조용히 적용 (가속·부여·얼음 같은 자기 효과)
      this.applyEffect(owner, eng.effect, ctx, eng.name);
      return;
    }
    owner.engravingFires.set(eng.id, n + 1);
    this.stats.triggers++;
    this.depth++;
    this.stats.maxDepth = Math.max(this.stats.maxDepth, this.depth);
    this.emit({ type: 'trigger', actor: owner.id, text: eng.name, x: owner.x, y: owner.y });
    if (owner.isPlayer) this.log(`  ↳ 「${eng.name}」`, 'trigger');
    const spec = mult === 1 ? eng.effect : { ...eng.effect, power: Math.round(eng.effect.power * mult) };
    this.applyEffect(owner, spec, ctx, eng.name);
    this.depth--;
  }

  private resolveTargets(owner: Actor, spec: EffectSpec, ctx: Ctx): Actor[] {
    switch (spec.target) {
      case 'self':
        return [owner];
      case 'target':
        return ctx.target && !ctx.target.dead ? [ctx.target] : [];
      case 'around':
        return this.hostilesInRadius(owner, owner.x, owner.y, spec.radius ?? 1);
      case 'random': {
        const c = this.actors.filter((b) => !b.dead && this.hostile(owner, b) && Math.max(Math.abs(b.x - owner.x), Math.abs(b.y - owner.y)) <= 7 && hasLos(this.level, owner.x, owner.y, b.x, b.y));
        return c.length ? [this.rng.pick(c)] : [];
      }
      case 'nearest': {
        const n = this.nearestHostile(owner, 7);
        return n ? [n] : [];
      }
      case 'marked': {
        const m = this.actors.find((b) => !b.dead && b.marked && this.hostile(owner, b));
        if (m) return [m];
        const r = this.nearestHostile(owner, 7);
        return r ? [r] : [];
      }
    }
  }

  applyEffect(owner: Actor, spec: EffectSpec, ctx: Ctx, label: string) {
    const el = spec.inheritElement ? ctx.element : spec.element;
    const kinds = spec.perElementKind ? Math.max(1, this.st(owner).elementKinds) : 1;
    const power = spec.power;
    const targets = this.resolveTargets(owner, spec, ctx);
    const pos = (): [number, number] => {
      if (spec.target === 'self') return [owner.x, owner.y];
      if (targets[0]) return [targets[0].x, targets[0].y];
      if (ctx.x !== undefined && ctx.y !== undefined) return [ctx.x, ctx.y];
      return [owner.x, owner.y];
    };
    switch (spec.kind) {
      case 'strike':
        for (const t of targets) {
          this.emit({ type: 'fx', fx: 'line', x: owner.x, y: owner.y, tx: t.x, ty: t.y, element: el });
          this.dealDamage(owner, t, power, el, { label });
        }
        break;
      case 'blast': {
        const [x, y] = pos();
        this.emit({ type: 'fx', fx: 'blast', x, y, radius: spec.radius ?? 1, element: el });
        for (const t of this.hostilesInRadius(owner, x, y, spec.radius ?? 1)) this.dealDamage(owner, t, power, el, { label });
        break;
      }
      case 'shards': {
        const n = (spec.count ?? 3) * kinds;
        for (let i = 0; i < n; i++) {
          const pool = this.hostilesInRadius(owner, owner.x, owner.y, spec.radius ?? 4).filter((b) => hasLos(this.level, owner.x, owner.y, b.x, b.y));
          if (!pool.length) break;
          const t = this.rng.pick(pool);
          this.emit({ type: 'fx', fx: 'shards', x: owner.x, y: owner.y, tx: t.x, ty: t.y, element: el });
          this.dealDamage(owner, t, power, el, { label });
        }
        break;
      }
      case 'chain':
        for (const t of targets) this.chainFrom(owner, t, power, el, spec.count ?? 2, false, label);
        break;
      case 'push':
      case 'pull':
        for (const t of targets) if (t !== owner) this.knock(owner, t, spec.kind === 'push' ? power : -power);
        break;
      case 'status':
        for (const t of targets) this.addStatus(t, spec.status!, spec.duration ?? 2);
        break;
      case 'mark':
        for (const a of this.actors) a.marked = false;
        for (const t of targets) {
          t.marked = true;
          this.log(`${t.name}에게 표식을 새겼다.`);
        }
        break;
      case 'shield':
        owner.shield = Math.min(SHIELD_CAP, owner.shield + power);
        this.emit({ type: 'fx', fx: 'shield', x: owner.x, y: owner.y });
        break;
      case 'heal':
        this.heal(owner, power);
        this.emit({ type: 'fx', fx: 'heal', x: owner.x, y: owner.y });
        break;
      case 'repair': {
        this.repairArmor(owner, power);
        this.emit({ type: 'fx', fx: 'heal', x: owner.x, y: owner.y });
        this.emit({ type: 'loadout', actor: owner.id });
        break;
      }
      case 'blink': {
        let best: [number, number] | null = null;
        let bs = -1;
        for (let t = 0; t < 30; t++) {
          const nx = owner.x + this.rng.int(-3, 3),
            ny = owner.y + this.rng.int(-3, 3);
          if (!this.level.isFloor(nx, ny) || this.actorAt(nx, ny)) continue;
          const near = this.nearestHostile({ ...owner, x: nx, y: ny }, 20);
          const d = near ? Math.max(Math.abs(near.x - nx), Math.abs(near.y - ny)) : 20;
          if (d > bs) { bs = d; best = [nx, ny]; }
        }
        if (best) {
          this.emit({ type: 'fx', fx: 'blink', x: owner.x, y: owner.y });
          this.stepActor(owner, best[0], best[1]);
        }
        break;
      }
      case 'cdReduce':
        for (const r of this.equippedActives(owner)) r.cd = Math.max(0, r.cd - power * kinds);
        break;
      case 'haste':
        owner.haste = Math.min(70, Math.max(owner.haste, power));
        break;
      case 'imbue':
        owner.imbue = el;
        break;
      case 'terrain': {
        const [x, y] = pos();
        const r = spec.radius ?? 0;
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) this.setTerrain(x + dx, y + dy, spec.terrain!, power, spec.duration ?? 3, owner.faction);
        break;
      }
      case 'summon': {
        for (let i = 0; i < (spec.count ?? 1); i++) {
          const p = this.freeNear(owner.x, owner.y, 1);
          if (!p) break;
          const w = this.newActor('홀로그램 분신', owner.faction, 8 + power, power, { body: 0, arm: 0, leg: 0, sense: 0 });
          w.ai = 'wraith';
          w.awake = true;
          w.lifetime = spec.duration ?? 10;
          w.x = p[0];
          w.y = p[1];
          w.time = owner.time;
          this.actors.push(w);
          this.emit({ type: 'fx', fx: 'summon', x: p[0], y: p[1] });
          if (owner.isPlayer) this.log('슈트가 홀로그램 분신을 투사했다.', 'good');
        }
        break;
      }
    }
  }

  private chainFrom(src: Actor | null, first: Actor, power: number, el: Element | undefined, count: number, noTrigger: boolean, label = '연쇄') {
    const hit = new Set<Actor>([first]);
    let cur = first;
    for (let i = 0; i < count; i++) {
      let next: Actor | undefined;
      let bd = 1e9;
      for (const b of this.actors) {
        if (b.dead || hit.has(b) || b.faction !== first.faction) continue;
        const d = Math.max(Math.abs(b.x - cur.x), Math.abs(b.y - cur.y));
        if (d <= 3 && d < bd) { bd = d; next = b; }
      }
      if (!next) break;
      this.emit({ type: 'fx', fx: 'chain', x: cur.x, y: cur.y, tx: next.x, ty: next.y, element: el ?? 'lightning' });
      hit.add(next);
      this.dealDamage(src, next, power, el, { label, noTrigger });
      cur = next;
    }
  }

  private knock(src: Actor, t: Actor, n: number) {
    if (t.boss) n = Math.sign(n);
    const dx = Math.sign(t.x - src.x) * Math.sign(n),
      dy = Math.sign(t.y - src.y) * Math.sign(n);
    for (let i = 0; i < Math.abs(n); i++) {
      const nx = t.x + dx,
        ny = t.y + dy;
      if (!this.level.isFloor(nx, ny) || this.actorAt(nx, ny)) {
        // 충돌: 충격 피해 + 잔류 원소 발동
        const aura = t.aura?.element;
        this.dealDamage(src, t, 3 + this.zone * 2, 'impact', { label: '충돌' });
        if (aura && aura !== 'impact' && !t.dead) this.dealDamage(src, t, 4, aura, { label: `충돌·${ELEMENT_NAME[aura]}` });
        return;
      }
      this.stepActor(t, nx, ny);
    }
  }

  refreshFov() {
    const p = this.player;
    computeFov(this.level, p.x, p.y, this.st(p).sight);
  }

  /** 디버그/시뮬레이터용: 전체 상태 요약 */
  summary() {
    return {
      seed: this.seed,
      depth: this.depthLabel,
      zone: this.zone,
      floor: this.floor,
      level: this.plevel,
      mode: this.mode,
      engravings: this.player.engravings.map((e) => e.name),
      ...this.stats,
    };
  }
}
