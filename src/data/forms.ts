import type { EffectSpec, Element, FormId } from '../core/types';

// 액티브 = 형태 × 원소 × 수치. 원소 부가 효과는 각인과 같은 효과 어휘를 쓴다.
export const FORM_NAME: Record<FormId, string> = {
  sweep: '휩쓸기',
  dash: '돌진',
  throw: '투척',
  bolt: '관통',
  nova: '파동',
};

export const FORM_DESC: Record<FormId, string> = {
  sweep: '주변 8칸을 벤다',
  dash: '대상에게 돌진해 들이받는다',
  throw: '착탄 지점에 던진다',
  bolt: '직선상 모든 적을 꿰뚫는다',
  nova: '주변 2칸에 파동을 퍼뜨린다',
};

export const FORM_NEEDS_TARGET: Record<FormId, boolean> = {
  sweep: false,
  dash: true,
  throw: true,
  bolt: true,
  nova: false,
};

type Rider = (power: number) => EffectSpec;

/** 형태 × 원소 → 맞은 대상(또는 지점)에 붙는 부가 효과 */
export const FORM_RIDERS: Record<FormId, Partial<Record<Element, Rider>>> = {
  sweep: {
    fire: (p) => ({ kind: 'terrain', target: 'target', terrain: 'flame', power: Math.ceil(p / 3), duration: 3 }),
    cold: () => ({ kind: 'status', target: 'target', status: 'slow', duration: 3, power: 0 }),
    lightning: (p) => ({ kind: 'chain', target: 'target', element: 'lightning', power: Math.ceil(p / 2), count: 1 }),
    impact: () => ({ kind: 'push', target: 'target', power: 2 }),
  },
  dash: {
    fire: (p) => ({ kind: 'terrain', target: 'self', terrain: 'flame', power: Math.ceil(p / 3), duration: 3, radius: 0 }),
    cold: () => ({ kind: 'terrain', target: 'target', terrain: 'ice', power: 0, duration: 4, radius: 1 }),
    lightning: (p) => ({ kind: 'blast', target: 'target', element: 'lightning', power: Math.ceil(p / 2), radius: 1 }),
    impact: () => ({ kind: 'status', target: 'target', status: 'stun', duration: 2, power: 0 }),
  },
  throw: {
    fire: (p) => ({ kind: 'blast', target: 'target', element: 'fire', power: Math.ceil(p / 2), radius: 1 }),
    cold: () => ({ kind: 'terrain', target: 'target', terrain: 'ice', power: 0, duration: 5, radius: 1 }),
    lightning: (p) => ({ kind: 'chain', target: 'target', element: 'lightning', power: Math.ceil(p / 2), count: 2 }),
    impact: () => ({ kind: 'push', target: 'target', power: 3 }),
  },
  bolt: {
    fire: () => ({ kind: 'status', target: 'target', status: 'burn', duration: 3, power: 0 }),
    cold: () => ({ kind: 'status', target: 'target', status: 'slow', duration: 3, power: 0 }),
    lightning: (p) => ({ kind: 'terrain', target: 'target', terrain: 'current', power: Math.ceil(p / 3), duration: 3 }),
    impact: () => ({ kind: 'push', target: 'target', power: 1 }),
  },
  nova: {
    fire: () => ({ kind: 'status', target: 'target', status: 'burn', duration: 3, power: 0 }),
    cold: () => ({ kind: 'status', target: 'target', status: 'slow', duration: 3, power: 0 }),
    lightning: () => ({ kind: 'status', target: 'target', status: 'blind', duration: 2, power: 0 }),
    impact: () => ({ kind: 'push', target: 'target', power: 2 }),
  },
};
