// ───────── 어휘 (각인·액티브·적 공용) ─────────

export type Element = 'fire' | 'cold' | 'lightning' | 'impact';
export const ELEMENTS: Element[] = ['fire', 'cold', 'lightning', 'impact'];
export const ELEMENT_NAME: Record<Element, string> = {
  fire: '화염',
  cold: '냉기',
  lightning: '번개',
  impact: '충격',
};

export type Slot = 'body' | 'arm' | 'leg' | 'sense';
export const SLOTS: Slot[] = ['body', 'arm', 'leg', 'sense'];
export const SLOT_NAME: Record<Slot, string> = { body: '몸', arm: '팔', leg: '다리', sense: '감각' };

export type Grade = 'common' | 'holy' | 'forbidden';
export const GRADE_NAME: Record<Grade, string> = { common: '일반', holy: '정예', forbidden: '금지' };

/** 발동 조건 = 플레이어 행동 4가지 */
export type Trigger = 'attack' | 'move' | 'hit' | 'wait';
export const TRIGGERS: Trigger[] = ['attack', 'move', 'hit', 'wait'];

export const TRIGGER_NAME: Record<Trigger, string> = {
  attack: '공격할 때',
  move: '이동할 때',
  hit: '피격될 때',
  wait: '대기할 때',
};
export const TRIGGER_SHORT: Record<Trigger, string> = { attack: '공격', move: '이동', hit: '피격', wait: '대기' };

/** 효과 어휘 */
export type EffectKind =
  | 'strike' // 원소 일격
  | 'blast' // 원소 폭발(범위)
  | 'shards' // 파편 난사
  | 'chain' // 연쇄
  | 'push' // 밀쳐내기
  | 'pull' // 끌어당기기
  | 'status' // 상태이상
  | 'mark' // 표식
  | 'shield' // 보호막
  | 'heal' // 회복
  | 'repair' // 수리
  | 'blink' // 도약
  | 'cdReduce' // 쿨다운 감소
  | 'haste' // 가속
  | 'imbue' // 다음 공격에 원소 부여
  | 'terrain' // 지형 생성
  | 'summon'; // 소환

export type TargetKind = 'self' | 'target' | 'around' | 'random' | 'marked' | 'nearest';

export type StatusKind = 'burn' | 'slow' | 'stun' | 'blind';
export const STATUS_NAME: Record<StatusKind, string> = { burn: '화상', slow: '둔화', stun: '기절', blind: '실명' };

export type TerrainKind = 'flame' | 'ice' | 'current';

export interface EffectSpec {
  kind: EffectKind;
  target: TargetKind;
  /** 피해량/보호막량/회복량/쿨다운 감소량/가속% 등 */
  power: number;
  element?: Element;
  /** 'sourceElement' 면 발동시킨 원소를 그대로 씀 */
  inheritElement?: boolean;
  radius?: number;
  count?: number;
  duration?: number;
  status?: StatusKind;
  terrain?: TerrainKind;
  /** 잡식: 보유 원소 종류 수만큼 count/power 배수 */
  perElementKind?: boolean;
}

export interface EngravingDef {
  id: string;
  name: string;
  trigger: Trigger;
  effect: EffectSpec;
  /** 레벨업 풀에 나오지 않음 (기원 전용 등) */
  unique?: boolean;
}

// ───────── 액티브: 형태 × 원소 × 수치 ─────────
export type FormId = 'sweep' | 'dash' | 'throw' | 'bolt' | 'nova';

export interface ActiveSpec {
  form: FormId;
  element?: Element;
  power: number;
  cooldown: number;
  range?: number;
  /** 금지 부산물의 고유 액티브 */
  unique?: string;
}

export interface ByproductStats {
  integrity?: number; // 몸: 장갑 내구
  damage?: number; // 팔: 기본 공격 피해
  attackCost?: number; // 팔
  moveBonus?: number; // 다리: 이동 비용 감소
  dodge?: number; // 다리·감각
  hp?: number; // 최대 체력 보너스
  sight?: number; // 감각
  burden: number;
}

