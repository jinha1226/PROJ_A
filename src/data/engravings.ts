import type { EngravingDef } from '../core/types';

// 각인 = 조건 + 원소 필터(선택) + 효과 + 대상 + 수치.
export const ENGRAVINGS: EngravingDef[] = [
  // ── 기원 고유 ──
  { id: 'furnace_vow', name: '용광로의 서약', kind: 'single', unique: true, trigger: 'offer', effect: { kind: 'shards', target: 'around', element: 'fire', power: 6, count: 4, radius: 4 } },
  { id: 'gravekeeper_rite', name: '묘지기의 의식', kind: 'single', unique: true, trigger: 'hit', effect: { kind: 'status', target: 'target', status: 'slow', duration: 3, power: 0, element: 'cold' } },
  { id: 'bellringer_toll', name: '종지기의 타종', kind: 'single', unique: true, trigger: 'useActive', effect: { kind: 'chain', target: 'random', element: 'lightning', power: 5, count: 3 } },

  // ── 단일 원소 ──
  { id: 'ember_hand', name: '잿불의 손', kind: 'single', trigger: 'dealElement', element: 'fire', effect: { kind: 'terrain', target: 'target', terrain: 'flame', power: 3, duration: 4, radius: 0 } },
  { id: 'pilgrim_step', name: '순례자의 걸음', kind: 'single', trigger: 'move3', effect: { kind: 'strike', target: 'random', element: 'lightning', power: 4 } },
  { id: 'frozen_psalm', name: '얼어붙은 시편', kind: 'single', trigger: 'dealElement', element: 'cold', effect: { kind: 'shield', target: 'self', power: 3 } },
  { id: 'arc_litany', name: '번개 연도', kind: 'single', trigger: 'dealElement', element: 'lightning', effect: { kind: 'chain', target: 'target', element: 'lightning', power: 3, count: 2 } },
  { id: 'iron_gospel', name: '쇠의 복음', kind: 'single', trigger: 'dealElement', element: 'impact', effect: { kind: 'status', target: 'target', status: 'stun', duration: 1, power: 0 } },
  { id: 'pyre_heart', name: '장작더미 심장', kind: 'single', trigger: 'kill', effect: { kind: 'blast', target: 'target', element: 'fire', power: 6, radius: 1 } },

  // ── 복합 (대상에 남은 다른 원소의 잔류와 섞일 때) ──
  { id: 'steam_rite', name: '증기의 의례', kind: 'combo', trigger: 'dealElement', element: 'fire', comboWith: 'cold', effect: { kind: 'blast', target: 'target', element: 'fire', power: 9, radius: 2 } },
  { id: 'plasma_canticle', name: '플라즈마 송가', kind: 'combo', trigger: 'dealElement', element: 'lightning', comboWith: 'fire', effect: { kind: 'strike', target: 'target', element: 'lightning', power: 10 } },
  { id: 'superconduct', name: '초전도 성가', kind: 'combo', trigger: 'dealElement', element: 'cold', comboWith: 'lightning', effect: { kind: 'chain', target: 'target', element: 'cold', power: 5, count: 4 } },

  // ── 잡식 ──
  { id: 'scavenger_creed', name: '넝마주이의 신조', kind: 'omni', trigger: 'graft', effect: { kind: 'shards', target: 'around', inheritElement: true, power: 4, count: 1, radius: 5, perElementKind: true } },
  { id: 'motley_saint', name: '얼룩덜룩한 성자', kind: 'omni', trigger: 'kill', effect: { kind: 'cdReduce', target: 'self', power: 1, perElementKind: true } },

  // ── 일반 ──
  { id: 'stitched_heart', name: '꿰맨 심장', kind: 'plain', trigger: 'relicDamaged', effect: { kind: 'shield', target: 'self', power: 10 } },
  { id: 'martyr_vigil', name: '순교자의 철야', kind: 'plain', trigger: 'wait', effect: { kind: 'repair', target: 'self', power: 3 } },
  { id: 'last_rites', name: '종부성사', kind: 'plain', trigger: 'lowHp', effect: { kind: 'summon', target: 'self', power: 6, duration: 12, count: 1 } },
  { id: 'phantom_step', name: '환영 걸음', kind: 'plain', trigger: 'dodge', effect: { kind: 'haste', target: 'self', power: 50 } },
  { id: 'hunters_brand', name: '사냥꾼의 낙인', kind: 'plain', trigger: 'useActive', effect: { kind: 'mark', target: 'random', power: 0 } },
  { id: 'judgement', name: '심판', kind: 'plain', trigger: 'kill', effect: { kind: 'strike', target: 'marked', power: 8, inheritElement: true } },
  { id: 'scar_tissue', name: '흉터 조직', kind: 'plain', trigger: 'hit', effect: { kind: 'shield', target: 'self', power: 2 } },
  { id: 'altar_echo', name: '제단의 메아리', kind: 'plain', trigger: 'offer', effect: { kind: 'cdReduce', target: 'self', power: 3 } },
  { id: 'thunder_sermon', name: '천둥 설교', kind: 'single', trigger: 'takeElement', element: 'lightning', effect: { kind: 'blast', target: 'self', element: 'lightning', power: 6, radius: 2 } },
  { id: 'kindled_blade', name: '불붙은 칼날', kind: 'plain', trigger: 'move3', effect: { kind: 'imbue', target: 'self', element: 'fire', power: 0 } },
  { id: 'rebound', name: '되튕김', kind: 'single', trigger: 'hit', element: undefined, effect: { kind: 'push', target: 'target', power: 2, element: 'impact' } },
];

export const ENGRAVING_BY_ID: Record<string, EngravingDef> = Object.fromEntries(ENGRAVINGS.map((e) => [e.id, e]));
export const ENGRAVING_POOL = ENGRAVINGS.filter((e) => !e.unique);
