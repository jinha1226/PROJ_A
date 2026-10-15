// ───────── 어휘 (각인·액티브·적 유물 공용) ─────────

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
export const GRADE_NAME: Record<Grade, string> = { common: '평범', holy: '성스러운', forbidden: '금지된' };

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

export type TargetKind = 'self' | 'target' | 'around' | 'random' | 'marked';

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
  /** 금지된 유물의 고유 액티브 */
  unique?: string;
}

export interface RelicStats {
  integrity?: number; // 몸: 장갑 내구
  damage?: number; // 팔: 기본 공격 피해
  attackCost?: number; // 팔
  moveBonus?: number; // 다리: 이동 비용 감소
  dodge?: number; // 다리·감각
  hp?: number; // 최대 체력 보너스
  sight?: number; // 감각
  burden: number;
}

export interface RelicDef {
  id: string;
  name: string;
  slot: Slot;
  grade: Grade;
  elements: Element[];
  stats: RelicStats;
  active?: ActiveSpec;
  curse?: { text: string; kind: 'hpDrain' | 'burnSelf' | 'heavy' | 'fragile' };
  /** 적 전용 (드롭 풀에서 제외) */
  enemyOnly?: boolean;
}

export interface RelicInst {
  uid: number;
  def: RelicDef;
  damaged: boolean;
  dormant: boolean;
  fixed: boolean;
  integrity: number; // 현재 장갑 내구 (몸)
  cd: number; // 남은 쿨다운
  upgrade: number; // 녹의 신 강화 단계
}

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
  slots: Record<Slot, (RelicInst | null)[]>;
  fixedSlot?: { slot: Slot; index: number };
  burdenCap: number;
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
  fx?: 'blast' | 'chain' | 'shards' | 'shield' | 'heal' | 'blink' | 'combo' | 'offer' | 'line' | 'summon';
  radius?: number;
  cls?: string;
}
