import type { Rng } from './rng';
import type { Faction, TerrainKind } from './types';

export const enum Tile {
  Wall = 0,
  Floor = 1,
}

export interface Room {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  visited: boolean;
}

export interface Feature {
  kind: 'exit' | 'altar';
  x: number;
  y: number;
  godId?: string;
  used?: boolean;
}

export interface TerrainCell {
  kind: TerrainKind;
  turns: number;
  power: number;
  faction: Faction;
}

export class Level {
  tiles: Uint8Array;
  roomOf: Int16Array;
  explored: Uint8Array;
  visible: Uint8Array;
  rooms: Room[] = [];
  features: Feature[] = [];
  terrain = new Map<number, TerrainCell>();
  /** 기름통이 놓인 칸 */
  barrels = new Set<number>();
  startX = 0;
  startY = 0;
  constructor(public w: number, public h: number) {
    this.tiles = new Uint8Array(w * h);
    this.roomOf = new Int16Array(w * h).fill(-1);
    this.explored = new Uint8Array(w * h);
    this.visible = new Uint8Array(w * h);
  }
  idx(x: number, y: number) {
    return y * this.w + x;
  }
  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  isFloor(x: number, y: number) {
    return this.inBounds(x, y) && this.tiles[this.idx(x, y)] === Tile.Floor;
  }
  featureAt(x: number, y: number) {
    return this.features.find((f) => f.x === x && f.y === y);
  }
  get exit() {
    return this.features.find((f) => f.kind === 'exit')!;
  }
}

function carveRoom(lv: Level, r: Room) {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      lv.tiles[lv.idx(x, y)] = Tile.Floor;
      lv.roomOf[lv.idx(x, y)] = r.id;
    }
}

function carveCorridor(lv: Level, rng: Rng, ax: number, ay: number, bx: number, by: number) {
  const horizFirst = rng.chance(0.5);
  const carve = (x: number, y: number) => {
    if (lv.tiles[lv.idx(x, y)] === Tile.Wall) lv.tiles[lv.idx(x, y)] = Tile.Floor;
  };
  let x = ax,
    y = ay;
  if (horizFirst) {
    while (x !== bx) { carve(x, y); x += Math.sign(bx - x); }
    while (y !== by) { carve(x, y); y += Math.sign(by - y); }
  } else {
    while (y !== by) { carve(x, y); y += Math.sign(by - y); }
    while (x !== bx) { carve(x, y); x += Math.sign(bx - x); }
  }
  carve(bx, by);
}

const center = (r: Room) => ({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) });

