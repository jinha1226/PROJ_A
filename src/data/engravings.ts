import type { EngravingDef } from '../core/types';

// 각인 = [행동] 할 때 → [효과]. 행동은 공격 · 이동 · 피격 · 대기 네 가지뿐이다.
// 공격: 기본 공격과 액티브 모두. 피격: 회피하지 못하고 맞았을 때. 대기: 제자리에서 턴을 넘길 때.
export const ENGRAVINGS: EngravingDef[] = [
  // ── MODEL 라인 고유 (라인마다 다른 행동에 붙는다) ──
  { id: 'aux_fire', name: '보조 사격', unique: true, trigger: 'wait', effect: { kind: 'strike', target: 'nearest', power: 4 } },
  { id: 'counter_protocol', name: '반격 프로토콜', unique: true, trigger: 'hit', effect: { kind: 'strike', target: 'target', element: 'impact', power: 5 } },
  { id: 'element_vent', name: '원소 방출', unique: true, trigger: 'attack', effect: { kind: 'shards', target: 'around', element: 'fire', power: 4, count: 1, radius: 3 } },

  // ── 공격할 때 ──
  { id: 'ember_hand', name: '잔불 루틴', trigger: 'attack', effect: { kind: 'terrain', target: 'target', terrain: 'flame', power: 3, duration: 3, radius: 0 } },
  { id: 'arc_litany', name: '아크 연계', trigger: 'attack', effect: { kind: 'chain', target: 'target', element: 'lightning', power: 3, count: 2 } },
  { id: 'iron_gospel', name: '충격 반동', trigger: 'attack', effect: { kind: 'push', target: 'target', power: 1 } },
  { id: 'frost_claw', name: '냉각 탄두', trigger: 'attack', effect: { kind: 'status', target: 'target', status: 'slow', duration: 2, power: 0, element: 'cold' } },
  { id: 'hunters_brand', name: '표적 지정', trigger: 'attack', effect: { kind: 'mark', target: 'target', power: 0 } },
  { id: 'scavenger_creed', name: '잡식 분석기', trigger: 'attack', effect: { kind: 'shards', target: 'around', element: 'impact', power: 2, count: 1, radius: 4, perElementKind: true } },

  // ── 이동할 때 ──
  { id: 'pilgrim_step', name: '방전 보행', trigger: 'move', effect: { kind: 'strike', target: 'random', element: 'lightning', power: 3 } },
  { id: 'kindled_blade', name: '점화 충전', trigger: 'move', effect: { kind: 'imbue', target: 'self', element: 'fire', power: 0 } },
  { id: 'frost_trail', name: '냉각 자국', trigger: 'move', effect: { kind: 'terrain', target: 'self', terrain: 'ice', power: 0, duration: 4, radius: 0 } },
  { id: 'wind_step', name: '추진 보조', trigger: 'move', effect: { kind: 'haste', target: 'self', power: 20 } },

  // ── 피격될 때 ──
  { id: 'stitched_heart', name: '응급 장갑', trigger: 'hit', effect: { kind: 'shield', target: 'self', power: 3 } },
  { id: 'thorn_reliquary', name: '반응 장갑', trigger: 'hit', effect: { kind: 'strike', target: 'target', element: 'impact', power: 4 } },
  { id: 'thunder_sermon', name: '과전류 방출', trigger: 'hit', effect: { kind: 'blast', target: 'self', element: 'lightning', power: 4, radius: 1 } },
  { id: 'last_rites', name: '홀로그램 분신', trigger: 'hit', effect: { kind: 'summon', target: 'self', power: 3, duration: 4, count: 1 } },

  // ── 대기할 때 ──
  { id: 'martyr_vigil', name: '자가 수리', trigger: 'wait', effect: { kind: 'repair', target: 'self', power: 3 } },
  { id: 'judgement', name: '처형 프로토콜', trigger: 'wait', effect: { kind: 'strike', target: 'marked', power: 8 } },
  { id: 'still_prayer', name: '냉각 대기', trigger: 'wait', effect: { kind: 'cdReduce', target: 'self', power: 1 } },
  { id: 'frost_breath', name: '냉기 방출', trigger: 'wait', effect: { kind: 'blast', target: 'self', element: 'cold', power: 4, radius: 1 } },
  { id: 'altar_echo', name: '방어막 충전', trigger: 'wait', effect: { kind: 'shield', target: 'self', power: 4 } },
];

export const ENGRAVING_BY_ID: Record<string, EngravingDef> = Object.fromEntries(ENGRAVINGS.map((e) => [e.id, e]));
export const ENGRAVING_POOL = ENGRAVINGS.filter((e) => !e.unique);
