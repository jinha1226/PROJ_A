// PROJ_R 격자 렌더러가 PROJ_R 게임 로직에서 가져다 쓰던 타입과 함수의 호환 모듈.
// 렌더러 코드는 그대로 두고, 이 파일만 우리 게임에 맞춘다. 실제 상태는 ../bridge.ts 가 채운다.

export interface Cell { x: number; y: number }
export type Tile = 'floor' | 'wall' | 'door' | 'open' | 'pillar' | 'seal' | 'chasm' | 'cover';
export type FoeKind = 'minion' | 'brute' | 'ghoul' | 'archer' | 'mage' | 'champion';
export interface Room { x: number; y: number; w: number; h: number }
export type StationId = 'pod' | 'armory' | 'suitlab' | 'records' | 'nav' | 'core' | 'hatch';
export const STATIONS: Record<StationId, string> = { pod: '복제 포드', armory: '무기고', suitlab: '슈트 공방', records: '기록 보관소', nav: '항법 콘솔', core: '에너지 코어', hatch: '출격 해치' };

export interface GridMap {
  hidden?: Cell[];
  stations?: { pos: Cell; id: StationId }[];
  w: number;
  h: number;
  tiles: Tile[];
  rooms: Room[];
  start: Cell;
  exits: Cell[];
  chests: Cell[];
  spawns: { kind: FoeKind; pos: Cell; group: number; elite?: boolean }[];
  barrels?: Cell[];
  stairs?: Cell;
  traps?: Trap[];
}
export type TrapKind = 'spike' | 'alarm' | 'poison' | 'fire' | 'teleport' | 'net';
export interface Trap { pos: Cell; kind: TrapKind; found: boolean }
export type BuffKind = 'haste' | 'invis' | 'confuse' | 'root' | 'fear';

