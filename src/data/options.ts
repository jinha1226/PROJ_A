import type { Element, OptionId } from '../core/types';

/** 무기 옵션 12종 (MVP). 적중 효과는 맞으면 상태를 만들고, 조건 효과는 조건이 맞으면 피해를 키운다.
 *  한 무기가 상태를 만들고 다른 무기가 그 상태를 이용하는 것이 조합의 기본이다. */
export interface OptionDef {
  id: OptionId;
  name: string;
  kind: 'hit' | 'cond';
  desc: string;
  /** 적중 효과 중 원소: 공격 원소가 된다 (한 무기에 하나만) */
  element?: Element;
}

export const OPTIONS: OptionDef[] = [
  { id: 'fire', name: '화염', kind: 'hit', element: 'fire', desc: '맞은 적에게 화상 3턴' },
  { id: 'cold', name: '냉기', kind: 'hit', element: 'cold', desc: '맞은 적 둔화. 이미 둔화된 적은 1턴 빙결' },
  { id: 'lightning', name: '번개', kind: 'hit', element: 'lightning', desc: '맞은 적 옆의 적 하나에게 피해 절반이 튐' },
  { id: 'impact', name: '충격', kind: 'hit', element: 'impact', desc: '맞은 적을 1칸 밀침. 벽에 박으면 기절' },
  { id: 'leech', name: '흡수', kind: 'hit', desc: '준 피해의 1/4만큼 가장 많이 깎인 부위의 장갑 수리' },
  { id: 'blast', name: '처치 폭발', kind: 'hit', desc: '이 무기로 처치하면 주변 1칸에 무기 피해 절반의 폭발' },
  { id: 'burnHunt', name: '화염 사냥', kind: 'cond', desc: '불붙은 적에게 치명타' },
  { id: 'iceBreak', name: '얼음 깨기', kind: 'cond', desc: '둔화된 적에게 피해 ×1.5, 빙결된 적에게 치명타' },
  { id: 'ambush', name: '기습', kind: 'cond', desc: '이동한 직후의 첫 공격 피해 +40%' },
  { id: 'aim', name: '정조준', kind: 'cond', desc: '대기·재장전한 다음 첫 공격 치명타' },
  { id: 'riposte', name: '반격', kind: 'cond', desc: '직전 적의 차례에 맞았다면 피해 +50%' },
  { id: 'despair', name: '궁지', kind: 'cond', desc: '체력 50% 이하일 때 피해 +30%' },
];
export const OPTION_BY_ID = Object.fromEntries(OPTIONS.map((o) => [o.id, o])) as Record<OptionId, OptionDef>;

/** 치명타 배율 (치명타는 조건으로만 생긴다) */
export const CRIT_MULT = 2;