export interface ByproductDef {
  id: string;
  name: string;
  slot: Slot;
  grade: Grade;
  elements: Element[];
  stats: ByproductStats;
  active?: ActiveSpec;
  curse?: { text: string; kind: 'hpDrain' | 'burnSelf' | 'heavy' | 'fragile' };
  /** 적 전용 (드롭 풀에서 제외) */
  enemyOnly?: boolean;
}

export interface ByproductInst {
  kind: 'byproduct';
  uid: number;
  def: ByproductDef;
  dormant: boolean;
  fixed: boolean;
  cd: number; // 남은 쿨다운
  upgrade: number; // 녹의 신 강화 단계
}

// ───────── 무기: 손에 든다. 기본 공격의 방식·피해·속도를 정한다 ─────────
export type WeaponFamily = 'melee' | 'gun' | 'bow' | 'magic';
export const FAMILY_NAME: Record<WeaponFamily, string> = { melee: '근접', gun: '총기', bow: '활', magic: '마법' };

export interface WeaponDef {
  id: string;
  name: string;
  family: WeaponFamily;
  grade: Grade;
  damage: number;
  attackCost: number;
  /** 사거리 (근접 1) */
  range: number;
  /** 총기: 탄창 크기 */
  mag?: number;
  burden: number;
}

export interface WeaponInst {
  kind: 'weapon';
  uid: number;
  def: WeaponDef;
  /** 총기: 남은 탄 */
  ammo: number;
}

/** 바닥에 놓인 것: 부산물 또는 무기 */
export type GroundItem = ByproductInst | WeaponInst;

export type Faction = 'player' | 'enemy';

export interface Actor {
  id: number;
  name: string;
  faction: Faction;
  isPlayer: boolean;
  x: number;
  y: number;
  hp: number;
  baseHp: number;
  baseDamage: number;
  slots: Record<Slot, (ByproductInst | null)[]>;
  /** 손 2칸 (들고 있는 것 + 예비). 적은 비어 있을 수 있다 */
  hands: (WeaponInst | null)[];
  activeHand: number;
  fixedSlot?: { slot: Slot; index: number };
  burdenCap: number;
  /** 부위별 슈트 장갑 (현재값). 0이 되면 그 부위가 파손되어 부산물 효과가 절반 */
  partArmor: Record<Slot, number>;
  /** 프레임이 정한 부위별 기본 장갑 */
  partArmorBase: Record<Slot, number>;
  engravings: EngravingDef[];
  /** 턴당 각인 발동 횟수 (연쇄 상한 3) */
  engravingFires: Map<string, number>;
  time: number; // 다음 행동 시각
  shield: number;
  statuses: Partial<Record<StatusKind, number>>;
  aura?: { element: Element; turns: number };
  imbue?: Element;
  haste: number; // 다음 행동 비용 감소 %
  marked: boolean;
  dead: boolean;
  // AI
  ai?: 'melee' | 'ranged' | 'skirmisher' | 'boss' | 'wraith';
  awake: boolean;
  lifetime?: number; // 소환물
  boss?: boolean;
  elite?: boolean;
  summoned?: boolean;
  templateId?: string;
  dropChance: number;
}

export interface GameEvent {
  type:
    | 'move'
    | 'attack'
    | 'damage'
    | 'dodge'
    | 'death'
    | 'fx'
    | 'log'
    | 'trigger'
    | 'floor'
    | 'loadout'
    | 'levelup'
    | 'alert';
  actor?: number;
  target?: number;
  x?: number;
  y?: number;
  tx?: number;
  ty?: number;
  amount?: number;
  element?: Element;
  text?: string;
  fx?: 'blast' | 'chain' | 'shards' | 'shield' | 'heal' | 'blink' | 'combo' | 'overload' | 'line' | 'summon';
  radius?: number;
  cls?: string;
}