export const idx = (m: { w: number }, c: Cell): number => c.y * m.w + c.x;
export const inBounds = (m: GridMap, c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.x < m.w && c.y < m.h;
export const tileAt = (m: GridMap, c: Cell): Tile => (inBounds(m, c) ? m.tiles[idx(m, c)]! : 'wall');
export const walkable = (t: Tile): boolean => t === 'floor' || t === 'open' || t === 'door';
export const same = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;
export const dist = (a: Cell, b: Cell): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export interface Statuses { burn: number; freeze: number; poison: number }
export interface Ent {
  elite?: boolean;
  id: string;
  kind: 'hero' | FoeKind;
  pos: Cell;
  hp: number;
  maxHp: number;
  nextAt: number;
  alive: boolean;
  awake: boolean;
  group: number;
  stun?: number;
  status?: Statuses;
  summoned?: boolean;
  marked?: boolean;
  buffs?: Partial<Record<BuffKind, number>>;
  /** (MODEL 0) 머리 위 상태 배지 */
  badges?: { g: string; c: string; n?: number }[];
}

// 무기: PROJ_R의 무기 그룹 + 권총
export type WeaponGroup = 'dagger' | 'sword' | 'axe' | 'spear' | 'mace' | 'bow' | 'staff' | 'pistol' | 'shield';
/** 렌더러는 이 표의 키로 "무기 이름이 들어간 이벤트"를 알아본다 */
export const WEAPONS: Record<WeaponGroup, true> = { dagger: true, sword: true, axe: true, spear: true, mace: true, bow: true, staff: true, pistol: true, shield: true };
export interface Weapon { group: WeaponGroup }
export interface Gear { hands: [Weapon | null, Weapon | null]; active: 0 | 1 }
export const activeWeapon = (g: Gear): Weapon | null => g.hands[g.active] ?? null;

export interface Hero extends Ent {
  kind: 'hero';
  /** 각인 이름들 (슈트 발광 개수로만 쓰임) */
  suit: string[];
  gear: Gear;
  exitTime: number;
  shield?: number;
}
export interface TileFx { src?: string; pos: Cell; kind: 'fire' | 'poison' | 'steam'; until: number }
export interface Telegraph { cells: Cell[]; center: Cell; src: string; kind: 'spell' | 'whirl'; el?: 'fire' | 'frost'; dmg: [number, number]; at: number }
export interface ChestState { pos: Cell; opened: boolean }
/** 바닥 아이템: 렌더러는 kind로 모양을 고른다. 부산물은 떠 있는 수정(stone), 무기는 무기 모양 */
export type FloorItemData =
  | { kind: 'weapon'; group: WeaponGroup }
  | { kind: 'stone'; id: string }
  | { kind: 'core' }
  | { kind: 'suit' }
  | { kind: 'material'; mat: string }
  | { kind: 'potion'; p: string }
  | { kind: 'scroll' };
export interface FloorItem { pos: Cell; item: FloorItemData }
export interface RunState { floor: number }

export interface GridState {
  mode?: 'ship';
  time: number;
  map: GridMap;
  hero: Hero;
  foes: Ent[];
  chests: ChestState[];
  seen: Uint8Array;
  visible: Set<number>;
  closedExits: number[];
  floorItems: FloorItem[];
  run: RunState;
  tiles: TileFx[];
  barrels: Cell[];
  telegraphs: Telegraph[];
  traps: Trap[];
  /** 물약 색 (우리 게임엔 아직 없음) */
  lore: { colors: Record<string, string> };
}

export type GEventType =
  | 'chain' | 'move' | 'bump' | 'shoot' | 'hit' | 'miss' | 'die' | 'door' | 'open' | 'loot' | 'reload' | 'heal' | 'wait' | 'wake' | 'blocked'
  | 'alarm' | 'reinforce' | 'exitClosed' | 'extracting' | 'extracted' | 'dead'
  | 'shield' | 'swap' | 'equip' | 'wear' | 'drop' | 'pickup' | 'full' | 'stun' | 'push' | 'use' | 'explode' | 'frozen' | 'status'
  | 'station' | 'suit' | 'energy' | 'upgrade' | 'absorb' | 'record' | 'stairs' | 'core' | 'telegraph' | 'summon' | 'floor' | 'victory' | 'levelUp'
  | 'react' | 'dodge' | 'parry' | 'engrave' | 'combo' | 'trap' | 'disarm' | 'trapFound' | 'root' | 'buff' | 'teleport' | 'search' | 'drink' | 'read'
  | 'identify' | 'stumble' | 'suitHere' | 'stone' | 'stoneBreak' | 'portal'
  /** (MODEL 0) 기록 한 줄: 연출 순서대로 기록에 찍힌다 */
  | 'log';
/** t: 행동을 시작한 게임 시각 (렌더러는 이 순서로 재생한다) */
export interface GEvent {
  /** (MODEL 0) 이 각인 연출과 함께 기록(M)에 찍을 줄 */
  line?: { text: string; cls: string };
  group?: WeaponGroup; t: number; type: GEventType; src?: string; dst?: string; from?: Cell; to?: Cell; amount?: number; crit?: boolean; text?: string }

/** 렌더러가 읽는 것은 sim.s 뿐 */
export interface GridSim { s: GridState }
export type MetaState = { repairs: string[]; best: number };

// 구역: 렌더러의 조명·종족 표현을 고르는 데 쓴다
export type ZoneId = 'cave' | 'crypt' | 'ruins';
export interface Zone { id: ZoneId; name: string; first: number; last: number }
export const ZONES: Zone[] = [
  { id: 'cave', name: '버섯 동굴', first: 1, last: 4 },
  { id: 'crypt', name: '불타는 지하 묘지', first: 5, last: 8 },
  { id: 'ruins', name: '고대 유적', first: 9, last: 99 },
];
export function zoneOf(floor: number): Zone {
  return ZONES.find((z) => floor <= z.last) ?? ZONES[2]!;
}

// 우리 게임에 없는 PROJ_R 시스템은 "없음"으로 답한다
export const buffOn = (e: Ent, k: BuffKind, now: number): boolean => (e.buffs?.[k] ?? 0) > now + 1e-9;
export const sensedFoes = (_s: GridState): string[] => [];
export const archerCanShoot = (_s: GridState, _f: Ent): boolean => false;
export type EngraveId = string;
export const ENGRAVES: Record<string, { name: string }> = {};