/** 일반 층: 작은 방 8~12개 */
export function generateLevel(rng: Rng, opts: { altarGod?: string }): Level {
  const W = 40,
    H = 30;
  for (let attempt = 0; attempt < 50; attempt++) {
    const lv = new Level(W, H);
    const target = rng.int(8, 12);
    for (let tries = 0; tries < 400 && lv.rooms.length < target; tries++) {
      const w = rng.int(4, 8),
        h = rng.int(4, 7);
      const x = rng.int(1, W - w - 2),
        y = rng.int(1, H - h - 2);
      const overlaps = lv.rooms.some((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y);
      if (overlaps) continue;
      const room: Room = { id: lv.rooms.length, x, y, w, h, visited: false };
      lv.rooms.push(room);
    }
    if (lv.rooms.length < 8) continue;
    // 정렬 후 순서대로 연결 + 고리 몇 개
    lv.rooms.sort((a, b) => center(a).x + center(a).y * 0.3 - (center(b).x + center(b).y * 0.3));
    lv.rooms.forEach((r, i) => (r.id = i));
    for (const r of lv.rooms) carveRoom(lv, r);
    for (let i = 1; i < lv.rooms.length; i++) {
      const a = center(lv.rooms[i - 1]),
        b = center(lv.rooms[i]);
      carveCorridor(lv, rng, a.x, a.y, b.x, b.y);
    }
    for (let k = 0; k < 2; k++) {
      const a = rng.pick(lv.rooms),
        b = rng.pick(lv.rooms);
      if (a !== b) carveCorridor(lv, rng, center(a).x, center(a).y, center(b).x, center(b).y);
    }
    // 시작 방 / 출구(보급 지점으로 이어짐)
    const start = lv.rooms[0];
    const c0 = center(start);
    lv.startX = c0.x;
    lv.startY = c0.y;
    const dist = bfs(lv, c0.x, c0.y);
    let far = lv.rooms[lv.rooms.length - 1],
      farD = -1;
    for (const r of lv.rooms) {
      const c = center(r);
      const d = dist[lv.idx(c.x, c.y)];
      if (d > farD) { farD = d; far = r; }
    }
    const ce = center(far);
    lv.features.push({ kind: 'exit', x: ce.x, y: ce.y });
    if (opts.altarGod) {
      const mid = lv.rooms.filter((r) => r !== start && r !== far);
      const ar = rng.pick(mid);
      lv.features.push({ kind: 'altar', x: ar.x + 1, y: ar.y + 1, godId: opts.altarGod });
    }
    return lv;
  }
  throw new Error('level generation failed');
}

/** 무기 실험실: 방 하나. 왼쪽에 플레이어, 오른쪽에 허수아비들 */
export function generateLabLevel(): Level {
  const lv = new Level(24, 15);
  const room: Room = { id: 0, x: 2, y: 2, w: 19, h: 11, visited: true };
  lv.rooms.push(room);
  carveRoom(lv, room);
  for (let i = 0; i < lv.explored.length; i++) lv.explored[i] = 1;
  lv.startX = 7;
  lv.startY = 7;
  // 출구는 쓰지 않지만 렌더러가 계단 위치를 필요로 한다
  lv.features.push({ kind: 'exit', x: 3, y: 3 });
  return lv;
}

/** 실험실 허수아비 자리: 붙어 있는 무리(연쇄·범위용) + 떨어진 둘 */
export const LAB_DUMMIES: [number, number][] = [[11, 6], [12, 6], [11, 7], [12, 7], [11, 8], [15, 4], [15, 10]];

/** 보스층: 대기실 → 투기장 */
export function generateBossLevel(): Level {
  const lv = new Level(36, 26);
  const entry: Room = { id: 0, x: 3, y: 10, w: 5, h: 5, visited: false };
  const arena: Room = { id: 1, x: 12, y: 4, w: 19, h: 17, visited: false };
  lv.rooms.push(entry, arena);
  carveRoom(lv, entry);
  carveRoom(lv, arena);
  for (let x = 8; x < 12; x++) lv.tiles[lv.idx(x, 12)] = Tile.Floor;
  // 투기장 기둥
  for (const [px, py] of [[16, 8], [26, 8], [16, 16], [26, 16]]) {
    lv.tiles[lv.idx(px, py)] = Tile.Wall;
    lv.roomOf[lv.idx(px, py)] = -1;
  }
  lv.startX = 5;
  lv.startY = 12;
  lv.features.push({ kind: 'exit', x: 29, y: 12 });
  return lv;
}

export function bfs(lv: Level, sx: number, sy: number, passable?: (x: number, y: number) => boolean): Int32Array {
  const dist = new Int32Array(lv.w * lv.h).fill(-1);
  const q: number[] = [lv.idx(sx, sy)];
  dist[q[0]] = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi];
    const x = i % lv.w,
      y = (i / lv.w) | 0;
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx,
        ny = y + dy;
      if (!lv.isFloor(nx, ny)) continue;
      if (dx && dy && (!lv.isFloor(x + dx, y) || !lv.isFloor(x, y + dy))) continue; // 모서리 끼기 금지
      const ni = lv.idx(nx, ny);
      if (dist[ni] >= 0) continue;
      if (passable && !passable(nx, ny)) continue;
      dist[ni] = dist[i] + 1;
      q.push(ni);
    }
  }
  return dist;
}

export const DIRS8: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** 시야: 반경 내 브레젠험 시선 */
export function computeFov(lv: Level, ox: number, oy: number, radius: number) {
  lv.visible.fill(0);
  const r2 = radius * radius;
  for (let y = oy - radius; y <= oy + radius; y++)
    for (let x = ox - radius; x <= ox + radius; x++) {
      if (!lv.inBounds(x, y)) continue;
      const dx = x - ox,
        dy = y - oy;
      if (dx * dx + dy * dy > r2) continue;
      if (hasLos(lv, ox, oy, x, y)) {
        const i = lv.idx(x, y);
        lv.visible[i] = 1;
        lv.explored[i] = 1;
      }
    }
}

export function hasLos(lv: Level, x0: number, y0: number, x1: number, y1: number): boolean {
  let dx = Math.abs(x1 - x0),
    dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0,
    y = y0;
  while (true) {
    if (x === x1 && y === y1) return true;
    if (!(x === x0 && y === y0) && !lv.isFloor(x, y)) return false;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/** 직선 경로 (투척·관통용) */
export function linePoints(x0: number, y0: number, x1: number, y1: number, maxLen: number): [number, number][] {
  const pts: [number, number][] = [];
  const dx = Math.abs(x1 - x0),
    dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  let err = dx + dy,
    x = x0,
    y = y0;
  // 목표 너머로 연장
  for (let i = 0; i < 64 && pts.length < maxLen; i++) {
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    pts.push([x, y]);
    if (dx === 0 && dy === 0) break;
  }
  return pts;
}
