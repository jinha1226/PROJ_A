// ───────── 어휘 (액티브·적 공용) ─────────

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

export type StatusKind = 'burn' | 'slow' | 'stun' | 'blind' | 'freeze' | 'bleed' | 'poison' | 'oil';
export const STATUS_NAME: Record<StatusKind, string> = { burn: '화상', slow: '둔화', stun: '기절', blind: '실명', freeze: '빙결', bleed: '출혈', poison: '중독', oil: '기름' };

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

/** 성장의 세 갈래 (데드셀의 세 가지 색) */
export type Color = 'power' | 'tactics' | 'survival';
export const COLOR_NAME: Record<Color, string> = { power: '화력', tactics: '기술', survival: '생존' };

/** 무기 고유 효과: 무기 종류마다 고정. 대부분 "언제 치명타가 나는가"를 정한다 (데드셀) */
export type WeaponTrait =
  | 'ambush' | 'combo3' | 'balanced' | 'grudge' | 'desperate' | 'execute' | 'pierce' | 'harpoon' | 'fourth' | 'nutcracker'
  | 'cleave' | 'sadist' | 'torch' | 'block' | 'smash' | 'giant' | 'flawless' | 'pyreBlade'
  | 'lastShot' | 'scatter' | 'steady' | 'marksman' | 'pointBlank' | 'repeater' | 'knives' | 'pyro' | 'frost' | 'storm';

/** 무기 옵션 (데드셀 인챈트 각색): 상태를 만들거나, 상태에 따라 피해를 키운다. 치명타는 만들지 않는다 */
export type OptionId =
  | 'fire' | 'cold' | 'lightning' | 'impact' | 'bleed' | 'poison' | 'oil' | 'leech'
  | 'corpseBlast' | 'deathFreeze' | 'deathFlame'
  | 'burnDmg' | 'bleedDmg' | 'poisonDmg' | 'freezeDmg' | 'stunDmg' | 'fullHp' | 'despair' | 'ambush' | 'aim' | 'riposte' | 'critDmg'
  | 'pierceShot' | 'extraAmmo' | 'counter' | 'fireShield' | 'iceShield' | 'frenzy';

export interface WeaponDef {
  id: string;
  name: string;
  family: WeaponFamily;
  grade: Grade;
  /** 고유 무기 (보스·정예 드롭) */
  unique?: boolean;
  /** 색 1~2개: 레벨업으로 올린 그 색의 레벨만큼 강해진다 (7단계) */
  colors: Color[];
  trait?: WeaponTrait;
  /** 원소 지팡이: 공격 원소 */
  element?: Element;
  damage: number;
  attackCost: number;
  /** 사거리 (근접 1) */
  range: number;
  /** 총기: 탄창 크기. 원소 지팡이: 충전 수 */
  mag?: number;
  /** 원소 지팡이: 이 턴 수마다 1회 충전 (재장전 없음) */
  recharge?: number;
}

export interface WeaponInst {
  kind: 'weapon';
  uid: number;
  def: WeaponDef;
  /** 총기: 남은 탄. 원소 지팡이: 남은 충전 */
  ammo: number;
  /** 옵션 0~2개 (일반 0~1, 정예 1~2, 금지 2) */
  options: OptionId[];
  /** 부산물 부여 칸 (1칸, 덮어씀) */
  infusion?: { from: string; options: OptionId[] };
  /** 충전식: 다음 충전까지 지난 턴 */
  charging?: number;
  /** 이 무기로 한 공격 수 (철퇴: 4번째마다 치명타) */
  hits?: number;
}

/** 슈트 주사제 */
export type InjectionId = 'haste' | 'ignite' | 'harden' | 'focus';
export interface ConsumableInst {
  kind: 'consumable';
  uid: number;
  def: { id: InjectionId; name: string; desc: string; rooms: number; color: string };
}

/** 바닥에 놓인 것: 부산물, 무기, 주사제 */
export type GroundItem = ByproductInst | WeaponInst | ConsumableInst;

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
  /** 부위별 슈트 장갑 (현재값). 0이 되면 그 부위가 파손되어 부산물 효과가 절반 */
  partArmor: Record<Slot, number>;
  /** 슈트의 부위별 기본 장갑 */
  partArmorBase: Record<Slot, number>;
  time: number; // 다음 행동 시각
  shield: number;
  statuses: Partial<Record<StatusKind, number>>;
  aura?: { element: Element; turns: number };
  imbue?: Element;
  haste: number; // 다음 행동 비용 감소 %
  marked: boolean;
  dead: boolean;
  /** 슈트 부여 (플레이어): 부위별 횟수·장갑 증가·원소 저항 */
  suitMods?: Record<Slot, { n: number; armor: number; resist: Element[] }>;
  /** 벨트 (플레이어): 주사제 3칸 */
  belt?: (ConsumableInst | null)[];
  /** 맞고 있는 주사제: 남은 방 수 */
  injections?: Partial<Record<InjectionId, number>>;
  /** 마지막으로 들어선 방 (주사제 지속 계산) */
  lastRoom?: number;
  /** 색 레벨 (플레이어): 레벨업마다 하나를 +1. 무기는 자기 색 레벨만큼 강해진다 */
  colors?: Record<Color, number>;
  /** 직전에 끝낸 행동 (조건 효과 '기습'·'정조준'용) */
  prevAct?: 'move' | 'wait' | 'attack' | 'other';
  /** 내 직전 행동 뒤로 적에게 맞았다 (조건 효과 '반격'용) */
  wasHit?: boolean;
  /** 방패로 막았다: 다음 공격 치명타 */
  blockReady?: boolean;
  /** 카운터 방패로 막았다: 다음 공격 피해 +200% */
  counterReady?: boolean;
  /** 같은 대상 연속 공격 (장검·균형 잡힌 검) */
  combo?: { target: number; weapon: number; n: number };
  /** 마지막으로 피해를 받은 플레이어 행동 번호 (완전무결) */
  hurtAt?: number;
  /** 이번 플레이어 행동에 걸린 상태: 이번 턴 끝에는 줄지 않는다 */
  freshStatus?: Set<StatusKind>;
  // AI
  ai?: 'melee' | 'ranged' | 'skirmisher' | 'boss' | 'wraith' | 'dummy';
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
    | 'parry'
    | 'heal'
    | 'death'
    | 'fx'
    | 'log'
    | 'trigger'
    | 'floor'
    | 'loadout'
    | 'levelup'
    | 'alert'
    | 'shoot'
    | 'reload';
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
  /** 치명타 */
  crit?: boolean;
  /** 이벤트가 일어난 게임 시각 (턴 단위, 행동 비용 100 = 1) */
  t?: number;
}
