import type { Actor } from './types';

/** 적의 외형 종류: 마네킹 하나를 색·크기·무기로 구분한다 (렌더러 bridge와 무기 드롭이 같이 쓴다) */
export type FoeKind = 'minion' | 'archer' | 'brute' | 'ghoul' | 'mage' | 'champion';

/** 덩치 큰 근접 몬스터 (거한 모습: 도끼 + 방패) */
const HEAVY = new Set(['maul_templar', 'cinder_zealot', 'bone_reaper', 'inquisitor']);

export function foeKind(a: Actor): FoeKind {
  if (a.ai === 'dummy') return 'minion';
  if (a.boss) return 'champion';
  if (a.ai === 'ranged') {
    const el = a.slots.arm.find((r) => r?.def.active)?.def.active?.element;
    return el === 'fire' || el === 'lightning' ? 'mage' : 'archer';
  }
  if (a.ai === 'skirmisher') return 'ghoul';
  return HEAVY.has(a.templateId ?? '') ? 'brute' : 'minion';
}

/** 그 모습이 들고 있는 무기 (처치하면 이 무기를 떨어뜨릴 수 있다). 맨손이면 없음 */
export const FOE_WEAPON: Record<FoeKind, string[]> = {
  minion: ['dagger'],
  archer: ['bow'],
  brute: ['greataxe', 'shield'],
  ghoul: [],
  mage: ['staff'],
  champion: ['longsword', 'shield'],
};
