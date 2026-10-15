import type { EngravingDef } from '../core/types';

// 각인 = [행동] 할 때 → [효과]. 행동은 공격 · 이동 · 피격 · 대기 네 가지뿐이다.
// 공격: 기본 공격과 액티브 모두. 피격: 회피하지 못하고 맞았을 때. 대기: 제자리에서 턴을 넘길 때.
export const ENGRAVINGS: EngravingDef[] = [
  // ── 기원 고유 (기원마다 다른 행동에 붙는다) ──
  { id: 'furnace_vow', name: '용광로의 서약', unique: true, trigger: 'attack', effect: { kind: 'shards', target: 'around', element: 'fire', power: 4, count: 1, radius: 3 } },
  { id: 'gravekeeper_rite', name: '묘지기의 의식', unique: true, trigger: 'hit', effect: { kind: 'status', target: 'target', status: 'slow', duration: 3, power: 0 } },
  { id: 'bellringer_toll', name: '종지기의 타종', unique: true, trigger: 'wait', effect: { kind: 'chain', target: 'random', element: 'lightning', power: 4, count: 3 } },

  // ── 공격할 때 ──
  { id: 'ember_hand', name: '잿불의 손', trigger: 'attack', effect: { kind: 'terrain', target: 'target', terrain: 'flame', power: 3, duration: 3, radius: 0 } },
  { id: 'arc_litany', name: '번개 연도', trigger: 'attack', effect: { kind: 'chain', target: 'target', element: 'lightning', power: 3, count: 2 } },
  { id: 'iron_gospel', name: '쇠의 복음', trigger: 'attack', effect: { kind: 'push', target: 'target', power: 1 } },
  { id: 'frost_claw', name: '서리 손톱', trigger: 'attack', effect: { kind: 'status', target: 'target', status: 'slow', duration: 2, power: 0, element: 'cold' } },
  { id: 'hunters_brand', name: '사냥꾼의 낙인', trigger: 'attack', effect: { kind: 'mark', target: 'target', power: 0 } },
  { id: 'scavenger_creed', name: '넝마주이의 신조', trigger: 'attack', effect: { kind: 'shards', target: 'around', element: 'impact', power: 2, count: 1, radius: 4, perElementKind: true } },

  // ── 이동할 때 ──
  { id: 'pilgrim_step', name: '순례자의 걸음', trigger: 'move', effect: { kind: 'strike', target: 'random', element: 'lightning', power: 3 } },
  { id: 'kindled_blade', name: '불붙은 칼날', trigger: 'move', effect: { kind: 'imbue', target: 'self', element: 'fire', power: 0 } },
  { id: 'frost_trail', name: '서리 발자국', trigger: 'move', effect: { kind: 'terrain', target: 'self', terrain: 'ice', power: 0, duration: 4, radius: 0 } },
  { id: 'wind_step', name: '바람 걸음', trigger: 'move', effect: { kind: 'haste', target: 'self', power: 20 } },

  // ── 피격될 때 ──
  { id: 'stitched_heart', name: '꿰맨 심장', trigger: 'hit', effect: { kind: 'shield', target: 'self', power: 3 } },
  { id: 'thorn_reliquary', name: '가시 성유물', trigger: 'hit', effect: { kind: 'strike', target: 'target', element: 'impact', power: 4 } },
  { id: 'thunder_sermon', name: '천둥 설교', trigger: 'hit', effect: { kind: 'blast', target: 'self', element: 'lightning', power: 4, radius: 1 } },
  { id: 'last_rites', name: '종부성사', trigger: 'hit', effect: { kind: 'summon', target: 'self', power: 3, duration: 4, count: 1 } },

  // ── 대기할 때 ──
  { id: 'martyr_vigil', name: '순교자의 철야', trigger: 'wait', effect: { kind: 'repair', target: 'self', power: 3 } },
  { id: 'judgement', name: '심판', trigger: 'wait', effect: { kind: 'strike', target: 'marked', power: 8 } },
  { id: 'still_prayer', name: '정적의 기도', trigger: 'wait', effect: { kind: 'cdReduce', target: 'self', power: 1 } },
  { id: 'frost_breath', name: '서리 숨결', trigger: 'wait', effect: { kind: 'blast', target: 'self', element: 'cold', power: 4, radius: 1 } },
  { id: 'altar_echo', name: '제단의 메아리', trigger: 'wait', effect: { kind: 'shield', target: 'self', power: 4 } },
];

export const ENGRAVING_BY_ID: Record<string, EngravingDef> = Object.fromEntries(ENGRAVINGS.map((e) => [e.id, e]));
export const ENGRAVING_POOL = ENGRAVINGS.filter((e) => !e.unique);
